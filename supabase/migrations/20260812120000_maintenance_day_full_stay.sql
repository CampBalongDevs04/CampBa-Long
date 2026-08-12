-- ============================================================================
--  Camp Ba-long — a stay may not run THROUGH maintenance day after all
-- ----------------------------------------------------------------------------
--  WHAT THIS CHANGES
--  ------------------
--  Since 20260806160000_maintenance_day_endpoints_only.sql the rule has been:
--
--      check-in  may not fall on a maintenance day
--      check-out may not fall on a maintenance day
--      every day in between may be anything
--
--  That let a booking span a maintenance day mid-stay — arrive Wed the 12th,
--  leave Tue the 18th, running straight through Monday the 17th. The resort's
--  actual practice is the opposite: nobody is on-site while the property is
--  being serviced, arrival and departure included. A stay may not touch a
--  maintenance day anywhere along it now:
--
--      check-in  may not fall on a maintenance day
--      check-out may not fall on a maintenance day
--      no night in between may fall on one either
--
--  Concretely, check in Wed the 12th with Monday the 17th closed and the
--  longest stay on offer now checks out Sun the 16th (4 nights) — not Tue the
--  18th (6 nights, the old bug this closes). The client-side twin of this
--  change is stayTouchesMaintenanceDay() and the functions built on it in
--  src/data/extendedStay.js.
--
--  WHY THIS DOES NOT TRAP A WEEK-LONG STAY
--  ----------------------------------------
--  The 20260806160000 header warned that a whole-range rule "quietly makes a
--  week-long stay impossible — seven nights always cover a Monday." That is
--  still true while a weekly closure is running. It is accepted here on
--  purpose: WHICH days are closed is a setting (public.maintenance_days), not
--  a constant, and staff can lift or move it from the dashboard's Maintenance
--  tab for a stretch they know a longer stay is wanted over — a holiday week,
--  a private event. The system would rather ask staff to open the calendar for
--  a week than quietly let a guest occupy a unit while it is being cleaned.
--
--  WHY A NEW FILE RATHER THAN AN EDIT
--  -----------------------------------
--  20260810120000_maintenance_dates.sql has already been pushed and redefined
--  reject_maintenance_day_endpoints() to cover one-off dates too. Editing an
--  applied migration changes nothing on a database that already ran it, so
--  this correction is its own migration, same as every fix before it in this
--  chain.
--
--  SCOPE — ONLY THE MAINTENANCE-DAY GUARD
--  ----------------------------------------
--  This file touches exactly two things: a new function,
--  stay_touches_maintenance_day(), and the two BEFORE triggers on `bookings`
--  and `booking_groups` that guard check-in/check-out dates. It does not touch
--  occupancy, pricing, RLS, realtime, or any other table or function in the
--  schema. Safe to run against any state this repo's migrations can produce —
--  it only replaces functions and re-points triggers, so re-running it is a
--  no-op.
-- ============================================================================


-- ============================================== 1. the whole-range question

-- Does ANY day from p_check_in to p_check_out, inclusive of both ends, fall on
-- a maintenance day? STABLE rather than IMMUTABLE, and SECURITY DEFINER for
-- the same reason is_maintenance_day() is: it reads public.maintenance_days,
-- so it cannot go in a CHECK constraint and must answer the same way
-- regardless of who is asking. The SQL twin of stayTouchesMaintenanceDay() in
-- src/data/extendedStay.js.
--
-- Bounded to a year of days so a NULL or reversed date pair cannot make
-- generate_series produce an unbounded series; no real stay is anywhere near
-- that long (MAX_STAY_NIGHTS client-side is 30).
create or replace function public.stay_touches_maintenance_day(
    p_check_in  date,
    p_check_out date
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from generate_series(
            p_check_in,
            least(
                greatest(coalesce(p_check_out, p_check_in), p_check_in),
                p_check_in + interval '366 days'
            ),
            interval '1 day'
        ) as d
        where public.is_maintenance_day(d::date)
    );
$$;

comment on function public.stay_touches_maintenance_day(date, date) is
    'True when the inclusive date range covers a maintenance day anywhere in '
    'it — the check-in, the check-out, or a night between. Reads '
    'public.maintenance_days (both the weekly pattern and the one-off dates), '
    'so it answers whatever staff have configured. The SQL twin of '
    'stayTouchesMaintenanceDay() in src/data/extendedStay.js.';

grant execute on function public.stay_touches_maintenance_day(date, date) to anon, authenticated;


-- ============================================== 2. the trigger, re-armed

-- Same firing conditions as reject_maintenance_day_endpoints() before it (see
-- WHEN THE TRIGGER FIRES in 20260808220000_maintenance_days.sql): every
-- INSERT, and an UPDATE only when a date actually moves, so changing the
-- maintenance days cannot retroactively invalidate a stay already on the
-- books. Renamed from *_endpoints to say what it now actually checks.
create or replace function public.reject_maintenance_day_touch()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_check_out date;
    v_blocked   date;
begin
    -- A cancelled stay is a record of something that is not happening. It was
    -- exempt from the rule before and stays exempt here, so a booking that
    -- somehow violates it can still be cancelled rather than being frozen by
    -- its own dates.
    if new.status = 'cancelled' then
        return new;
    end if;

    -- Only the dates are the trigger's business.
    if tg_op = 'UPDATE'
       and new.check_in_date  is not distinct from old.check_in_date
       and new.check_out_date is not distinct from old.check_out_date then
        return new;
    end if;

    v_check_out := coalesce(new.check_out_date, new.check_in_date);

    if public.stay_touches_maintenance_day(new.check_in_date, v_check_out) then
        -- Walk the range for the first closed day, so the message names the
        -- day the guest actually ran into rather than refusing blind. Bounded
        -- the same way stay_touches_maintenance_day() is, for the same reason.
        select min(d) into v_blocked
        from generate_series(
            new.check_in_date,
            least(v_check_out, new.check_in_date + interval '366 days'),
            interval '1 day'
        ) as d
        where public.is_maintenance_day(d::date);

        raise exception
            'A stay cannot include a maintenance day — the resort is %.',
            public.maintenance_closure_note(v_blocked)
        using
            hint = 'maintenance_day',
            detail = 'Pick dates that do not cross a maintenance closure — a stay '
                  || 'may run up to one, not through it. Staff can move or lift '
                  || 'the closure from the dashboard if a longer stay is wanted '
                  || 'over these dates.';
    end if;

    return new;
end;
$$;

comment on function public.reject_maintenance_day_touch() is
    'BEFORE trigger enforcing that a stay may not touch a maintenance day at '
    'any point in its range, endpoints or between. Replaces '
    'reject_maintenance_day_endpoints(), which only checked the two ends.';

drop trigger if exists bookings_reject_maintenance_day_trg on public.bookings;
create trigger bookings_reject_maintenance_day_trg
    before insert or update of check_in_date, check_out_date
    on public.bookings
    for each row execute function public.reject_maintenance_day_touch();

drop trigger if exists booking_groups_reject_maintenance_day_trg on public.booking_groups;
create trigger booking_groups_reject_maintenance_day_trg
    before insert or update of check_in_date, check_out_date
    on public.booking_groups
    for each row execute function public.reject_maintenance_day_touch();

-- The endpoints-only function is no longer pointed at by any trigger as of the
-- two DROP TRIGGER / CREATE TRIGGER pairs above. Dropped rather than left
-- behind, so there is one function per rule instead of a live one and a dead
-- one with almost the same name.
drop function if exists public.reject_maintenance_day_endpoints();

notify pgrst, 'reload schema';
