// ============================================================================
//  Camp Ba-long — when the resort closes for maintenance
// ----------------------------------------------------------------------------
//  One row in Postgres (public.maintenance_days), read by the booking calendar
//  and written by the dashboard's Maintenance section. Monday used to be a
//  constant in extendedStay.js; it is a setting now, because the resort wants
//  to close Monday AND Tuesday some weeks and move the closure in others. See
//  the header of supabase/migrations/20260808220000_maintenance_days.sql.
//
//  TWO KINDS OF CLOSURE, ONE RULE
//  ------------------------------
//  `days` is the WEEKLY pattern — "Mondays", forever, until staff change it.
//  `dates` is a list of INDIVIDUAL dates — "the 8th, 9th and 10th of August",
//  a repainting or a fiesta, closed once and never again. See the header of
//  supabase/migrations/20260810120000_maintenance_dates.sql.
//
//  A date is closed if EITHER says so; nothing anywhere has to care which. That
//  is why isMaintenanceDay() in extendedStay.js is still one question with one
//  answer, and why every rule built on it — the minimum stay from a date, what
//  the calendar greys, what the database refuses — needed no new cases.
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

// One-off dates have no equivalent danger — closing every date in the list
// still leaves every other date open — so this is only a sanity bound on a
// column that would otherwise grow forever. A year of one-off closures is
// already far more than the resort will ever have on the books at once.
export const MAX_MAINTENANCE_DATES = 366

let state = {
    days: MAINTENANCE_DAYS_FALLBACK,
    dates: [],
    loaded: false,
    error: null,
    // False once we have seen a row without a `dates` column — the database
    // this build is talking to has not had 20260810120000_maintenance_dates
    // applied yet. The weekly closure keeps working; the dashboard says why the
    // one-off dates do not.
    supportsDates: true,
}

// The synchronous reads. Kept in step with state by commit() below.
let dowSet = new Set(MAINTENANCE_DAYS_FALLBACK)
let dateSet = new Set()

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
    if (next.dates) dateSet = new Set(next.dates)
    notify()
}

// Subscribe a component to the days. Anything that PAINTS a maintenance day —
// a calendar cell, a note explaining the closure — needs this so it repaints
// when staff save; anything that only asks a question of a date can call
// isMaintenanceDow() directly.
export function useMaintenanceDays() {
    return useSyncExternalStore(subscribe, snapshot)
}

// The synchronous answers, for the pure helpers in extendedStay.js.
export function maintenanceDowSet() {
    return dowSet
}

export function isMaintenanceDow(dow) {
    return dowSet.has(dow)
}

// The one-off dates, as 'YYYY-MM-DD' keys.
export function maintenanceDateSet() {
    return dateSet
}

