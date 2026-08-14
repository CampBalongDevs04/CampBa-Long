// ============================================================================
//  Camp Ba-long — Accommodation database  (Supabase: campBalongWeb)
// ----------------------------------------------------------------------------
//  ONE store for the whole app, now backed by Postgres. The client booking
//  flow writes to it, the admin dashboard reads the same rows, and the
//  no-double-booking rule is enforced by the database itself.
//
//  Tables (see supabase/migrations/20260727000000_accommodation.sql):
//
//    accommodation_types   — Teepee, A-House Small, Cottage, …  (+ how many)
//    accommodation_units   — the physical units: TPE-01, AHS-02, COT-01, …
//    stay_schedules        — Day Time / Day-and-Night / Night-and-Day windows
//    bookings              — a guest + a unit + an occupancy window
//
//  AVAILABILITY RULE
//  -----------------
//  A unit is unavailable when an existing booking's occupancy window overlaps
//  the one being asked about. The window is a real timestamp range, not just a
//  date, because the three stay schedules cover different hours of the day:
//
//    Day Time        10:00 → 17:00   (same calendar day)
//    Day and Night   10:00 → 08:00   (next morning)
//    Night and Day   20:00 → 18:00   (next evening)
//
//  So booking AHS-01 for Day Time on Jul 28 blocks it for Jul 28 daytime, but
//  leaves it free for a Night-and-Day stay starting 20:00 that same evening.
//  Ask without a schedule and the query falls back to whole calendar days,
//  which is the conservative answer.
//
//  WHY THE READ API IS STILL SYNCHRONOUS
//  -------------------------------------
//  Components call getAvailability() straight from render. Rather than make
//  every screen async, this module keeps a local cache and answers from it:
//
//    • a cache miss returns null — which the UI already renders as
//      "Availability TBA" — and kicks off the fetch;
//    • when the answer lands the cache fills and subscribers re-render.
//
//  Guests cannot read the bookings table (RLS), so type-level availability
//  always comes from the accommodation_availability() RPC, which is SECURITY
//  DEFINER and returns counts only — never anyone's name, email or receipt.
//  Staff sign in with Supabase Auth and additionally get the real rows, which
//  is what powers the per-unit hour breakdown and the bookings table.
//
//  WHOSE BOOKINGS ARE IN `bookings`
//  --------------------------------
//  Exactly one of two sets, never a mixture:
//
//    • a staff session holds every row, read straight from the table;
//    • everyone else holds the rows made by THIS browser, fetched with the
//      owner token from data/bookingOwner.js through my_bookings().
//
//  A guest cannot get anyone else's booking by asking differently, because the
//  database gives them nothing at all on the table — `anon` has no privilege on
//  public.bookings and no policy that grants one. Ownership, cancellation and
//  add-ons all go through SECURITY DEFINER functions that require the token.
//  See supabase/migrations/20260727090000_guest_booking_ownership.sql.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'
import { getOwnerToken, isOwnerTokenPersistent, forgetOwnerToken } from './bookingOwner.js'

// ---------------------------------------------------------------- constants

const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS

// Share of the WHOLE STAY collected upfront — unit rate, entrance fees and any
// food/spa add-ons — with the balance paid on-site. The database computes the
// figure itself (bookings.downpayment is a generated column), so this constant
// is only for quoting an amount on the booking form, before a row exists.
export const DOWNPAYMENT_RATE = 0.5

// How long a booking holds its unit before any money has been sent. The unit is
// reserved first now, which is right for the guest and would otherwise be free
// for anyone to abuse — an unpaid hold that never lapses takes the last A-House
// off the market indefinitely. Ten minutes is enough to open a banking app,
// send the down payment and screenshot it.
//
// This copy is for the countdown only. The deadline itself comes from Postgres
// (my_bookings().payment_due_at) and so does the enforcement, so a guest cannot
// buy themselves more time by changing this number or their device clock — see
// supabase/migrations/*_payment_window_expires.sql.
export const PAYMENT_WINDOW_MINUTES = 10

// Reason string Postgres stamps on a booking it cancelled for a lapsed window,
// as opposed to one a guest or staff member cancelled deliberately. The two
// look identical on the card otherwise, and they need to read very differently.
export const PAYMENT_TIMEOUT_REASON = 'payment-timeout'

// Receipt screenshots live in a PRIVATE storage bucket. Guests may upload but
// never read, so an image only comes back as a short-lived signed URL minted
// by a staff session — see supabase/migrations/*_receipt_storage.sql.
export const RECEIPT_BUCKET = 'receipts'

// Bookings taken before that bucket existed carry this marker in receipt_url
// instead of a storage path: a receipt was submitted, but no image was kept.
const RECEIPT_PENDING_MARKER = 'pending-upload'

// How long a signed receipt URL stays valid. Long enough for staff to open,
// zoom and compare it against the payment; short enough that a link pasted
// somewhere else is dead by the time anyone else finds it.
const RECEIPT_URL_TTL_SECONDS = 5 * 60

// Minutes to keep a unit off the market after check-out (cleaning/turnover).
// Applies to the local checks below; the database's own windows are exact.
export const TURNOVER_BUFFER_MINUTES = 0

// How long a cached availability count is trusted before it is quietly
// re-checked against the database.
//
// Guests browse anonymously, and Realtime honours RLS — an anonymous client
// cannot be told about bookings it isn't allowed to read, which is the correct
// privacy behaviour. So guest counts are kept fresh by revalidation instead:
// the cached number is shown immediately and refreshed in the background, and
// the screen updates if it changed. A stale count is never dangerous, because
// the actual reservation goes through book_accommodation(), which holds the
// unit under a database constraint — the worst case is a "just taken" message
// rather than a double booking.
const AVAILABILITY_TTL_MS = 30 * 1000

// ------------------------------------------------------- accommodation_types
// Seeded from the database on boot. The initial values match the seed rows so
// the first paint is correct; changing `total` in Postgres flows through here
// without a code change. Mutated IN PLACE so the const binding stays valid.
// `poolId` marks a type that books against ANOTHER type's physical units
// instead of its own — Small Tent, Big Tent and Tent Pitching are three
// products sold over the same 4 camping slots, not three separate
// inventories. Null means "its own units", which is every type but these.
export const ACCOMMODATION_TYPES = [
    { id: 'teepee', name: 'Teepee', prefix: 'TPE', total: 2, image: null, poolId: null },
    { id: 'small', name: 'A-House Small', prefix: 'AHS', total: 3, image: null, poolId: null },
    { id: 'medium', name: 'A-House Medium', prefix: 'AHM', total: 2, image: null, poolId: null },
    { id: 'family', name: 'A-House Family', prefix: 'AHF', total: 1, image: null, poolId: null },
    { id: 'tent-small', name: 'Small Tent', prefix: 'TENTS', total: 3, image: null, poolId: 'tent-small' },
    { id: 'tent-large', name: 'Big Tent', prefix: 'TENTL', total: 1, image: null, poolId: 'tent-small' },
    { id: 'tent-pitching', name: 'Tent Pitching', prefix: 'PITCH', total: 4, image: null, poolId: 'tent-small' },
    { id: 'cottage', name: 'Cottage', prefix: 'COT', total: 2, image: null, poolId: null },
    { id: 'pavilion', name: 'Pavillion', prefix: 'PAV', total: 1, image: null, poolId: null },
]

// ------------------------------------------------------------ stay_schedules
// Mirrors the stay_schedules table. timeSelector.jsx renders its cards from
// this list, and every occupancy window is derived from the two minute fields.
//
//   startMinutes — minutes past midnight ON THE CHECK-IN DAY
//   endMinutes   — minutes past midnight ON THE CHECK-OUT DAY
//                  (same day when `sameDay` is true)
export const STAY_SCHEDULES = [
    {
        key: 'day',
        checkIn: 'Day Time: ',
        time: '10:00 AM - 5:00 PM',
        description: '7 Hours',
        note: 'Check-in and check-out are set to 10:00 AM - 5:00 PM. To make the most of your stay, we recommend arriving on time.',
        entranceFee: 150,
        rateGroup: 'day',
        sameDay: true,
        startMinutes: 10 * 60,
        endMinutes: 17 * 60,
    },
    {
        key: 'day-night',
        checkIn: 'Day and night Time: ',
        time: '10:00 AM - 8:00 AM',
        description: '22 Hours',
        note: 'Check-in and check-out are set to 10:00 AM - 8:00 AM. To make the most of your stay, we recommend arriving early.',
        entranceFee: 350,
        rateGroup: 'overnight',
        sameDay: false,
        startMinutes: 10 * 60,
        endMinutes: 8 * 60,
    },
    {
        key: 'night-day',
        checkIn: 'Night and Day Time: ',
        time: '7:00 PM - 5:00 PM',
        description: '22 Hours',
        note: 'Check-in and check-out are set to 7:00 PM - 5:00 PM. To make the most of your stay, we recommend arriving early.',
        entranceFee: 350,
        rateGroup: 'overnight',
        sameDay: false,
        startMinutes: 20 * 60,
        endMinutes: 18 * 60,
    },
]

export function getSchedule(key) {
    if (key == null) return null
    return STAY_SCHEDULES.find((schedule) => schedule.key === key) ?? null
}

// Whether a same-day schedule's window has already ended for a check-in of
// TODAY specifically — Day Time greys out once it hits 5pm, the same way it
// already would tomorrow at 5pm. Exported so TimeSelector (greys the card)
// and booking.jsx (clears a stale selection when the check-in date changes
// out from under it) read one answer and can't drift apart.
//
// Only ever true for a sameDay schedule: an overnight one's window ends the
// NEXT day at the earliest, so "today" can never be past its end while
// check-in is still today.
export function isScheduleWindowElapsed(schedule, checkIn, now = new Date()) {
    if (!schedule || schedule.sameDay !== true || checkIn == null) return false
    if (checkIn.getFullYear() !== now.getFullYear()
        || checkIn.getMonth() !== now.getMonth()
        || checkIn.getDate() !== now.getDate()) {
        return false
    }
    const dayStart = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate())
    return now.getTime() >= dayStart.getTime() + schedule.endMinutes * 60000
}

// ------------------------------------------------------------- date helpers
// Everything is handled at LOCAL midnight so a 'YYYY-MM-DD' from an <input
// type="date"> and a Date from the calendar widget land on the same day. The
// resort and its guests share one timezone, which is the one Postgres uses
// too (resort_timezone() = Asia/Manila).

// Accepts a Date, a 'YYYY-MM-DD' string, or an ISO datetime string.
function normalizeDate(value) {
    if (value instanceof Date) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
    }
    const text = String(value)
    if (text.includes('T')) {
        const parsed = new Date(text)
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime()
    }
    const [year, month, day] = text.split('-').map(Number)
    return new Date(year, month - 1, day).getTime()
}

// 'YYYY-MM-DD' in LOCAL time.
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

