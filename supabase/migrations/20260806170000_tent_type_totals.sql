-- ============================================================================
--  Tent type totals — match the resort's printed rate card
-- ----------------------------------------------------------------------------
--  20260803120000_shared_tent_pool.sql pointed Small Tent, Big Tent and Tent
--  Pitching at the same 4-unit physical pool (3 small tent structures +
--  1 big tent structure) and, at the same time, set every one of the three
--  types' OWN `total` to 4 — the pool size — so the booking page showed
--  "4 of 4 available" on all three cards regardless of which one a guest was
--  looking at.
--
--  That's right for Tent Pitching, which really can use any of the 4 slots.
--  It's wrong for Small Tent and Big Tent: the rate card only ever advertised
--  3 small tents and 1 big tent, and a card claiming 4 of something the resort
--  only has 1 of reads as a mistake to a guest counting tents.
--
--  `total` here is what the accommodation_availability() RPC reports as a
--  card's own ceiling (see 20260727062903_accommodation_functions.sql); the
--  actual cross-type booking limit still comes from available_units() reading
--  the shared pool, untouched by this migration. Capping each card's
--  displayed `available` at its own `total` is the front end's job — see
--  data/accommodationDB.js.
-- ============================================================================

update public.accommodation_types set total = 3 where id = 'tent-small';
update public.accommodation_types set total = 1 where id = 'tent-large';
