-- ============================================================================
--  Availability queries and the booking entry point.
--  The SQL twins of the functions in src/data/accommodationDB.js.
-- ============================================================================

-- ============================================================ occupancy window
-- Given the dates and a schedule, returns the exact timestamp range a unit is
-- held for. Passing a null schedule falls back to whole calendar days
-- (check-out day exclusive) — the conservative answer used before a guest has
-- picked a schedule.

create or replace function public.occupancy_window(
    p_check_in     date,
    p_check_out    date default null,
    p_schedule_key text default null
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
set search_path = public
as $$
declare
    s        public.stay_schedules%rowtype;
    v_tz     text := public.resort_timezone();
    v_end    date;
    v_starts timestamptz;
    v_ends   timestamptz;
begin
    if p_schedule_key is null then
        v_end := coalesce(p_check_out, p_check_in);
        starts_at := p_check_in::timestamp at time zone v_tz;
        ends_at := case
            when v_end > p_check_in then v_end::timestamp at time zone v_tz
            else (p_check_in + 1)::timestamp at time zone v_tz
        end;
        return next;
        return;
    end if;

    select * into s from public.stay_schedules where key = p_schedule_key;
    if not found then
        raise exception 'Unknown stay schedule: %', p_schedule_key;
    end if;

    v_end := case when s.same_day then p_check_in
                  else coalesce(p_check_out, p_check_in) end;

    v_starts := (p_check_in::timestamp + make_interval(mins => s.start_minutes)) at time zone v_tz;
    v_ends   := (v_end::timestamp + make_interval(mins => s.end_minutes)) at time zone v_tz;

    -- Guards an overnight saved with both dates equal: hold a full day.
    if v_ends <= v_starts then
        v_ends := v_starts + interval '1 day';
    end if;

    starts_at := v_starts;
    ends_at := v_ends;
    return next;
end;
$$;


-- Fills starts_at / ends_at from the dates + schedule on every write, so the
-- window the exclusion constraint checks is always the real one.
create or replace function public.bookings_set_occupancy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    w record;
    s public.stay_schedules%rowtype;
begin
    select * into s from public.stay_schedules where key = new.schedule_key;
    if not found then
        raise exception 'Unknown stay schedule: %', new.schedule_key;
    end if;

    if s.same_day then
        new.check_out_date := new.check_in_date;
    else
        new.check_out_date := coalesce(new.check_out_date, new.check_in_date);
    end if;

    select * into w from public.occupancy_window(new.check_in_date, new.check_out_date, new.schedule_key);
    new.starts_at := w.starts_at;
    new.ends_at := w.ends_at;
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists bookings_set_occupancy_trg on public.bookings;
create trigger bookings_set_occupancy_trg
    before insert or update of check_in_date, check_out_date, schedule_key
    on public.bookings
    for each row execute function public.bookings_set_occupancy();


-- ================================================================== queries

-- Units of a type that are free for the given stay.
create or replace function public.available_units(
    p_type_id      text,
    p_check_in     date,
    p_check_out    date default null,
    p_schedule_key text default null
)
returns table (unit_id text)
language sql
stable
set search_path = public
as $$
    with w as (
        select * from public.occupancy_window(p_check_in, p_check_out, p_schedule_key)
    )
    select u.id
    from public.accommodation_units u, w
    where u.type_id = p_type_id
      and u.is_active
      and not exists (
          select 1 from public.bookings b
          where b.unit_id = u.id
            and b.status <> 'cancelled'
            and b.occupancy && tstzrange(w.starts_at, w.ends_at, '[)')
      )
    order by u.unit_no;
$$;


-- How many units of each type are free for the stay — what the booking page
-- carousel and the admin cards render. SECURITY DEFINER so guests can see
-- counts without being able to read anyone's booking row.
create or replace function public.accommodation_availability(
    p_check_in     date,
    p_check_out    date default null,
    p_schedule_key text default null
)
returns table (type_id text, name text, total integer, available integer)
language sql
stable
security definer
set search_path = public
as $$
    select t.id,
           t.name,
           t.total,
           (select count(*)::integer
              from public.available_units(t.id, p_check_in, p_check_out, p_schedule_key))
    from public.accommodation_types t
    where t.is_active
    order by t.sort_order, t.name;
$$;


-- First day from p_from with at least one free unit of the type, or null.
create or replace function public.next_available_date(
    p_type_id      text,
    p_from         date default current_date,
    p_schedule_key text default null,
    p_max_days     integer default 60
)
returns date
language sql
stable
security definer
set search_path = public
as $$
    select d::date
    from generate_series(p_from, p_from + p_max_days, interval '1 day') as d
    where exists (
        select 1 from public.available_units(
            p_type_id,
            d::date,
            case when (select same_day from public.stay_schedules where key = p_schedule_key)
                 then d::date else (d + interval '1 day')::date end,
            p_schedule_key)
    )
    order by d
    limit 1;
$$;


-- What happens on one unit on one calendar day, with each booking's hours
-- clipped to that day. Drives the admin Units board.
create or replace function public.unit_day_detail(p_date date)
returns table (
    unit_id     text,
    type_id     text,
    booking_id  uuid,
    guest_name  text,
    status      public.booking_status,
    from_at     timestamptz,
    to_at       timestamptz
)
language sql
stable
set search_path = public
as $$
    with bounds as (
        select p_date::timestamp at time zone public.resort_timezone() as day_start,
               (p_date + 1)::timestamp at time zone public.resort_timezone() as day_end
    )
    select u.id,
           u.type_id,
           b.id,
           b.guest_name,
           b.status,
           greatest(b.starts_at, d.day_start),
           least(b.ends_at, d.day_end)
    from public.accommodation_units u
    cross join bounds d
    left join public.bookings b
           on b.unit_id = u.id
          and b.status <> 'cancelled'
          and b.occupancy && tstzrange(d.day_start, d.day_end, '[)')
    where u.is_active
    order by u.id, b.starts_at;
$$;


-- ================================================================ book a stay
-- Picks a free unit and inserts, in one transaction. Two guests racing for the
-- last unit cannot both win — the loser hits the exclusion constraint and gets
-- the friendly message below.

create or replace function public.book_accommodation(
    p_type_id      text,
    p_schedule_key text,
    p_check_in     date,
    p_check_out    date,
    p_guest_name   text,
    p_guest_email  text default null,
    p_guest_mobile text default null,
    p_pax          integer default null,
    p_kids         integer default 0,
    p_seniors      integer default 0,
    p_price        numeric default null,
    p_entrance_total numeric default null,
    p_receipt_url  text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
    v_unit    text;
    v_tracked boolean;
    v_next    date;
    v_row     public.bookings;
begin
    select exists (select 1 from public.accommodation_types where id = p_type_id and is_active)
      into v_tracked;

    -- Types with a unit ceiling need a free unit; unlimited ones (tent
    -- pitching) book without holding anything.
    if v_tracked then
        select unit_id into v_unit
        from public.available_units(p_type_id, p_check_in, p_check_out, p_schedule_key)
        limit 1;

        if v_unit is null then
            v_next := public.next_available_date(p_type_id, p_check_in, p_schedule_key, 60);
            raise exception using
                errcode = 'P0001',
                message = format('%s is fully booked for that schedule.',
                                 coalesce((select name from public.accommodation_types where id = p_type_id), p_type_id)),
                detail  = coalesce('Next free date: ' || v_next::text, 'No free date in the next 60 days.'),
                hint    = 'unavailable';
        end if;
    end if;

    insert into public.bookings (
        code, type_id, unit_id, schedule_key,
        check_in_date, check_out_date,
        starts_at, ends_at,                       -- overwritten by the trigger
        guest_name, guest_email, guest_mobile,
        pax, kids, seniors,
        price, downpayment, entrance_total,
        payment, receipt_url, status
    ) values (
        'CBL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
        p_type_id, v_unit, p_schedule_key,
        p_check_in, p_check_out,
        now(), now() + interval '1 hour',
        p_guest_name, p_guest_email, p_guest_mobile,
        p_pax, p_kids, p_seniors,
        p_price, p_price * 0.5, p_entrance_total,
        -- A CASE result is untyped text, so it needs the explicit enum cast.
        (case when p_receipt_url is null then 'unpaid' else 'down-payment' end)::public.payment_status,
        p_receipt_url,
        'pending'::public.booking_status
    )
    returning * into v_row;

    return v_row;
exception
    -- Lost the race for the last unit between the SELECT and the INSERT.
    when exclusion_violation then
        raise exception using
            errcode = 'P0001',
            message = 'That unit was just taken for those hours. Please pick another date or unit.',
            hint    = 'unavailable';
end;
$$;
