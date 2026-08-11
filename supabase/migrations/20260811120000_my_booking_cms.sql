-- ============================================================================
--  Camp Ba-long — the words on /my-booking, and the QR codes a guest pays into
-- ----------------------------------------------------------------------------
--  /my-booking was the last page in the picker with "Not set up" on its card
--  (see admin/items/cmsPages.js). Everything a guest reads there was written
--  into src/pages/mybooking.jsx and its payment components — including the two
--  things staff most need to change without a developer:
--
--    • THE QR CODES. The GCash QR, the account name beside it and the mobile
--      number under it were an imported .jpg and two string literals in
--      src/pages/components/payment.jsx. A resort that changes its GCash number
--      — or adds a second one — could not do it from the dashboard at all.
--    • THE TWO NOTES. The green panel over the list that offers "Save Receipt",
--      and the gold "Send ₱X." line above the QR codes.
--
--  Built the same way as booking_page (20260810140000): one SINGLETON for the
--  copy that exists exactly once, plus a LIST for the thing there can be
--  several of. See that migration's header for the full argument.
--
--  WHY payment_methods IS ITS OWN TABLE AND NOT COLUMNS ON THE SINGLETON
--  ---------------------------------------------------------------------
--  There are two methods today (GCash and a bank transfer) and the page lays
--  them out in a grid, so a third is a row rather than a redesign. Columns
--  would have made "add another QR" a migration; a table makes it a button.
--
--  THE PLACEHOLDERS
--  ----------------
--  Four of the strings below are printed around figures only the browser knows
--  — the booking's own code, its down payment, the minutes left on the hold.
--  Those stay live: staff write {code}, {amount}, {minutes}, {unit}, {Unit} or
--  {unit-is} and data/myBookingPage.js fills them in (fillTokens there is the
--  only place that list is implemented). {unit-is} renders "unit is" for a
--  single booking and "units are" for a combined reservation, which is what
--  lets one sentence serve both.
--
--  CANCELLATION AFTER A RECEIPT
--  ----------------------------
--  The second half of this file closes a hole that has nothing to do with the
--  CMS: booking_policies has said "Cancellation is no longer allowed once the
--  down payment has been made" since 20260810140000, and nothing enforced it.
--  cancel_my_booking() and cancel_booking_group() would cancel a booking whose
--  receipt was already with staff — releasing the unit and leaving the resort
--  holding money against a stay that no longer exists. Both now refuse.
--
--  ONLY THE GUEST RPCs. Staff cancelling a paid booking — rejecting a fake
--  receipt, honouring a refund agreed by phone — is the case this rule exists
--  to route TO a human, so the dashboard writes `bookings` directly and is not
--  bound by it. That is a client-side routing decision as much as a SQL one:
--  cancelBooking() in src/data/accommodationDB.js takes an `asStaff` flag which
--  the dashboard passes and the guest page does not, because a booking made on
--  the machine somebody administers from would otherwise be sent down the
--  guest path and refused at exactly the moment staff needed it cancelled.
--
--  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
--  ------------------------------------------------
--  Every default below is, word for word, what My Bookings had hardcoded.
--  Applying this changes nothing a guest reads.
-- ============================================================================


-- ============================================================= my_booking_page

create table if not exists public.my_booking_page (
    id                 text primary key default 'mybooking'
        check (id = 'mybooking'),

    -- The hero, above the list of bookings.
    eyebrow            text,   -- 'Camp Ba-long Reservations'
    title              text,   -- 'My Bookings'
    tagline            text,   -- the one-line description under it
    privacy_note       text,   -- 'Only the bookings made on this device appear here…'

    -- The green panel that appears after a booking is made. Two versions of the
    -- same panel: `saved_*` when there is nothing to pay this minute, `hold_*`
    -- when the guest was sent here TO pay and the ten minutes are running.
    saved_title        text,   -- 'Booking {code} received'
    saved_text         text,
    hold_title         text,   -- '{Unit} held for booking {code}'
    hold_text          text,
    save_receipt_label text,   -- 'Save Receipt' — the button inside the panel

    -- The gold note above the QR codes, inside the payment panel.
    pay_note_heading   text,   -- 'Send {amount}.'
    pay_note_text      text,

    updated_at         timestamptz not null default now()
);

