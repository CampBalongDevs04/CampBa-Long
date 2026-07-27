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

if (!isSupabaseConfigured) {
    console.error(
        '[Camp Ba-long] Supabase is not configured, so bookings and availability ' +
        'will not work.\n' +
        'Fix: copy .env.example to .env and fill in VITE_SUPABASE_URL and ' +
        'VITE_SUPABASE_PUBLISHABLE_KEY, then restart the dev server. ' +
        'For a deployed build, set the same two variables in your hosting ' +
        'provider and redeploy.',
    )
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
            persistSession: true,
            autoRefreshToken: true,
        },
    },
)
