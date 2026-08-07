// ============================================================================
//  Camp Ba-long — the FAQ section's content
// ----------------------------------------------------------------------------
//  The intro beside the accordion (public.faq_section) and the questions
//  themselves (public.faqs) — read by the home page and written by the
//  dashboard's CMS → FAQ. See the header of
//  supabase/migrations/*_faq_section_cms.sql.
//
//  Built the same way as the six CMS stores before it, deliberately: seven
//  sections of one page doing the same job should not each be a surprise to
//  whoever reads them next.
//
//  WHY THIS ONE MATTERS MOST
//  -------------------------
//  Half these answers are prices and policies — the entrance fee, the cottage
//  fee, the stove rental, the group limit, the check-in windows. They go out of
//  date, and until now correcting one meant editing a component and
//  redeploying. Nothing keeps them in step with the rate table automatically,
//  and nothing sensibly could: one is a sentence somebody wrote, the other is a
//  column. The dashboard says so on screen instead.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

const ROW_ID = 'home'
const CHANNEL = 'faq-section-changes'

// Word for word what the front end used to have written into it.
export const FAQ_SECTION_FALLBACK = {
    eyebrow: 'FAQ',
    title: 'Frequently Asked Questions',
    description:
        'Planning your getaway? Here are the answers to the questions our guests ask '
        + "most, from booking and check-in to amenities and dining. Can't find what "
        + "you're looking for? We're happy to help.",
    contactLabel: 'Any questions? Reach out',
    contactHref: '#contact',
}

export const FAQS_FALLBACK = [
    { id: 'location', question: 'Location?', answer: 'We are located at Brgy. Laguan Liliw, Laguna', sortOrder: 1, isActive: true },
    { id: 'tent-pitching', question: 'Is tent pitching allowed?', answer: 'Yes, tent pitching is allowed.', sortOrder: 2, isActive: true },
    { id: 'walk-ins', question: 'Are walk-ins allowed?', answer: "We allow walk-ins if we're not fully booked but it is better if you make reservations.", sortOrder: 3, isActive: true },
    { id: 'rooms', question: 'Do you have rooms?', answer: "We are a camp site so we don't have rooms but we do have teepees, A-houses and tents, where you can stay and sleep.", sortOrder: 4, isActive: true },
    { id: 'entrance-fee', question: 'How much is the entrance fee?', answer: '150/ pax for day time, (10am-5pm) and 350/pax for 22 hours/ day and night (10am-8am) night and day (7pm-5am).', sortOrder: 5, isActive: true },
    { id: 'entrance-fee-children', question: 'How much is the entrance fee for children?', answer: 'No entrance fee for children 7 years old and below.', sortOrder: 6, isActive: true },
    { id: 'cottage-fee', question: 'How much is the cottage fee?', answer: 'Cottage fee is 2000, for day time (good for 8-10pax).', sortOrder: 7, isActive: true },
    { id: 'parking-distance', question: 'Is the parking lot far from the site?', answer: 'No, the distance between the parking lot to the gate was more or less 100 meters.', sortOrder: 8, isActive: true },
    { id: 'check-in-time', question: 'Can we check in and check out at our preferred time?', answer: 'No, checking in and out depends on your booked time, day time (10am-5pm) and night and day (7pm-5am).', sortOrder: 9, isActive: true },
    { id: 'parking', question: 'Do you have parking?', answer: 'Yes, we have parking space.', sortOrder: 10, isActive: true },
    { id: 'private-resort', question: 'Is Camp Ba-long Nature Resort a private resort?', answer: 'Our Place is a semi exclusive, we make sure that you enjoy yourselves without crowding. You may also rent the whole place for your group.', sortOrder: 11, isActive: true },
    { id: 'max-pax', question: 'Is there a maximum number of persons allowed when you book the place exclusively for our group?', answer: 'We only allow a maximum of 60 pax for day time and 50 for Day and Night', sortOrder: 12, isActive: true },
    { id: 'cooking', question: 'Is cooking allowed?', answer: 'Yes, you may also rent a gas stove for 400 pesos and utensils for 200 pesos.', sortOrder: 13, isActive: true },
    { id: 'food-orders', question: 'Can we order foods?', answer: 'Yes, you can order foods. Please message us for the menu and availability.', sortOrder: 14, isActive: true },
]

