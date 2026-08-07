-- ============================================================================
--  Camp Ba-long — the Location section, moved into the database
-- ----------------------------------------------------------------------------
--  The sixth block of the home page: the heading, the contact card beside the
--  map — address, phone, email, admin hours — and the strip of four tiles under
--  it. All of it was written into src/components/location.jsx.
--
--  It follows the five sections before it (20260807120000 … 20260807200000): a
--  singleton row for the copy that exists once, and a table per list.
--
--  THE MAP IS NOT IN HERE, DELIBERATELY
--  ------------------------------------
--  The embedded Google map stays written into the component. It is not copy:
--  it is a URL carrying a place query, a latitude, a longitude and a zoom
--  level, and a character typed wrong in any of them fails silently — the frame
--  shows the wrong village, or nothing, and looks like the site is broken
--  rather than like a field that needs correcting. The resort has also not
--  moved since 2024 and is not going to, so this is a field that would earn its
--  risk once and then sit there.
--
--  The "Get Directions" BUTTON is here, because that is a different thing: a
--  label and a link, of the same kind the hero's two buttons already are, and
--  the sort of thing that really does change when the resort's Google listing
--  is rebuilt.
--
--  WHY THE CONTACT LINES ARE AN ARRAY
--  ----------------------------------
--  The address is three lines and the phone number is one. They are `text[]`
--  for the same reason the hero's headline is: where the text breaks is part of
--  how the card reads, not something CSS should be guessing at, and staff type
--  it one line per line. Three columns of line_1/line_2/line_3 would have made
--  "add a second number" a migration.
--
--  Seeded word for word with what the front end had hardcoded, so applying this
--  changes nothing a visitor reads.
-- ============================================================================


-- =========================================================== location_section

create table if not exists public.location_section (
    id               text primary key default 'home'
        check (id = 'home'),

    eyebrow          text,   -- "Our Location"
    title            text,   -- "We’d Love to See You"
    subtitle         text,

    -- The button at the bottom of the contact card. Empty label = no button,
    -- the same rule the hero's two buttons follow.
    directions_label text,
    directions_href  text,

    updated_at       timestamptz not null default now()
);

comment on table public.location_section is
    'Singleton row holding the home page location heading and its "Get '
    'Directions" button. The embedded map is NOT here — see the migration '
    'header. Public-readable, staff-writable.';
comment on column public.location_section.directions_label is
    'Empty removes the button rather than leaving a blank one on the card.';

create or replace function public.location_section_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists location_section_touch_trg on public.location_section;
create trigger location_section_touch_trg
    before update on public.location_section
    for each row execute function public.location_section_touch();


-- =========================================================== location_details
--  The rows of the contact card: an icon, a label, and one or more lines.

create table if not exists public.location_details (
    id         text primary key,               -- 'address'

    label      text not null,                  -- "Address"
    lines      text[] not null default '{}',   -- one entry per line on the card

    icon_key   text,
    icon_url   text,

    sort_order integer not null default 0,
    is_active  boolean not null default true
);

comment on table public.location_details is
    'The address / phone / email / hours rows of the home page contact card.';
comment on column public.location_details.lines is
    'One entry per line, in order. The card prints each as its own paragraph, '
    'so a three-line address stays three lines.';

comment on column public.location_details.icon_key is
    'Names an icon the site ships with — see src/data/cmsIcons.js. Null with '
    'no icon_url leaves the circle empty.';


-- ========================================================== location_features
--  The strip of four tiles under the card and the map.

create table if not exists public.location_features (
    id          text primary key,              -- 'easy-to-reach'

    title       text not null,
    description text,

    icon_key    text,
    icon_url    text,

    sort_order  integer not null default 0,
    is_active   boolean not null default true
);

comment on table public.location_features is
    'The tiles under the home page map — "Easy to Reach", "Parking Available" '
    'and so on. The strip is laid out four to a row.';


-- =================================================================== seeding
--  Word for word what src/components/location.jsx had hardcoded.

insert into public.location_section
    (id, eyebrow, title, subtitle, directions_label, directions_href)
values (
    'home',
    'Our Location',
    'We’d Love to See You',
    'Visit us at Camp Ba-long. We’re always happy to welcome you!',
    'Get Directions',
    'https://maps.app.goo.gl/69TemNpuTw41mkDo6'
)
on conflict (id) do nothing;

insert into public.location_details (id, label, lines, icon_key, sort_order)
values
    (
        'address',
        'Address',
        array['Brgy. Laguan', 'Liliw, Laguna', 'Philippines'],
        'address',
        1
    ),
    (
        'phone',
        'Phone',
        array['+63 9622 331 708'],
        'phone',
        2
    ),
    (
        'email',
        'Email',
        array['campbalongnaturefarm@gmail.com'],
        'email',
        3
    ),
    (
        'admin-hours',
        'Admin Hours',
        array['Monday(Resort maintenance) Tuesday – Sunday: 10:00 AM – 5:00 PM'],
        'admin',
        4
    )
on conflict (id) do nothing;

insert into public.location_features (id, title, description, icon_key, sort_order)
values
    ('easy-to-reach',     'Easy to Reach',      'Conveniently located with easy access by car.',   'car',     1),
    ('public-transit',    'Public Transit',     'Close to major jeepney JODA and Tricycle TODA.',  'transpo', 2),
    ('parking-available', 'Parking Available',  'Free parking available for all guests.',          'parking', 3),
    ('scenic-route',      'Scenic Route',       'A relaxing drive surrounded by nature.',          'route',   4)
on conflict (id) do nothing;


-- ======================================================================= RLS

alter table public.location_section enable row level security;
alter table public.location_details enable row level security;
alter table public.location_features enable row level security;

drop policy if exists "location section is public" on public.location_section;
create policy "location section is public" on public.location_section
    for select to anon, authenticated using (true);

drop policy if exists "staff manage location section" on public.location_section;
create policy "staff manage location section" on public.location_section
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "location details are public" on public.location_details;
create policy "location details are public" on public.location_details
    for select to anon, authenticated using (true);

drop policy if exists "staff manage location details" on public.location_details;
create policy "staff manage location details" on public.location_details
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "location features are public" on public.location_features;
create policy "location features are public" on public.location_features
    for select to anon, authenticated using (true);

drop policy if exists "staff manage location features" on public.location_features;
create policy "staff manage location features" on public.location_features
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ================================================================== realtime

do $$
begin
    alter publication supabase_realtime add table public.location_section;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.location_details;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.location_features;
exception when duplicate_object then null;
end $$;
