// ============================================================================
//  Camp Ba-long — the words on /booking
// ----------------------------------------------------------------------------
//  One row in Postgres (public.booking_page) plus its four lists — the
//  assurances under the title (booking_trust_points), the four step headings
//  (booking_steps), the resort policy list (booking_policies) and what each
//  rate includes (booking_inclusions). Read by the booking page and written by
//  the dashboard's CMS → Booking. See the header of
//  supabase/migrations/20260810140000_booking_page_cms.sql for why the copy is
//  split across five tables rather than one.
//
//  Built as the direct counterpart of data/spaReserve.js, on purpose.
//
//  THE SCHEDULE NOTES
//  ------------------
//  The sentence under the schedule cards belongs to the schedule, not to this
//  page, so it lives where the schedule does: stay_schedules.note. Only the two
//  strings AROUND it are on booking_page — the 'Schedule note.' label, and what
//  the line says before a schedule has been picked. This module loads the notes
//  too so a component has one place to ask; STAY_SCHEDULES in accommodationDB.js
//  stays the fallback, exactly as it is for everything else on that table.
//
//  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
//  ------------------------------------------------
//  Every constant below is, word for word, what src/pages/booking.jsx and its
//  components used to have hardcoded — so an unconfigured .env, a dead network
//  or a database the migration has not reached still reads exactly the same.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

const ROW_ID = 'booking'
const CHANNEL = 'booking-page-changes'

// The icons booking.jsx can draw beside an assurance. Named here rather than in
// data/cmsIcons.js because these three are inline SVGs written for that one row
// and stroked by booking.css — the shared set is drawn for the circular badges
// elsewhere on the site and would not fit.
export const BOOKING_TRUST_ICONS = [
    { value: 'lock', label: 'Padlock — held safely' },
    { value: 'check', label: 'Tick — checked or verified' },
    { value: 'clock', label: 'Clock — how long it takes' },
]

// The four steps, in the order the page lays them out. FIXED: each id is the
// DOM id of a block of the form, which booking.jsx scrolls to and points
// aria-labelledby at — the database supplies their wording, never their number
// or their order.
export const BOOKING_STEP_IDS = [
    'step-schedule',
    'step-accommodation',
    'step-guest',
    'step-confirm',
]

// Word for word what the front end used to have written into it.
export const BOOKING_PAGE_FALLBACK = {
    eyebrow: 'Camp Ba-long Reservations',
    title: 'Complete Your Booking',
    tagline: 'Reserve your stay in four simple steps — your unit is held first, then you'
        + ' settle the down payment from My Bookings within 10 minutes. We confirm once the'
        + ' receipt is verified.',
    scheduleTitle: 'Select Stay Schedule',
    scheduleNoteHeading: 'Schedule note.',
    scheduleNoteEmpty: 'Select a stay schedule to see the check-in details.',
    inclusionsHeading: 'Inclusions.',
    policyWarning: 'Please read first before reserving',
    agreeLabel: 'I have read and agree to the terms and resort policy.',
    confirmLabel: 'Reserve & Proceed to Payment',
}

export const BOOKING_TRUST_FALLBACK = [
    { id: 'held-before-paying', text: 'Your unit is reserved before you pay a peso — for 10 minutes', icon: 'lock', sortOrder: 1, isActive: true },
    { id: 'receipt-verified', text: 'Every receipt is personally verified', icon: 'check', sortOrder: 2, isActive: true },
    { id: 'confirmed-in-24h', text: 'Confirmation sent within 24 hours', icon: 'clock', sortOrder: 3, isActive: true },
]

export const BOOKING_STEPS_FALLBACK = [
    {
        id: 'step-schedule',
        title: 'Dates & Schedule',
        subtitle: 'Pick your check-in date and stay schedule, then set how many nights'
            + ' you are staying. Every night is charged at the same rate.',
        sortOrder: 1,
    },
    {
        id: 'step-accommodation',
        title: 'Accommodation',
        subtitle: 'Select the unit that suits your group.',
        sortOrder: 2,
    },
    {
        id: 'step-guest',
        title: 'Guest Information',
        subtitle: 'Tell us who is booking so we can confirm your reservation.',
        sortOrder: 3,
    },
    {
        id: 'step-confirm',
        title: 'Review & Reserve',
        subtitle: 'Read our resort policy, then reserve your unit. You will have 10 minutes'
            + ' to upload your down-payment receipt before the hold is released.',
        sortOrder: 4,
    },
]

