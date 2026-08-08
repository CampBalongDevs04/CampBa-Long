-- ============================================================================
--  Camp Ba-long — the maintenance day is a SETTING, not a constant
-- ----------------------------------------------------------------------------
--  Monday has been written into the schema since 20260806120000_extended_stays
--  and corrected in 20260806160000_maintenance_day_endpoints_only. The rule
--  those two settled on is right and is not changing here:
--
--      check-in  may not fall on a maintenance day
--      check-out may not fall on a maintenance day
--      every day in between may be anything
--
--  What changes is WHICH days those are. The resort wants to close Monday AND
--  Tuesday some weeks, move the closure, or drop it — and today that is a
--  migration plus a redeploy. After this it is a row: the dashboard's
--  Maintenance tab writes it, and the booking calendar and this database both
--  read it.
--
--  WHY THE CHECK CONSTRAINTS HAVE TO GO
--  ------------------------------------
--  A CHECK constraint may only call an IMMUTABLE function, and immutable means
--  "same answer forever for the same arguments" — a function that reads a
--  settings table is not that, and Postgres refuses it. That is exactly why the
--  day was hardcoded in the first place.
--
--  So enforcement moves from a CHECK to a BEFORE trigger, which is allowed to
--  read tables. The rule enforced is identical; only the mechanism differs.
--
--  WHEN THE TRIGGER FIRES
--  ----------------------
--  On INSERT always, and on UPDATE only when a date actually moves. That is
--  deliberate. Changing the maintenance days cannot invalidate a stay that is
--  already on the books — staff would otherwise be unable to so much as mark
--  such a booking paid, because saving the row would re-run a rule it was never
--  written under. Bookings already taken stand; the new days apply to what gets
--  written from now on. The `not valid` CHECK this replaces behaved the same
--  way, and for the same reason.
--
--  WHICH NUMBERS MEAN WHICH DAYS
--  -----------------------------
--  0 = Sunday … 6 = Saturday. That is Postgres `dow` AND JavaScript
--  getDay(), which is the whole point of choosing it over `isodow` (1 = Monday
--  … 7 = Sunday): src/data/maintenanceDays.js stores the same integers this
--  table does, so the two halves of the rule can never drift by an off-by-one.
--
--  THE DEFAULT IS TODAY'S BEHAVIOUR
--  --------------------------------
--  The row seeds as {1} — Monday, alone, exactly as before. Applying this
--  migration changes nothing a guest can see until staff change it.
-- ============================================================================


-- ============================================= 1. release the old rule

-- Order matters: the constraints depend on the function, so dropping the
-- function while either still references it fails.
alter table public.bookings
    drop constraint if exists bookings_avoids_maintenance_day;

alter table public.booking_groups
    drop constraint if exists booking_groups_avoids_maintenance_day;


-- ============================================= 2. the setting itself

create table if not exists public.maintenance_days (
    id          text primary key default 'resort'
        check (id = 'resort'),

    -- Which weekdays the resort is closed for turnover. 0 = Sunday … 6 =
    -- Saturday. Sorted and de-duplicated on the way in by the trigger below,
    -- so a reader never has to normalise it.
    days        smallint[] not null default array[1]::smallint[],

    updated_at  timestamptz not null default now(),

    -- Nothing outside a week.
    constraint maintenance_days_are_weekdays
        check (days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),

    -- Six is the ceiling on purpose. Seven would close the resort every day of
    -- the week, which no arrival date could satisfy — the booking form would
    -- refuse every stay with no way back except a database edit. An empty array
    -- IS allowed: that is "open every day", a real answer.
    constraint maintenance_days_at_most_six
        check (cardinality(days) <= 6)
);

comment on table public.maintenance_days is
    'Singleton row naming the weekdays the resort closes for maintenance. '
    '0 = Sunday … 6 = Saturday, matching Postgres dow and JavaScript getDay(). '
    'No stay may start or finish on one; a longer stay runs straight through. '
    'Public-readable (the booking calendar needs it), staff-writable.';
comment on column public.maintenance_days.days is
    'Sorted, de-duplicated weekday numbers. Empty means the resort never '
    'closes. The twin of MAINTENANCE_DAYS_FALLBACK in src/data/maintenanceDays.js.';


-- Sort and de-duplicate rather than refuse. {2,1,1} and {1,2} are the same
-- Monday-and-Tuesday closure said two ways, and rejecting the first would be
-- pedantry aimed at whoever wrote the client, not at the resort.
create or replace function public.maintenance_days_normalise()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.days := coalesce(
        (select array_agg(distinct d order by d) from unnest(new.days) as d),
        array[]::smallint[]
    );
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists maintenance_days_normalise_trg on public.maintenance_days;
create trigger maintenance_days_normalise_trg
    before insert or update on public.maintenance_days
    for each row execute function public.maintenance_days_normalise();


insert into public.maintenance_days (id, days)
values ('resort', array[1]::smallint[])
on conflict (id) do nothing;


-- ============================================= 3. reading the setting

