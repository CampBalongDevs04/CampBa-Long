// ============================================================================
//  Camp Ba-long — the "What We Offer" section's content
// ----------------------------------------------------------------------------
//  The heading (public.offer_section), the amenity cards (public.offer_cards),
//  the photos inside each card's "Discover More" window
//  (public.offer_gallery_items) and the small icon row under them
//  (public.offer_tags) — read by the home page and written by the dashboard's
//  CMS → What We Offer. See the header of
//  supabase/migrations/*_offer_section_cms.sql.
//
//  Built the same way as data/homeHero.js and data/welcomeSection.js,
//  deliberately: three sections of one page doing the same job should not each
//  be a surprise to whoever reads them next.
//
//  THE GALLERY IS NESTED INTO ITS CARD
//  -----------------------------------
//  Two tables come back, and this puts each card's photos on the card before
//  anything renders. The modal is handed an offer, not an id and a lookup, so
//  a card that has just been added and has no photos yet opens an empty window
//  rather than throwing — and neither the card nor the modal has to know that
//  a second query exists.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

import poolSideImage from '../assets/images/poolside.png'

const ROW_ID = 'home'
const CHANNEL = 'offer-section-changes'

// The photos the cards SHIPPED with. Only the pool card has one — the other
// two point at stock photos on someone else's server, which is stored as a
// plain URL like any upload would be. A card added from the dashboard has no
// entry here and simply uses its uploaded photo.
const IMAGES_BY_ID = {
    'pool-running-water': poolSideImage,
}

// Word for word what the front end used to have written into it.
export const OFFER_SECTION_FALLBACK = {
    title: 'What We Offer',
    subtitle: '• Unwind. Indulge. Reconnect.',
    subtitleHighlight: 'All in one place',
}

// The nine gallery slots are the ones OfferGalleryModal.jsx already had, down
// to the wording — including their photos being absent, which is why the
// window has always shown "Photo coming soon".
export const OFFER_CARDS_FALLBACK = [
    {
        id: 'pool-running-water',
        title: 'Pool & Running Water',
        description: 'Enjoy nature theme pools',
        imageUrl: null,
        imageAlt: 'Natural theme pool surrounded by greenery',
        iconKey: 'pool',
        iconUrl: null,
        sortOrder: 1,
        isActive: true,
        gallery: [
            { id: 'pool-running-water-pool', title: 'Pool', description: '', imageUrl: null, imageAlt: 'pool', sortOrder: 1, isActive: true },
            { id: 'pool-running-water-river', title: 'River', description: '', imageUrl: null, imageAlt: 'river', sortOrder: 2, isActive: true },
            { id: 'pool-running-water-running', title: 'Running Water', description: '', imageUrl: null, imageAlt: 'running water', sortOrder: 3, isActive: true },
        ],
    },
    {
        id: 'foods',
        title: 'Foods',
        description: 'Savor local flavors and fresh ingredients',
        imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80&auto=format&fit=crop',
        imageAlt: 'Local foods spread with fresh ingredients',
        iconKey: 'food',
        iconUrl: null,
        sortOrder: 2,
        isActive: true,
        gallery: [
            { id: 'foods-local-dishes', title: 'Local Dishes', description: '', imageUrl: null, imageAlt: 'local dishes', sortOrder: 1, isActive: true },
            { id: 'foods-fresh-ingredients', title: 'Fresh Ingredients', description: '', imageUrl: null, imageAlt: 'fresh ingredients', sortOrder: 2, isActive: true },
            { id: 'foods-refreshments', title: 'Refreshments', description: '', imageUrl: null, imageAlt: 'refreshments', sortOrder: 3, isActive: true },
        ],
    },
    {
        id: 'spa',
        title: 'Spa',
        description: 'Relax, rejuvenate and refresh your senses',
        imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80&auto=format&fit=crop',
        imageAlt: 'Hot stone spa treatment',
        iconKey: 'spa',
        iconUrl: null,
        sortOrder: 3,
        isActive: true,
        gallery: [
            { id: 'spa-massage', title: 'Massage', description: '', imageUrl: null, imageAlt: 'massage', sortOrder: 1, isActive: true },
            { id: 'spa-hot-stone', title: 'Hot Stone', description: '', imageUrl: null, imageAlt: 'hot stone', sortOrder: 2, isActive: true },
            { id: 'spa-relaxation-area', title: 'Relaxation Area', description: '', imageUrl: null, imageAlt: 'relaxation area', sortOrder: 3, isActive: true },
        ],
    },
]

export const OFFER_TAGS_FALLBACK = [
    { id: 'nature', label: 'Nature', iconKey: 'nature', iconUrl: null, sortOrder: 1, isActive: true },
    { id: 'relaxation', label: 'Relaxation', iconKey: 'relaxation', iconUrl: null, sortOrder: 2, isActive: true },
    { id: 'wellness', label: 'Wellness', iconKey: 'wellness', iconUrl: null, sortOrder: 3, isActive: true },
]