export const BOOKING_POLICIES_FALLBACK = [
    { id: 'arrive-on-time', policy: 'Guests must arrive on time; late check-in may shorten your reserved hours.', sortOrder: 1, isActive: true },
    { id: 'damage-charged', policy: 'No hidden charges for normal use, but damaged chairs, tables, linens, fixtures, or missing items will be charged after inspection.', sortOrder: 2, isActive: true },
    { id: 'no-cancellation', policy: 'Cancellation is no longer allowed once the down payment has been made.', sortOrder: 3, isActive: true },
]

export const BOOKING_INCLUSIONS_FALLBACK = [
    { id: 'day-entrance', rateGroup: 'day', item: 'Free entrance for 2 pax (not applicable for Cottage & Pavilion)', sortOrder: 1, isActive: true },
    { id: 'day-parking', rateGroup: 'day', item: 'Free parking', sortOrder: 2, isActive: true },
    { id: 'day-jacuzzi', rateGroup: 'day', item: '3 hours free use of cold spring jacuzzi', sortOrder: 3, isActive: true },
    { id: 'day-griller', rateGroup: 'day', item: 'Free use of charcoal griller', sortOrder: 4, isActive: true },
    { id: 'day-pools', rateGroup: 'day', item: 'Access to swimming pool, kiddie pool & running water', sortOrder: 5, isActive: true },
    { id: 'day-bathrooms', rateGroup: 'day', item: 'Access to bathrooms and showers', sortOrder: 6, isActive: true },
    { id: 'overnight-entrance', rateGroup: 'overnight', item: 'Free entrance for 2 pax (not applicable for Tent Pitching)', sortOrder: 1, isActive: true },
    { id: 'overnight-parking', rateGroup: 'overnight', item: 'Free parking', sortOrder: 2, isActive: true },
    { id: 'overnight-jacuzzi', rateGroup: 'overnight', item: '3 hours free use of cold spring jacuzzi', sortOrder: 3, isActive: true },
    { id: 'overnight-griller', rateGroup: 'overnight', item: 'Free use of charcoal griller', sortOrder: 4, isActive: true },
    { id: 'overnight-pools', rateGroup: 'overnight', item: 'Access to swimming pool, kiddie pool & running water', sortOrder: 5, isActive: true },
    { id: 'overnight-bathrooms', rateGroup: 'overnight', item: 'Access to bathrooms and showers', sortOrder: 6, isActive: true },
    { id: 'overnight-beddings', rateGroup: 'overnight', item: 'Beddings included (except tent pitching)', sortOrder: 7, isActive: true },
]

// `loaded` is what tells a caller the difference between "not asked yet" and
// "asked, and this is the answer". Until it flips, every list below is the
// shipped copy, so the page is never blank.
let state = {
    page: BOOKING_PAGE_FALLBACK,
    trust: BOOKING_TRUST_FALLBACK,             // every row, including hidden ones
    activeTrust: BOOKING_TRUST_FALLBACK,       // what a guest is shown
    steps: BOOKING_STEPS_FALLBACK,
    policies: BOOKING_POLICIES_FALLBACK,
    activePolicies: BOOKING_POLICIES_FALLBACK,
    inclusions: BOOKING_INCLUSIONS_FALLBACK,
    activeInclusions: BOOKING_INCLUSIONS_FALLBACK,
    // { [scheduleKey]: note }. Empty until the schedules land, and a key that is
    // missing from it means "use the schedule's own note" — see
    // scheduleNoteFor().
    scheduleNotes: {},
    loaded: false,
    error: null,
}

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
    notify()
}

export function useBookingPage() {
    return useSyncExternalStore(subscribe, snapshot)
}

// A blank column falls back rather than printing nothing: an empty title is a
// page that looks broken, not a page with no title.
function rowToPage(row) {
    if (!row) return BOOKING_PAGE_FALLBACK
    return {
        eyebrow: row.eyebrow ?? '',
        title: row.title || BOOKING_PAGE_FALLBACK.title,
        tagline: row.tagline ?? '',
        scheduleTitle: row.schedule_title || BOOKING_PAGE_FALLBACK.scheduleTitle,
        scheduleNoteHeading: row.schedule_note_heading ?? '',
        scheduleNoteEmpty: row.schedule_note_empty || BOOKING_PAGE_FALLBACK.scheduleNoteEmpty,
        inclusionsHeading: row.inclusions_heading ?? '',
        policyWarning: row.policy_warning ?? '',
        agreeLabel: row.agree_label || BOOKING_PAGE_FALLBACK.agreeLabel,
        confirmLabel: row.confirm_label || BOOKING_PAGE_FALLBACK.confirmLabel,
    }
}

