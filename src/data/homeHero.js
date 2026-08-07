// ============================================================================
//  Camp Ba-long — the home page hero's content
// ----------------------------------------------------------------------------
//  One row in Postgres (public.home_hero) plus the strip of feature tiles under
//  it (public.home_hero_features), read by the home page and written by the
//  dashboard's CMS → Hero Banner. See the header of
//  supabase/migrations/*_home_hero_cms.sql for why the hero is a singleton and
//  the tiles are rows.
//
//  Its own tiny store rather than a corner of accommodationDB.js: nothing here
//  touches bookings, availability or the rate table, and the front page failing
//  to load its copy must never be able to take the booking flow's state with
//  it.
//
//  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
//  ----------------------------------------------
//  HERO_FALLBACK below is, word for word, what src/pages/home.jsx used to have
//  hardcoded. It is what the page renders on the first paint (before the row
//  has landed), on a database that predates the table, and with no .env at all
//  — the same three moments the accommodation catalog already degrades for. So
//  the hero is never blank and never half-built; it is either the shipped copy
//  or the copy staff have written over it.
//
//  IMAGES AND VIDEO
//  ----------------
//  The photo, the background still and the clip are bundled assets: Vite hashes
//  their filenames at build time, so the final URL is not knowable from SQL.
//  The row therefore stores null until staff upload something, and null means
//  "use the bundled one" — resolveHeroImage / resolveHeroBackground /
//  resolveHeroVideo are where that decision is made, once, for everyone who
//  asks (the home page and the dashboard's preview both do).
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

import bundledPhoto from '../assets/images/CampBalong.webp'
import bundledBackground from '../assets/images/herobanner.png'
import bundledVideo from '../assets/video/campbalongVideo.mp4'

import bedSvg from '../assets/svg/bed.svg'
import waterSvg from '../assets/svg/water.svg'
import diningSvg from '../assets/svg/dining.svg'
import camSvg from '../assets/svg/cam.svg'
import leafSvg from '../assets/svg/leaf.svg'
import heartSvg from '../assets/svg/heart.svg'
import familySvg from '../assets/svg/family.svg'
import timeSvg from '../assets/svg/time.svg'
import parkingSvg from '../assets/svg/parking.svg'
import transpoSvg from '../assets/svg/transpo.svg'

const ROW_ID = 'home'
const CHANNEL = 'home-hero-changes'

// The bundled icons a feature tile can name, keyed the way the row stores them.
// Exported as a list too, because the dashboard's icon picker is built from it
// rather than from a second copy that would drift.
const ICONS = {
    bed: bedSvg,
    water: waterSvg,
    dining: diningSvg,
    cam: camSvg,
    leaf: leafSvg,
    heart: heartSvg,
    family: familySvg,
    time: timeSvg,
    parking: parkingSvg,
    transpo: transpoSvg,
}

export const HERO_ICON_OPTIONS = [
    { value: 'bed', label: 'Bed — stays and rooms' },
    { value: 'water', label: 'Water — pools and the spring' },
    { value: 'dining', label: 'Dining — food and drinks' },
    { value: 'cam', label: 'Camera — experiences and views' },
    { value: 'leaf', label: 'Leaf — nature and the grounds' },
    { value: 'heart', label: 'Heart — wellness and the spa' },
    { value: 'family', label: 'Family — groups and events' },
    { value: 'time', label: 'Clock — opening hours' },
    { value: 'parking', label: 'Parking — free parking' },
    { value: 'transpo', label: 'Transport — getting here' },
]

// Word for word what the front end used to have written into it.
export const HERO_FALLBACK = {
    titleLines: ['Book Your', 'Perfect Resort'],
    accentLine: 'Getaway',
    subtitle:
        'Escape the everyday with comfortable accommodations, relaxing amenities, '
        + 'delicious dining, and unforgettable experiences—all in one destination. '
        + 'Reserve your stay in just a few clicks.',
    primaryLabel: 'Book Now',
    primaryHref: '/booking',
    secondaryLabel: 'Explore Rooms',
    secondaryHref: '#accommodations',
    imageUrl: null,
    backgroundUrl: null,
    videoUrl: null,
    showVideo: true,
}

export const HERO_FEATURES_FALLBACK = [
    { id: 'comfortable-stays', title: 'Comfortable Stays', description: 'Well-appointed rooms for a relaxing stay', iconKey: 'bed', iconUrl: null, sortOrder: 1, isActive: true },
    { id: 'relaxing-amenities', title: 'Relaxing Amenities', description: 'Pools, spa, and more for your comfort', iconKey: 'water', iconUrl: null, sortOrder: 2, isActive: true },
    { id: 'delicious-dining', title: 'Delicious Dining', description: 'A variety of cuisines to satisfy you', iconKey: 'dining', iconUrl: null, sortOrder: 3, isActive: true },
    { id: 'unforgettable-experiences', title: 'Unforgettable Experiences', description: "Activities and moments you'll cherish forever", iconKey: 'cam', iconUrl: null, sortOrder: 4, isActive: true },
]

