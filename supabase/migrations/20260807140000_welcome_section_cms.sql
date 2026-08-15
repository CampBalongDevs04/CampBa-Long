-- ============================================================================
--  Camp Ba-long — the "Welcome to Camp Ba-long" section, moved into the database
-- ----------------------------------------------------------------------------
--  The block under the hero — the welcome heading, the gold "A HIDDEN PARADISE
--  IN NATURE" line, the photo triptych with its numbered list beside it, and
--  the four-item green panel below — was written into
--  src/components/offers.jsx. Same problem the hero had: rewording the second
--  thing a visitor reads was a code change, a build and a redeploy.
--
--  This is that section, in three tables the dashboard's CMS section writes and
--  the home page reads. It follows the hero exactly
--  (20260807120000_home_hero_cms.sql): a singleton row for the copy that exists
--  once, and a table per list.
--
--  WHY THE TWO LISTS ARE SEPARATE TABLES
--  -------------------------------------
--  They look alike — an icon, a heading, a line of copy — but a HIGHLIGHT owns
--  a photograph in the collage and a TAG never does. One table with a "kind"
--  column would mean a photo column that is meaningless for half its rows, and
--  a constraint to enforce that. Two tables say it in the schema instead.
--
--  THREE PHOTOS, FOUR TAGS
--  -----------------------
--  Neither list is arbitrary-length by accident. The collage places its photos
--  at three fixed positions (.photo-1/2/3 in offers.css) because it is a
--  triptych, and the green panel is a four-column grid. Both are layout facts,
--  not data facts, so they are NOT constrained here — a fourth highlight is
--  perfectly valid data, its photo simply has nowhere to go in the collage. The
--  front end shows the first three photos and the dashboard says so on the
--  screen where somebody might add a fourth.
--
--  ICONS
--  -----
--  icon_key names an icon the site ships with. Some of those are React
--  components drawing inline SVG (the pool, the leaf-and-hill, the lotus), some
--  are .svg files — either way Vite decides their final form at build time, so
--  what SQL can hold is the name, not the artwork. src/components/CmsIcon.jsx
--  is the one place that turns a key into something on screen.
--
--  icon_url is an uploaded icon and wins over the key. That is how a tile added
--  from the dashboard gets an icon at all: there is no bundled asset waiting
--  for it. Both circles are dark, and the stylesheet renders whatever sits in
--  them in white, so an uploaded icon wants to be line art rather than a photo.
--
--  As with the hero, every image and icon column is NULL after this migration
--  and null means "use the bundled asset". Applying it changes nothing a
--  visitor sees; it only moves where the words come from.
-- ============================================================================


-- =========================================================== welcome_section

create table if not exists public.welcome_section (
    id          text primary key default 'home'
        check (id = 'home'),

    title       text,   -- "Welcome to Camp Ba-long"
    tagline     text,   -- the line directly under it
    message     text,   -- the gold line under the lotus divider
    description text,   -- the paragraph under that

    updated_at  timestamptz not null default now()
);

comment on table public.welcome_section is
    'Singleton row holding the home page welcome block''s headings and copy. '
    'Public-readable, staff-writable.';
comment on column public.welcome_section.message is
    'The gold line under the lotus divider. Stored with its bullets, because '
    'they are part of the wording staff type rather than a border CSS draws.';

create or replace function public.welcome_section_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists welcome_section_touch_trg on public.welcome_section;
create trigger welcome_section_touch_trg
    before update on public.welcome_section
    for each row execute function public.welcome_section_touch();


-- ======================================================== welcome_highlights
--  The photo triptych and the numbered list beside it. One row is both: the
--  photo in the collage and the entry next to it are the same thing said
--  twice, so splitting them would only create a way for them to disagree.

create table if not exists public.welcome_highlights (
    id          text primary key,               -- 'refreshing-pool'

    title       text not null,
    description text,

    -- Public URL of the collage photo. Null falls back to the one bundled
    -- with the front end, keyed by id in src/data/welcomeSection.js.
    image_url   text,

    -- What a screen reader reads in place of the photo. Editable because it
    -- describes the photo, and staff are the ones who change the photo.
    image_alt   text,

    icon_key    text,
    icon_url    text,

    sort_order  integer not null default 0,
    is_active   boolean not null default true
);

comment on table public.welcome_highlights is
    'The three photos of the home page welcome collage and the numbered list '
    'beside them. The collage has room for three; extra rows appear in the '
    'list only.';

create index if not exists welcome_highlights_order_idx
    on public.welcome_highlights (sort_order) where is_active;


