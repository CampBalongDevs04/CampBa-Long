// ============================================================================
//  Camp Ba-long — the words on /my-booking, and the QR codes guests pay into
// ----------------------------------------------------------------------------
//  One row in Postgres (public.my_booking_page) plus one list
//  (public.payment_methods). Read by src/pages/mybooking.jsx and the payment
//  components under src/pages/components/, and written by the dashboard's
//  CMS → My Booking. See the header of
//  supabase/migrations/20260811120000_my_booking_cms.sql for why the copy is a
//  singleton and the QR cards are a table.
//
//  Built as the direct counterpart of data/bookingPage.js, on purpose.
//
//  THE PLACEHOLDERS
//  ----------------
//  Four of these strings are printed around figures only the browser knows —
//  the booking's own code, what is still outstanding on it, the minutes left on
//  its hold. Staff write {code}, {amount}, {minutes}, {unit}, {Unit} or
//  {unit-is} into the wording and fillTokens() below swaps them for the real
//  values at render time. That list is implemented here and nowhere else; a
//  token nobody supplies is left on screen as typed, which is the honest
//  outcome — a silently blanked placeholder reads as a missing word.
//
//  THE FALLBACK IS THE COPY THE SITE SHIPPED WITH
//  ------------------------------------------------
//  Every constant below is, word for word, what mybooking.jsx, payment.jsx and
//  bookingPayment.jsx used to have hardcoded — so an unconfigured .env, a dead
//  network or a database the migration has not reached still reads exactly the
//  same.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'
import ireneGcash from '../assets/images/IreneGcash.jpg'

const ROW_ID = 'mybooking'
const CHANNEL = 'my-booking-page-changes'

// qr_key → bundled asset. The only place the two sides are tied together, and
// the twin of IMAGES in data/menuDB.js. Only the QR the site shipped with is
// here: anything staff add later is an upload with a URL, so this map does not
// grow.
const BUNDLED_QR = {
    'irene-gcash': ireneGcash,
}

// The QR for a card, from whichever of the two it has. A bundled asset beats a
// URL — it is versioned with the build and cannot 404 later — and uploading in
// the dashboard clears the key rather than racing this rule.
export function resolveQrImage(qrKey, qrUrl = null) {
    if (qrKey && BUNDLED_QR[qrKey]) return BUNDLED_QR[qrKey]
    return qrUrl || null
}

// Word for word what the front end used to have written into it.
export const MY_BOOKING_PAGE_FALLBACK = {
    eyebrow: 'Camp Ba-long Reservations',
    title: 'My Bookings',
    tagline: 'Review your reservation history and manage upcoming stays.',
    privacyNote: 'Only the bookings made on this device appear here. Open the site on'
        + ' another phone or browser and you will see that device’s bookings instead'
        + ' — your details are never shown to another guest.',
    savedTitle: 'Booking {code} received',
    savedText: 'Save a copy for check-in — it downloads as an image you can keep in your photos.',
    holdTitle: '{Unit} held for booking {code}',
    holdText: 'Your {unit-is} reserved for the next {minutes} minutes. Send the {amount}'
        + ' down payment and upload the receipt below before the timer runs out, or the'
        + ' booking is cancelled and the {unit-is} released. Ordering food or a spa'
        + ' treatment first adds them to that amount.',
    saveReceiptLabel: 'Save Receipt',
    payNoteHeading: 'Send {amount}.',
    payNoteText: 'Scan the QR of your preferred method, then upload the screenshot as'
        + ' proof. Your unit stays held while we verify it.',
    uploadWarning: 'Please upload only your own proof of payment. A fake receipt, or any'
        + ' image that is not related to this payment, will have your booking rejected.',
}

export const PAYMENT_METHODS_FALLBACK = [
    {
        id: 'gcash',
        method: 'GCash',
        accountName: 'IR**E B.',
        accountNumber: '0919 033 ....',
        qrKey: 'irene-gcash',
        qrUrl: null,
        sortOrder: 1,
        isActive: true,
    },
    {
        id: 'bank-transfer',
        method: 'Bank Transfer',
        accountName: 'Gabriel Aramullo',
        accountNumber: null,
        qrKey: null,
        qrUrl: null,
        sortOrder: 2,
        isActive: true,
    },
]

