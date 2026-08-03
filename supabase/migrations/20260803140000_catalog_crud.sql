-- ============================================================================
--  Camp Ba-long — staff CRUD over the three catalogs
-- ----------------------------------------------------------------------------
--  The dashboard can now create, edit and remove what the resort sells: food
--  menu lines, spa treatments, and accommodation (type + per-schedule rate).
--  Everything below is what that needs from Postgres and nothing more — the
--  tables themselves already exist:
--
--    food_menu_items / spa_services  — 20260730120000_food_and_spa_catalog.sql
--    accommodation_types / _units / _rates — 20260727062826_accommodation_schema.sql
--
--  FOUR CHANGES
--  ------------
--  1. `image_url` on the two menu catalogs. Existing rows point at a BUNDLED
--     asset by key ('menu1', 'massage44') — Vite hashes those at build time, so
--     a key is the only thing SQL can hold. A dish added from the dashboard has
--     no bundled asset to name, so it carries a URL instead and
--     src/data/menuDB.js prefers the key when there is one.
--
--  2. Staff write policies on the accommodation catalog. It had a public SELECT
--     policy and no write policy at all, which under RLS means nobody could
--     write it — the seed got in before the policies existed. Same shape the
--     food and spa catalogs already use: everyone reads, the staff roster
--     writes.
--
--  3. A trigger that keeps accommodation_units in step with a type's `total`.
--     Availability is counted per physical unit, so raising Teepee from 2 to 3
--     in the dashboard has to bring TPE-03 into existence or the new number
--     would be a claim the booking page cannot honour.
--
--  4. The catalogs join the realtime publication, so a price edited on the
--     dashboard reaches a guest already sitting on the menu page. Safe to
--     publish: these tables are public-readable by design (RLS still applies
--     to the replay), which is exactly why bookings is the one table whose
--     realtime events stop at the staff session.
-- ============================================================================


-- ============================================================ 1. image_url

alter table public.food_menu_items add column if not exists image_url text;
alter table public.spa_services    add column if not exists image_url text;

comment on column public.food_menu_items.image_url is
    'Photo for a row added from the dashboard, which has no bundled asset to '
    'name. image_key wins when both are set.';
comment on column public.spa_services.image_url is
    'Photo for a row added from the dashboard. image_key wins when both are set.';


-- ================================================= 2. staff write policies

drop policy if exists "staff manage accommodation types" on public.accommodation_types;
create policy "staff manage accommodation types" on public.accommodation_types
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "staff manage accommodation units" on public.accommodation_units;
create policy "staff manage accommodation units" on public.accommodation_units
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "staff manage accommodation rates" on public.accommodation_rates;
create policy "staff manage accommodation rates" on public.accommodation_rates
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ============================================== 3. units follow `total`
--  WHY A TRIGGER AND NOT THE DASHBOARD
--  -----------------------------------
--  `total` and the rows in accommodation_units are two statements of the same
--  fact, and availability is answered from the SECOND one. If the dashboard
--  wrote the number and forgot the rows, every screen would advertise a unit
--  that can never be assigned. Here they cannot come apart.
--
--  A SHRINK NEVER DESTROYS A RESERVATION
--  -------------------------------------
--  Dropping Teepee from 3 to 2 deletes TPE-03 only if no booking has ever
--  pointed at it. One that has is deactivated instead: it stops being offered,
--  the stays already on it stand, and raising the total again brings it back.
--
--  PREFIX IS NOT IN THE TRIGGER'S UPDATE LIST, ON PURPOSE. Unit ids are built
--  from it and bookings.unit_id references them with no ON UPDATE CASCADE, so
--  renaming a prefix cannot be made to work by generating more rows — it would
--  just orphan the old ones. The dashboard makes prefix read-only after
--  creation for the same reason.

create or replace function public.sync_accommodation_units()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- A type that books against another type's pool (Big Tent and Tent
    -- Pitching both sell over Small Tent's four camping slots) owns no units of
    -- its own — generating any would quietly double the camping ground.
    if new.pool_id is not null and new.pool_id <> new.id then
        return new;
    end if;

    insert into public.accommodation_units (id, type_id, unit_no)
    select new.prefix || '-' || lpad(n::text, 2, '0'), new.id, n
    from generate_series(1, new.total) as n
    on conflict (id) do nothing;

    -- A unit parked by an earlier shrink comes back on the market.
    update public.accommodation_units
       set is_active = true
     where type_id = new.id and unit_no <= new.total and not is_active;

    delete from public.accommodation_units u
     where u.type_id = new.id
       and u.unit_no > new.total
       and not exists (select 1 from public.bookings b where b.unit_id = u.id);

    update public.accommodation_units
       set is_active = false
     where type_id = new.id and unit_no > new.total and is_active;

    return new;
end;
$$;

comment on function public.sync_accommodation_units() is
    'Keeps accommodation_units in step with accommodation_types.total. '
    'Never deletes a unit a booking points at.';

drop trigger if exists accommodation_types_sync_units on public.accommodation_types;
create trigger accommodation_types_sync_units
    after insert or update of total, pool_id on public.accommodation_types
    for each row execute function public.sync_accommodation_units();


-- ====================================================== 4. realtime catalogs
--  `alter publication ... add table` has no IF NOT EXISTS, and a re-run of this
--  migration must not fail on a table that already joined.

do $$
begin
    alter publication supabase_realtime add table public.food_menu_items;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.spa_services;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.accommodation_types;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.accommodation_rates;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.accommodation_units;
exception when duplicate_object then null;
end $$;


-- =================================================== tent-pitching's own rate
--  It is a real type with a real rate row since the shared tent pool migration,
--  but its ₱500 lived only in the front-end fallback table before that. Stated
--  here too so a fresh database and a live one answer the same, and so editing
--  it in the dashboard edits something that exists.

insert into public.accommodation_rates (type_id, rate_group, price, pax_label, min_pax, max_pax)
select 'tent-pitching', 'overnight', 500, 'Any group size', null, null
where exists (select 1 from public.accommodation_types where id = 'tent-pitching')
on conflict (type_id, rate_group) do nothing;
