-- ============================================================================
--  Camp Ba-long — the words on /booking
-- ----------------------------------------------------------------------------
--  Every fixed string a guest reads on the reservation page was written into
--  src/pages/booking.jsx and its components: the hero, the four step headings,
--  the assurances under the title, the schedule and inclusion notes, and the
--  "Please read first before reserving" panel above the Reserve button. None of
--  it could be corrected without a redeploy, which is the same reason the home,
--  menu and spa pages were given a CMS before this one.
--
--  Built the same way as spa_reserve (20260808190000) and menu_order
--  (20260808160000), including the singleton-plus-lists split, for the same
--  reasons — see the header of the first for the full argument.
--
--  WHY FIVE TABLES
--  ---------------
--  booking_page is a SINGLETON: the title, the tagline and the seven one-off
--  labels around the page are each exactly one value.
--
--  The other four are LISTS, and each is a list of a different thing:
--
--    booking_trust_points — the assurances under the title. Staff add, retire
--                           and reorder them; each carries an icon.
--    booking_steps        — the four step headings. A FIXED list, unlike the
--                           others: every row is the caption on a block of the
--                           form that React renders, so there is nothing for a
--                           fifth row to caption and deleting the third would
--                           leave the guest-details fields with no heading.
--                           Hence no is_active and no insert/delete from the
--                           dashboard — only the wording is editable.
--    booking_policies     — the resort policy list. Genuinely open-ended.
--    booking_inclusions   — what a rate includes, per rate group, which is why
--                           this one is keyed by rate_group as well.
--
--  THE SCHEDULE NOTES ARE NOT HERE
--  -------------------------------
--  stay_schedules.note has existed since 20260727062826 and has never been
--  read by anything — the note a guest sees comes from the hardcoded mirror in
--  src/data/accommodationDB.js. Rather than store the same sentence twice, this
--  migration puts the column to work: the front end now reads it, staff edit it
--  in place, and the three rows are re-seeded below with EXACTLY the wording
--  that has been on screen. See the note there about the one string that
--  differs.
--
--  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
--  ------------------------------------------------
--  Every default below is, word for word, what the booking page had hardcoded.
--  Applying this changes nothing a visitor reads.
-- ============================================================================


-- ================================================================ booking_page

create table if not exists public.booking_page (
    id                    text primary key default 'booking'
        check (id = 'booking'),

    -- The hero, above the four steps.
    eyebrow               text,   -- 'Camp Ba-long Reservations'
    title                 text,   -- 'Complete Your Booking'
    tagline               text,   -- the paragraph under it

    -- Step 1's furniture. The heading over the schedule cards, then the two
    -- halves of the note below them: the label that starts the line, and what
    -- the line says while no schedule has been picked yet.
    schedule_title        text,   -- 'Select Stay Schedule'
    schedule_note_heading text,   -- 'Schedule note.'
    schedule_note_empty   text,   -- 'Select a stay schedule to see the check-in details.'
    inclusions_heading    text,   -- 'Inclusions.'

    -- Step 4's furniture. The warning over the policy list, the sentence beside
    -- the tick box, and the button that reserves the unit.
    policy_warning        text,   -- 'Please read first before reserving'
    agree_label           text,   -- 'I have read and agree to the terms and resort policy.'
    confirm_label         text,   -- 'Reserve & Proceed to Payment'

    updated_at            timestamptz not null default now()
);

comment on table public.booking_page is
    'Singleton row holding the one-off copy on /booking: the hero, the labels '
    'around the schedule note, and the wording of the reserve panel. Its lists '
    'are booking_trust_points, booking_steps, booking_policies and '
    'booking_inclusions. Public-readable, staff-writable.';
comment on column public.booking_page.schedule_note_empty is
    'What the schedule note says before a schedule has been picked. Once one '
    'is, the note comes from stay_schedules.note for that schedule.';

create or replace function public.booking_page_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists booking_page_touch_trg on public.booking_page;
create trigger booking_page_touch_trg
    before update on public.booking_page
    for each row execute function public.booking_page_touch();


-- ======================================================== booking_trust_points

create table if not exists public.booking_trust_points (
    id          text primary key,   -- 'held-before-paying'
    text        text not null,
    -- Which of the three line drawings booking.jsx can render: 'lock', 'check'
    -- or 'clock'. Not cms_icons: these are inline SVGs sized and stroked by
    -- booking.css for this one row of assurances, and the shared set is drawn
    -- for the circular badges elsewhere on the site. A row naming anything else
    -- simply gets no icon.
    icon        text not null default 'check',
    sort_order  integer not null default 0,
    is_active   boolean not null default true
);

comment on table public.booking_trust_points is
    'The assurances listed under the /booking title.';

