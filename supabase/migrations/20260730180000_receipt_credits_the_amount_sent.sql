-- ============================================================================
--  Camp Ba-long — a receipt credits what was SENT, not the whole down payment
-- ----------------------------------------------------------------------------
--  THE BUG
--  -------
--  pay_my_booking() stamped every receipt with `downpayment` — the entire 50%
--  as it stood at that moment. That is correct for the FIRST receipt, and
--  wrong for every one after it, because a guest topping up is only ever asked
--  for the difference:
--
--      asked for  =  downpayment − what they have already sent
--      credited   =  downpayment                                   ← the bug
--
--  so the earlier payment gets counted a second time. Worked through:
--
--      book ₱10,000        down payment 5,000   pay → receipt 5,000    ✓ paid 5,000
--      order food ₱2,000   down payment 6,000   1,000 due
--      pay ₱1,000                               → receipt 6,000        ✗ credited 6,000
--                                                 credited total 11,000
--      order spa ₱4,000    down payment 8,000   → 8,000 − 11,000 < 0, shows ₱0 due
--
--  The guest sent ₱6,000, owes ₱8,000, and is told they owe nothing. Once the
--  credited total runs ahead of the down payment, every add-on ordered after it
--  is effectively free — and it is silent, because both the guest panel and the
--  admin board read the same over-credited figure.
--
--  THE FIX
--  -------
--  Stamp the receipt with the amount actually being asked for. The original
--  reason for reading `downpayment` at submission time still holds — an order
--  placed later must not turn a settled payment into a shortfall — and it is
--  preserved: the amount is still frozen at the moment of submission, it is
--  just the outstanding figure rather than the gross one.
--
--      credited = greatest(downpayment − already credited, 0)
--
--  With that, receipt amounts sum to what the guest actually sent, which is
--  what `paidSubmitted` in the app has always claimed they mean.
-- ============================================================================


-- ================================================== what has been paid so far

-- Sums the `amount` of every receipt in the list. Mirrors addon_total(): pure,
-- IMMUTABLE, and tolerant of a malformed entry rather than raising on one —
-- this is called from inside a write to a live booking, and one bad row from
-- the era before this migration must not make a booking unpayable.
create or replace function public.receipts_credited(p_uploads jsonb)
returns numeric
language sql
immutable
set search_path = public
as $$
    select coalesce(sum(
        case when jsonb_typeof(u -> 'amount') = 'number'
             then (u ->> 'amount')::numeric
             else 0
        end
    ), 0)
    from jsonb_array_elements(
        case when jsonb_typeof(p_uploads) = 'array' then p_uploads else '[]'::jsonb end
    ) as u;
$$;

revoke all on function public.receipts_credited(jsonb) from public, anon, authenticated;


-- ============================================ repair the rows already stored

-- Every stored amount is a snapshot of the down payment at its own submission
-- time, and those snapshots only ever go up — so what was actually sent for
-- receipt i is stored[i] − stored[i-1], and the first entry is already right.
-- That reconstruction is exact, not an estimate.
--
-- Single-receipt bookings are untouched: there is nothing to subtract, and
-- their one amount was never wrong.
with numbered as (
    select b.id,
           u.ordinality,
           u.value,
           case when jsonb_typeof(u.value -> 'amount') = 'number'
                then (u.value ->> 'amount')::numeric else 0 end as amount,
           coalesce(lag(
               case when jsonb_typeof(u.value -> 'amount') = 'number'
                    then (u.value ->> 'amount')::numeric else 0 end
           ) over (partition by b.id order by u.ordinality), 0) as previous
      from public.bookings b
      cross join lateral jsonb_array_elements(b.receipt_uploads)
           with ordinality as u(value, ordinality)
     where jsonb_typeof(b.receipt_uploads) = 'array'
       and jsonb_array_length(b.receipt_uploads) > 1
),
repaired as (
    select id,
           jsonb_agg(
               jsonb_set(value, '{amount}',
                         to_jsonb(round(greatest(amount - previous, 0), 2)))
               order by ordinality
           ) as uploads
      from numbered
     group by id
)
update public.bookings b
   set receipt_uploads = r.uploads
  from repaired r
 where r.id = b.id;


-- ============================================================ pay a booking
-- Unchanged except for the stamped amount; see the header. The rest of the
-- body is reproduced verbatim so this file reads as the current definition.
create or replace function public.pay_my_booking(
    p_booking_id   uuid,
    p_owner_token  text,
    p_receipt_path text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row  public.bookings := public.owned_booking(p_booking_id, p_owner_token);
    v_path text := nullif(btrim(p_receipt_path), '');
begin
    if v_path is null then
        raise exception 'Upload a screenshot of your payment first.' using errcode = 'P0001';
    end if;

    if v_row.status = 'cancelled' then
        raise exception 'That booking is cancelled.' using errcode = 'P0001';
    end if;

    update public.bookings
       set receipt_url = v_path,
           receipt_uploads = receipt_uploads || jsonb_build_array(jsonb_build_object(
               'path', v_path,
               'uploadedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
               -- What the guest was asked for at this moment: the down payment
               -- as it stands right now, less everything already credited.
               -- Frozen here, so an add-on ordered afterwards cannot turn a
               -- complete payment into a shortfall — and not gross, so a
               -- top-up cannot credit the earlier payment a second time.
               --
               -- Both column references read the OLD row, which is what makes
               -- this the outstanding figure rather than zero.
               'amount', greatest(
                   round(downpayment - public.receipts_credited(receipt_uploads), 2),
                   0
               )
           )),
           payment = 'down-payment'::public.payment_status,
           updated_at = now()
     where id = p_booking_id
    returning * into v_row;

    -- Same masking as my_bookings(): no ownership key, no path into the bucket.
    v_row.owner_hash      := null;
    v_row.receipt_url     := 'pending-upload';
    v_row.receipt_uploads := public.masked_receipt_uploads(v_row.receipt_uploads);
    return v_row;
end;
$$;

grant execute on function public.pay_my_booking(uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
