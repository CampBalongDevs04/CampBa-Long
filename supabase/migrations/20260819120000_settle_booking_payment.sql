-- ============================================================================
--  Camp Ba-long — settle-at-checkout discounts for "Mark Paid"
-- ----------------------------------------------------------------------------
--  THE GAP THIS CLOSES
--  --------------------
--  SENIOR_DISCOUNT_RATE / PWD_DISCOUNT_RATE / KIDS_DISCOUNT_RATE in
--  src/data/entranceFee.js (and their SQL twin, entrance_breakdown() in
--  20260817120000_kids_discount_claimed_at_resort.sql) are pinned at 0 ON
--  PURPOSE — the online quote is always the full rate, and the resort gives
--  each discount in person against an ID when the guest settles up. That part
--  is correct and UNCHANGED by this migration.
--
--  What was missing: staff's "Mark Paid" (markBookingPaidFull() in
--  src/data/accommodationDB.js) was a bare `payment = 'paid-full'` flip, with
--  no way to record that a discount was actually honored at the front desk.
--  Every screen that reads a paid-full booking — the admin's Proof of
--  Payment, the Excel export, the dashboard revenue stat — assumed the full
--  stored total was collected in cash, which stopped being true the moment a
--  senior/PWD/kids discount was actually given.
--
--  THE RATE USED HERE
--  -------------------
--  Senior 20%, PWD 20%, kids free (100%) — a SEPARATE rate from the online
--  quote's constants above. Off the entrance-fee per-head charge only
--  (entrance_per_head), never the unit rental price — the same scope
--  computeEntranceFee()/entrance_breakdown() already use for a discount.
--  Changing one of these two paths must never change the other.
--
--  WHY A NEW RPC RATHER THAN A PLAIN UPDATE
--  -------------------------------------------
--  Every other staff write in this app (confirmBooking, cancelBooking,
--  markBookingPaidFull, patchBookingGroup, …) is a bare `.update()` trusted
--  under the "staff manage bookings" RLS policy — there has never been a
--  staff-side RPC before this one. The reason for one here is not distrust of
--  staff (RLS already gives them full write access to this table); it's that
--  the discount math needs exactly one place to live, computed from the
--  booking's own stored entrance_per_head and party counts, the same way
--  entrance_breakdown() already is the one place the online quote's
--  arithmetic lives — instead of duplicating peso math in the browser and
--  trusting whatever total it sends.
--
--  GROUP BOOKINGS ARE OUT OF SCOPE HERE
--  ---------------------------------------
--  booking_groups keeps its plain markBookingGroupPaidFull() flip — a group's
--  kids/seniors/pwd counts live only on the group row, never per member (see
--  book_stay_group()), so a settle-with-discounts RPC for groups is a clean,
--  separate follow-up rather than something this migration needs to solve.
-- ============================================================================

alter table public.bookings
    add column if not exists settlement_senior_verified integer not null default 0,
    add column if not exists settlement_pwd_verified     integer not null default 0,
    add column if not exists settlement_kids_verified    integer not null default 0,
    add column if not exists settlement_discount_total   numeric(10,2) not null default 0,
    add column if not exists settlement_amount_collected numeric(10,2),
    add column if not exists settled_at                  timestamptz,
    add column if not exists settled_by                  uuid references auth.users(id);

alter table public.bookings
    add constraint bookings_settlement_senior_verified_fit
        check (settlement_senior_verified between 0 and coalesce(seniors, 0)),
    add constraint bookings_settlement_pwd_verified_fit
        check (settlement_pwd_verified between 0 and coalesce(pwd, 0)),
    add constraint bookings_settlement_kids_verified_fit
        check (settlement_kids_verified between 0 and coalesce(kids, 0));

comment on column public.bookings.settlement_senior_verified is
    'How many of this booking''s stored `seniors` actually presented ID at '
    'settlement — set once, by settle_booking_payment(). 0 until settled.';
comment on column public.bookings.settlement_discount_total is
    'Pesos actually knocked off at settlement (senior/PWD/kids combined). '
    'Independent of entrance_senior_discount, which is always 0 today — see '
    'this migration''s header.';
