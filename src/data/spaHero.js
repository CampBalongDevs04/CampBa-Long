// ============================================================================
//  Camp Ba-long — the /spa page banner's content
// ----------------------------------------------------------------------------
//  One row in Postgres (public.spa_hero), read by the spa page and written by
//  the dashboard's CMS → Spa Service → Banner tab. See the header of
//  supabase/migrations/20260808180000_spa_hero_cms.sql for the schema's own
//  reasoning.
//
//  Built the same way as data/menuHero.js, deliberately: this is the same job
//  (a page's own top banner, staff should be able to reword and re-photograph
//  without a redeploy) on a different page.
//
//  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
//  ------------------------------------------------
//  SPA_HERO_FALLBACK below is, word for word, what src/pages/spaService.jsx
//  used to have hardcoded. It is what the page renders on the first paint
//  (before the row has landed), on a database that predates the table, and
//  with no .env at all.
//
//  THE BACKDROP
//  ------------
//  There is no `resolveSpaHeroBackground` here, unlike menuHero.js. The photo
//  the site ships with is painted by spaService.css rather than imported into
//  JS, so null means "leave the stylesheet alone" and the page only sets an
//  inline background once staff have uploaded one — the same reasoning
//  home.jsx already uses for the home hero's backdrop. Importing the bundled
//  file here just to hand it straight back would make the CSS look dead the
//  next time somebody reads it.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

const ROW_ID = 'spa'
const CHANNEL = 'spa-hero-changes'

// Word for word what the front end used to have written into it.
export const SPA_HERO_FALLBACK = {
    titleLines: ['Reserve Your Moment of', 'Relaxation.'],
    subtitle: 'Book your next spa session and indulge in a world of tranquility and rejuvenation.',
    buttonLabel: 'Book Now',
    buttonHref: '#how-to-reserve',
    backgroundUrl: null,
}

// `loaded` is what tells a caller the difference between "not asked yet" and
// "asked, and this is the answer". Until it flips, `hero` is the shipped copy,
// so the top of the spa page is never empty.
let state = {
    hero: SPA_HERO_FALLBACK,
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

export function useSpaHero() {
    return useSyncExternalStore(subscribe, snapshot)
}

function rowToHero(row) {
    if (!row) return SPA_HERO_FALLBACK
    const lines = Array.isArray(row.title_lines) ? row.title_lines.filter(Boolean) : []
    return {
        // A row saved with an empty headline would otherwise put a blank space
        // where the spa page's first words go.
        titleLines: lines.length > 0 ? lines : SPA_HERO_FALLBACK.titleLines,
        subtitle: row.subtitle ?? '',
        buttonLabel: row.button_label || SPA_HERO_FALLBACK.buttonLabel,
        buttonHref: row.button_href || SPA_HERO_FALLBACK.buttonHref,
        backgroundUrl: row.background_url ?? null,
    }
}

export async function loadSpaHero() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const { data, error } = await supabase
        .from('spa_hero')
        .select('title_lines, subtitle, button_label, button_href, background_url')
        .eq('id', ROW_ID)
        .maybeSingle()

    if (error) {
        // Not worth a message on the page: the fallback copy is already on
        // screen, and a spa page showing an error where its headline should be
        // is a far bigger problem than one showing last week's wording. The
        // dashboard does surface `error`, because there it is the answer to
        // "why did nothing I typed show up".
        console.error('Could not load the spa banner:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    commit({ hero: rowToHero(data), loaded: true, error: null })
}


// ==================================================================== writing

// Staff write. The row is seeded by the migration, so this is always an
// update — and `.select()` is what turns an update that matched nothing into
// an answer rather than a silent success.
export async function saveSpaHero(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    // Typed one line per line, blank lines dropped — the same shape as the
    // home and menu headlines.
    const titleLines = String(draft.titleLines ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

    // Refused rather than saved: the headline is the first thing on this page,
    // and a banner with nothing in it does not read as a mistake staff made —
    // it reads as a broken page.
    if (titleLines.length === 0) {
        return { ok: false, message: 'Write a headline before saving — it is the first line on the page.' }
    }

    const buttonLabel = String(draft.buttonLabel ?? '').trim()

    const { data, error } = await supabase
        .from('spa_hero')
        .update({
            title_lines: titleLines,
            subtitle: String(draft.subtitle ?? '').trim() || null,
            // Blank is allowed here, unlike the menu banner: /spa's button
            // only scrolls further down a page the visitor is already on, so
            // taking it off costs them nothing they cannot get by scrolling.
            button_label: buttonLabel || null,
            button_href: String(draft.buttonHref ?? '').trim() || SPA_HERO_FALLBACK.buttonHref,
        })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the spa banner:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'spa banner migration has not been applied to this database yet.',
        }
    }

    await loadSpaHero()
    return { ok: true }
}

// The photo half of the same row. Split from the copy above so the two forms
// can be opened separately without either one clearing the other's columns.
export async function saveSpaHeroMedia(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase
        .from('spa_hero')
        .update({ background_url: String(draft.backgroundUrl ?? '').trim() || null })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the spa banner photo:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'spa banner migration has not been applied to this database yet.',
        }
    }

    await loadSpaHero()
    return { ok: true }
}


// =================================================================== realtime
//  So a headline corrected mid-morning reaches the visitors already sitting on
//  /spa, rather than waiting for each of them to reload.

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'spa_hero' }, loadSpaHero)
        .subscribe()
}

if (isSupabaseConfigured) {
    loadSpaHero()
    watchRealtime()
}