function rowToTrust(row) {
    return {
        id: row.id,
        text: row.text,
        icon: row.icon ?? 'check',
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    }
}

function rowToStep(row) {
    return {
        id: row.id,
        title: row.title,
        subtitle: row.subtitle ?? '',
        sortOrder: row.sort_order ?? 0,
    }
}

function rowToPolicy(row) {
    return {
        id: row.id,
        policy: row.policy,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    }
}

function rowToInclusion(row) {
    return {
        id: row.id,
        rateGroup: row.rate_group,
        item: row.item,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    }
}

export async function loadBookingPage() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const [pageResult, trustResult, stepsResult, policiesResult, inclusionsResult, schedulesResult] =
        await Promise.all([
            supabase
                .from('booking_page')
                .select('eyebrow, title, tagline, schedule_title, schedule_note_heading,'
                    + ' schedule_note_empty, inclusions_heading, policy_warning, agree_label,'
                    + ' confirm_label')
                .eq('id', ROW_ID)
                .maybeSingle(),
            supabase
                .from('booking_trust_points')
                .select('id, text, icon, sort_order, is_active')
                .order('sort_order', { ascending: true }),
            supabase
                .from('booking_steps')
                .select('id, title, subtitle, sort_order')
                .order('sort_order', { ascending: true }),
            supabase
                .from('booking_policies')
                .select('id, policy, sort_order, is_active')
                .order('sort_order', { ascending: true }),
            supabase
                .from('booking_inclusions')
                .select('id, rate_group, item, sort_order, is_active')
                .order('sort_order', { ascending: true }),
            supabase
                .from('stay_schedules')
                .select('key, note'),
        ])

    const error = pageResult.error ?? trustResult.error ?? stepsResult.error
        ?? policiesResult.error ?? inclusionsResult.error ?? schedulesResult.error
    if (error) {
        // Not worth a message on the page: the fallback copy is already on
        // screen. The dashboard does surface `error`, because there it is the
        // answer to "why did nothing I typed show up".
        console.error('Could not load the booking page copy:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    const trust = (trustResult.data ?? []).map(rowToTrust)
    const policies = (policiesResult.data ?? []).map(rowToPolicy)
    const inclusions = (inclusionsResult.data ?? []).map(rowToInclusion)
    // A table nobody has touched is empty on a database the migration has not
    // reached, and the four headings are structure — a step with no caption is
    // a bug, not an editorial choice. The other three lists keep their emptiness:
    // deleting every policy is a deliberate act.
    const steps = (stepsResult.data ?? []).map(rowToStep)

    const scheduleNotes = {}
    for (const row of schedulesResult.data ?? []) {
        if (row.note) scheduleNotes[row.key] = row.note
    }

    commit({
        page: rowToPage(pageResult.data),
        trust,
        activeTrust: trust.filter((row) => row.isActive),
        steps: steps.length > 0 ? steps : BOOKING_STEPS_FALLBACK,
        policies,
        activePolicies: policies.filter((row) => row.isActive),
        inclusions,
        activeInclusions: inclusions.filter((row) => row.isActive),
        scheduleNotes,
        loaded: true,
        error: null,
    })
}


// ================================================================== selectors

// The caption over one step. Always answers something: a row missing from the
// database falls back to the wording the page shipped with, because the block
// of the form it labels is rendered either way.
export function bookingStep(id) {
    return (
        state.steps.find((step) => step.id === id)
        ?? BOOKING_STEPS_FALLBACK.find((step) => step.id === id)
        ?? { id, title: '', subtitle: '' }
    )
}

// What this rate group's rate includes, in order. No group (no schedule picked
// yet) means there is nothing to list.
export function inclusionsFor(rateGroup) {
    if (!rateGroup) return []
    return state.activeInclusions
        .filter((row) => row.rateGroup === rateGroup)
        .sort((a, b) => a.sortOrder - b.sortOrder)
}

// The sentence under the schedule cards. `fallback` is the schedule's own note
// from STAY_SCHEDULES — used until the database answers, and if the row's note
// has been emptied.
export function scheduleNoteFor(key, fallback = '') {
    if (!key) return fallback
    return state.scheduleNotes[key] || fallback
}


// ==================================================================== writing

function uniqueId(base, taken) {
    if (!taken.has(base)) return base
    let n = 2
    while (taken.has(`${base}-${n}`)) n += 1
    return `${base}-${n}`
}

function slugify(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
}

// Every write to the singleton goes through here. The row is seeded by the
// migration, so this is always an update — and `.select()` is what turns an
// update that matched nothing into an answer rather than a silent success.
async function updatePage(patch, what) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase
        .from('booking_page')
        .update(patch)
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error(`Could not save the ${what}:`, error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'booking page migration has not been applied to this database yet.',
        }
    }

    await loadBookingPage()
    return { ok: true }
}

