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

// Share of the unit rate collected upfront; the balance is paid on-site.
export const DOWNPAYMENT_RATE = 0.5

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
export const ACCOMMODATION_TYPES = [
    { id: 'teepee', name: 'Teepee', prefix: 'TPE', total: 2, image: null },
    { id: 'small', name: 'A-House Small', prefix: 'AHS', total: 3, image: null },
    { id: 'medium', name: 'A-House Medium', prefix: 'AHM', total: 2, image: null },
    { id: 'family', name: 'A-House Family', prefix: 'AHF', total: 1, image: null },
    { id: 'tent-small', name: 'Small Tent', prefix: 'TENTS', total: 3, image: null },
    { id: 'tent-large', name: 'Big Tent', prefix: 'TENTL', total: 1, image: null },
    { id: 'cottage', name: 'Cottage', prefix: 'COT', total: 2, image: null },
    { id: 'pavilion', name: 'Pavillion', prefix: 'PAV', total: 1, image: null },
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
        note: 'Check-in/out is fixed by schedule: 10:00 AM to 5:00 PM. Late arrivals are not allowed.',
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
        note: 'Please arrive or depart early to avoid a late check-in. By schedule: 10:00 AM - 8:00 AM. Late arrivals are not allowed.',
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
        note: 'Please arrive or depart early to avoid a late check-in. By schedule: 7:00 PM - 5:00 PM. Late arrivals are not allowed.',
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

export function listUnitIds(idOrPrefix) {
    const type = findAccommodationType(idOrPrefix)
    if (!type) return []
    const fromDb = unitsByType.get(type.id)
    if (fromDb?.length) return fromDb
    // Before the catalog lands, derive the ids the same way the seed does.
    return Array.from(
        { length: type.total },
        (_, index) => `${type.prefix}-${String(index + 1).padStart(2, '0')}`,
    )
}

export function findTypeForUnit(unitId) {
    return findAccommodationType(String(unitId).split('-')[0])
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
// Type-level availability answered by the database, keyed by the query.
const availabilityCache = new Map()
// Queries already in flight, so a re-render storm makes one request, not fifty.
const inFlight = new Set()
const nextFreeCache = new Map()
let unitsByType = new Map()
let staffSession = false

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

// A new array identity is what tells useSyncExternalStore something changed.
function commit(next) {
    bookings = next
    notify()
}

function commitMine(next) {
    myBookings = next
    notify()
}

function touch() {
    commit([...bookings])
}

function clearCaches() {
    availabilityCache.clear()
    nextFreeCache.clear()
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
        createdAt: row.created_at,
    }
}

// Guest-side writes (a new booking, an add-on) land in the guest's own list.
// Never in `bookings` — that array belongs to the admin board.
function upsertLocal(booking) {
    const index = myBookings.findIndex((item) => item.id === booking.id)
    if (index === -1) commitMine([booking, ...myBookings])
    else commitMine(myBookings.map((item) => (item.id === booking.id ? booking : item)))
}

// =================================================================== loading

// The catalog is public (RLS allows anon select), so this always succeeds.
async function loadCatalog() {
    const [types, units] = await Promise.all([
        supabase.from('accommodation_types').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('accommodation_units').select('id, type_id, unit_no').eq('is_active', true).order('unit_no'),
    ])

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

    const next = (data ?? []).map(fromRow)
    if (!sameBookings(myBookings, next)) commitMine(next)
}

// Cheap equality over the fields a guest can see change: staff confirming a
// booking, a cancellation, or an add-on landing.
function sameBookings(a, b) {
    if (a.length !== b.length) return false
    return a.every((booking, index) => {
        const other = b[index]
        return (
            booking.id === other.id &&
            booking.status === other.status &&
            booking.payment === other.payment &&
            booking.unitId === other.unitId &&
            booking.foodOrders.length === other.foodOrders.length &&
            booking.spaOrders.length === other.spaOrders.length
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

    await loadMyBookings()

    if (staffSession) {
        if (!(await loadStaffBookings())) staffSession = false
    } else {
        commit([])
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
    }, AVAILABILITY_TTL_MS)
}

// Without credentials every call would fail on a loop and bury the one useful
// message from supabaseClient.js. The catalog above still renders from its
// built-in defaults, so the pages look right — they just can't take bookings.
if (isSupabaseConfigured) {
    loadCatalog()
    // Realtime is attached only once we know whether this is a staff session.
    loadBookings().then(watchRealtime)
    startRevalidating()
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
        loadMyBookings()    // … the guest's own list is unaffected
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
                if (previous?.available !== row.available || previous?.total !== row.total) {
                    changed = true
                }
                availabilityCache.set(key, { available: row.available, total: row.total, fetchedAt })
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
export function getDayOccupancy(date = new Date()) {
    let total = 0
    let taken = 0
    for (const type of ACCOMMODATION_TYPES) {
        for (const unitId of listUnitIds(type.id)) {
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
// gets stored on the booking row. Called BEFORE the booking is created: an
// upload that fails should leave no reservation behind, and a path that exists
// with no booking is just an orphan file.
//
// The folder is random rather than derived from the booking code, because the
// path is what a signed URL is minted from — a guessable one would let anybody
// with a code ask for someone else's receipt.
export async function uploadReceipt(file) {
    if (!file) return { ok: true, path: null }

    // Checked before the request rather than after it fails. Without keys the
    // upload is aimed at a placeholder host and comes back "Failed to fetch",
    // which reads as a broken storage bucket — this is the one failure whose
    // cause the app already knows for certain, so it says it outright.
    if (!isSupabaseConfigured) {
        console.error('Receipt upload skipped:', SUPABASE_SETUP_MESSAGE)
        return { ok: false, message: SUPABASE_SETUP_MESSAGE }
    }

    const { extension, mime } = receiptFormat(file)
    const path = `${randomKey()}/receipt.${extension}`

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

    const { data, error } = await supabase.rpc('book_accommodation', {
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
        p_price: price,
        p_entrance_total: entrance?.total ?? null,
        // The storage path of the uploaded image. A non-null value is also what
        // flips the booking to 'down-payment'. The marker is the fallback for a
        // caller that only says a receipt exists without uploading one.
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
        // book_accommodation() raises with hint 'unavailable' when the type is
        // full for that schedule; anything else is a genuine failure.
        const unavailable = error.hint === 'unavailable'
            || /fully booked|just taken/i.test(error.message ?? '')
        return {
            ok: false,
            reason: unavailable ? 'unavailable' : 'error',
            message: unavailable
                ? [error.message, error.details].filter(Boolean).join(' ')
                : `Could not save your booking: ${describeSupabaseError(error)}`,
        }
    }

    const row = Array.isArray(data) ? data[0] : data
    const booking = fromRow(row)
    booking.accomodationName = typeName
    clearCaches()
    upsertLocal(booking)

    return { ok: true, booking }
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

// Is this one of the caller's OWN bookings? Decides which write path a
// mutation takes, so a staff member cancelling their own stay from My Bookings
// goes through the ownership RPC rather than the admin's table write.
function ownedByThisDevice(id) {
    return myBookings.some((booking) => booking.id === id)
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

// Frees the unit for those dates again — from either side of the app. Staff
// write the row directly; a guest proves the booking is theirs first, and
// cancel_my_booking() refuses if it is not.
export async function cancelBooking(id) {
    // Someone else's booking on the admin board — the staff write path.
    if (!ownedByThisDevice(id) && staffSession) {
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
export function listBookings(filter = 'all') {
    if (filter === 'all') return bookings
    return bookings.filter((booking) => {
        const stage = getBookingStage(booking)
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
                return booking.payment === 'paid-full' && stage !== 'cancelled'
            case 'down-payment':
                return booking.payment === 'down-payment' && stage !== 'cancelled'
            default:
                return true
        }
    })
}

export function getBookingStats() {
    let upcomming = 0
    let active = 0
    let revenue = 0
    let pendingPayment = 0
    let totalBooking = 0

    for (const booking of bookings) {
        const stage = getBookingStage(booking)
        if (stage === 'cancelled') continue
        totalBooking += 1
        if (stage === 'upcoming') upcomming += 1
        if (stage === 'active') active += 1
        if (booking.payment === 'paid-full') revenue += booking.total ?? 0
        else if (booking.payment === 'down-payment') revenue += booking.downpayment ?? 0
        if (stage === 'pending' || booking.payment === 'unpaid') pendingPayment += 1
    }

    return { totalBooking, upcomming, active, revenue, pendingPayment }
}

// The most recent booking food/spa add-ons can attach to: it needs a receipt
// on file and must not be over or cancelled.
export function findOrderableBooking() {
    // This device's own bookings only. Reading the admin list here would let a
    // signed-in staff member's food order attach itself to whichever guest
    // happened to be at the top of the table.
    return myBookings.find((booking) => booking.hasReceipt && isBookingActive(booking)) ?? null
}

// True once a staff session is reading the real booking rows. The admin
// dashboard uses this to explain an empty board rather than look broken.
export function hasStaffSession() {
    return staffSession
}
