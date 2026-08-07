-- ============================================================================
--  Camp Ba-long — the site footer, moved into the database
-- ----------------------------------------------------------------------------
--  The last thing on every page: the resort blurb, the two link lists, the
--  phone and email, and the Terms & Conditions and Copyright Policy that the
--  bottom bar opens. All of it was written into src/components/footer.jsx as
--  four consts.
--
--  It follows the eight sections before it (20260807120000 … 20260807235000):
--  a singleton row for the copy that exists once, and a table per list. With
--  this one the home page has no hardcoded copy left in it.
--
--  THE LEGAL TEXT IS THE POINT
--  ---------------------------
--  Everything else here is decoration. The Terms & Conditions and the Copyright
--  Policy are the two paragraphs on this site that state what a guest has
--  agreed to by booking — arrival windows, liability for damage, the
--  cancellation terms, who owns the photographs. They are exactly the sort of
--  thing a resort's lawyer or insurer asks to have reworded, and until now that
--  was a pull request. They are `text` with no length limit for the same
--  reason: a terms paragraph that grows into four is normal.
--
--  THE YEAR IS NOT IN HERE
--  -----------------------
--  The copyright line reads "© 2026 Camp Ba-long. All rights reserved." The
--  year is computed from the clock, because a year typed into a field is wrong
--  every January and nobody is watching for it. The name and the words after it
--  are stored; the number between them is not.
--
--  TWO LINK TABLES RATHER THAN ONE WITH A "KIND" COLUMN
--  ----------------------------------------------------
--  The menu links and the social links are the same shape — a label and an
--  address — but they live in different columns of the footer, they are
--  reordered independently, and one of them opens in a new tab while the other
--  does not. Two tables mean neither needs a filter to be correct, which is the
--  same arrangement `location_details` and `location_features` already have.
--
--  Seeded word for word with what the front end had hardcoded, so applying this
--  changes nothing a visitor reads.
-- ============================================================================


-- ============================================================= footer_section

create table if not exists public.footer_section (
    id               text primary key default 'home'
        check (id = 'home'),

    -- First column: the resort's name, its blurb, and the second heading and
    -- paragraph under them.
    resort_name      text,   -- "Camp Ba-long", reused in the copyright line
    about_text       text,
    updates_title    text,   -- "be Updated"
    updates_text     text,

    -- The headings over the second and third columns.
    links_title      text,   -- "Discover Camp Ba-long"
    touch_title      text,   -- "Get in Touch"

    -- The third column's two lines. Stored as typed: the footer builds the
    -- tel: and mailto: links from these, so what is typed here is what a phone
    -- dials.
    phone            text,
    email            text,

    -- The bottom bar. The year between the name and this is computed.
    copyright_suffix text,   -- "All rights reserved."

    -- The two panels the bottom bar opens. The label is both the button and
    -- the panel's heading, so they cannot drift apart.
    terms_label      text,
    terms_text       text,
    policy_label     text,
    policy_text      text,

    updated_at       timestamptz not null default now()
);

comment on table public.footer_section is
    'Singleton row holding the site footer''s copy, including the Terms & '
    'Conditions and Copyright Policy text. Public-readable, staff-writable.';
comment on column public.footer_section.phone is
    'Written as it should be dialled — the footer turns it into a tel: link. '
    'Also stated on the contact section and the location card, which are '
    'separate rows on purpose.';
comment on column public.footer_section.copyright_suffix is
    'What follows "© <year> <resort name>." The year comes from the clock.';
comment on column public.footer_section.terms_text is
    'The full Terms & Conditions. No length limit — this is the paragraph most '
    'likely to be rewritten by somebody outside the resort.';


-- =============================================================== footer_links
--  The middle column: "Main Wing", "Accommodations", "Contact US".

create table if not exists public.footer_links (
    id         text primary key,

    label      text not null,
    href       text not null,

    sort_order integer not null default 0,
    is_active  boolean not null default true
);

comment on table public.footer_links is
    'The menu links in the footer''s middle column.';
