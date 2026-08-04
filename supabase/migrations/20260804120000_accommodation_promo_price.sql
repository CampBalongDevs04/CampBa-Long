-- ============================================================================
--  Camp Ba-long — today's promo, on top of the standing rate
-- ----------------------------------------------------------------------------
--  accommodation_rates.price is what a unit NORMALLY costs, and that is the
--  number staff have been editing whenever there was a promo on. Which means
--  the original rate was overwritten every time — nothing was left to strike
--  through on the card, and putting the price back after the promo was a matter
--  of remembering what it used to be.
--
--  So `price` stops being the thing a promo touches. It stays the standing
--  rate, and a promo is two more columns beside it:
--
--    promo_price  — what the guest pays while the promo runs
--    promo_active — whether it is running
--
--  Turning `promo_active` off is the whole of ending a promo: the standing rate
--  is still sitting in `price`, untouched, and the card goes back to quoting it.
--  Raising the standing rate later is then an ordinary edit of `price`, whether
--  or not a promo happens to be on at the time.
--
--  WHY THE FLAG IS SEPARATE FROM THE NUMBER
--  ----------------------------------------
--  A promo that ends by blanking promo_price loses the number, so next weekend's
--  repeat of the same promo has to be typed again. The flag keeps the two
--  questions apart: what the promo price is, and whether it is on right now.
--
--  Nothing is seeded. Every existing rate keeps its price and starts with no
--  promo, so applying this changes nothing a guest is quoted.
-- ============================================================================

alter table public.accommodation_rates
    add column if not exists promo_price numeric(10,2);

alter table public.accommodation_rates
    add column if not exists promo_active boolean not null default false;

comment on column public.accommodation_rates.price is
    'The standing rate. Never overwritten by a promo — see promo_price.';
comment on column public.accommodation_rates.promo_price is
    'What the guest pays while promo_active is true. The standing price is struck through beside it.';
comment on column public.accommodation_rates.promo_active is
    'Whether the promo is running. Turning it off restores the standing rate without losing promo_price.';

-- A negative promo would pay the guest, and a promo that is not below the
-- standing rate is not a promo — the card would strike through a smaller
-- number. Both are refused here rather than only in the dashboard form, because
-- the rate table is also edited straight from the Supabase console.
alter table public.accommodation_rates
    drop constraint if exists accommodation_rates_promo_price_check;

alter table public.accommodation_rates
    add constraint accommodation_rates_promo_price_check
    check (promo_price is null or (promo_price >= 0 and promo_price < price));

-- A promo cannot be switched on without a price to switch on to.
alter table public.accommodation_rates
    drop constraint if exists accommodation_rates_promo_active_check;

alter table public.accommodation_rates
    add constraint accommodation_rates_promo_active_check
    check (promo_active is false or promo_price is not null);
