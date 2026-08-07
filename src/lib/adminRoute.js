import { useEffect, useState } from 'react'

// The admin URL is not shipped as a string.
//
// Everything in a Vite bundle reaches the browser, so `<Route path="/admin…">`
// was readable by anyone who opened the Sources tab and searched for "admin" —
// and it sat in the repo on GitHub too. Matching a SHA-256 digest instead means
// the bundle carries only the digest: the path has to be guessed, not read.
//
// Be clear about what this buys. It is obscurity, not access control. The
// dashboard is gated by Supabase Auth plus the is_staff() allow-list plus RLS
// (see the staff_only_booking_access migration) — finding the URL still only
// gets you the login form, and a determined attacker can brute-force a short
// path against the digest. This removes the drive-by, not the attacker.
//
// To change the path, run:  node scripts/admin-path-hash.mjs new-path

const PATH_HASH = (import.meta.env.VITE_ADMIN_PATH_HASH ?? '').trim().toLowerCase()

// Must match the normalisation in scripts/admin-path-hash.mjs. Lower-cased and
// stripped of trailing slashes so "/Foo/" and "/foo" hash the same — otherwise
// staff who type the URL slightly differently get a blank page.
function normalisePath(pathname) {
    return '/' + String(pathname).trim().replace(/^\/+|\/+$/g, '').toLowerCase()
}

async function sha256Hex(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

export async function isAdminPath(pathname) {
    const target = normalisePath(pathname)
    if (target === '/') return false

    if (import.meta.env.DEV) {
        // crypto.subtle exists only in a secure context, so `vite --host`
        // opened from a phone at http://192.168.x.x has none. Dev bundles are
        // never deployed, so comparing the plain path is fine here — and
        // because this whole branch sits behind import.meta.env.DEV, the
        // production build drops it and the literal along with it.
        //
        // With neither variable set — a fresh clone by someone who has not
        // been handed the real URL — the dashboard answers on /admin locally
        // so they are not blocked. That default cannot reach production: the
        // build refuses to run without VITE_ADMIN_PATH_HASH (vite.config.js).
        const devPath = import.meta.env.VITE_ADMIN_PATH ?? (PATH_HASH ? '' : '/admin')
        if (devPath) return normalisePath(devPath) === target
    }

    if (!PATH_HASH || !globalThis.crypto?.subtle) return false
    return (await sha256Hex(target)) === PATH_HASH
}

/**
 * Three-state on purpose: `null` means the digest is still being computed.
 *
 * Hashing is asynchronous, so a caller that treated "not yet known" as "not
 * admin" would paint the guest header over the dashboard for a frame. Pass
 * `null` for a path already known to be public to skip the work entirely.
 *
 * @param {string|null} pathname
 * @returns {boolean|null} true / false, or null while still checking
 */
export function useIsAdminPath(pathname) {
    const [checked, setChecked] = useState({ path: null, value: false })

    useEffect(() => {
        if (!pathname) return
        let alive = true
        isAdminPath(pathname).then((value) => {
            if (alive) setChecked({ path: pathname, value })
        })
        return () => {
            alive = false
        }
    }, [pathname])

    if (!pathname) return false
    // Answer belongs to a previous pathname — still checking this one.
    if (checked.path !== pathname) return null
    return checked.value
}
