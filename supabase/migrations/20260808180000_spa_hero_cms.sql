-- ============================================================================
--  Camp Ba-long — the /spa page banner
-- ----------------------------------------------------------------------------
--  The first thing a visitor reads on the spa page: the headline, the line
--  under it, the button, and the blurred photo behind the lot.
--  src/pages/spaService.jsx had all of it hardcoded, so rewording the banner
--  was a code change and a redeploy.
--
--  Built as a near-copy of menu_hero (20260808140000) on purpose: this is the
--  same job — a page's own top banner — on a different page, and a staff
--  member who has edited one should not have to learn the other. The only
--  difference is that /spa's banner has no circular photo beside the copy, so
--  there is no image_url here, only the backdrop.
--
--  WHAT THIS TABLE IS NOT
--  ----------------------
--  The treatments and their prices are catalog data in public.spa_services,
--  edited in the dashboard's Spa SECTION. Nothing in this migration or the
--  three beside it touches that table. CMS owns the words and the decorative
--  photos on /spa; the Spa section owns what the resort sells.
--
--  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
--  ------------------------------------------------
--  Every default below is, word for word, what src/pages/spaService.jsx used
--  to have hardcoded. Applying this changes nothing a visitor reads.
--
--  THE BACKDROP
--  ------------
--  background_url is NULL until staff upload something, because the photo the
--  site ships with (assets/images/spa-hero-benner.png) is painted by
--  spaService.css and Vite hashes its filename at build time — a URL that
--  cannot be known from SQL. Null therefore means "whatever the stylesheet
--  already paints", and the front end only sets an inline background once
--  there is an uploaded one to set. Uploads go to the existing
--  `catalog-images` bucket, `spa` folder.
-- ============================================================================


-- ==================================================================== spa_hero

create table if not exists public.spa_hero (
    id              text primary key default 'spa'
        check (id = 'spa'),

    -- The headline, one array entry per rendered line — a layout choice
    -- ("Reserve Your Moment of / Relaxation."), not a paragraph. Same
    -- reasoning as home_hero.title_lines and menu_hero.title_lines: a
    -- textarea's invisible trailing whitespace should not be able to add an
    -- empty line to the page.
    title_lines     text[] not null default '{}',

    subtitle        text,

    -- The button's label, and where it goes. menu_hero shipped without a href
    -- and had one added a migration later (20260808150000) once it turned out
    -- staff wanted the button to reach /booking; this one has it from the
    -- start rather than repeating that.
    --
    -- '#how-to-reserve' scrolls to the panel further down this page, which is
    -- what the hardcoded button did. A leading '/' is routed inside the app,
    -- and a full https:// address opens in a new tab.
    button_label    text,
    button_href     text,

    -- Public URL of the blurred backdrop. Null = the photo the site shipped
    -- with, painted by the stylesheet.
    background_url  text,

    updated_at      timestamptz not null default now()
);

comment on table public.spa_hero is
    'Singleton row holding the /spa page banner: headline, subtitle, button '
    'and backdrop. The treatments themselves are spa_services, which this does '
    'not touch. Public-readable, staff-writable.';
comment on column public.spa_hero.title_lines is
    'The headline, one entry per rendered line.';
comment on column public.spa_hero.button_href is
    'Where the banner button goes. "#how-to-reserve" scrolls down this page, '
    'a leading "/" is an in-app route, https:// opens in a new tab.';
comment on column public.spa_hero.background_url is
    'Public URL of the blurred backdrop in the "catalog-images" bucket. Null '
    'leaves the photo the stylesheet paints in place.';

create or replace function public.spa_hero_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists spa_hero_touch_trg on public.spa_hero;
create trigger spa_hero_touch_trg
    before update on public.spa_hero
    for each row execute function public.spa_hero_touch();


-- ===================================================================== seeding
--  `on conflict do nothing` rather than an upsert, so re-running this file
--  cannot overwrite copy staff have since rewritten in the dashboard.

insert into public.spa_hero (id, title_lines, subtitle, button_label, button_href)
values (
    'spa',
    array['Reserve Your Moment of', 'Relaxation.'],
    'Book your next spa session and indulge in a world of tranquility and rejuvenation.',
    'Book Now',
    '#how-to-reserve'
)
on conflict (id) do nothing;


-- ========================================================================= RLS

alter table public.spa_hero enable row level security;

drop policy if exists "spa hero is public" on public.spa_hero;
create policy "spa hero is public" on public.spa_hero
    for select to anon, authenticated using (true);

drop policy if exists "staff manage spa hero" on public.spa_hero;
create policy "staff manage spa hero" on public.spa_hero
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ==================================================================== realtime

do $$
begin
    alter publication supabase_realtime add table public.spa_hero;
exception when duplicate_object then null;
end $$;