// Each list is kept twice, all rows and visible rows, both built at commit time
// so the snapshot the hook returns keeps a stable identity between renders.
let state = {
    section: OFFER_SECTION_FALLBACK,
    cards: OFFER_CARDS_FALLBACK,
    activeCards: OFFER_CARDS_FALLBACK,
    tags: OFFER_TAGS_FALLBACK,
    activeTags: OFFER_TAGS_FALLBACK,
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

export function useOffersSection() {
    return useSyncExternalStore(subscribe, snapshot)
}

function rowToSection(row) {
    if (!row) return OFFER_SECTION_FALLBACK
    return {
        title: row.title ?? '',
        subtitle: row.subtitle ?? '',
        subtitleHighlight: row.subtitle_highlight ?? '',
    }
}

function rowToGalleryItem(row) {
    return {
        id: row.id,
        cardId: row.card_id,
        title: row.title,
        description: row.description ?? '',
        imageUrl: row.image_url ?? null,
        imageAlt: row.image_alt ?? '',
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    }
}

function rowToCard(row, gallery) {
    return {
        id: row.id,
        title: row.title,
        description: row.description ?? '',
        imageUrl: row.image_url ?? null,
        imageAlt: row.image_alt ?? '',
        iconKey: row.icon_key ?? '',
        iconUrl: row.icon_url ?? null,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
        gallery,
    }
}

function rowToTag(row) {
    return {
        id: row.id,
        label: row.label,
        iconKey: row.icon_key ?? '',
        iconUrl: row.icon_url ?? null,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    }
}

export async function loadOffersSection() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const [sectionResult, cardsResult, galleryResult, tagsResult] = await Promise.all([
        supabase
            .from('offer_section')
            .select('title, subtitle, subtitle_highlight')
            .eq('id', ROW_ID)
            .maybeSingle(),
        supabase
            .from('offer_cards')
            .select('id, title, description, image_url, image_alt, icon_key, icon_url, sort_order, is_active')
            .order('sort_order', { ascending: true }),
        supabase
            .from('offer_gallery_items')
            .select('id, card_id, title, description, image_url, image_alt, sort_order, is_active')
            .order('sort_order', { ascending: true }),
        supabase
            .from('offer_tags')
            .select('id, label, icon_key, icon_url, sort_order, is_active')
            .order('sort_order', { ascending: true }),
    ])

    const error =
        sectionResult.error ?? cardsResult.error ?? galleryResult.error ?? tagsResult.error
    if (error) {
        // Not worth a message on the page: the fallback copy is already on
        // screen. The dashboard does surface `error`, because there it is the
        // answer to "why did nothing I typed show up".
        console.error('Could not load the offers section:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    // Grouped once here rather than filtered per card at render time, so a
    // card with no photos is an empty array on the card instead of a lookup
    // that has to cope with there being no entry.
    const galleryByCard = new Map()
    for (const row of galleryResult.data ?? []) {
        const item = rowToGalleryItem(row)
        if (!galleryByCard.has(item.cardId)) galleryByCard.set(item.cardId, [])
        galleryByCard.get(item.cardId).push(item)
    }

    const cards = (cardsResult.data ?? []).map((row) =>
        rowToCard(row, galleryByCard.get(row.id) ?? []),
    )
    const tags = (tagsResult.data ?? []).map(rowToTag)

    commit({
        section: rowToSection(sectionResult.data),
        cards,
        // A hidden photo is dropped from what the window shows, the same way a
        // hidden card is dropped from the grid.
        activeCards: cards
            .filter((card) => card.isActive)
            .map((card) => ({ ...card, gallery: card.gallery.filter((item) => item.isActive) })),
        tags,
        activeTags: tags.filter((tag) => tag.isActive),
        loaded: true,
        error: null,
    })
}

// The photo one card shows, resolved in one place so the home page and the
// dashboard's preview never disagree about which is live.
export function resolveOfferImage(id, imageUrl = null) {
    return imageUrl || IMAGES_BY_ID[id] || null
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

function everyGalleryItem() {
    return state.cards.flatMap((card) => card.gallery)
}

export async function saveOfferSection(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const title = String(draft.title ?? '').trim()
    if (!title) {
        return { ok: false, message: 'Write a heading — it is what the section is called on the page.' }
    }

    const { data, error } = await supabase
        .from('offer_section')
        .update({
            title,
            subtitle: String(draft.subtitle ?? '').trim() || null,
            subtitle_highlight: String(draft.subtitleHighlight ?? '').trim() || null,
        })
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error('Could not save the offers heading:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'offers section migration has not been applied to this database yet.',
        }
    }

    await loadOffersSection()
    return { ok: true }
}

// Create or edit one amenity card.
export async function saveOfferCard(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const title = String(draft.title ?? '').trim()
    if (!title) return { ok: false, message: 'Give the card a heading.' }

    const isNew = !draft.id
    const taken = new Set(state.cards.map((card) => card.id))
    const id = draft.id || uniqueId(slugify(title) || 'offer', taken)

    const imageUrl = String(draft.imageUrl ?? '').trim() || null

    // Refused rather than saved: the photo is most of the card, and a card with
    // neither an uploaded photo nor a bundled one is a blank rectangle in the
    // grid whose cause is not obvious from looking at it.
    if (!resolveOfferImage(id, imageUrl)) {
        return { ok: false, message: 'Upload a photo — it fills the top of the card.' }
    }

    const row = {
        title,
        description: String(draft.description ?? '').trim() || null,
        image_url: imageUrl,
        image_alt: String(draft.imageAlt ?? '').trim() || null,
        icon_key: String(draft.iconKey ?? '').trim() || null,
        icon_url: String(draft.iconUrl ?? '').trim() || null,
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from('offer_cards').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('offer_cards')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the offer card:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that card no longer exists, or this account is not '
                + 'on the staff roster.',
        }
    }

    await loadOffersSection()
    return { ok: true, id }
}

// Deleting a card takes its "Discover More" photos with it — the foreign key
// cascades, so there is no second delete to remember and no way to leave
// photos behind that belong to nothing.
export async function deleteOfferCard(id) {
    return deleteRow('offer_cards', id, 'card')
}

// Create or edit one photo inside a card's "Discover More" window.
export async function saveOfferGalleryItem(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const title = String(draft.title ?? '').trim()
    if (!title) return { ok: false, message: 'Give the photo a title.' }
    if (!draft.cardId) return { ok: false, message: 'This photo has no card to belong to.' }

    const isNew = !draft.id
    const taken = new Set(everyGalleryItem().map((item) => item.id))
    // Prefixed with the card so the ids stay readable in the database rather
    // than three unrelated rows all called 'massage'.
    const id = draft.id || uniqueId(`${draft.cardId}-${slugify(title) || 'photo'}`, taken)

    const row = {
        card_id: draft.cardId,
        title,
        description: String(draft.description ?? '').trim() || null,
        image_url: String(draft.imageUrl ?? '').trim() || null,
        image_alt: String(draft.imageAlt ?? '').trim() || null,
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from('offer_gallery_items').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('offer_gallery_items')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the gallery photo:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that photo no longer exists, or this account is not '
                + 'on the staff roster.',
        }
    }

    await loadOffersSection()
    return { ok: true, id }
}

