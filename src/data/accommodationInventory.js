// Shared hardcoded accommodation inventory — single source of truth for the
// admin dashboard, the home-page accommodations carousel, and the booking
// page. Replace the hardcoded bookings with Supabase queries later.
//
// Availability is DATE-BASED: a unit is only "taken" on days covered by one
// of its bookings, so a tent booked this weekend is free again on Monday.
//
// `id` matches the ids used by the user-facing pages ('table', 'tent', ...);
// `prefix` is used to generate the unique unit IDs (TBL-01, TENT-02, ...).
export const ACCOMMODATION_TYPES = [
    {
        id: 'table',
        name: "Table",
        prefix: "TBL",
        total: 10,
        image: null,
    },
    {
        id: 'tent',
        name: "Camping Tent",
        prefix: "TENT",
        total: 10,
        image: null,
    },
    {
        id: 'small',
        name: "A-House Small",
        prefix: "AHS",
        total: 2,
        image: null,
    },
    {
        id: 'medium',
        name: "A-House Medium",
        prefix: "AHM",
        total: 4,
        image: null,
    },
    {
        id: 'large',
        name: "A-House Large",
        prefix: "AHL",
        total: 2,
        image: null,
    },
    {
        id: 'pavilion',
        name: "Pavillion",
        prefix: "PAV",
        total: 1,
        image: null,
    },
]

// ---------- Date helpers ----------
// All dates are handled at LOCAL midnight to avoid timezone surprises.
// Check-out day is exclusive: a unit checked out on Jul 18 can be
// checked in again on Jul 18 (standard same-day turnover).

const DAY_MS = 24 * 60 * 60 * 1000

// Accepts a Date or a 'YYYY-MM-DD' string; returns ms at local midnight.
function normalizeDate(value) {
    if (value instanceof Date) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
    }
    const [year, month, day] = String(value).split('-').map(Number)
    return new Date(year, month - 1, day).getTime()
}

// Formats a Date (or 'YYYY-MM-DD') as 'YYYY-MM-DD' in LOCAL time.
export function toISODate(value) {
    const date = new Date(normalizeDate(value))
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${month}-${day}`
}

// Short display form, e.g. 'Jul 21'.
export function formatShortDate(value) {
    return new Date(normalizeDate(value)).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    })
}

// 'YYYY-MM-DD' for N days from today — used to keep the demo bookings
// below anchored around the current date whenever the app runs.
function isoDaysFromToday(days) {
    return toISODate(new Date(Date.now() + days * DAY_MS))
}

// ---------- Hardcoded bookings (demo data) ----------
// Later this becomes the Supabase `bookings` table:
//   unit_id | check_in | check_out | status ('booked' = paid, 'pending' = waiting for payment)
export const UNIT_BOOKINGS = [
    { unitId: 'TBL-03',  checkIn: isoDaysFromToday(0),  checkOut: isoDaysFromToday(1), status: 'booked' },
    //{ unitId: 'TBL-05',  checkIn: isoDaysFromToday(0),  checkOut: isoDaysFromToday(2), status: 'pending' },
   // { unitId: 'TENT-07', checkIn: isoDaysFromToday(-1), checkOut: isoDaysFromToday(3), status: 'booked' },
    //{ unitId: 'AHM-02',  checkIn: isoDaysFromToday(1),  checkOut: isoDaysFromToday(4), status: 'booked' },
    //{ unitId: 'AHS-01',  checkIn: isoDaysFromToday(0),  checkOut: isoDaysFromToday(1), status: 'pending' },
    //{ unitId: 'AHS-02',  checkIn: isoDaysFromToday(0),  checkOut: isoDaysFromToday(5), status: 'booked' },
    //{ unitId: 'AHL-02',  checkIn: isoDaysFromToday(0),  checkOut: isoDaysFromToday(1), status: 'pending' },
    //{ unitId: 'PAV-01',  checkIn: isoDaysFromToday(0),  checkOut: isoDaysFromToday(1), status: 'pending' },
]

// A day-visit (checkOut missing or same as checkIn) still occupies one day.
function rangeEnd(startMs, checkOut) {
    if (checkOut == null) return startMs + DAY_MS
    const endMs = normalizeDate(checkOut)
    return endMs > startMs ? endMs : startMs + DAY_MS
}

// ---------- Availability ----------

// Status of one unit for a stay. Defaults to today when no dates are given.
// 'booked' wins over 'pending' when multiple bookings overlap the stay.
export function getUnitStatus(unitId, checkIn = new Date(), checkOut = null) {
    const start = normalizeDate(checkIn)
    const end = rangeEnd(start, checkOut)

    let status = 'available'
    for (const booking of UNIT_BOOKINGS) {
        if (booking.unitId !== unitId) continue
        const bookingStart = normalizeDate(booking.checkIn)
        const bookingEnd = rangeEnd(bookingStart, booking.checkOut)
        if (start < bookingEnd && end > bookingStart) {
            if (booking.status === 'booked') return 'booked'
            status = 'pending'
        }
    }
    return status
}

// Accepts either the type id ('tent') or the unit prefix ('TENT').
export function findAccommodationType(idOrPrefix) {
    return ACCOMMODATION_TYPES.find(
        (type) => type.id === idOrPrefix || type.prefix === idOrPrefix,
    ) ?? null
}

export function buildUnits(type, checkIn = new Date(), checkOut = null) {
    return Array.from({ length: type.total }, (_, index) => {
        const id = `${type.prefix}-${String(index + 1).padStart(2, '0')}`
        return {
            id,
            status: getUnitStatus(id, checkIn, checkOut),
        }
    })
}

// How many units of a type are free for a stay (not booked, not waiting
// for payment). Returns { available, total }, or null for an unknown type.
export function getAvailability(idOrPrefix, checkIn = new Date(), checkOut = null) {
    const type = findAccommodationType(idOrPrefix)
    if (!type) return null
    const available = buildUnits(type, checkIn, checkOut)
        .filter((unit) => unit.status === 'available')
        .length
    return { available, total: type.total }
}

// First day (from `from`, scanning up to `maxDays` ahead) on which the type
// has at least one free unit. Returns a Date, or null if nothing frees up.
export function getNextAvailableDate(idOrPrefix, from = new Date(), maxDays = 60) {
    const type = findAccommodationType(idOrPrefix)
    if (!type) return null

    const startMs = normalizeDate(from)
    for (let offset = 0; offset <= maxDays; offset++) {
        const day = new Date(startMs + offset * DAY_MS)
        const { available } = getAvailability(idOrPrefix, day)
        if (available > 0) return day
    }
    return null
}

// Call this from the booking flow when a customer books a type for a stay.
// It picks a random unit among the ones free for those dates. Returns the
// assigned unit ID (save it with the booking and add it to UNIT_BOOKINGS /
// the bookings table), or null when the type is fully taken for those dates.
export function assignRandomAvailableUnit(idOrPrefix, checkIn = new Date(), checkOut = null) {
    const type = findAccommodationType(idOrPrefix)
    if (!type) return null

    const availableUnits = buildUnits(type, checkIn, checkOut)
        .filter((unit) => unit.status === 'available')
    if (availableUnits.length === 0) return null

    const randomIndex = Math.floor(Math.random() * availableUnits.length)
    return availableUnits[randomIndex].id
}