// `loaded` is what tells a caller the difference between "not asked yet" and
// "asked, and this is the answer". Until it flips, everything below is the
// shipped copy, so the page is never blank and the QR cards are never missing.
let state = {
    page: MY_BOOKING_PAGE_FALLBACK,
    methods: PAYMENT_METHODS_FALLBACK,         // every row, including hidden ones
    activeMethods: PAYMENT_METHODS_FALLBACK,   // what a guest is shown
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

export function useMyBookingPage() {
    return useSyncExternalStore(subscribe, snapshot)
}

// Swap {token} for what the browser knows. Used by every string above that is
// printed around a live figure.
//
// A token nobody supplied is LEFT AS TYPED rather than blanked: {amout} is a
// typo a staff member can see and fix, whereas a sentence that quietly loses a
// word reads as broken copy with no cause.
export function fillTokens(template, tokens = {}) {
    return String(template ?? '').replace(/\{([\w-]+)\}/g, (whole, name) =>
        Object.prototype.hasOwnProperty.call(tokens, name) ? String(tokens[name]) : whole,
    )
}

// The {unit}/{Unit}/{unit-is} trio for one entry, so a single sentence serves
// both a single booking and a combined reservation. `isGroup` is the flag every
// row in My Bookings already carries.
export function unitTokens(isGroup) {
    return {
        unit: isGroup ? 'units' : 'unit',
        Unit: isGroup ? 'Units' : 'Unit',
        'unit-is': isGroup ? 'units are' : 'unit is',
    }
}

// A blank column falls back rather than printing nothing: an empty title is a
// page that looks broken, not a page with no title.
function rowToPage(row) {
    if (!row) return MY_BOOKING_PAGE_FALLBACK
    const fallback = MY_BOOKING_PAGE_FALLBACK
    return {
        eyebrow: row.eyebrow ?? '',
        title: row.title || fallback.title,
        tagline: row.tagline ?? '',
        privacyNote: row.privacy_note ?? '',
        savedTitle: row.saved_title || fallback.savedTitle,
        savedText: row.saved_text ?? '',
        holdTitle: row.hold_title || fallback.holdTitle,
        holdText: row.hold_text ?? '',
        saveReceiptLabel: row.save_receipt_label || fallback.saveReceiptLabel,
        payNoteHeading: row.pay_note_heading ?? '',
        payNoteText: row.pay_note_text ?? '',
        uploadWarning: row.upload_warning ?? '',
    }
}

function rowToMethod(row) {
    return {
        id: row.id,
        method: row.method,
        accountName: row.account_name ?? '',
        accountNumber: row.account_number ?? '',
        qrKey: row.qr_key ?? null,
        qrUrl: row.qr_url ?? null,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    }
}

export async function loadMyBookingPage() {
    if (!isSupabaseConfigured) {
        commit({ loaded: true })
        return
    }

    const [pageResult, methodsResult] = await Promise.all([
        supabase
            .from('my_booking_page')
            .select('eyebrow, title, tagline, privacy_note, saved_title, saved_text,'
                + ' hold_title, hold_text, save_receipt_label, pay_note_heading, pay_note_text,'
                + ' upload_warning')
            .eq('id', ROW_ID)
            .maybeSingle(),
        supabase
            .from('payment_methods')
            .select('id, method, account_name, account_number, qr_key, qr_url, sort_order, is_active')
            .order('sort_order', { ascending: true }),
    ])

    const error = pageResult.error ?? methodsResult.error
    if (error) {
        // Not worth a message on the page: the fallback copy and the shipped QR
        // are already on screen. The dashboard does surface `error`, because
        // there it is the answer to "why did nothing I typed show up".
        console.error('Could not load the My Bookings copy:', error.message)
        commit({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    // An EMPTY ANSWER IS AN ANSWER. The table replied and said there are no
    // payment methods, so that is what both sides are told — the fallback is
    // not substituted back in here.
    //
    // This is the difference between the two ways the list can come back empty,
    // and getting it wrong moves money:
    //
    //   • The query FAILED — no migration, no network. Handled above, by
    //     returning without touching `methods`, so the QR the site shipped with
    //     stays on screen. Nothing has been configured yet, so shipped is right.
    //   • The query SUCCEEDED and returned nothing. Staff deleted the cards. Re-
    //     adding the bundled GCash QR here would tell guests to send their down
    //     payment to the very account the resort just took down, and staff would
    //     see two cards in the dashboard that are not in the table — Edit would
    //     refuse them as gone, and reordering would upsert them into existence.
    const methods = (methodsResult.data ?? []).map(rowToMethod)

    commit({
        page: rowToPage(pageResult.data),
        methods,
        activeMethods: methods.filter((row) => row.isActive),
        loaded: true,
        error: null,
    })
}


// ==================================================================== writing

function uniqueId(base, taken) {
    if (!taken.has(base)) return base
    let n = 2
    while (taken.has(`${base}-${n}`)) n += 1
    return `${base}-${n}`
}

function slugify(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
}

// Every write to the singleton goes through here. The row is seeded by the
// migration, so this is always an update — and `.select()` is what turns an
// update that matched nothing into an answer rather than a silent success.
async function updatePage(patch, what) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase
        .from('my_booking_page')
        .update(patch)
        .eq('id', ROW_ID)
        .select('id')

    if (error) {
        console.error(`Could not save the ${what}:`, error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — this account is not on the staff roster, or the '
                + 'My Bookings migration has not been applied to this database yet.',
        }
    }

    await loadMyBookingPage()
    return { ok: true }
}

// The hero: what a guest reads above their list of bookings.
export async function saveMyBookingHero(draft) {
    const title = String(draft.title ?? '').trim()
    if (!title) {
        return { ok: false, message: 'Write a title — it is the heading at the top of the page.' }
    }

    return updatePage({
        eyebrow: String(draft.eyebrow ?? '').trim() || null,
        title,
        tagline: String(draft.tagline ?? '').trim() || null,
        privacy_note: String(draft.privacyNote ?? '').trim() || null,
    }, 'My Bookings hero')
}

// The green panel over the list — both versions of it, edited together because
// they are the same panel and a guest only ever sees one of them.
export async function saveMyBookingReceiptNote(draft) {
    const savedTitle = String(draft.savedTitle ?? '').trim()
    if (!savedTitle) {
        return { ok: false, message: 'Write the heading for a booking that is already paid for.' }
    }

    const holdTitle = String(draft.holdTitle ?? '').trim()
    if (!holdTitle) {
        return { ok: false, message: 'Write the heading for a unit that is being held.' }
    }

    const saveReceiptLabel = String(draft.saveReceiptLabel ?? '').trim()
    if (!saveReceiptLabel) {
        return {
            ok: false,
            message: 'Write the button label — it is what downloads the receipt.',
        }
    }

    return updatePage({
        saved_title: savedTitle,
        saved_text: String(draft.savedText ?? '').trim() || null,
        hold_title: holdTitle,
        hold_text: String(draft.holdText ?? '').trim() || null,
        save_receipt_label: saveReceiptLabel,
    }, 'save-receipt note')
}

// The gold note above the QR codes, and the caution against the upload button.
// Saved together because they are the two things a guest reads while paying and
// they have to agree — the note says what to send, the warning says what not to.
export async function saveMyBookingPayNote(draft) {
    return updatePage({
        pay_note_heading: String(draft.payNoteHeading ?? '').trim() || null,
        pay_note_text: String(draft.payNoteText ?? '').trim() || null,
        upload_warning: String(draft.uploadWarning ?? '').trim() || null,
    }, 'payment notes')
}

// Create or edit one QR card. `qrUrl` arrives already uploaded — the dashboard's
// image field puts the file in the bucket when it is picked and hands this the
// URL — and an upload clears `qrKey` so it wins over the bundled QR.
export async function savePaymentMethod(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const method = String(draft.method ?? '').trim()
    if (!method) {
        return { ok: false, message: 'Name the payment method — GCash, Maya, a bank, and so on.' }
    }

    const isNew = !draft.id
    const taken = new Set(state.methods.map((row) => row.id))
    const id = draft.id || uniqueId(slugify(method) || 'payment-method', taken)

    const qrUrl = String(draft.qrUrl ?? '').trim() || null

    const row = {
        method,
        account_name: String(draft.accountName ?? '').trim() || null,
        account_number: String(draft.accountNumber ?? '').trim() || null,
        // A row that shipped with a bundled QR keeps naming it until something
        // is uploaded over it; from then on the upload is the only QR it has.
        qr_key: qrUrl ? null : (String(draft.qrKey ?? '').trim() || null),
        qr_url: qrUrl,
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    let error
    let updated = null
    if (isNew) {
        row.id = id
        ;({ error } = await supabase.from('payment_methods').insert(row))
    } else {
        ;({ error, data: updated } = await supabase
            .from('payment_methods')
            .update(row)
            .eq('id', id)
            .select('id'))
    }

    if (error) {
        console.error('Could not save the payment method:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if (!isNew && (updated?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was saved — that payment method no longer exists, or this account '
                + 'is not on the staff roster.',
        }
    }

    await loadMyBookingPage()
    return { ok: true, id }
}

export async function deletePaymentMethod(id) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { data, error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id)
        .select('id')

    if (error) {
        console.error('Could not delete the payment method:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    if ((data?.length ?? 0) === 0) {
        return {
            ok: false,
            message: 'Nothing was deleted — that payment method is already gone, or this account '
                + 'is not on the staff roster.',
        }
    }

    await loadMyBookingPage()
    return { ok: true }
}

// Move a card one place along the row. The list on screen IS the order stored,
// so there is no sort number for staff to keep in step.
//
// Renumbered from 1 rather than swapping two values, for the same reason as
// moveRow() in data/bookingPage.js: rows seeded or added at different times can
// share a sort_order, and swapping equal numbers moves nothing.
export async function movePaymentMethod(id, direction) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const ordered = [...state.methods].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordered.findIndex((row) => row.id === id)
    const target = index + (direction === 'up' ? -1 : 1)
    if (index === -1 || target < 0 || target >= ordered.length) return { ok: true }

    const [moved] = ordered.splice(index, 1)
    ordered.splice(target, 0, moved)

    const { error } = await supabase.from('payment_methods').upsert(
        ordered.map((row, position) => ({
            id: row.id,
            method: row.method,
            account_name: row.accountName || null,
            account_number: row.accountNumber || null,
            qr_key: row.qrKey,
            qr_url: row.qrUrl,
            is_active: row.isActive,
            sort_order: position + 1,
        })),
    )

    if (error) {
        console.error('Could not reorder the payment methods:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    await loadMyBookingPage()
    return { ok: true }
}


// =================================================================== realtime

function watchRealtime() {
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CHANNEL}`) supabase.removeChannel(channel)
    }

    supabase
        .channel(CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'my_booking_page' }, loadMyBookingPage)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_methods' }, loadMyBookingPage)
        .subscribe()
}

if (isSupabaseConfigured) {
    loadMyBookingPage()
    watchRealtime()
}
