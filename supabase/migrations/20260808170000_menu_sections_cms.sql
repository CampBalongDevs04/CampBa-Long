-- ============================================================================
--  Camp Ba-long — the heading and toggle button each /menu catalog section
--  prints, and the MENU section's banner photo
-- ----------------------------------------------------------------------------
--  MENU, COMBO MEAL, PRE-ORDER and COFFEE (with its "Bukal Cafe..." eyebrow
--  line) — the heading printed above each group of food_menu_items — plus the
--  small show/hide button under each heading ("Foods", "Meals", "Foods",
--  "Coffee Menu") and the blurred photo behind the MENU heading specifically
--  (the only one of the four with a banner photo of its own). Not the items
--  themselves — src/pages/foodmenu.jsx had all of this hardcoded in the JSX.
--
--  A separate table from menu_order and menu_hero for the same reason
--  home_hero and welcome_section are separate tables even though both are
--  home-page copy: this is a different job (heading/toggle text and one
--  banner photo, not a banner or a how-to panel) with its own edit buttons in
--  CMS → Food Menu, so fixing one heading cannot reach the How to Order panel
--  or the banner.
--
--  A SINGLETON, NOT COLUMNS ON food_menu_items
--  ---------------------------------------------
--  These headings label a whole CATEGORY, not any one row of the catalog —
--  the same reasoning accommodation_section holds the "Accommodations"
--  heading separately from the room catalog it introduces. There are exactly
--  four categories today and each needs exactly one heading and one toggle
--  label, so one row with one column per value is simpler than a second table
--  joined by category.
--
--  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
--  ------------------------------------------------
--  Every default below is, word for word, what src/pages/foodmenu.jsx used to
--  have hardcoded. Applying this changes nothing a visitor reads.
--
--  IMAGES
--  ------
--  menu_image_url is bundled at build time by Vite like every other photo in
--  this CMS, so it is NULL until staff upload something — see the header of
--  20260808140000_menu_hero_cms.sql for the full reasoning. Uploads go to the
--  existing `catalog-images` bucket, `menu` folder.
-- ============================================================================

create table if not exists public.menu_sections (
    id                    text primary key default 'menu'
        check (id = 'menu'),

    menu_title            text,   -- heading over the Foods row
    -- The blurred banner photo behind the MENU heading. Combo Meal, Pre-Order
    -- and Coffee don't have one of their own — they sit on the page
    -- background instead.
    menu_image_url        text,
    menu_toggle_label     text,   -- the show/hide button under the MENU banner

    combo_title           text,   -- heading over the Combo Meal row
    combo_toggle_label    text,   -- the show/hide button under it

    preorder_title        text,   -- heading over the Pre-Order row
    preorder_toggle_label text,   -- the show/hide button under it

    -- The small line above "COFFEE" naming the in-house cafe. The other three
    -- headings don't have one.
    coffee_eyebrow        text,
    coffee_title          text,   -- heading over the Coffee section
    coffee_toggle_label   text,   -- the show/hide button under it

    updated_at            timestamptz not null default now()
);

comment on table public.menu_sections is
    'Singleton row holding the heading, toggle-button label, and (for MENU '
    'only) banner photo each /menu catalog section prints — not the items '
    'under them, which are food_menu_items. Public-readable, staff-writable.';
comment on column public.menu_sections.menu_image_url is
    'Public URL of the blurred banner photo behind the MENU heading. Null '
    'falls back to the photo bundled with the front end.';

create or replace function public.menu_sections_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists menu_sections_touch_trg on public.menu_sections;
create trigger menu_sections_touch_trg
    before update on public.menu_sections
    for each row execute function public.menu_sections_touch();


-- =================================================================== seeding

insert into public.menu_sections (
    id,
    menu_title, menu_toggle_label,
    combo_title, combo_toggle_label,
    preorder_title, preorder_toggle_label,
    coffee_eyebrow, coffee_title, coffee_toggle_label
) values (
    'menu',
    'MENU', 'Foods',
    'COMBO MEAL', 'Meals',
    'PRE-ORDER', 'Foods',
    'Bukal Cafe by Camp Ba-Long Nature Farm', 'COFFEE', 'Coffee Menu'
)
on conflict (id) do nothing;


-- ======================================================================= RLS

alter table public.menu_sections enable row level security;

drop policy if exists "menu section titles are public" on public.menu_sections;
create policy "menu section titles are public" on public.menu_sections
    for select to anon, authenticated using (true);

drop policy if exists "staff manage menu section titles" on public.menu_sections;
create policy "staff manage menu section titles" on public.menu_sections
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ================================================================== realtime

do $$
begin
    alter publication supabase_realtime add table public.menu_sections;
exception when duplicate_object then null;
end $$;
