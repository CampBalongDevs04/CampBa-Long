-- ============================================================================
--  Camp Ba-long — book_stay() is the only door in
-- ----------------------------------------------------------------------------
--  THE HOLE THIS CLOSES
--  --------------------
--  20260801120000_booking_hold_queue.sql put the queue gate in book_stay(), a
--  wrapper around book_accommodation(), and closed by saying that anon's
--  execute on the inner function should be revoked "once you have confirmed the
--  live argument list". That was never done, and every migration since has
--  re-granted it — most recently 20260806140000_pwd_count.sql:196.
--
--  So the gate was decorative. Calling book_accommodation() straight from the
--  browser skipped the whole of book_stay(): the hold_conflict() check, the
--  count of guests ahead in booking_queue, and the 'held'/'queued' answers that
--  send a waiting guest to the back of the line instead of past it.
--
--  This is line-jumping, not overbooking. The GiST exclusion constraint does not
--  care who asked, so two guests could never both hold one unit for overlapping
--  hours. What it cost was fairness: a guest who queued politely could be
--  stepped in front of by anyone willing to send one HTTP request.
--
--  WHY `from public` IS ON THIS STATEMENT
--  --------------------------------------
--  Postgres grants EXECUTE on every new function to the pseudo-role PUBLIC by
--  default, and `anon` inherits it. Revoking from `anon, authenticated` alone —
--  which is what the note in booking_hold_queue.sql suggested — would have left
--  that default in place and the door open, while looking closed in the diff.
--
--  Safe to do: book_stay() and book_stay_group() are SECURITY DEFINER and call
--  book_accommodation() as its owner, which is unaffected by any of this. No
--  frontend code calls it directly (src/data/accommodationDB.js reaches for
--  book_stay / book_stay_group only; the rest are comments).
--
--  ============================  READ THIS BEFORE  ============================
--  ==      TOUCHING book_accommodation() IN A FUTURE MIGRATION              ==
--  ===========================================================================
--  DO NOT re-grant execute on it to anon, authenticated or public. Ever.
--
--  This regressed once already and it will regress the same way again: when the
--  argument list changes, the function cannot be patched with CREATE OR REPLACE
--  (a different signature is a different function), so it gets DROPPED and
--  recreated — and a freshly created function comes back with the default
--  PUBLIC grant and none of the revokes below. Any migration that drops and
--  recreates book_accommodation() must repeat this revoke at the end of it.
--
--  CREATE OR REPLACE, which is what 20260813120000_server_side_pricing.sql and
--  20260813130000_verify_receipt_objects.sql use, preserves privileges and is
--  therefore safe. It is the DROP that resets them.
--
--  To check who can call it:
--      select proacl from pg_proc
--       where proname = 'book_accommodation'
--         and pronamespace = 'public'::regnamespace;
--  Neither =X/postgres for anon nor a bare "=X/" entry (that one is PUBLIC)
--  should appear.
--
--  To drop:
--      grant execute on function public.book_accommodation(
--          text, text, date, date, text, text, text, integer, integer, integer,
--          numeric, numeric, text, numeric, numeric, integer, numeric, text, integer
--      ) to anon, authenticated;
-- ============================================================================

revoke execute on function public.book_accommodation(
    text, text, date, date, text, text, text, integer, integer, integer,
    numeric, numeric, text, numeric, numeric, integer, numeric, text, integer
) from public, anon, authenticated;

comment on function public.book_accommodation(
    text, text, date, date, text, text, text, integer, integer, integer,
    numeric, numeric, text, numeric, numeric, integer, numeric, text, integer
) is
    'INTERNAL. Called only by book_stay() and book_stay_group(), both SECURITY '
    'DEFINER. anon and authenticated deliberately have no EXECUTE: calling this '
    'directly skips book_stay()''s hold-queue gate. Do not re-grant it — see '
    '20260813150000_revoke_direct_book_accommodation.sql.';


-- The five earlier grants (20260727062929:43, 20260727071322:104,
-- 20260727091500:437, 20260730160000:482, 20260730200000:576) all name argument
-- lists that no longer exist — 20260806140000_pwd_count.sql dropped and
-- recreated the function with p_pwd appended — so they are already dead and
-- there is nothing to revoke for them. Only pwd_count.sql:196 was still live,
-- and it is what the statement above undoes.
--
-- book_stay() and book_stay_group() keep their grants. They are the entry
-- points, and that is the whole point of this migration.
