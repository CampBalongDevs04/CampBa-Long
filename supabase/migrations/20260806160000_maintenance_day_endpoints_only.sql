-- ============================================================================
--  Camp Ba-long — a stay may run THROUGH maintenance day, just not end on one
-- ----------------------------------------------------------------------------
--  WHAT THIS FIXES
--  ---------------
--  20260806120000_extended_stays.sql shipped with the wrong rule. It forbade a
--  Monday ANYWHERE in a booking's date range:
--
--      not stay_touches_maintenance_day(check_in_date, check_out_date)
--
--  which quietly makes a week-long stay impossible — seven nights always cover
--  a Monday. The booking form offers those stays and the database refuses them
--  at insert, so the guest gets a failure with no explanation on the page.
--
--  The rule the resort actually has is about ARRIVALS AND DEPARTURES. Nobody
--  checks in or out on maintenance day — that is what the closure is for,
--  turnover and cleaning — but a guest already on-site simply stays through it:
--
--      check-in  may not be a Monday
--      check-out may not be a Monday
--      every day in between may be anything
--
--  WHY A NEW FILE RATHER THAN AN EDIT
--  ----------------------------------
--  20260806120000 has already been pushed. The CLI records applied migrations
--  by their version prefix, so editing that file changes nothing on a database
--  that has already run it — `supabase db push` would report nothing to do
--  while the broken constraint stayed exactly where it was. A correction to an
--  applied migration has to be its own migration.
--
--  Safe to run against either state: a database that has 20260806120000 (drops
--  the old rule, installs the new one) and a fresh one built from the current
--  files (the drops are no-ops and the constraints are replaced with
--  themselves).
--
--  ORDER MATTERS BELOW. The CHECK constraints depend on the function, so they
--  come off first — dropping the function while a constraint still references
--  it fails.
-- ============================================================================


-- ============================================== 1. release the old rule

alter table public.bookings
    drop constraint if exists bookings_avoids_maintenance_day;

alter table public.booking_groups
    drop constraint if exists booking_groups_avoids_maintenance_day;

drop function if exists public.stay_touches_maintenance_day(date, date);


-- ============================================== 2. the rule we actually have

-- IMMUTABLE and free of table reads, which is what makes it legal inside a
-- CHECK constraint. isodow 1 is Monday.
create or replace function public.stay_ends_on_maintenance_day(
    p_check_in  date,
    p_check_out date
)
returns boolean
language sql
immutable
set search_path = public
as $$
    select extract(isodow from p_check_in) = 1
        or extract(isodow from coalesce(p_check_out, p_check_in)) = 1;
$$;

comment on function public.stay_ends_on_maintenance_day(date, date) is
    'True when a stay would start or finish on a Monday, the resort''s '
    'maintenance day. Days INSIDE the stay are unrestricted — a long stay runs '
    'straight through one, which is the only way a week-long booking can '
    'exist. The SQL twin of isMaintenanceDay() in data/extendedStay.js.';

grant execute on function public.stay_ends_on_maintenance_day(date, date) to anon, authenticated;


-- ============================================== 3. re-guard both tables

-- NOT VALID for the same reason as before: this binds every insert and update
-- from here on without scanning rows already in the table. It is strictly more
-- permissive than the rule it replaces, so nothing that was legal a moment ago
-- becomes illegal now — no existing row can be stranded by it.
--
-- The cancelled escape lets a row that somehow violates this still be
-- cancelled, rather than being frozen by its own dates.
alter table public.bookings
    add constraint bookings_avoids_maintenance_day
    check (
        status = 'cancelled'
        or not public.stay_ends_on_maintenance_day(check_in_date, check_out_date)
    ) not valid;

alter table public.booking_groups
    add constraint booking_groups_avoids_maintenance_day
    check (
        status = 'cancelled'
        or not public.stay_ends_on_maintenance_day(check_in_date, check_out_date)
    ) not valid;

notify pgrst, 'reload schema';