// `loaded` is what tells a caller the difference between "not asked yet" and
// "asked, and this is the answer". Until it flips, `hero` and `features` are
// the shipped copy, so the page above the fold is never empty.
let state = {
    hero: HERO_FALLBACK,
    features: HERO_FEATURES_FALLBACK,      // every row, including hidden ones
    activeFeatures: HERO_FEATURES_FALLBACK, // what a guest is shown
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
    // A new object identity is what useSyncExternalStore compares on.
    state = { ...state, ...next }
    notify()
}

// The guest home page and the dashboard's editor read the same store. The
// difference is only which feature list they take off it: the dashboard needs
// the hidden tiles (somebody has to be able to put one back), the home page
// must never render them. Both arrays are built once, at commit time, so the
// snapshot each hook returns keeps a stable identity between renders.
export function useHomeHero() {
    return useSyncExternalStore(subscribe, snapshot)
}

function rowToHero(row) {
    if (!row) return HERO_FALLBACK
    const lines = Array.isArray(row.title_lines) ? row.title_lines.filter(Boolean) : []
    return {
        // A row saved with an empty headline would otherwise put a blank space
        // where the front page's first words go.
        titleLines: lines.length > 0 ? lines : HERO_FALLBACK.titleLines,
        accentLine: row.accent_line ?? '',
        subtitle: row.subtitle ?? '',
        primaryLabel: row.primary_label ?? '',
        primaryHref: row.primary_href ?? '',
        secondaryLabel: row.secondary_label ?? '',
        secondaryHref: row.secondary_href ?? '',
        imageUrl: row.image_url ?? null,
        backgroundUrl: row.background_url ?? null,
        videoUrl: row.video_url ?? null,
        showVideo: row.show_video !== false,
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

export async function loadHomeHero() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const [heroResult, featuresResult] = await Promise.all([
        supabase
            .from('home_hero')
            .select(
                'title_lines, accent_line, subtitle, primary_label, primary_href, '
                + 'secondary_label, secondary_href, image_url, background_url, '
                + 'video_url, show_video',
            )
            .eq('id', ROW_ID)
            .maybeSingle(),
        supabase
            .from('home_hero_features')
            .select('id, title, description, icon_key, icon_url, sort_order, is_active')
            .order('sort_order', { ascending: true }),
    ])

    const error = heroResult.error ?? featuresResult.error
    if (error) {
        // Not worth a message on the page: the fallback copy is already on
        // screen, and a front page showing an error where its headline should
        // be is a far bigger problem than one showing last week's wording.
        // The dashboard does surface `error`, because there it is the answer
        // to "why did nothing I typed show up".
        console.error('Could not load the hero banner:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    const features = (featuresResult.data ?? []).map(rowToFeature)

    commit({
        hero: rowToHero(heroResult.data),
        // An empty table means somebody deleted every tile, which is a
        // deliberate act — the strip goes away rather than reverting to the
        // four the site shipped with.
        features,
        activeFeatures: features.filter((feature) => feature.isActive),
        loaded: true,
        error: null,
    })
}

// What a guest is actually shown, resolved in one place so the home page and
// the dashboard's preview never disagree about which photo is live.
export function resolveHeroImage(imageUrl = null) {
    return imageUrl || bundledPhoto
}

export function resolveHeroBackground(backgroundUrl = null) {
    return backgroundUrl || bundledBackground
}

export function resolveHeroVideo(videoUrl = null) {
    return videoUrl || bundledVideo
}

export function resolveHeroIcon(iconKey = '', iconUrl = null) {
    // The upload wins: staff who replaced a tile's icon have said what they
    // want shown, and a bundled asset outranking it would look like the upload
    // had been thrown away.
    return iconUrl || ICONS[iconKey] || null
}


// ==================================================================== writing

function slugify(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
}

// An id nobody is using yet, so two tiles called "Free Parking" can both exist.
function uniqueId(base, taken) {
    if (!taken.has(base)) return base
    let n = 2
    while (taken.has(`${base}-${n}`)) n += 1
    return `${base}-${n}`
}

// Staff write. The row is seeded by the migration, so this is always an update
// — and `.select()` is what turns an update that matched nothing into an answer
// rather than a silent success (the same reasoning as savePromoMarquee).
export async function saveHomeHero(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    // Typed one line per line, blank lines dropped — the same shape as an
    // accommodation's "What's Included" list.
    const titleLines = String(draft.titleLines ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

    const accentLine = String(draft.accentLine ?? '').trim()

    // Refused rather than saved: the headline is the first thing on the site,
    // and a hero with nothing in it does not read as a mistake staff made — it
    // reads as a broken page.
    if (titleLines.length === 0 && !accentLine) {
        return { ok: false, message: 'Write a headline before saving — it is the first line on the site.' }
    }

    const row = {
        title_lines: titleLines,
        accent_line: accentLine || null,
        subtitle: String(draft.subtitle ?? '').trim() || null,
        primary_label: String(draft.primaryLabel ?? '').trim() || null,
        primary_href: String(draft.primaryHref ?? '').trim() || null,
        secondary_label: String(draft.secondaryLabel ?? '').trim() || null,
        secondary_href: String(draft.secondaryHref ?? '').trim() || null,
    }

    // The photo, background and clip live in the same row but in their own
    // form (saveHomeHeroMedia below), and are deliberately absent here: an
    // UPDATE touches only the columns given, so editing the wording cannot
    // blank a photo the form never showed.
    const { data, error } = await supabase
        .from('home_hero')
        .update(row)
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the hero banner:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'home hero migration has not been applied to this database yet.',
        }
    }

    await loadHomeHero()
    return { ok: true }
}

// The media half of the same row. Split from the copy above so the two forms
// can be opened separately without either one clearing the other's columns.
export async function saveHomeHeroMedia(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase
        .from('home_hero')
        .update({
            image_url: String(draft.imageUrl ?? '').trim() || null,
            background_url: String(draft.backgroundUrl ?? '').trim() || null,
            video_url: String(draft.videoUrl ?? '').trim() || null,
            show_video: draft.showVideo !== false,
        })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the hero media:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'home hero migration has not been applied to this database yet.',
        }
    }

    await loadHomeHero()
    return { ok: true }
}

