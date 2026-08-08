-- ============================================================================
--  Camp Ba-long — the "How to book Spa Service" panel on /spa
-- ----------------------------------------------------------------------------
--  spa_hero (20260808180000) covers the banner at the top of /spa. This covers
--  the panel below it that walks a guest through booking a treatment — its
--  section heading, the heading on the card, its numbered steps and the photo
--  beside them. src/pages/spaService.jsx had all of it hardcoded (the
--  `instructions` array and the JSX around it).
--
--  The direct counterpart of menu_order (20260808160000), which does the same
--  job on /menu, and deliberately built the same way — including the two-table
--  split, for the same reasons.
--
--  WHY TWO TABLES
--  --------------
--  spa_reserve is a SINGLETON — the section heading, the card heading and the
--  photo are each exactly one value. spa_reserve_steps is a LIST: staff
--  reorder the steps, retire one and put it back, and rows give that for free
--  the same way menu_order_steps and home_hero_features do.
--
--  WHY TWO HEADINGS
--  ----------------
--  The page prints two: "How to book Spa Service" over the whole section, and
--  "How to Order" on the card inside it. They are genuinely two strings on
--  screen, so they are two columns — folding them into one would make the
--  smaller one uneditable rather than tidy.
--
--  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
--  ------------------------------------------------
--  Every default below is, word for word, what src/pages/spaService.jsx used
--  to have hardcoded. Applying this changes nothing a visitor reads.
--
--  IMAGES
--  ------
--  image_url is NULL until staff upload something — the photo the site ships
--  with is painted by spaService.css (.spa-image) and Vite hashes its filename
--  at build time. See the header of 20260808180000_spa_hero_cms.sql for the
--  full reasoning. Uploads go to the existing `catalog-images` bucket, `spa`
--  folder.
-- ============================================================================


-- ================================================================= spa_reserve

create table if not exists public.spa_reserve (
    id           text primary key default 'spa'
        check (id = 'spa'),

    -- "How to book Spa Service" — over the whole section.
    heading      text,
    -- "How to Order" — on the card holding the numbered list.
    steps_title  text,
    -- Public URL of the photo beside the steps. Null = the photo the
    -- stylesheet paints.
    image_url    text,

    updated_at   timestamptz not null default now()
);

comment on table public.spa_reserve is
    'Singleton row holding the /spa page''s "How to book Spa Service" panel: '
    'its two headings and its photo. Its steps are spa_reserve_steps. '
    'Public-readable, staff-writable.';
comment on column public.spa_reserve.image_url is
    'Public URL of the photo beside the steps, in the "catalog-images" bucket. '
    'Null leaves the photo the stylesheet paints in place.';

create or replace function public.spa_reserve_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists spa_reserve_touch_trg on public.spa_reserve;
create trigger spa_reserve_touch_trg
    before update on public.spa_reserve
    for each row execute function public.spa_reserve_touch();


-- =========================================================== spa_reserve_steps

create table if not exists public.spa_reserve_steps (
    id          text primary key,   -- 'reserve-stay'
    step        text not null,
    sort_order  integer not null default 0,
    is_active   boolean not null default true
);

comment on table public.spa_reserve_steps is
    'The numbered list inside the /spa page''s How to book panel.';

create index if not exists spa_reserve_steps_order_idx
    on public.spa_reserve_steps (sort_order) where is_active;


-- ===================================================================== seeding

insert into public.spa_reserve (id, heading, steps_title)
values ('spa', 'How to book Spa Service', 'How to Order')
on conflict (id) do nothing;

insert into public.spa_reserve_steps (id, step, sort_order)
values
    ('reserve-stay',      'Reserve your stay first — you can book a treatment before paying.',              1),
    ('browse-spa',        'Browse the Spa Service',                                                        2),
    ('input-pax',         'Input How Many Pax',                                                            3),
    ('review-confirm',    'Review and Confirm your Service',                                               4),
    ('join-down-payment', 'The treatment joins your down payment, which you settle from My Bookings.',      5)
on conflict (id) do nothing;


-- ========================================================================= RLS

alter table public.spa_reserve enable row level security;
alter table public.spa_reserve_steps enable row level security;

drop policy if exists "spa reserve panel is public" on public.spa_reserve;
create policy "spa reserve panel is public" on public.spa_reserve
    for select to anon, authenticated using (true);

drop policy if exists "staff manage spa reserve panel" on public.spa_reserve;
create policy "staff manage spa reserve panel" on public.spa_reserve
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "spa reserve steps are public" on public.spa_reserve_steps;
create policy "spa reserve steps are public" on public.spa_reserve_steps
    for select to anon, authenticated using (true);

drop policy if exists "staff manage spa reserve steps" on public.spa_reserve_steps;
create policy "staff manage spa reserve steps" on public.spa_reserve_steps
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ==================================================================== realtime

do $$
begin
    alter publication supabase_realtime add table public.spa_reserve;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.spa_reserve_steps;
exception when duplicate_object then null;
end $$;
