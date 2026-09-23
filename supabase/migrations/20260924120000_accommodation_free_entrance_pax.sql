-- ============================================================================
--  Camp Ba-long — Free entrance pax, editable per accommodation
-- ----------------------------------------------------------------------------
--  THE RULE THAT CHANGED
--  ----------------------
--  How many guests enter free with an accommodation ("free entrance for 2
--  pax" on the rate card) used to be hardcoded in two places that had to
--  agree: `2` for an ordinary unit and `20` for Rent All Resort, matched by
--  NAME (see 20260815150000_rent_all_free_entrance_quota.sql), plus the
--  free_entrance_eligible flag for the units that get none at all. Changing
--  the number meant a migration and a redeploy.
--
--  It is now one column, accommodation_types.free_entrance_pax, edited from
--  the dashboard's Units → Manage tab next to the rest of the accommodation.
--  0 means the unit carries no free entrance — that single number replaces
--  both the eligibility flag and the Rent All name match.
--
--  The frontend reads the same column (freeEntrancePaxFor() in
--  src/data/accomodationOptions.js) to quote the booking page, and this
--  migration is what makes the server bill it: entrance_breakdown() already
--  takes the quota as p_free_quota, so only book_accommodation() and
--  book_stay_group() change — where the quota comes FROM.
--
--  BACKFILL
--  --------
--  Every existing row gets exactly the quota it was being charged under
--  yesterday, so nothing moves until staff edit a number:
--      free_entrance_eligible = false  →  0
--      name ilike '%rent all%'         →  20
--      everything else                 →  2
--
--  A CART WITH MORE THAN ONE ACCOMMODATION
--  ----------------------------------------
--  The perk is per BOOKING, not per unit — two Teepees still waive entrance
--  for 2 pax, not 4 — so a mixed cart takes the HIGHEST free_entrance_pax in
--  it. A unit with 0 simply never wins that max, so Teepee + Cottage keeps
--  the Teepee's free entrance.
--
--  That last part is a deliberate change to book_stay_group(). It used
--  bool_and(free_entrance_eligible): one excluded unit and the whole booking
--  lost the perk. The booking page has quoted the opposite since commit
--  443fa8c ("a cart only loses it when EVERY line is an excluded unit" — see
--  cartFreeEntranceEligible in src/pages/booking.jsx), so a Teepee + Cottage
--  guest was quoted free entrance and then billed without it. Taking the max
--  makes the server bill what the page quotes.
--
--  free_entrance_eligible IS NO LONGER READ
--  -----------------------------------------
--  Left in place rather than dropped, so this migration removes nothing, but
--  no function reads it after this. Its comment below says so.
--
--  Grants: book_accommodation() and book_stay_group() keep their exact
--  signatures, so CREATE OR REPLACE preserves every existing privilege —
--  including book_accommodation()'s execute being revoked from anon and
--  authenticated (20260813150000_revoke_direct_book_accommodation.sql).
--  Nothing is dropped, so nothing needs re-granting or re-revoking.
--
--  To drop:
--      (recreate book_accommodation and book_stay_group from
--       20260815150000_rent_all_free_entrance_quota.sql, then)
--      alter table public.accommodation_types drop column if exists free_entrance_pax;
-- ============================================================================


-- ============================================================ the column

alter table public.accommodation_types
    add column if not exists free_entrance_pax integer;

update public.accommodation_types
   set free_entrance_pax = case
           when not coalesce(free_entrance_eligible, true) then 0
           when name ilike '%rent all%' then 20
           else 2
       end
 where free_entrance_pax is null;

-- A unit added from the dashboard later starts on the rate card's standing
-- inclusion, same as free_entrance_eligible defaulted to true.
alter table public.accommodation_types
    alter column free_entrance_pax set default 2,
    alter column free_entrance_pax set not null;

alter table public.accommodation_types
    drop constraint if exists accommodation_types_free_entrance_pax_check;
alter table public.accommodation_types
    add constraint accommodation_types_free_entrance_pax_check
    check (free_entrance_pax >= 0);

comment on column public.accommodation_types.free_entrance_pax is
    'How many guests enter free with this accommodation (the rate card''s '
    '"free entrance for N pax"). 0 = no free entrance. Per booking, not per '
    'unit: a cart takes the highest value in it. Edited from Units → Manage; '
    'read by book_accommodation(), book_stay_group() and '
    'freeEntrancePaxFor() in src/data/accomodationOptions.js.';

comment on column public.accommodation_types.free_entrance_eligible is
    'SUPERSEDED by free_entrance_pax (0 = not eligible) in '
    '20260924120000_accommodation_free_entrance_pax.sql. No longer read by '
    'any function; kept only so that migration dropped nothing.';


-- ========================================================= book_accommodation
-- Body identical to 20260815150000_rent_all_free_entrance_quota.sql except
-- where the quota comes from — see "the money" below.

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
    -- How many guests this unit lets in free — accommodation_types
    -- .free_entrance_pax, 0 when it carries none. See this migration's header.
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

    -- Whatever staff set on the accommodation. A type with no row answers the
    -- column default (2), same as an unflagged type used to.
    select greatest(coalesce(free_entrance_pax, 2), 0)
      into v_quota
    from public.accommodation_types where id = p_type_id;
    v_quota := coalesce(v_quota, 2);

    -- No pax means no party ON THIS ROW: it is a group member, and the group
    -- row carries the party and the whole reservation's entrance. Leaving the
    -- five fields at their no-party values (null total, zeroes) is how such a
    -- row has always looked, so the admin list and the receipt read unchanged.
    if p_pax is not null then
        select * into v_entrance from public.entrance_breakdown(
            v_schedule.entrance_fee, p_pax, p_kids, p_seniors,
            v_quota > 0, v_nights, v_quota);

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
-- Body identical to 20260815150000_rent_all_free_entrance_quota.sql except
-- the quota: the highest free_entrance_pax in the cart, where it used to be
-- bool_and(free_entrance_eligible) plus the Rent All name match. See "A CART
-- WITH MORE THAN ONE ACCOMMODATION" in this migration's header.

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

    -- The highest free_entrance_pax among the cart's units — the same number
    -- the booking page quotes (cartFreeEntranceQuota() in
    -- src/data/accomodationOptions.js). A unit with 0 never wins the max, so
    -- it cannot take the perk away from the unit beside it.
    -- Aliased as item(value) rather than bare `item`: a set-returning function
    -- with one output column can be referenced either way, and spelling out the
    -- column is the reading that cannot be mistaken for a whole-row reference.
    select max(greatest(coalesce(t.free_entrance_pax, 2), 0))
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
