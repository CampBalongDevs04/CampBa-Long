-- The my-booking card and the admin export both show the entrance fee broken
-- down, not just its total: the per-head rate, the free-entrance perk applied,
-- and the senior discount. Storing only entrance_total meant those fields came
-- back undefined and crashed the card, so keep the whole breakdown.
alter table public.bookings
    add column if not exists entrance_per_head        numeric(10,2) not null default 0,
    add column if not exists entrance_senior_discount numeric(10,2) not null default 0,
    add column if not exists entrance_free_applied    integer       not null default 0,
    add column if not exists entrance_free_savings    numeric(10,2) not null default 0;

-- Adding parameters would create an overload rather than replace the function,
-- and PostgREST would then fail to choose between them. Drop first.
drop function if exists public.book_accommodation(text, text, date, date, text, text, text, integer, integer, integer, numeric, numeric, text);

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
    p_receipt_url  text default null,
    p_entrance_per_head        numeric default 0,
    p_entrance_senior_discount numeric default 0,
    p_entrance_free_applied    integer default 0,
    p_entrance_free_savings    numeric default 0
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
        price, downpayment,
        entrance_total, entrance_per_head, entrance_senior_discount,
        entrance_free_applied, entrance_free_savings,
        payment, receipt_url, status
    ) values (
        'CBL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
        p_type_id, v_unit, p_schedule_key,
        p_check_in, p_check_out,
        now(), now() + interval '1 hour',
        p_guest_name, p_guest_email, p_guest_mobile,
        p_pax, p_kids, p_seniors,
        p_price, p_price * 0.5,
        p_entrance_total, coalesce(p_entrance_per_head, 0), coalesce(p_entrance_senior_discount, 0),
        coalesce(p_entrance_free_applied, 0), coalesce(p_entrance_free_savings, 0),
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

grant execute on function public.book_accommodation(text, text, date, date, text, text, text, integer, integer, integer, numeric, numeric, text, numeric, numeric, integer, numeric) to anon, authenticated;

-- Backfill rows created before these columns existed: recover the per-head
-- rate from the stay schedule and the senior discount (10%) from the count.
update public.bookings b
   set entrance_per_head = s.entrance_fee,
       entrance_senior_discount = round(b.seniors * s.entrance_fee * 0.10, 2)
  from public.stay_schedules s
 where s.key = b.schedule_key
   and b.entrance_total > 0
   and b.entrance_per_head = 0;
