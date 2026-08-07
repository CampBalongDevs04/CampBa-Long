// ============================================================================
//  Camp Ba-long — the site footer's content
// ----------------------------------------------------------------------------
//  The blurb, the headings, the phone and email and the two legal panels
//  (public.footer_section), the menu links in the middle column
//  (public.footer_links) and the social links under the phone
//  (public.footer_socials) — read by every page and written by the dashboard's
//  CMS → Footer. See the header of supabase/migrations/*_footer_cms.sql.
//
//  Built the same way as the eight CMS stores before it, deliberately.
//
//  THIS ONE IS ON EVERY PAGE, NOT JUST THE HOME PAGE
//  -------------------------------------------------
//  The other eight stores back one block of one page. The footer is at the
//  bottom of the booking flow and the menu too, so a bad save here is visible
//  everywhere at once — which is why the resort name and the legal labels fall
//  back to the shipped wording rather than to an empty string, the same way the
//  contact form's labels do.
//
//  THE YEAR IS NOT HERE
//  --------------------
//  The copyright line's year is read off the clock in the component. A year in
//  a field is wrong every January and nobody is watching for it.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

const ROW_ID = 'home'
const CHANNEL = 'footer-changes'

// Word for word what the front end used to have written into it.
export const FOOTER_SECTION_FALLBACK = {
    resortName: 'Camp Ba-long',
    aboutText:
        'Where you can connect with your inner peace! Immerse yourself in the healing '
        + 'waters, surrounded by lush tropical forest. The perfect place to unwind, '
        + 'rejuvenate your body, and calm your mind.',
    updatesTitle: 'be Updated',
    updatesText:
        'Camp Ba-Long Nature Farm: A Refreshing Nature Escape Discover a hidden paradise '
        + 'where crystal-clear spring waters, lush tropical landscapes, and peaceful '
        + 'surroundings come together to create the perfect getaway. Camp Ba-Long Nature '
        + 'Farm invites you to relax, refresh, and reconnect with nature in an '
        + 'unforgettable outdoor experience.',
    linksTitle: 'Discover Camp Ba-long',
    touchTitle: 'Get in Touch',
    phone: '09622331708',
    email: 'campbalongnaturefarm@gmail.com',
    copyrightSuffix: 'All rights reserved.',
    termsLabel: 'Terms & Conditions',
    termsText:
        'By booking or staying at Camp Ba-long, you agree to arrive within your reserved '
        + 'schedule, respect the property and fellow guests, and settle any damages caused '
        + 'during your stay. Reservations may be rescheduled or cancelled under the terms '
        + 'provided at the time of booking. Camp Ba-long reserves the right to refuse '
        + 'service to anyone who violates these terms.',
    policyLabel: 'Copyright Policy',
    policyText:
        'All content on this site, including photos, text, and the Camp Ba-long name and '
        + 'logo, is owned by Camp Ba-long Nature Farm & Resort and may not be copied, '
        + 'reproduced, or distributed without written permission.',
}

export const FOOTER_LINKS_FALLBACK = [
    { id: 'main-wing', label: 'Main Wing', href: '/', sortOrder: 1, isActive: true },
    { id: 'camp-balong', label: 'Camp-Balong', href: '/', sortOrder: 2, isActive: true },
    { id: 'accommodations', label: 'Accommodations', href: '/#accommodations', sortOrder: 3, isActive: true },
    { id: 'contact-us', label: 'Contact US', href: '/#contact', sortOrder: 4, isActive: true },
]

export const FOOTER_SOCIALS_FALLBACK = [
    { id: 'facebook', label: 'Facebook', href: 'https://facebook.com/campbalong', sortOrder: 1, isActive: true },
    { id: 'instagram', label: 'Instagram', href: 'https://instagram.com/campbalong', sortOrder: 2, isActive: true },
]

