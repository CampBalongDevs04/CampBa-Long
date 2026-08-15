// ============================================================================
//  Camp Ba-long — the Accommodations section's heading
// ----------------------------------------------------------------------------
//  One row in Postgres (public.accommodation_section), read by the home page
//  and written by the dashboard's CMS → Accommodations. Two fields: the
//  section's title and the line under it.
//
//  WHY THIS IS NOT PART OF accommodationDB.js
//  ------------------------------------------
//  That module is the booking system — the catalog, the rates, today's
//  availability, the queue. This is two sentences of decoration above it. They
//  are kept apart for the same reason the promo banner is: a heading failing to
//  load must never be able to take the booking flow's state with it, and the
//  heading is not something the booking flow has any opinion about.
//
//  WHY THE CARDS ARE NOT HERE
//  --------------------------
//  They already have an owner. Every card in that section is built from
//  accommodation_types and accommodation_rates and is edited in Units → Manage
//  Accommodations — name, photo, gallery, description, inclusions, price and
//  capacity — with its availability counted off real bookings. Adding any of
//  that to the CMS would give one field two screens to be edited on.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

const ROW_ID = 'home'
const CHANNEL = 'accommodation-section-changes'

// Word for word what the front end used to have written into it.
export const ACCOMMODATION_SECTION_FALLBACK = {
    title: 'Accommodations',
    subtitle: '• Find the perfect spot for your stay •',
}

let state = {
    section: ACCOMMODATION_SECTION_FALLBACK,
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

export function useAccommodationSection() {
    return useSyncExternalStore(subscribe, snapshot)
}

export async function loadAccommodationSection() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const { data, error } = await supabase
        .from('accommodation_section')
        .select('title, subtitle')
        .eq('id', ROW_ID)
        .maybeSingle()

    if (error) {
        // Not worth a message on the page: the fallback heading is already on
        // screen. The dashboard does surface `error`, because there it is the
        // answer to "why did nothing I typed show up".
        console.error('Could not load the accommodations heading:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    commit({
        section: data
            ? { title: data.title ?? '', subtitle: data.subtitle ?? '' }
            : ACCOMMODATION_SECTION_FALLBACK,
        loaded: true,
        error: null,
    })
}

// The row is seeded by the migration, so this is always an update — and
// `.select()` is what turns an update that matched nothing into an answer
// rather than a silent success.
export async function saveAccommodationSection(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const title = String(draft.title ?? '').trim()
    if (!title) {
        return { ok: false, message: 'Write a heading — it is what the section is called on the page.' }
    }

    const { data, error } = await supabase
        .from('accommodation_section')
        .update({
            title,
            subtitle: String(draft.subtitle ?? '').trim() || null,
        })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the accommodations heading:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'accommodations heading migration has not been applied to this database yet.',
        }
    }

    await loadAccommodationSection()
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
            { event: '*', schema: 'public', table: 'accommodation_section' },
            loadAccommodationSection,
        )
        .subscribe()
}

if (isSupabaseConfigured) {
    loadAccommodationSection()
    watchRealtime()
}
