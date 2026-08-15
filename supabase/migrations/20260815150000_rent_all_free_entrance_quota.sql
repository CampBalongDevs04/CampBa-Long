-- ============================================================================
--  Camp Ba-long — Rent All Resort: 20 pax free entrance, not the whole party
-- ----------------------------------------------------------------------------
--  THE RULE THAT CHANGED
--  ----------------------
--  Renting the whole resort used to zero the entrance fee outright for
--  however many guests showed up — the frontend fed entrance_breakdown() a
--  per-head rate of 0 for the duration of a Rent All booking (scheduleForQuote
--  in src/pages/booking.jsx). The resort's actual rate card only waives
--  entrance for the first 20 pax; a bigger party still owes the schedule's
--  normal per-head rate on everyone past that — the same "free entrance"
--  mechanic an ordinary unit booking already has (2 pax, see
--  20260813120000_server_side_pricing.sql), just with a bigger quota because
--  it covers a whole-resort party instead of one unit's worth of guests.
--
--  The frontend now sends the real per-head rate for a Rent All booking
--  again, and passes computeEntranceFee()/computeStayQuote() a freeQuota of
--  RENT_ALL_FREE_ENTRANCE_PAX (20) instead of the standing 2 — see
--  src/data/entranceFee.js. This migration is what makes the server agree,
--  since entrance_breakdown() recomputes the charge itself and the server's
--  number is what actually gets billed (see the header of
--  20260813120000_server_side_pricing.sql for why: the browser's figure is
--  quoted, never trusted).
--
--  entrance_breakdown()'S NEW ARGUMENT
--  ------------------------------------
--  The quota was a hardcoded `2` inside the function. It is now a 7th
--  parameter, p_free_quota, defaulting to 2 so every existing call site that
--  doesn't pass it keeps behaving exactly as before.
--
--  A new default-having trailing argument is a DIFFERENT signature to
--  Postgres — CREATE OR REPLACE would not patch the existing 6-argument
--  function, it would create a second, 7-argument one alongside it, and the
--  two would then be ambiguous for any 6-argument call (both could satisfy
--  it, one via its own arguments, one via its trailing default). So the old
--  function is dropped and the new one created outright. That is safe to do
--  here specifically because entrance_breakdown() is a pure computation (no
--  table access, IMMUTABLE) with a plain anon/authenticated grant — nothing
--  like the sensitivity book_accommodation() has. Contrast
--  20260813150000_revoke_direct_book_accommodation.sql, which explicitly
--  forbids ever re-granting THAT function after a drop: that rule is about
--  book_accommodation() only, and does not apply here.
--
--  book_accommodation() and book_stay_group() keep their existing signatures
--  — only their bodies change, to work out which quota applies and pass it
--  through. CREATE OR REPLACE with an unchanged signature preserves every
--  existing privilege automatically (including book_accommodation()'s
--  execute being revoked from anon/authenticated), so neither function needs
--  a grant statement here.
--
--  HOW THE SERVER KNOWS A BOOKING IS "RENT ALL"
--  ------------------------------------------------
--  The same way the frontend does (isRentAllOption() in
--  src/data/accomodationOptions.js): by name, not by a dedicated id or
--  column. The Rent All card is just an accommodation_types row staff added
--  through the dashboard, and matching its name is what keeps this working
--  however staff renamed or re-slugged it — the same trade the frontend
--  already made, and the same reason accommodation_types has no free-entrance
--  quota column of its own for this.
--
--  To drop:
--      (recreate book_accommodation from
--       20260814140000_reject_elapsed_schedule_window.sql, book_stay_group
--       from 20260813120000_server_side_pricing.sql, then)
--      drop function if exists public.entrance_breakdown(numeric, integer, integer, integer, boolean, integer, integer);
--      create function public.entrance_breakdown(...) -- 6-argument version from 20260813120000_server_side_pricing.sql
-- ============================================================================


-- ======================================================== entrance_breakdown

drop function if exists public.entrance_breakdown(numeric, integer, integer, integer, boolean, integer);

create function public.entrance_breakdown(
    p_per_head       numeric,
    p_pax            integer,
    p_kids           integer default 0,
    p_seniors        integer default 0,
    p_free_eligible  boolean default true,
    p_nights         integer default 1,
    p_free_quota     integer default 2
)
returns table (
    per_head        numeric,
    total           numeric,
    senior_discount numeric,
    free_applied    integer,
    free_savings    numeric
)
language plpgsql
immutable
set search_path = public
as $$
declare
    -- THE SYSTEM NO LONGER APPLIES A SENIOR OR PWD DISCOUNT. See the comment
    -- on this constant in 20260813120000_server_side_pricing.sql.
    c_senior_rate constant numeric := 0;

    v_rate      numeric := coalesce(p_per_head, 0);
    v_nights    integer := greatest(coalesce(p_nights, 1), 1);
    v_pax       integer := greatest(coalesce(p_pax, 0), 0);
    v_quota     integer := greatest(coalesce(p_free_quota, 2), 0);
    v_seniors   integer;
    v_kids      integer;
    v_regular   integer;
    v_perk      integer;
    v_perk_reg  integer;
    v_paying_sr integer;

    v_pax_total    numeric;
    v_kids_free    numeric;
    v_perk_savings numeric;
    v_senior_disc  numeric;
    v_total        numeric;
