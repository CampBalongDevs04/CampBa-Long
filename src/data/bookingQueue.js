// ============================================================================
//  Camp Ba-long — the queue for a unit somebody else is holding
// ----------------------------------------------------------------------------
//  WHAT THIS IS FOR
//  ----------------
//  A booking holds its unit for ten minutes while the guest pays. During those
//  ten minutes the unit is not available and not booked either, and the guest
//  who arrives second deserves a better answer than "fully booked":
//
//      "A-House Family is held by another guest for the next 9 minutes.
//       You are 1st in line — we will try again for you the moment it frees."
//
//  This module is the client half of that. The line itself lives in Postgres
//  (supabase/migrations/*_booking_hold_queue.sql) because it decides who gets
//  the unit, and that decision cannot live somewhere a guest can edit.
//
//  WHAT IT DOES NOT DECIDE
//  -----------------------
//  Everything. Ordering, promotion, expiry and the exclusive claim are all
//  server-side; every function here is a thin call plus the mapping from
//  snake_case rows to the shape the components read. A browser that stops
//  polling loses its place after ninety seconds — which is the intended
//  behaviour for a closed tab, not something this file has to enforce.
//
//  WHY POLLING RATHER THAN REALTIME
//  --------------------------------
//  The same reason availability counts are polled (see accommodationDB.js):
//  Realtime honours RLS, and an anonymous guest is not allowed to be told about
//  rows in `bookings` or `booking_queue`. Polling booking_queue_status() gets
//  the guest their own place and nobody else's — and, deliberately, doubles as
//  the heartbeat that proves they are still waiting and the tick that promotes
//  the front of the line. There is no cron on this project; the guests watching
//  the queue are the clock.
// ============================================================================

import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'
import { getOwnerToken } from './bookingOwner.js'
import {
    toISODate,
    getSchedule,
    syncServerClock,
    invalidateAvailability,
} from './accommodationDB.js'

// How often a waiting guest asks where they are in line. Every poll is also a
// heartbeat and a nudge to promote the line, so this is not just a refresh
// rate — it is how quickly a freed unit reaches the person waiting for it.
// Five seconds is well inside the server's ninety-second heartbeat allowance,
// so a few dropped requests cost nobody their place.
export const QUEUE_POLL_MS = 5000

// Milliseconds to epoch, or null. Every timestamp out of Postgres comes through
// here, so a malformed one becomes "unknown" instead of NaN on a countdown.
function toMs(value) {
    if (!value) return null
    const ms = new Date(value).getTime()
    return Number.isNaN(ms) ? null : ms
}

// One row of join / status into the shape the panel renders.
function fromQueueRow(row) {
    if (!row) return null
    // Sent by every call, and the only clock the countdown may trust — the
    // guest has no booking yet, so nothing else is correcting for device skew.
    syncServerClock(row.server_now)

    return {
        id: row.entry_id,
        // 'waiting' | 'ready' | 'booked' | 'left' | 'expired'
        status: row.status,
        // 1 means next. `ahead` is the same fact phrased for a sentence.
        place: Number(row.place ?? 1),
        ahead: Number(row.ahead ?? 0),
        waiting: Number(row.waiting ?? 1),
        // A unit is this guest's right now, until claimUntil.
        ready: Boolean(row.ready),

        freeUnits: Number(row.free_units ?? 0),
        heldUnits: Number(row.held_units ?? 0),
        bookedUnits: Number(row.booked_units ?? 0),

        // When the earliest hold lapses. Null once something is already free.
        releasesAt: toMs(row.releases_at),
        // The deadline on this guest's own exclusive claim.
        claimUntil: toMs(row.claim_until),
        // The single moment the panel counts down to: when to try again.
        retryAt: toMs(row.retry_at),
    }
}

// Is this stay type held rather than genuinely booked out? Answers the question
// without joining anything, which is what the booking form needs the moment
// book_accommodation() refuses it.
export async function readHoldConflict({ typeId, checkIn, checkOut = null, scheduleKey = null }) {
    if (!isSupabaseConfigured || !typeId || !checkIn) return null

    const schedule = getSchedule(scheduleKey)
    const effectiveCheckOut = schedule?.sameDay ? checkIn : (checkOut ?? checkIn)

    const { data, error } = await supabase.rpc('hold_conflict', {
        p_type_id: typeId,
        p_check_in: toISODate(checkIn),
        p_check_out: toISODate(effectiveCheckOut),
        p_schedule_key: scheduleKey,
    })

    if (error) {
        console.error('Could not read the hold on that unit:', error.message)
        return null
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null
    syncServerClock(row.server_now)

    return {
        totalUnits: Number(row.total_units ?? 0),
        freeUnits: Number(row.free_units ?? 0),
        heldUnits: Number(row.held_units ?? 0),
        bookedUnits: Number(row.booked_units ?? 0),
        releasesAt: toMs(row.releases_at),
        // The distinction the whole feature turns on: waiting will get you this
        // unit, versus waiting will get you nothing.
        isHeld: Number(row.held_units ?? 0) > 0 && row.releases_at != null,
    }
}

// Take a place in line. Safe to call twice — the database hands back the
// existing entry rather than putting the guest behind themselves, so a reload
// or a retried request never costs them their place.
export async function joinQueue({
    typeId,
    scheduleKey,
    checkIn,
    checkOut = null,
    guestName = null,
}) {
    if (!isSupabaseConfigured) {
        return { ok: false, message: SUPABASE_SETUP_MESSAGE }
    }
    if (!typeId || !scheduleKey || !checkIn) {
        return { ok: false, message: 'Pick your dates and a unit before joining the queue.' }
    }

    const schedule = getSchedule(scheduleKey)
    const effectiveCheckOut = schedule?.sameDay ? checkIn : (checkOut ?? checkIn)

    const { data, error } = await supabase.rpc('join_booking_queue', {
        p_type_id: typeId,
        p_schedule_key: scheduleKey,
        p_check_in: toISODate(checkIn),
        p_check_out: toISODate(effectiveCheckOut),
        p_guest_name: guestName,
        // Same bearer token that owns this device's bookings. A place in line
        // for the last unit is worth stealing, so it is protected identically.
        p_owner_token: getOwnerToken(),
    })

    if (error) {
        console.error('Could not join the booking queue:', error.message)
        return { ok: false, message: `Could not hold your place in line: ${describeSupabaseError(error)}` }
    }

    return { ok: true, entry: fromQueueRow(Array.isArray(data) ? data[0] : data) }
}

// Where am I? Also the heartbeat that proves this browser is still waiting, and
// the tick that moves the line along for everybody — see the header.
export async function pollQueue(entryId) {
    if (!isSupabaseConfigured || !entryId) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase.rpc('booking_queue_status', {
        p_entry_id: entryId,
        p_owner_token: getOwnerToken(),
    })

    if (error) {
        console.error('Could not check your place in line:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    const entry = fromQueueRow(Array.isArray(data) ? data[0] : data)

    // A unit came back on the market. Every cached availability count was taken
    // before that happened, so the carousel behind this panel is now wrong.
    if (entry?.freeUnits > 0) invalidateAvailability()

    return { ok: true, entry }
}

// Give up the place now rather than ninety seconds from now. Everyone behind
// moves up immediately, which is the only reason this exists — closing the tab
// would get there on its own.
export async function leaveQueue(entryId) {
    if (!isSupabaseConfigured || !entryId) return { ok: true }

    const { error } = await supabase.rpc('leave_booking_queue', {
        p_entry_id: entryId,
        p_owner_token: getOwnerToken(),
    })

    if (error) {
        console.error('Could not leave the booking queue:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }
    return { ok: true }
}
