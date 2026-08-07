// ============================================================================
//  Camp Ba-long — the Contact section's content
// ----------------------------------------------------------------------------
//  The heading, the column beside the enquiry form and the form's own wording
//  (public.contact_section), plus the phone/email/hours rows in that column
//  (public.contact_details) — read by the home page and written by the
//  dashboard's CMS → Contact. See the header of
//  supabase/migrations/*_contact_section_cms.sql.
//
//  Built the same way as the seven CMS stores before it, deliberately: eight
//  sections of one page doing the same job should not each be a surprise to
//  whoever reads them next.
//
//  WHAT THIS DOES NOT TOUCH
//  ------------------------
//  The form's LABELS and PLACEHOLDERS are here. The form itself is not: the
//  field names are what the email template reads, the input types are what open
//  a phone keypad on a phone, and `required` is what stops an empty enquiry. So
//  this store can change what the form says and never what it does.
//
//  Where the enquiry is delivered is not here either — the EmailJS ids are in
//  lib/emailClient.js and the `email_settings` row behind it.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

const ROW_ID = 'home'
const CHANNEL = 'contact-section-changes'

// Word for word what the front end used to have written into it.
export const CONTACT_SECTION_FALLBACK = {
    eyebrow: 'Contact us',
    title: 'Got question in your mind?',
    infoTitle: 'We’d love to hear from you',
    infoText:
        'Planning a stay, booking an event, or just curious about Camp Ba-long? Send us '
        + 'a message and our team will get back to you within 24 hours.',
    adminTitle: 'Admin Hours',
    adminText: 'Monday - Sunday 8AM - 5PM',
    noteLabel: 'Note:',
    noteText: 'Booking confirmations and other administrative requests are processed only during',
    noteHighlight: '8:00 AM – 5:00 PM.',
    noteAfter: 'Requests made outside these hours will be handled on the next business day.',
    formNameLabel: 'Name',
    formNamePlaceholder: 'Enter your name',
    formEmailLabel: 'Email',
    formEmailPlaceholder: 'Enter your email',
    formPhoneLabel: 'Phone Number',
    formPhonePlaceholder: 'Enter your phone number',
    formMessageLabel: 'Message',
    formMessagePlaceholder: 'Enter your message',
    formSubmitLabel: 'Send Message',
    formSendingLabel: 'Sending…',
}

export const CONTACT_DETAILS_FALLBACK = [
    { id: 'phone', label: 'Phone', info: '+63 9622331708', iconKey: 'phone', iconUrl: null, sortOrder: 1, isActive: true },
    { id: 'email', label: 'Email', info: 'campbalongnaturefarm@gmail.com', iconKey: 'email', iconUrl: null, sortOrder: 2, isActive: true },
    { id: 'hours', label: 'Hours', info: 'Open daily, 8:00 AM – 8:00 PM', iconKey: 'time', iconUrl: null, sortOrder: 3, isActive: true },
]

