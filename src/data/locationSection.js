// ============================================================================
//  Camp Ba-long — the Location section's content
// ----------------------------------------------------------------------------
//  The heading and the "Get Directions" button (public.location_section), the
//  rows of the contact card (public.location_details) and the tiles under the
//  map (public.location_features) — read by the home page and written by the
//  dashboard's CMS → Location. See the header of
//  supabase/migrations/*_location_section_cms.sql.
//
//  Built the same way as the five CMS stores before it, deliberately: six
//  sections of one page doing the same job should not each be a surprise to
//  whoever reads them next.
//
//  THE MAP IS NOT HERE
//  -------------------
//  The embedded Google map stays written into components/location.jsx. It is a
//  URL carrying a place query and a set of coordinates rather than copy, and
//  getting one character wrong in it fails silently — the frame shows the wrong
//  village and reads as a broken site. The button beside it IS here: a label
//  and a link, like the hero's two buttons.
//
//  ICONS
//  -----
//  Rows name an icon rather than holding one, because Vite decides the
//  artwork's final URL at build time. data/cmsIcons.js is where a name becomes
//  something on screen, and all six of this section's icons were added to it
//  with this section — they were imported straight into the component before,
//  so no row could name them.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

const ROW_ID = 'home'
const CHANNEL = 'location-section-changes'

// Word for word what the front end used to have written into it.
export const LOCATION_SECTION_FALLBACK = {
    eyebrow: 'Our Location',
    title: 'We’d Love to See You',
    subtitle: 'Visit us at Camp Ba-long. We’re always happy to welcome you!',
    directionsLabel: 'Get Directions',
    directionsHref: 'https://maps.app.goo.gl/69TemNpuTw41mkDo6',
}

export const LOCATION_DETAILS_FALLBACK = [
    {
        id: 'address',
        label: 'Address',
        lines: ['Brgy. Laguan', 'Liliw, Laguna', 'Philippines'],
        iconKey: 'address',
        iconUrl: null,
        sortOrder: 1,
        isActive: true,
    },
    {
        id: 'phone',
        label: 'Phone',
        lines: ['+63 9622 331 708'],
        iconKey: 'phone',
        iconUrl: null,
        sortOrder: 2,
        isActive: true,
    },
    {
        id: 'email',
        label: 'Email',
        lines: ['campbalongnaturefarm@gmail.com'],
        iconKey: 'email',
        iconUrl: null,
        sortOrder: 3,
        isActive: true,
    },
    {
        id: 'admin-hours',
        label: 'Admin Hours',
        lines: ['Monday(Resort maintenance) Tuesday – Sunday: 10:00 AM – 5:00 PM'],
        iconKey: 'admin',
        iconUrl: null,
        sortOrder: 4,
        isActive: true,
    },
]

export const LOCATION_FEATURES_FALLBACK = [
    { id: 'easy-to-reach', title: 'Easy to Reach', description: 'Conveniently located with easy access by car.', iconKey: 'car', iconUrl: null, sortOrder: 1, isActive: true },
    { id: 'public-transit', title: 'Public Transit', description: 'Close to major jeepney JODA and Tricycle TODA.', iconKey: 'transpo', iconUrl: null, sortOrder: 2, isActive: true },
    { id: 'parking-available', title: 'Parking Available', description: 'Free parking available for all guests.', iconKey: 'parking', iconUrl: null, sortOrder: 3, isActive: true },
    { id: 'scenic-route', title: 'Scenic Route', description: 'A relaxing drive surrounded by nature.', iconKey: 'route', iconUrl: null, sortOrder: 4, isActive: true },
]

