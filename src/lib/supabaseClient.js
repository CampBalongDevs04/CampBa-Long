import { createClient } from '@supabase/supabase-js'

// Supabase project: campBalongWeb.
//
// Values come from .env (see .env.example). The publishable key is meant to be
// in the browser bundle — Row Level Security decides what it can actually
// reach, which is why the bookings table is readable only by a signed-in staff
// session while guests go through the SECURITY DEFINER RPCs.
//
// NOTE: Vite inlines import.meta.env.VITE_* at BUILD time, not at run time.
// Whatever machine runs `npm run build` must have these set — a local .env, or
// the environment variables configured in your hosting dashboard. Setting them
// only on the server at run time does nothing.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && key)

// The one message every screen shows when the keys are missing. It is exported
// rather than written out at each call site because this is the only fix, and
// a guest or a teammate hitting it should be told the same thing every time
// instead of the raw "Failed to fetch" the browser reports.
export const SUPABASE_SETUP_MESSAGE =
    'This copy of the site is not connected to its database. ' +
    'Copy .env.example to .env, fill in VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_PUBLISHABLE_KEY (ask a teammate for the values — they are ' +
    'deliberately not in the repo), then restart the dev server.'

if (!isSupabaseConfigured) {
    console.error(
        '[Camp Ba-long] Supabase is not configured, so bookings, receipt ' +
        'uploads and availability will not work.\n' +
        'Fix: copy .env.example to .env and fill in VITE_SUPABASE_URL and ' +
        'VITE_SUPABASE_PUBLISHABLE_KEY, then restart the dev server. ' +
        'For a deployed build, set the same two variables in your hosting ' +
        'provider and redeploy.',
    )
}

// Turn a Supabase/network failure into something a human can act on.
//
// Two failures look identical to the caller but have completely different
// fixes. With no keys the client is pointed at a placeholder host, so every
// request dies as a bare "Failed to fetch" — which reads like the server is
// down and sends people hunting through storage policies. That case is a
// missing .env, and it is worth saying so plainly. Anything else is a real
// error and is passed through untouched.
export function describeSupabaseError(error) {
    if (!isSupabaseConfigured) return SUPABASE_SETUP_MESSAGE
    const message = error?.message ?? String(error ?? 'Unknown error')
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
        return 'Could not reach the server. Check your internet connection and try again.'
    }
    return message
}

// createClient() throws on an empty URL, which would take down the whole app
// at import time — a fresh clone with no .env would white-screen the home page
// too, not just the booking flow. Fall back to a placeholder so the site still
// renders and only the data-backed parts degrade.
export const supabase = createClient(
    url || 'http://unconfigured.invalid',
    key || 'unconfigured',
    {
        auth: {
            // The staff session lives in memory and nowhere else: reloading the
            // dashboard, opening it in a second tab or coming back to the
            // browser tomorrow all ask for the password again. A resort computer
            // left open on the bookings table is the case this is aimed at, and
            // nothing else on the site signs anyone in — guests reach their own
            // bookings through the anon key and the RPCs.
            persistSession: false,
            // Still refreshed while the tab is open, so a long shift on the
            // dashboard is not interrupted by an expired token.
            autoRefreshToken: true,
        },
    },
)

// Sessions earlier builds wrote to localStorage are never read again now that
// persistSession is off. Clearing them stops a refresh token this app can no
// longer use from sitting in a staff browser for good.
if (typeof localStorage !== 'undefined') {
    for (const storageKey of Object.keys(localStorage)) {
        if (/^sb-.+-auth-token/.test(storageKey)) localStorage.removeItem(storageKey)
    }
}
