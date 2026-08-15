// ============================================================================
//  Camp Ba-long — the "Welcome to Camp Ba-long" block's content
// ----------------------------------------------------------------------------
//  One row in Postgres (public.welcome_section) plus the two lists under it —
//  the photo triptych (public.welcome_highlights) and the green four-item panel
//  (public.welcome_tags) — read by the home page and written by the dashboard's
//  CMS → Welcome Section. See the header of
//  supabase/migrations/*_welcome_section_cms.sql for why the copy is a
//  singleton and the tiles are rows.
//
//  Built the same way as data/homeHero.js, deliberately: these two sections are
//  the same job (front page copy staff should be able to reword), and the
//  second one being a surprise to whoever reads it next would be a cost with
//  no benefit.
//
//  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
//  ----------------------------------------------
//  The constants below are, word for word, what src/components/offers.jsx used
//  to have hardcoded. They are what the page renders on the first paint, on a
//  database that predates the tables, and with no .env at all.
//
//  PHOTOS AND ICONS
//  ----------------
//  Both are bundled assets — Vite hashes them at build time, so their URLs are
//  not knowable from SQL. The rows therefore store null until staff upload
//  something, and null means "use the bundled one". Photos resolve here, by id;
//  icons resolve in components/CmsIcon.jsx, because some of them are React
//  components rather than files and only a component can render those.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

import poolImage from '../assets/images/poolplace.png'
import riverImage from '../assets/images/ilog.png'
import forestImage from '../assets/images/forest.png'

const ROW_ID = 'home'
const CHANNEL = 'welcome-section-changes'

// The collage places its photos at three fixed positions (.photo-1/2/3 in
// offers.css) because it is a triptych, not a grid. A fourth highlight is
// valid — it appears in the numbered list — but its photo has nowhere to go,
// so the collage takes the first three and the dashboard says so.
export const COLLAGE_PHOTO_COUNT = 3

// The photos the highlights SHIPPED with, keyed by id rather than stored in
// SQL for the reason above. A highlight added from the dashboard has no entry
// here and simply uses its uploaded photo.
const IMAGES_BY_ID = {
    'refreshing-pool': poolImage,
    'scenic-nature': riverImage,
    'relaxing-ambiance': forestImage,
}

// Word for word what the front end used to have written into it.
export const WELCOME_FALLBACK = {
    title: 'Welcome to Camp Ba-long',
    tagline: 'Where you can connect with your inner peace!',
    message: '• A HIDDEN PARADISE IN NATURE •',
    description:
        'Immerse yourself in the healing waters , surrounded by lush tropical forest. '
        + 'The perfect place to unwind, rejuvenate your body, and calm your mind.',
}

export const WELCOME_HIGHLIGHTS_FALLBACK = [
    {
        id: 'refreshing-pool',
        title: 'Refreshing Pool',
        description: 'Enjoy the cool, crystal-clear waters and peaceful atmosphere that make every visit refreshing and enjoyable.',
        imageUrl: null,
        imageAlt: 'Refreshing pool at Camp Ba-long',
        iconKey: 'pool',
        iconUrl: null,
        sortOrder: 1,
        isActive: true,
    },
    {
        id: 'scenic-nature',
        title: 'Scenic Nature',
        description: 'Enjoy the fresh air, lush greenery, and soothing sounds of nature. A peaceful escape from the busy world.',
        imageUrl: null,
        imageAlt: 'Scenic river surrounded by nature',
        iconKey: 'nature',
        iconUrl: null,
        sortOrder: 2,
        isActive: true,
    },
    {
        id: 'relaxing-ambiance',
        title: 'Relaxing Ambiance',
        description: "Whether you're here to soak, meditate, or simply relax, our hot springs offer the perfect balance of tranquility and nature.",
        imageUrl: null,
        imageAlt: 'Relaxing forest ambiance',
        iconKey: 'relaxation',
        iconUrl: null,
        sortOrder: 3,
        isActive: true,
    },
]

