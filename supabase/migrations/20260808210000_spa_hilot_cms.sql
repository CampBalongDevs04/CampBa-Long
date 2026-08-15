-- ============================================================================
--  Camp Ba-long — the "Hilot Wellness Spa" section heading on /spa
-- ----------------------------------------------------------------------------
--  The words that introduce the treatment grid: the small line above the
--  heading, the heading, the paragraph under it, and the "Free Exclusive
--  Inclusions" list at the bottom of the section.
--
--  WHAT THIS IS NOT
--  ----------------
--  It is NOT the treatment cards. Those are public.spa_services — name, price,
--  duration, photo — and they are edited in the dashboard's Spa SECTION, where
--  they already were. Nothing here reads or writes that table.
--
--  This is the same split Accommodations has had since 20260807180000: CMS
--  owns the heading over the grid, the catalog owns what is in it. A staff
--  member changing a price should not be able to reach the section's wording
--  by accident, and a staff member fixing a typo in the wording should not be
--  one stray click from a price.
--
--  WHY THE INCLUSIONS ARE ROWS
--  ---------------------------
--  "Checking Vital Signs (BP, BT)", "Blue Salabat Tea", "Banana Leaves Natural
--  Ionizer" — a list that grows, shrinks and reorders, and one that the resort
--  will want to take an item off for a season without retyping it later. Rows
--  give that; a text[] would not, for the same reason spa_reserve_steps is a
--  table and spa_gallery.photos is an array.
--
--  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
--  ------------------------------------------------
--  Every default below is, word for word, what src/pages/spaService.jsx used
--  to have hardcoded. Applying this changes nothing a visitor reads.
-- ============================================================================


-- =================================================================== spa_hilot

create table if not exists public.spa_hilot (
    id                text primary key default 'spa'
        check (id = 'spa'),

    -- The small line above the heading — "Our Services".
    eyebrow           text,
    title             text,
    subtitle          text,
    -- The label over the inclusions list — "Free Exclusive Inclusions".
    inclusions_label  text,

    updated_at        timestamptz not null default now()
);

comment on table public.spa_hilot is
    'Singleton row holding the /spa page''s Hilot Wellness Spa section '
    'heading and the label over its inclusions. The treatment cards under it '
    'are spa_services, which this does not touch. Public-readable, '
    'staff-writable.';

create or replace function public.spa_hilot_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists spa_hilot_touch_trg on public.spa_hilot;
create trigger spa_hilot_touch_trg
    before update on public.spa_hilot
    for each row execute function public.spa_hilot_touch();


-- ======================================================== spa_hilot_inclusions

create table if not exists public.spa_hilot_inclusions (
    id          text primary key,   -- 'vital-signs'
    item        text not null,
    sort_order  integer not null default 0,
    is_active   boolean not null default true
);

comment on table public.spa_hilot_inclusions is
    'The "Free Exclusive Inclusions" list at the bottom of the /spa page''s '
    'Hilot Wellness Spa section.';

create index if not exists spa_hilot_inclusions_order_idx
    on public.spa_hilot_inclusions (sort_order) where is_active;


-- ===================================================================== seeding

insert into public.spa_hilot (id, eyebrow, title, subtitle, inclusions_label)
values (
    'spa',
    'Our Services',
    'Hilot Wellness Spa',
    'Time-honored Filipino healing rituals paired with modern comfort. Choose the treatment that speaks to what your body needs today.',
    'Free Exclusive Inclusions'
)
on conflict (id) do nothing;

insert into public.spa_hilot_inclusions (id, item, sort_order)
values
    ('vital-signs',   'Checking Vital Signs (BP, BT)',      1),
    ('salabat-tea',   'Blue Salabat Tea',                   2),
    ('banana-leaves', 'Banana Leaves Natural Ionizer',      3)
on conflict (id) do nothing;


-- ========================================================================= RLS

alter table public.spa_hilot enable row level security;
alter table public.spa_hilot_inclusions enable row level security;

drop policy if exists "spa hilot heading is public" on public.spa_hilot;
create policy "spa hilot heading is public" on public.spa_hilot
    for select to anon, authenticated using (true);

drop policy if exists "staff manage spa hilot heading" on public.spa_hilot;
create policy "staff manage spa hilot heading" on public.spa_hilot
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "spa hilot inclusions are public" on public.spa_hilot_inclusions;
create policy "spa hilot inclusions are public" on public.spa_hilot_inclusions
    for select to anon, authenticated using (true);

drop policy if exists "staff manage spa hilot inclusions" on public.spa_hilot_inclusions;
create policy "staff manage spa hilot inclusions" on public.spa_hilot_inclusions
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ==================================================================== realtime

do $$
begin
    alter publication supabase_realtime add table public.spa_hilot;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.spa_hilot_inclusions;
exception when duplicate_object then null;
end $$;
