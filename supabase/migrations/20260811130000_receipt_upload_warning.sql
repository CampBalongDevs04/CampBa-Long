-- ============================================================================
--  Camp Ba-long — the warning beside the receipt upload button
-- ----------------------------------------------------------------------------
--  A guest uploading a screenshot is the one moment on the site where they can
--  cost the resort real time: a fake receipt, or a photo of something else
--  entirely, goes into the queue and a staff member has to open it, judge it
--  and chase the booking. The panel said what to send ("Send ₱1,500.") but
--  never what NOT to send, and never that sending the wrong thing has a
--  consequence.
--
--  This is its own column rather than more sentences on pay_note_text because
--  the two sit in different places and do different jobs: pay_note_text is the
--  instruction above the QR codes, and this is a caution against the file
--  picker, read with a thumb already on the button. Merging them would put the
--  warning where nobody is looking when they choose the file.
--
--  WHY A SEPARATE MIGRATION
--  ------------------------
--  20260811120000 created my_booking_page and may already have been applied.
--  `add column if not exists` is idempotent either way, so the two can be run
--  in either state and in order.
-- ============================================================================

alter table public.my_booking_page
    add column if not exists upload_warning text;

comment on column public.my_booking_page.upload_warning is
    'The caution printed against the receipt upload button. Blank takes it off '
    'the page — which is a decision about how much guests are trusted, not a '
    'formatting one.';

-- Only fills a column that has never been set. A resort that has already
-- reworded this must not have its wording reset by re-running the file.
update public.my_booking_page
   set upload_warning =
       'Please upload only your own proof of payment. A fake receipt, or any image'
       || ' that is not related to this payment, will have your booking rejected.'
 where id = 'mybooking'
   and upload_warning is null;