export async function deleteOfferGalleryItem(id) {
    return deleteRow('offer_gallery_items', id, 'photo')
}

export async function saveOfferTag(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const label = String(draft.label ?? '').trim()
    if (!label) return { ok: false, message: 'Give the tag a word.' }

    const isNew = !draft.id
    const taken = new Set(state.tags.map((tag) => tag.id))
    const id = draft.id || uniqueId(slugify(label) || 'tag', taken)

    const row = {
        label,
        icon_key: String(draft.iconKey ?? '').trim() || null,
        icon_url: String(draft.iconUrl ?? '').trim() || null,
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from('offer_tags').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('offer_tags')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the tag:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that tag no longer exists, or this account is not on '
                + 'the staff roster.',
        }
    }

    await loadOffersSection()
    return { ok: true, id }
}

export async function deleteOfferTag(id) {
    return deleteRow('offer_tags', id, 'tag')
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

    await loadOffersSection()
    return { ok: true }
}

// Move a row one place along its list. The list on screen IS the order stored,
// so there is no sort number for staff to keep in step.
async function moveRow(table, rows, id, direction, columns) {
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
    const { error } = await supabase
        .from(table)
        .upsert(ordered.map((row, position) => ({ ...columns(row), sort_order: position + 1 })))

    if (error) {
        console.error(`Could not reorder ${table}:`, error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    await loadOffersSection()
    return { ok: true }
}

export function moveOfferCard(id, direction) {
    return moveRow('offer_cards', state.cards, id, direction, (row) => ({
        id: row.id,
        title: row.title,
        description: row.description || null,
        image_url: row.imageUrl || null,
        image_alt: row.imageAlt || null,
        icon_key: row.iconKey || null,
        icon_url: row.iconUrl || null,
        is_active: row.isActive,
    }))
}

// Scoped to one card: the photos are renumbered within their own window, so
// moving a Spa photo cannot disturb the order of the Foods ones.
export function moveOfferGalleryItem(cardId, id, direction) {
    const gallery = state.cards.find((card) => card.id === cardId)?.gallery ?? []
    return moveRow('offer_gallery_items', gallery, id, direction, (row) => ({
        id: row.id,
        card_id: cardId,
        title: row.title,
        description: row.description || null,
        image_url: row.imageUrl || null,
        image_alt: row.imageAlt || null,
        is_active: row.isActive,
    }))
}

export function moveOfferTag(id, direction) {
    return moveRow('offer_tags', state.tags, id, direction, (row) => ({
        id: row.id,
        label: row.label,
        icon_key: row.iconKey || null,
        icon_url: row.iconUrl || null,
        is_active: row.isActive,
    }))
}


// =================================================================== realtime

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'offer_section' }, loadOffersSection)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'offer_cards' }, loadOffersSection)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'offer_gallery_items' }, loadOffersSection)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'offer_tags' }, loadOffersSection)
        .subscribe()
}

if (isSupabaseConfigured) {
    loadOffersSection()
    watchRealtime()
}
