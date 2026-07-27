-- ============================================================================
--  Camp Ba-long — accommodation schema
-- ----------------------------------------------------------------------------
--  The Postgres side of src/data/accommodationDB.js. Same tables, same rules,
--  same function names, so the front end just calls supabase.rpc(...).
--
--  THE RULE THIS SCHEMA ENFORCES
--  -----------------------------
--  A physical unit can be held by at most one booking at any given MOMENT.
--  Not "one booking per day" — per moment, because the three stay schedules
--  cover different hours:
--
--     Day Time        10:00 → 17:00   (same calendar day)
--     Day and Night   10:00 → 08:00   (next morning)
--     Night and Day   20:00 → 18:00   (next evening)
--
--  So AHF-01 booked for Day Time on Jul 28 is gone for that afternoon but
--  still bookable for a Night-and-Day stay starting 20:00 the same evening.
--  This is not left to application code where a race could slip past it: it
--  is a GiST exclusion constraint on the table, so two overlapping inserts
--  cannot both commit, full stop.
-- ============================================================================

create extension if not exists btree_gist;

-- Every date in this schema is interpreted in resort-local time. Guests and
-- staff are all on-site, so the resort clock is the only clock that matters.
create or replace function public.resort_timezone()
returns text language sql immutable as $$ select 'Asia/Manila'::text $$;


-- ======================================================== accommodation_types

create table if not exists public.accommodation_types (
    id          text primary key,             -- 'small', 'cottage', … (used by the UI)
    name        text not null,                -- 'A-House Small'
    prefix      text not null unique,         -- 'AHS' → unit ids AHS-01, AHS-02
    total       integer not null check (total > 0),
    image_url   text,
    sort_order  integer not null default 0,
    is_active   boolean not null default true
);

comment on column public.accommodation_types.total is
    'How many physical units exist. The ceiling on overlapping bookings.';


-- ======================================================== accommodation_units
-- One row per physical unit. Availability is answered per unit, never per
-- type, which is what lets the booking flow hand a guest a specific cabin.

create table if not exists public.accommodation_units (
    id          text primary key,             -- 'AHS-01'
    type_id     text not null references public.accommodation_types (id) on delete cascade,
    unit_no     integer not null,
    is_active   boolean not null default true, -- take a unit off the market for repairs
    notes       text,
    unique (type_id, unit_no)
);

create index if not exists accommodation_units_type_idx
    on public.accommodation_units (type_id) where is_active;


-- ============================================================= stay_schedules
-- start_minutes — minutes past midnight ON THE CHECK-IN DAY
-- end_minutes   — minutes past midnight ON THE CHECK-OUT DAY
--                 (same day when same_day is true)
-- These two numbers are the whole availability model.

create table if not exists public.stay_schedules (
    key            text primary key,          -- 'day', 'day-night', 'night-day'
    label          text not null,
    time_label     text not null,             -- '10:00 AM - 5:00 PM'
    description    text not null,             -- '7 Hours'
    note           text,
    entrance_fee   numeric(10,2) not null default 0,   -- per head
    rate_group     text not null,             -- 'day' | 'overnight'
    same_day       boolean not null default false,
    start_minutes  integer not null check (start_minutes between 0 and 1440),
    end_minutes    integer not null check (end_minutes between 0 and 1440),
    sort_order     integer not null default 0
);


-- ========================================================= accommodation_rates
-- Price and capacity depend on the rate group: a unit is only offered under a
-- schedule if it has a row here (cottage/pavilion are day-only, tents are
-- overnight-only).

create table if not exists public.accommodation_rates (
    type_id     text not null references public.accommodation_types (id) on delete cascade,
    rate_group  text not null,                -- 'day' | 'overnight'
    price       numeric(10,2) not null,
    pax_label   text,                         -- '4-5 Pax'
    min_pax     integer,
    max_pax     integer,
    primary key (type_id, rate_group)
);


-- ==================================================================== bookings

do $$ begin
    create type public.booking_status as enum ('pending', 'upcoming', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
    create type public.payment_status as enum ('unpaid', 'down-payment', 'paid-full');
exception when duplicate_object then null;
end $$;

create table if not exists public.bookings (
    id              uuid primary key default gen_random_uuid(),
    code            text not null unique,     -- 'CBL-…', the reference guests quote

    -- --- what is being held ---
    type_id         text references public.accommodation_types (id),
    -- Null for types with no unit ceiling (guests pitching their own tent).
    -- A null unit_id is exempt from the no-double-booking rule below.
    unit_id         text references public.accommodation_units (id),
    schedule_key    text not null references public.stay_schedules (key),

    -- --- when ---
    check_in_date   date not null,
    check_out_date  date not null,
    -- Derived from the dates + schedule by the trigger, never trusted from the
    -- client. `occupancy` is what the exclusion constraint compares.
    starts_at       timestamptz not null,
    ends_at         timestamptz not null,
    occupancy       tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,

    -- --- who ---
    guest_name      text not null,
    guest_email     text,
    guest_mobile    text,
    pax             integer check (pax is null or pax > 0),
    kids            integer not null default 0 check (kids >= 0),
    seniors         integer not null default 0 check (seniors >= 0),

    -- --- money (entrance fees are settled on-site, so only the unit rate lives here) ---
    price           numeric(10,2),
    downpayment     numeric(10,2),
    entrance_total  numeric(10,2),
    payment         public.payment_status not null default 'unpaid',
    receipt_url     text,

    -- --- lifecycle ---
    status          public.booking_status not null default 'pending',
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),

    constraint bookings_dates_ordered check (check_out_date >= check_in_date),
    constraint bookings_window_ordered check (ends_at > starts_at),
    constraint bookings_specials_fit  check (coalesce(pax, 0) = 0 or kids + seniors <= pax)
);

-- ─────────────────────────────────────────────────────────────────────────────
--  THE constraint. A unit cannot be held by two live bookings whose occupancy
--  windows overlap, even by a minute. Cancelled bookings drop out of the
--  index, which is what "cancelling frees the dates" means physically.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.bookings drop constraint if exists bookings_no_double_booking;
alter table public.bookings add constraint bookings_no_double_booking
    exclude using gist (unit_id with =, occupancy with &&)
    where (unit_id is not null and status <> 'cancelled');

create index if not exists bookings_occupancy_idx on public.bookings using gist (occupancy);
create index if not exists bookings_unit_idx      on public.bookings (unit_id, status);
create index if not exists bookings_checkin_idx   on public.bookings (check_in_date);
