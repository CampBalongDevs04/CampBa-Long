-- ============================================================================
--  Camp Ba-long — closing on SINGLE DATES as well as every week
-- ----------------------------------------------------------------------------
--  20260808220000_maintenance_days made the closure a setting: a set of
--  weekdays, "Mondays", repeating forever. That is the right shape for turnover
--  and the wrong shape for everything else the resort actually closes for — a
--  repaint on the 8th, 9th and 10th of August, a fiesta, a private booking of
--  the whole property.
--
--  Today the only way to say that is to close Saturdays, which shuts every
--  Saturday of the year, and then remember to undo it. So a second list goes
--  beside the first:
--
--      days   smallint[]  the WEEKLY pattern — 0 = Sunday … 6 = Saturday
--      dates  date[]      SINGLE dates, closed once and never again
--
--  A date is a maintenance day when EITHER says so. That is the whole change to
--  the rule, and it is deliberately one line inside is_maintenance_day(): every
--  guard built on top of it — the booking triggers, book_accommodation(), the
--  refusal message — keeps working without knowing there are now two ways to be
--  closed.
--
--  THE RULE ITSELF IS UNCHANGED
--  ---------------------------
--      check-in  may not fall on a maintenance day
--      check-out may not fall on a maintenance day
--      every day in between may be anything
--
--  WHY DATES ARE NOT PRUNED AUTOMATICALLY
--  --------------------------------------
--  A date that has passed stops mattering — no booking can be made into the
--  past — so the array could be swept on write. It is not: a trigger that
--  quietly deletes rows staff can see is a trigger that will one day delete the
--  wrong thing, and "why did August disappear" is a worse bug than a list with
--  some history in it. The dashboard shows past dates separately and offers a
--  button to remove them, which is the same cleanup done where it can be seen.
--  The cardinality cap below is what actually bounds the column.
--
--  WHY NOT A SEPARATE TABLE
--  ------------------------
--  A row per closed date would be the textbook answer and would buy nothing
--  here: there is no per-date data to hang off it (no reason, no author, no
--  partial closure), the whole list is read as one value on every page load,
--  and the settings row already exists with its policies, its realtime
--  publication and its single-row invariant. One more array column keeps the
--  closure in one place — which is the property this migration is protecting.
-- ============================================================================


-- ============================================= 1. the column

alter table public.maintenance_days
    add column if not exists dates date[] not null default array[]::date[];

comment on column public.maintenance_days.dates is
    'Sorted, de-duplicated single dates the resort is closed, on top of the '
    'weekly pattern in `days`. Each one is closed once — nothing here repeats. '
    'The twin of the `dates` half of src/data/maintenanceDays.js.';

-- No equivalent of the six-weekday ceiling is needed: closing every date in the
-- list still leaves every other date open, so there is no configuration here
-- that can shut the booking form. This is only a bound on a column that would
-- otherwise grow forever — a year of one-off closures is already far more than
-- the resort will have on the books at once, and a list that long is a weekly
-- pattern being typed out by hand.
do $$
begin
    alter table public.maintenance_days
        add constraint maintenance_dates_bounded
        check (cardinality(dates) <= 366);
exception when duplicate_object then null;
end $$;


-- Same treatment the weekday array gets, and for the same reason: {'2026-08-09',
-- '2026-08-08', '2026-08-08'} and {'2026-08-08','2026-08-09'} are the same two
-- closed days said two ways, so they are sorted and de-duplicated rather than
-- refused.
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
    new.dates := coalesce(
        (select array_agg(distinct d order by d) from unnest(new.dates) as d),
        array[]::date[]
    );
    new.updated_at := now();
    return new;
end;
$$;


-- ============================================= 2. reading the second list

