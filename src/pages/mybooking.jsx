import { Link } from 'react-router'
import './components/css/mybooking.css'

function MyBooking() {
    return (
        <main className="page my-booking-page">
            <div className="my-booking-shell">
                <header className="my-booking-hero">
                    <p className="my-booking-eyebrow">Camp Ba-long Reservations</p>
                    <h1 className="my-booking-title">My Bookings</h1>
                    <p className="my-booking-tagline">
                        Review your reservation history and manage upcoming stays.
                    </p>
                </header>

                <section className="my-booking-empty" aria-live="polite">
                    <div className="my-booking-empty-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="6" width="18" height="15" rx="2.5" />
                            <path d="M8 3v5M16 3v5M3 11h18" />
                            <path d="M9 15.5l2 2 4-4" />
                        </svg>
                    </div>
                    <h2 className="my-booking-empty-title">No Booking Receipts Found</h2>
                    <p className="my-booking-empty-text">
                        You currently have no confirmed or pending reservations on file.
                        Once you complete a booking, its details and receipt will appear
                        here for your records.
                    </p>
                    <Link to="/booking" className="my-booking-empty-cta">
                        Browse Accommodations
                    </Link>
                </section>
            </div>
        </main>
    )
}

export default MyBooking
