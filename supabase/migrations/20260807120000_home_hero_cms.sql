-- ============================================================================
--  Camp Ba-long — the home page hero, moved into the database
-- ----------------------------------------------------------------------------
--  Everything a visitor sees before they scroll — the headline, the paragraph
--  under it, the two buttons, the circular photo, the background video and the
--  four-item strip along the bottom — was written into src/pages/home.jsx. So
--  "change the wording on the front page" was a code change, a build and a
--  redeploy, for the one piece of copy the resort most wants to reword.
--
--  This is that hero, in two tables the dashboard's CMS section writes and the
--  home page reads.
--
--  WHY TWO TABLES AND NOT ONE JSON BLOB
--  ------------------------------------
--  The hero itself is a SINGLETON — there is exactly one front page, so the
--  primary key is a fixed literal and the check constraint keeps a second row
--  from being inserted and silently shadowing the first. That is the same
--  arrangement email_settings and promo_marquee use.
--
--  The feature strip is a LIST: staff reorder it, hide one for a season and put
--  it back, and each item has its own icon, heading and line of copy. Rows give
--  that for free — sort_order is the order shown, is_active is how one comes
--  off the page without its wording being lost. A json array in a column would
--  have meant rewriting the whole strip to edit one tile.
--
--  IMAGES, VIDEO AND THE ASSETS THAT SHIPPED WITH THE SITE
--  -------------------------------------------------------
--  image_url / background_url / video_url are all NULL after this migration,
--  and null means "use the bundled asset" — the photo, poster and clip that are
--  imported in the front end and hashed into the build by Vite. So applying
--  this changes nothing a guest sees; it only moves where the words come from.
--  An upload from the dashboard fills the column in and wins from then on, the
--  same way an uploaded accommodation photo outranks its bundled one.
--
--  Photos go to the existing `catalog-images` bucket under a `hero/` folder.
--  The video cannot: that bucket caps uploads at 5 MB and allows image mime
--  types only, and a background clip is neither. It gets its own bucket below.
-- ============================================================================


-- ================================================================= home_hero

create table if not exists public.home_hero (
    id              text primary key default 'home'
        check (id = 'home'),

    -- The headline, one array entry per line. It is a LIST rather than one
    -- string with newlines in it because the line breaks are a layout choice
    -- ("Book Your / Perfect Resort"), and a textarea's invisible trailing
    -- whitespace should not be able to add an empty line to the front page.
    title_lines     text[] not null default '{}',

    -- The last line of the headline, printed in gold. Separate from the lines
    -- above because it is styled differently, not because it is worth less.
    accent_line     text,

    subtitle        text,

    -- The two buttons. A href starting with "/" is routed inside the app; one
    -- starting with "#" scrolls to a section; anything else opens as a link.
    primary_label   text,
    primary_href    text,
    secondary_label text,
    secondary_href  text,

    -- Public URL of the circular photo beside the headline. Null = the photo
    -- the site shipped with.
    image_url       text,

    -- The still behind everything. It is what a visitor sees while the video
    -- is still loading, and all they see if the video is switched off.
    background_url  text,

    -- The looping clip over that still. Null = the bundled one.
    video_url       text,

    -- Off leaves the background image alone on the page. Worth its own column
    -- rather than clearing video_url: a slow month for the resort's bandwidth
    -- should not mean losing the clip that was uploaded.
    show_video      boolean not null default true,

    updated_at      timestamptz not null default now()
);

comment on table public.home_hero is
    'Singleton row holding the home page hero: headline, subtitle, buttons, '
    'photo, background and video. Public-readable, staff-writable.';
comment on column public.home_hero.title_lines is
    'The headline, one entry per rendered line. The accent line is separate.';
comment on column public.home_hero.image_url is
    'Public URL of the circular hero photo in the "catalog-images" bucket. '
    'Null falls back to the photo bundled with the front end.';
comment on column public.home_hero.video_url is
    'Public URL of the background clip in the "site-media" bucket. Null falls '
    'back to the clip bundled with the front end.';
comment on column public.home_hero.show_video is
    'Off shows the background image alone and keeps the uploaded clip.';

create or replace function public.home_hero_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists home_hero_touch_trg on public.home_hero;
create trigger home_hero_touch_trg
    before update on public.home_hero
    for each row execute function public.home_hero_touch();


-- ======================================================== home_hero_features
--  The strip along the bottom of the hero: an icon, a heading and one line.

create table if not exists public.home_hero_features (
    id          text primary key,               -- 'comfortable-stays'

    title       text not null,
    description text,

    -- A bundled SVG named by key ('bed', 'water', 'dining'), resolved in
    -- src/data/homeHero.js — the same reasoning as the menu's image_key: Vite
    -- hashes the filename at build time, so the final URL is not knowable from
    -- SQL. A row with an unknown key still renders, it just has no icon.
    icon_key    text,

    -- An uploaded image, which wins over the key above. This is how a feature
    -- added from the dashboard gets an icon at all — there is no bundled asset
    -- waiting for it.
    icon_url    text,

    sort_order  integer not null default 0,
    is_active   boolean not null default true
);

