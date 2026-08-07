// ============================================================================
//  Camp Ba-long — the Testimonials section's content
// ----------------------------------------------------------------------------
//  The heading (public.testimonial_section) and the guest reviews that scroll
//  past under it (public.testimonials) — read by the home page and written by
//  the dashboard's CMS → Testimonials. See the header of
//  supabase/migrations/*_testimonials_cms.sql.
//
//  Built the same way as data/homeHero.js, data/welcomeSection.js,
//  data/offersSection.js and data/accommodationSection.js, deliberately: five
//  sections of one page doing the same job should not each be a surprise to
//  whoever reads them next.
//
//  NOTHING HERE IS UPLOADED
//  ------------------------
//  A review is a name, a rating and some words. The avatar is the guest's
//  initials drawn by the card, not a photo, so this is the one CMS section with
//  no bucket behind it and no bundled assets to fall back to.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

const ROW_ID = 'home'
const CHANNEL = 'testimonials-changes'

// Word for word what the front end used to have written into it.
export const TESTIMONIAL_SECTION_FALLBACK = {
    title: 'Testimonials',
    subtitle: '• What our guests say about Camp Ba-long •',
}

// The seven reviews the site shipped with, in the order it had them. `stay` is
// absent for the same reason the column is null: the card has always rendered
// that line empty.
export const TESTIMONIALS_FALLBACK = [
    {
        id: 'jimmy-ong',
        name: 'Jimmy Ong',
        rating: 4,
        comment: 'Escape the heat from the city and back to mother nature.🌿✨ Tucked away in the cool highlands of Liliw, it’s the perfect spot to reconnect with nature and recharge. Great and affordable for a quick getaway trip.',
        stay: '',
        sortOrder: 1,
        isActive: true,
    },
    {
        id: 'hercel-iguid',
        name: 'Hercel Iguid',
        rating: 5,
        comment: "Very accomodating, friendly, helpful staff and owner. Ambience is 100%, you can relax and i appreciate the no smoking policy's And it's pet friendly, they are allowed to swim in the ilog.",
        stay: '',
        sortOrder: 2,
        isActive: true,
    },
    {
        id: 'dona-joy-stefanie-terbio-sacay',
        name: 'Dona Joy Stefanie Terbio-Sacay',
        rating: 5,
        comment: 'Are we going back? Definitely YES!✅ We like the rules they implement to prevent damages, control too much crowd, maintaining the cleanliness and peace of the resort. KUDOS TO THE OWNER AND STAFF 🫶',
        stay: '',
        sortOrder: 3,
        isActive: true,
    },
    {
        id: 'rigor-badiola',
        name: 'Rigor Badiola',
        rating: 5,
        comment: "The place is peaceful. Water doesn't smell chlorine. I like this place. I think it would be great if we stayed overnight.",
        stay: '',
        sortOrder: 4,
        isActive: true,
    },
    {
        id: 'mhelber-paredes',
        name: 'Mhelber Paredes',
        rating: 5,
        comment: 'Very accommodating ang personnel. Super dali lapitan at mura ng foods. Highly recommended for those who wants to destress themselves from the noises of the city. Truly a gem',
        stay: '',
        sortOrder: 5,
        isActive: true,
    },
    {
        id: 'evangeline-jocsing',
        name: 'Evangeline Jocsing',
        rating: 5,
        comment: 'I really enjoyed our bonding moments with friends in Camp Ba-long Nature farm.',
        stay: '',
        sortOrder: 6,
        isActive: true,
    },
    {
        id: 'jason-dela-luna',
        name: 'Jason Dela Luna',
        rating: 5,
        comment: 'This place is a sanctuary. Smoking, vaping and playing loud music is not allowed. Afternoon and the temperature is not even 20 degrees, at night the temperature is somewhere 14 to 17 degrees celcious and morning is much colder 10 to 14 degrees perhaps. Water is freezing cold.',
        stay: '',
        sortOrder: 7,
        isActive: true,
    },
]

