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
// Uploading even one photo replaces the whole strip rather than topping it up.
// The alternative — bundled photos filling the gaps behind uploaded ones —
// leaves staff with a set they cannot fully control from the dashboard, since
// a bundled photo has no row to remove.
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