comment on table public.home_hero_features is
    'The four-item strip across the bottom of the home page hero.';
comment on column public.home_hero_features.icon_key is
    'Bundled SVG key (bed, water, dining, cam, …) resolved by '
    'src/data/homeHero.js, not a URL. icon_url overrides it.';

create index if not exists home_hero_features_order_idx
    on public.home_hero_features (sort_order) where is_active;


-- =================================================================== seeding
--  Exactly the copy the front end had hardcoded, so applying this changes
--  nothing a visitor reads. `on conflict do nothing` and the `where` guard on
--  the update are what keep a re-run from overwriting copy staff have since
--  rewritten in the dashboard.

insert into public.home_hero (
    id,
    title_lines,
    accent_line,
    subtitle,
    primary_label,
    primary_href,
    secondary_label,
    secondary_href
) values (
    'home',
    array['Book Your', 'Perfect Resort'],
    'Getaway',
    'Escape the everyday with comfortable accommodations, relaxing amenities, '
        || 'delicious dining, and unforgettable experiences—all in one '
        || 'destination. Reserve your stay in just a few clicks.',
    'Book Now',
    '/booking',
    'Explore Rooms',
    '#accommodations'
)
on conflict (id) do nothing;

insert into public.home_hero_features (id, title, description, icon_key, sort_order)
values
    ('comfortable-stays',        'Comfortable Stays',         'Well-appointed rooms for a relaxing stay',      'bed',    1),
    ('relaxing-amenities',       'Relaxing Amenities',        'Pools, spa, and more for your comfort',         'water',  2),
    ('delicious-dining',         'Delicious Dining',          'A variety of cuisines to satisfy you',          'dining', 3),
    ('unforgettable-experiences','Unforgettable Experiences', 'Activities and moments you''ll cherish forever','cam',    4)
on conflict (id) do nothing;


-- ======================================================================= RLS
--  The hero is the front page: read by visitors who are not signed in, written
--  by the staff roster only. Same boundary as the room catalog and the menu.

alter table public.home_hero enable row level security;
alter table public.home_hero_features enable row level security;

drop policy if exists "home hero is public" on public.home_hero;
create policy "home hero is public" on public.home_hero
    for select to anon, authenticated using (true);

drop policy if exists "staff manage home hero" on public.home_hero;
create policy "staff manage home hero" on public.home_hero
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "home hero features are public" on public.home_hero_features;
create policy "home hero features are public" on public.home_hero_features
    for select to anon, authenticated using (true);

drop policy if exists "staff manage home hero features" on public.home_hero_features;
create policy "staff manage home hero features" on public.home_hero_features
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ================================================================== realtime
--  So a headline corrected mid-morning reaches the visitors already sitting on
--  the home page, and so the dashboard's own preview follows a save without a
--  refetch — the same arrangement the promo banner uses.

do $$
begin
    alter publication supabase_realtime add table public.home_hero;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.home_hero_features;
exception when duplicate_object then null;
end $$;


-- =========================================================== site-media
--  Where the hero's background clip goes.
--
--  Not `catalog-images`: that bucket exists for menu cards, so it caps uploads
--  at 5 MB and allows image mime types only. A background clip is an order of
--  magnitude larger and is not an image, and raising that bucket's ceiling to
--  fit one would raise it for every dish photo staff upload from a phone.
--
--  Public, for the same reason the catalog bucket is: this plays on the front
--  page for anonymous visitors, and a signed URL would expire while someone
--  left the tab open. Writes are the staff roster only.
--
--  The 60 MB ceiling is roughly four times the clip the site ships with, which
--  leaves room for a re-cut without leaving room for an unencoded camera file.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'site-media',
    'site-media',
    true,
    60 * 1024 * 1024,
    array['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
)
on conflict (id) do update
    set public = true,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anyone reads site media" on storage.objects;
create policy "anyone reads site media" on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'site-media');

drop policy if exists "staff upload site media" on storage.objects;
create policy "staff upload site media" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'site-media' and public.is_staff());

drop policy if exists "staff replace site media" on storage.objects;
create policy "staff replace site media" on storage.objects
    for update to authenticated
    using (bucket_id = 'site-media' and public.is_staff())
    with check (bucket_id = 'site-media' and public.is_staff());

drop policy if exists "staff delete site media" on storage.objects;
create policy "staff delete site media" on storage.objects
    for delete to authenticated
    using (bucket_id = 'site-media' and public.is_staff());
