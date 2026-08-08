// EXTENDED STAYS — one reservation that runs for more than one night
// ===================================================================
// A stay schedule (STAY_SCHEDULES in accommodationDB.js) describes ONE block of
// hours: Day Time is 10:00→17:00, Day-and-Night 10:00→08:00 the next morning.
// The occupancy model has always been able to hold a unit across several days —
// occupancyWindow() runs from the check-in day's start hour to the check-out
// day's end hour, so "Aug 6 → Aug 9, Day and Night" already holds the unit from
// 10:00 on the 6th to 08:00 on the 9th, one continuous range.
//
// What was missing is the MONEY. `price` was the rate card's single-block
// figure whatever the range, and entrance was charged once, so a three-night
// stay was quoted at one night's rate: ₱2,250 + ₱350/head for what should be
// ₱6,750 + ₱1,050/head. This module is the arithmetic that was missing.
//
// THE BILLABLE UNIT IS THE NIGHT
// ------------------------------
// A stay is charged per NIGHT, where one night is one turn of the schedule the
// guest picked:
//
//     nights = check-out date − check-in date          (whole calendar days)
//
// Aug 6 → Aug 9 is 3 nights, and the guest leaves on the morning of the 9th.
// A same-day schedule (Day Time) has no nights at all and always bills as a
// single block, so nights is forced to 1 there — the rate card's day rate is
// the whole charge, exactly as before.
//
// A one-night stay puts nights = 1 through every formula below, which is
// identity: bookings taken before extended stays existed price out unchanged.
//
// BOTH SIDES OF THE RATE CARD SCALE
// ---------------------------------
// The two charges on a booking are the unit rate and the entrance fee, and a
// second night costs the resort a second night of both — the unit is off the
// market and the party is on-site using the pool, the jacuzzi and the showers
// for another 22 hours. So both are per-night:
//
//     unit total     = Σ (unit rate × quantity) × nights
//     entrance total = (one night's entrance for the party) × nights
//
// The entrance side is deliberately "one night's entrance, multiplied" rather
// than a separate multi-night formula. Everything computeEntranceFee() already
// decides — kids 7 & below free, the 2-pax resort inclusion (the senior
// discount is the resort's to give in person, not this system's) —
// is decided once, for one night, by the code that has always decided it, and
// the result is scaled. That means the perks scale WITH the stay: a party that
// gets 2 free heads a night gets 2 free heads on each of the 3 nights, which is
// the same relationship the unit rate has to the stay (you pay it per night,
// you get the inclusions per night). See ENTRANCE_PER_NIGHT below for the one
// line to change if the resort would rather charge entrance once on arrival.
//
// HOW LONG A STAY MAY BE
// ----------------------
// As long as the guest wants, up to the next maintenance day. A week is a
// normal holiday and the calendar lets them pick it: choose Aug 6, choose
// Aug 9, that is the stay — as long as nothing in between is closed.
//
// A stay may not run through a maintenance day. Running one through used to be
// the plan (a guest already on-site just stays through the closure), but that
// path is broken further down the booking flow, so for now the rule is
// simpler and enforced up front instead:
//
//     check-in  may not fall on a maintenance day
//     check-out may not fall on a maintenance day
//     no day of the stay may fall on one either
//
// WHICH days those are is a setting, not a constant — the resort closes Monday
// today, Monday and Tuesday next month. data/maintenanceDays.js owns it and
// this module asks. maxNightsFrom() walks forward from check-in and stops at
// the night before the first closed day it finds, so the nights stepper, the
// quick-pick chips and the check-out calendar can never offer a range that
// crosses one.
//
// MAX_STAY_NIGHTS below is a guardrail against a mis-click holding the last
// A-House for a year, not a product rule. Raise it freely.
import { DOWNPAYMENT_RATE } from './accommodationDB.js'
import { computeEntranceFee } from './entranceFee.js'
import { isMaintenanceDow } from './maintenanceDays.js'

// A week has seven days and the database refuses to close all of them, so any
// walk looking for the next open day finds one inside this many steps. It is
// the loop bound everywhere below — no walk here can run away.
const DAYS_IN_WEEK = 7

// The longest stay the date pickers will offer. Deliberately generous: it is
// here so an unbounded calendar cannot be used to take a unit off the market
// indefinitely, and it should never be the thing a real guest runs into.
export const MAX_STAY_NIGHTS = 30

// Is entrance charged for every night of the stay, or once on arrival?
//
// Per night is the default because that is what the rest of the rate card does
// — a second night is a second night of everything the fee covers, and the
// "free entrance for 2 pax" inclusion is worded per stay-schedule block. If the
// resort decides entrance is a one-time gate fee instead, flip this to false:
// the whole difference is that one multiplication, and every screen, the stored
// breakdown and the down payment follow from it without further edits.
export const ENTRANCE_PER_NIGHT = true