// The list is kept twice, all rows and visible rows, both built at commit time
// so the snapshot the hook returns keeps a stable identity between renders.
let state = {
    section: CONTACT_SECTION_FALLBACK,
    details: CONTACT_DETAILS_FALLBACK,
    activeDetails: CONTACT_DETAILS_FALLBACK,
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

export function useContactSection() {
    return useSyncExternalStore(subscribe, snapshot)
}

const SECTION_COLUMNS =
    'eyebrow, title, info_title, info_text, admin_title, admin_text, '
    + 'note_label, note_text, note_highlight, note_after, '
    + 'form_name_label, form_name_placeholder, form_email_label, form_email_placeholder, '
    + 'form_phone_label, form_phone_placeholder, form_message_label, '
    + 'form_message_placeholder, form_submit_label, form_sending_label'

function rowToSection(row) {
    if (!row) return CONTACT_SECTION_FALLBACK
    return {
        eyebrow: row.eyebrow ?? '',
        title: row.title ?? '',
        infoTitle: row.info_title ?? '',
        infoText: row.info_text ?? '',
        adminTitle: row.admin_title ?? '',
        adminText: row.admin_text ?? '',
        noteLabel: row.note_label ?? '',
        noteText: row.note_text ?? '',
        noteHighlight: row.note_highlight ?? '',
        noteAfter: row.note_after ?? '',
        // Every one of these falls back to the shipped wording rather than to
        // an empty string. A form whose fields have lost their labels is not a
        // section staff have emptied — it is a form nobody can fill in, and it
        // is the one part of this page that has a job to do.
        formNameLabel: row.form_name_label || CONTACT_SECTION_FALLBACK.formNameLabel,
        formNamePlaceholder: row.form_name_placeholder ?? '',
        formEmailLabel: row.form_email_label || CONTACT_SECTION_FALLBACK.formEmailLabel,
        formEmailPlaceholder: row.form_email_placeholder ?? '',
        formPhoneLabel: row.form_phone_label || CONTACT_SECTION_FALLBACK.formPhoneLabel,
        formPhonePlaceholder: row.form_phone_placeholder ?? '',
        formMessageLabel: row.form_message_label || CONTACT_SECTION_FALLBACK.formMessageLabel,
        formMessagePlaceholder: row.form_message_placeholder ?? '',
        formSubmitLabel: row.form_submit_label || CONTACT_SECTION_FALLBACK.formSubmitLabel,
        // Falls back to the submit label, not to "Sending…", so a button that
        // has been renamed "Send enquiry" does not flip to wording from a
        // different vocabulary halfway through a send.
        formSendingLabel:
            row.form_sending_label
            || row.form_submit_label
            || CONTACT_SECTION_FALLBACK.formSendingLabel,
    }
}

function rowToDetail(row) {
    return {
        id: row.id,
        label: row.label,
        info: row.info ?? '',
        iconKey: row.icon_key ?? '',
        iconUrl: row.icon_url ?? null,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    }
}

export async function loadContactSection() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const [sectionResult, detailsResult] = await Promise.all([
        supabase
            .from('contact_section')
            .select(SECTION_COLUMNS)
            .eq('id', ROW_ID)
            .maybeSingle(),
        supabase
            .from('contact_details')
            .select('id, label, info, icon_key, icon_url, sort_order, is_active')
            .order('sort_order', { ascending: true }),
    ])

    const error = sectionResult.error ?? detailsResult.error
    if (error) {
        // Not worth a message on the page: the fallback copy is already on
        // screen. The dashboard does surface `error`, because there it is the
        // answer to "why did nothing I typed show up".
        console.error('Could not load the contact section:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    const details = (detailsResult.data ?? []).map(rowToDetail)

    commit({
        section: rowToSection(sectionResult.data),
        details,
        activeDetails: details.filter((row) => row.isActive),
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

// One update for whichever half of the row the form covers. The wording and the
// form's labels are edited separately — see the dashboard panel — so this takes
// the columns it is given rather than rewriting all twenty every time.
async function updateSection(patch, what) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    // The row is seeded by the migration, so this is always an update — and
    // `.select()` is what turns an update that matched nothing into an answer
    // rather than a silent success.
    const { data, error } = await supabase
        .from('contact_section')
        .update(patch)
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error(`Could not save the contact ${what}:`, error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'contact section migration has not been applied to this database yet.',
        }
    }

    await loadContactSection()
    return { ok: true }
}

export async function saveContactSection(draft) {
    const title = String(draft.title ?? '').trim()
    if (!title) {
        return { ok: false, message: 'Write a heading — it is what the section is called on the page.' }
    }

    return updateSection(
        {
            eyebrow: trimmed(draft.eyebrow),
            title,
            info_title: trimmed(draft.infoTitle),
            info_text: trimmed(draft.infoText),
            admin_title: trimmed(draft.adminTitle),
            admin_text: trimmed(draft.adminText),
            note_label: trimmed(draft.noteLabel),
            note_text: trimmed(draft.noteText),
            note_highlight: trimmed(draft.noteHighlight),
            note_after: trimmed(draft.noteAfter),
        },
        'wording',
    )
}

export async function saveContactForm(draft) {
    // Refused rather than saved: a field with no label is a box a guest cannot
    // identify, and this form is the one part of the page with a job to do.
    const labels = [
        ['formNameLabel', 'name'],
        ['formEmailLabel', 'email'],
        ['formPhoneLabel', 'phone'],
        ['formMessageLabel', 'message'],
    ]
    for (const [field, which] of labels) {
        if (!String(draft[field] ?? '').trim()) {
            return { ok: false, message: `Give the ${which} field a label — an unlabelled box is unfillable.` }
        }
    }

    const submitLabel = String(draft.formSubmitLabel ?? '').trim()
    if (!submitLabel) {
        return { ok: false, message: 'Give the button a label — clearing it leaves nothing to press.' }
    }

    return updateSection(
        {
            form_name_label: String(draft.formNameLabel).trim(),
            form_name_placeholder: trimmed(draft.formNamePlaceholder),
            form_email_label: String(draft.formEmailLabel).trim(),
            form_email_placeholder: trimmed(draft.formEmailPlaceholder),
            form_phone_label: String(draft.formPhoneLabel).trim(),
            form_phone_placeholder: trimmed(draft.formPhonePlaceholder),
            form_message_label: String(draft.formMessageLabel).trim(),
            form_message_placeholder: trimmed(draft.formMessagePlaceholder),
            form_submit_label: submitLabel,
            form_sending_label: trimmed(draft.formSendingLabel),
        },
        'form wording',
    )
}

// Create or edit one row of the contact column.
export async function saveContactDetail(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const label = String(draft.label ?? '').trim()
    if (!label) return { ok: false, message: 'Give the row a label — "Phone", "Email".' }

    const info = String(draft.info ?? '').trim()
    if (!info) return { ok: false, message: 'Write what goes under the label — the number or address itself.' }

    const isNew = !draft.id
    const taken = new Set(state.details.map((row) => row.id))
    const id = draft.id || uniqueId(slugify(label) || 'detail', taken)

    const row = {
        label,
        info,
        icon_key: trimmed(draft.iconKey),
        icon_url: trimmed(draft.iconUrl),
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from('contact_details').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('contact_details')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the contact detail:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that row no longer exists, or this account is not on '
                + 'the staff roster.',
        }
    }

    await loadContactSection()
    return { ok: true, id }
}

export async function deleteContactDetail(id) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase
        .from('contact_details')
        .delete()
        .eq('id', id)
        .select('id')

    if (error) {
        console.error('Could not delete the contact detail:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was deleted — that row is already gone, or this account is not '
                + 'on the staff roster.',
        }
    }

    await loadContactSection()
    return { ok: true }
}

// Move a row one place along the column. The list on screen IS the order
// stored, so there is no sort number for staff to keep in step.
export async function moveContactDetail(id, direction) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const ordered = [...state.details].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordered.findIndex((row) => row.id === id)
    const target = index + (direction === 'up' ? -1 : 1)
    if (index === -1 || target < 0 || target >= ordered.length) return { ok: true }

    const [moved] = ordered.splice(index, 1)
    ordered.splice(target, 0, moved)

    // Renumbered from 1 rather than swapping two values: rows seeded or added
    // at different times can share a sort_order, and swapping equal numbers
    // moves nothing.
    const { error } = await supabase.from('contact_details').upsert(
        ordered.map((row, position) => ({
            id: row.id,
            label: row.label,
            info: row.info,
            icon_key: row.iconKey || null,
            icon_url: row.iconUrl || null,
            is_active: row.isActive,
            sort_order: position + 1,
        })),
    )

    if (error) {
        console.error('Could not reorder the contact details:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    await loadContactSection()
    return { ok: true }
}


// =================================================================== realtime

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_section' }, loadContactSection)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_details' }, loadContactSection)
        .subscribe()
}

if (isSupabaseConfigured) {
    loadContactSection()
    watchRealtime()
}