// The list is kept twice, all rows and visible rows, both built at commit time
// so the snapshot the hook returns keeps a stable identity between renders.
let state = {
    section: TESTIMONIAL_SECTION_FALLBACK,
    testimonials: TESTIMONIALS_FALLBACK,
    activeTestimonials: TESTIMONIALS_FALLBACK,
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

export function useTestimonials() {
    return useSyncExternalStore(subscribe, snapshot)
}

function rowToSection(row) {
    if (!row) return TESTIMONIAL_SECTION_FALLBACK
    return {
        title: row.title ?? '',
        subtitle: row.subtitle ?? '',
    }
}

function rowToTestimonial(row) {
    return {
        id: row.id,
        name: row.name,
        // numeric comes back as a string from PostgREST, and the star fill is
        // arithmetic — "4.5" - 4 is not something to hand a <linearGradient>.
        rating: Number(row.rating ?? 0),
        comment: row.comment ?? '',
        stay: row.stay ?? '',
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    }
}

export async function loadTestimonials() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const [sectionResult, listResult] = await Promise.all([
        supabase
            .from('testimonial_section')
            .select('title, subtitle')
            .eq('id', ROW_ID)
            .maybeSingle(),
        supabase
            .from('testimonials')
            .select('id, name, rating, comment, stay, sort_order, is_active')
            .order('sort_order', { ascending: true }),
    ])

    const error = sectionResult.error ?? listResult.error
    if (error) {
        // Not worth a message on the page: the fallback reviews are already on
        // screen. The dashboard does surface `error`, because there it is the
        // answer to "why did nothing I typed show up".
        console.error('Could not load the testimonials:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    const testimonials = (listResult.data ?? []).map(rowToTestimonial)

    commit({
        section: rowToSection(sectionResult.data),
        testimonials,
        activeTestimonials: testimonials.filter((item) => item.isActive),
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

export async function saveTestimonialSection(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const title = String(draft.title ?? '').trim()
    if (!title) {
        return { ok: false, message: 'Write a heading — it is what the section is called on the page.' }
    }

    // The row is seeded by the migration, so this is always an update — and
    // `.select()` is what turns an update that matched nothing into an answer
    // rather than a silent success.
    const { data, error } = await supabase
        .from('testimonial_section')
        .update({
            title,
            subtitle: String(draft.subtitle ?? '').trim() || null,
        })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the testimonials heading:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'testimonials migration has not been applied to this database yet.',
        }
    }

    await loadTestimonials()
    return { ok: true }
}

// Create or edit one review.
export async function saveTestimonial(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const name = String(draft.name ?? '').trim()
    if (!name) return { ok: false, message: 'Write the guest’s name — the card signs the review with it.' }

    const comment = String(draft.comment ?? '').trim()
    if (!comment) return { ok: false, message: 'Write the review — the card is mostly this.' }

    // Refused rather than clamped: a rating outside 0-5 is a typo, and quietly
    // turning 55 into 5 would leave a wrong number on the front page looking
    // like it had been chosen.
    const rating = Number(draft.rating)
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
        return { ok: false, message: 'Give a rating between 0 and 5. Halves like 4.5 are fine.' }
    }

    const isNew = !draft.id
    const taken = new Set(state.testimonials.map((item) => item.id))
    const id = draft.id || uniqueId(slugify(name) || 'guest', taken)

    const row = {
        name,
        rating,
        comment,
        stay: String(draft.stay ?? '').trim() || null,
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from('testimonials').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('testimonials')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the review:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that review no longer exists, or this account is not '
                + 'on the staff roster.',
        }
    }

    await loadTestimonials()
    return { ok: true, id }
}

export async function deleteTestimonial(id) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase
        .from('testimonials')
        .delete()
        .eq('id', id)
        .select('id')

    if (error) {
        console.error('Could not delete the review:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was deleted — that review is already gone, or this account is not '
                + 'on the staff roster.',
        }
    }

    await loadTestimonials()
    return { ok: true }
}

// Move a review one place along the marquee. The list on screen IS the order
// stored, so there is no sort number for staff to keep in step.
export async function moveTestimonial(id, direction) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const ordered = [...state.testimonials].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordered.findIndex((item) => item.id === id)
    const target = index + (direction === 'up' ? -1 : 1)
    if (index === -1 || target < 0 || target >= ordered.length) return { ok: true }

    const [moved] = ordered.splice(index, 1)
    ordered.splice(target, 0, moved)

    // Renumbered from 1 rather than swapping two values: rows seeded or added
    // at different times can share a sort_order, and swapping equal numbers
    // moves nothing.
    const { error } = await supabase.from('testimonials').upsert(
        ordered.map((item, position) => ({
            id: item.id,
            name: item.name,
            rating: item.rating,
            comment: item.comment,
            stay: item.stay || null,
            is_active: item.isActive,
            sort_order: position + 1,
        })),
    )

    if (error) {
        console.error('Could not reorder the testimonials:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    await loadTestimonials()
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
            { event: '*', schema: 'public', table: 'testimonial_section' },
            loadTestimonials,
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'testimonials' },
            loadTestimonials,
        )
        .subscribe()
}

if (isSupabaseConfigured) {
    loadTestimonials()
    watchRealtime()
}
