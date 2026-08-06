-- ============================================================================
--  Camp Ba-long — extended stays (more than one night on one reservation)
-- ----------------------------------------------------------------------------
--  WHAT WAS ALREADY TRUE
--  ---------------------
--  The occupancy model has always been able to hold a unit across several
--  days. occupancy_window() runs from the check-in day's start hour to the
--  check-out day's end hour, so ('2026-08-06', '2026-08-09', 'day-night') is
--  one continuous range — 10:00 on the 6th to 08:00 on the 9th — and the GiST
--  exclusion constraint keeps every other booking out of all of it. Nothing in
--  this migration changes that, and nothing needed to.
--
--  WHAT WAS NOT
--  ------------
--  The MONEY. `price` and `entrance_total` arrive from the client, and the
--  client sent one night's figures whatever the dates said, so a three-night
--  stay was charged as one:
--
--      price ₱2,250 + entrance ₱350/head    for what is really
--      price ₱6,750 + entrance ₱1,050/head
--
--  That is fixed on the client (src/data/extendedStay.js), which multiplies
--  both sides of the rate card by the nights before the booking is created.
--  The generated `downpayment` column picks the change up for free: it is 50%
--  of whatever price + entrance_total + add-ons come to, and those are now the
--  whole-stay figures.
--
--  WHAT THIS MIGRATION ADDS
--  ------------------------
--  Two things the database should assert for itself rather than take on trust:
--
--    1. `nights` — how many nights a row was billed for, as a generated column
--       so it can never disagree with the dates. Reporting and the admin board
--       were each deriving it in their own arithmetic; now there is one answer,
--       and it is the one the price was multiplied by.
--
--    2. A guard that a stay cannot START or FINISH on the resort's maintenance
--       day. The booking page refuses it (Mondays are unselectable in both
--       calendar panels) but nothing stopped a direct write.
--
--       Note what this deliberately does NOT forbid: a Monday INSIDE the stay.
--       A guest already on-site stays through maintenance day, which is the
--       only way a week-long booking can exist — seven nights always cover one.
--
--  Both are additive. To drop:
--
--      alter table public.bookings       drop constraint if exists bookings_avoids_maintenance_day;
--      alter table public.booking_groups drop constraint if exists booking_groups_avoids_maintenance_day;
--      alter table public.bookings       drop column if exists nights;
--      alter table public.booking_groups drop column if exists nights;
--      drop function if exists public.stay_ends_on_maintenance_day(date, date);
-- ============================================================================


-- ================================================================== nights

-- Same rule as countNights()/billableNights() in src/data/extendedStay.js: the
-- whole days between the two dates, and never less than one, because every
-- booking bills at least one block. A same-day schedule stores check_out =
-- check_in (the trigger forces it), so Day Time lands on 1 without a special
-- case here.
alter table public.bookings
    add column if not exists nights integer
    generated always as (greatest(check_out_date - check_in_date, 1)) stored;

alter table public.booking_groups
    add column if not exists nights integer
    generated always as (greatest(check_out_date - check_in_date, 1)) stored;

comment on column public.bookings.nights is
    'Nights billed. `price` and `entrance_total` are whole-stay figures — the '
    'nightly rate and the party''s nightly entrance already multiplied by this. '
    'Generated from the dates, so it cannot drift from the occupancy window.';

comment on column public.booking_groups.nights is
    'Nights billed. Same rule as bookings.nights; unit_subtotal is the sum of '
    'the member units'' whole-stay prices.';


-- ================================================= maintenance day guard

-- The resort closes every Monday, and that bounds the ENDS of a stay, not its
-- length. Nobody arrives or departs on a maintenance day — that is what the
-- closure is for, turnover and cleaning — but a guest already on-site stays
-- through it. That distinction is what makes a week-long booking possible at
-- all: any seven-night stay necessarily covers a Monday.
--
--     check-in  may not be a Monday
--     check-out may not be a Monday
--     every day in between may be anything
--
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
    'straight through one. The SQL twin of isMaintenanceDay() in '
    'data/extendedStay.js.';

grant execute on function public.stay_ends_on_maintenance_day(date, date) to anon, authenticated;

-- NOT VALID on purpose: the constraint binds every insert and update from here
-- on, but installing it does not scan what is already in the table. Bookings
-- taken before this rule was enforced in the database are history, and a
-- constraint that refused to install because of one of them would take the
-- whole migration down with it. No such row is expected — Mondays have never
-- been selectable in either calendar panel — so this is a guard against the
-- unexpected rather than a known amnesty. The cancelled escape is what lets one
-- be cancelled if it does turn up, instead of being frozen by its own dates.
--
-- Once the table is known clean, promote it with:
--     alter table public.bookings validate constraint bookings_avoids_maintenance_day;
alter table public.bookings
    drop constraint if exists bookings_avoids_maintenance_day;
alter table public.bookings
    add constraint bookings_avoids_maintenance_day
    check (
        status = 'cancelled'
        or not public.stay_ends_on_maintenance_day(check_in_date, check_out_date)
    ) not valid;

alter table public.booking_groups
    drop constraint if exists booking_groups_avoids_maintenance_day;
alter table public.booking_groups
    add constraint booking_groups_avoids_maintenance_day
    check (
        status = 'cancelled'
        or not public.stay_ends_on_maintenance_day(check_in_date, check_out_date)
    ) not valid;