-- SECURITY DEFINER for the same reason as maintenance_dow_set(): the answer
-- must not depend on who is asking. The booking triggers run inside
-- book_accommodation(), guests read the row through the public policy, staff
-- through theirs — one row, one answer.
create or replace function public.maintenance_date_set()
returns date[]
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (select dates from public.maintenance_days where id = 'resort'),
        array[]::date[]
    );
$$;

comment on function public.maintenance_date_set() is
    'The single dates the resort is closed, on top of the weekly pattern. '
    'Empty when there are none, which is the normal case.';


-- The one line that makes the whole feature work. Everything else in this file
-- is storage and wording.
create or replace function public.is_maintenance_day(p_day date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select p_day is not null
       and (
            extract(dow from p_day)::smallint = any (public.maintenance_dow_set())
         or p_day = any (public.maintenance_date_set())
       );
$$;

comment on function public.is_maintenance_day(date) is
    'Does this date fall on a maintenance day — either because its weekday is '
    'closed every week, or because this exact date was closed on its own? The '
    'SQL twin of isMaintenanceDay() in src/data/extendedStay.js.';


-- WHY this date is shut, for the refusal a guest actually reads. Naming the
-- weekly pattern when the guest picked a one-off closure would send them
-- looking for a rule that is not there ("but it's a Saturday?"), so the reason
-- given is the one that applies to the date in hand.
--
-- The weekly answer comes first: a date closed both ways is closed every week,
-- and that is the more useful thing to be told.
create or replace function public.maintenance_closure_note(p_day date)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select case
        when p_day is null then public.maintenance_day_names()
        when extract(dow from p_day)::smallint = any (public.maintenance_dow_set())
            then 'closed every ' || to_char(p_day, 'FMDay')
        when p_day = any (public.maintenance_date_set())
            then 'closed on ' || to_char(p_day, 'FMMonth FMDD, YYYY')
        else public.maintenance_day_names()
    end;
$$;

comment on function public.maintenance_closure_note(date) is
    'Why this one date is a maintenance day, in words: ''closed every Monday'' '
    'or ''closed on August 9, 2026''. For the refusal message.';

grant execute on function public.maintenance_date_set() to anon, authenticated;
grant execute on function public.maintenance_closure_note(date) to anon, authenticated;


-- ============================================= 3. the refusal, reworded

-- Identical rule, identical firing conditions (see WHEN THE TRIGGER FIRES in
-- 20260808220000_maintenance_days.sql — a booking already on the books is never
-- re-litigated because the closure moved underneath it). The only change is
-- that the message names the closure the guest actually hit.
create or replace function public.reject_maintenance_day_endpoints()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_check_out date;
    v_blocked   date;
begin
    -- A cancelled stay is a record of something that is not happening. It was
    -- exempt from the CHECK this replaces and stays exempt here, so a booking
    -- that somehow violates the rule can still be cancelled rather than being
    -- frozen by its own dates.
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

    -- The check-in is tested first so the message names the date the guest is
    -- most likely to be looking at.
    v_blocked := case
        when public.is_maintenance_day(new.check_in_date) then new.check_in_date
        when public.is_maintenance_day(v_check_out)       then v_check_out
        else null
    end;

    if v_blocked is not null then
        raise exception
            'A stay cannot start or finish on a maintenance day — the resort is %.',
            public.maintenance_closure_note(v_blocked)
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
    'constraint. A trigger rather than a CHECK because the days are a setting, '
    'and a CHECK may only call an IMMUTABLE function. Covers both the weekly '
    'closure and the single dates, because is_maintenance_day() does.';


-- The triggers themselves are unchanged and still point at this function; they
-- are re-created only so applying this file to a database that somehow lost
-- them puts them back.
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


-- Nothing to seed: no dates are closed until staff close one, which is exactly
-- today's behaviour. Applying this migration changes nothing a guest can see.
-- RLS, the policies and the realtime publication are inherited from the table
-- and need no change — a calendar open in a browser regreys itself when staff
-- save, the new column included.

notify pgrst, 'reload schema';