export const WELCOME_TAGS_FALLBACK = [
    { id: 'nature-inspired-escape', title: 'Nature-Inspired Escape', description: 'Relax and reconnect', iconKey: 'leaf', iconUrl: null, sortOrder: 1, isActive: true },
    { id: 'family-friendly', title: 'Family Friendly', description: 'Perfect for all ages', iconKey: 'family', iconUrl: null, sortOrder: 2, isActive: true },
    { id: 'scenic-serene', title: 'Scenic & Serene', description: 'Reconnect with nature', iconKey: 'camera', iconUrl: null, sortOrder: 3, isActive: true },
    { id: 'wellness-retreat', title: 'Wellness Retreat', description: 'Relax yourself', iconKey: 'heart', iconUrl: null, sortOrder: 4, isActive: true },
]

// Until `loaded` flips, this is the shipped copy — so the second block on the
// front page is never empty and never half-built. Each list is kept twice, all
// rows and visible rows, both built at commit time so the snapshot the hook
// returns keeps a stable identity between renders.
let state = {
    welcome: WELCOME_FALLBACK,
    highlights: WELCOME_HIGHLIGHTS_FALLBACK,
    activeHighlights: WELCOME_HIGHLIGHTS_FALLBACK,
    tags: WELCOME_TAGS_FALLBACK,
    activeTags: WELCOME_TAGS_FALLBACK,
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

export function useWelcomeSection() {
    return useSyncExternalStore(subscribe, snapshot)
}

function rowToWelcome(row) {
    if (!row) return WELCOME_FALLBACK
    return {
        title: row.title ?? '',
        tagline: row.tagline ?? '',
        message: row.message ?? '',
        description: row.description ?? '',
    }
}

function rowToHighlight(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description ?? '',
        imageUrl: row.image_url ?? null,
        imageAlt: row.image_alt ?? '',
        iconKey: row.icon_key ?? '',
        iconUrl: row.icon_url ?? null,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    }
}

function rowToTag(row) {
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

export async function loadWelcomeSection() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const [sectionResult, highlightsResult, tagsResult] = await Promise.all([
        supabase
            .from('welcome_section')
            .select('title, tagline, message, description')
            .eq('id', ROW_ID)
            .maybeSingle(),
        supabase
            .from('welcome_highlights')
            .select('id, title, description, image_url, image_alt, icon_key, icon_url, sort_order, is_active')
            .order('sort_order', { ascending: true }),
        supabase
            .from('welcome_tags')
            .select('id, title, description, icon_key, icon_url, sort_order, is_active')
            .order('sort_order', { ascending: true }),
    ])

    const error = sectionResult.error ?? highlightsResult.error ?? tagsResult.error
    if (error) {
        // Not worth a message on the page: the fallback copy is already on
        // screen. The dashboard does surface `error`, because there it is the
        // answer to "why did nothing I typed show up".
        console.error('Could not load the welcome section:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    const highlights = (highlightsResult.data ?? []).map(rowToHighlight)
    const tags = (tagsResult.data ?? []).map(rowToTag)

    commit({
        welcome: rowToWelcome(sectionResult.data),
        // An empty table means somebody removed every row, which is a
        // deliberate act — the block goes away rather than reverting to what
        // the site shipped with.
        highlights,
        activeHighlights: highlights.filter((highlight) => highlight.isActive),
        tags,
        activeTags: tags.filter((tag) => tag.isActive),
        loaded: true,
        error: null,
    })
}

// The photo one highlight shows, resolved in one place so the home page and
// the dashboard's preview never disagree about which is live.
export function resolveHighlightImage(id, imageUrl = null) {
    return imageUrl || IMAGES_BY_ID[id] || null
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

// The row is seeded by the migration, so this is always an update — and
// `.select()` is what turns an update that matched nothing into an answer
// rather than a silent success.
export async function saveWelcomeSection(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const title = String(draft.title ?? '').trim()
    if (!title) {
        return { ok: false, message: 'Write a heading — it is what the section is called on the page.' }
    }

    const { data, error } = await supabase
        .from('welcome_section')
        .update({
            title,
            tagline: String(draft.tagline ?? '').trim() || null,
            message: String(draft.message ?? '').trim() || null,
            description: String(draft.description ?? '').trim() || null,
        })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the welcome section:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'welcome section migration has not been applied to this database yet.',
        }
    }

    await loadWelcomeSection()
    return { ok: true }
}

// Create or edit one highlight: a collage photo and its entry in the list.
export async function saveWelcomeHighlight(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const title = String(draft.title ?? '').trim()
    if (!title) return { ok: false, message: 'Give the highlight a heading.' }

    const isNew = !draft.id
    const taken = new Set(state.highlights.map((highlight) => highlight.id))
    const id = draft.id || uniqueId(slugify(title) || 'highlight', taken)

    const imageUrl = String(draft.imageUrl ?? '').trim() || null

    // Refused rather than saved: a highlight with no photo of its own and no
    // bundled one leaves a hole in the collage, and the cause would not be
    // obvious from looking at the page.
    if (!resolveHighlightImage(id, imageUrl)) {
        return { ok: false, message: 'Upload a photo — this one appears in the collage.' }
    }

    const row = {
        title,
        description: String(draft.description ?? '').trim() || null,
        image_url: imageUrl,
        image_alt: String(draft.imageAlt ?? '').trim() || null,
        icon_key: String(draft.iconKey ?? '').trim() || null,
        icon_url: String(draft.iconUrl ?? '').trim() || null,
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from('welcome_highlights').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('welcome_highlights')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the highlight:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that highlight no longer exists, or this account is '
                + 'not on the staff roster.',
        }
    }

    await loadWelcomeSection()
    return { ok: true, id }
}

