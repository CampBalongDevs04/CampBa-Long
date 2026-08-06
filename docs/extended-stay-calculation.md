# Extended stays — how the price is calculated

A guest can now book more than one night on a single reservation. This is what
that costs and why.

The arithmetic lives in one place, [`src/data/extendedStay.js`](../src/data/extendedStay.js).
The booking page builds one `computeStayQuote()` object per render; the summary
panel renders it and `reserve()` stores it, so the figure a guest is quoted and
the figure they are charged are the same object read twice.

---

## 1. The billable unit is the night

```
nights = check-out date − check-in date        (whole calendar days)
```

Check in **Thu Aug 6**, ask for **3 nights**, check out **Sun Aug 9**.

A same-day schedule (Day Time, 10:00–17:00) has no nights at all and always
bills as one block, so `nights` is forced to `1` there. A one-night overnight
stay also puts `nights = 1` through every formula below — which is the identity
case, so bookings taken before this feature existed price out unchanged.

**The calendar is the range picker.** Click the check-in date, click the
check-out date, and the days between light up as the stay. The nights stepper
beside it is a shortcut for the guest who thinks "a week" rather than "the
13th" — it holds no state of its own, reading the nights back out of the two
dates and writing a check-out date when used. The dates are the single source
of truth, which is also what the booking row stores, so the two controls cannot
drift apart.

---

## 2. Both sides of the rate card scale

A booking has exactly two charges, and a second night costs the resort a second
night of both — the unit is off the market, and the party is on-site using the
pool, the jacuzzi and the showers for another 22 hours.

```
unit total     = Σ (unit rate × quantity) × nights
entrance total = (one night's entrance for the whole party) × nights

stay total     = unit total + entrance total
down payment   = stay total × 50%
balance on-site= stay total − down payment
```

### The entrance side is "one night, multiplied"

This is deliberate. Everything `computeEntranceFee()` already decides —

* kids 7 & below are exempt,
* up to **2 non-kid heads** ride free (the rate card's resort inclusion; not on
  Tent Pitching, Cottage or Pavilion),
* remaining senior heads get **20% off**

— is decided **once, for one night, by the code that has always decided it**,
and the result is multiplied. So the perks scale *with* the stay: a party that
gets 2 free heads a night gets 2 free heads on each of 3 nights. That is the
same relationship the unit rate has to the stay — you pay it per night, you get
the inclusions per night.

> **This is a business rule, not a law of arithmetic.** If the resort would
> rather treat entrance as a one-time gate fee paid on arrival, flip
> `ENTRANCE_PER_NIGHT` to `false` in `src/data/extendedStay.js`. That single
> constant is the entire difference: every screen, the stored breakdown and the
> down payment follow from it with no further edits.

---

## 3. Worked example — Aug 6, 3 nights

**Thu Aug 6 → Sun Aug 9 · Day and Night (10:00 AM – 8:00 AM, 22 hrs)**
1 × A-House Small · 4 pax = 2 regular + 1 senior + 1 kid

### Accommodation

| | |
|---|---|
| A-House Small, overnight rate (standing; no promo running) | ₱2,250 / night |
| × 3 nights | **₱6,750.00** |

### Entrance fees

Per head, per night is **₱350** (both overnight schedules; Day Time is ₱150).
Over 3 nights, one full-fare head owes **₱350 × 3 = ₱1,050**.

| | |
|---|---|
| 4 guests × ₱1,050 | ₱4,200.00 |
| − free entrance, 1 kid (7 & below) × ₱1,050 | − ₱1,050.00 |
| − free entrance, 2 pax resort inclusion × ₱1,050 | − ₱2,100.00 |
| − senior discount, 20% × 1 remaining senior head × ₱1,050 | − ₱210.00 |
| **Entrance subtotal** (₱280 for one night, × 3) | **₱840.00** |

Only one head is actually paying: the kid is free, the 2-pax inclusion covers
both regular heads, and the senior pays ₱1,050 − ₱210 = ₱840.

### What the guest pays

| | |
|---|---|
| Stay subtotal | ₱6,750.00 + ₱840.00 = **₱7,590.00** |
| Down payment (50%, sent within 10 minutes of reserving) | **₱3,795.00** |
| Balance on-site at check-in | ₱3,795.00 |

The same stay stretched to a week (Aug 6 → Aug 13, 3 pax, no kids or seniors)
runs straight through Monday Aug 10 and comes to ₱2,250 × 7 = ₱15,750 plus
₱2,450 entrance = **₱18,200**, half of it — ₱9,100 — due on reservation.