// Each list is kept twice, all rows and visible rows, both built at commit time
// so the snapshot the hook returns keeps a stable identity between renders.
let state = {
    section: FOOTER_SECTION_FALLBACK,
    links: FOOTER_LINKS_FALLBACK,
    activeLinks: FOOTER_LINKS_FALLBACK,
    socials: FOOTER_SOCIALS_FALLBACK,
    activeSocials: FOOTER_SOCIALS_FALLBACK,
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

export function useFooter() {
    return useSyncExternalStore(subscribe, snapshot)
}

const SECTION_COLUMNS =
    'resort_name, about_text, updates_title, updates_text, links_title, touch_title, '
    + 'phone, email, copyright_suffix, terms_label, terms_text, policy_label, policy_text'

function rowToSection(row) {
    if (!row) return FOOTER_SECTION_FALLBACK
    return {
        // The name carries the copyright line as well as the first column's
        // heading, so it falls back rather than going blank.
        resortName: row.resort_name || FOOTER_SECTION_FALLBACK.resortName,
        aboutText: row.about_text ?? '',
        updatesTitle: row.updates_title ?? '',
        updatesText: row.updates_text ?? '',
        linksTitle: row.links_title ?? '',
        touchTitle: row.touch_title ?? '',
        phone: row.phone ?? '',
        email: row.email ?? '',
        copyrightSuffix: row.copyright_suffix ?? '',
        // A legal panel with no button is a panel nobody can reach, so the two
        // labels fall back to the shipped wording. Their TEXT does not: an
        // empty terms paragraph is a decision somebody made, and inventing one
        // on their behalf would be worse than showing nothing.
        termsLabel: row.terms_label || FOOTER_SECTION_FALLBACK.termsLabel,
        termsText: row.terms_text ?? '',
        policyLabel: row.policy_label || FOOTER_SECTION_FALLBACK.policyLabel,
        policyText: row.policy_text ?? '',
    }
}

function rowToLink(row) {
    return {
        id: row.id,
        label: row.label,
        href: row.href ?? '',
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    }
}

export async function loadFooter() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const [sectionResult, linksResult, socialsResult] = await Promise.all([
        supabase.from('footer_section').select(SECTION_COLUMNS).eq('id', ROW_ID).maybeSingle(),
        supabase
            .from('footer_links')
            .select('id, label, href, sort_order, is_active')
            .order('sort_order', { ascending: true }),
        supabase
            .from('footer_socials')
            .select('id, label, href, sort_order, is_active')
            .order('sort_order', { ascending: true }),
    ])

    const error = sectionResult.error ?? linksResult.error ?? socialsResult.error
    if (error) {
        // Not worth a message on the page: the fallback copy is already on
        // screen, on every page. The dashboard does surface `error`, because
        // there it is the answer to "why did nothing I typed show up".
        console.error('Could not load the footer:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    const links = (linksResult.data ?? []).map(rowToLink)
    const socials = (socialsResult.data ?? []).map(rowToLink)

    commit({
        section: rowToSection(sectionResult.data),
        links,
        activeLinks: links.filter((row) => row.isActive),
        socials,
        activeSocials: socials.filter((row) => row.isActive),
        loaded: true,
        error: null,
    })
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

function trimmed(value) {
    return String(value ?? '').trim() || null
}

// One update for whichever half of the row the form covers. The copy and the
// legal panels are edited separately — see the dashboard panel — so this takes
// the columns it is given rather than rewriting all thirteen every time.
async function updateSection(patch, what) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    // The row is seeded by the migration, so this is always an update — and
    // `.select()` is what turns an update that matched nothing into an answer
    // rather than a silent success.
    const { data, error } = await supabase
        .from('footer_section')
        .update(patch)
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error(`Could not save the footer ${what}:`, error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'footer migration has not been applied to this database yet.',
        }
    }

    await loadFooter()
    return { ok: true }
}

export async function saveFooterSection(draft) {
    const resortName = String(draft.resortName ?? '').trim()
    if (!resortName) {
        return { ok: false, message: 'Write the resort’s name — it heads the footer and signs the copyright line.' }
    }

    return updateSection(
        {
            resort_name: resortName,
            about_text: trimmed(draft.aboutText),
            updates_title: trimmed(draft.updatesTitle),
            updates_text: trimmed(draft.updatesText),
            links_title: trimmed(draft.linksTitle),
            touch_title: trimmed(draft.touchTitle),
            phone: trimmed(draft.phone),
            email: trimmed(draft.email),
            copyright_suffix: trimmed(draft.copyrightSuffix),
        },
        'wording',
    )
}

export async function saveFooterLegal(draft) {
    const termsLabel = String(draft.termsLabel ?? '').trim()
    const policyLabel = String(draft.policyLabel ?? '').trim()

    // Refused rather than saved: the label is the only way into the panel, so
    // clearing it hides the terms rather than removing them.
    if (!termsLabel || !policyLabel) {
        return {
            ok: false,
            message: 'Both buttons need a label — it is the only way a guest can open the panel behind it.',
        }
    }

    return updateSection(
        {
            terms_label: termsLabel,
            terms_text: trimmed(draft.termsText),
            policy_label: policyLabel,
            policy_text: trimmed(draft.policyText),
        },
        'legal text',
    )
}

// Create or edit one link in either list. `table` is the caller's choice
// because the two lists are the same shape and differ only in where they are
// printed — see the migration header.
async function saveLink(table, rows, draft, noun) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const label = String(draft.label ?? '').trim()
    if (!label) return { ok: false, message: `Give the ${noun} a label — it is the words a guest reads.` }

    // Refused rather than saved as empty: `href` is NOT NULL, and a link that
    // goes nowhere looks identical to one that works until somebody taps it.
    const href = String(draft.href ?? '').trim()
    if (!href) return { ok: false, message: 'Write where it goes.' }

    const isNew = !draft.id
    const taken = new Set(rows.map((row) => row.id))
    const id = draft.id || uniqueId(slugify(label) || noun, taken)

    const row = {
        label,
        href,
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from(table).insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from(table)
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error(`Could not save the ${noun}:`, error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: `Nothing was saved — that ${noun} no longer exists, or this account is not `
                + 'on the staff roster.',
        }
    }

    await loadFooter()
    return { ok: true, id }
}

export function saveFooterLink(draft) {
    return saveLink('footer_links', state.links, draft, 'link')
}

export function saveFooterSocial(draft) {
    return saveLink('footer_socials', state.socials, draft, 'social link')
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

    await loadFooter()
    return { ok: true }
}

export function deleteFooterLink(id) {
    return deleteRow('footer_links', id, 'link')
}

export function deleteFooterSocial(id) {
    return deleteRow('footer_socials', id, 'social link')
}

// Move a row one place along its list. The list on screen IS the order stored,
// so there is no sort number for staff to keep in step.
async function moveRow(table, rows, id, direction) {
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
    const { error } = await supabase.from(table).upsert(
        ordered.map((row, position) => ({
            id: row.id,
            label: row.label,
            href: row.href,
            is_active: row.isActive,
            sort_order: position + 1,
        })),
    )

    if (error) {
        console.error(`Could not reorder ${table}:`, error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    await loadFooter()
    return { ok: true }
}

export function moveFooterLink(id, direction) {
    return moveRow('footer_links', state.links, id, direction)
}

export function moveFooterSocial(id, direction) {
    return moveRow('footer_socials', state.socials, id, direction)
}


// =================================================================== realtime

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'footer_section' }, loadFooter)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'footer_links' }, loadFooter)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'footer_socials' }, loadFooter)
        .subscribe()
}

if (isSupabaseConfigured) {
    loadFooter()
    watchRealtime()
}
