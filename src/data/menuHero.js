// ============================================================================
//  Camp Ba-long — the /menu page banner's content
// ----------------------------------------------------------------------------
//  One row in Postgres (public.menu_hero), read by the food menu page and
//  written by the dashboard's CMS → Food Menu → Banner tab. See the header of
//  supabase/migrations/20260808140000_menu_hero_cms.sql for why this is its
//  own table rather than a corner of home_hero.
//
//  Built the same way as data/homeHero.js, deliberately: this is the same
//  job (a page's own top banner, staff should be able to reword and
//  re-photograph without a redeploy) on a different page.
//
//  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
//  ------------------------------------------------
//  MENU_HERO_FALLBACK below is, word for word, what src/pages/foodmenu.jsx
//  used to have hardcoded. It is what the page renders on the first paint
//  (before the row has landed), on a database that predates the table, and
//  with no .env at all.
//
//  IMAGES
//  ------
//  The circle photo and the blurred backdrop are bundled assets: Vite hashes
//  their filenames at build time, so the final URL is not knowable from SQL.
//  The row therefore stores null until staff upload something, and null means
//  "use the bundled one" — resolveMenuHeroImage / resolveMenuHeroBackground are
//  where that decision is made, once, for everyone who asks (the menu page and
//  the dashboard's preview both do).
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

import bundledPhoto from '../assets/images/food1.png'
import bundledBackground from '../assets/images/herobanner.png'

const ROW_ID = 'menu'
const CHANNEL = 'menu-hero-changes'

// Word for word what the front end used to have written into it.
export const MENU_HERO_FALLBACK = {
    titleLines: ["Hungry? We've Got", 'You Covered.'],
    subtitle: "Explore our menu and discover dishes you'll keep coming back for.",
    buttonLabel: 'Order Now',
    buttonHref: '#how-to-order',
    imageUrl: null,
    backgroundUrl: null,
}

// `loaded` is what tells a caller the difference between "not asked yet" and
// "asked, and this is the answer". Until it flips, `hero` is the shipped copy,
// so the top of the menu page is never empty.
let state = {
    hero: MENU_HERO_FALLBACK,
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

export function useMenuHero() {
    return useSyncExternalStore(subscribe, snapshot)
}

function rowToHero(row) {
    if (!row) return MENU_HERO_FALLBACK
    const lines = Array.isArray(row.title_lines) ? row.title_lines.filter(Boolean) : []
    return {
        // A row saved with an empty headline would otherwise put a blank space
        // where the menu page's first words go.
        titleLines: lines.length > 0 ? lines : MENU_HERO_FALLBACK.titleLines,
        subtitle: row.subtitle ?? '',
        buttonLabel: row.button_label || MENU_HERO_FALLBACK.buttonLabel,
        buttonHref: row.button_href || MENU_HERO_FALLBACK.buttonHref,
        imageUrl: row.image_url ?? null,
        backgroundUrl: row.background_url ?? null,
    }
}

export async function loadMenuHero() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const { data, error } = await supabase
        .from('menu_hero')
        .select('title_lines, subtitle, button_label, button_href, image_url, background_url')
        .eq('id', ROW_ID)
        .maybeSingle()

    if (error) {
        // Not worth a message on the page: the fallback copy is already on
        // screen, and a menu page showing an error where its headline should
        // be is a far bigger problem than one showing last week's wording.
        // The dashboard does surface `error`, because there it is the answer
        // to "why did nothing I typed show up".
        console.error('Could not load the menu banner:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    commit({ hero: rowToHero(data), loaded: true, error: null })
}

// What a guest is actually shown, resolved in one place so the menu page and
// the dashboard's preview never disagree about which photo is live.
export function resolveMenuHeroImage(imageUrl = null) {
    return imageUrl || bundledPhoto
}

export function resolveMenuHeroBackground(backgroundUrl = null) {
    return backgroundUrl || bundledBackground
}


// ==================================================================== writing

// Staff write. The row is seeded by the migration, so this is always an
// update — and `.select()` is what turns an update that matched nothing into
// an answer rather than a silent success (the same reasoning as
// saveHomeHero).
export async function saveMenuHero(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    // Typed one line per line, blank lines dropped — the same shape as the
    // home hero's headline.
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
    if (!buttonLabel) {
        return { ok: false, message: 'Give the button a label — clearing it leaves nothing to press.' }
    }

    const { data, error } = await supabase
        .from('menu_hero')
        .update({
            title_lines: titleLines,
            subtitle: String(draft.subtitle ?? '').trim() || null,
            button_label: buttonLabel,
            button_href: String(draft.buttonHref ?? '').trim() || MENU_HERO_FALLBACK.buttonHref,
        })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the menu banner:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'menu banner migration has not been applied to this database yet.',
        }
    }

    await loadMenuHero()
    return { ok: true }
}

// The photo half of the same row. Split from the copy above so the two forms
// can be opened separately without either one clearing the other's columns.
export async function saveMenuHeroMedia(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase
        .from('menu_hero')
        .update({
            image_url: String(draft.imageUrl ?? '').trim() || null,
            background_url: String(draft.backgroundUrl ?? '').trim() || null,
        })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the menu banner photos:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'menu banner migration has not been applied to this database yet.',
        }
    }

    await loadMenuHero()
    return { ok: true }
}


// =================================================================== realtime
//  So a headline corrected mid-morning reaches the visitors already sitting on
//  /menu, rather than waiting for each of them to reload.

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_hero' }, loadMenuHero)
        .subscribe()
}

if (isSupabaseConfigured) {
    loadMenuHero()
    watchRealtime()
}