const DAY_MS = 24 * 60 * 60 * 1000

// Local midnight, so a Date from the calendar widget and a 'YYYY-MM-DD' string
// land on the same day. Same convention as accommodationDB.js — the resort and
// its guests share one timezone.
export function startOfDay(value) {
    if (value == null) return null
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(value, days) {
    const start = startOfDay(value)
    if (!start) return null
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + days)
}

// Whole calendar days between the two dates. Counted from local midnights
// rather than by subtracting the timestamps, so a DST shift inside the range
// cannot turn 3 nights into 2.96 and round the wrong way.
export function countNights(checkIn, checkOut) {
    const start = startOfDay(checkIn)
    const end = startOfDay(checkOut)
    if (!start || !end) return 0
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS))
}

export function isMaintenanceDay(value) {
    const date = startOfDay(value)
    return date != null && isMaintenanceDow(date.getDay())
}

// Can an overnight stay even start on this date? Kept as a night count rather
// than a bool because every call site already reads it that way, but a stay
// can no longer run through a closure to earn a longer answer — the only
// values this returns now are 1 (fine) or 2 (the very next day is closed, so
// no overnight schedule is offered here at all; see TimeSelector).
export function minNightsFrom(checkIn) {
    const start = startOfDay(checkIn)
    if (!start) return 1
    return isMaintenanceDay(addDays(start, 1)) ? 2 : 1
}

// The first maintenance day strictly after this check-in, within the
// MAX_STAY_NIGHTS guardrail. Null if the resort has nothing closed that far
// out — there is then no closure to bound the stay.
export function nextClosureAfter(checkIn) {
    const start = startOfDay(checkIn)
    if (!start) return null
    for (let nights = 1; nights <= MAX_STAY_NIGHTS; nights += 1) {
        const candidate = addDays(start, nights)
        if (isMaintenanceDay(candidate)) return candidate
    }
    return null
}

// The longest stay the pickers offer from this date: every night up to, but
// not including, the next maintenance day. A hard ceiling rather than
// something nudged past, since a stay may not run through a closure any more
// (see the header above). Falls back to the guardrail when nothing is closed
// within it.
export function maxNightsFrom(checkIn) {
    const closure = nextClosureAfter(checkIn)
    if (!closure) return MAX_STAY_NIGHTS
    return Math.max(0, countNights(checkIn, closure) - 1)
}

// The check-out date for a requested number of nights, clamped to what's
// actually available rather than refused outright: a guest asking for 7
// nights when only 5 fit before the next closure gets 5, the most they can
// actually book without crossing it. `direction` is which way the guest was
// moving — kept so a value landing outside [min, max] settles on the end it
// overshot rather than always snapping to the same one.
export function checkOutForNights(checkIn, nights, direction = 1) {
    const start = startOfDay(checkIn)
    if (!start) return null
    const step = direction < 0 ? -1 : 1
    let want = Math.max(1, Math.round(Number(nights) || 1))

    // A closure is at most six days long, so six nudges clear the longest run
    // there can be; the spare iterations are for the clamp bouncing the value
    // back inside [min, max] after a nudge overshoots one end.
    for (let guard = 0; guard < DAYS_IN_WEEK + 3; guard += 1) {
        const min = minNightsFrom(start)
        const max = maxNightsFrom(start)
        want = Math.min(max, Math.max(min, want))
        const candidate = addDays(start, want)
        if (!isMaintenanceDay(candidate)) return candidate
        want += step
    }
    return addDays(start, Math.max(minNightsFrom(start), want))
}

// How many nights this booking is actually BILLED for.
//
// A same-day schedule is one block however the dates read — Day Time cannot run
// past 17:00 — and an overnight schedule with no check-out yet is quoted as the
// single night it will be at minimum, so the summary shows a real figure while
// the guest is still picking. Never returns 0: every booking bills at least one
// block, and a 0 here would quietly quote the whole stay as free.
export function billableNights({ schedule = null, checkIn = null, checkOut = null } = {}) {
    if (schedule?.sameDay) return 1
    return Math.max(1, countNights(checkIn, checkOut))
}