create index if not exists booking_trust_points_order_idx
    on public.booking_trust_points (sort_order) where is_active;


-- =============================================================== booking_steps

create table if not exists public.booking_steps (
    -- The DOM id of the section it captions. Fixed: booking.jsx scrolls to
    -- these and points aria-labelledby at them, so they are structure rather
    -- than content.
    id          text primary key,   -- 'step-schedule'
    title       text not null,
    subtitle    text,
    sort_order  integer not null default 0
);

comment on table public.booking_steps is
    'The heading and one-line description over each of the four booking steps. '
    'A fixed list of four — each row captions a block of the form React renders, '
    'so the dashboard edits their wording and cannot add or remove rows.';

create index if not exists booking_steps_order_idx
    on public.booking_steps (sort_order);


-- ============================================================ booking_policies

create table if not exists public.booking_policies (
    id          text primary key,   -- 'arrive-on-time'
    policy      text not null,
    sort_order  integer not null default 0,
    is_active   boolean not null default true
);

comment on table public.booking_policies is
    'The resort policy list inside the "Please read first before reserving" '
    'panel above the Reserve button.';

create index if not exists booking_policies_order_idx
    on public.booking_policies (sort_order) where is_active;


-- ========================================================== booking_inclusions

create table if not exists public.booking_inclusions (
    id          text primary key,   -- 'day-free-entrance'
    -- 'day' | 'overnight' — the same grouping accommodation_rates uses, because
    -- it is the same question: what does this schedule's rate get you.
    rate_group  text not null,
    item        text not null,
    sort_order  integer not null default 0,
    is_active   boolean not null default true
);

comment on table public.booking_inclusions is
    'What each rate group includes, listed under the schedule note on /booking.';

create index if not exists booking_inclusions_group_idx
    on public.booking_inclusions (rate_group, sort_order) where is_active;


-- ===================================================================== seeding

insert into public.booking_page (
    id, eyebrow, title, tagline,
    schedule_title, schedule_note_heading, schedule_note_empty, inclusions_heading,
    policy_warning, agree_label, confirm_label
)
values (
    'booking',
    'Camp Ba-long Reservations',
    'Complete Your Booking',
    'Reserve your stay in four simple steps — your unit is held first, then you'
        || ' settle the down payment from My Bookings within 10 minutes. We confirm'
        || ' once the receipt is verified.',
    'Select Stay Schedule',
    'Schedule note.',
    'Select a stay schedule to see the check-in details.',
    'Inclusions.',
    'Please read first before reserving',
    'I have read and agree to the terms and resort policy.',
    'Reserve & Proceed to Payment'
)
on conflict (id) do nothing;

insert into public.booking_trust_points (id, text, icon, sort_order)
values
    ('held-before-paying', 'Your unit is reserved before you pay a peso — for 10 minutes', 'lock',  1),
    ('receipt-verified',   'Every receipt is personally verified',                          'check', 2),
    ('confirmed-in-24h',   'Confirmation sent within 24 hours',                             'clock', 3)
on conflict (id) do nothing;

insert into public.booking_steps (id, title, subtitle, sort_order)
values
    ('step-schedule', 'Dates & Schedule',
     'Pick your check-in date and stay schedule, then set how many nights you are'
        || ' staying. Every night is charged at the same rate.', 1),
    ('step-accommodation', 'Accommodation',
     'Select the unit that suits your group.', 2),
    ('step-guest', 'Guest Information',
     'Tell us who is booking so we can confirm your reservation.', 3),
    ('step-confirm', 'Review & Reserve',
     'Read our resort policy, then reserve your unit. You will have 10 minutes to'
        || ' upload your down-payment receipt before the hold is released.', 4)
on conflict (id) do nothing;

insert into public.booking_policies (id, policy, sort_order)
values
    ('arrive-on-time', 'Guests must arrive on time; late check-in may shorten your reserved hours.', 1),
    ('damage-charged',
     'No hidden charges for normal use, but damaged chairs, tables, linens, fixtures,'
        || ' or missing items will be charged after inspection.', 2),
    ('no-cancellation', 'Cancellation is no longer allowed once the down payment has been made.', 3)
on conflict (id) do nothing;