// '10:00 AM' from a timestamp.
export function formatClock(ms) {
    return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// --------------------------------------------------------- occupancy window
// The JS twin of occupancy_window() in SQL. Both must agree, which is why the
// minute offsets live in one place (STAY_SCHEDULES / stay_schedules).
export function occupancyWindow({ checkIn, checkOut = null, scheduleKey = null }) {
    const schedule = getSchedule(scheduleKey)
    const startDay = normalizeDate(checkIn)

    if (!schedule) {
        const endDay = checkOut != null ? normalizeDate(checkOut) : startDay
        return {
            startsAt: startDay,
            endsAt: endDay > startDay ? endDay : startDay + DAY_MS,
        }
    }

    const endDay = schedule.sameDay || checkOut == null ? startDay : normalizeDate(checkOut)
    const startsAt = startDay + schedule.startMinutes * MINUTE_MS
    let endsAt = endDay + schedule.endMinutes * MINUTE_MS
    if (endsAt <= startsAt) endsAt = startsAt + DAY_MS
    return { startsAt, endsAt }
}

function overlaps(aStart, aEnd, bStart, bEnd) {
    const buffer = TURNOVER_BUFFER_MINUTES * MINUTE_MS
    return aStart < bEnd + buffer && aEnd + buffer > bStart
}

// ------------------------------------------------------------------- lookups

export function findAccommodationType(idOrPrefix) {
    return ACCOMMODATION_TYPES.find(
        (type) => type.id === idOrPrefix || type.prefix === idOrPrefix,
    ) ?? null
}

// A type sharing another's pool (Tent Pitching, sharing Small Tent's) owns no
// units of its own — the units returned here are whichever pool member the
// database actually assigned them to, unioned across every type in the pool.
export function listUnitIds(idOrPrefix) {
    const type = findAccommodationType(idOrPrefix)
    if (!type) return []
    const pool = type.poolId ?? type.id
    const members = ACCOMMODATION_TYPES.filter((t) => (t.poolId ?? t.id) === pool)
    const fromDb = members.flatMap((member) => unitsByType.get(member.id) ?? [])
    if (fromDb.length) return fromDb
    // Before the catalog lands: a type sharing another's pool owns nothing of
    // its own to derive, so it has nothing to show yet either.
    if (type.poolId && type.poolId !== type.id) return []
    return Array.from(
        { length: type.total },
        (_, index) => `${type.prefix}-${String(index + 1).padStart(2, '0')}`,
    )
}

export function findTypeForUnit(unitId) {
    return findAccommodationType(String(unitId).split('-')[0])
}

// ---------------------------------------------------------------- rate table
// One rate is (type, rate group): the same A-House costs 1450 for Day Time and
// 2250 overnight, and a type with no row for a group simply is not offered
// under it — that is how Cottage stays day-only and the tents overnight-only,
// without a second list saying so.

function rateKey(typeId, rateGroup) {
    return `${typeId}|${rateGroup}`
}

// True once Postgres has answered. False means "no rates known yet", which the
// booking page answers with its built-in card, not with an empty carousel.
export function hasAccommodationRates() {
    return ratesLoaded && ratesByKey.size > 0
}

export function findAccommodationRate(typeId, rateGroup) {
    return ratesByKey.get(rateKey(typeId, rateGroup)) ?? null
}

// What a guest is actually charged for one rate, promo or not. `price` on a
// rate is the STANDING price and stays put while a promo runs — ending the
// promo is a flag going false, not a price being typed back in — so every
// screen that quotes a number has to ask this rather than read `price`.
//
// A promo with no price on it is simply not running: the check constraint in
// *_accommodation_promo_price.sql refuses that pairing, and this agrees with it
// rather than quoting ₱0 if a row ever slipped through.
export function effectiveRatePrice(rate) {
    if (!rate) return null
    if (rate.promoActive && rate.promoPrice != null) return rate.promoPrice
    return rate.price
}

// The number to strike through beside the promo, or null when there is nothing
// to strike through — the rate is at its standing price.
export function strikethroughRatePrice(rate) {
    if (!rate) return null
    if (!rate.promoActive || rate.promoPrice == null) return null
    return rate.price > rate.promoPrice ? rate.price : null
}

export function listAccommodationRates(rateGroup = null) {
    const all = [...ratesByKey.values()]
    return rateGroup ? all.filter((rate) => rate.rateGroup === rateGroup) : all
}

// ===================================================================== store

// TWO different sets of rows, deliberately kept apart.
//
//   bookings    — every reservation in the resort. Only ever filled for a
//                 signed-in staff session; the admin dashboard reads this.
//   myBookings  — the reservations made by THIS browser, matched by owner
//                 token. My Bookings reads this, and reads ONLY this.
//
// These used to be one array whose meaning flipped with the session, which
// meant a staff member signed in on their own phone opened My Bookings and got
// every guest's name, email and payment. Being staff is a reason to see the
// admin board; it is never a reason for the guest page to show someone else's
// reservation. Keeping them apart is what makes that structurally impossible.
let bookings = []
let myBookings = []
// Combined reservations (2+ units booked together) — same owner/staff split
// as bookings/myBookings above, and for the same reason. See
// supabase/migrations/20260804000000_accommodation_booking_groups.sql.
let bookingGroups = []
let myBookingGroups = []
// Type-level availability answered by the database, keyed by the query.
const availabilityCache = new Map()
// Queries already in flight, so a re-render storm makes one request, not fifty.
const inFlight = new Set()
const nextFreeCache = new Map()
let unitsByType = new Map()
// Rates from accommodation_rates, keyed 'typeId|rateGroup'. Empty until the
// catalog lands, which is what data/accomodationOptions.js reads `ratesLoaded`
// for: with no answer yet it shows its built-in rate card rather than "Price
// TBA" on every unit.
let ratesByKey = new Map()
let ratesLoaded = false
let staffSession = false

// How far this device's clock is from the resort's, in milliseconds, measured
// from the `server_now` my_bookings() sends back with every fetch. A ten-minute
// window is short enough that a phone running four minutes fast would show a
// guest four minutes they do not have — or, worse, four they already spent.
// Every deadline is counted against serverNow() instead of Date.now() for that
// reason. Zero until the first fetch lands, which is simply "assume correct".
let clockSkewMs = 0

// The resort's clock as best this browser can tell. Only meaningful for
// comparing against timestamps that came from the database.
export function serverNow() {
    return Date.now() + clockSkewMs
}

// Fold a `server_now` from any RPC into the offset above. my_bookings() is not
// the only call that sends one — a guest waiting in the booking queue is
// watching a countdown without a booking of their own yet, and it has to be
// corrected against the same clock as everyone else's.
export function syncServerClock(serverTime) {
    if (!serverTime) return
    const stamped = new Date(serverTime).getTime()
    if (!Number.isNaN(stamped)) clockSkewMs = stamped - Date.now()
}

const listeners = new Set()

function notify() {
    for (const listener of listeners) listener()
}

export function subscribeBookings(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function getBookingsSnapshot() {
    return bookings
}

export function getMyBookingsSnapshot() {
    return myBookings
}

export function getBookingGroupsSnapshot() {
    return bookingGroups
}

export function getMyBookingGroupsSnapshot() {
    return myBookingGroups
}

// Subscribe an ADMIN screen to every booking. Returns nothing without a staff
// session, which is what makes the dashboard empty rather than wrong.
export function useAccommodationDB() {
    return useSyncExternalStore(subscribeBookings, getBookingsSnapshot)
}

// Subscribe a GUEST screen to this device's own bookings. Never returns
// anyone else's, staff session or not.
export function useMyBookings() {
    return useSyncExternalStore(subscribeBookings, getMyBookingsSnapshot)
}

// Same two-audience split as above, for combined (multi-unit) reservations.
export function useBookingGroups() {
    return useSyncExternalStore(subscribeBookings, getBookingGroupsSnapshot)
}

export function useMyBookingGroups() {
    return useSyncExternalStore(subscribeBookings, getMyBookingGroupsSnapshot)
}

// A new array identity is what tells useSyncExternalStore something changed.
function commit(next) {
    bookings = next
    notify()
}

function commitMine(next) {
    myBookings = next
    notify()
}

function commitGroups(next) {
    bookingGroups = next
    notify()
}

function commitMineGroups(next) {
    myBookingGroups = next
    notify()
}

function touch() {
    commit([...bookings])
}

function clearCaches() {
    availabilityCache.clear()
    nextFreeCache.clear()
}

// Every cached count is now wrong — a hold lapsed, or a queued guest took a
// unit. Exported for the booking queue, which learns that a unit came back
// before any screen would have re-checked on its own. The `touch()` is what
// makes the carousel actually re-render rather than sit on an empty cache.
export function invalidateAvailability() {
    clearCaches()
    touch()
}

// ---------------------------------------------------------------- row mapping
// Postgres row → the shape every screen in this app already expects.
function fromRow(row) {
    const schedule = getSchedule(row.schedule_key)
    return {
        id: row.id,
        code: row.code,
        status: row.status,

        accomodationId: row.type_id,
        accomodationName: findAccommodationType(row.type_id)?.name ?? row.type_id ?? 'Accommodation',
        accomodationPax: null,
        unitId: row.unit_id,
        // Set when this row is one unit of a combined reservation — present
        // only on the staff read (loadStaffBookings selects '*'); my_bookings()
        // no longer returns member rows to guests at all, so this is always
        // null there. Lets a screen that reads the FLAT bookings array (the
        // admin table) tell a member row apart from an ordinary one, without
        // that array losing the row entirely — occupancy (blockingBookings(),
        // the Units board) still needs every held unit in it, member or not.
        groupId: row.group_id ?? null,

        scheduleKey: row.schedule_key,
        checkInDate: row.check_in_date,
        checkOutDate: row.check_out_date,
        startsAt: new Date(row.starts_at).getTime(),
        endsAt: new Date(row.ends_at).getTime(),
        checkIn: row.starts_at,
        checkOut: row.ends_at,
        sameDayCheckout: schedule?.sameDay === true,
        schedule: schedule
            ? { checkIn: schedule.checkIn, time: schedule.time, description: schedule.description }
            : null,

        guest: {
            fullName: row.guest_name,
            email: row.guest_email ?? '',
            mobile: row.guest_mobile ?? '',
        },
        pax: row.pax,
        kids: row.kids ?? 0,
        seniors: row.seniors ?? 0,
        // Counted, never priced — the resort applies the PWD discount in person.
        pwd: row.pwd ?? 0,
        // The card renders every field of this breakdown, so all of them must
        // be numbers — a missing one used to throw inside formatPeso().
        entrance: {
            total: Number(row.entrance_total ?? 0),
            perHead: Number(row.entrance_per_head ?? 0),
            seniorDiscount: Number(row.entrance_senior_discount ?? 0),
            freeApplied: Number(row.entrance_free_applied ?? 0),
            freeSavings: Number(row.entrance_free_savings ?? 0),
        },

        price: row.price != null ? Number(row.price) : null,
        // 50% of the whole stay, computed by Postgres. Not a number this app
        // works out — see the generated column in
        // supabase/migrations/*_payment_after_booking.sql — so the amount a
        // guest is asked for and the amount staff verify cannot drift apart.
        downpayment: row.downpayment != null ? Number(row.downpayment) : null,
        total: row.price != null ? Number(row.price) : null,
        payment: row.payment,
        hasReceipt: Boolean(row.receipt_url),
        // Storage path of the uploaded image, or null when there is nothing to
        // show — no receipt at all, or one of the old marker-only rows. The
        // admin receipt viewer keys off this, not off hasReceipt.
        receiptPath:
            row.receipt_url && row.receipt_url !== RECEIPT_PENDING_MARKER
                ? row.receipt_url
                : null,

        foodOrders: row.food_orders ?? [],
        spaOrders: row.spa_orders ?? [],
        itemOrders: row.item_orders ?? [],
        addonsTotal: addonsTotal(row),
        // Everything this stay costs. The down payment is half of it and the
        // rest is settled on-site, so both figures come off this one number.
        stayTotal:
            Number(row.price ?? 0) +
            Number(row.entrance_total ?? 0) +
            addonsTotal(row),
        // What the guest has already sent proof for, and when. Guests get the
        // amounts only — the storage paths are staff-only, and my_bookings()
        // strips them before the rows ever leave Postgres.
        receipts: receiptList(row),
        paidSubmitted: receiptList(row).reduce((sum, entry) => sum + entry.amount, 0),
        createdAt: row.created_at,

        // Null when a booking was cancelled by hand, 'payment-timeout' when its
        // payment window lapsed. What lets My Bookings tell the guest which of
        // those happened instead of showing a bare "Cancelled".
        cancelReason: row.cancel_reason ?? null,
        // The moment the unit stops being held if nothing has been paid.
        // my_bookings() sends it; book_accommodation() and pay_my_booking()
        // return the raw row instead, so derive it from created_at there — the
        // same arithmetic Postgres does, on the same timestamp.
        paymentDueAt: paymentDueAt(row),
    }
}

// The deadline in epoch milliseconds, or null for a row with no created_at to
// count from (which cannot happen, but the payment panel reads this on every
// render and must not be the thing that throws).
function paymentDueAt(row) {
    if (row.payment_due_at) {
        const due = new Date(row.payment_due_at).getTime()
        if (!Number.isNaN(due)) return due
    }
    if (!row.created_at) return null
    const created = new Date(row.created_at).getTime()
    if (Number.isNaN(created)) return null
    return created + PAYMENT_WINDOW_MINUTES * MINUTE_MS
}

function addonsTotal(row) {
    const sum = (orders) =>
        (orders ?? []).reduce((total, order) => total + Number(order.total ?? 0), 0)
    return sum(row.food_orders) + sum(row.spa_orders) + sum(row.item_orders)
}

// The staff path reads the table and gets the storage path with each entry; the
// guest path comes through my_bookings() and gets amount + timestamp only. Both
// are read the same way here, and neither is trusted to be an array.
function receiptList(row) {
    if (!Array.isArray(row.receipt_uploads)) return []
    return row.receipt_uploads.map((entry) => ({
        path: entry.path ?? null,
        uploadedAt: entry.uploadedAt ?? null,
        amount: Number(entry.amount ?? 0),
    }))
}

// Guest-side writes (a new booking, an add-on) land in the guest's own list.
// Never in `bookings` — that array belongs to the admin board.
function upsertLocal(booking) {
    const index = myBookings.findIndex((item) => item.id === booking.id)
    if (index === -1) commitMine([booking, ...myBookings])
    else commitMine(myBookings.map((item) => (item.id === booking.id ? booking : item)))
}

// Postgres row → the shape every screen expects, for a COMBINED reservation.
// `row.units` is what my_booking_groups() sends (camelCase, from its jsonb_agg);
// `row.bookings` is what a staff read gets from PostgREST's nested embed
// (`select('*, bookings(...)')`, raw snake_case columns) — accepted here too
// so both loading paths share this one mapper, exactly like fromRow() above
// already serves both the RPC and the raw-table staff read.
function fromGroupRow(row) {
    const schedule = getSchedule(row.schedule_key)
    const rawUnits = row.units ?? row.bookings ?? []
    const units = rawUnits.map((u) => {
        const typeId = u.typeId ?? u.type_id ?? null
        return {
            unitId: u.unitId ?? u.unit_id ?? null,
            typeId,
            typeName: findAccommodationType(typeId)?.name ?? typeId ?? 'Accommodation',
            price: Number(u.price ?? 0),
        }
    })

    return {
        id: row.id,
        code: row.code,
        status: row.status,
        // What tells the UI this is a combined reservation rather than a
        // single-unit booking — same card shape otherwise, so the two can be
        // rendered from mostly-shared code.
        isGroup: true,
        units,

        scheduleKey: row.schedule_key,
        checkInDate: row.check_in_date,
        checkOutDate: row.check_out_date,
        startsAt: new Date(row.starts_at).getTime(),
        endsAt: new Date(row.ends_at).getTime(),
        checkIn: row.starts_at,
        checkOut: row.ends_at,
        sameDayCheckout: schedule?.sameDay === true,
        schedule: schedule
            ? { checkIn: schedule.checkIn, time: schedule.time, description: schedule.description }
            : null,

        guest: {
            fullName: row.guest_name,
            email: row.guest_email ?? '',
            mobile: row.guest_mobile ?? '',
        },
        pax: row.pax,
        kids: row.kids ?? 0,
        seniors: row.seniors ?? 0,
        // Counted, never priced — the resort applies the PWD discount in person.
        pwd: row.pwd ?? 0,
        entrance: {
            total: Number(row.entrance_total ?? 0),
            perHead: Number(row.entrance_per_head ?? 0),
            seniorDiscount: Number(row.entrance_senior_discount ?? 0),
            freeApplied: Number(row.entrance_free_applied ?? 0),
            freeSavings: Number(row.entrance_free_savings ?? 0),
        },

        unitSubtotal: Number(row.unit_subtotal ?? 0),
        downpayment: row.downpayment != null ? Number(row.downpayment) : null,
        // Same shape as fromRow()'s stayTotal: units + entrance + whatever
        // food/spa has been ordered against the group (add_group_addon()).
        stayTotal:
            Number(row.unit_subtotal ?? 0) + Number(row.entrance_total ?? 0) + addonsTotal(row),
        // Same meaning as fromRow()'s `total` — the admin table's "Total"
        // column, which for a single booking is really just the unit rate.
        total: Number(row.unit_subtotal ?? 0),
        payment: row.payment,
        hasReceipt: Boolean(row.receipt_url),
        // Same masking rule as fromRow(): a guest (my_booking_groups()) only
        // ever sees 'pending-upload'; staff, reading the raw table, get the
        // real storage path ReceiptViewer needs to mint a signed URL.
        receiptPath:
            row.receipt_url && row.receipt_url !== RECEIPT_PENDING_MARKER
                ? row.receipt_url
                : null,

        foodOrders: row.food_orders ?? [],
        spaOrders: row.spa_orders ?? [],
        itemOrders: row.item_orders ?? [],
        receipts: receiptList(row),
        paidSubmitted: receiptList(row).reduce((sum, entry) => sum + entry.amount, 0),
        createdAt: row.created_at,

        cancelReason: row.cancel_reason ?? null,
        paymentDueAt: paymentDueAt(row),
    }
}

// One name × quantity entry per distinct accommodation type in a combined
// reservation, e.g. [{ name: 'Teepee', qty: 2 }, { name: 'A-House Small', qty: 1 }].
// Shared by every screen that lists a group's units — My Bookings, the admin
// table, the receipt viewer and the saved receipt image — so they can't drift
// on how it's rolled up.
export function groupUnitCounts(units) {
    const counts = []
    for (const unit of units ?? []) {
        const existing = counts.find((entry) => entry.name === unit.typeName)
        if (existing) existing.qty += 1
        else counts.push({ name: unit.typeName, qty: 1 })
    }
    return counts
}

// The counts above, flattened to the one-line label every screen shows:
// 'Teepee ×2, A-House Small'.
export function groupUnitsLabel(units) {
    return groupUnitCounts(units)
        .map((entry) => `${entry.name}${entry.qty > 1 ? ` ×${entry.qty}` : ''}`)
        .join(', ')
}

function upsertLocalGroup(group) {
    const index = myBookingGroups.findIndex((item) => item.id === group.id)
    if (index === -1) commitMineGroups([group, ...myBookingGroups])
    else commitMineGroups(myBookingGroups.map((item) => (item.id === group.id ? group : item)))
}

// =================================================================== loading

// The catalog is public (RLS allows anon select), so this always succeeds.
async function loadCatalog() {
    const [types, units, rates] = await Promise.all([
        supabase.from('accommodation_types').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('accommodation_units').select('id, type_id, unit_no').eq('is_active', true).order('unit_no'),
        supabase.from('accommodation_rates').select('*'),
    ])

    // Prices and pax ceilings, keyed by the pair that identifies one: a unit
    // costs a different amount under Day Time than overnight. Loaded here with
    // the types because data/accomodationOptions.js merges the two into the
    // cards the booking page renders — before this, its rate table was written
    // out in the front end and a price change meant a redeploy.
    if (rates.error) {
        console.error('Could not load accommodation rates:', rates.error.message)
    } else {
        const map = new Map()
        for (const row of rates.data) {
            map.set(rateKey(row.type_id, row.rate_group), {
                typeId: row.type_id,
                rateGroup: row.rate_group,
                // The STANDING price. What the guest pays is
                // effectiveRatePrice(), which is this unless a promo is on.
                price: Number(row.price),
                // Null on a database that predates
                // *_accommodation_promo_price.sql, which is simply "no promo" —
                // the same as every rate before promos existed.
                promoPrice: row.promo_price == null ? null : Number(row.promo_price),
                promoActive: row.promo_active === true,
                paxLabel: row.pax_label ?? null,
                minPax: row.min_pax ?? null,
                maxPax: row.max_pax ?? null,
            })
        }
        ratesByKey = map
        ratesLoaded = true
    }

    if (types.error) {
        console.error('Could not load accommodation types:', types.error.message)
        return
    }

    // Replace in place — the array is exported as a const binding.
    ACCOMMODATION_TYPES.length = 0
    ACCOMMODATION_TYPES.push(
        ...types.data.map((row) => ({
            id: row.id,
            name: row.name,
            prefix: row.prefix,
            total: row.total,
            image: row.image_url ?? null,
            poolId: row.pool_id ?? null,
            // What the home page card and its "view more" modal say. Null on a
            // database that predates *_accommodation_card_content.sql, which
            // the cards answer with their built-in copy.
            description: row.description ?? null,
            features: Array.isArray(row.features) ? row.features : null,
            // The extra angles its "view more" carousel shows after the main
            // photo. Empty on a database that predates *_accommodation_gallery
            // .sql, which is simply a one-slide carousel — the same as before.
            gallery: Array.isArray(row.gallery) ? row.gallery.filter(Boolean) : [],
        })),
    )

    if (!units.error) {
        const map = new Map()
        for (const unit of units.data) {
            if (!map.has(unit.type_id)) map.set(unit.type_id, [])
            map.get(unit.type_id).push(unit.id)
        }
        unitsByType = map
    }

    // Availability answers were computed against the old catalog.
    clearCaches()
    touch()
}

// Every row in the table — the admin board. Only reachable with a signed-in
// staff session; the database refuses it for anyone else, which is why the
// guest path below never touches the table at all.
async function loadStaffBookings() {
    const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Could not load bookings:', error.message)
        return false
    }

    commit(data.map(fromRow))
    return true
}

// Same as loadStaffBookings(), for combined reservations. The nested
// `bookings(...)` select is PostgREST following the group_id foreign key —
// no separate staff RPC needed, the same "staff manage booking groups" /
// "staff manage bookings" RLS policies that already gate the flat table gate
// this join too.
async function loadStaffBookingGroups() {
    const { data, error } = await supabase
        .from('booking_groups')
        .select('*, bookings(unit_id, type_id, price, status)')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Could not load group reservations:', error.message)
        return false
    }

    commitGroups(data.map(fromGroupRow))
    return true
}