// Scale one night's entrance breakdown up to the whole stay.
//
// The COUNTS stay as they are — 2 pax ride free, 1 kid is exempt; those are
// head counts, not per-night quantities, and freeApplied is stored on the
// booking as a head count that splitFreeEntrance() reads back.
//
// `perHead` becomes what one full-fare head owes FOR THE STAY (₱350 × 3 nights
// = ₱1,050), which is what keeps the stored breakdown self-consistent: every
// money field on it is a whole-stay figure, and splitFreeEntrance() recovering
// `kidsApplied × perHead` gets the stay's kids' saving rather than one night's.
function scaleEntrance(nightly, nights) {
    if (nights === 1) return nightly
    return {
        ...nightly,
        perHead: nightly.perHead * nights,
        paxTotal: nightly.paxTotal * nights,
        regularTotal: nightly.regularTotal * nights,
        seniorGross: nightly.seniorGross * nights,
        seniorDiscount: nightly.seniorDiscount * nights,
        seniorNet: nightly.seniorNet * nights,
        kidsFree: nightly.kidsFree * nights,
        perkSavings: nightly.perkSavings * nights,
        freeSavings: nightly.freeSavings * nights,
        total: nightly.total * nights,
    }
}

// Everything the booking page needs to quote, store and explain a stay.
//
// `cartLines` is the booking page's cart, already resolved against the chosen
// schedule's rates: [{ id, qty, option: { name, price, originalPrice } }].
// A line whose price has not loaded yet leaves every unit figure null (never
// 0), so a screen shows "Price TBA" instead of quoting a stay as free.
export function computeStayQuote({
    schedule = null,
    checkIn = null,
    checkOut = null,
    cartLines = [],
    pax = 0,
    kids = 0,
    seniors = 0,
    freeEntranceEligible = true,
    downpaymentRate = DOWNPAYMENT_RATE,
} = {}) {
    const nights = billableNights({ schedule, checkIn, checkOut })
    // Only an overnight schedule can run long; Day Time is always one block.
    const extendable = schedule != null && schedule.sameDay !== true
    // Has the guest actually SAID how long they are staying? `nights` is
    // clamped to 1 so the figures below are never zero, which would otherwise
    // let a summary present the minimum as though it had been chosen. An
    // overnight schedule needs a check-out strictly after the check-in; a
    // same-day one has nothing to choose.
    const lengthSet = !extendable
        ? schedule != null
        : countNights(checkIn, checkOut) >= 1

    // One night for the whole party, decided by the rules that have always
    // decided it, then multiplied out across the stay.
    const entranceNightly = computeEntranceFee({
        perHead: schedule?.entranceFee ?? 0,
        pax,
        seniors,
        kids,
        freeEntranceEligible,
    })
    const entranceNights = ENTRANCE_PER_NIGHT ? nights : 1
    const entrance = scaleEntrance(entranceNightly, entranceNights)

    const lines = cartLines.map((line) => {
        const nightly = line.option?.price ?? null
        const wasNightly = line.option?.originalPrice ?? null
        return {
            id: line.id,
            qty: line.qty,
            name: line.option?.name ?? 'Accommodation',
            // Per unit, per night — the number on the rate card.
            nightly,
            // Per unit, for the stay. What one unit of this type actually costs.
            perUnit: nightly != null ? nightly * nights : null,
            // This line's whole contribution: rate × quantity × nights.
            total: nightly != null ? nightly * line.qty * nights : null,
            // The struck-through standing rate, scaled the same way, so a promo
            // shown on the card is the promo applied to every night.
            wasNightly,
            wasTotal: wasNightly != null ? wasNightly * line.qty * nights : null,
        }
    })

    // Null, not 0, until every line has a price: a partial sum quoted as the
    // total is a wrong number, where "Price TBA" is an honest one.
    const priced = lines.length > 0 && lines.every((line) => line.nightly != null)
    const unitNightly = priced
        ? lines.reduce((sum, line) => sum + line.nightly * line.qty, 0)
        : null
    const unitTotal = unitNightly != null ? unitNightly * nights : null

    // What the promos across the cart take off, for the whole stay.
    const promoSavings = lines.reduce((sum, line) => {
        if (line.wasTotal == null || line.total == null) return sum
        return sum + (line.wasTotal - line.total)
    }, 0)

    const stayTotal = unitTotal != null ? unitTotal + entrance.total : null
    const downpayment = stayTotal != null ? round2(stayTotal * downpaymentRate) : null
    const balance = stayTotal != null ? round2(stayTotal - downpayment) : null

    return {
        nights,
        extendable,
        lengthSet,
        // True once the guest has actually extended past a single night, which
        // is what the screens key their extra "× N nights" columns off.
        isExtended: nights > 1,
        maxNights: extendable ? maxNightsFrom(checkIn) : 1,
        lines,
        unitNightly,
        unitTotal,
        promoSavings,
        // One night's breakdown, for a summary that wants to show the rate
        // being multiplied rather than only the product.
        entranceNightly,
        // The whole stay's breakdown — this is what gets stored on the booking.
        entrance,
        entranceNights,
        stayTotal,
        downpayment,
        balance,
    }
}

// Pesos, to the centavo. The database rounds `downpayment` to 2 the same way,
// so the figure quoted on the form is the figure My Bookings will ask for.
function round2(value) {
    return Math.round(value * 100) / 100
}
