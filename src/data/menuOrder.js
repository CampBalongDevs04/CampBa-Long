// ============================================================================
//  Camp Ba-long — the "How to Order Food" panel on /menu
// ----------------------------------------------------------------------------
//  One row in Postgres (public.menu_order) plus its numbered steps
//  (public.menu_order_steps), read by the food menu page and written by the
//  dashboard's CMS → Food Menu → How to Order. See the header of
//  supabase/migrations/20260808160000_menu_order_cms.sql for why this is its
//  own table rather than a corner of menuHero.js (the banner) or
//  menuSections.js (the category headings).
//
//  Built the same way as data/homeHero.js, deliberately: this is the same
//  job — a page's own panel, staff should be able to reword and reorder its
//  steps without a redeploy — as every other CMS store.
//
//  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
//  ------------------------------------------------
//  The constants below are, word for word, what src/pages/foodmenu.jsx used
//  to have hardcoded (the panel's JSX, and its orderSteps array).
//
//  IMAGES
//  ------
//  The photo is a bundled asset: Vite hashes its filename at build time, so
//  the row stores null until staff upload something, and null means "use the
//  bundled one" — resolveMenuOrderImage is where that decision is made.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

import bundledPhoto from '../assets/images/food2.png'

const ROW_ID = 'menu'
const CHANNEL = 'menu-order-changes'

// Word for word what the front end used to have written into it.
export const MENU_ORDER_FALLBACK = {
    heading: 'How to Order Food',
    noteLabel: 'Note:',
    noteText: 'Food orders are subject to availability and may be modified before the preparation cutoff time.',
    imageUrl: null,
}

export const MENU_ORDER_STEPS_FALLBACK = [
    { id: 'reserve-stay', step: 'Reserve your stay first — you can order before paying.', sortOrder: 1, isActive: true },
    { id: 'browse-menu', step: 'Browse the food menu and select your preferred items.', sortOrder: 2, isActive: true },
    { id: 'choose-quantity', step: 'Choose the quantity for each item.', sortOrder: 3, isActive: true },
    { id: 'review-confirm', step: 'Review and confirm your order.', sortOrder: 4, isActive: true },
    { id: 'join-down-payment', step: 'The food cost joins your down payment, which you settle from My Bookings.', sortOrder: 5, isActive: true },
]

// `loaded` is what tells a caller the difference between "not asked yet" and
// "asked, and this is the answer". Until it flips, `panel` and `steps` are the
// shipped copy, so the How to Order panel is never empty.
let state = {
    panel: MENU_ORDER_FALLBACK,
    steps: MENU_ORDER_STEPS_FALLBACK,      // every row, including hidden ones
    activeSteps: MENU_ORDER_STEPS_FALLBACK, // what a guest is shown
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

export function useMenuOrder() {
    return useSyncExternalStore(subscribe, snapshot)
}

function rowToPanel(row) {
    if (!row) return MENU_ORDER_FALLBACK
    return {
        heading: row.heading || MENU_ORDER_FALLBACK.heading,
        noteLabel: row.note_label ?? '',
        noteText: row.note_text ?? '',
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

export async function loadMenuOrder() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const [panelResult, stepsResult] = await Promise.all([
        supabase
            .from('menu_order')
            .select('heading, note_label, note_text, image_url')
            .eq('id', ROW_ID)
            .maybeSingle(),
        supabase
            .from('menu_order_steps')
            .select('id, step, sort_order, is_active')
            .order('sort_order', { ascending: true }),
    ])

    const error = panelResult.error ?? stepsResult.error
    if (error) {
        // Not worth a message on the page: the fallback copy is already on
        // screen. The dashboard does surface `error`, because there it is the
        // answer to "why did nothing I typed show up".
        console.error('Could not load the How to Order panel:', error.message)
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

// What a guest is actually shown, resolved in one place so the menu page and
// the dashboard's preview never disagree about which photo is live.
export function resolveMenuOrderImage(imageUrl = null) {
    return imageUrl || bundledPhoto
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
// an answer rather than a silent success (the same reasoning as
// saveHomeHero).
export async function saveMenuOrder(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const heading = String(draft.heading ?? '').trim()
    if (!heading) {
        return { ok: false, message: 'Write a heading — it is what the panel is called on the page.' }
    }

    const { data, error } = await supabase
        .from('menu_order')
        .update({
            heading,
            note_label: String(draft.noteLabel ?? '').trim() || null,
            note_text: String(draft.noteText ?? '').trim() || null,
        })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the How to Order wording:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'menu order migration has not been applied to this database yet.',
        }
    }

    await loadMenuOrder()
    return { ok: true }
}

// The photo half of the same row. Split from the copy above so the two forms
// can be opened separately without either one clearing the other's columns.
export async function saveMenuOrderMedia(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase
        .from('menu_order')
        .update({ image_url: String(draft.imageUrl ?? '').trim() || null })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the How to Order photo:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'menu order migration has not been applied to this database yet.',
        }
    }

    await loadMenuOrder()
    return { ok: true }
}

// Create or edit one step in the numbered list.
export async function saveMenuOrderStep(draft) {
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
        ;({ error } = await supabase.from('menu_order_steps').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('menu_order_steps')
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

    await loadMenuOrder()
    return { ok: true, id }
}

export async function deleteMenuOrderStep(id) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase
        .from('menu_order_steps')
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

    await loadMenuOrder()
    return { ok: true }
}

// Move a step one place along the list. The list on screen IS the order
// stored, so there is no sort number for staff to keep in step.
export async function moveMenuOrderStep(id, direction) {
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
        .from('menu_order_steps')
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

    await loadMenuOrder()
    return { ok: true }
}


// =================================================================== realtime

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_order' }, loadMenuOrder)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_order_steps' }, loadMenuOrder)
        .subscribe()
}

if (isSupabaseConfigured) {
    loadMenuOrder()
    watchRealtime()
}
