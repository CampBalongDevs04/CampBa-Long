-- ============================================================================
--  Camp Ba-long — the food menu page's banner, moved into the database
-- ----------------------------------------------------------------------------
--  Everything a visitor sees at the top of /menu — the headline, the paragraph
--  under it, the Order Now button, the circular photo and the blurred backdrop
--  behind everything — was written into src/pages/foodmenu.jsx. This is that
--  banner, in one table the dashboard's CMS → Food Menu → Banner tab writes
--  and the menu page reads.
--
--  WHY ONE TABLE AND NOT A COLUMN ON home_hero
--  ---------------------------------------------
--  This is a SINGLETON like home_hero — there is exactly one /menu page — but
--  it is a different page with its own copy, its own photo and its own visitor
--  who may never see the home page at all. Folding it into home_hero would mean
--  every read of the home hero drags menu copy along with it, and a typo fixed
--  here would sit in the same row (and the same realtime channel) as the home
--  page's headline. Same reasoning as every other section: see the header of
--  supabase/migrations/20260807120000_home_hero_cms.sql.
--
--  IMAGES
--  ------
--  image_url (circle photo) and background_url (blurred backdrop) are both
--  NULL after this migration, and null means "use the bundled asset" — the
--  photo and background image imported in the front end and hashed into the
--  build by Vite. So applying this changes nothing a guest sees; it only moves
--  where the words and photos come from. Uploads go to the existing
--  `catalog-images` bucket under a `menu/` folder — the same bucket the food
--  and spa catalogs already use, just its own folder so a browse of the bucket
--  in the Supabase studio doesn't mix banner photos in with dish photos.
-- ============================================================================


-- ================================================================= menu_hero

create table if not exists public.menu_hero (
    id              text primary key default 'menu'
        check (id = 'menu'),

    -- The headline, one array entry per line — a layout choice ("Hungry? We've
    -- Got / You Covered."), not a paragraph. Same reasoning as
    -- home_hero.title_lines: a textarea's invisible trailing whitespace should
    -- not be able to add an empty line to the page.
    title_lines     text[] not null default '{}',

    subtitle        text,

    -- The Order Now button's label. Not a href: the button scrolls to the
    -- "How to Order" panel further down the same page rather than navigating
    -- anywhere, so there is no destination for staff to get wrong.
    button_label    text,

    -- Public URL of the circular photo. Null = the photo the site shipped with.
    image_url       text,

    -- Public URL of the blurred backdrop behind the whole banner. Null = the
    -- image the site shipped with.
    background_url  text,

    updated_at      timestamptz not null default now()
);

comment on table public.menu_hero is
    'Singleton row holding the /menu page banner: headline, subtitle, button '
    'label, circle photo and backdrop. Public-readable, staff-writable.';
comment on column public.menu_hero.title_lines is
    'The headline, one entry per rendered line.';
comment on column public.menu_hero.image_url is
    'Public URL of the circular photo in the "catalog-images" bucket. Null '
    'falls back to the photo bundled with the front end.';
comment on column public.menu_hero.background_url is
    'Public URL of the blurred backdrop in the "catalog-images" bucket. Null '
    'falls back to the image bundled with the front end.';

create or replace function public.menu_hero_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists menu_hero_touch_trg on public.menu_hero;
create trigger menu_hero_touch_trg
    before update on public.menu_hero
    for each row execute function public.menu_hero_touch();


-- =================================================================== seeding
--  Exactly the copy the front end had hardcoded, so applying this changes
--  nothing a visitor reads. `on conflict do nothing` is what keeps a re-run
--  from overwriting copy staff have since rewritten in the dashboard.

insert into public.menu_hero (id, title_lines, subtitle, button_label)
values (
    'menu',
    array['Hungry? We''ve Got', 'You Covered.'],
    'Explore our menu and discover dishes you''ll keep coming back for.',
    'Order Now'
)
on conflict (id) do nothing;


-- ======================================================================= RLS
--  Same boundary as the room catalog and the home hero: read by anyone,
--  written by the staff roster only.

alter table public.menu_hero enable row level security;

drop policy if exists "menu hero is public" on public.menu_hero;
create policy "menu hero is public" on public.menu_hero
    for select to anon, authenticated using (true);

drop policy if exists "staff manage menu hero" on public.menu_hero;
create policy "staff manage menu hero" on public.menu_hero
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ================================================================== realtime
--  So a headline corrected mid-morning reaches the visitors already sitting on
--  /menu, and so the dashboard's own preview follows a save without a refetch.

do $$
begin
    alter publication supabase_realtime add table public.menu_hero;
exception when duplicate_object then null;
end $$;