// The bookings made by THIS browser, and only those. my_bookings() matches on
// the hash of the owner token, so a guest on another device — or in another
// browser, or a private window — gets an empty list here no matter what.
//
// Runs on a timer as well as on demand, so it only commits when something
// actually differs: a routine poll that confirms the current list must not
// re-render the page under the guest.
async function loadMyBookings() {
    const { data, error } = await supabase.rpc('my_bookings', {
        p_owner_token: getOwnerToken(),
    })

    if (error) {
        console.error('Could not load your bookings:', error.message)
        return
    }

    // Every row carries the same server_now, so the first is as good as any.
    // Measured before mapping, so the deadlines below are compared against a
    // clock that is already corrected.
    syncServerClock(data?.[0]?.server_now)

    const next = (data ?? []).map(fromRow)
    if (!sameBookings(myBookings, next)) commitMine(next)
}

// Same as loadMyBookings(), for this browser's own combined reservations.
async function loadMyBookingGroups() {
    const { data, error } = await supabase.rpc('my_booking_groups', {
        p_owner_token: getOwnerToken(),
    })

    if (error) {
        console.error('Could not load your group reservations:', error.message)
        return
    }

    syncServerClock(data?.[0]?.server_now)

    const next = (data ?? []).map(fromGroupRow)
    if (!sameBookingGroups(myBookingGroups, next)) commitMineGroups(next)
}

// Cheap equality over the fields a guest can see change: staff confirming a
// booking, a cancellation, an add-on landing, or a payment being credited.
// `downpayment` and `paidSubmitted` are in here because the payment panel is
// built out of them — miss those and a guest who just paid keeps being shown
// the bill until they reload.
function sameBookings(a, b) {
    if (a.length !== b.length) return false
    return a.every((booking, index) => {
        const other = b[index]
        return (
            booking.id === other.id &&
            booking.status === other.status &&
            booking.cancelReason === other.cancelReason &&
            booking.payment === other.payment &&
            booking.unitId === other.unitId &&
            booking.downpayment === other.downpayment &&
            booking.paidSubmitted === other.paidSubmitted &&
            booking.foodOrders.length === other.foodOrders.length &&
            booking.spaOrders.length === other.spaOrders.length &&
            booking.itemOrders.length === other.itemOrders.length
        )
    })
}

// Same cheap equality, for combined reservations.
function sameBookingGroups(a, b) {
    if (a.length !== b.length) return false
    return a.every((group, index) => {
        const other = b[index]
        return (
            group.id === other.id &&
            group.status === other.status &&
            group.cancelReason === other.cancelReason &&
            group.payment === other.payment &&
            group.downpayment === other.downpayment &&
            group.paidSubmitted === other.paidSubmitted &&
            group.units.length === other.units.length
        )
    })
}

// Load both sets. The guest list is loaded unconditionally — a staff member is
// also a person who books stays, and their My Bookings page must show theirs
// and no one else's. Only the admin board additionally gets the whole table.
async function loadBookings() {
    const { data: session } = await supabase.auth.getSession()
    // Being signed in is not the same as being staff — a non-staff account is
    // just a guest with a login, and gets nothing extra.
    staffSession = Boolean(session?.session) && (await checkStaff())

    // There is no cron on this project, so a page load is one of the moments a
    // lapsed hold gets swept. Awaited, so the lists below are read after the
    // sweep rather than one refresh behind it.
    await sweepExpiredBookings()

    await loadMyBookings()
    await loadMyBookingGroups()

    if (staffSession) {
        if (!(await loadStaffBookings())) staffSession = false
        else await loadStaffBookingGroups()
    } else {
        commit([])
        commitGroups([])
    }
}

async function checkStaff() {
    const { data, error } = await supabase.rpc('is_staff')
    if (error) {
        console.error('Could not verify staff access:', error.message)
        return false
    }
    return data === true
}

// Called after sign-in / sign-out so the dashboard fills or empties.
export async function refreshBookings() {
    clearCaches()
    await loadBookings()
}