// Each list is kept twice, all rows and visible rows, both built at commit time
// so the snapshot the hook returns keeps a stable identity between renders.
let state = {
    section: LOCATION_SECTION_FALLBACK,
    details: LOCATION_DETAILS_FALLBACK,
    activeDetails: LOCATION_DETAILS_FALLBACK,
    features: LOCATION_FEATURES_FALLBACK,
    activeFeatures: LOCATION_FEATURES_FALLBACK,
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

export function useLocationSection() {
    return useSyncExternalStore(subscribe, snapshot)
}

function rowToSection(row) {
    if (!row) return LOCATION_SECTION_FALLBACK
    return {
        eyebrow: row.eyebrow ?? '',
        title: row.title ?? '',
        subtitle: row.subtitle ?? '',
        directionsLabel: row.directions_label ?? '',
        directionsHref: row.directions_href ?? '',
    }
}

function rowToDetail(row) {
    return {
        id: row.id,
        label: row.label,
        // Blank entries dropped here rather than at render time, so a stray
        // empty line saved into the array cannot open a gap in the card.
        lines: (Array.isArray(row.lines) ? row.lines : []).filter(Boolean),
        iconKey: row.icon_key ?? '',
        iconUrl: row.icon_url ?? null,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    }
}

function rowToFeature(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description ?? '',
        iconKey: row.icon_key ?? '',
        iconUrl: row.icon_url ?? null,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    }
}

export async function loadLocationSection() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const [sectionResult, detailsResult, featuresResult] = await Promise.all([
        supabase
            .from('location_section')
            .select('eyebrow, title, subtitle, directions_label, directions_href')
            .eq('id', ROW_ID)
            .maybeSingle(),
        supabase
            .from('location_details')
            .select('id, label, lines, icon_key, icon_url, sort_order, is_active')
            .order('sort_order', { ascending: true }),
        supabase
            .from('location_features')
            .select('id, title, description, icon_key, icon_url, sort_order, is_active')
            .order('sort_order', { ascending: true }),
    ])

    const error = sectionResult.error ?? detailsResult.error ?? featuresResult.error
    if (error) {
        // Not worth a message on the page: the fallback copy is already on
        // screen. The dashboard does surface `error`, because there it is the
        // answer to "why did nothing I typed show up".
        console.error('Could not load the location section:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    const details = (detailsResult.data ?? []).map(rowToDetail)
    const features = (featuresResult.data ?? []).map(rowToFeature)

    commit({
        section: rowToSection(sectionResult.data),
        details,
        activeDetails: details.filter((row) => row.isActive),
        features,
        activeFeatures: features.filter((row) => row.isActive),
        loaded: true,
        error: null,
    })
}


// ==================================================================== writing

function slugify(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
}

function uniqueId(base, taken) {
    if (!taken.has(base)) return base
    let n = 2
    while (taken.has(`${base}-${n}`)) n += 1
    return `${base}-${n}`
}

// Typed one line per line, blank lines dropped — the same shape as the hero's
// headline and an accommodation's "What's Included" list.
function toLines(text) {
    return String(text ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
}

export async function saveLocationSection(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const title = String(draft.title ?? '').trim()
    if (!title) {
        return { ok: false, message: 'Write a heading — it is what the section is called on the page.' }
    }

    // The row is seeded by the migration, so this is always an update — and
    // `.select()` is what turns an update that matched nothing into an answer
    // rather than a silent success.
    const { data, error } = await supabase
        .from('location_section')
        .update({
            eyebrow: String(draft.eyebrow ?? '').trim() || null,
            title,
            subtitle: String(draft.subtitle ?? '').trim() || null,
            directions_label: String(draft.directionsLabel ?? '').trim() || null,
            directions_href: String(draft.directionsHref ?? '').trim() || null,
        })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the location heading:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'location section migration has not been applied to this database yet.',
        }
    }

    await loadLocationSection()
    return { ok: true }
}

