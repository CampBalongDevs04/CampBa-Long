-- ============================================================================
--  Row Level Security + catalog seed
-- ----------------------------------------------------------------------------
--  Guests may create a booking and read availability COUNTS, but never read or
--  edit booking rows — those carry other people's names, emails and receipts.
--  Staff sign in with Supabase Auth and see everything.
--
--  NOTE: the bookings policy here is superseded by
--  20260727064341_staff_only_booking_access.sql, which narrows it from "any
--  authenticated user" to "on the staff roster".
-- ============================================================================

alter table public.accommodation_types  enable row level security;
alter table public.accommodation_units  enable row level security;
alter table public.stay_schedules       enable row level security;
alter table public.accommodation_rates  enable row level security;
alter table public.bookings             enable row level security;

drop policy if exists "catalog is public" on public.accommodation_types;
create policy "catalog is public" on public.accommodation_types
    for select to anon, authenticated using (true);

drop policy if exists "catalog is public" on public.accommodation_units;
create policy "catalog is public" on public.accommodation_units
    for select to anon, authenticated using (true);

drop policy if exists "catalog is public" on public.stay_schedules;
create policy "catalog is public" on public.stay_schedules
    for select to anon, authenticated using (true);

drop policy if exists "catalog is public" on public.accommodation_rates;
create policy "catalog is public" on public.accommodation_rates
    for select to anon, authenticated using (true);

drop policy if exists "staff manage bookings" on public.bookings;
create policy "staff manage bookings" on public.bookings
    for all to authenticated using (true) with check (true);

-- The availability helpers are SECURITY DEFINER, so they answer for anonymous
-- visitors without exposing any row.
grant execute on function public.accommodation_availability(date, date, text) to anon, authenticated;
grant execute on function public.next_available_date(text, date, text, integer) to anon, authenticated;
grant execute on function public.book_accommodation(text, text, date, date, text, text, text, integer, integer, integer, numeric, numeric, text) to anon, authenticated;
grant execute on function public.unit_day_detail(date) to authenticated;


-- =================================================================== seeding

insert into public.stay_schedules
    (key, label, time_label, description, note, entrance_fee, rate_group, same_day, start_minutes, end_minutes, sort_order)
values
    ('day', 'Day Time: ', '10:00 AM - 5:00 PM', '7 Hours',
     'Check-in/out is fixed by schedule: 10:00 AM to 5:00 PM. Late arrivals are not allowed.',
     150, 'day', true, 600, 1020, 1),
    ('day-night', 'Day and night Time: ', '10:00 AM - 8:00 AM', '22 Hours',
     'Please arrive or depart early to avoid a late check-in. By schedule: 10:00 AM - 8:00 AM. Late arrivals are not allowed.',
     350, 'overnight', false, 600, 480, 2),
    ('night-day', 'Night and Day Time: ', '8:00 PM - 6:00 PM', '22 Hours',
     'Please arrive or depart early to avoid a late check-in. By schedule: 8:00 PM - 6:00 PM. Late arrivals are not allowed.',
     350, 'overnight', false, 1200, 1080, 3)
on conflict (key) do nothing;

insert into public.accommodation_types (id, name, prefix, total, sort_order) values
    ('teepee',     'Teepee',          'TPE',   2, 1),
    ('small',      'A-House Small',   'AHS',   3, 2),
    ('medium',     'A-House Medium',  'AHM',   2, 3),
    ('family',     'A-House Family',  'AHF',   1, 4),
    ('tent-small', 'Small Tent',      'TENTS', 3, 5),
    ('tent-large', 'Big Tent',        'TENTL', 1, 6),
    ('cottage',    'Cottage',         'COT',   2, 7),
    ('pavilion',   'Pavillion',       'PAV',   1, 8)
on conflict (id) do nothing;

-- Generate the physical units (TPE-01, TPE-02, AHS-01, …) from each total.
insert into public.accommodation_units (id, type_id, unit_no)
select t.prefix || '-' || lpad(n::text, 2, '0'), t.id, n
from public.accommodation_types t
cross join lateral generate_series(1, t.total) as n
on conflict (id) do nothing;

insert into public.accommodation_rates (type_id, rate_group, price, pax_label, min_pax, max_pax) values
    ('teepee',        'day',        900, '4 Pax',          1,  4),
    ('small',         'day',       1450, '4 Pax',          1,  4),
    ('medium',        'day',       1900, '4-5 Pax',        4,  5),
    ('family',        'day',       4000, '8-10 Pax',       8, 10),
    ('cottage',       'day',       2000, '8-10 Pax',       8, 10),
    ('pavilion',      'day',       4000, '10-15 Pax',     10, 15),
    ('teepee',        'overnight', 1700, '2-3 Pax',        2,  3),
    ('small',         'overnight', 2250, '2-3 Pax',        2,  3),
    ('medium',        'overnight', 3200, '4-5 Pax',        4,  5),
    ('family',        'overnight', 7000, '8-10 Pax',       8, 10),
    ('tent-small',    'overnight',  900, '2-3 Pax',        2,  3),
    ('tent-large',    'overnight', 1800, '4-6 Pax',        4,  6)
on conflict (type_id, rate_group) do nothing;

-- NOTE: 'tent-pitching' (₱500 flat, guests bring their own tent) is deliberately
-- absent from every table here. It has no unit ceiling, so there is nothing to
-- hold and nothing to run out of — book_accommodation() leaves unit_id null for
-- it, and the exclusion constraint skips null units. Its price stays in the
-- front-end rate table (data/accomodationOptions.js).
