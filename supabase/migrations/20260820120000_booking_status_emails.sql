-- ============================================================================
--  Camp Ba-long — optional per-message template overrides for booking emails
-- ----------------------------------------------------------------------------
--  Staff now email the guest when they act on a reservation: verified (with
--  the guest's receipt in the body) or rejected. Until then a guest who
--  uploaded a down-payment receipt heard nothing once it was reviewed — the
--  row flipped in the admin board and they only found out by reopening My
--  Bookings.
--
--  THOSE EMAILS DO NOT NEED THIS MIGRATION TO WORK.
--
--  EmailJS's free plan allows two templates, and both were already spent: the
--  enquiry to the admin inbox, and the guest-facing one. Rather than make the
--  feature cost a subscription, the guest-facing template became a content-
--  agnostic SHELL — a header, a slot, a footer — and the app sends it the
--  subject, the heading and the body. One template now carries all three
--  guest messages (contact acknowledgement, booking verified, booking
--  rejected). See docs/emailjs/guest-shell.html and src/lib/guestEmails.js.
--
--  So what are these two columns for?
--
--  OVERRIDES, for a paid plan. Fill one in and that message gets its own
--  EmailJS template instead of the shared shell — worth it if someone later
--  wants the confirmation to have a different design, or to be edited by
--  somebody who does not touch this repo. Leave them empty and the shell is
--  used, which is the ordinary case:
--
--    template_booking_confirmed  blank -> the guest shell (template_autoreply)
--    template_booking_rejected   blank -> the guest shell (template_autoreply)
--
--  Because blank is the NORMAL state, an empty column is silent. It is not a
--  misconfiguration and the admin board does not warn about it — warning about
--  the ordinary setup is how a dashboard teaches people to ignore its
--  warnings.
--
--  As before, none of this is secret. The EmailJS browser SDK runs in the
--  visitor's browser, so these IDs and the public key reach it either way;
--  what authorises a domain is EmailJS -> Account -> Security -> Allowed
--  origins. See the header of 20260801050155_email_settings.sql.
-- ============================================================================


alter table public.email_settings
    add column if not exists template_booking_confirmed text,
    add column if not exists template_booking_rejected  text;

comment on column public.email_settings.template_booking_confirmed is
    'OPTIONAL. template_… ID overriding the shared guest shell for the '
    '"booking verified" email. Blank (the normal case) uses template_autoreply.';
comment on column public.email_settings.template_booking_rejected is
    'OPTIONAL. template_… ID overriding the shared guest shell for the '
    '"booking rejected" email. Blank (the normal case) uses template_autoreply.';


-- Nothing to fill in on the free plan — leave both NULL and the two booking
-- emails go out through the guest shell already named in template_autoreply.
--
-- On a paid plan, to split one of them into its own EmailJS template:
--
--   update public.email_settings set
--       template_booking_confirmed = 'template_xxxxxxx'
--   where id = 'contact_form';
--
-- Deliberately not seeded here: this file is committed, and putting IDs back
-- in the repo would undo the move off .env the original migration made.


-- RLS needs nothing added: the policies on email_settings are table-wide
-- ("email settings are public" for select, "staff manage email settings" for
-- writes), so a new column is covered by both the moment it exists.
