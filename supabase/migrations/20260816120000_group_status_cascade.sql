-- ============================================================================
--  Camp Ba-long — a combined reservation's units follow their group's status
-- ----------------------------------------------------------------------------
--  THE PROBLEM
--  -----------
--  A member row of a combined reservation (`bookings.group_id` set) is born
--  'pending' and never leaves it. pay_booking_group() mirrors the receipt and
--  the payment onto every member — see the note in
--  20260804150000_accommodation_booking_groups.sql — but deliberately not the
--  status, and staff approve the `booking_groups` row, which touches nothing
--  under it. So `bookings.status` for a group's units says "unpaid hold" for
--  the whole life of the reservation, however thoroughly it has been paid.
--
--  That is wrong in two places:
--
--    1. The admin Units board reads a member row's own status to label the
--       unit, so every unit of a confirmed, even fully paid, group showed as
--       "Waiting for Payment" — the bug this migration was written for.
--
--    2. expire_stale_bookings() cancels any 'pending' row with no receipt once
--       its ten minutes are up. A group confirmed by staff BEFORE the guest
--       uploaded anything (paid over the counter, say) leaves its members
--       pending with receipt_url null — so the sweep could cancel a confirmed
--       reservation's units out from under it and put them back on the market.
--
--  THE APPROACH
--  ------------
--  The group row is authoritative for its members' status and payment, exactly
--  as it already is for their guest, dates and entrance fees. Make that true in
--  the data rather than only in the readers: a trigger mirrors the two columns
--  down whenever the group's copy changes, whoever wrote it — the admin app,
--  an RPC, or a hand-run statement in the SQL editor.
--
--  Additive and reversible; the columns and every function are untouched:
--
--      drop trigger if exists booking_groups_sync_members_trg on public.booking_groups;
--      drop function if exists public.booking_groups_sync_members();
-- ============================================================================


-- ================================================== cascade group → members

create or replace function public.booking_groups_sync_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Only the columns a unit shares with its reservation. cancel_reason rides
    -- along with a cancellation so a member row explains itself the same way
    -- the group does ('payment-timeout' vs. a staff cancel), which is what
    -- cancel_booking_group() and expire_stale_booking_groups() already write
    -- by hand — this makes the same thing happen from any other write path.
    update public.bookings
       set status        = new.status,
           payment       = new.payment,
           cancel_reason = case
               when new.status = 'cancelled'::public.booking_status
               then coalesce(new.cancel_reason, cancel_reason)
               else null
           end,
           updated_at    = now()
     where group_id = new.id
       and (status is distinct from new.status
            or payment is distinct from new.payment);

    return new;
end;
$$;

-- `when` keeps this off the hot path: a group is updated on every add-on and
-- every receipt, and only these two columns concern its members.
drop trigger if exists booking_groups_sync_members_trg on public.booking_groups;
create trigger booking_groups_sync_members_trg
    after update of status, payment on public.booking_groups
    for each row
    when (old.status is distinct from new.status or old.payment is distinct from new.payment)
    execute function public.booking_groups_sync_members();


-- ======================================================= existing rows
-- Every group written before the trigger existed. Members are only ever
-- created, paid and cancelled together with their group, so there is no member
-- row whose own status is the more truthful of the two — the group's copy wins
-- outright.

update public.bookings b
   set status        = g.status,
       payment       = g.payment,
       cancel_reason = case
           when g.status = 'cancelled'::public.booking_status
           then coalesce(g.cancel_reason, b.cancel_reason)
           else null
       end,
       updated_at    = now()
  from public.booking_groups g
 where b.group_id = g.id
   and (b.status is distinct from g.status or b.payment is distinct from g.payment);


comment on function public.booking_groups_sync_members() is
    'Mirrors booking_groups.status/payment onto the member bookings rows. The '
    'group row is authoritative for a combined reservation; a member row that '
    'kept its own ''pending'' was both mislabelled on the Units board and '
    'eligible for the expire_stale_bookings() sweep.';