> When a promo *is* running it does not replace the standing rate — it sits
> beside it, and `effectiveRatePrice()` is what every screen asks for the number
> to charge. Slot the promo price in wherever ₱2,250 appears above and nothing
> else about the arithmetic changes.

Order food or spa before paying and their 50% joins that figure — the database's
generated `downpayment` column is `50% × (price + entrance_total + food + spa)`,
so it picks the extra nights up on its own.

---

## 4. How long a stay may be

**As long as the guest wants.** Pick Aug 6, pick Aug 9 — that is the stay. Pick
Aug 13 instead and it is a week. There is no short cap; a fortnight is a
supported booking.

The resort's Monday maintenance day bounds the **ends** of a stay, not its
length:

```
check-in  may not be a Monday
check-out may not be a Monday
every day in between may be anything
```

Nobody arrives or departs on maintenance day — that is what the closure is
about, turnover and cleaning — but a guest already on-site simply stays through
it. This distinction is what makes a week-long booking possible at all: any
seven-night stay necessarily covers a Monday. On the calendar those Mondays stay
unselectable while remaining highlighted inside the range, which reads exactly
right — you pass through it, you cannot start or end on it.

Two consequences worth knowing:

* **A Sunday check-in stays at least 2 nights**, because one night would check
  out on the Monday. `minNightsFrom()` is the rule. Sunday arrivals are no
  longer forced to Day Time — that restriction only existed because the sole
  overnight stay they could make ended on a Monday.
* **The nights stepper steps *over* a Monday.** From a Thursday, `+` goes
  3 → 5 nights (Sunday → Tuesday), skipping the Monday check-out; `−` goes
  5 → 3, nudging the way you were already moving so the number never bounces
  back. The quick-pick chips only appear when they deliver exactly their label,
  so "1 night" is simply absent on a Sunday.

`MAX_STAY_NIGHTS` (30) exists so an unbounded date picker cannot take a unit off
the market for a year. It is a guardrail, not a product rule — raise it freely.

---

## 5. What is stored on the booking

Every money field on a booking row is a **whole-stay** figure:

| Column | For the 4-pax example above |
|---|---|
| `price` | `6750` — the nightly rate already multiplied by the nights |
| `entrance_total` | `840` |
| `entrance_per_head` | `1050` — **what one full-fare head owes for the STAY**, not per night |
| `entrance_free_applied` | `3` — a head **count**, never scaled |
| `entrance_free_savings` | `3150` = 3 heads × ₱1,050 |
| `entrance_senior_discount` | `210` |
| `downpayment` | `3795.00` — generated, never written |
| `nights` | `3` — generated from the dates |

`entrance_per_head` being a whole-stay figure is the part worth remembering. It
is what keeps the stored breakdown self-consistent: `splitFreeEntrance()` in
`entranceFee.js` recovers the kids/perk split by multiplying the head **counts**
by that per-head figure, so it lands on the stay's savings rather than one
night's — with no change to that function at all. Screens that show it
(My Bookings, the payment panel, the receipt image) say how many nights it
covers, so `₱1,050/head` is never read against a `₱350` rate card.

For a combined reservation (2+ units, `booking_groups`), each member unit is
stored at its own whole-stay price and `unit_subtotal` is their sum — so the
group total picks up the nights without `book_stay_group()` needing to know
about them.

---

## 6. What the database asserts

`supabase/migrations/20260806120000_extended_stays.sql` adds two things:

1. **`nights`** on `bookings` and `booking_groups` — a generated column,
   `greatest(check_out_date - check_in_date, 1)`, so it can never disagree with
   the dates the occupancy window was built from.
2. **A maintenance-day guard** — `stay_ends_on_maintenance_day()` plus a CHECK
   constraint, so a stay that would *start or finish* on a Monday is refused by
   the database and not only by the booking form. A Monday **inside** the stay
   is explicitly allowed; forbidding it would make a week-long booking
   impossible. Added `NOT VALID`: it binds every write from here on without
   scanning rows already in the table.

Nothing about occupancy changed. `occupancy_window()` has always run from the
check-in day's start hour to the check-out day's end hour, so Aug 6 → Aug 9 on
Day and Night was already one continuous hold from 10:00 on the 6th to 08:00 on
the 9th, protected by the same GiST exclusion constraint as every other booking.
Only the money was missing.

### Known gap

`price` and `entrance_total` still arrive from the client and are stored as
sent — the trust model this schema has always had, not something extended stays
introduced. The robust follow-up is to have `book_stay()` recompute the price
from `accommodation_rates × nights` server-side (promo logic included) and
ignore `p_price` entirely. That is a larger change to a function the group path
also calls, so it is called out here rather than done quietly.
