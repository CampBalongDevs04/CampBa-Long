// ============================================================================
//  Booking owner token — "which bookings are mine?"
// ----------------------------------------------------------------------------
//  Guests never sign in, so a booking has to be tied to something else. This
//  browser mints one 256-bit random token and keeps it; every booking it makes
//  is stamped with the token's SHA-256 hash, server side. Reading or managing a
//  booking later means presenting the token again.
//
//  Consequences, all of them intended:
//
//    • My Bookings survives a refresh, a new tab, and closing the browser.
//    • Another device — or another browser, or a private window — has a
//      different token, so it sees none of these bookings. That is the whole
//      point: one guest's reservation is not another guest's business.
//    • Clearing site data loses the list, not the reservation. The guest still
//      has their CBL-… code and staff still have the row.
//
//  The token is a bearer secret: whoever holds it holds the bookings. So it is
//  never put in a URL, never sent anywhere but Supabase, and only ever leaves
//  here through the RPCs in accommodationDB.js.
// ============================================================================

const STORAGE_KEY = 'campbalong.booking-owner'

// 32 bytes → 64 hex characters. The database rejects anything under 32
// characters outright, so the length is part of the contract, not a detail.
const TOKEN_BYTES = 32

// Safari in private mode, and a few embedded WebViews, throw on localStorage
// rather than returning null. A guest in that situation still gets a working
// booking flow — their list just lives as long as the tab does, which is
// exactly where everyone stood before this existed.
let memoryToken = null

function readStored(){
    try {
        return window.localStorage.getItem(STORAGE_KEY)
    } catch {
        return null
    }
}

function writeStored(token){
    try {
        window.localStorage.setItem(STORAGE_KEY, token)
        return true
    } catch {
        return false
    }
}

function mintToken(){
    const bytes = new Uint8Array(TOKEN_BYTES)
    if (globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(bytes)
    } else {
        // No Web Crypto means an ancient or exotic browser. Math.random() is
        // not a security-grade source, so this is a fallback that keeps the
        // page working rather than one anybody should end up on.
        for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
    }
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// The token for this browser, created on first use. Always a valid token —
// callers never have to handle "not set up yet".
export function getOwnerToken(){
    if (memoryToken) return memoryToken

    const stored = readStored()
    // Reject a short or corrupted value instead of sending one the database
    // will refuse: a truncated token would silently hide the guest's bookings.
    if (stored && stored.length >= 32) {
        memoryToken = stored
        return memoryToken
    }

    memoryToken = mintToken()
    writeStored(memoryToken)
    return memoryToken
}

// True when the token outlives the tab. When it does not, the booking list is
// session-only and My Bookings says so rather than looking empty for no reason.
export function isOwnerTokenPersistent(){
    getOwnerToken()
    return readStored() === memoryToken
}

// Sign out of your own bookings on a shared or borrowed device: forget the
// token and every booking it unlocks. The reservations themselves are
// untouched — staff still have them, and the CBL-… code still works at the
// desk. There is no undo, because the token is gone.
export function forgetOwnerToken(){
    try {
        window.localStorage.removeItem(STORAGE_KEY)
    } catch {
        /* nothing stored to begin with */
    }
    memoryToken = null
}
