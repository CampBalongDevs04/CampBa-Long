-- ============================================================================
--  Camp Ba-long — refuse a booking whose schedule window is already over
-- ----------------------------------------------------------------------------
--  THE HOLE
--  --------
--  TimeSelector only ever greyed out a schedule for one reason: an overnight
--  stay whose very next day is a maintenance closure (see the comment at the
--  top of src/pages/components/timeSelector.jsx). Nothing checked whether a
--  SAME-DAY schedule's window had already elapsed for today's date — so a
--  guest picking today as check-in could still book Day Time (10:00–17:00)
--  at 9pm, creating a row whose ends_at is already in the past the moment it
--  is written.
--
--  That is worse than a cosmetic gap: cancel_my_booking() already refuses to
--  cancel a booking once `ends_at < now()` ("That stay is already over and
--  can no longer be cancelled.") — so a guest who slipped one through would
--  be stuck holding (and able to pay for) a stay that is already over, with
--  no self-serve way out.
--
--  THE FIX, IN TWO LAYERS
--  -----------------------
--  1. Frontend (this commit's other half, timeSelector.jsx): greys the card
--     out once its own window has passed for a same-day check-in. A UI hint,
--     not the rule itself — same relationship the payment countdown has to
--     booking_hold_expired().
--  2. HERE: book_accommodation() computes the SAME occupancy_window() the
--     bookings_set_occupancy() trigger will use to fill starts_at/ends_at,
--     and refuses outright if that window's end is already at or before the
--     server's own now(). This is what actually closes the hole — a slow
--     device clock, a stale tab, or a direct API call cannot get past it,
--     because it never trusts the browser's idea of the time.
--
--  Placed before the unit-availability check so a guest picking an elapsed
--  slot gets an honest "that window already ended" rather than a confusing
--  "fully booked" if it happens to fail both.
--
--  book_stay_group() needs no separate change: every member unit in a
--  combined reservation is inserted by calling THIS function once per item,
--  so the same guard covers group bookings for free.
--
--  Signature is unchanged, so this is CREATE OR REPLACE — safe per
--  20260813150000_revoke_direct_book_accommodation.sql's own warning: DROP
--  resets the revoked anon/authenticated grant on this function, CREATE OR
--  REPLACE does not. Do not turn this into a DROP + CREATE.
-- ============================================================================

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
    p_entrance_free_savings    numeric default 0,
    p_owner_token  text default null,
    p_pwd          integer default 0
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
    v_unit     text;
    v_tracked  boolean;
    v_next     date;
    v_row      public.bookings;
    v_schedule public.stay_schedules;
    v_eligible boolean;
    v_nights   integer;
    v_price    numeric;
    v_entrance record;
    v_window   record;

    -- Broken out of v_entrance so a row with no party of its own can be stored
    -- exactly as it always was — see where they are set below.
    v_ent_total     numeric := null;
    v_ent_per_head  numeric := 0;
    v_ent_senior    numeric := 0;
    v_ent_free_cnt  integer := 0;
    v_ent_free_save numeric := 0;
begin
    -- Hand back every unit whose ten minutes ran out, so this booking can have
    -- one of them.
    perform public.expire_stale_bookings();

    -- Refuse a schedule whose window is already over by the SERVER's clock —
    -- see the header. Checked against the exact function the occupancy
    -- trigger uses, so the two can never disagree about when a stay ends.
    select * into v_window from public.occupancy_window(p_check_in, p_check_out, p_schedule_key);
    if v_window.ends_at <= now() then
        raise exception using
            errcode = 'P0001',
            message = 'That schedule''s window has already ended for today. Pick a later date, or a schedule that hasn''t started yet.',
            hint    = 'unavailable';
    end if;

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

    -- ------------------------------------------------------------- the money
    -- Everything below this line used to come from the caller. See the header.
    select * into v_schedule from public.stay_schedules where key = p_schedule_key;
    if not found then
        raise exception 'Unknown stay schedule: %', p_schedule_key using errcode = 'P0001';
    end if;

    -- How many nights this is BILLED for. Day Time is one block however the
    -- dates read, and never bills as zero. The twin of billableNights() in
    -- src/data/extendedStay.js, and it agrees with the generated bookings.nights.
    v_nights := case when v_schedule.same_day
                     then 1
                     else greatest(p_check_out - p_check_in, 1) end;

    v_price := round(public.effective_rate_price(p_type_id, v_schedule.rate_group) * v_nights, 2);

    -- A unit added from the dashboard with no flag set is eligible, same as the
    -- column default — the exclusions are the exception, not the rule.
    select coalesce(free_entrance_eligible, true) into v_eligible
    from public.accommodation_types where id = p_type_id;

    -- No pax means no party ON THIS ROW: it is a group member, and the group
    -- row carries the party and the whole reservation's entrance. Leaving the
    -- five fields at their no-party values (null total, zeroes) is how such a
    -- row has always looked, so the admin list and the receipt read unchanged.
    if p_pax is not null then
        select * into v_entrance from public.entrance_breakdown(
            v_schedule.entrance_fee, p_pax, p_kids, p_seniors,
            coalesce(v_eligible, true), v_nights);

        v_ent_total     := v_entrance.total;
        v_ent_per_head  := v_entrance.per_head;
        v_ent_senior    := v_entrance.senior_discount;
        v_ent_free_cnt  := v_entrance.free_applied;
        v_ent_free_save := v_entrance.free_savings;
    end if;

    -- Not an error, and deliberately not raised to the caller: a rate edited
    -- while a guest had the booking page open makes the browser's figure stale
    -- through nobody's fault, and refusing the booking over it would be worse
    -- than charging the correct amount. Tampering lands here too, which is why
    -- it is worth a line in the server log.
    if p_price is not null and round(p_price, 2) is distinct from v_price then
        raise log 'book_accommodation: client quoted price % for % (%, % night(s)); charging %',
            p_price, p_type_id, p_schedule_key, v_nights, v_price;
    end if;

    insert into public.bookings (
        code, type_id, unit_id, schedule_key,
        check_in_date, check_out_date,
        starts_at, ends_at,                       -- overwritten by the trigger
        guest_name, guest_email, guest_mobile,
        pax, kids, seniors, pwd,
        price,
        entrance_total, entrance_per_head, entrance_senior_discount,
        entrance_free_applied, entrance_free_savings,
        payment, receipt_url, status, owner_hash
    ) values (
        'CBL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
        p_type_id, v_unit, p_schedule_key,
        p_check_in, p_check_out,
        now(), now() + interval '1 hour',
        p_guest_name, p_guest_email, p_guest_mobile,
        p_pax, p_kids, p_seniors, coalesce(p_pwd, 0),
        v_price,
        v_ent_total, v_ent_per_head, v_ent_senior,
        v_ent_free_cnt, v_ent_free_save,
        -- A CASE result is untyped text, so it needs the explicit enum cast.
        (case when p_receipt_url is null then 'unpaid' else 'down-payment' end)::public.payment_status,
        p_receipt_url,
        'pending'::public.booking_status,
        public.booking_owner_hash(p_owner_token)
    )
    returning * into v_row;

    -- Credit a receipt supplied at creation, now that downpayment exists to
    -- stamp it with. Done as a second statement because the generated column
    -- is not readable until the row is in.
    if p_receipt_url is not null then
        update public.bookings
           set receipt_uploads = jsonb_build_array(jsonb_build_object(
                'path', p_receipt_url,
                'uploadedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                'amount', downpayment
           ))
         where id = v_row.id
        returning * into v_row;
    end if;

    -- The caller gets its own booking back, but not the key that proves
    -- ownership of it — that only ever travels in the other direction. The
    -- receipt path is masked to match my_bookings(), so the row the guest holds
    -- now and the row they get after a refresh are the same row.
    v_row.owner_hash      := null;
    v_row.receipt_url     := case when v_row.receipt_url is null then null else 'pending-upload' end;
    v_row.receipt_uploads := public.masked_receipt_uploads(v_row.receipt_uploads);
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