insert into public.booking_inclusions (id, rate_group, item, sort_order)
values
    ('day-entrance',   'day', 'Free entrance for 2 pax (not applicable for Cottage & Pavilion)', 1),
    ('day-parking',    'day', 'Free parking',                                                   2),
    ('day-jacuzzi',    'day', '3 hours free use of cold spring jacuzzi',                        3),
    ('day-griller',    'day', 'Free use of charcoal griller',                                   4),
    ('day-pools',      'day', 'Access to swimming pool, kiddie pool & running water',           5),
    ('day-bathrooms',  'day', 'Access to bathrooms and showers',                                6),

    ('overnight-entrance',  'overnight', 'Free entrance for 2 pax (not applicable for Tent Pitching)', 1),
    ('overnight-parking',   'overnight', 'Free parking',                                               2),
    ('overnight-jacuzzi',   'overnight', '3 hours free use of cold spring jacuzzi',                    3),
    ('overnight-griller',   'overnight', 'Free use of charcoal griller',                               4),
    ('overnight-pools',     'overnight', 'Access to swimming pool, kiddie pool & running water',       5),
    ('overnight-bathrooms', 'overnight', 'Access to bathrooms and showers',                            6),
    ('overnight-beddings',  'overnight', 'Beddings included (except tent pitching)',                   7)
on conflict (id) do nothing;


-- ======================================================== stay_schedules notes
--  The note column is about to be read for the first time, so it is brought
--  into line with what the page has actually been printing (the hardcoded
--  mirror in src/data/accommodationDB.js) — otherwise applying this migration
--  would silently reword all three notes, which is exactly what the rest of
--  this file is careful not to do.
--
--  KNOWN DISCREPANCY, DELIBERATELY PRESERVED
--  -----------------------------------------
--  night-day's note and its time_label disagree about the hours: the label here
--  says 8:00 PM - 6:00 PM, matching start_minutes/end_minutes (1200/1080), and
--  the wording below says 7:00 PM - 5:00 PM because that is what the hardcoded
--  mirror says and therefore what guests have been reading. Fixing that is a
--  decision about the resort's hours, not about the CMS, so it is left alone —
--  and staff can now correct the sentence from the dashboard either way.
--
--  Written as an update rather than an upsert: a resort that has already edited
--  a schedule's hours should not have its rows recreated, and one that never
--  ran the original seed has no schedules for the booking page to offer anyway.

update public.stay_schedules set note =
    'Check-in and check-out are set to 10:00 AM - 5:00 PM. To make the most of'
        || ' your stay, we recommend arriving on time.'
where key = 'day';

update public.stay_schedules set note =
    'Check-in and check-out are set to 10:00 AM - 8:00 AM. To make the most of'
        || ' your stay, we recommend arriving early.'
where key = 'day-night';

update public.stay_schedules set note =
    'Check-in and check-out are set to 7:00 PM - 5:00 PM. To make the most of'
        || ' your stay, we recommend arriving early.'
where key = 'night-day';


-- ========================================================================= RLS

alter table public.booking_page         enable row level security;
alter table public.booking_trust_points enable row level security;
alter table public.booking_steps        enable row level security;
alter table public.booking_policies     enable row level security;
alter table public.booking_inclusions   enable row level security;

drop policy if exists "booking page copy is public" on public.booking_page;
create policy "booking page copy is public" on public.booking_page
    for select to anon, authenticated using (true);

drop policy if exists "staff manage booking page copy" on public.booking_page;
create policy "staff manage booking page copy" on public.booking_page
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "booking trust points are public" on public.booking_trust_points;
create policy "booking trust points are public" on public.booking_trust_points
    for select to anon, authenticated using (true);

drop policy if exists "staff manage booking trust points" on public.booking_trust_points;
create policy "staff manage booking trust points" on public.booking_trust_points
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "booking steps are public" on public.booking_steps;
create policy "booking steps are public" on public.booking_steps
    for select to anon, authenticated using (true);

drop policy if exists "staff manage booking steps" on public.booking_steps;
create policy "staff manage booking steps" on public.booking_steps
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "booking policies are public" on public.booking_policies;
create policy "booking policies are public" on public.booking_policies
    for select to anon, authenticated using (true);

drop policy if exists "staff manage booking policies" on public.booking_policies;
create policy "staff manage booking policies" on public.booking_policies
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "booking inclusions are public" on public.booking_inclusions;
create policy "booking inclusions are public" on public.booking_inclusions
    for select to anon, authenticated using (true);

drop policy if exists "staff manage booking inclusions" on public.booking_inclusions;
create policy "staff manage booking inclusions" on public.booking_inclusions
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

-- stay_schedules has only ever had "catalog is public" (20260727062929). It
-- needs a writer now that its note is editable copy — narrowed to the staff
-- roster like every other catalog table (see 20260803140000_catalog_crud.sql).
drop policy if exists "staff manage stay schedules" on public.stay_schedules;
create policy "staff manage stay schedules" on public.stay_schedules
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ==================================================================== realtime

do $$
begin
    alter publication supabase_realtime add table public.booking_page;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.booking_trust_points;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.booking_steps;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.booking_policies;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.booking_inclusions;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.stay_schedules;
exception when duplicate_object then null;
end $$;