-- ============================================================== welcome_tags
--  The four-item green panel under the collage. No photograph — an icon, a
--  heading and a two-or-three-word line.

create table if not exists public.welcome_tags (
    id          text primary key,               -- 'nature-inspired-escape'

    title       text not null,
    description text,

    icon_key    text,
    icon_url    text,

    sort_order  integer not null default 0,
    is_active   boolean not null default true
);

comment on table public.welcome_tags is
    'The green four-column panel under the home page welcome collage.';

create index if not exists welcome_tags_order_idx
    on public.welcome_tags (sort_order) where is_active;


-- =================================================================== seeding
--  Word for word what src/components/offers.jsx had hardcoded.

insert into public.welcome_section (id, title, tagline, message, description)
values (
    'home',
    'Welcome to Camp Ba-long',
    'Where you can connect with your inner peace!',
    '• A HIDDEN PARADISE IN NATURE •',
    'Immerse yourself in the healing waters , surrounded by lush tropical '
        || 'forest. The perfect place to unwind, rejuvenate your body, and calm '
        || 'your mind.'
)
on conflict (id) do nothing;

insert into public.welcome_highlights (id, title, description, image_alt, icon_key, sort_order)
values
    (
        'refreshing-pool',
        'Refreshing Pool',
        'Enjoy the cool, crystal-clear waters and peaceful atmosphere that make every visit refreshing and enjoyable.',
        'Refreshing pool at Camp Ba-long',
        'pool',
        1
    ),
    (
        'scenic-nature',
        'Scenic Nature',
        'Enjoy the fresh air, lush greenery, and soothing sounds of nature. A peaceful escape from the busy world.',
        'Scenic river surrounded by nature',
        'nature',
        2
    ),
    (
        'relaxing-ambiance',
        'Relaxing Ambiance',
        'Whether you''re here to soak, meditate, or simply relax, our hot springs offer the perfect balance of tranquility and nature.',
        'Relaxing forest ambiance',
        'relaxation',
        3
    )
on conflict (id) do nothing;

insert into public.welcome_tags (id, title, description, icon_key, sort_order)
values
    ('nature-inspired-escape', 'Nature-Inspired Escape', 'Relax and reconnect',   'leaf',   1),
    ('family-friendly',        'Family Friendly',        'Perfect for all ages',  'family', 2),
    ('scenic-serene',          'Scenic & Serene',        'Reconnect with nature', 'camera', 3),
    ('wellness-retreat',       'Wellness Retreat',       'Relax yourself',        'heart',  4)
on conflict (id) do nothing;


-- ======================================================================= RLS
--  The welcome block is the front page: read by visitors who are not signed
--  in, written by the staff roster only.

alter table public.welcome_section enable row level security;
alter table public.welcome_highlights enable row level security;
alter table public.welcome_tags enable row level security;

drop policy if exists "welcome section is public" on public.welcome_section;
create policy "welcome section is public" on public.welcome_section
    for select to anon, authenticated using (true);

drop policy if exists "staff manage welcome section" on public.welcome_section;
create policy "staff manage welcome section" on public.welcome_section
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "welcome highlights are public" on public.welcome_highlights;
create policy "welcome highlights are public" on public.welcome_highlights
    for select to anon, authenticated using (true);

drop policy if exists "staff manage welcome highlights" on public.welcome_highlights;
create policy "staff manage welcome highlights" on public.welcome_highlights
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "welcome tags are public" on public.welcome_tags;
create policy "welcome tags are public" on public.welcome_tags
    for select to anon, authenticated using (true);

drop policy if exists "staff manage welcome tags" on public.welcome_tags;
create policy "staff manage welcome tags" on public.welcome_tags
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ================================================================== realtime

do $$
begin
    alter publication supabase_realtime add table public.welcome_section;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.welcome_highlights;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.welcome_tags;
exception when duplicate_object then null;
end $$;


-- ============================================== SVG icons in catalog-images
--  The icons in this section are line art, and line art is an SVG — a format
--  the catalog bucket did not accept, because until now every upload it took
--  was a photograph of a dish or a unit.
--
--  Widening it is deliberately narrow: SVG is added to the allowed types, the
--  5 MB ceiling and every policy stay exactly as they were, and writes are
--  still the staff roster only. An SVG can carry script, which is why this
--  matters at all — but the bucket is served from the project's own storage
--  origin rather than the site's, the front end only ever renders these
--  through <img> (where scripts do not run), and nobody outside the roster can
--  put a file here in the first place.

update storage.buckets
    set allowed_mime_types = array[
        'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif',
        'image/svg+xml'
    ]
where id = 'catalog-images';
