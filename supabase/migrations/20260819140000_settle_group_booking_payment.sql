-- ============================================================================
--  Camp Ba-long — settle-at-checkout discounts, extended to combined
--  reservations (booking_groups)
-- ----------------------------------------------------------------------------
--  20260819120000_settle_booking_payment.sql deliberately scoped this to
--  single-unit `bookings` rows only, with group bookings kept on the plain
--  markBookingGroupPaidFull() flip as a "clean, separate follow-up" — this
--  migration is that follow-up. Same rate (senior 20%, PWD 20%, kids free),
--  same per-head verification, same reasoning for a dedicated RPC — see that
--  migration's header for all of it, not repeated here.
--
--  WHAT'S DIFFERENT FOR A GROUP
--  -------------------------------
--  A combined reservation's kids/seniors/pwd counts live ONLY on the
--  booking_groups row — never per member unit (book_stay_group() always
--  passes p_kids/p_seniors/p_pwd => 0 to book_accommodation() for a member
--  row; see 20260806140000_pwd_count.sql). So there's exactly one set of
--  counts to verify, on the group itself — simpler than the single-booking
--  case, not harder.
--
--  The one real difference: patchBookingGroup() (accommodationDB.js) has
--  always mirrored `status`/`payment` onto every member `bookings` row
--  alongside the group row — a member stuck at its old payment value while
--  the group reads paid-full is exactly the inconsistency
--  expire_stale_bookings() was written to never see (see
--  20260804150000_accommodation_booking_groups.sql's header). This RPC does
--  the same mirroring server-side, since it bypasses patchBookingGroup()'s
--  own JS update entirely.
-- ============================================================================

alter table public.booking_groups
    add column if not exists settlement_senior_verified integer not null default 0,
    add column if not exists settlement_pwd_verified     integer not null default 0,
    add column if not exists settlement_kids_verified    integer not null default 0,
    add column if not exists settlement_discount_total   numeric(10,2) not null default 0,
    add column if not exists settlement_amount_collected numeric(10,2),
    add column if not exists settled_at                  timestamptz,
    add column if not exists settled_by                  uuid references auth.users(id);

alter table public.booking_groups
    add constraint booking_groups_settlement_senior_verified_fit
        check (settlement_senior_verified between 0 and coalesce(seniors, 0)),
    add constraint booking_groups_settlement_pwd_verified_fit
        check (settlement_pwd_verified between 0 and coalesce(pwd, 0)),
    add constraint booking_groups_settlement_kids_verified_fit
        check (settlement_kids_verified between 0 and coalesce(kids, 0));

comment on column public.booking_groups.settlement_amount_collected is
    'The WHOLE reservation''s total once settled — unit_subtotal + '
    'entrance_total + add-ons, minus the settlement discount. Same meaning '
    'as bookings.settlement_amount_collected — see '
    '20260819130000_fix_settlement_collected_total.sql for why it is the '
    'whole total and not just the desk''s final balance. Null until '
    'settle_group_booking_payment() runs.';

create or replace function public.settle_group_booking_payment(
    p_group_id        uuid,
    p_senior_verified integer default 0,
    p_pwd_verified    integer default 0,
    p_kids_verified   integer default 0
)
returns public.booking_groups
language plpgsql
security definer
set search_path = public
as $$
declare
    c_senior_rate constant numeric := 0.20;
    c_pwd_rate    constant numeric := 0.20;
    c_kids_rate   constant numeric := 1.00;

    v_row        public.booking_groups;
    v_senior     integer;
    v_pwd        integer;
    v_kids       integer;
    v_discount   numeric;
    v_stay_total numeric;
    v_collected  numeric;
begin
    if not public.is_staff() then
        raise exception 'Only staff can settle a booking payment.' using errcode = '42501';
    end if;

    select * into v_row from public.booking_groups where id = p_group_id for update;
    if not found then
        raise exception 'Reservation not found.' using errcode = 'P0002';
    end if;

    v_senior := least(greatest(coalesce(p_senior_verified, 0), 0), coalesce(v_row.seniors, 0));
    v_pwd    := least(greatest(coalesce(p_pwd_verified, 0), 0), coalesce(v_row.pwd, 0));
    v_kids   := least(greatest(coalesce(p_kids_verified, 0), 0), coalesce(v_row.kids, 0));

    v_discount := round(
        coalesce(v_row.entrance_per_head, 0)
        * (v_senior * c_senior_rate + v_pwd * c_pwd_rate + v_kids * c_kids_rate)
    , 2);

    -- Same expression the `downpayment` generated column already uses (see
    -- 20260814120000_resort_addon_items.sql), against unit_subtotal instead
    -- of a single price.
    v_stay_total := coalesce(v_row.unit_subtotal, 0) + coalesce(v_row.entrance_total, 0)
        + public.addon_total(v_row.food_orders)
        + public.addon_total(v_row.spa_orders)
        + public.addon_total(v_row.item_orders);

    -- The WHOLE reservation's total, not just what the desk collects today —
    -- see 20260819130000_fix_settlement_collected_total.sql's header for why.
    v_collected := greatest(v_stay_total - v_discount, 0);

    update public.booking_groups set
        settlement_senior_verified  = v_senior,
        settlement_pwd_verified     = v_pwd,
        settlement_kids_verified    = v_kids,
        settlement_discount_total   = v_discount,
        settlement_amount_collected = v_collected,
        settled_at = now(),
        settled_by = auth.uid(),
        payment = 'paid-full'::public.payment_status,
        updated_at = now()
    where id = p_group_id
    returning * into v_row;

    -- Mirror onto every member unit — see this migration's header. Only
    -- `payment` and `updated_at`: status is untouched here exactly like
    -- markBookingGroupPaidFull()/patchBookingGroup() never touch it either.
    update public.bookings
       set payment = 'paid-full'::public.payment_status,
           updated_at = now()
     where group_id = p_group_id;

    return v_row;
end;
$$;

grant execute on function public.settle_group_booking_payment(uuid, integer, integer, integer) to authenticated;

notify pgrst, 'reload schema';
