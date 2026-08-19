-- ============================================================================
--  Camp Ba-long — fix settlement_amount_collected to be the WHOLE booking's
--  total, not just the balance collected at settlement
-- ----------------------------------------------------------------------------
--  THE BUG
--  --------
--  settle_booking_payment() (20260819120000_settle_booking_payment.sql)
--  stored settlement_amount_collected as
--      stay_total - collected_online - discount
--  i.e. only the SECOND payment (what the desk collects right now). Every
--  consumer that reads it — accumulateBookingStats()'s revenue stat,
--  bookingReport.js's collected()/summarise(), overview-list.jsx's
--  displayAmount — treats it the same way they already treat `stayTotal` for
--  an ordinary (non-discounted) paid-full booking: as the WHOLE booking's
--  total revenue. That mismatch is what made the dashboard's Revenue figure
--  drop the guest's ₱875 down payment the moment the booking was settled
--  with a discount, showing only the ₱695 collected at the desk instead of
--  the ₱1,570 actually received in total.
--
--  THE FIX
--  --------
--  Store the whole booking's total instead: stay_total - discount. The
--  online down payment and the desk's cash settlement always sum to exactly
--  this regardless of the split between them (collected_online cancels out:
--  collected_online + (stay_total - collected_online - discount) is always
--  stay_total - discount), so this is the one number every existing
--  consumer already expects when it reads "how much did a paid-full booking
--  collect".
--
--  settle_booking_payment()'s OWN callers (the admin modal) still compute
--  "what to physically ask for right now" themselves, client-side, from
--  stayTotal/alreadyCollected/discount — that was never stored and does not
--  change here.
-- ============================================================================

comment on column public.bookings.settlement_amount_collected is
    'The WHOLE booking''s total once settled — stay_total minus the '
    'settlement discount, regardless of how it split between the online '
    'down payment and the desk''s cash collection. Null until '
    'settle_booking_payment() runs; a booking marked paid the old way (or '
    'before this migration) has no figure here and screens fall back to the '
    'full stored total, same as they always assumed.';

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
    c_senior_rate constant numeric := 0.20;
    c_pwd_rate    constant numeric := 0.20;
    c_kids_rate   constant numeric := 1.00;

    v_row               public.bookings;
    v_senior            integer;
    v_pwd               integer;
    v_kids              integer;
    v_discount          numeric;
    v_stay_total        numeric;
    v_collected         numeric;
begin
    if not public.is_staff() then
        raise exception 'Only staff can settle a booking payment.' using errcode = '42501';
    end if;

    select * into v_row from public.bookings where id = p_booking_id for update;
    if not found then
        raise exception 'Booking not found.' using errcode = 'P0002';
    end if;

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

    v_stay_total := coalesce(v_row.price, 0) + coalesce(v_row.entrance_total, 0)
        + public.addon_total(v_row.food_orders)
        + public.addon_total(v_row.spa_orders)
        + public.addon_total(v_row.item_orders);

    -- The WHOLE booking's total, not just what the desk collects today — see
    -- this migration's header. collected_online is no longer read here at
    -- all: it cancels out of the arithmetic once the figure is the total
    -- rather than the remainder.
    v_collected := greatest(v_stay_total - v_discount, 0);

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

-- Correct any row already settled under the old, wrong formula: add back
-- what receipt_uploads shows was already collected online, the same figure
-- the buggy version subtracted out.
update public.bookings b
   set settlement_amount_collected = settlement_amount_collected + coalesce((
        select sum(
            case when jsonb_typeof(u -> 'amount') = 'number' then (u ->> 'amount')::numeric else 0 end
        )
        from jsonb_array_elements(
            case when jsonb_typeof(b.receipt_uploads) = 'array' then b.receipt_uploads else '[]'::jsonb end
        ) as u
   ), 0)
 where b.settled_at is not null
   and b.settlement_amount_collected is not null;

notify pgrst, 'reload schema';