comment on table public.my_booking_page is
    'Singleton row holding the copy on /my-booking: the hero, the green '
    '"save your receipt" panel and the note above the QR codes. The QR codes '
    'themselves are payment_methods. Public-readable, staff-writable.';
comment on column public.my_booking_page.hold_text is
    'Printed while a unit is held and unpaid. Understands {amount}, {minutes}, '
    '{code}, {unit}, {Unit} and {unit-is} — see data/myBookingPage.js.';
comment on column public.my_booking_page.pay_note_heading is
    'The bold half of the note above the QR codes. {amount} is what is still '
    'outstanding on this booking right now, so it must not be typed as a fixed '
    'figure.';

create or replace function public.my_booking_page_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists my_booking_page_touch_trg on public.my_booking_page;
create trigger my_booking_page_touch_trg
    before update on public.my_booking_page
    for each row execute function public.my_booking_page_touch();


-- ============================================================ payment_methods

create table if not exists public.payment_methods (
    id              text primary key,   -- 'gcash'
    method          text not null,      -- 'GCash' — the card's heading
    account_name    text,               -- who the money reaches: 'IR**E B.'
    account_number  text,               -- '0919 033 ....'

    -- The QR image, from whichever of the two the row has. `qr_key` names an
    -- asset bundled with the build, which is what the GCash row shipped with;
    -- `qr_url` is an upload in the `catalog-images` bucket. A bundled asset
    -- wins, so uploading clears the key — the same rule, and the same reason,
    -- as food_menu_items.image_key (20260803180000_catalog_image_uploads.sql).
    qr_key          text,
    qr_url          text,

    sort_order      integer not null default 0,
    is_active       boolean not null default true
);

comment on table public.payment_methods is
    'The QR payment cards on /my-booking: one row per way to pay, each with the '
    'account name, the number and the QR image guests scan.';
comment on column public.payment_methods.qr_key is
    'Names a QR bundled with the build. Only "irene-gcash" exists — the code '
    'the site shipped with. Uploading a QR clears this so the upload wins.';
comment on column public.payment_methods.account_number is
    'Shown under the name, exactly as typed. Deliberately free text: the '
    'seeded GCash row is partly masked, and a bank row has no mobile number.';

create index if not exists payment_methods_order_idx
    on public.payment_methods (sort_order) where is_active;


-- ===================================================================== seeding

insert into public.my_booking_page (
    id, eyebrow, title, tagline, privacy_note,
    saved_title, saved_text, hold_title, hold_text, save_receipt_label,
    pay_note_heading, pay_note_text
)
values (
    'mybooking',
    'Camp Ba-long Reservations',
    'My Bookings',
    'Review your reservation history and manage upcoming stays.',
    'Only the bookings made on this device appear here. Open the site on another'
        || ' phone or browser and you will see that device''s bookings instead — your'
        || ' details are never shown to another guest.',

    'Booking {code} received',
    'Save a copy for check-in — it downloads as an image you can keep in your photos.',
    '{Unit} held for booking {code}',
    'Your {unit-is} reserved for the next {minutes} minutes. Send the {amount} down'
        || ' payment and upload the receipt below before the timer runs out, or the'
        || ' booking is cancelled and the {unit-is} released. Ordering food or a spa'
        || ' treatment first adds them to that amount.',
    'Save Receipt',

    'Send {amount}.',
    'Scan the QR of your preferred method, then upload the screenshot as proof.'
        || ' Your unit stays held while we verify it.'
)
on conflict (id) do nothing;

-- Exactly the two cards payment.jsx has been rendering, in the order it
-- rendered them. The bank row has no QR and no number on purpose — the page
-- has always drawn "QR code coming soon" in its frame, and that placeholder is
-- still what an empty qr_key/qr_url means.
insert into public.payment_methods (id, method, account_name, account_number, qr_key, sort_order)
values
    ('gcash',         'GCash',         'IR**E B.',         '0919 033 ....', 'irene-gcash', 1),
    ('bank-transfer', 'Bank Transfer', 'Gabriel Aramullo', null,            null,          2)