// The hero: what a guest reads before the form starts.
export async function saveBookingHero(draft) {
    const title = String(draft.title ?? '').trim()
    if (!title) {
        return { ok: false, message: 'Write a title — it is the heading at the top of the page.' }
    }

    return updatePage({
        eyebrow: String(draft.eyebrow ?? '').trim() || null,
        title,
        tagline: String(draft.tagline ?? '').trim() || null,
    }, 'booking page hero')
}

// The labels around the schedule note and the inclusions list. The notes
// themselves are rows — see saveScheduleNote and saveBookingInclusion.
export async function saveBookingNotesCopy(draft) {
    const scheduleTitle = String(draft.scheduleTitle ?? '').trim()
    if (!scheduleTitle) {
        return { ok: false, message: 'Write the heading over the schedule cards.' }
    }

    return updatePage({
        schedule_title: scheduleTitle,
        schedule_note_heading: String(draft.scheduleNoteHeading ?? '').trim() || null,
        schedule_note_empty: String(draft.scheduleNoteEmpty ?? '').trim()
            || BOOKING_PAGE_FALLBACK.scheduleNoteEmpty,
        inclusions_heading: String(draft.inclusionsHeading ?? '').trim() || null,
    }, 'schedule and inclusion labels')
}

// The reserve panel: the warning over the policy list, the tick box beside it
// and the button underneath.
export async function saveBookingPolicyCopy(draft) {
    const confirmLabel = String(draft.confirmLabel ?? '').trim()
    if (!confirmLabel) {
        return { ok: false, message: 'Write the button label — it is what reserves the unit.' }
    }

    const agreeLabel = String(draft.agreeLabel ?? '').trim()
    if (!agreeLabel) {
        return {
            ok: false,
            message: 'Write the sentence beside the tick box — a guest has to agree to something.',
        }
    }

    return updatePage({
        policy_warning: String(draft.policyWarning ?? '').trim() || null,
        agree_label: agreeLabel,
        confirm_label: confirmLabel,
    }, 'reserve panel wording')
}

// One step's caption. Update only: the four rows are fixed, because each one
// labels a block of the form React renders.
export async function saveBookingStep(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const title = String(draft.title ?? '').trim()
    if (!title) return { ok: false, message: 'Write the step heading — the step is numbered either way.' }

    const { data, error } = await supabase
        .from('booking_steps')
        .update({
            title,
            subtitle: String(draft.subtitle ?? '').trim() || null,
        })
        .eq('id', draft.id)
        .select('id')

    if (error) {
        console.error('Could not save the step heading:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'booking page migration has not been applied to this database yet.',
        }
    }

    await loadBookingPage()
    return { ok: true }
}

// Create or edit one assurance under the title.
export async function saveBookingTrustPoint(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const text = String(draft.text ?? '').trim()
    if (!text) return { ok: false, message: 'Write the assurance — it is the line a guest reads.' }

    const isNew = !draft.id
    const taken = new Set(state.trust.map((row) => row.id))
    const id = draft.id || uniqueId(slugify(text).split('-').slice(0, 4).join('-') || 'assurance', taken)

    const row = {
        text,
        icon: String(draft.icon ?? 'check').trim() || 'check',
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from('booking_trust_points').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('booking_trust_points')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the assurance:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that assurance no longer exists, or this account is '
                + 'not on the staff roster.',
        }
    }

    await loadBookingPage()
    return { ok: true, id }
}

export async function deleteBookingTrustPoint(id) {
    return deleteRow('booking_trust_points', id, 'assurance')
}

// Create or edit one line of the resort policy list.
export async function saveBookingPolicy(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const policy = String(draft.policy ?? '').trim()
    if (!policy) return { ok: false, message: 'Write the policy — it is what the line says.' }

    const isNew = !draft.id
    const taken = new Set(state.policies.map((row) => row.id))
    const id = draft.id || uniqueId(slugify(policy).split('-').slice(0, 4).join('-') || 'policy', taken)

    const row = {
        policy,
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from('booking_policies').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('booking_policies')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the policy:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that policy no longer exists, or this account is not '
                + 'on the staff roster.',
        }
    }

    await loadBookingPage()
    return { ok: true, id }
}

