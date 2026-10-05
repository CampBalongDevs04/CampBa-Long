-- ============================================================================
--  Camp Ba-long — Free entrance adds up per unit
-- ----------------------------------------------------------------------------
--  THE RULE THAT CHANGED
--  ----------------------
--  20260924120000_accommodation_free_entrance_pax.sql made the free-entrance
--  perk ride on the BOOKING: a cart took the HIGHEST free_entrance_pax in it,
--  so two Teepees at 2 pax each still waived entrance for only 2 pax.
--
--  It now rides on each UNIT: the cart adds them up, so two Teepees waive
--  entrance for 4 pax. A unit with 0 adds nothing, so Teepee + Cottage is
--  still 2. Rent All Resort never shares a cart with another unit, so it keeps
--  its own number unchanged.
--
--  p_items carries one entry per unit (the booking page expands a qty-2 line
--  into two entries), so summing over p_items is a per-unit sum. The booking
--  page quotes the same sum — cartFreeEntranceQuota() in
--  src/data/accomodationOptions.js.
--
--  WHAT THIS TOUCHES
--  -----------------
--  Only book_stay_group(), and in it only the line that works out v_quota.
--  No table, column, row or policy is changed. Existing bookings keep the
--  entrance figures they were stored with. book_accommodation() (a single
--  unit) is untouched — one unit's sum is its own number.
--
--  Grants: same signature, so CREATE OR REPLACE keeps every privilege.
--
--  To undo: re-run book_stay_group from
--  20260924120000_accommodation_free_entrance_pax.sql.
-- ============================================================================

create or replace function public.book_stay_group(
    p_items        jsonb,
    p_schedule_key text,
    p_check_in     date,
    p_check_out    date,
    p_guest_name   text,
    p_guest_email  text default null,
    p_guest_mobile text default null,
    p_pax          integer default null,
    p_kids         integer default 0,
    p_seniors      integer default 0,
    p_entrance_total numeric default null,
    p_entrance_per_head        numeric default 0,
    p_entrance_senior_discount numeric default 0,
    p_entrance_free_applied    integer default 0,
    p_entrance_free_savings    numeric default 0,
    p_owner_token  text default null,
    p_pwd          integer default 0
)
returns public.booking_groups
language plpgsql
security definer
set search_path = public
as $$
declare
    v_group    public.booking_groups;
    v_item     jsonb;
    v_booking  public.bookings;
    v_subtotal numeric := 0;
    v_type_id  text;
    v_schedule public.stay_schedules;
    v_quota    integer;
    v_nights   integer;
    v_entrance record;
begin
    perform public.expire_stale_booking_groups();

    if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'Pick at least one accommodation.' using errcode = 'P0001';
    end if;

    select * into v_schedule from public.stay_schedules where key = p_schedule_key;
    if not found then
        raise exception 'Unknown stay schedule: %', p_schedule_key using errcode = 'P0001';
    end if;

    v_nights := case when v_schedule.same_day
                     then 1
                     else greatest(p_check_out - p_check_in, 1) end;

    -- Every unit's free_entrance_pax added up — one p_items entry per unit, so
    -- two Teepees at 2 each come to 4. The same number the booking page quotes
    -- (cartFreeEntranceQuota() in src/data/accomodationOptions.js). A unit
    -- with 0 adds nothing, so it cannot take the perk away from the unit
    -- beside it.
    select sum(greatest(coalesce(t.free_entrance_pax, 2), 0))
      into v_quota
    from jsonb_array_elements(p_items) as item(value)
    join public.accommodation_types t on t.id = item.value ->> 'type_id';
    v_quota := coalesce(v_quota, 2);

    select * into v_entrance from public.entrance_breakdown(
        v_schedule.entrance_fee, p_pax, p_kids, p_seniors,
        v_quota > 0, v_nights, v_quota);

    insert into public.booking_groups (
        code, schedule_key, check_in_date, check_out_date,
        starts_at, ends_at,                       -- overwritten by the trigger
        guest_name, guest_email, guest_mobile,
        pax, kids, seniors, pwd,
        entrance_total, entrance_per_head, entrance_senior_discount,
        entrance_free_applied, entrance_free_savings,
        status, owner_hash
    ) values (
        'CBG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
        p_schedule_key, p_check_in, p_check_out,
        now(), now() + interval '1 hour',
        p_guest_name, p_guest_email, p_guest_mobile,
        p_pax, p_kids, p_seniors, coalesce(p_pwd, 0),
        v_entrance.total, v_entrance.per_head, v_entrance.senior_discount,
        v_entrance.free_applied, v_entrance.free_savings,
        'pending'::public.booking_status,
        public.booking_owner_hash(p_owner_token)
    )
    returning * into v_group;

    for v_item in select * from jsonb_array_elements(p_items) loop
        v_type_id := v_item ->> 'type_id';

        if v_type_id is null then
            raise exception 'Every accommodation in the cart needs a type.' using errcode = 'P0001';
        end if;

        v_booking := public.book_accommodation(
            p_type_id      => v_type_id,
            p_schedule_key => p_schedule_key,
            p_check_in     => p_check_in,
            p_check_out    => p_check_out,
            p_guest_name   => p_guest_name,
            p_guest_email  => p_guest_email,
            p_guest_mobile => p_guest_mobile,
            -- pax/kids/seniors/pwd/entrance live on the group, not per unit — a
            -- member row's own bookings_specials_fit check passes trivially
            -- because coalesce(pax, 0) = 0. Its entrance comes out as 0 for the
            -- same reason: no party on the row, nothing to charge entrance for.
            p_pax          => null,
            p_kids         => 0,
            p_seniors      => 0,
            p_pwd          => 0,
            p_owner_token  => p_owner_token
        );

        update public.bookings set group_id = v_group.id where id = v_booking.id;

        -- What the member row was actually priced at, not what the cart claimed.
        -- p_items[].price is not read at all any more.
        v_subtotal := v_subtotal + coalesce(v_booking.price, 0);
    end loop;

    update public.booking_groups
       set unit_subtotal = v_subtotal
     where id = v_group.id
    returning * into v_group;

    v_group.owner_hash := null;
    return v_group;
end;
$$;
