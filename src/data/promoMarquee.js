// ============================================================================
//  Camp Ba-long — the promo ticker's copy
// ----------------------------------------------------------------------------
//  One row in Postgres (public.promo_marquee), read by the home page banner and
//  written by Units → Manage Accommodations. See the header of
//  supabase/migrations/*_promo_marquee.sql for why it is a singleton and why
//  the wording is typed rather than derived from the rates.
//
//  Its own tiny store rather than a corner of accommodationDB.js: nothing here
//  touches bookings, availability or the rate table, and a banner failing to
//  load must never be able to take the booking flow's state with it.
//
//  A DATABASE THAT PREDATES THE TABLE
//  ----------------------------------
//  Answers "no banner" rather than an error. The home page then renders nothing
//  above the accommodations, which is exactly what it did before this existed.
// ============================================================================

import { useSyncExternalStore } from 'react'
import { supabase, isSupabaseConfigured, describeSupabaseError } from '../lib/supabaseClient.js'

const ROW_ID = 'home'
const CHANNEL = 'promo-marquee-changes'

// `loaded` is what tells the banner the difference between "not asked yet" and
// "asked, and there is nothing to show" — the first must not flash an empty bar.
let state = { messages: [], isActive: false, loaded: false, error: null }

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

export function usePromoMarquee() {
    return useSyncExternalStore(subscribe, snapshot)
}

export async function loadPromoMarquee() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const { data, error } = await supabase
        .from('promo_marquee')
        .select('messages, is_active')
        .eq('id', ROW_ID)
        .maybeSingle()

    if (error) {
        // Not worth a message on the page: the banner is decoration, and a home
        // page missing its promo bar is a smaller problem than one showing an
        // error where the promo should be.
        console.error('Could not load the promo banner:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    commit({
        messages: Array.isArray(data?.messages) ? data.messages.filter(Boolean) : [],
        isActive: data?.is_active === true,
        loaded: true,
        error: null,
    })
}

// Staff write. The row is seeded by the migration, so this is always an update
// — and `.select()` is what turns an update that matched nothing into an answer
// rather than a silent success (the same reasoning as saveAccommodationType).
export async function savePromoMarquee(draft) {
    if (!isSupabaseConfigured) {
        return { ok: false, message: 'Supabase is not configured, so this cannot be saved.' }
    }

    // Typed one per line, blank lines dropped — the same shape as an
    // accommodation's "What's Included" list.
    const messages = String(draft.messages ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

    const isActive = draft.isActive === true

    // Refused rather than saved: a banner switched on with nothing in it is an
    // empty bar across the home page, and the cause would not be obvious from
    // looking at it.
    if (isActive && messages.length === 0) {
        return { ok: false, message: 'Write at least one line before switching the banner on.' }
    }

    const { data, error } = await supabase
        .from('promo_marquee')
        .update({ messages, is_active: isActive })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the promo banner:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'promo banner migration has not been applied to this database yet.',
        }
    }

    await loadPromoMarquee()
    return { ok: true }
}

// A banner switched on mid-sale reaches guests already sitting on the home page.
function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'promo_marquee' },
            loadPromoMarquee,
        )
        .subscribe()
}

if (isSupabaseConfigured) {
    loadPromoMarquee()
    watchRealtime()
}