comment on column public.bookings.settlement_amount_collected is
    'What was actually collected on-site once the settlement discount and '
    'whatever was already paid online are both accounted for. Null until '
    'settle_booking_payment() runs; a booking marked paid the old way (or '
    'before this migration) has no figure here and screens fall back to the '
    'full stored total, same as they always assumed.';

-- Staff-only settlement: recomputes the real balance from the booking's own
-- stored counts and entrance_per_head, locks it in, and marks the booking
-- paid-full — replacing the plain flip markBookingPaidFull() used to do for
-- any booking with a senior, PWD or kids count on it.
create or replace function public.settle_booking_payment(
    p_booking_id      uuid,
    p_senior_verified integer default 0,
    p_pwd_verified    integer default 0,
    p_kids_verified   integer default 0
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
    -- SEPARATE from SENIOR_DISCOUNT_RATE / PWD_DISCOUNT_RATE /
    -- KIDS_DISCOUNT_RATE in entrance_breakdown() (both pinned at 0 by
    -- design) — those govern the ONLINE quote. This is what the front desk
    -- actually gives in person; see this migration's header.
    c_senior_rate constant numeric := 0.20;
    c_pwd_rate    constant numeric := 0.20;
    c_kids_rate   constant numeric := 1.00;

    v_row               public.bookings;
    v_senior            integer;
    v_pwd               integer;
    v_kids              integer;
    v_discount          numeric;
    v_stay_total        numeric;
    v_collected_online  numeric;
    v_collected         numeric;
begin
    if not public.is_staff() then
        raise exception 'Only staff can settle a booking payment.' using errcode = '42501';
    end if;

    select * into v_row from public.bookings where id = p_booking_id for update;
    if not found then
        raise exception 'Booking not found.' using errcode = 'P0002';
    end if;

    -- A group member's own counts are always 0/null (see book_stay_group()) —
    -- refuse rather than silently settle a discount that isn't there.
    if v_row.group_id is not null then
        raise exception 'Settle this from the group reservation, not the unit.' using errcode = 'P0001';
    end if;

    v_senior := least(greatest(coalesce(p_senior_verified, 0), 0), coalesce(v_row.seniors, 0));
    v_pwd    := least(greatest(coalesce(p_pwd_verified, 0), 0), coalesce(v_row.pwd, 0));
    v_kids   := least(greatest(coalesce(p_kids_verified, 0), 0), coalesce(v_row.kids, 0));

    v_discount := round(
        coalesce(v_row.entrance_per_head, 0)
        * (v_senior * c_senior_rate + v_pwd * c_pwd_rate + v_kids * c_kids_rate)
    , 2);

    -- Same expression the `downpayment` generated column already uses (see
    -- 20260814120000_resort_addon_items.sql) — one definition of "the whole
    -- stay costs this much", not a second copy that could drift from it.
    v_stay_total := coalesce(v_row.price, 0) + coalesce(v_row.entrance_total, 0)
        + public.addon_total(v_row.food_orders)
        + public.addon_total(v_row.spa_orders)
        + public.addon_total(v_row.item_orders);

    -- What has actually been credited online so far — the same figure
    -- receiptViewer.jsx's `paidSubmitted` sums client-side, read here so the
    -- two can never disagree. Guarded the same way public.addon_total() is,
    -- for the same reason: one malformed row from before validation existed
    -- must not make this function unable to run.
    select coalesce(sum(
        case when jsonb_typeof(u -> 'amount') = 'number' then (u ->> 'amount')::numeric else 0 end
    ), 0) into v_collected_online
    from jsonb_array_elements(
        case when jsonb_typeof(v_row.receipt_uploads) = 'array' then v_row.receipt_uploads else '[]'::jsonb end
    ) as u;

    v_collected := greatest(v_stay_total - v_collected_online - v_discount, 0);

    update public.bookings set
        settlement_senior_verified  = v_senior,
        settlement_pwd_verified     = v_pwd,
        settlement_kids_verified    = v_kids,
        settlement_discount_total   = v_discount,
        settlement_amount_collected = v_collected,
        settled_at = now(),
        settled_by = auth.uid(),
        payment = 'paid-full'::public.payment_status,
        updated_at = now()
    where id = p_booking_id
    returning * into v_row;

    return v_row;
end;
$$;

grant execute on function public.settle_booking_payment(uuid, integer, integer, integer) to authenticated;

notify pgrst, 'reload schema';
