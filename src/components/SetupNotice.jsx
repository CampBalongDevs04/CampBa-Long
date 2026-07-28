import './css/setup-notice.css'
import { isSupabaseConfigured, SUPABASE_SETUP_MESSAGE } from '../lib/supabaseClient.js'

// Shown across the top of every page when the Supabase keys are missing.
//
// Why this exists: without keys the site still LOOKS healthy. The catalog
// falls back to the built-in accommodation list, the booking form renders in
// full, and nothing on screen says anything is wrong — the only signal is a
// console error nobody has open. The first visible symptom lands five steps
// later, when the receipt upload dies with a bare "Failed to fetch", which
// reads like a broken storage bucket rather than a missing .env. A fresh clone
// should say so on the first paint instead.
//
// It renders on the admin dashboard too. Staff seeing "not connected" is far
// better than staff seeing an empty bookings table and assuming there are no
// bookings.
export default function SetupNotice() {
    if (isSupabaseConfigured) return null

    return (
        <div className="setup-notice" role="alert">
            <strong className="setup-notice-title">Not connected to the database</strong>
            <span className="setup-notice-body">{SUPABASE_SETUP_MESSAGE}</span>
        </div>
    )
}