// Create or edit one tile in the feature strip.
export async function saveHeroFeature(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const title = String(draft.title ?? '').trim()
    if (!title) return { ok: false, message: 'Give the feature a heading.' }

    const isNew = !draft.id
    const taken = new Set(state.features.map((feature) => feature.id))
    const id = draft.id || uniqueId(slugify(title) || 'feature', taken)

    const row = {
        title,
        description: String(draft.description ?? '').trim() || null,
        icon_key: String(draft.iconKey ?? '').trim() || null,
        icon_url: String(draft.iconUrl ?? '').trim() || null,
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    // INSERT and UPDATE rather than upsert, the same reasoning as
    // saveAccommodationType: an upsert builds a whole row first, so a partial
    // payload is a partial INSERT before Postgres ever reaches the conflict.
    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from('home_hero_features').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('home_hero_features')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the hero feature:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that feature no longer exists, or this account is '
                + 'not on the staff roster.',
        }
    }

    await loadHomeHero()
    return { ok: true, id }
}

export async function deleteHeroFeature(id) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase
        .from('home_hero_features')
        .delete()
        .eq('id', id)
        .select('id')

    if (error) {
        console.error('Could not delete the hero feature:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was deleted — that feature is already gone, or this account is '
                + 'not on the staff roster.',
        }
    }

    await loadHomeHero()
    return { ok: true }
}

// Move a tile one place along the strip. The list on screen IS the order
// stored, so there is no sort number for staff to keep in step — the same
// arrangement the accommodation gallery uses.
export async function moveHeroFeature(id, direction) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const ordered = [...state.features].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordered.findIndex((feature) => feature.id === id)
    const target = index + (direction === 'up' ? -1 : 1)
    if (index === -1 || target < 0 || target >= ordered.length) return { ok: true }

    const [moved] = ordered.splice(index, 1)
    ordered.splice(target, 0, moved)

    // Renumbered from 1 rather than swapping two values: rows seeded or added
    // at different times can share a sort_order, and swapping equal numbers
    // moves nothing.
    const { error } = await supabase
        .from('home_hero_features')
        .upsert(
            ordered.map((feature, position) => ({
                id: feature.id,
                title: feature.title,
                description: feature.description || null,
                icon_key: feature.iconKey || null,
                icon_url: feature.iconUrl || null,
                is_active: feature.isActive,
                sort_order: position + 1,
            })),
        )

    if (error) {
        console.error('Could not reorder the hero features:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    await loadHomeHero()
    return { ok: true }
}


// =================================================================== realtime
//  So a headline corrected mid-morning reaches the visitors already sitting on
//  the home page, rather than waiting for each of them to reload.

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'home_hero' }, loadHomeHero)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'home_hero_features' }, loadHomeHero)
        .subscribe()
}

if (isSupabaseConfigured) {
    loadHomeHero()
    watchRealtime()
}
