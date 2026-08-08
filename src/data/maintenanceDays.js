// ============================================================================
//  Camp Ba-long — which weekdays the resort closes for maintenance
// ----------------------------------------------------------------------------
//  One row in Postgres (public.maintenance_days), read by the booking calendar
//  and written by the dashboard's Maintenance section. Monday used to be a
//  constant in extendedStay.js; it is a setting now, because the resort wants
//  to close Monday AND Tuesday some weeks and move the closure in others. See
//  the header of supabase/migrations/20260808220000_maintenance_days.sql.
//
//  WHY THE SET IS ALSO A PLAIN MODULE VARIABLE
//  -------------------------------------------
//  isMaintenanceDay() is called from inside loops that build a month of
//  calendar cells and from pure helpers like checkOutForNights() — it has to
//  answer SYNCHRONOUSLY, with no hook and no await. So the loaded days live in
//  a module variable that the store keeps up to date, and `maintenanceDowSet()`
//  reads it. Components that need to REPAINT when staff change the days call
//  useMaintenanceDays() as well; the two are the same fact, read two ways.
//
//  extendedStay.js imports maintenanceDowSet() from here rather than the other
//  way round, so there is no cycle: this module knows nothing about stays.
//
//  0 = Sunday … 6 = Saturday — JavaScript getDay(), and Postgres `dow`. The
//  same integers are stored in the database, which is what keeps the calendar
//  and the constraint that backs it from drifting by one.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

const ROW_ID = 'resort'
const CHANNEL = 'maintenance-days-changes'

export const WEEKDAY_NAMES = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
]

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Monday alone — what the resort has always done, and what the migration seeds.
// Also what every screen falls back to before the row has loaded, so a calendar
// painted in the first few hundred milliseconds greys the same cells it will
// still be greying a moment later.
export const MAINTENANCE_DAYS_FALLBACK = [1]

// The whole week is refused by the database (see the migration): with nothing
// open, no arrival date could ever satisfy the rule, and the booking form would
// turn into a wall no guest could get past.
export const MAX_MAINTENANCE_DAYS = 6

let state = {
    days: MAINTENANCE_DAYS_FALLBACK,
    loaded: false,
    error: null,
}

// The synchronous read. Kept in step with state.days by commit() below.
let dowSet = new Set(MAINTENANCE_DAYS_FALLBACK)

const listeners = new Set()

function notify() {
    for (const listener of listeners) listener()
}

function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

function snapshot() {
    return state
}

function commit(next) {
    state = { ...state, ...next }
    if (next.days) dowSet = new Set(next.days)
    notify()
}

// Subscribe a component to the days. Anything that PAINTS a maintenance day —
// a calendar cell, a note explaining the closure — needs this so it repaints
// when staff save; anything that only asks a question of a date can call
// isMaintenanceDow() directly.
export function useMaintenanceDays() {
    return useSyncExternalStore(subscribe, snapshot)
}

// The synchronous answer, for the pure helpers in extendedStay.js.
export function maintenanceDowSet() {
    return dowSet
}

export function isMaintenanceDow(dow) {
    return dowSet.has(dow)
}

// Every weekday number in the array is a real one, sorted, with no repeats —
// the same shape the database normalises to, applied here so a screen reading
// its own unsaved draft sees what it would see after saving.
export function normaliseDays(days) {
    const clean = new Set()
    for (const value of days ?? []) {
        const dow = Number(value)
        if (Number.isInteger(dow) && dow >= 0 && dow <= 6) clean.add(dow)
    }
    return [...clean].sort((a, b) => a - b)
}

function rowToDays(row) {
    if (!row || !Array.isArray(row.days)) return MAINTENANCE_DAYS_FALLBACK
    return normaliseDays(row.days)
}


// ================================================================== the range