// The list is kept twice, all rows and visible rows, both built at commit time
// so the snapshot the hook returns keeps a stable identity between renders.
let state = {
    section: FAQ_SECTION_FALLBACK,
    faqs: FAQS_FALLBACK,
    activeFaqs: FAQS_FALLBACK,
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

export function useFaqSection() {
    return useSyncExternalStore(subscribe, snapshot)
}

function rowToSection(row) {
    if (!row) return FAQ_SECTION_FALLBACK
    return {
        eyebrow: row.eyebrow ?? '',
        title: row.title ?? '',
        description: row.description ?? '',
        contactLabel: row.contact_label ?? '',
        contactHref: row.contact_href ?? '',
    }
}

function rowToFaq(row) {
    return {
        id: row.id,
        question: row.question,
        answer: row.answer ?? '',
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    }
}

export async function loadFaqSection() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const [sectionResult, listResult] = await Promise.all([
        supabase
            .from('faq_section')
            .select('eyebrow, title, description, contact_label, contact_href')
            .eq('id', ROW_ID)
            .maybeSingle(),
        supabase
            .from('faqs')
            .select('id, question, answer, sort_order, is_active')
            .order('sort_order', { ascending: true }),
    ])

    const error = sectionResult.error ?? listResult.error
    if (error) {
        // Not worth a message on the page: the fallback questions are already
        // on screen. The dashboard does surface `error`, because there it is
        // the answer to "why did nothing I typed show up".
        console.error('Could not load the FAQ:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    const faqs = (listResult.data ?? []).map(rowToFaq)

    commit({
        section: rowToSection(sectionResult.data),
        faqs,
        activeFaqs: faqs.filter((faq) => faq.isActive),
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

// A question is a sentence rather than a title, so slugifying a whole one gives
// an eighty-character primary key that nobody can read in a table view. Cut at
// a word boundary: the id only has to be unique and recognisable.
function faqId(question, taken) {
    const slug = slugify(question)
    const short = slug.length <= 48 ? slug : slug.slice(0, 48).replace(/-[^-]*$/, '')
    return uniqueId(short || 'question', taken)
}

export async function saveFaqSection(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const title = String(draft.title ?? '').trim()
    if (!title) {
        return { ok: false, message: 'Write a heading — it is what the section is called on the page.' }
    }

    // The row is seeded by the migration, so this is always an update — and
    // `.select()` is what turns an update that matched nothing into an answer
    // rather than a silent success.
    const { data, error } = await supabase
        .from('faq_section')
        .update({
            eyebrow: String(draft.eyebrow ?? '').trim() || null,
            title,
            description: String(draft.description ?? '').trim() || null,
            contact_label: String(draft.contactLabel ?? '').trim() || null,
            contact_href: String(draft.contactHref ?? '').trim() || null,
        })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the FAQ intro:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'FAQ migration has not been applied to this database yet.',
        }
    }

    await loadFaqSection()
    return { ok: true }
}

// Create or edit one question.
export async function saveFaq(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const question = String(draft.question ?? '').trim()
    if (!question) return { ok: false, message: 'Write the question — it is the line guests tap.' }

    // Refused rather than saved: a question that opens onto nothing is worse
    // than one that is not listed, because a guest has already tapped it before
    // finding out.
    const answer = String(draft.answer ?? '').trim()
    if (!answer) return { ok: false, message: 'Write the answer — an empty one opens onto a blank panel.' }

    const isNew = !draft.id
    const taken = new Set(state.faqs.map((faq) => faq.id))
    const id = draft.id || faqId(question, taken)

    const row = {
        question,
        answer,
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from('faqs').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('faqs')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the question:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that question no longer exists, or this account is '
                + 'not on the staff roster.',
        }
    }

    await loadFaqSection()
    return { ok: true, id }
}

export async function deleteFaq(id) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase.from('faqs').delete().eq('id', id).select('id')

    if (error) {
        console.error('Could not delete the question:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was deleted — that question is already gone, or this account is '
                + 'not on the staff roster.',
        }
    }

    await loadFaqSection()
    return { ok: true }
}

// Move a question one place along the list. The list on screen IS the order
// stored, so there is no sort number for staff to keep in step.
export async function moveFaq(id, direction) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const ordered = [...state.faqs].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordered.findIndex((faq) => faq.id === id)
    const target = index + (direction === 'up' ? -1 : 1)
    if (index === -1 || target < 0 || target >= ordered.length) return { ok: true }

    const [moved] = ordered.splice(index, 1)
    ordered.splice(target, 0, moved)

    // Renumbered from 1 rather than swapping two values: rows seeded or added
    // at different times can share a sort_order, and swapping equal numbers
    // moves nothing.
    const { error } = await supabase.from('faqs').upsert(
        ordered.map((faq, position) => ({
            id: faq.id,
            question: faq.question,
            answer: faq.answer,
            is_active: faq.isActive,
            sort_order: position + 1,
        })),
    )

    if (error) {
        console.error('Could not reorder the FAQ:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    await loadFaqSection()
    return { ok: true }
}


// =================================================================== realtime

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'faq_section' }, loadFaqSection)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'faqs' }, loadFaqSection)
        .subscribe()
}

if (isSupabaseConfigured) {
    loadFaqSection()
    watchRealtime()
}