export async function deleteBookingPolicy(id) {
    return deleteRow('booking_policies', id, 'policy')
}

// Create or edit one inclusion. `rateGroup` is part of the row rather than
// picked per list, so a line can be moved from Day Time to overnight by editing
// it rather than by retyping it in the other list.
export async function saveBookingInclusion(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const item = String(draft.item ?? '').trim()
    if (!item) return { ok: false, message: 'Write the inclusion — it is what the line says.' }

    const rateGroup = String(draft.rateGroup ?? '').trim()
    if (rateGroup !== 'day' && rateGroup !== 'overnight') {
        return { ok: false, message: 'Pick which schedules this inclusion applies to.' }
    }

    const isNew = !draft.id
    const taken = new Set(state.inclusions.map((row) => row.id))
    const id = draft.id
        || uniqueId(
            [rateGroup, ...slugify(item).split('-').slice(0, 3)].join('-'),
            taken,
        )

    const row = {
        rate_group: rateGroup,
        item,
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from('booking_inclusions').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('booking_inclusions')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the inclusion:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that inclusion no longer exists, or this account is '
                + 'not on the staff roster.',
        }
    }

    await loadBookingPage()
    return { ok: true, id }
}

export async function deleteBookingInclusion(id) {
    return deleteRow('booking_inclusions', id, 'inclusion')
}

// The sentence under the schedule cards, on the schedule itself. An update, not
// an upsert: the three schedules are catalog rows the booking engine depends
// on, and a note typed against a key that does not exist should say so rather
// than invent a fourth schedule with no hours.
export async function saveScheduleNote(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase
        .from('stay_schedules')
        .update({ note: String(draft.note ?? '').trim() || null })
        .eq('key', draft.key)
        .select('key')

    if (error) {
        console.error('Could not save the schedule note:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that schedule is not in the database, or this account '
                + 'is not on the staff roster.',
        }
    }

    await loadBookingPage()
    return { ok: true }
}

async function deleteRow(table, id, what) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase.from(table).delete().eq('id', id).select('id')

    if (error) {
        console.error(`Could not delete the ${what}:`, error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: `Nothing was deleted — that ${what} is already gone, or this account is not `
                + 'on the staff roster.',
        }
    }

    await loadBookingPage()
    return { ok: true }
}

// Move a row one place along its list. The list on screen IS the order stored,
// so there is no sort number for staff to keep in step.
//
// Renumbered from 1 rather than swapping two values: rows seeded or added at
// different times can share a sort_order, and swapping equal numbers moves
// nothing. `scope` narrows the renumbering to one inclusions list, so moving a
// Day Time line never rewrites the overnight one.
async function moveRow(table, rows, id, direction, patchOf) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const ordered = [...rows].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordered.findIndex((row) => row.id === id)
    const target = index + (direction === 'up' ? -1 : 1)
    if (index === -1 || target < 0 || target >= ordered.length) return { ok: true }

    const [moved] = ordered.splice(index, 1)
    ordered.splice(target, 0, moved)

    const { error } = await supabase
        .from(table)
        .upsert(ordered.map((row, position) => ({ ...patchOf(row), sort_order: position + 1 })))

    if (error) {
        console.error('Could not reorder the list:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    await loadBookingPage()
    return { ok: true }
}

export async function moveBookingTrustPoint(id, direction) {
    return moveRow('booking_trust_points', state.trust, id, direction, (row) => ({
        id: row.id,
        text: row.text,
        icon: row.icon,
        is_active: row.isActive,
    }))
}

export async function moveBookingPolicy(id, direction) {
    return moveRow('booking_policies', state.policies, id, direction, (row) => ({
        id: row.id,
        policy: row.policy,
        is_active: row.isActive,
    }))
}

export async function moveBookingInclusion(id, direction) {
    const row = state.inclusions.find((entry) => entry.id === id)
    if (!row) return { ok: true }

    return moveRow(
        'booking_inclusions',
        state.inclusions.filter((entry) => entry.rateGroup === row.rateGroup),
        id,
        direction,
        (entry) => ({
            id: entry.id,
            rate_group: entry.rateGroup,
            item: entry.item,
            is_active: entry.isActive,
        }),
    )
}


// =================================================================== realtime

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_page' }, loadBookingPage)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_trust_points' }, loadBookingPage)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_steps' }, loadBookingPage)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_policies' }, loadBookingPage)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_inclusions' }, loadBookingPage)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stay_schedules' }, loadBookingPage)
        .subscribe()
}

if (isSupabaseConfigured) {
    loadBookingPage()
    watchRealtime()
}
