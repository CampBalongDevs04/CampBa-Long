-- ============================================================================
--  Camp Ba-long — the "How to Order Food" panel on /menu
-- ----------------------------------------------------------------------------
--  menu_hero (20260808140000) covers the banner at the top of /menu. This
--  covers the panel further down that walks a guest through ordering — its
--  heading, its numbered steps, its note and its photo — src/pages/foodmenu.jsx
--  had all of it hardcoded (orderSteps, and the JSX around the panel).
--
--  A separate table from menu_hero for the same reason home_hero and
--  welcome_section are separate tables even though both are home-page copy:
--  this is a different job (a how-to panel, not a banner) with a different
--  risk profile, and CMS → Food Menu edits it behind its own buttons so
--  fixing a typo in a step cannot reach the banner's photo.
--
--  WHY TWO TABLES HERE
--  --------------------
--  menu_order is a SINGLETON — the panel's heading, note and photo are each
--  exactly one value. menu_order_steps is a LIST — staff reorder the steps,
--  retire one for a season and put it back, and rows give that for free the
--  same way home_hero_features does.
--
--  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
--  ------------------------------------------------
--  Every default below is, word for word, what src/pages/foodmenu.jsx used to
--  have hardcoded. Applying this changes nothing a visitor reads.
--
--  IMAGES
--  ------
--  image_url is bundled at build time by Vite like every other photo in this
--  CMS, so it is NULL until staff upload something — see the header of
--  20260808140000_menu_hero_cms.sql for the full reasoning. Uploads go to the
--  existing `catalog-images` bucket, `menu` folder, the same as the banner's
--  own photos.
-- ============================================================================


-- =================================================================== menu_order

create table if not exists public.menu_order (
    id          text primary key default 'menu'
        check (id = 'menu'),

    heading     text,
    -- The note's bold opening word and the sentence after it are separate
    -- columns, the same split contact_section uses for its own note, so the
    -- bold word can be restyled without becoming part of the sentence staff
    -- retype.
    note_label  text,
    note_text   text,
    -- Public URL of the photo beside the numbered steps. Null = the photo the
    -- site shipped with.
    image_url   text,

    updated_at  timestamptz not null default now()
);

comment on table public.menu_order is
    'Singleton row holding the /menu page''s "How to Order Food" panel: '
    'heading, note and photo. Its steps are menu_order_steps. '
    'Public-readable, staff-writable.';

create or replace function public.menu_order_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists menu_order_touch_trg on public.menu_order;
create trigger menu_order_touch_trg
    before update on public.menu_order
    for each row execute function public.menu_order_touch();


-- ============================================================= menu_order_steps

create table if not exists public.menu_order_steps (
    id          text primary key,   -- 'reserve-stay'
    step        text not null,
    sort_order  integer not null default 0,
    is_active   boolean not null default true
);

comment on table public.menu_order_steps is
    'The numbered list inside the /menu page''s How to Order panel.';

create index if not exists menu_order_steps_order_idx
    on public.menu_order_steps (sort_order) where is_active;


-- =================================================================== seeding

insert into public.menu_order (id, heading, note_label, note_text)
values (
    'menu',
    'How to Order Food',
    'Note:',
    'Food orders are subject to availability and may be modified before the preparation cutoff time.'
)
on conflict (id) do nothing;

insert into public.menu_order_steps (id, step, sort_order)
values
    ('reserve-stay',      'Reserve your stay first — you can order before paying.',                    1),
    ('browse-menu',       'Browse the food menu and select your preferred items.',                     2),
    ('choose-quantity',   'Choose the quantity for each item.',                                        3),
    ('review-confirm',    'Review and confirm your order.',                                            4),
    ('join-down-payment', 'The food cost joins your down payment, which you settle from My Bookings.',  5)
on conflict (id) do nothing;


-- ======================================================================= RLS

alter table public.menu_order enable row level security;
alter table public.menu_order_steps enable row level security;

drop policy if exists "menu order panel is public" on public.menu_order;
create policy "menu order panel is public" on public.menu_order
    for select to anon, authenticated using (true);

drop policy if exists "staff manage menu order panel" on public.menu_order;
create policy "staff manage menu order panel" on public.menu_order
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "menu order steps are public" on public.menu_order_steps;
create policy "menu order steps are public" on public.menu_order_steps
    for select to anon, authenticated using (true);

drop policy if exists "staff manage menu order steps" on public.menu_order_steps;
create policy "staff manage menu order steps" on public.menu_order_steps
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ================================================================== realtime

do $$
begin
    alter publication supabase_realtime add table public.menu_order;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.menu_order_steps;
exception when duplicate_object then null;
end $$;
