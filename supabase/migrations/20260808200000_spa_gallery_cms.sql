-- ============================================================================
--  Camp Ba-long — the "Relax. Refresh. Rejuvenate." strip on /spa
-- ----------------------------------------------------------------------------
--  The heading, the paragraph under it, and the six-photo mood gallery below
--  that. src/pages/spaService.jsx had the two strings hardcoded and the photos
--  as a `service` array of bundled imports — the file's own comment already
--  called that block "decoration authored here", which is exactly the thing
--  CMS is for.
--
--  These photos are DECORATION, not the treatment cards. The cards further
--  down come from public.spa_services and are edited in the dashboard's Spa
--  SECTION; this migration does not touch that table. A photo here sells the
--  mood of the place and can be swapped for a better one at any time without
--  anybody checking a price.
--
--  WHY ONE TABLE AND NOT TWO
--  -------------------------
--  spa_reserve splits its steps into their own table because a step carries
--  wording, an order and a "hide this one for now". A gallery photo carries
--  none of that — it is a URL and a position, and the position is the array
--  order. So `photos text[]` on the singleton, the same shape
--  accommodation_types.gallery already uses for the same reason
--  (20260803200000), and the same control edits it in the dashboard.
--
--  THE FALLBACK IS THE PHOTOS THE SITE SHIPPED WITH
--  --------------------------------------------------
--  photos is seeded EMPTY, not with six URLs. The six the site ships with
--  (assets/images/massage1..6.png) are bundled by Vite, which hashes their
--  filenames at build time — URLs that cannot be known from SQL. Empty
--  therefore means "the six the site shipped with", resolved in
--  data/spaGallery.js. Uploading even one photo replaces the whole strip,
--  which is the honest reading of "these are the photos now": a mixed set of
--  three uploads and three bundled leftovers is not something staff asked for
--  and could not be undone from the dashboard.
--
--  The two strings ARE seeded, word for word what the page used to have
--  hardcoded, so applying this changes nothing a visitor reads.
-- ============================================================================


-- ================================================================= spa_gallery

create table if not exists public.spa_gallery (
    id          text primary key default 'spa'
        check (id = 'spa'),

    heading     text,
    subtitle    text,

    -- Public URLs in the "catalog-images" bucket, in the order they are shown.
    -- Empty = the six the site shipped with.
    photos      text[] not null default '{}',

    updated_at  timestamptz not null default now()
);

comment on table public.spa_gallery is
    'Singleton row holding the /spa page''s "Relax. Refresh. Rejuvenate." '
    'heading and its decorative photo strip. Not the treatment cards, which '
    'are spa_services. Public-readable, staff-writable.';
comment on column public.spa_gallery.photos is
    'Decorative photos, in the order shown. Public URLs in the '
    '"catalog-images" bucket. Empty falls back to the six bundled with the '
    'front end.';

create or replace function public.spa_gallery_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists spa_gallery_touch_trg on public.spa_gallery;
create trigger spa_gallery_touch_trg
    before update on public.spa_gallery
    for each row execute function public.spa_gallery_touch();


-- ===================================================================== seeding

insert into public.spa_gallery (id, heading, subtitle)
values (
    'spa',
    'Relax. Refresh. Rejuvenate.',
    'Indulge in luxurious spa treatments designed to restore your body, calm your mind, and renew your spirit. Book your appointment in just a few clicks.'
)
on conflict (id) do nothing;


-- ========================================================================= RLS

alter table public.spa_gallery enable row level security;

drop policy if exists "spa gallery is public" on public.spa_gallery;
create policy "spa gallery is public" on public.spa_gallery
    for select to anon, authenticated using (true);

drop policy if exists "staff manage spa gallery" on public.spa_gallery;
create policy "staff manage spa gallery" on public.spa_gallery
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ==================================================================== realtime

do $$
begin
    alter publication supabase_realtime add table public.spa_gallery;
exception when duplicate_object then null;
end $$;