on conflict (id) do nothing;


-- ========================================================================= RLS

alter table public.my_booking_page enable row level security;
alter table public.payment_methods enable row level security;

drop policy if exists "my booking copy is public" on public.my_booking_page;
create policy "my booking copy is public" on public.my_booking_page
    for select to anon, authenticated using (true);

drop policy if exists "staff manage my booking copy" on public.my_booking_page;
create policy "staff manage my booking copy" on public.my_booking_page
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

-- Readable by anonymous guests because that is who pays: the QR cards render
-- before anyone signs in, and there is nothing private on the row — an account
-- name and a QR are published to be scanned.
drop policy if exists "payment methods are public" on public.payment_methods;
create policy "payment methods are public" on public.payment_methods
    for select to anon, authenticated using (true);

drop policy if exists "staff manage payment methods" on public.payment_methods;
create policy "staff manage payment methods" on public.payment_methods
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ==================================================================== realtime

do $$
begin
    alter publication supabase_realtime add table public.my_booking_page;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.payment_methods;
exception when duplicate_object then null;
end $$;


-- ============================================================================
--  No cancellation once a receipt has been sent
-- ----------------------------------------------------------------------------
--  Both functions are replaced whole (Postgres has no "add a check to an
--  existing function"), so what follows is cancel_my_booking() from
--  20260727091500_guest_booking_ownership.sql:201 and cancel_booking_group()
--  from 20260804150000_accommodation_booking_groups.sql:508, unchanged apart
--  from the new guard.
--
--  THE TEST IS receipt_url, NOT payment
--  ------------------------------------
--  `payment` only becomes 'down-payment' when pay_my_booking() succeeds, and
--  receipt_url is what that call sets — but receipt_url is also non-null on the
--  old marker-only rows that predate the receipts bucket, and on any row where
--  the upload landed and the status write did not. Keying off the receipt
--  catches every booking a guest has actually paid against, which is the rule
--  as guests read it: "I have sent my money, so this is now settled with a
--  person, not a button."
--
--  An already-cancelled booking still returns quietly, before the guard: a
--  booking cancelled by the payment-window sweep can carry a receipt that
--  arrived too late, and re-cancelling it must stay a no-op rather than start
--  raising an error at whoever clicks it.
-- ============================================================================

create or replace function public.cancel_my_booking(p_booking_id uuid, p_owner_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.bookings := public.owned_booking(p_booking_id, p_owner_token);
begin
    if v_row.status = 'cancelled' then
        return;                                  -- already done; not an error
    end if;

    if v_row.receipt_url is not null then
        raise exception
            'This booking has already been paid for, so it can no longer be cancelled here. Message the resort if you need to change it.'
            using errcode = 'P0001';
    end if;

    if v_row.ends_at < now() then
        raise exception 'That stay is already over and can no longer be cancelled.'
            using errcode = 'P0001';
    end if;

    update public.bookings
       set status = 'cancelled', updated_at = now()
     where id = p_booking_id;
end;
$$;

grant execute on function public.cancel_my_booking(uuid, text) to anon, authenticated;


create or replace function public.cancel_booking_group(p_group_id uuid, p_owner_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.booking_groups := public.owned_booking_group(p_group_id, p_owner_token);
begin
    if v_row.status = 'cancelled' then
        return;
    end if;

    if v_row.receipt_url is not null then
        raise exception
            'This reservation has already been paid for, so it can no longer be cancelled here. Message the resort if you need to change it.'
            using errcode = 'P0001';
    end if;

    if v_row.ends_at < now() then
        raise exception 'That stay is already over and can no longer be cancelled.'
            using errcode = 'P0001';
    end if;

    update public.bookings
       set status = 'cancelled', updated_at = now()
     where group_id = p_group_id
       and status <> 'cancelled';

    update public.booking_groups
       set status = 'cancelled', updated_at = now()
     where id = p_group_id;
end;
$$;

grant execute on function public.cancel_booking_group(uuid, text) to anon, authenticated;
