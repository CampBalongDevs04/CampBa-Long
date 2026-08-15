// ============================================================================
//  Camp Ba-long — the "How to book Spa Service" panel on /spa
// ----------------------------------------------------------------------------
//  One row in Postgres (public.spa_reserve) plus its numbered steps
//  (public.spa_reserve_steps), read by the spa page and written by the
//  dashboard's CMS → Spa Service → How to Reserve. See the header of
//  supabase/migrations/20260808190000_spa_reserve_cms.sql for why this is its
//  own pair of tables.
//
//  The direct counterpart of data/menuOrder.js, which does the same job on
//  /menu, and built the same way on purpose.
//
//  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
//  ------------------------------------------------
//  The constants below are, word for word, what src/pages/spaService.jsx used
//  to have hardcoded (its `instructions` array and the JSX around it).
//
//  THE PHOTO
//  ---------
//  image_url is null until staff put a photo there, and null means "leave the
//  stylesheet alone" — spaService.css paints the shipped photo on .spa-image
//  and the page sets an inline background only once there is an uploaded one.
//
//  The bundled file is still imported below for the same two jobs as the
//  banner's backdrop: the dashboard's preview needs a URL to show the live
//  photo rather than a stand-in, and importBundledSpaReserveImage copies it
//  into storage so it becomes an ordinary editable photo.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'
import { uploadBundledImage } from './catalogImages.js'

import bundledPhoto from '../assets/images/spa-items.png'

const ROW_ID = 'spa'
const CHANNEL = 'spa-reserve-changes'

// The photo the site ships with. Exported so the dashboard can show what is
// actually on the page rather than a stand-in for it.
export const SPA_RESERVE_BUNDLED_IMAGE = bundledPhoto

// Word for word what the front end used to have written into it.
export const SPA_RESERVE_FALLBACK = {
    heading: 'How to book Spa Service',
    stepsTitle: 'How to Order',
    imageUrl: null,
}

export const SPA_RESERVE_STEPS_FALLBACK = [
    { id: 'reserve-stay', step: 'Reserve your stay first — you can book a treatment before paying.', sortOrder: 1, isActive: true },
    { id: 'browse-spa', step: 'Browse the Spa Service', sortOrder: 2, isActive: true },
    { id: 'input-pax', step: 'Input How Many Pax', sortOrder: 3, isActive: true },
    { id: 'review-confirm', step: 'Review and Confirm your Service', sortOrder: 4, isActive: true },
    { id: 'join-down-payment', step: 'The treatment joins your down payment, which you settle from My Bookings.', sortOrder: 5, isActive: true },
]

// `loaded` is what tells a caller the difference between "not asked yet" and
// "asked, and this is the answer". Until it flips, `panel` and `steps` are the
// shipped copy, so the panel is never empty.
let state = {
    panel: SPA_RESERVE_FALLBACK,
    steps: SPA_RESERVE_STEPS_FALLBACK,       // every row, including hidden ones
    activeSteps: SPA_RESERVE_STEPS_FALLBACK, // what a guest is shown
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

export function useSpaReserve() {
    return useSyncExternalStore(subscribe, snapshot)
}

function rowToPanel(row) {
    if (!row) return SPA_RESERVE_FALLBACK
    return {
        heading: row.heading || SPA_RESERVE_FALLBACK.heading,
        stepsTitle: row.steps_title ?? '',
        imageUrl: row.image_url ?? null,
    }
}

function rowToStep(row) {
    return {
        id: row.id,
        step: row.step,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    }
}

export async function loadSpaReserve() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const [panelResult, stepsResult] = await Promise.all([
        supabase
            .from('spa_reserve')
            .select('heading, steps_title, image_url')
            .eq('id', ROW_ID)
            .maybeSingle(),
        supabase
            .from('spa_reserve_steps')
            .select('id, step, sort_order, is_active')
            .order('sort_order', { ascending: true }),
    ])

    const error = panelResult.error ?? stepsResult.error
    if (error) {
        // Not worth a message on the page: the fallback copy is already on
        // screen. The dashboard does surface `error`, because there it is the
        // answer to "why did nothing I typed show up".
        console.error('Could not load the spa How to book panel:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    const steps = (stepsResult.data ?? []).map(rowToStep)

    commit({
        panel: rowToPanel(panelResult.data),
        // An empty table means somebody deleted every step, which is a
        // deliberate act — the list goes away rather than reverting to what
        // the site shipped with.
        steps,
        activeSteps: steps.filter((step) => step.isActive),
        loaded: true,
        error: null,
    })
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

// Staff write. The row is seeded by the migration, so this is always an
// update — and `.select()` is what turns an update that matched nothing into
// an answer rather than a silent success.
export async function saveSpaReserve(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const heading = String(draft.heading ?? '').trim()
    if (!heading) {
        return { ok: false, message: 'Write a heading — it is what the section is called on the page.' }
    }

    const { data, error } = await supabase
        .from('spa_reserve')
        .update({
            heading,
            steps_title: String(draft.stepsTitle ?? '').trim() || null,
        })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the How to book wording:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'spa reserve migration has not been applied to this database yet.',
        }
    }

    await loadSpaReserve()
    return { ok: true }
}

// The photo half of the same row. Split from the copy above so the two forms
// can be opened separately without either one clearing the other's columns.
export async function saveSpaReserveMedia(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase
        .from('spa_reserve')
        .update({ image_url: String(draft.imageUrl ?? '').trim() || null })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the How to book photo:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'spa reserve migration has not been applied to this database yet.',
        }
    }

    await loadSpaReserve()
    return { ok: true }
}

