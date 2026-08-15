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
// As long as the guest wants, up to the next maintenance day. A stay may not
// include one at all — not at the ends, not in the middle:
//
//     check-in  may not fall on a maintenance day
//     check-out may not fall on a maintenance day
//     no day in between may be one either
//
// The resort closes for turnover and cleaning, and nobody is on-site while
// that happens — a guest already checked in has to be checked out before it,
// not staying through it. Practically, that means the closure caps the length
// of a stay: check in Wed the 12th with Monday the 17th closed, and the
// longest stay on offer checks out Sun the 16th (4 nights), not Tue the 18th.
//
// This does put a week-long stay out of reach WHILE a weekly closure is
// running — any seven nights necessarily cover one. That trade was made on
// purpose: WHICH days are closed is a setting, not a constant
// (data/maintenanceDays.js owns it, weekly pattern and one-off dates both), so
// staff can lift or move the closure from the dashboard for a stretch they
// know a longer stay is wanted over — a holiday week, a private event — rather
// than the system quietly allowing guests to occupy a unit while it is being
// serviced.
//
// This module asks maintenanceDays.js one question, isMaintenanceDay(), and
// everything below is written for a RUN of closed days rather than a single
// one: stayTouchesMaintenanceDay() walks every day of the candidate range
// rather than only checking the two ends.
//
// MAX_STAY_NIGHTS below is a guardrail against a mis-click holding the last
// A-House for a year, not a product rule. Raise it freely.
import { DOWNPAYMENT_RATE } from './accommodationDB.js'
import { computeEntranceFee, DEFAULT_FREE_ENTRANCE_QUOTA } from './entranceFee.js'
import { isMaintenanceDate, isMaintenanceDow } from './maintenanceDays.js'

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

// Closed either because of the weekly pattern, or because this exact date was
// closed by hand. One question, one answer — every rule below is built on this
// and none of them has to know which kind of closure it ran into.
export function isMaintenanceDay(value) {
    const date = startOfDay(value)
    if (date == null) return false
    return isMaintenanceDow(date.getDay()) || isMaintenanceDate(date)
}

// The first maintenance day inside [checkIn, checkOut], inclusive of both
// ends — the one day, if any, that a candidate stay is blocked BY. Walking to
// MAX_STAY_NIGHTS rather than stopping at a week matters for one-off closures,
// which are not bounded by the week: the 8th through the 20th closed for a
// rebuild is thirteen closed days in a row.
//
// checkOut defaults to checkIn so a one-argument call answers "is this single
// date closed", the same question isMaintenanceDay() answers — this is the
// range version of it.
export function firstMaintenanceDayInRange(checkIn, checkOut) {
    const start = startOfDay(checkIn)
    if (!start) return null
    const end = startOfDay(checkOut) ?? start
    const nights = Math.max(0, Math.min(countNights(start, end), MAX_STAY_NIGHTS + 1))
    for (let step = 0; step <= nights; step += 1) {
        const day = addDays(start, step)
        if (isMaintenanceDay(day)) return day
    }
    return null
}

// Would this stay include a maintenance day anywhere along it — at check-in,
// at check-out, or on a night in between? The SQL twin is
// stay_touches_maintenance_day() in the Supabase migrations.
export function stayTouchesMaintenanceDay(checkIn, checkOut) {
    return firstMaintenanceDayInRange(checkIn, checkOut) != null
}

// The shortest stay that can start on this date — always 1 night, since a
// range only grows as nights increase and never sheds a maintenance day once
// one has entered it. So the moment the smallest possible stay, [checkIn,
// checkIn+1], touches one, EVERY longer stay from the same check-in touches it
// too: there is no minimum long enough to walk past a closure the way there
// used to be. `null` means exactly that — no legal check-out exists from this
// date at all — which is what the calendar already keeps a guest from picking
// (a check-in the day before a closure never offers only overnight, only Day
// Time; see TimeSelector).
export function minNightsFrom(checkIn) {
    const start = startOfDay(checkIn)
    if (!start) return null
    return stayTouchesMaintenanceDay(start, addDays(start, 1)) ? null : 1
}

// The longest stay the pickers offer from this date, or null alongside
// minNightsFrom() when there is no legal stay from here at all. Pulled back
// night by night from the guardrail until the range no longer touches a
// maintenance day — MAX_STAY_NIGHTS if the resort has that many consecutive
// open days ahead, fewer the moment a closure sits inside the window.
export function maxNightsFrom(checkIn) {
    const start = startOfDay(checkIn)
    if (!start) return null
    const floor = minNightsFrom(start)
    if (floor == null) return null
    for (let nights = MAX_STAY_NIGHTS; nights > floor; nights -= 1) {
        if (!stayTouchesMaintenanceDay(start, addDays(start, nights))) return nights
    }
    return floor
}

// Can the guest actually check out on this date? Strictly after the check-in,
// inside the guardrail, and the whole range clear of maintenance days — not
// just the two ends. The one place that question is answered — the calendar
// disables cells with it and the nights stepper's quick-picks filter with it,
// so the two can never offer different dates.
export function isSelectableCheckOut(checkIn, candidate) {
    const start = startOfDay(checkIn)
    const date = startOfDay(candidate)
    if (!start || !date) return false
    const nights = countNights(start, date)
    return nights >= 1 && nights <= MAX_STAY_NIGHTS && !stayTouchesMaintenanceDay(start, date)
}

// The check-out date for a requested number of nights, clamped into
// [minNightsFrom, maxNightsFrom]. No nudging off a blocked value is needed
// here the way it once was: every night count inside that range is already
// clear of maintenance days, by construction of maxNightsFrom() above, so the
// clamp alone always lands on a legal date. `null` when there is no legal
// stay from this check-in at all.
export function checkOutForNights(checkIn, nights) {
    const start = startOfDay(checkIn)
    if (!start) return null
    const min = minNightsFrom(start)
    if (min == null) return null
    const max = maxNightsFrom(start)
    const want = Math.min(max, Math.max(min, Math.max(1, Math.round(Number(nights) || 1))))
    return addDays(start, want)
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
    freeQuota = DEFAULT_FREE_ENTRANCE_QUOTA,
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
        freeQuota,
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
