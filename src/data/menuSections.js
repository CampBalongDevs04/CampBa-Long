// ============================================================================
//  Camp Ba-long — the heading, toggle label, and banner photo each /menu
//  catalog section prints
// ----------------------------------------------------------------------------
//  One row in Postgres (public.menu_sections), read by the food menu page and
//  written by the dashboard's CMS → Food Menu → Section titles. MENU, COMBO
//  MEAL, PRE-ORDER and COFFEE (with its "Bukal Cafe..." eyebrow) — the
//  heading above each group of food_menu_items, the small show/hide toggle
//  button under each one, and (MENU only) the blurred banner photo behind the
//  heading. Not the items themselves, which stay in the Food Menu dashboard
//  SECTION. See the header of
//  supabase/migrations/20260808170000_menu_sections_cms.sql.
//
//  Built the same way as the stores before it, deliberately: a surprise here
//  would be a cost with no benefit.
//
//  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
//  ------------------------------------------------
//  Every constant below is, word for word, what src/pages/foodmenu.jsx used to
//  have hardcoded.
//
//  IMAGES
//  ------
//  menu_image_url is a bundled asset like every other photo in this CMS —
//  Vite hashes its filename at build time, so null means "use the bundled
//  one". resolveMenuSectionImage is where that decision is made. Combo Meal,
//  Pre-Order and Coffee have no photo of their own, so there is nothing to
//  resolve for them.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

import bundledMenuPhoto from '../assets/images/food3.png'

const ROW_ID = 'menu'
const CHANNEL = 'menu-sections-changes'

// Word for word what the front end used to have written into it.
export const MENU_SECTIONS_FALLBACK = {
    menuTitle: 'MENU',
    menuImageUrl: null,
    menuToggleLabel: 'Foods',
    comboTitle: 'COMBO MEAL',
    comboToggleLabel: 'Meals',
    preorderTitle: 'PRE-ORDER',
    preorderToggleLabel: 'Foods',
    coffeeEyebrow: 'Bukal Cafe by Camp Ba-Long Nature Farm',
    coffeeTitle: 'COFFEE',
    coffeeToggleLabel: 'Coffee Menu',
}

let state = {
    sections: MENU_SECTIONS_FALLBACK,
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

export function useMenuSections() {
    return useSyncExternalStore(subscribe, snapshot)
}

function rowToSections(row) {
    if (!row) return MENU_SECTIONS_FALLBACK
    return {
        menuTitle: row.menu_title || MENU_SECTIONS_FALLBACK.menuTitle,
        menuImageUrl: row.menu_image_url ?? null,
        menuToggleLabel: row.menu_toggle_label || MENU_SECTIONS_FALLBACK.menuToggleLabel,
        comboTitle: row.combo_title || MENU_SECTIONS_FALLBACK.comboTitle,
        comboToggleLabel: row.combo_toggle_label || MENU_SECTIONS_FALLBACK.comboToggleLabel,
        preorderTitle: row.preorder_title || MENU_SECTIONS_FALLBACK.preorderTitle,
        preorderToggleLabel: row.preorder_toggle_label || MENU_SECTIONS_FALLBACK.preorderToggleLabel,
        coffeeEyebrow: row.coffee_eyebrow ?? '',
        coffeeTitle: row.coffee_title || MENU_SECTIONS_FALLBACK.coffeeTitle,
        coffeeToggleLabel: row.coffee_toggle_label || MENU_SECTIONS_FALLBACK.coffeeToggleLabel,
    }
}

export async function loadMenuSections() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const { data, error } = await supabase
        .from('menu_sections')
        .select(
            'menu_title, menu_image_url, menu_toggle_label, combo_title, combo_toggle_label, '
            + 'preorder_title, preorder_toggle_label, coffee_eyebrow, coffee_title, coffee_toggle_label',
        )
        .eq('id', ROW_ID)
        .maybeSingle()

    if (error) {
        // Not worth a message on the page: the fallback copy is already on
        // screen. The dashboard does surface `error`, because there it is the
        // answer to "why did nothing I typed show up".
        console.error('Could not load the menu section titles:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    commit({ sections: rowToSections(data), loaded: true, error: null })
}

// What a guest is actually shown, resolved in one place so the menu page and
// the dashboard's preview never disagree about which photo is live.
export function resolveMenuSectionImage(imageUrl = null) {
    return imageUrl || bundledMenuPhoto
}


// ==================================================================== writing

// Staff write. The row is seeded by the migration, so this is always an
// update — and `.select()` is what turns an update that matched nothing into
// an answer rather than a silent success (the same reasoning as
// saveHomeHero).
export async function saveMenuSections(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const required = [
        ['menuTitle', 'the MENU section a heading'],
        ['menuToggleLabel', 'the MENU section\'s toggle button a label'],
        ['comboTitle', 'the Combo Meal section a heading'],
        ['comboToggleLabel', 'the Combo Meal section\'s toggle button a label'],
        ['preorderTitle', 'the Pre-Order section a heading'],
        ['preorderToggleLabel', 'the Pre-Order section\'s toggle button a label'],
        ['coffeeTitle', 'the Coffee section a heading'],
        ['coffeeToggleLabel', 'the Coffee section\'s toggle button a label'],
    ]
    for (const [field, what] of required) {
        if (!String(draft[field] ?? '').trim()) {
            return { ok: false, message: `Give ${what} — an empty one leaves it unlabelled.` }
        }
    }

    const { data, error } = await supabase
        .from('menu_sections')
        .update({
            menu_title: String(draft.menuTitle).trim(),
            menu_toggle_label: String(draft.menuToggleLabel).trim(),
            combo_title: String(draft.comboTitle).trim(),
            combo_toggle_label: String(draft.comboToggleLabel).trim(),
            preorder_title: String(draft.preorderTitle).trim(),
            preorder_toggle_label: String(draft.preorderToggleLabel).trim(),
            coffee_eyebrow: String(draft.coffeeEyebrow ?? '').trim() || null,
            coffee_title: String(draft.coffeeTitle).trim(),
            coffee_toggle_label: String(draft.coffeeToggleLabel).trim(),
        })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the menu section titles:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'menu sections migration has not been applied to this database yet.',
        }
    }

    await loadMenuSections()
    return { ok: true }
}

// The MENU section's banner photo. Split from the wording above so the two
// forms can be opened separately without either one clearing the other's
// columns — the same reasoning as Hero Banner's Photos / Wording split.
export async function saveMenuSectionsMedia(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase
        .from('menu_sections')
        .update({ menu_image_url: String(draft.menuImageUrl ?? '').trim() || null })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the MENU section photo:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'menu sections migration has not been applied to this database yet.',
        }
    }

    await loadMenuSections()
    return { ok: true }
}


// =================================================================== realtime

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_sections' }, loadMenuSections)
        .subscribe()
}

if (isSupabaseConfigured) {
    loadMenuSections()
    watchRealtime()
}
