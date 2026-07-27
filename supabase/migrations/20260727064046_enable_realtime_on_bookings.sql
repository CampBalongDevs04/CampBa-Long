-- Realtime honours RLS, so these events reach a signed-in staff session (two
-- admins on two laptops stay in step) but never an anonymous visitor. Guests
-- get freshness from the short-lived availability cache in
-- src/data/accommodationDB.js instead.
alter publication supabase_realtime add table public.bookings;