-- SECURITY DEFINER so the answer never depends on who is asking. The booking
-- triggers below run inside book_accommodation(), guests read it through the
-- public policy, and staff read it through theirs — one row, one answer.
create or replace function public.maintenance_dow_set()
returns smallint[]
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (select days from public.maintenance_days where id = 'resort'),
        array[1]::smallint[]
    );
$$;

comment on function public.maintenance_dow_set() is
    'The weekdays the resort is closed, 0 = Sunday … 6 = Saturday. Falls back '
    'to Monday alone if the settings row is missing.';


create or replace function public.is_maintenance_day(p_day date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select p_day is not null
       and extract(dow from p_day)::smallint = any (public.maintenance_dow_set());
$$;

comment on function public.is_maintenance_day(date) is
    'Does this date fall on one of the resort''s maintenance days? The SQL twin '
    'of isMaintenanceDay() in src/data/extendedStay.js.';


-- 'Monday', or 'Monday, Tuesday' — for the refusal message, so a guest is told
-- which days are shut rather than that some unnamed rule stopped them.
create or replace function public.maintenance_day_names()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        string_agg(
            (array['Sunday', 'Monday', 'Tuesday', 'Wednesday',
                   'Thursday', 'Friday', 'Saturday'])[d + 1],
            ', ' order by d
        ),
        'none'
    )
    from unnest(public.maintenance_dow_set()) as d;
$$;


-- Same name and signature as before, so anything already calling it keeps
-- working. STABLE rather than IMMUTABLE now that it reads a table — which is
-- precisely what disqualifies it from a CHECK constraint, and why section 4
-- exists.
create or replace function public.stay_ends_on_maintenance_day(
    p_check_in  date,
    p_check_out date
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.is_maintenance_day(p_check_in)
        or public.is_maintenance_day(coalesce(p_check_out, p_check_in));
$$;

comment on function public.stay_ends_on_maintenance_day(date, date) is
    'True when a stay would start or finish on one of the resort''s maintenance '
    'days. Days INSIDE the stay are unrestricted — a long stay runs straight '
    'through one, which is the only way a week-long booking can exist. Reads '
    'public.maintenance_days, so it answers whatever staff have configured.';

grant execute on function public.maintenance_dow_set() to anon, authenticated;
grant execute on function public.is_maintenance_day(date) to anon, authenticated;
grant execute on function public.maintenance_day_names() to anon, authenticated;
grant execute on function public.stay_ends_on_maintenance_day(date, date) to anon, authenticated;


-- ============================================= 4. re-guard both tables

create or replace function public.reject_maintenance_day_endpoints()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    -- A cancelled stay is a record of something that is not happening. It was
    -- exempt from the CHECK this replaces and stays exempt here, so a booking
    -- that somehow violates the rule can still be cancelled rather than being
    -- frozen by its own dates.
    if new.status = 'cancelled' then
        return new;
    end if;

    -- Only the dates are the trigger's business. See WHEN THE TRIGGER FIRES in
    -- the header: an existing booking is not re-litigated because the setting
    -- moved underneath it.
    if tg_op = 'UPDATE'
       and new.check_in_date  is not distinct from old.check_in_date
       and new.check_out_date is not distinct from old.check_out_date then
        return new;
    end if;

    if public.stay_ends_on_maintenance_day(new.check_in_date, new.check_out_date) then
        raise exception
            'A stay cannot start or finish on a maintenance day (%).',
            public.maintenance_day_names()
        using
            hint = 'maintenance_day',
            detail = 'Pick a different check-in or check-out date. A longer stay '
                  || 'may run straight through a maintenance day — only the '
                  || 'arrival and departure dates are restricted.';
    end if;

    return new;
end;
$$;

comment on function public.reject_maintenance_day_endpoints() is
    'BEFORE trigger enforcing the maintenance-day rule that used to be a CHECK '
    'constraint. A trigger rather than a CHECK because the days are now a '
    'setting, and a CHECK may only call an IMMUTABLE function.';


drop trigger if exists bookings_reject_maintenance_day_trg on public.bookings;
create trigger bookings_reject_maintenance_day_trg
    before insert or update of check_in_date, check_out_date
    on public.bookings
    for each row execute function public.reject_maintenance_day_endpoints();

drop trigger if exists booking_groups_reject_maintenance_day_trg on public.booking_groups;
create trigger booking_groups_reject_maintenance_day_trg
    before insert or update of check_in_date, check_out_date
    on public.booking_groups
    for each row execute function public.reject_maintenance_day_endpoints();


-- ============================================= 5. who may read and write it

alter table public.maintenance_days enable row level security;

-- The booking calendar has to grey the right cells out before anyone signs in.
drop policy if exists "maintenance days are public" on public.maintenance_days;
create policy "maintenance days are public" on public.maintenance_days
    for select to anon, authenticated using (true);

drop policy if exists "staff manage maintenance days" on public.maintenance_days;
create policy "staff manage maintenance days" on public.maintenance_days
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ============================================= 6. realtime

-- A calendar open in a guest's browser regreys itself the moment staff save,
-- rather than offering a date the database has just started refusing.
do $$
begin
    alter publication supabase_realtime add table public.maintenance_days;
exception when duplicate_object then null;
end $$;


notify pgrst, 'reload schema';
