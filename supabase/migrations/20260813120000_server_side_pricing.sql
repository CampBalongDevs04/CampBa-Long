-- ============================================================================
--  Camp Ba-long — what a stay costs is the SERVER's answer, not the browser's
-- ----------------------------------------------------------------------------
--  THE HOLE THIS CLOSES
--  --------------------
--  book_accommodation() took `p_price` and the five `p_entrance_*` figures from
--  the caller and wrote them into the row verbatim. Nothing compared them to
--  accommodation_rates. The publishable key ships in the bundle by design, so
--  the whole attack was one request:
--
--      POST /rest/v1/rpc/book_stay   { ..., "p_price": 1 }
--
--  — a real reservation, holding a real unit, for ₱1. bookings.downpayment is
--  GENERATED from price + entrance_total + add-ons, so the amount owed scaled
--  down with it: ₱0.50 due on an A-House. Nothing in the system would have
--  noticed. Staff would have had to eyeball every booking against the rate card.
--
--  book_stay_group() had the same hole through a different door: it summed the
--  caller's own p_items[].price into booking_groups.unit_subtotal, which feeds
--  that table's own generated downpayment.
--
--  THE FIX
--  -------
--  Both functions now compute the money themselves, from the same two tables
--  the booking page quotes from:
--
--      unit price = effective_rate_price(type, schedule's rate_group) × nights
--      entrance   = entrance_breakdown(schedule's entrance_fee, party) × nights
--
--  THE CLIENT'S FIGURES ARE STILL ACCEPTED AND NOW IGNORED
--  -------------------------------------------------------
--  p_price and p_entrance_* stay in the signature on purpose, and are read into
--  nothing. Dropping them would have been cleaner, but this is a single-page app
--  behind a CDN: the moment this migration lands, every browser tab still
--  holding the previous bundle would start sending arguments the function no
--  longer has, and PostgREST answers that with PGRST202 — every booking failing
--  until the guest hard-reloads. Ignoring the values is exactly as safe and
--  breaks nobody. A follow-up migration can drop the parameters once the old
--  bundle has drained out of circulation.
--
--  A disagreement between what the browser quoted and what the server computed
--  is written to the Postgres log (raise log, invisible to the caller) rather
--  than raised: a stale rate card in a long-open tab is not an attack, and a
--  guest should not have their booking refused over it. The server's number is
--  simply the one that is charged.
--
--  TWO THINGS THAT HAD TO BE MOVED INTO THE DATABASE FIRST
--  -------------------------------------------------------
--  The server could not price a stay without them:
--
--    1. tent-pitching had NO accommodation_rates row at all. Its ₱500 lived
--       only in the frontend's FALLBACK_RATES (src/data/accomodationOptions.js),
--       a deliberate choice from back when it had no unit ceiling — but
--       *_shared_tent_pool.sql gave it one, and pricing it here needs a rate.
--       Seeded below at the same ₱500, which also makes it editable from the
--       dashboard like every other rate instead of needing a redeploy.
--
--    2. "Free entrance for 2 pax" does not apply to every unit — the rate card
--       excludes tent-pitching, cottage and pavilion, and that exclusion list
--       lived only in FREE_ENTRANCE_EXCLUDED_UNITS in the frontend. Without it
--       the server would hand two free heads to a pavilion booking that the
--       booking page charged for. Now a column on accommodation_types.
--
--  ON KEEPING THE ARITHMETIC IN TWO PLACES
--  ---------------------------------------
--  entrance_breakdown() below is a line-by-line transcription of
--  computeEntranceFee() in src/data/entranceFee.js followed by scaleEntrance()
--  in src/data/extendedStay.js. Two copies of one rule is a real cost, and it is
--  paid on purpose: the browser has to quote a figure before any row exists, and
--  the server cannot trust a figure the browser sends. The same trade is already
--  made for maintenance days (stay_touches_maintenance_day() is the SQL twin of
--  the JS function of the same name). Change one, change the other — the
--  verification steps in the commit message check that they agree.
--
--  To drop:
--      (recreate book_accommodation + book_stay_group from
--       20260806140000_pwd_count.sql, then)
--      drop function if exists public.entrance_breakdown(numeric, integer, integer, integer, boolean, integer);
--      drop function if exists public.effective_rate_price(text, text);
--      alter table public.accommodation_types drop column if exists free_entrance_eligible;
--      delete from public.accommodation_rates where type_id = 'tent-pitching';
-- ============================================================================


-- ================================================== the missing rate + column

-- ₱500 per tent, the same figure the frontend has been quoting from its
-- fallback table. min/max pax stay null: a guest pitching their own tent has no
-- unit capacity to fit inside, which getPaxFit() already treats as 'fit'.
insert into public.accommodation_rates (type_id, rate_group, price, pax_label, min_pax, max_pax)
values ('tent-pitching', 'overnight', 500, 'Any group size', null, null)
on conflict (type_id, rate_group) do nothing;


alter table public.accommodation_types
    add column if not exists free_entrance_eligible boolean not null default true;

comment on column public.accommodation_types.free_entrance_eligible is
    'Does the rate card''s "free entrance for 2 pax" inclusion apply to this '
    'unit? False for the units the card marks "not applicable". The frontend '
    'mirror is FREE_ENTRANCE_EXCLUDED_UNITS in src/data/accomodationOptions.js '
    '— the two lists must agree or the page will quote a fee the server does '
    'not charge.';

-- Matches FREE_ENTRANCE_EXCLUDED_UNITS. ('table' is in that set too, but it is
-- a food-service concept and has never been an accommodation type.)
update public.accommodation_types
   set free_entrance_eligible = false
 where id in ('tent-pitching', 'cottage', 'pavilion');


-- ======================================================= effective_rate_price
-- What a guest is actually charged for one unit, for one night, promo or not.
-- The SQL twin of effectiveRatePrice() in src/data/accommodationDB.js, and it
-- agrees with the same check constraint: a promo with no price on it is not
-- running, so the standing price stands.
--
-- Raises rather than returning null when the type has no rate for the group.
-- That pairing is not a missing price, it is a unit that is not offered under
-- that schedule at all — cottages are day-only, tents are overnight-only — and
-- the booking page does not even render a card for it.

create or replace function public.effective_rate_price(
    p_type_id    text,
    p_rate_group text
)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
    v_rate public.accommodation_rates;
begin
    select * into v_rate
    from public.accommodation_rates
    where type_id = p_type_id and rate_group = p_rate_group;

    if not found then
        raise exception using
            errcode = 'P0001',
            message = format('%s is not offered on that schedule.',
                             coalesce((select name from public.accommodation_types where id = p_type_id), p_type_id)),
            hint    = 'unavailable';
    end if;

    if v_rate.promo_active and v_rate.promo_price is not null then
        return v_rate.promo_price;
    end if;

    return v_rate.price;
end;
$$;

grant execute on function public.effective_rate_price(text, text) to anon, authenticated;


-- ======================================================== entrance_breakdown
-- The party's entrance fee for the WHOLE STAY, and the discounts that make it
-- up. A transcription of computeEntranceFee() (src/data/entranceFee.js) for one
-- night, followed by scaleEntrance() (src/data/extendedStay.js) across the
-- nights — see the header for why the arithmetic lives in two places.
--
-- `per_head` comes back as what one full-fare head owes FOR THE STAY (₱350 × 3
-- nights = ₱1,050), not per night. That is what keeps the stored breakdown
-- self-consistent: splitFreeEntrance() recovers the kids' saving by multiplying
-- the head COUNT by this figure, so it has to be the stay's rate.
--
-- `free_applied` is a head count and does NOT scale — 2 pax ride free, 1 kid is
-- exempt, however many nights they stay.

create or replace function public.entrance_breakdown(
    p_per_head       numeric,
    p_pax            integer,
    p_kids           integer default 0,
    p_seniors        integer default 0,
    p_free_eligible  boolean default true,
    p_nights         integer default 1
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
    -- THE SYSTEM NO LONGER APPLIES A SENIOR OR PWD DISCOUNT. The resort gives
    -- both at the front desk, against the ID the guest presents on arrival, so
    -- quoting a reduction here would promise one this system is not the one
    -- making — and would double it when the desk applies its own. The counts
    -- still travel end to end; only the arithmetic went away. These mirror
    -- SENIOR_DISCOUNT_RATE / PWD_DISCOUNT_RATE in src/data/entranceFee.js and
    -- are kept rather than deleted for the same reason: set one back to 0.2 and
    -- the discount resumes with no other edit.
    c_senior_rate constant numeric := 0;

    v_rate      numeric := coalesce(p_per_head, 0);
    v_nights    integer := greatest(coalesce(p_nights, 1), 1);
    v_pax       integer := greatest(coalesce(p_pax, 0), 0);
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

    -- Up to 2 non-kid heads ride free. Kids are already free on their own, so
    -- the quota is only ever handed to non-kid heads — that is what stops the
    -- perk stacking with the kids' exemption. Regular heads are freed before
    -- senior heads (the bigger saving), and a senior head that gets the perk is
    -- dropped from the paying senior count so it cannot also be discounted.
    v_perk     := case when coalesce(p_free_eligible, true)
                       then least(2, v_regular + v_seniors) else 0 end;
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

grant execute on function public.entrance_breakdown(numeric, integer, integer, integer, boolean, integer)
    to anon, authenticated;


-- ========================================================= book_accommodation
-- Body as 20260806140000_pwd_count.sql, with the money computed here instead of
-- taken from the caller. Signature unchanged, so book_stay()'s positional call
-- and the shipped frontend bundle both keep working untouched.

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


-- =========================================================== book_stay_group
-- Body as 20260806140000_pwd_count.sql, with the group's entrance recomputed
-- here and unit_subtotal summed from what book_accommodation() actually stored
-- rather than from the caller's p_items[].price. Signature unchanged.

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
    select bool_and(coalesce(t.free_entrance_eligible, true)) into v_eligible
    from jsonb_array_elements(p_items) as item(value)
    join public.accommodation_types t on t.id = item.value ->> 'type_id';

    select * into v_entrance from public.entrance_breakdown(
        v_schedule.entrance_fee, p_pax, p_kids, p_seniors,
        coalesce(v_eligible, true), v_nights);

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