begin
    -- Seniors and kids are both counted WITHIN the party, so neither can exceed
    -- it — clamped in case the counters are momentarily inconsistent.
    v_seniors := least(greatest(coalesce(p_seniors, 0), 0), v_pax);
    v_kids    := least(greatest(coalesce(p_kids, 0), 0), v_pax - v_seniors);
    v_regular := greatest(v_pax - v_seniors - v_kids, 0);

    -- Up to p_free_quota non-kid heads ride free (2 for an ordinary unit, 20
    -- for Rent All Resort — see p_free_quota at the call sites below). Kids
    -- are already free on their own, so the quota is only ever handed to
    -- non-kid heads — that is what stops the perk stacking with the kids'
    -- exemption. Regular heads are freed before senior heads (the bigger
    -- saving), and a senior head that gets the perk is dropped from the
    -- paying senior count so it cannot also be discounted.
    v_perk     := case when coalesce(p_free_eligible, true)
                       then least(v_quota, v_regular + v_seniors) else 0 end;
    v_perk_reg := least(v_perk, v_regular);
    v_paying_sr := v_seniors - (v_perk - v_perk_reg);

    -- Every head at the full rate, then everything that comes off it.
    v_pax_total    := v_pax * v_rate;
    v_kids_free    := v_kids * v_rate;
    v_perk_savings := v_perk * v_rate;
    v_senior_disc  := (v_paying_sr * v_rate) * c_senior_rate;
    v_total        := greatest(v_pax_total - v_kids_free - v_perk_savings - v_senior_disc, 0);

    return query select
        round(v_rate * v_nights, 2),
        round(v_total * v_nights, 2),
        round(v_senior_disc * v_nights, 2),
        v_kids + v_perk,                                   -- a head count: never scaled
        round((v_kids_free + v_perk_savings) * v_nights, 2);
end;
$$;

grant execute on function public.entrance_breakdown(numeric, integer, integer, integer, boolean, integer, integer)
    to anon, authenticated;


-- ========================================================= book_accommodation
-- Same signature as 20260814140000_reject_elapsed_schedule_window.sql, which
-- is the current live body (elapsed-schedule-window guard included) — NOT
-- 20260813120000_server_side_pricing.sql, which is older and missing that
-- guard. Only the money section changes here: the type's free-entrance quota
-- is looked up alongside its eligibility flag and handed to
-- entrance_breakdown() as the new 7th argument.

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
    -- 20 for the Rent All card, 2 for everything else — see "HOW THE SERVER
    -- KNOWS A BOOKING IS RENT ALL" in this migration's header.
    v_quota    integer;
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
    -- see 20260814140000_reject_elapsed_schedule_window.sql. Checked against
    -- the exact function the occupancy trigger uses, so the two can never
    -- disagree about when a stay ends.
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
    -- Everything below this line used to come from the caller. See the header
    -- of 20260813120000_server_side_pricing.sql.
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
    -- column default — the exclusions are the exception, not the rule. The
    -- Rent All card gets the bigger 20-pax quota; every other type keeps the
    -- standing 2-pax one.
    select coalesce(free_entrance_eligible, true),
           case when name ilike '%rent all%' then 20 else 2 end
      into v_eligible, v_quota
    from public.accommodation_types where id = p_type_id;

    -- No pax means no party ON THIS ROW: it is a group member, and the group
    -- row carries the party and the whole reservation's entrance. Leaving the
    -- five fields at their no-party values (null total, zeroes) is how such a
    -- row has always looked, so the admin list and the receipt read unchanged.
    if p_pax is not null then
        select * into v_entrance from public.entrance_breakdown(
            v_schedule.entrance_fee, p_pax, p_kids, p_seniors,
            coalesce(v_eligible, true), v_nights, coalesce(v_quota, 2));

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


-- =========================================================== book_stay_group
-- Same signature as 20260813120000_server_side_pricing.sql. The quota is
-- read alongside the eligibility flag, with the same bool_and-style "does
-- this apply to the whole cart" shape: max() rather than bool_and() because
-- a numeric quota does not have a natural AND, but in practice Rent All is
-- never mixed with another unit in the same cart (booking.jsx locks the cart
-- to just that one card while rentAllMode is on), so this only ever resolves
-- to 20 or 2, never something in between.

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
    v_eligible boolean;
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

    -- The perk applies to the reservation only if it applies to EVERY unit in
    -- it — one excluded unit in the cart and the whole booking loses it, which
    -- is what the booking page already quotes (see cartFreeEntranceEligible).
    -- Aliased as item(value) rather than bare `item`: a set-returning function
    -- with one output column can be referenced either way, and spelling out the
    -- column is the reading that cannot be mistaken for a whole-row reference.
    select bool_and(coalesce(t.free_entrance_eligible, true)),
           max(case when t.name ilike '%rent all%' then 20 else 2 end)
      into v_eligible, v_quota
    from jsonb_array_elements(p_items) as item(value)
    join public.accommodation_types t on t.id = item.value ->> 'type_id';

    select * into v_entrance from public.entrance_breakdown(
        v_schedule.entrance_fee, p_pax, p_kids, p_seniors,
        coalesce(v_eligible, true), v_nights, coalesce(v_quota, 2));

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