export async function deleteWelcomeHighlight(id) {
    return deleteRow('welcome_highlights', id, 'highlight')
}

// Create or edit one tile of the green panel.
export async function saveWelcomeTag(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const title = String(draft.title ?? '').trim()
    if (!title) return { ok: false, message: 'Give the tile a heading.' }

    const isNew = !draft.id
    const taken = new Set(state.tags.map((tag) => tag.id))
    const id = draft.id || uniqueId(slugify(title) || 'tag', taken)

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
        ;({ error } = await supabase.from('welcome_tags').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('welcome_tags')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the tile:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that tile no longer exists, or this account is not '
                + 'on the staff roster.',
        }
    }

    await loadWelcomeSection()
    return { ok: true, id }
}

export async function deleteWelcomeTag(id) {
    return deleteRow('welcome_tags', id, 'tile')
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

    await loadWelcomeSection()
    return { ok: true }
}

// Move a row one place along its list. The list on screen IS the order stored,
// so there is no sort number for staff to keep in step.
//
// The photo of a highlight moves with it, which is the point: reordering the
// list is how the collage is rearranged, and the numbers beside the entries
// (01, 02, 03) follow from the position rather than being typed.
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

    await loadWelcomeSection()
    return { ok: true }
}

export function moveWelcomeHighlight(id, direction) {
    return moveRow('welcome_highlights', state.highlights, id, direction, (row) => ({
        id: row.id,
        title: row.title,
        description: row.description || null,
        image_url: row.imageUrl || null,
        image_alt: row.imageAlt || null,
        icon_key: row.iconKey || null,
        icon_url: row.iconUrl || null,
        is_active: row.isActive,
    }))
}

export function moveWelcomeTag(id, direction) {
    return moveRow('welcome_tags', state.tags, id, direction, (row) => ({
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'welcome_section' }, loadWelcomeSection)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'welcome_highlights' }, loadWelcomeSection)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'welcome_tags' }, loadWelcomeSection)
        .subscribe()
}

if (isSupabaseConfigured) {
    loadWelcomeSection()
    watchRealtime()
}