// Create or edit one row of the contact card.
export async function saveLocationDetail(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const label = String(draft.label ?? '').trim()
    if (!label) return { ok: false, message: 'Give the row a label — "Phone", "Address".' }

    const lines = toLines(draft.lines)
    // Refused rather than saved: a labelled row with nothing under it is a
    // heading and a gap on the card, which reads as something that failed to
    // load rather than something nobody filled in.
    if (lines.length === 0) {
        return { ok: false, message: 'Write what goes under the label — one line per line.' }
    }

    const isNew = !draft.id
    const taken = new Set(state.details.map((row) => row.id))
    const id = draft.id || uniqueId(slugify(label) || 'detail', taken)

    const row = {
        label,
        lines,
        icon_key: String(draft.iconKey ?? '').trim() || null,
        icon_url: String(draft.iconUrl ?? '').trim() || null,
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from('location_details').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('location_details')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the location detail:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that row no longer exists, or this account is not on '
                + 'the staff roster.',
        }
    }

    await loadLocationSection()
    return { ok: true, id }
}

export async function deleteLocationDetail(id) {
    return deleteRow('location_details', id, 'row')
}

// Create or edit one tile in the strip under the map.
export async function saveLocationFeature(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const title = String(draft.title ?? '').trim()
    if (!title) return { ok: false, message: 'Give the tile a heading.' }

    const isNew = !draft.id
    const taken = new Set(state.features.map((row) => row.id))
    const id = draft.id || uniqueId(slugify(title) || 'feature', taken)

    const row = {
        title,
        description: String(draft.description ?? '').trim() || null,
        icon_key: String(draft.iconKey ?? '').trim() || null,
        icon_url: String(draft.iconUrl ?? '').trim() || null,
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from('location_features').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('location_features')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the location tile:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that tile no longer exists, or this account is not on '
                + 'the staff roster.',
        }
    }

    await loadLocationSection()
    return { ok: true, id }
}

export async function deleteLocationFeature(id) {
    return deleteRow('location_features', id, 'tile')
}

async function deleteRow(table, id, noun) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase.from(table).delete().eq('id', id).select('id')

    if (error) {
        console.error(`Could not delete the ${noun}:`, error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: `Nothing was deleted — that ${noun} is already gone, or this account is `
                + 'not on the staff roster.',
        }
    }

    await loadLocationSection()
    return { ok: true }
}

// Move a row one place along its list. The list on screen IS the order stored,
// so there is no sort number for staff to keep in step.
async function moveRow(table, rows, id, direction, columns) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const ordered = [...rows].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordered.findIndex((row) => row.id === id)
    const target = index + (direction === 'up' ? -1 : 1)
    if (index === -1 || target < 0 || target >= ordered.length) return { ok: true }

    const [moved] = ordered.splice(index, 1)
    ordered.splice(target, 0, moved)

    // Renumbered from 1 rather than swapping two values: rows seeded or added
    // at different times can share a sort_order, and swapping equal numbers
    // moves nothing.
    const { error } = await supabase
        .from(table)
        .upsert(ordered.map((row, position) => ({ ...columns(row), sort_order: position + 1 })))

    if (error) {
        console.error(`Could not reorder ${table}:`, error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    await loadLocationSection()
    return { ok: true }
}

export function moveLocationDetail(id, direction) {
    return moveRow('location_details', state.details, id, direction, (row) => ({
        id: row.id,
        label: row.label,
        lines: row.lines,
        icon_key: row.iconKey || null,
        icon_url: row.iconUrl || null,
        is_active: row.isActive,
    }))
}

export function moveLocationFeature(id, direction) {
    return moveRow('location_features', state.features, id, direction, (row) => ({
        id: row.id,
        title: row.title,
        description: row.description || null,
        icon_key: row.iconKey || null,
        icon_url: row.iconUrl || null,
        is_active: row.isActive,
    }))
}


// =================================================================== realtime

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'location_section' }, loadLocationSection)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'location_details' }, loadLocationSection)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'location_features' }, loadLocationSection)
        .subscribe()
}

if (isSupabaseConfigured) {
    loadLocationSection()
    watchRealtime()
}