comment on column public.footer_links.href is
    'A path like "/" is routed inside the app; "/#contact" opens the home page '
    'and scrolls to that section; a full https:// address opens in a new tab.';


-- ============================================================= footer_socials
--  The row of social links under the phone and email. Always open in a new tab,
--  which is why they are not in footer_links.

create table if not exists public.footer_socials (
    id         text primary key,

    label      text not null,
    href       text not null,

    sort_order integer not null default 0,
    is_active  boolean not null default true
);

comment on table public.footer_socials is
    'The social links under the footer''s phone and email. Always open in a new '
    'tab, which is why they are separate from footer_links.';


-- =================================================================== seeding
--  Word for word what src/components/footer.jsx had hardcoded.

insert into public.footer_section (
    id,
    resort_name, about_text, updates_title, updates_text,
    links_title, touch_title,
    phone, email,
    copyright_suffix,
    terms_label, terms_text,
    policy_label, policy_text
)
values (
    'home',
    'Camp Ba-long',
    'Where you can connect with your inner peace! Immerse yourself in the healing waters, '
        || 'surrounded by lush tropical forest. The perfect place to unwind, rejuvenate your '
        || 'body, and calm your mind.',
    'be Updated',
    'Camp Ba-Long Nature Farm: A Refreshing Nature Escape Discover a hidden paradise where '
        || 'crystal-clear spring waters, lush tropical landscapes, and peaceful surroundings '
        || 'come together to create the perfect getaway. Camp Ba-Long Nature Farm invites you '
        || 'to relax, refresh, and reconnect with nature in an unforgettable outdoor '
        || 'experience.',
    'Discover Camp Ba-long',
    'Get in Touch',
    '09622331708',
    'campbalongnaturefarm@gmail.com',
    'All rights reserved.',
    'Terms & Conditions',
    'By booking or staying at Camp Ba-long, you agree to arrive within your reserved '
        || 'schedule, respect the property and fellow guests, and settle any damages caused '
        || 'during your stay. Reservations may be rescheduled or cancelled under the terms '
        || 'provided at the time of booking. Camp Ba-long reserves the right to refuse '
        || 'service to anyone who violates these terms.',
    'Copyright Policy',
    'All content on this site, including photos, text, and the Camp Ba-long name and logo, '
        || 'is owned by Camp Ba-long Nature Farm & Resort and may not be copied, reproduced, '
        || 'or distributed without written permission.'
)
on conflict (id) do nothing;

insert into public.footer_links (id, label, href, sort_order)
values
    ('main-wing',      'Main Wing',      '/',                1),
    ('camp-balong',    'Camp-Balong',    '/',                2),
    ('accommodations', 'Accommodations', '/#accommodations', 3),
    ('contact-us',     'Contact US',     '/#contact',        4)
on conflict (id) do nothing;

insert into public.footer_socials (id, label, href, sort_order)
values
    ('facebook',  'Facebook',  'https://facebook.com/campbalong',  1),
    ('instagram', 'Instagram', 'https://instagram.com/campbalong', 2)
on conflict (id) do nothing;


-- ======================================================================= RLS

alter table public.footer_section enable row level security;
alter table public.footer_links enable row level security;
alter table public.footer_socials enable row level security;

drop policy if exists "footer section is public" on public.footer_section;
create policy "footer section is public" on public.footer_section
    for select to anon, authenticated using (true);

drop policy if exists "staff manage footer section" on public.footer_section;
create policy "staff manage footer section" on public.footer_section
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "footer links are public" on public.footer_links;
create policy "footer links are public" on public.footer_links
    for select to anon, authenticated using (true);

drop policy if exists "staff manage footer links" on public.footer_links;
create policy "staff manage footer links" on public.footer_links
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "footer socials are public" on public.footer_socials;
create policy "footer socials are public" on public.footer_socials
    for select to anon, authenticated using (true);

drop policy if exists "staff manage footer socials" on public.footer_socials;
create policy "staff manage footer socials" on public.footer_socials
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ================================================================== realtime

do $$
begin
    alter publication supabase_realtime add table public.footer_section;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.footer_links;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.footer_socials;
exception when duplicate_object then null;
end $$;
