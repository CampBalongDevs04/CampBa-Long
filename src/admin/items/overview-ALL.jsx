import '../css/booking-tabs.css'

/*
 * Booking panel for the "All" tab (id: 'all' in tab.jsx).
 *
 * HOW IT WORKS:
 * 1. `bookings` is an empty array for now (no database yet).
 * 2. Empty array  -> shows the "No bookings yet" message.
 * 3. Has items    -> lists one card per booking.
 *
 * HOW TO REUSE FOR OTHER TAB IDS (upcomming, active, completed...):
 * copy this file, rename the component (e.g. Upcomming),
 * and later filter the bookings by status before rendering.
 */

const bookings = [] // TODO: replace with database data later

export default function All() {
    // Empty state — shown while there is no booking data
    if (bookings.length === 0) {
        return (
            <div className="booking-panel">
                <div className="booking-empty">
                    <svg
                        className="booking-empty-icon"
                        viewBox="0 0 24 24"
                        width="44"
                        height="44"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <h3 className="booking-empty-title">No bookings yet</h3>
                    <p className="booking-empty-text">
                        New reservations will appear here once guests start booking.
                    </p>
                </div>
            </div>
        )
    }

    // List state — runs once bookings has data
    return (
        <div className="booking-panel">
            {bookings.map((booking) => (
                <div key={booking.id} className="booking-card">
                    {booking.guestName}
                </div>
            ))}
        </div>
    )
}
