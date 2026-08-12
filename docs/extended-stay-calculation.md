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
* senior heads are charged the **full rate** — see the note below

> **The system no longer discounts seniors.** The resort gives that discount at
> the front desk, against the Senior Citizen ID the guest presents on arrival, so
> quoting a reduced figure online would promise something this system is not the
> one granting — and would double it if the desk then applied its own. The senior
> **count** still travels on the booking, the receipt and the admin list, because
> the desk cannot give a discount it cannot see. `SENIOR_DISCOUNT_RATE` is `0`;
> set it back above zero and every screen resumes showing and charging one.

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
| **Entrance subtotal** (₱350 for one night, × 3) | **₱1,050.00** |

Only one head is actually paying: the kid is free and the 2-pax inclusion covers
both regular heads, leaving the senior — charged the full ₱1,050 here, with the
senior discount taken off at the resort against their ID.

### What the guest pays

| | |
|---|---|
| Stay subtotal | ₱6,750.00 + ₱1,050.00 = **₱7,800.00** |
| Down payment (50%, sent within 10 minutes of reserving) | **₱3,900.00** |
| Balance on-site at check-in | ₱3,900.00, less any senior discount the desk applies |

The same math scales to any length the calendar allows — but not to a week
from *this* check-in. Thu Aug 6 is already as long a stay as the calendar
offers before Monday Aug 10 closes the resort: 3 nights, checking out Sun Aug
9, is the ceiling. A week-long stay is still bookable, just not from a
Thursday while Monday closes weekly — see §4 for why, and how staff can lift
that for a stretch where a longer stay is wanted.

> When a promo *is* running it does not replace the standing rate — it sits
> beside it, and `effectiveRatePrice()` is what every screen asks for the number
> to charge. Slot the promo price in wherever ₱2,250 appears above and nothing
> else about the arithmetic changes.

Order food or spa before paying and their 50% joins that figure — the database's
generated `downpayment` column is `50% × (price + entrance_total + food + spa)`,
so it picks the extra nights up on its own.

---

## 4. How long a stay may be

**As long as the guest wants, up to the next maintenance day.** Pick Aug 6,
pick Aug 9 — that is the stay, as long as nothing in between is closed. A
fortnight is a supported booking whenever a fortnight of open days is there to
book.

A stay may not include a maintenance day anywhere along it — not at the ends,
not in the middle:

```
check-in  may not be a maintenance day
check-out may not be a maintenance day
no night in between may be one either
```

Nobody is on-site while the resort is being serviced — that is what the
closure means — so a guest already checked in has to be checked out before it,
not staying through it. Concretely: check in Wed the 12th with Monday the 17th
closed, and the calendar's longest offer checks out Sun the 16th (4 nights),
not Tue the 18th. On the calendar, both panels grey out any date that would
put a maintenance day inside the range — the check-out panel included, which
is what actually shortens the stay as the check-in approaches a closure.

This does mean a week-long stay is out of reach *while a weekly closure is
running* — any seven nights necessarily cover it. That trade is deliberate:
WHICH days are closed is a setting (the dashboard's Maintenance tab, backed by
`public.maintenance_days`), not a constant, so staff can lift or move the
closure for a stretch they know a longer stay is wanted over — a holiday week,
a private event — rather than the system quietly letting a guest occupy a unit
while it is being cleaned.

Two consequences worth knowing:

* **A check-in the day before a closure has no overnight stay at all.** Even
  one night would check out into the closure, and every longer stay only adds
  days to a range that already fails — there is no minimum long enough to walk
  past it the way there briefly was. `minNightsFrom()` returns `null` for
  exactly this case, and TimeSelector greys out both overnight schedules for
  that check-in, leaving Day Time (no night to fail on) as the only option.
* **The nights stepper and quick-pick chips just stop early.** From a
  Wednesday with Monday closed four days out, `+` disables itself at 4 nights
  instead of stepping past the closure, and "1 week" simply does not appear as
  a chip — offered only when it delivers exactly what it says.

`MAX_STAY_NIGHTS` (30) exists so an unbounded date picker cannot take a unit off
the market for a year. It is a guardrail, not a product rule — raise it freely.
It is independent of the maintenance cap above: whichever limit is tighter for
a given check-in is the one the guest actually runs into.

---

## 5. What is stored on the booking

Every money field on a booking row is a **whole-stay** figure:

| Column | For the 4-pax example above |
|---|---|
| `price` | `6750` — the nightly rate already multiplied by the nights |
| `entrance_total` | `1050` |
| `entrance_per_head` | `1050` — **what one full-fare head owes for the STAY**, not per night |
| `entrance_free_applied` | `3` — a head **count**, never scaled |
| `entrance_free_savings` | `3150` = 3 heads × ₱1,050 |
| `entrance_senior_discount` | `0` — the resort's to give, not this system's |
| `downpayment` | `3900.00` — generated, never written |
| `nights` | `3` — generated from the dates |
| `seniors` | `1` — kept so the front desk can apply the discount in person |

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

`supabase/migrations/20260806120000_extended_stays.sql` adds **`nights`** on
`bookings` and `booking_groups` — a generated column,
`greatest(check_out_date - check_in_date, 1)`, so it can never disagree with
the dates the occupancy window was built from.

The maintenance-day guard has moved twice since. It started as a CHECK
constraint restricted to a hardcoded Monday; `20260808220000_maintenance_days`
turned the closure into a setting (`public.maintenance_days`) and moved the
rule into a BEFORE trigger, because a CHECK constraint may only call an
IMMUTABLE function and a setting has to be read from a table. As of
`20260812120000_maintenance_day_full_stay.sql`, the trigger
(`reject_maintenance_day_touch()`, firing on `bookings` and `booking_groups`)
refuses a stay whose check-in, check-out, **or any night in between** falls on
a maintenance day — `stay_touches_maintenance_day()` walks the whole range,
not just the two ends. This is the server-side twin of §4 above, and of
`stayTouchesMaintenanceDay()` in `src/data/extendedStay.js`: the same rule
enforced twice so nothing can reach the table by a path the booking form
didn't check.

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