// Is this exact date one of the one-off closures? Takes a Date or a key; the
// WEEKLY closure is a separate question, and isMaintenanceDay() in
// extendedStay.js is the one that asks both.
export function isMaintenanceDate(value) {
    const key = dateKey(value)
    return key != null && dateSet.has(key)
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


// ============================================================ the single dates

// A date is identified by its LOCAL calendar day, written 'YYYY-MM-DD' — the
// same text Postgres stores in a `date` column, and the same text that comes
// back out of it. Never toISOString(): that converts to UTC first, so an
// evening in Manila becomes the following morning's date and the resort closes
// on the wrong day.
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function dateKey(value) {
    if (value == null) return null
    if (typeof value === 'string') return parseDateKey(value) ? value.slice(0, 10) : null

    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return null
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${month}-${day}`
}

// The key back as a local-midnight Date, or null if it is not a real date.
// February 31st is the case that matters: `new Date(2026, 1, 31)` rolls it
// forward to March 3rd without complaint, and something that silently books a
// different day than it was given is worse than something that refuses.
export function parseDateKey(value) {
    const match = DATE_KEY_PATTERN.exec(String(value ?? '').slice(0, 10))
    if (!match) return null
    const [, year, month, day] = match.map(Number)
    const date = new Date(year, month - 1, day)
    if (date.getMonth() !== month - 1 || date.getDate() !== day) return null
    return date
}

// Real dates, sorted, no repeats — the shape the database normalises to,
// applied here so a draft reads the way it will read once saved.
export function normaliseDates(dates) {
    const clean = new Set()
    for (const value of dates ?? []) {
        const key = dateKey(value)
        if (key) clean.add(key)
    }
    return [...clean].sort()
}

// Today's key. The dividing line between a closure still ahead of the resort
// and one that has already happened — the dashboard lists the two separately,
// because a list that keeps last March in it stops being readable.
export function todayKey() {
    return dateKey(new Date())
}

export function isPastDateKey(key) {
    return key < todayKey()
}

// 'Saturday, August 9, 2026' for a heading, 'Aug 9' for a chip. Built from the
// parsed date rather than the string so the month name is localised the same
// way every other date on the site is.
export function formatDateKey(key, { long = false } = {}) {
    const date = parseDateKey(key)
    if (!date) return String(key ?? '')
    return date.toLocaleDateString('en-US', long
        ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
        : { month: 'short', day: 'numeric' })
}

function rowToDates(row) {
    if (!row || !Array.isArray(row.dates)) return []
    return normaliseDates(row.dates)
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

// 'Aug 8', 'Aug 8 and Aug 9', 'Aug 8, Aug 9 and 2 more dates'. Only ever a
// handful of dates in a sentence — the full list belongs in the dashboard's
// chips, not in prose.
//
// The overflow is the LAST item of the list rather than a clause tacked on
// after it, so the "and" lands in one place: "Aug 8, Aug 9 and 2 more dates",
// not "Aug 8 and Aug 9 and 2 more dates".
export function describeMaintenanceDates(dates, { limit = 3 } = {}) {
    const list = normaliseDates(dates)
    if (list.length === 0) return ''
    const parts = list.slice(0, limit).map((key) => formatDateKey(key))
    const rest = list.length - parts.length
    if (rest > 0) parts.push(`${rest} more date${rest === 1 ? '' : 's'}`)
    if (parts.length === 1) return parts[0]
    return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}

// WHY this one date is closed, for a sentence about that date rather than about
// the pattern. A weekly closure reads 'Mondays', because that is the rule the
// guest is running into; a one-off reads 'Saturday, August 9, 2026', because
// there is no rule to state — just that date. Empty string when the date is
// open.
//
// Both answers are shaped to sit after "on", which every caller supplies: "the
// resort is closed on Mondays", "nobody checks out on Saturday, August 9".
//
// The weekly answer comes first: when a date is closed both ways, the recurring
// reason is the more useful one to give.
export function describeClosureOn(value) {
    const date = value instanceof Date ? value : parseDateKey(value)
    if (!date) return ''
    if (dowSet.has(date.getDay())) return `${WEEKDAY_NAMES[date.getDay()]}s`
    const key = dateKey(date)
    return key && dateSet.has(key) ? formatDateKey(key, { long: true }) : ''
}

// The whole closure in one line: 'Mondays', 'Mondays, plus Aug 8, Aug 9 and
// Aug 10'.
//
// Dates already past are left out. This line answers "what is closed" — a
// closure that has been and gone is not, and last March would sit at the front
// of the list pushing the answer off the end of it. The dashboard lists the
// past ones separately, where they can be cleared.
export function describeClosure(days, dates) {
    const weekly = normaliseDays(days)
    const list = normaliseDates(dates).filter((key) => !isPastDateKey(key))
    if (list.length === 0) return describeMaintenanceDays(weekly)
    const single = describeMaintenanceDates(list)
    if (weekly.length === 0) return single
    return `${describeMaintenanceDays(weekly)}, plus ${single}`
}


// =================================================================== reading

export async function loadMaintenanceDays() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    // `select('*')` rather than naming the columns, so this still loads against
    // a database that has not had the one-off dates migration applied — naming
    // `dates` there would fail the whole query and grey out the wrong cells over
    // a column nobody is using yet.
    const { data, error } = await supabase
        .from('maintenance_days')
        .select('*')
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

    commit({
        days: rowToDays(data),
        dates: rowToDates(data),
        supportsDates: data ? Object.hasOwn(data, 'dates') : true,
        loaded: true,
        error: null,
    })
}


// =================================================================== writing

// Staff write. The row is seeded by the migration, so this is always an update
// — and `.select()` is what turns an update that matched nothing into an answer
// rather than a silent success, the same reasoning as every other store here.
export async function saveMaintenanceDays(days, dates = null) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const clean = normaliseDays(days)
    const cleanDates = dates == null ? null : normaliseDates(dates)

    if (clean.length > MAX_MAINTENANCE_DAYS) {
        return {
            ok: false,
            message: 'Leave at least one day open. Closing all seven would mean no guest '
                + 'could arrive on any date, and the booking form would refuse every stay.',
        }
    }

    if (cleanDates != null && cleanDates.length > MAX_MAINTENANCE_DATES) {
        return {
            ok: false,
            message: `That is more than ${MAX_MAINTENANCE_DATES} one-off closures. A closure `
                + 'that long is a weekly pattern, not a list of dates — set it above, or '
                + 'clear the dates that have already passed.',
        }
    }

    // Writing `dates` to a database that has no such column fails the whole
    // update, weekly closure included. So the weekly half is allowed through on
    // its own, and only an actual attempt to store one-off dates is refused —
    // with the reason, rather than with Postgres's own wording.
    const payload = { days: clean }
    if (cleanDates != null) {
        if (!state.supportsDates) {
            if (cleanDates.length > 0) {
                return {
                    ok: false,
                    message: 'One-off maintenance dates need the '
                        + '20260810120000_maintenance_dates migration, which has not been '
                        + 'applied to this database yet. The weekly closure still saves.',
                }
            }
        } else {
            payload.dates = cleanDates
        }
    }

    const { data, error } = await supabase
        .from('maintenance_days')
        .update(payload)
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
