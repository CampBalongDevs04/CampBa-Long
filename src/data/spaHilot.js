// ============================================================================
//  Camp Ba-long — the "Hilot Wellness Spa" section heading on /spa
// ----------------------------------------------------------------------------
//  One row in Postgres (public.spa_hilot) plus its inclusions list
//  (public.spa_hilot_inclusions), read by the spa page and written by the
//  dashboard's CMS → Spa Service → Hilot Section.
//
//  THE HEADING, NOT THE TREATMENTS
//  -------------------------------
//  The cards under this heading are catalog data in public.spa_services, read
//  through data/menuDB.js and edited in the dashboard's Spa SECTION. This
//  store owns the words above them and the inclusions list below them, and
//  nothing else — the same split Accommodations has, where CMS owns the
//  heading and Units owns the cards.
//
//  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
//  ------------------------------------------------
//  The constants below are, word for word, what src/pages/spaService.jsx used
//  to have hardcoded (its `hilotInclusions` array and the section header JSX).
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

const ROW_ID = 'spa'
const CHANNEL = 'spa-hilot-changes'

// Word for word what the front end used to have written into it.
export const SPA_HILOT_FALLBACK = {
    eyebrow: 'Our Services',
    title: 'Hilot Wellness Spa',
    subtitle: 'Time-honored Filipino healing rituals paired with modern comfort. Choose the treatment that speaks to what your body needs today.',
    inclusionsLabel: 'Free Exclusive Inclusions',
}

export const SPA_HILOT_INCLUSIONS_FALLBACK = [
    { id: 'vital-signs', item: 'Checking Vital Signs (BP, BT)', sortOrder: 1, isActive: true },
    { id: 'salabat-tea', item: 'Blue Salabat Tea', sortOrder: 2, isActive: true },
    { id: 'banana-leaves', item: 'Banana Leaves Natural Ionizer', sortOrder: 3, isActive: true },
]

let state = {
    hilot: SPA_HILOT_FALLBACK,
    inclusions: SPA_HILOT_INCLUSIONS_FALLBACK,       // every row, hidden ones too
    activeInclusions: SPA_HILOT_INCLUSIONS_FALLBACK, // what a guest is shown
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

export function useSpaHilot() {
    return useSyncExternalStore(subscribe, snapshot)
}

function rowToHilot(row) {
    if (!row) return SPA_HILOT_FALLBACK
    return {
        eyebrow: row.eyebrow ?? '',
        title: row.title || SPA_HILOT_FALLBACK.title,
        subtitle: row.subtitle ?? '',
        inclusionsLabel: row.inclusions_label ?? '',
    }
}

function rowToInclusion(row) {
    return {
        id: row.id,
        item: row.item,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    }
}

export async function loadSpaHilot() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const [hilotResult, inclusionsResult] = await Promise.all([
        supabase
            .from('spa_hilot')
            .select('eyebrow, title, subtitle, inclusions_label')
            .eq('id', ROW_ID)
            .maybeSingle(),
        supabase
            .from('spa_hilot_inclusions')
            .select('id, item, sort_order, is_active')
            .order('sort_order', { ascending: true }),
    ])

    const error = hilotResult.error ?? inclusionsResult.error
    if (error) {
        console.error('Could not load the Hilot section:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    const inclusions = (inclusionsResult.data ?? []).map(rowToInclusion)

    commit({
        hilot: rowToHilot(hilotResult.data),
        // An empty table means somebody deleted every inclusion, which is a
        // deliberate act — the list goes away rather than reverting to what
        // the site shipped with.
        inclusions,
        activeInclusions: inclusions.filter((row) => row.isActive),
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

export async function saveSpaHilot(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const title = String(draft.title ?? '').trim()
    if (!title) {
        return { ok: false, message: 'Write a heading — it is what the section is called on the page.' }
    }

    const { data, error } = await supabase
        .from('spa_hilot')
        .update({
            eyebrow: String(draft.eyebrow ?? '').trim() || null,
            title,
            subtitle: String(draft.subtitle ?? '').trim() || null,
            inclusions_label: String(draft.inclusionsLabel ?? '').trim() || null,
        })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the Hilot section wording:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'spa hilot migration has not been applied to this database yet.',
        }
    }

    await loadSpaHilot()
    return { ok: true }
}

// Create or edit one line in the inclusions list.
export async function saveSpaHilotInclusion(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const item = String(draft.item ?? '').trim()
    if (!item) return { ok: false, message: 'Write the inclusion — it is what the line says.' }

    const isNew = !draft.id
    const taken = new Set(state.inclusions.map((row) => row.id))
    const id = draft.id || uniqueId(slugify(item).split('-').slice(0, 4).join('-') || 'inclusion', taken)

    const row = {
        item,
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from('spa_hilot_inclusions').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('spa_hilot_inclusions')
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

    await loadSpaHilot()
    return { ok: true, id }
}

export async function deleteSpaHilotInclusion(id) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase
        .from('spa_hilot_inclusions')
        .delete()
        .eq('id', id)
        .select('id')

    if (error) {
        console.error('Could not delete the inclusion:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was deleted — that inclusion is already gone, or this account is '
                + 'not on the staff roster.',
        }
    }

    await loadSpaHilot()
    return { ok: true }
}

// Move an inclusion one place along the list. The list on screen IS the order
// stored, so there is no sort number for staff to keep in step.
export async function moveSpaHilotInclusion(id, direction) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const ordered = [...state.inclusions].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordered.findIndex((row) => row.id === id)
    const target = index + (direction === 'up' ? -1 : 1)
    if (index === -1 || target < 0 || target >= ordered.length) return { ok: true }

    const [moved] = ordered.splice(index, 1)
    ordered.splice(target, 0, moved)

    // Renumbered from 1 rather than swapping two values: rows seeded or added
    // at different times can share a sort_order, and swapping equal numbers
    // moves nothing.
    const { error } = await supabase
        .from('spa_hilot_inclusions')
        .upsert(
            ordered.map((row, position) => ({
                id: row.id,
                item: row.item,
                is_active: row.isActive,
                sort_order: position + 1,
            })),
        )

    if (error) {
        console.error('Could not reorder the inclusions:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    await loadSpaHilot()
    return { ok: true }
}


// =================================================================== realtime

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'spa_hilot' }, loadSpaHilot)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'spa_hilot_inclusions' }, loadSpaHilot)
        .subscribe()
}

if (isSupabaseConfigured) {
    loadSpaHilot()
    watchRealtime()
}