// Is this set of days one unbroken run around the week, and if so where does it
// start and end? Saturday–Monday counts: the week is a circle, and a closure
// that straddles the weekend is the same kind of thing as one that doesn't.
//
// Answers null for the empty set, the full week, and anything with a gap in it
// (Monday and Thursday) — those are real configurations, they are just not
// ranges, and the editor says "Custom" rather than inventing a range for them.
export function maintenanceRange(days) {
    const list = normaliseDays(days)
    if (list.length === 0 || list.length === 7) return null

    const set = new Set(list)
    // The run's first day is the one whose predecessor is NOT closed. Exactly
    // one of those means exactly one run; two or more means a gap.
    const starts = list.filter((dow) => !set.has((dow + 6) % 7))
    if (starts.length !== 1) return null

    const start = starts[0]
    return { start, end: (start + list.length - 1) % 7 }
}

// Every day from `start` to `end` walking forward, wrapping past Saturday.
// Monday→Tuesday is [1, 2]; Saturday→Monday is [6, 0, 1]; Monday→Monday is the
// single day [1], which is what the resort has today.
export function daysInRange(start, end) {
    const from = Number(start)
    const to = Number(end)
    if (!Number.isInteger(from) || !Number.isInteger(to)) return []
    if (from < 0 || from > 6 || to < 0 || to > 6) return []

    const span = (to - from + 7) % 7
    const days = []
    for (let step = 0; step <= span; step += 1) days.push((from + step) % 7)
    return days.sort((a, b) => a - b)
}

// How the closure reads in a sentence: 'Mondays', 'Monday to Tuesday',
// 'Mondays and Thursdays'. A range says "to" because that is how staff set it;
// a scattering of days is listed, plural, because "Mondays" is the shape those
// sentences already have on the booking page.
export function describeMaintenanceDays(days) {
    const list = normaliseDays(days)
    if (list.length === 0) return 'no maintenance day'
    if (list.length === 7) return 'every day'
    if (list.length === 1) return `${WEEKDAY_NAMES[list[0]]}s`

    const range = maintenanceRange(list)
    if (range) return `${WEEKDAY_NAMES[range.start]} to ${WEEKDAY_NAMES[range.end]}`

    const names = list.map((dow) => `${WEEKDAY_NAMES[dow]}s`)
    return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

// The same thing as a noun a sentence can put "on" in front of: 'a Monday',
// 'a Monday or Tuesday'. Used where the page is talking about one date rather
// than the weekly pattern.
export function describeMaintenanceDayNames(days) {
    const list = normaliseDays(days)
    if (list.length === 0) return 'a maintenance day'
    const names = list.map((dow) => WEEKDAY_NAMES[dow])
    if (names.length === 1) return `a ${names[0]}`
    return `a ${names.slice(0, -1).join(', ')} or ${names.at(-1)}`
}


// =================================================================== reading

export async function loadMaintenanceDays() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const { data, error } = await supabase
        .from('maintenance_days')
        .select('days')
        .eq('id', ROW_ID)
        .maybeSingle()

    if (error) {
        // Not worth a message on the booking page: Monday is already greyed out
        // and that is what the resort has been doing all along. The dashboard
        // does surface `error`, because there it answers "why did nothing I
        // saved show up".
        console.error('Could not load the maintenance days:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    commit({ days: rowToDays(data), loaded: true, error: null })
}


// =================================================================== writing

// Staff write. The row is seeded by the migration, so this is always an update
// — and `.select()` is what turns an update that matched nothing into an answer
// rather than a silent success, the same reasoning as every other store here.
export async function saveMaintenanceDays(days) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const clean = normaliseDays(days)

    if (clean.length > MAX_MAINTENANCE_DAYS) {
        return {
            ok: false,
            message: 'Leave at least one day open. Closing all seven would mean no guest '
                + 'could arrive on any date, and the booking form would refuse every stay.',
        }
    }

    const { data, error } = await supabase
        .from('maintenance_days')
        .update({ days: clean })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the maintenance days:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'maintenance days migration has not been applied to this database yet.',
        }
    }

    await loadMaintenanceDays()
    return { ok: true }
}


// =================================================================== realtime

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'maintenance_days' },
            loadMaintenanceDays,
        )
        .subscribe()
}

if (isSupabaseConfigured) {
    loadMaintenanceDays()
    watchRealtime()
}