// Create or edit one step in the numbered list.
export async function saveSpaReserveStep(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const step = String(draft.step ?? '').trim()
    if (!step) return { ok: false, message: 'Write the step — it is what the numbered line says.' }

    const isNew = !draft.id
    const taken = new Set(state.steps.map((row) => row.id))
    const id = draft.id || uniqueId(slugify(step).split('-').slice(0, 4).join('-') || 'step', taken)

    const row = {
        step,
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from('spa_reserve_steps').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('spa_reserve_steps')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the step:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that step no longer exists, or this account is not '
                + 'on the staff roster.',
        }
    }

    await loadSpaReserve()
    return { ok: true, id }
}

export async function deleteSpaReserveStep(id) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase
        .from('spa_reserve_steps')
        .delete()
        .eq('id', id)
        .select('id')

    if (error) {
        console.error('Could not delete the step:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was deleted — that step is already gone, or this account is not '
                + 'on the staff roster.',
        }
    }

    await loadSpaReserve()
    return { ok: true }
}

// Move a step one place along the list. The list on screen IS the order
// stored, so there is no sort number for staff to keep in step.
export async function moveSpaReserveStep(id, direction) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const ordered = [...state.steps].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordered.findIndex((row) => row.id === id)
    const target = index + (direction === 'up' ? -1 : 1)
    if (index === -1 || target < 0 || target >= ordered.length) return { ok: true }

    const [moved] = ordered.splice(index, 1)
    ordered.splice(target, 0, moved)

    // Renumbered from 1 rather than swapping two values: rows seeded or added
    // at different times can share a sort_order, and swapping equal numbers
    // moves nothing.
    const { error } = await supabase
        .from('spa_reserve_steps')
        .upsert(
            ordered.map((row, position) => ({
                id: row.id,
                step: row.step,
                is_active: row.isActive,
                sort_order: position + 1,
            })),
        )

    if (error) {
        console.error('Could not reorder the steps:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    await loadSpaReserve()
    return { ok: true }
}


// What a guest is actually shown. Null means the row has no photo of its own
// and the stylesheet's is live — which is a URL the dashboard needs in order to
// preview the panel honestly, even though the page itself never asks.
export function resolveSpaReserveImage(imageUrl = null) {
    return imageUrl || SPA_RESERVE_BUNDLED_IMAGE
}

// Copy the shipped photo into the resort's own storage and save it on the row.
// See uploadBundledImage in data/catalogImages.js for why a bundled photo has
// to be moved before it can be managed.
export async function importBundledSpaReserveImage() {
    const result = await uploadBundledImage(SPA_RESERVE_BUNDLED_IMAGE, {
        name: 'spa-reserve-photo',
        folder: 'spa',
    })
    if (!result.ok) return { ok: false, message: `${result.message} Nothing was changed.` }

    return saveSpaReserveMedia({ imageUrl: result.url })
}


// =================================================================== realtime

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'spa_reserve' }, loadSpaReserve)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'spa_reserve_steps' }, loadSpaReserve)
        .subscribe()
}

if (isSupabaseConfigured) {
    loadSpaReserve()
    watchRealtime()
}
