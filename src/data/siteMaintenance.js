import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

const ROW_ID = 'resort'
const CHANNEL = 'site-maintenance-changes'

export const SITE_MAINTENANCE_DEFAULTS = {
    isOn: false,
    heading: 'Website on Maintenance',
    message: 'Feel free to message us.',
    facebookUrl: 'https://facebook.com/campbalong',
}

let state = { ...SITE_MAINTENANCE_DEFAULTS, loaded: false, error: null }

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

export function useSiteMaintenance() {
    return useSyncExternalStore(subscribe, snapshot)
}

export function isSiteOnMaintenance() {
    return state.isOn
}

function text(value, fallback = '') {
    return String(value ?? '').trim() || fallback
}

// A page typed as 'facebook.com/campbalong' still has to open as a link. Only
// http and https survive the prefix, so nothing else can end up in an href.
export function facebookHref(value) {
    const clean = text(value)
    if (!clean) return ''
    return /^https?:\/\//i.test(clean) ? clean : `https://${clean.replace(/^\/+/, '')}`
}

function rowToState(row) {
    if (!row) return { ...SITE_MAINTENANCE_DEFAULTS }
    return {
        isOn: row.is_on === true,
        heading: text(row.heading, SITE_MAINTENANCE_DEFAULTS.heading),
        message: text(row.message, SITE_MAINTENANCE_DEFAULTS.message),
        facebookUrl: facebookHref(row.facebook_url),
    }
}

export async function loadSiteMaintenance() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const { data, error } = await supabase
        .from('site_maintenance')
        .select('*')
        .eq('id', ROW_ID)
        .maybeSingle()

    // The site stays open when the setting cannot be read. A blocker nobody
    // asked for takes the whole resort off the internet; a missing one only
    // means staff have to try the switch again.
    if (error) {
        console.error('Could not load the maintenance page setting:', error.message)
        commit({
            ...SITE_MAINTENANCE_DEFAULTS,
            loaded: true,
            error: describeSupabaseError(error),
        })
        return
    }

    commit({ ...rowToState(data), loaded: true, error: null })
}

// Whichever keys the caller passes: the switch sends `isOn` alone, the wording
// form sends the three text fields and leaves the switch where it is.
export async function saveSiteMaintenance(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const payload = {}
    if (draft.isOn !== undefined) payload.is_on = draft.isOn === true
    if (draft.heading !== undefined) {
        payload.heading = text(draft.heading, SITE_MAINTENANCE_DEFAULTS.heading)
    }
    if (draft.message !== undefined) {
        payload.message = text(draft.message, SITE_MAINTENANCE_DEFAULTS.message)
    }
    if (draft.facebookUrl !== undefined) payload.facebook_url = facebookHref(draft.facebookUrl)

    const { data, error } = await supabase
        .from('site_maintenance')
        .update(payload)
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the maintenance page setting:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + '20260815140000_site_maintenance_page migration has not been applied to '
                + 'this database yet.',
        }
    }

    await loadSiteMaintenance()
    return { ok: true }
}

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'site_maintenance' },
            loadSiteMaintenance,
        )
        .subscribe()
}

if (isSupabaseConfigured) {
    loadSiteMaintenance()
    watchRealtime()
}
