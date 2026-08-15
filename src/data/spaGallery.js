// ============================================================================
//  Camp Ba-long — the "Relax. Refresh. Rejuvenate." strip on /spa
// ----------------------------------------------------------------------------
//  One row in Postgres (public.spa_gallery), read by the spa page and written
//  by the dashboard's CMS → Spa Service → Gallery. See the header of
//  supabase/migrations/20260808200000_spa_gallery_cms.sql for why the photos
//  are an array column rather than a table of their own.
//
//  These are the DECORATIVE photos, not the treatment cards. The cards come
//  from public.spa_services via data/menuDB.js and are edited in the
//  dashboard's Spa section — nothing here touches them.
//
//  THE FALLBACK IS WHAT THE SITE SHIPPED WITH
//  --------------------------------------------
//  The two strings and the six photos below are, word for word and file for
//  file, what src/pages/spaService.jsx used to have hardcoded (its `service`
//  array and the header above it).
//
//  The photos are bundled assets: Vite hashes their filenames at build time,
//  so the final URLs are not knowable from SQL. The column therefore stays
//  empty until staff upload something, and empty means "use the bundled six" —
//  resolveSpaGalleryPhotos is where that decision is made, once, for everyone
//  who asks (the spa page and the dashboard's preview both do).
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'
import { uploadBundledImage } from './catalogImages.js'

import bundled1 from '../assets/images/massage1.png'
import bundled2 from '../assets/images/massage2.png'
import bundled3 from '../assets/images/massage3.png'
import bundled4 from '../assets/images/massage4.png'
import bundled5 from '../assets/images/massage5.png'
import bundled6 from '../assets/images/massage6.png'

const ROW_ID = 'spa'
const CHANNEL = 'spa-gallery-changes'

// The six the site ships with, in the order it shipped them.
export const SPA_GALLERY_BUNDLED = [bundled1, bundled2, bundled3, bundled4, bundled5, bundled6]

// Word for word what the front end used to have written into it.
export const SPA_GALLERY_FALLBACK = {
    heading: 'Relax. Refresh. Rejuvenate.',
    subtitle: 'Indulge in luxurious spa treatments designed to restore your body, calm your mind, and renew your spirit. Book your appointment in just a few clicks.',
    photos: [],
}

let state = {
    gallery: SPA_GALLERY_FALLBACK,
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

export function useSpaGallery() {
    return useSyncExternalStore(subscribe, snapshot)
}

function rowToGallery(row) {
    if (!row) return SPA_GALLERY_FALLBACK
    return {
        heading: row.heading || SPA_GALLERY_FALLBACK.heading,
        subtitle: row.subtitle ?? '',
        photos: Array.isArray(row.photos) ? row.photos.filter(Boolean) : [],
    }
}

export async function loadSpaGallery() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const { data, error } = await supabase
        .from('spa_gallery')
        .select('heading, subtitle, photos')
        .eq('id', ROW_ID)
        .maybeSingle()

    if (error) {
        console.error('Could not load the spa gallery:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    commit({ gallery: rowToGallery(data), loaded: true, error: null })
}

// What a guest is actually shown, resolved in one place so the spa page and
// the dashboard's preview never disagree about which photos are live.
//
// An empty column means the six the site shipped with. Mixing the two — bundled
// photos filling the gaps behind uploaded ones — is deliberately not a state
// this can be in: a bundled photo has no entry to reorder or remove, so a mixed
// strip would be one staff could see but only half control. importBundledSpaGallery
// below is how the six stop being bundled and start being editable.
export function resolveSpaGalleryPhotos(photos = []) {
    return photos.length > 0 ? photos : SPA_GALLERY_BUNDLED
}


// ==================================================================== writing

export async function saveSpaGallery(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const heading = String(draft.heading ?? '').trim()
    if (!heading) {
        return { ok: false, message: 'Write a heading — it is what the section is called on the page.' }
    }

    const { data, error } = await supabase
        .from('spa_gallery')
        .update({
            heading,
            subtitle: String(draft.subtitle ?? '').trim() || null,
        })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the spa gallery wording:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'spa gallery migration has not been applied to this database yet.',
        }
    }

    await loadSpaGallery()
    return { ok: true }
}

// The photo half of the same row. Split from the copy above so the two forms
// can be opened separately without either one clearing the other's columns.
//
// An empty list is a legitimate save: it is how staff put the six the site
// shipped with back.
export async function saveSpaGalleryPhotos(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const photos = Array.isArray(draft.photos) ? draft.photos.filter(Boolean) : []

    const { data, error } = await supabase
        .from('spa_gallery')
        .update({ photos })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the spa gallery photos:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'spa gallery migration has not been applied to this database yet.',
        }
    }

    await loadSpaGallery()
    return { ok: true }
}


// Copy the six photos the site shipped with into the resort's own storage, and
// save them as the gallery's real entries.
//
// WHY THIS EXISTS
// ---------------
// Until it runs, the strip on /spa is six files bundled into the build. They
// look like content but they are not: there is no entry behind them, so the
// dashboard has nothing to list, nothing to reorder and nothing to remove — a
// staff member opening Photos sees an upload button and no photos, and the only
// way to change ONE of the six is to re-upload all six by hand.
//
// This is that hand work, done once and by the machine. Afterwards every photo
// in the strip is an ordinary uploaded entry: reorder it, remove it, add a
// seventh, replace the third and leave the rest alone.
//
// WHY IT IS A BUTTON AND NOT AUTOMATIC
// ------------------------------------
// It writes — six uploads and a row update — and a page load should not do that
// on a staff member's behalf without being asked. It is also not something they
// would want undone silently: once imported, the strip stops tracking whatever
// the next build bundles, which is the whole point but is still a change worth
// choosing.
//
// A PARTIAL IMPORT SAVES NOTHING
// ------------------------------
// If the fourth upload fails, the three that landed are not saved. Saving them
// would swap a six-photo strip for a three-photo one as the result of an error,
// which is a worse page than the one staff started with. The strip is left
// exactly as it was and the failure is reported, so a retry is one press away.
// The orphaned uploads sit unreferenced in the bucket; they cost nothing and a
// retry does not compound them, because each upload gets a fresh random name.
//
// Each photo is shrunk and re-encoded on the way — see uploadBundledImage and
// shrinkImageForUpload in data/catalogImages.js for why that is not optional.
export async function importBundledSpaGallery(onProgress) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const total = SPA_GALLERY_BUNDLED.length
    const uploaded = []

    for (const [index, source] of SPA_GALLERY_BUNDLED.entries()) {
        onProgress?.({ done: index, total })

        const result = await uploadBundledImage(source, {
            name: `spa-gallery-${index + 1}`,
            folder: 'spa',
        })
        if (!result.ok) {
            return {
                ok: false,
                message: `Photo ${index + 1} of ${total} did not import: ${result.message} `
                    + 'Nothing was changed.',
            }
        }
        uploaded.push(result.url)
    }

    onProgress?.({ done: total, total })
    return saveSpaGalleryPhotos({ photos: uploaded })
}


// =================================================================== realtime

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'spa_gallery' }, loadSpaGallery)
        .subscribe()
}

if (isSupabaseConfigured) {
    loadSpaGallery()
    watchRealtime()
}