// True when this browser's booking list survives a refresh. False in a private
// window that blocks localStorage, where the list is only as durable as the
// tab — My Bookings warns rather than quietly losing the guest's reservation.
export function bookingsPersistOnThisDevice() {
    return isOwnerTokenPersistent()
}

// Forget this browser's bookings. The reservations stay with the resort; this
// device just stops being able to list or manage them.
export async function forgetMyBookings() {
    forgetOwnerToken()
    clearCaches()
    commitMine([])
}

const REALTIME_CHANNEL = 'bookings-changes'

// Live booking rows go to STAFF ONLY. Realtime replays every change through
// the subscriber's own permissions, and a guest has none on this table — so a
// guest subscription would be a channel that can only ever deliver nothing.
// Worse, it would be one more surface where a future policy slip leaks a
// stranger's row into someone's browser. Guests are refreshed by polling their
// own bookings instead (startRevalidating), which cannot return anybody else's.
function watchRealtime() {
    // This module can be evaluated more than once (Vite HMR in dev), and
    // supabase-js refuses to attach handlers to a channel that has already
    // subscribed. Drop any previous channel of the same name first.
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${REALTIME_CHANNEL}`) {
            supabase.removeChannel(channel)
        }
    }

    if (!staffSession) return

    supabase
        .channel(REALTIME_CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
            // Someone booked or cancelled elsewhere — every cached count is
            // now suspect, so drop them and let the screens re-ask.
            clearCaches()
            loadStaffBookings()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_groups' }, () => {
            clearCaches()
            loadStaffBookingGroups()
        })
        .subscribe()
}

function stopRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${REALTIME_CHANNEL}`) {
            supabase.removeChannel(channel)
        }
    }
}

// Re-check what is currently on screen. Only runs while something is
// subscribed, and only repaints when something actually changed, so an idle
// tab costs one cheap RPC per interval and no renders.
//
// This is also how a guest stays current: Realtime deliberately tells them
// nothing (see watchRealtime), so their own bookings are re-read here instead.
let revalidateTimer = null

function startRevalidating() {
    if (revalidateTimer) clearInterval(revalidateTimer)
    revalidateTimer = setInterval(() => {
        if (listeners.size === 0) return
        if (document.visibilityState === 'hidden') return
        if (lastQuery) {
            const { from, to, scheduleKey } = lastQuery
            fetchAvailability(from, to ?? null, scheduleKey)
        }
        // The guest list is polled for everyone: staff get row changes pushed
        // to them for the admin board, but Realtime says nothing about which
        // of those rows are the signed-in person's own.
        loadMyBookings()
        loadMyBookingGroups()
    }, AVAILABILITY_TTL_MS)
}

// Without credentials every call would fail on a loop and bury the one useful
// message from supabaseClient.js. The catalog above still renders from its
// built-in defaults, so the pages look right — they just can't take bookings.
// The CATALOG channel, as opposed to the bookings one above. What travels here
// is what the resort sells — public by design, and readable by an anonymous
// visitor — so a rate edited on the dashboard reaches a guest already looking
// at the booking page. Bookings stay on their own staff-only channel.
//
// Declared above the boot block, not next to its function: `const` is not
// hoisted, and the call below runs while this module is still evaluating.
const CATALOG_CHANNEL = 'accommodation-catalog-changes'

if (isSupabaseConfigured) {
    loadCatalog()
    watchCatalogRealtime()
    // Realtime is attached only once we know whether this is a staff session.
    loadBookings().then(watchRealtime)
    startRevalidating()
}

// Re-read the catalog. Exported for the dashboard's accommodation CRUD, which
// calls it after a save so the booking page's prices and unit counts follow
// the edit rather than waiting for the next page load.
export function refreshAccommodationCatalog() {
    if (!isSupabaseConfigured) return Promise.resolve()
    return loadCatalog()
}

function watchCatalogRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CATALOG_CHANNEL}`) {
            supabase.removeChannel(channel)
        }
    }

    const reload = () => {
        loadCatalog()
        if (adminAccommodations.loaded) loadAdminAccommodations()
    }

    supabase
        .channel(CATALOG_CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'accommodation_types' }, reload)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'accommodation_rates' }, reload)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'accommodation_units' }, reload)
        .subscribe()
}

// Keep the session flag in step with Supabase Auth. Signing out of the admin
// dashboard drops back to the guest view — this browser's own bookings — not
// to a blank list.
supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadBookings().then(watchRealtime)
    } else if (event === 'SIGNED_OUT') {
        staffSession = false
        stopRealtime()
        clearCaches()
        commit([])          // the admin board empties …
        commitGroups([])
        loadMyBookings()    // … the guest's own list is unaffected
        loadMyBookingGroups()
    }
})

// ------------------------------------------------------------------ queries

function cacheKey(typeId, checkIn, checkOut, scheduleKey) {
    const from = typeof checkIn === 'string' ? checkIn : toISODate(checkIn)
    const to = checkOut == null ? '' : (typeof checkOut === 'string' ? checkOut : toISODate(checkOut))
    return `${typeId}|${from}|${to}|${scheduleKey ?? ''}`
}

// The stay the guest is currently looking at, re-checked on a timer so the
// counts stay live even while they sit still reading the cards.
let lastQuery = null

// Ask Postgres for the counts behind one (dates + schedule) query and cache
// every type it returns, so the eight cards on the booking page cost one call.
function fetchAvailability(checkIn, checkOut, scheduleKey) {
    const from = toISODate(checkIn)
    const to = checkOut != null ? toISODate(checkOut) : null
    lastQuery = { from, to, scheduleKey }
    const requestKey = `avail|${from}|${to ?? ''}|${scheduleKey ?? ''}`
    if (inFlight.has(requestKey)) return
    inFlight.add(requestKey)

    supabase
        .rpc('accommodation_availability', {
            p_check_in: from,
            p_check_out: to,
            p_schedule_key: scheduleKey,
        })
        .then(({ data, error }) => {
            inFlight.delete(requestKey)
            if (error) {
                console.error('Availability lookup failed:', error.message)
                return
            }
            const fetchedAt = Date.now()
            let changed = false
            for (const row of data) {
                const key = cacheKey(row.type_id, from, to, scheduleKey)
                const previous = availabilityCache.get(key)
                // Small Tent, Big Tent and Tent Pitching share one 4-slot pool
                // (see 20260803120000_shared_tent_pool.sql), so `available`
                // straight off the RPC is how many of the WHOLE pool are free
                // — up to 4, even for Big Tent, which only ever has 1 unit of
                // its own. `poolAvailable` keeps that raw pool-wide number
                // (identical across every type sharing a pool; simply equal
                // to `available` for a type with no pool of its own) so a
                // screen with more than one pool member on it at once — the
                // booking cart — can tell that adding a Tent Pitching to the
                // cart used up the slot a Big Tent card was about to claim,
                // something the per-type numbers alone can't say. `available`
                // itself is capped at the type's own total so a card never
                // claims more units than the resort actually has of it, while
                // still going to 0 on all three once the shared pool itself
                // is exhausted.
                const available = Math.min(row.available, row.total)
                if (
                    previous?.available !== available ||
                    previous?.total !== row.total ||
                    previous?.poolAvailable !== row.available
                ) {
                    changed = true
                }
                availabilityCache.set(key, {
                    available,
                    total: row.total,
                    poolAvailable: row.available,
                    fetchedAt,
                })
            }
            // Only re-render when a number actually moved; a routine
            // revalidation that confirms the current view should be invisible.
            if (changed) touch()
        })
}

// How many units of a type are free for the stay: { available, total }.
// Returns null for an untracked type (tent pitching) and — briefly — while the
// first answer is in flight, which the UI already renders as "Availability TBA".
export function getAvailability(idOrPrefix, checkIn = new Date(), checkOut = null, scheduleKey = null) {
    const type = findAccommodationType(idOrPrefix)
    if (!type) return null

    const cached = availabilityCache.get(cacheKey(type.id, checkIn, checkOut, scheduleKey))
    if (cached) {
        // Show the cached number now; refresh it behind the scenes once stale.
        if (Date.now() - cached.fetchedAt > AVAILABILITY_TTL_MS) {
            fetchAvailability(checkIn, checkOut, scheduleKey)
        }
        return cached
    }

    fetchAvailability(checkIn, checkOut, scheduleKey)
    return null
}

// Whether EVERY other active type is fully free on one date — what "Rent All
// Resort" needs, since renting the whole resort only makes sense on a day
// nothing else is booked. Built on the same cached per-date RPC every card
// already uses (getAvailability), so this costs nothing new: one call for the
// date (all types come back together), read back per type.
//
// `excludeTypeId` leaves the rent-all card itself out of its own check — it
// owns no physical units to conflict with. Returns null while any type's
// answer is still in flight (same "don't know yet" the cards already show as
// "Availability TBA"), so a caller can tell "not free" from "not answered".
export function isResortFreeOn(date, scheduleKey, excludeTypeId = null){
    let allFree = true
    for (const type of ACCOMMODATION_TYPES){
        if (type.id === excludeTypeId) continue
        const availability = getAvailability(type.id, date, null, scheduleKey)
        if (availability == null) return null
        if (availability.available < availability.total) allFree = false
    }
    return allFree
}

// --- local computations over the rows this session can see -----------------

// Bookings that currently hold a unit. Cancelled ones release their dates.
function blockingBookings() {
    return bookings.filter(
        (booking) => booking.status !== 'cancelled' && booking.unitId != null,
    )
}

function unitStatusFor(booking) {
    return booking.status === 'pending' ? 'pending' : 'booked'
}

export function findConflicts(unitId, window, { ignoreBookingId = null } = {}) {
    return blockingBookings().filter(
        (booking) =>
            booking.unitId === unitId &&
            booking.id !== ignoreBookingId &&
            overlaps(window.startsAt, window.endsAt, booking.startsAt, booking.endsAt),
    )
}

// Status of one unit for a stay: 'available' | 'pending' | 'booked'.
// Exact for a staff session, which is the only place per-unit status is shown.
export function getUnitStatus(unitId, checkIn = new Date(), checkOut = null, scheduleKey = null) {
    const window = occupancyWindow({ checkIn, checkOut, scheduleKey })
    let status = 'available'
    for (const booking of findConflicts(unitId, window)) {
        if (unitStatusFor(booking) === 'booked') return 'booked'
        status = 'pending'
    }
    return status
}

export function buildUnits(type, checkIn = new Date(), checkOut = null, scheduleKey = null) {
    return listUnitIds(type.id ?? type).map((id) => ({
        id,
        status: getUnitStatus(id, checkIn, checkOut, scheduleKey),
    }))
}

// What happens on ONE unit on ONE calendar day, each booking's hours clipped
// to that day — the admin Units board.
export function getUnitDayDetail(unitId, date) {
    const dayStart = normalizeDate(date)
    const dayEnd = dayStart + DAY_MS

    const slots = blockingBookings()
        .filter(
            (booking) =>
                booking.unitId === unitId &&
                overlaps(dayStart, dayEnd, booking.startsAt, booking.endsAt),
        )
        .map((booking) => {
            const from = Math.max(booking.startsAt, dayStart)
            const to = Math.min(booking.endsAt, dayEnd)
            return {
                bookingId: booking.id,
                guestName: booking.guest?.fullName || 'Guest',
                status: unitStatusFor(booking),
                scheduleKey: booking.scheduleKey,
                from,
                to,
                label: `${formatClock(from)} – ${formatClock(to)}`,
            }
        })
        .sort((a, b) => a.from - b.from)

    const status = slots.some((slot) => slot.status === 'booked')
        ? 'booked'
        : slots.length > 0
            ? 'pending'
            : 'available'

    return { status, slots }
}

// Occupancy across the whole resort for a day — the admin stat cards.
// A physical unit can now be listed under more than one type (the shared
// tent pool), so it's only ever counted once here even though it shows up
// once per type it's shared with when browsing the units board.
export function getDayOccupancy(date = new Date()) {
    let total = 0
    let taken = 0
    const seen = new Set()
    for (const type of ACCOMMODATION_TYPES) {
        for (const unitId of listUnitIds(type.id)) {
            if (seen.has(unitId)) continue
            seen.add(unitId)
            total += 1
            if (getUnitDayDetail(unitId, date).status !== 'available') taken += 1
        }
    }
    return { total, taken, available: total - taken }
}

// First day from `from` with a free unit of the type. Answered by Postgres;
// null until it replies (the UI just omits the "free on …" hint until then).
export function getNextAvailableDate(idOrPrefix, from = new Date(), maxDays = 60, scheduleKey = null) {
    const type = findAccommodationType(idOrPrefix)
    if (!type) return null

    const key = `next|${type.id}|${toISODate(from)}|${scheduleKey ?? ''}|${maxDays}`
    if (nextFreeCache.has(key)) {
        const value = nextFreeCache.get(key)
        return value ? new Date(normalizeDate(value)) : null
    }
    if (inFlight.has(key)) return null
    inFlight.add(key)

    supabase
        .rpc('next_available_date', {
            p_type_id: type.id,
            p_from: toISODate(from),
            p_schedule_key: scheduleKey,
            p_max_days: maxDays,
        })
        .then(({ data, error }) => {
            inFlight.delete(key)
            if (error) {
                console.error('Next-available lookup failed:', error.message)
                return
            }
            nextFreeCache.set(key, data ?? null)
            touch()
        })
    return null
}

// Kept for callers that ask for a unit id directly. The authoritative
// assignment happens inside book_accommodation(); this is only a local hint.
export function assignRandomAvailableUnit(idOrPrefix, checkIn = new Date(), checkOut = null, scheduleKey = null) {
    const type = findAccommodationType(idOrPrefix)
    if (!type) return null
    const free = buildUnits(type, checkIn, checkOut, scheduleKey)
        .filter((unit) => unit.status === 'available')
    if (free.length === 0) return null
    return free[Math.floor(Math.random() * free.length)].id
}

// ================================================================== receipts

// The bucket only accepts JPG and PNG, and some Android WebViews hand over a
// File with an empty `type` — fall back to the extension so a legitimate photo
// isn't rejected by the bucket for having no mime type.
function receiptFormat(file) {
    const isPng =
        file.type === 'image/png' || (!file.type && /\.png$/i.test(file.name ?? ''))
    return isPng
        ? { extension: 'png', mime: 'image/png' }
        : { extension: 'jpg', mime: 'image/jpeg' }
}

// crypto.randomUUID() exists only in a secure context, and a dev server
// reached over plain http on the LAN isn't one — never let that throw in the
// middle of a booking.
function randomKey() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

// Put the guest's screenshot in the bucket and return its path, which is what
// gets stored on the booking row. Called from payBooking()/payBookingGroup(),
// so the reservation already exists and has an id to file the image under.
//
// THE PATH IS `<owner id>/<random>.jpg`, AND BOTH HALVES EARN THEIR PLACE
// ----------------------------------------------------------------------
// The id prefix is what pay_my_booking() checks: without it, any path that
// named a real object was creditable against ANY booking, so one guest's
// upload could be replayed onto someone else's reservation to mark it paid.
//
// The random half is still there for the original reason — the path is what a
// signed URL is minted from, so a guessable one would let anybody ask for
// someone else's receipt. A booking id is a uuid, not the human-facing
// 'CBL-…' code a guest might share, so prefixing with it gives the server
// something to verify without making the path guessable.
export async function uploadReceipt(file, ownerId) {
    if (!file) return { ok: true, path: null }

    // The server refuses a path that is not under a booking id, so an upload
    // without one would only strand a file in the bucket.
    if (!ownerId) {
        console.error('Receipt upload skipped: no booking id to file it under.')
        return { ok: false, message: 'Could not upload your receipt. Please refresh the page and try again.' }
    }

    // Checked before the request rather than after it fails. Without keys the
    // upload is aimed at a placeholder host and comes back "Failed to fetch",
    // which reads as a broken storage bucket — this is the one failure whose
    // cause the app already knows for certain, so it says it outright.
    if (!isSupabaseConfigured) {
        console.error('Receipt upload skipped:', SUPABASE_SETUP_MESSAGE)
        return { ok: false, message: SUPABASE_SETUP_MESSAGE }
    }

    const { extension, mime } = receiptFormat(file)
    const path = `${ownerId}/${randomKey()}.${extension}`

    const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, file, {
        contentType: mime,
        upsert: false,
    })

    if (error) {
        console.error('Receipt upload failed:', error.message)
        return {
            ok: false,
            message: `Could not upload your receipt: ${describeSupabaseError(error)}`,
        }
    }

    return { ok: true, path }
}

// A temporary link to one receipt image. Only a staff session can read the
// bucket, so this returns { ok: false } for anyone else — which is the point.
export async function getReceiptUrl(path) {
    if (!path) {
        return { ok: false, message: 'This booking has no receipt image on file.' }
    }

    if (!isSupabaseConfigured) {
        return { ok: false, message: SUPABASE_SETUP_MESSAGE }
    }

    const { data, error } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .createSignedUrl(path, RECEIPT_URL_TTL_SECONDS)

    if (error) {
        console.error('Could not open receipt:', error.message)
        return { ok: false, message: `Could not open the receipt: ${describeSupabaseError(error)}` }
    }

    return { ok: true, url: data.signedUrl }
}

// True when there is an actual image to show. A booking can have a receipt on
// record (hasReceipt) with nothing viewable — the pre-bucket rows.
export function hasViewableReceipt(booking) {
    return Boolean(booking?.receiptPath)
}

// ================================================================= mutations

// Create a booking and hold a unit for it. The database picks the unit and
// refuses overlapping holds, so two guests racing for the last one cannot both
// win — the loser gets { ok: false } with a message to show.
export async function createBooking(draft) {
    const {
        typeId,
        typeName = 'Accommodation',
        scheduleKey = null,
        checkIn,
        checkOut = null,
        guest = {},
        pax = null,
        kids = 0,
        seniors = 0,
        pwd = 0,
        entrance = null,
        price = null,
        hasReceipt = false,
        // Storage path from uploadReceipt(), run just before this call.
        receiptPath = null,
    } = draft

    if (!checkIn || !scheduleKey) {
        return { ok: false, reason: 'invalid', message: 'Pick your dates and a stay schedule first.' }
    }

    // Same reasoning as uploadReceipt(): name the missing .env instead of
    // letting it surface as a network error against the placeholder host.
    if (!isSupabaseConfigured) {
        return { ok: false, reason: 'error', message: SUPABASE_SETUP_MESSAGE }
    }

    const schedule = getSchedule(scheduleKey)
    const effectiveCheckOut = schedule?.sameDay ? checkIn : (checkOut ?? checkIn)

    // book_stay(), not book_accommodation(): the queue gate and the held-vs-
    // booked distinction live in a wrapper around the original, which is left
    // untouched. See the header of *_booking_hold_queue.sql for why.
    const { data, error } = await supabase.rpc('book_stay', {
        p_type_id: typeId,
        p_schedule_key: scheduleKey,
        p_check_in: toISODate(checkIn),
        p_check_out: toISODate(effectiveCheckOut),
        p_guest_name: guest.fullName ?? 'Guest',
        p_guest_email: guest.email ?? null,
        p_guest_mobile: guest.mobile ?? null,
        p_pax: pax,
        p_kids: kids,
        p_seniors: seniors,
        p_pwd: pwd,
        // ADVISORY ONLY — the server does not read these any more.
        //
        // book_accommodation() computes the price from accommodation_rates ×
        // nights and the entrance breakdown from stay_schedules.entrance_fee,
        // and stores its own figures. It has to: these arguments arrive from a
        // browser holding a publishable key, so a single crafted request used to
        // be able to book a real unit for ₱1 (bookings.downpayment is generated
        // from price, so the amount owed scaled down with it). See the header of
        // *_server_side_pricing.sql.
        //
        // They are still SENT so that the parameters can stay on the function
        // signature — dropping them would break every browser tab still holding
        // the previous bundle. If the server's figure differs from the one
        // quoted here it writes a line to the Postgres log and charges its own.
        p_price: price,
        p_entrance_total: entrance?.total ?? null,
        // Also ignored by the server now, and nothing in this app has sent a
        // non-null value since payment moved to after the hold. It used to flip
        // the new booking to 'down-payment' — which meant a crafted request
        // could create a booking that was exempt from the ten-minute sweep from
        // the moment it existed, holding a unit indefinitely without paying.
        // A receipt can only be verified once there is a booking id to file it
        // under, so it now arrives through pay_my_booking() instead.
        p_receipt_url: receiptPath ?? (hasReceipt ? RECEIPT_PENDING_MARKER : null),
        // Full breakdown, so my-booking and the admin export can show how the
        // entrance total was reached rather than just the figure.
        p_entrance_per_head: entrance?.perHead ?? 0,
        p_entrance_senior_discount: entrance?.seniorDiscount ?? 0,
        p_entrance_free_applied: entrance?.freeApplied ?? 0,
        p_entrance_free_savings: entrance?.freeSavings ?? 0,
        // Stamps the booking as this browser's. The database stores only the
        // hash, and this is the only value that will ever unlock the row again.
        p_owner_token: getOwnerToken(),
    })

    if (error) {
        // book_accommodation() classifies its own refusals, and the three it
        // can give are answered very differently by the form:
        //
        //   'held'        — the last unit is under a live 10-minute hold. It is
        //                   coming back, probably within minutes, so the guest
        //                   is offered a place in line rather than a shrug.
        //   'queued'      — a unit IS free, but a guest ahead in the queue has
        //                   the claim on it. Also a wait, and a short one.
        //   'unavailable' — genuinely booked out. Waiting achieves nothing;
        //                   this is the only one that should send the guest
        //                   back to pick a different unit or date.
        //
        // The regexes are a fallback for a database that has not had the queue
        // migration applied yet, where these arrive with no hint at all.
        const text = error.message ?? ''
        const hint = error.hint
            ?? (/being held|taken a moment before/i.test(text) ? 'held' : null)
            ?? (/fully booked|just taken/i.test(text) ? 'unavailable' : null)

        const waiting = hint === 'held' || hint === 'queued'
        const refused = waiting || hint === 'unavailable'

        return {
            ok: false,
            reason: refused ? hint : 'error',
            message: refused
                ? [error.message, error.details].filter(Boolean).join(' ')
                : `Could not save your booking: ${describeSupabaseError(error)}`,
            // True when the answer is "wait", not "pick something else". The
            // form keys the queue panel off this rather than re-testing the
            // reason string in three places.
            canWait: waiting,
        }
    }

    const row = Array.isArray(data) ? data[0] : data
    const booking = fromRow(row)
    booking.accomodationName = typeName
    clearCaches()
    upsertLocal(booking)

    return { ok: true, booking }
}

// Create a COMBINED reservation: several units, one code, one hold, one down
// payment. `items` is one entry per unit — `{ typeId, price }`, the same type
// repeated for quantity > 1. All-or-nothing: book_stay_group() rolls back
// every unit it already picked the instant one item fails, so there is no
// partial reservation to clean up here — see the migration header for why.
//
// Deliberately NOT used for a cart of exactly one unit — booking.jsx keeps
// that on the plain createBooking()/book_stay path so the single-unit case
// keeps its hold-queue (waiting for a unit that is currently held by someone
// else), which group reservations don't have in this first version.
export async function createGroupBooking(draft) {
    const {
        items = [],
        scheduleKey = null,
        checkIn,
        checkOut = null,
        guest = {},
        pax = null,
        kids = 0,
        seniors = 0,
        pwd = 0,
        entrance = null,
    } = draft

    if (!checkIn || !scheduleKey) {
        return { ok: false, reason: 'invalid', message: 'Pick your dates and a stay schedule first.' }
    }
    if (items.length === 0) {
        return { ok: false, reason: 'invalid', message: 'Pick at least one accommodation.' }
    }
    if (!isSupabaseConfigured) {
        return { ok: false, reason: 'error', message: SUPABASE_SETUP_MESSAGE }
    }

    const schedule = getSchedule(scheduleKey)
    const effectiveCheckOut = schedule?.sameDay ? checkIn : (checkOut ?? checkIn)

    const { data, error } = await supabase.rpc('book_stay_group', {
        // `price` on each item is ADVISORY, exactly as in createBooking() above:
        // book_stay_group() prices every member row through book_accommodation()
        // and sums what was actually stored into the group's unit_subtotal. It
        // used to sum these figures instead, which made the combined-reservation
        // path a second way to book at a price of the caller's choosing.
        p_items: items.map((item) => ({ type_id: item.typeId, price: item.price })),
        p_schedule_key: scheduleKey,
        p_check_in: toISODate(checkIn),
        p_check_out: toISODate(effectiveCheckOut),
        p_guest_name: guest.fullName ?? 'Guest',
        p_guest_email: guest.email ?? null,
        p_guest_mobile: guest.mobile ?? null,
        p_pax: pax,
        p_kids: kids,
        p_seniors: seniors,
        p_pwd: pwd,
        // Advisory too — the group's entrance is recomputed server-side.
        p_entrance_total: entrance?.total ?? null,
        p_entrance_per_head: entrance?.perHead ?? 0,
        p_entrance_senior_discount: entrance?.seniorDiscount ?? 0,
        p_entrance_free_applied: entrance?.freeApplied ?? 0,
        p_entrance_free_savings: entrance?.freeSavings ?? 0,
        p_owner_token: getOwnerToken(),
    })

    if (error) {
        // Same three-way classification as createBooking() above, minus
        // 'held'/'queued' — a cart has no hold-queue in this version, so
        // book_accommodation() inside book_stay_group() only ever answers
        // 'unavailable' or a plain error.
        const text = error.message ?? ''
        const hint = error.hint ?? (/fully booked|just taken/i.test(text) ? 'unavailable' : null)

        return {
            ok: false,
            reason: hint ?? 'error',
            message: hint
                ? [error.message, error.details].filter(Boolean).join(' ')
                : `Could not save your reservation: ${describeSupabaseError(error)}`,
        }
    }

    const row = Array.isArray(data) ? data[0] : data
    // book_stay_group() returns the booking_groups row itself, which has no
    // `units` column — fill it in from what was just sent, since on success
    // every one of them was reserved exactly as asked.
    const group = fromGroupRow({ ...row, units: items.map(({ typeId, price }) => ({ typeId, price })) })
    clearCaches()
    upsertLocalGroup(group)

    return { ok: true, group }
}

// A booking can sit in both lists at once — a staff member's own stay is on
// the admin board AND in their My Bookings. So local edits touch both, in one
// notify, rather than leaving one screen showing a stale copy of the other.
function applyPatch(id, patch) {
    bookings = bookings.map((b) => (b.id === id ? { ...b, ...patch } : b))
    myBookings = myBookings.map((b) => (b.id === id ? { ...b, ...patch } : b))
    notify()
}

function removeLocal(id) {
    bookings = bookings.filter((b) => b.id !== id)
    myBookings = myBookings.filter((b) => b.id !== id)
    notify()
}

function applyPatchGroup(id, patch) {
    bookingGroups = bookingGroups.map((g) => (g.id === id ? { ...g, ...patch } : g))
    myBookingGroups = myBookingGroups.map((g) => (g.id === id ? { ...g, ...patch } : g))
    notify()
}

function removeLocalGroup(id) {
    bookingGroups = bookingGroups.filter((g) => g.id !== id)
    myBookingGroups = myBookingGroups.filter((g) => g.id !== id)
    notify()
}

// Is this one of the caller's OWN bookings? Decides which write path a
// mutation takes, so a staff member cancelling their own stay from My Bookings
// goes through the ownership RPC rather than the admin's table write.
function ownedByThisDevice(id) {
    return myBookings.some((booking) => booking.id === id)
}

function ownedByThisDeviceGroup(id) {
    return myBookingGroups.some((group) => group.id === id)
}

// Staff-only. A guest's update on this table is refused outright, which is why
// the guest paths below go through their own RPCs rather than sharing this.
async function patchBooking(id, patch) {
    const { error } = await supabase.from('bookings').update(patch).eq('id', id)
    if (error) {
        console.error('Could not update booking:', error.message)
        return { ok: false, message: error.message }
    }
    clearCaches()
    applyPatch(id, patch)
    return { ok: true }
}

// Admin verified the receipt: the hold becomes a confirmed reservation.
export function confirmBooking(id) {
    return patchBooking(id, { status: 'upcoming', payment: 'down-payment' })
}

// Admin recorded the balance paid on-site.
export function markBookingPaidFull(id) {
    return patchBooking(id, { payment: 'paid-full' })
}

// Staff-only, same as patchBooking() above but for the group row. Confirming
// or marking a group paid-full does not need to touch its member `bookings`
// rows — those already stopped being "unpaid holds" the moment
// pay_booking_group() mirrored the receipt onto them (see the migration), and
// their own `status` staying 'pending' is harmless: nothing reads a member
// row's status directly once it has a group_id, only the group's.
async function patchBookingGroup(id, patch) {
    const { error } = await supabase.from('booking_groups').update(patch).eq('id', id)
    if (error) {
        console.error('Could not update reservation:', error.message)
        return { ok: false, message: error.message }
    }
    clearCaches()
    applyPatchGroup(id, patch)
    return { ok: true }
}

export function confirmBookingGroup(id) {
    return patchBookingGroup(id, { status: 'upcoming', payment: 'down-payment' })
}

export function markBookingGroupPaidFull(id) {
    return patchBookingGroup(id, { payment: 'paid-full' })
}

// Frees the unit for those dates again — from either side of the app. Staff
// write the row directly; a guest proves the booking is theirs first, and
// cancel_my_booking() refuses if it is not.
//
// `asStaff` is how the DASHBOARD says which of those it is, rather than having
// this guess from device ownership. The guess is wrong in one case and it is
// not a rare one: a booking made on the same machine somebody administers from
// is "owned by this device", so the dashboard's own Cancel used to fall through
// to the guest RPC. That was harmless while the RPC cancelled anything — and
// stopped being harmless the moment it started refusing paid bookings, because
// rejecting a fake receipt is precisely a staff cancel of a paid booking (see
// supabase/migrations/20260811120000_my_booking_cms.sql). Staff pass the flag;
// the guest page does not, so a signed-in staff member cancelling their OWN
// booking from /my-booking still goes through the guest path and is held to the
// guest's rules.
export async function cancelBooking(id, { asStaff = false } = {}) {
    // The admin board — the staff write path. Not bound by the guest rules,
    // which is the point: the human deciding to cancel a paid stay IS the
    // escape hatch those rules route guests to.
    if (staffSession && (asStaff || !ownedByThisDevice(id))) {
        return patchBooking(id, { status: 'cancelled' })
    }

    const { error } = await supabase.rpc('cancel_my_booking', {
        p_booking_id: id,
        p_owner_token: getOwnerToken(),
    })

    if (error) {
        console.error('Could not cancel booking:', error.message)
        return { ok: false, message: error.message }
    }

    clearCaches()
    applyPatch(id, { status: 'cancelled' })
    return { ok: true }
}

// Staff delete the row for real. A guest only clears a cancelled booking off
// their own list — the row stays in Postgres, because a cancellation is part of
// the resort's record and not a guest's to erase.
export async function deleteBooking(id) {
    if (!ownedByThisDevice(id) && staffSession) {
        const { error } = await supabase.from('bookings').delete().eq('id', id)
        if (error) {
            console.error('Could not delete booking:', error.message)
            return { ok: false, message: error.message }
        }
    } else {
        const { error } = await supabase.rpc('dismiss_my_booking', {
            p_booking_id: id,
            p_owner_token: getOwnerToken(),
        })
        if (error) {
            console.error('Could not remove booking from your list:', error.message)
            return { ok: false, message: error.message }
        }
    }

    clearCaches()
    removeLocal(id)
    return { ok: true }
}

// Same as cancelBooking() above, for a combined reservation: frees every
// member unit's dates at once. The guest/RPC path does this in one statement
// (cancel_booking_group() cascades to the member `bookings` rows itself); the
// staff path writes both tables directly since staff already have full RLS
// access to each — same trust level as every other direct staff write here.
export async function cancelBookingGroup(id, { asStaff = false } = {}) {
    if (staffSession && (asStaff || !ownedByThisDeviceGroup(id))) {
        const { error: unitsError } = await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('group_id', id)
        if (unitsError) {
            console.error('Could not release the reservation\'s units:', unitsError.message)
            return { ok: false, message: unitsError.message }
        }
        return patchBookingGroup(id, { status: 'cancelled' })
    }

    const { error } = await supabase.rpc('cancel_booking_group', {
        p_group_id: id,
        p_owner_token: getOwnerToken(),
    })

    if (error) {
        console.error('Could not cancel reservation:', error.message)
        return { ok: false, message: error.message }
    }

    clearCaches()
    applyPatchGroup(id, { status: 'cancelled' })
    return { ok: true }
}

// Same as deleteBooking() above, for a combined reservation.
export async function deleteBookingGroup(id) {
    if (!ownedByThisDeviceGroup(id) && staffSession) {
        const { error: unitsError } = await supabase.from('bookings').delete().eq('group_id', id)
        if (unitsError) {
            console.error('Could not delete reservation units:', unitsError.message)
            return { ok: false, message: unitsError.message }
        }
        const { error } = await supabase.from('booking_groups').delete().eq('id', id)
        if (error) {
            console.error('Could not delete reservation:', error.message)
            return { ok: false, message: error.message }
        }
    } else {
        const { error } = await supabase.rpc('dismiss_booking_group', {
            p_group_id: id,
            p_owner_token: getOwnerToken(),
        })
        if (error) {
            console.error('Could not remove reservation from your list:', error.message)
            return { ok: false, message: error.message }
        }
    }

    clearCaches()
    removeLocalGroup(id)
    return { ok: true }
}

// Settle a booking that already exists. This is "Proceed to Payment": the
// reservation was made first, so the guest is paying against a real row whose
// amount already includes whatever food and spa they have ordered.
//
// The upload happens before the RPC for the same reason it did on the old
// booking form — a receipt that failed to upload must never be recorded as
// received, or the guest is told they are waiting on a review of nothing.
export async function payBooking(bookingId, file) {
    if (!file) {
        return { ok: false, message: 'Choose a screenshot of your payment first.' }
    }

    // Filed under the booking's own id — pay_my_booking() refuses a path that
    // is not, which is what stops one booking's receipt being credited to
    // another. See uploadReceipt().
    const upload = await uploadReceipt(file, bookingId)
    if (!upload.ok) return upload

    const { data, error } = await supabase.rpc('pay_my_booking', {
        p_booking_id: bookingId,
        p_owner_token: getOwnerToken(),
        p_receipt_path: upload.path,
    })

    if (error) {
        console.error('Could not record your payment:', error.message)
        // The window closed while the guest was uploading. The row is cancelled
        // in Postgres already; re-read so their card catches up with the
        // message they are about to be shown, instead of still offering to pay.
        if (error.hint === PAYMENT_TIMEOUT_REASON) await loadMyBookings()
        return {
            ok: false,
            reason: error.hint === PAYMENT_TIMEOUT_REASON ? 'expired' : 'error',
            message: error.message,
        }
    }

    const row = Array.isArray(data) ? data[0] : data
    upsertLocal(fromRow(row))
    return { ok: true }
}

// Same as payBooking() above, for a combined reservation's down payment.
export async function payBookingGroup(groupId, file) {
    if (!file) {
        return { ok: false, message: 'Choose a screenshot of your payment first.' }
    }

    // Under the GROUP's id — a combined reservation's receipt belongs to the
    // group row, not to any one member booking.
    const upload = await uploadReceipt(file, groupId)
    if (!upload.ok) return upload

    const { data, error } = await supabase.rpc('pay_booking_group', {
        p_group_id: groupId,
        p_owner_token: getOwnerToken(),
        p_receipt_path: upload.path,
    })

    if (error) {
        console.error('Could not record your payment:', error.message)
        if (error.hint === PAYMENT_TIMEOUT_REASON) await loadMyBookingGroups()
        return {
            ok: false,
            reason: error.hint === PAYMENT_TIMEOUT_REASON ? 'expired' : 'error',
            message: error.message,
        }
    }

    const row = Array.isArray(data) ? data[0] : data
    // pay_booking_group() returns the booking_groups row alone — no `units`
    // column to rebuild the list from, so carry over what this device already
    // knows about the reservation rather than lose it on this update.
    const existing = myBookingGroups.find((g) => g.id === row.id)
    upsertLocalGroup(fromGroupRow({ ...row, units: existing?.units ?? [] }))
    return { ok: true }
}

// =========================================================== payment window
//
// A booking holds its unit for PAYMENT_WINDOW_MINUTES with nothing paid. After
// that the database cancels it and the unit goes back on the market.
//
// Everything below is about SHOWING that rule. None of it enforces anything:
// the deadline is Postgres's, the cancellation is Postgres's, and
// available_units() stops counting a lapsed hold the moment it lapses whether
// or not any browser noticed. A guest who edits these numbers in devtools gets
// a wrong countdown and the same refusal from pay_my_booking().

// True while the clock is running on this booking — held, and nothing sent yet.
//
// One receipt stops it for good, even an unverified one: staff review takes
// hours and the guest has already done their part. It follows that a top-up for
// food ordered after paying is never timed, which is deliberate — a second
// countdown over a ₱200 add-on balance would cancel a paid reservation.
export function isPaymentWindowTracked(booking) {
    return (
        booking?.status === 'pending' &&
        !booking?.hasReceipt &&
        booking?.paymentDueAt != null
    )
}

// Milliseconds left to pay, floored at zero. Counted against the resort's clock
// rather than this device's — see serverNow().
export function paymentMsRemaining(booking, now = serverNow()) {
    if (!isPaymentWindowTracked(booking)) return 0
    return Math.max(0, booking.paymentDueAt - now)
}

// Has this guest already sent money against the booking? True from the moment a
// receipt is uploaded — before staff have looked at it — because from the
// guest's side the payment has been made either way, and the resort is holding
// it. Works on a single booking and on a combined reservation: both carry the
// same three fields.
export function hasPaidSomething(booking) {
    return (
        Boolean(booking?.hasReceipt) ||
        Number(booking?.paidSubmitted ?? 0) > 0 ||
        booking?.payment === 'down-payment' ||
        booking?.payment === 'paid-full'
    )
}

// Whether the guest may still call this off themselves. Two things stop them,
// and each stops them for its own reason:
//
//   • A stay that is over cannot be un-taken.
//   • A booking that has been paid for is now a conversation with a person.
//     Cancelling it from the phone would release the unit while the resort
//     still holds the down payment against a stay that no longer exists, which
//     is the situation booking_policies has always warned about ("Cancellation
//     is no longer allowed once the down payment has been made") and nothing
//     used to enforce.
//
// The same rule is in Postgres — cancel_my_booking() and cancel_booking_group()
// refuse a row with a receipt on it (see
// supabase/migrations/20260811120000_my_booking_cms.sql) — so this is what the
// guest is SHOWN, not what holds the line. Staff cancelling from the dashboard
// write the table directly and are deliberately not bound by either.
export function canGuestCancel(booking) {
    if (!booking) return false
    if (getBookingStage(booking) === 'completed') return false
    return !hasPaidSomething(booking)
}

// Cancelled because nobody paid in time, as opposed to cancelled on purpose.
// The guest did not do this and should not be told they did.
export function wasCancelledByPaymentTimeout(booking) {
    return (
        booking?.status === 'cancelled' &&
        booking?.cancelReason === PAYMENT_TIMEOUT_REASON
    )
}

// Ask Postgres to cancel every hold whose window has closed — its own, and
// everyone else's. Idempotent, and it can only touch rows already lapsed by the
// server's clock, so calling it early cancels nothing.
async function sweepExpiredBookings() {
    if (!isSupabaseConfigured) return 0
    const [bookingsResult, groupsResult] = await Promise.all([
        supabase.rpc('expire_stale_bookings'),
        // Only flips booking_groups.status — the member `bookings` rows are
        // already caught by the call above, whatever table they belong to.
        // See the migration header for why that's enough.
        supabase.rpc('expire_stale_booking_groups'),
    ])
    if (bookingsResult.error) {
        console.error('Could not release expired bookings:', bookingsResult.error.message)
    }
    if (groupsResult.error) {
        console.error('Could not release expired group reservations:', groupsResult.error.message)
    }
    const expired = Number(bookingsResult.data ?? 0) + Number(groupsResult.data ?? 0)
    // Units came back on the market; every cached count is now wrong.
    if (expired > 0) clearCaches()
    return expired
}

// The sweep plus a re-read, for the caller who needs to SEE the result — the
// guest whose own countdown just reached zero, whose card should say cancelled
// without waiting for the next poll.
export async function expireStaleBookings() {
    const expired = await sweepExpiredBookings()
    await loadMyBookings()
    await loadMyBookingGroups()
    if (expired > 0 && staffSession) {
        await loadStaffBookings()
        await loadStaffBookingGroups()
    }
    return { ok: true, expired }
}

async function addAddon(bookingId, kind, order) {
    const { data, error } = await supabase.rpc('add_booking_addon', {
        p_booking_id: bookingId,
        p_kind: kind,
        p_order: order,
        // Without this the call is refused: knowing a booking id is no longer
        // enough to attach an order to it.
        p_owner_token: getOwnerToken(),
    })
    if (error) {
        console.error(`Could not add ${kind} order:`, error.message)
        return { ok: false, message: error.message }
    }
    const row = Array.isArray(data) ? data[0] : data
    upsertLocal(fromRow(row))
    return { ok: true }
}

export function addFoodOrder(bookingId, order) {
    return addAddon(bookingId, 'food', order)
}

export function addSpaOrder(bookingId, order) {
    return addAddon(bookingId, 'spa', order)
}

export function addItemOrder(bookingId, order) {
    return addAddon(bookingId, 'item', order)
}

// Same as addAddon() above, for a combined reservation — the order goes on
// the group's own row, not any one of its units.
async function addGroupAddon(groupId, kind, order) {
    const { data, error } = await supabase.rpc('add_group_addon', {
        p_group_id: groupId,
        p_kind: kind,
        p_order: order,
        p_owner_token: getOwnerToken(),
    })
    if (error) {
        console.error(`Could not add ${kind} order:`, error.message)
        return { ok: false, message: error.message }
    }
    const row = Array.isArray(data) ? data[0] : data
    // add_group_addon() doesn't return `units` — carry over what this device
    // already knows about the reservation rather than lose it on this update.
    const existing = myBookingGroups.find((g) => g.id === row.id)
    upsertLocalGroup(fromGroupRow({ ...row, units: existing?.units ?? [] }))
    return { ok: true }
}

export function addFoodOrderToGroup(groupId, order) {
    return addGroupAddon(groupId, 'food', order)
}

export function addSpaOrderToGroup(groupId, order) {
    return addGroupAddon(groupId, 'spa', order)
}

export function addItemOrderToGroup(groupId, order) {
    return addGroupAddon(groupId, 'item', order)
}

// ------------------------------------------------------------ derived status
// 'pending' bookings stay pending until staff act on them; only a verified
// ('upcoming') stay can lapse into 'active' and then 'completed'.
export function getBookingStage(booking, now = Date.now()) {
    if (booking.status === 'cancelled') return 'cancelled'
    if (booking.status !== 'upcoming' && booking.status !== 'completed') return 'pending'
    if (booking.endsAt != null && booking.endsAt < now) return 'completed'
    if (booking.startsAt != null && booking.startsAt <= now) return 'active'
    return 'upcoming'
}

export function isBookingActive(booking) {
    const stage = getBookingStage(booking)
    return stage !== 'cancelled' && stage !== 'completed'
}

// The admin overview tabs and the bookings table read through this.
// A single-unit reservation's own row, or the whole `bookings` table for
// occupancy — but never a combined reservation's member units, which would
// otherwise list (and let staff "Approve") the same reservation once per
// unit. A group reservation belongs on this list through booking_groups, not
// through its members — see bookingsManage.jsx, which does that merge itself.
function matchesBookingFilter(entry, filter) {
    if (filter === 'all') return true
    const stage = getBookingStage(entry)
    switch (filter) {
        case 'upcomming':
        case 'upcoming':
            return stage === 'upcoming'
        case 'active':
            return stage === 'active'
        case 'completed':
            return stage === 'completed'
        case 'cancelled':
            return stage === 'cancelled'
        case 'pending':
            return stage === 'pending'
        case 'paid-full':
            return entry.payment === 'paid-full' && stage !== 'cancelled'
        case 'down-payment':
            return entry.payment === 'down-payment' && stage !== 'cancelled'
        default:
            return true
    }
}

// Single-unit reservations and combined reservations, merged and filtered the
// same way — a group's member units are never in this list on their own (see
// fromRow()'s groupId), only once, via its booking_groups row. Newest first,
// which concatenating two already-sorted arrays doesn't give you on its own.
export function listBookings(filter = 'all') {
    return [
        ...bookings.filter((booking) => booking.groupId == null),
        ...bookingGroups,
    ]
        .filter((entry) => matchesBookingFilter(entry, filter))
        .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
}

// One booking or one group reservation counted the same way — a combined
// reservation is one entry here regardless of how many units it holds,
// exactly like it is one row in bookingsManage.jsx and one card in My
// Bookings. `total`/`downpayment`/`payment` mean the same thing on both
// shapes (fromRow() and fromGroupRow() agree on that), so this needs no
// branching between them.
function accumulateBookingStats(entry, stats) {
    const stage = getBookingStage(entry)
    if (stage === 'cancelled') return
    stats.totalBooking += 1
    if (stage === 'upcoming') stats.upcomming += 1
    if (stage === 'active') stats.active += 1
    if (entry.payment === 'paid-full') stats.revenue += entry.total ?? 0
    else if (entry.payment === 'down-payment') stats.revenue += entry.downpayment ?? 0
    if (stage === 'pending' || entry.payment === 'unpaid') stats.pendingPayment += 1
}

export function getBookingStats() {
    const stats = { totalBooking: 0, upcomming: 0, active: 0, revenue: 0, pendingPayment: 0 }

    // A group's member units are excluded here (see listBookings()) since the
    // reservation itself is counted below, via bookingGroups.
    for (const booking of bookings) {
        if (booking.groupId == null) accumulateBookingStats(booking, stats)
    }
    for (const group of bookingGroups) {
        accumulateBookingStats(group, stats)
    }

    return stats
}

// ------------------------------------------------------ add-on order views
// The food and spa orders a guest placed live as JSONB on their booking row
// (bookings.food_orders / spa_orders), because they are only ever read with
// their booking. The admin dashboard, though, wants them the other way round:
// "what is the kitchen making" and "which treatments were availed". These two
// selectors are that turn, so no screen has to dig through booking rows itself.
//
// Both read the ADMIN list, so they answer with nothing at all without a staff
// session — the same reason the overview tabs come up empty rather than wrong.

// Which field on a booking each kind's lines live in — one place, so adding
// a fourth kind later is this one line plus a catalog table, not a hunt
// through every ternary that used to hardcode 'food' vs 'spa'.
const ADDON_KIND_FIELDS = { food: 'foodOrders', spa: 'spaOrders', item: 'itemOrders' }
const ADDON_KINDS = Object.keys(ADDON_KIND_FIELDS)

// A booking's add-on lines are ordered oldest-first on the row; the dashboard
// wants the newest order at the top.
function addonLines(booking, kind) {
    const orders = booking[ADDON_KIND_FIELDS[kind]]
    return (orders ?? []).map((order, index) => ({
        // Two guests can order the same dish in the same second, and one guest
        // can order it twice — the booking and the line's own position are what
        // make a stable key.
        key: `${booking.id}-${kind}-${index}`,
        kind,
        bookingId: booking.id,
        code: booking.code ?? booking.id,
        guestName: booking.guest?.fullName || 'Guest',
        guestMobile: booking.guest?.mobile ?? '',
        accomodationName: booking.isGroup
            ? (groupUnitsLabel(booking.units) || 'Combined reservation')
            : booking.accomodationName,
        unitId: booking.isGroup ? null : booking.unitId,
        checkIn: booking.checkIn,
        stage: getBookingStage(booking),
        // Null on orders placed before the catalog existed, and on a line whose
        // menu row has since been deleted — the name is still the truth of what
        // was ordered, so it is what the screens fall back to displaying.
        itemId: order.itemId ?? null,
        name: order.name,
        quantity: Number(order.quantity ?? 0),
        unitPrice: Number(order.unitPrice ?? 0),
        total: Number(order.total ?? 0),
        orderedAt: order.orderedAt ?? null,
    }))
}

// Single-unit bookings and combined reservations — a group's member units
// never carry add-ons of their own (add_group_addon() only ever writes to the
// group's row), but they're excluded on principle same as everywhere else
// that reads this pair of arrays.
function addonableBookings() {
    return [
        ...bookings.filter((booking) => booking.groupId == null),
        ...bookingGroups,
    ]
}

// Every add-on line across every booking, newest first.
// `kind` is 'all' | 'food' | 'spa' | 'item'.
export function listAddonOrders(kind = 'all') {
    const kinds = kind === 'all' ? ADDON_KINDS : [kind]
    const lines = []
    for (const booking of addonableBookings()) {
        if (getBookingStage(booking) === 'cancelled') continue
        for (const oneKind of kinds) lines.push(...addonLines(booking, oneKind))
    }
    return lines.sort((a, b) => new Date(b.orderedAt ?? 0) - new Date(a.orderedAt ?? 0))
}

// The same lines grouped back under the booking that placed them — one card per
// guest rather than one row per dish. Bookings with no add-ons of the requested
// kind drop out entirely, which is what makes the dashboard's Food, Spa and
// Add-ons tabs different lists rather than the same list with empty cards in it.
export function listBookingsWithAddons(kind = 'all') {
    const kinds = kind === 'all' ? ADDON_KINDS : [kind]
    return addonableBookings()
        .filter((booking) => getBookingStage(booking) !== 'cancelled')
        .map((booking) => {
            const food = kinds.includes('food') ? addonLines(booking, 'food') : []
            const spa = kinds.includes('spa') ? addonLines(booking, 'spa') : []
            const items = kinds.includes('item') ? addonLines(booking, 'item') : []
            return {
                booking,
                food,
                spa,
                items,
                foodTotal: food.reduce((sum, line) => sum + line.total, 0),
                spaTotal: spa.reduce((sum, line) => sum + line.total, 0),
                itemsTotal: items.reduce((sum, line) => sum + line.total, 0),
            }
        })
        .filter((entry) => entry.food.length > 0 || entry.spa.length > 0 || entry.items.length > 0)
}

// Add-on lines rolled up per catalog item: how many were ordered, what they
// came to, and which guests are waiting on them. Falls back to grouping by name
// for the older orders that carry no itemId.
export function summariseAddonOrders(kind) {
    const summary = new Map()

    for (const line of listAddonOrders(kind)) {
        const key = line.itemId ?? `name:${line.name}`
        if (!summary.has(key)) {
            summary.set(key, {
                key,
                itemId: line.itemId,
                name: line.name,
                quantity: 0,
                total: 0,
                guests: [],
            })
        }
        const entry = summary.get(key)
        entry.quantity += line.quantity
        entry.total += line.total
        entry.guests.push(line)
    }

    return [...summary.values()].sort((a, b) => b.quantity - a.quantity)
}

// The most recent booking food/spa add-ons can attach to: any live one.
//
// It used to have to carry a receipt as well. That requirement made sense while
// paying came first, but payment now happens after the booking and the down
// payment includes the add-ons — so demanding a receipt up front would make it
// impossible to order the very things the payment is supposed to cover.
export function findOrderableBooking() {
    // This device's own bookings only. Reading the admin list here would let a
    // signed-in staff member's food order attach itself to whichever guest
    // happened to be at the top of the table.
    //
    // Single-unit bookings and combined reservations merged, newest first —
    // a guest whose only live reservation is a group of Teepees needs this to
    // find it too, not just an ordinary one-unit booking.
    const merged = [...myBookings, ...myBookingGroups].sort(
        (a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0)
    )
    return merged.find((booking) => isBookingActive(booking)) ?? null
}

// True once a staff session is reading the real booking rows. The admin
// dashboard uses this to explain an empty board rather than look broken.
export function hasStaffSession() {
    return staffSession
}

// ======================================================= accommodation CRUD
//
//  The dashboard's Units → Manage tab writes through here: add an
//  accommodation, change what it costs under each schedule, change how many of
//  it exist, or take it off the market.
//
//  WHAT THIS MODULE DOES NOT DO
//  ----------------------------
//  It does not create or delete accommodation_units. `total` is the number
//  staff edit, and a trigger in Postgres makes the unit rows match it — see
//  supabase/migrations/20260803140000_catalog_crud.sql. Doing it here instead
//  would mean a browser that closed mid-save could leave a type claiming four
//  units with three rows behind it, and availability is counted from the rows.
//
//  Nor is it the permission check: only the staff roster may write these
//  tables, and that is a policy in Postgres. A guest calling these gets
//  refused by the database, not by this file.

// The editable catalog: every type including the ones taken off the market,
// with their rates. Separate from ACCOMMODATION_TYPES for the same reason the
// menu keeps two lists — the guest-facing one must never show a hidden unit.
let adminAccommodations = { types: [], rates: [], loaded: false, error: null }

function getAdminAccommodations() {
    return adminAccommodations
}

export function useAdminAccommodations() {
    return useSyncExternalStore(subscribeBookings, getAdminAccommodations)
}

export async function loadAdminAccommodations() {
    if (!isSupabaseConfigured) {
        adminAccommodations = { ...adminAccommodations, loaded: true, error: SUPABASE_SETUP_MESSAGE }
        notify()
        return
    }

    const [types, rates, units] = await Promise.all([
        supabase.from('accommodation_types').select('*').order('sort_order'),
        supabase.from('accommodation_rates').select('*'),
        supabase.from('accommodation_units').select('id, type_id, unit_no, is_active').order('unit_no'),
    ])

    const error = types.error ?? rates.error ?? units.error
    if (error) {
        console.error('Could not load the accommodation catalog for editing:', error.message)
        adminAccommodations = { ...adminAccommodations, loaded: true, error: describeSupabaseError(error) }
        notify()
        return
    }

    // Units are counted per type here rather than listed: the Manage tab is
    // about what the resort sells, and the per-unit board next to it is the
    // place that shows TPE-01 by name.
    const unitCount = new Map()
    for (const unit of units.data) {
        if (!unit.is_active) continue
        unitCount.set(unit.type_id, (unitCount.get(unit.type_id) ?? 0) + 1)
    }

    adminAccommodations = {
        types: types.data.map((row) => ({
            id: row.id,
            name: row.name,
            prefix: row.prefix,
            total: row.total,
            imageUrl: row.image_url ?? null,
            poolId: row.pool_id ?? null,
            description: row.description ?? '',
            features: Array.isArray(row.features) ? row.features : [],
            gallery: Array.isArray(row.gallery) ? row.gallery.filter(Boolean) : [],
            sortOrder: row.sort_order ?? 0,
            isActive: row.is_active !== false,
            // What actually exists behind `total`. A type sharing another's
            // pool owns none of its own, and that is worth showing rather than
            // reading as a bug.
            unitCount: unitCount.get(row.id) ?? 0,
        })),
        rates: rates.data.map((row) => ({
            typeId: row.type_id,
            rateGroup: row.rate_group,
            price: Number(row.price),
            promoPrice: row.promo_price == null ? null : Number(row.promo_price),
            promoActive: row.promo_active === true,
            paxLabel: row.pax_label ?? null,
            minPax: row.min_pax ?? null,
            maxPax: row.max_pax ?? null,
        })),
        loaded: true,
        error: null,
    }
    notify()
}

function slugifyId(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
}

// Create or edit an accommodation. `prefix` is only read when creating: unit
// ids are built from it and bookings point at those ids, so renaming one after
// the fact would orphan every unit the type already has.
export async function saveAccommodationType(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const name = String(draft.name ?? '').trim()
    if (!name) return { ok: false, message: 'Give the accommodation a name.' }

    const total = Math.floor(Number(draft.total))
    if (!Number.isFinite(total) || total < 1) {
        return { ok: false, message: 'How many of this unit exist? Enter 1 or more.' }
    }

    const isNew = !draft.id
    const id = draft.id || slugifyId(name)
    if (!id) return { ok: false, message: 'That name has no letters or numbers in it.' }

    const row = {
        id,
        name,
        total,
        image_url: String(draft.imageUrl ?? '').trim() || null,
        description: String(draft.description ?? '').trim() || null,
        // The "What's Included" list, typed one per line. Blank lines are
        // dropped rather than stored as empty bullets.
        features: String(draft.features ?? '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        // The carousel's extra photos, in the order the dashboard listed them.
        // Stored as given: reordering IS the edit, so nothing is sorted here.
        gallery: (Array.isArray(draft.gallery) ? draft.gallery : [])
            .map((url) => String(url ?? '').trim())
            .filter(Boolean),
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    // INSERT and UPDATE, not upsert. An upsert always builds a whole row and
    // resolves the conflict afterwards, so a partial payload is a partial
    // INSERT first — and this table's `prefix` is NOT NULL and deliberately
    // absent from an edit, which made every edit fail on the constraint before
    // Postgres ever reached the "on conflict, update" half. An UPDATE touches
    // only the columns given, which is what editing an accommodation means.
    let error
    let updated = null
    if (isNew) {
        if (adminAccommodations.types.some((type) => type.id === id)) {
            return { ok: false, message: `There is already an accommodation called “${name}”.` }
        }
        const prefix = String(draft.prefix ?? '').trim().toUpperCase()
        if (!prefix) return { ok: false, message: 'Enter a unit prefix, e.g. TPE for TPE-01.' }
        if (adminAccommodations.types.some((type) => type.prefix === prefix)) {
            return { ok: false, message: `The prefix ${prefix} is already used by another accommodation.` }
        }
        row.prefix = prefix
        // Null unless the new type is meant to share an existing pool of
        // physical slots, the way Tent Pitching shares the tents'.
        row.pool_id = String(draft.poolId ?? '').trim() || null
        ;({ error } = await supabase.from('accommodation_types').insert(row))
    } else {
        // `prefix` and `pool_id` are not in `row`, so an edit cannot rename the
        // units bookings point at or move a type off its shared pool.
        //
        // `.select()` is what turns "nothing happened" into an answer: an
        // UPDATE that matches no row is not an error in Postgres, so without
        // reading back what changed, a save that quietly did nothing would
        // report success and the edit would appear to vanish.
        ;({ error, data: updated } = await supabase
            .from('accommodation_types')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the accommodation:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that accommodation no longer exists, or this account '
                + 'is not on the staff roster.',
        }
    }

    await Promise.all([loadCatalog(), loadAdminAccommodations()])
    return { ok: true, id }
}

// Removing a type takes its rates and its unused units with it (both cascade).
// A unit that a booking points at does not cascade — Postgres refuses, and it
// should: the reservation is a promise the resort made. Hiding it is the answer
// there, which is what the message says.
export async function deleteAccommodationType(id) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { error } = await supabase.from('accommodation_types').delete().eq('id', id)
    if (error) {
        console.error('Could not delete the accommodation:', error.message)
        const blocked = error.code === '23503' || /foreign key|violates/i.test(error.message ?? '')
        return {
            ok: false,
            message: blocked
                ? 'This accommodation has bookings on it, so it cannot be deleted. '
                  + 'Switch it to Hidden instead — it stops being offered and the existing stays keep their unit.'
                : describeSupabaseError(error),
        }
    }

    await Promise.all([loadCatalog(), loadAdminAccommodations()])
    return { ok: true }
}

// The price and pax range for one (accommodation, schedule group). Saving one
// is also what puts a unit on sale under that group in the first place.
//
// A promo does NOT go into `price`. The standing rate stays where it is and the
// promo sits beside it, so ending the promo is a checkbox and raising the
// standing rate later is an ordinary edit of the price field — see the header of
// supabase/migrations/*_accommodation_promo_price.sql.
export async function saveAccommodationRate(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const typeId = String(draft.typeId ?? '').trim()
    const rateGroup = String(draft.rateGroup ?? '').trim()
    if (!typeId || !rateGroup) return { ok: false, message: 'Pick an accommodation and a schedule group.' }

    const price = Number(draft.price)
    if (!Number.isFinite(price) || price < 0) return { ok: false, message: 'Enter a price of 0 or more.' }

    // Kept even while the promo is off, so running the same promo again next
    // weekend is one checkbox rather than typing the number back in.
    const promoActive = draft.promoActive === true
    const promoBlank = draft.promoPrice === '' || draft.promoPrice == null
    const promoPrice = promoBlank ? null : Number(draft.promoPrice)

    if (!promoBlank && (!Number.isFinite(promoPrice) || promoPrice < 0)) {
        return { ok: false, message: 'Enter a promo price of 0 or more, or leave it blank.' }
    }
    // Refused rather than saved and quietly ignored: a "promo" at or above the
    // standing rate strikes through the smaller number on the card, which reads
    // to a guest as a price increase dressed up as a discount.
    if (promoPrice != null && promoPrice >= price) {
        return { ok: false, message: 'The promo price has to be lower than the original price.' }
    }
    if (promoActive && promoPrice == null) {
        return { ok: false, message: 'Enter the promo price before turning the promo on.' }
    }

    const minPax = draft.minPax === '' || draft.minPax == null ? null : Math.floor(Number(draft.minPax))
    const maxPax = draft.maxPax === '' || draft.maxPax == null ? null : Math.floor(Number(draft.maxPax))
    if (minPax != null && maxPax != null && minPax > maxPax) {
        return { ok: false, message: 'The smallest group size cannot be larger than the largest.' }
    }

    const { error } = await supabase.from('accommodation_rates').upsert({
        type_id: typeId,
        rate_group: rateGroup,
        price: Math.round(price * 100) / 100,
        promo_price: promoPrice == null ? null : Math.round(promoPrice * 100) / 100,
        promo_active: promoActive,
        // What the card shows. Written for staff rather than derived, because
        // 'Any group size' is a real answer and '2-3 Pax' is how the printed
        // rate card words the same thing.
        pax_label: String(draft.paxLabel ?? '').trim() || null,
        min_pax: Number.isFinite(minPax) ? minPax : null,
        max_pax: Number.isFinite(maxPax) ? maxPax : null,
    })

    if (error) {
        console.error('Could not save the rate:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    await Promise.all([loadCatalog(), loadAdminAccommodations()])
    return { ok: true }
}

// Stop offering a unit under one schedule group without touching the other.
export async function deleteAccommodationRate(typeId, rateGroup) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { error } = await supabase
        .from('accommodation_rates')
        .delete()
        .eq('type_id', typeId)
        .eq('rate_group', rateGroup)

    if (error) {
        console.error('Could not remove the rate:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    await Promise.all([loadCatalog(), loadAdminAccommodations()])
    return { ok: true }
}
