import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import './components/css/mybooking.css'
import Footer from '../components/footer'

// Shared with booking.jsx — the key under which confirmed bookings are persisted.
const BOOKINGS_STORAGE_KEY = 'cbl-my-bookings'

function loadBookings(){
    try {
        return JSON.parse(localStorage.getItem(BOOKINGS_STORAGE_KEY) ?? '[]')
    } catch {
        return []
    }
}

function saveBookings(bookings){
    localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings))
}

function formatDate(iso){
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US')
}

/* Schedule times are stored as "10:00 AM - 5:00 PM" strings; split and
   convert each side to 24-hour clock for the compact card display. */
function splitTimes(schedule){
    if (!schedule?.time) return { start: null, end: null }
    const [start, end] = schedule.time.split('-').map((part) => part.trim())
    return { start: to24Hour(start), end: to24Hour(end) }
}

function to24Hour(label){
    if (!label) return null
    const parsed = new Date(`2000-01-01 ${label}`)
    if (Number.isNaN(parsed.getTime())) return label
    return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
}

function formatPeso(amount){
    return `₱${amount.toLocaleString('en-PH')}`
}

const STATUS_LABELS = {
    pending: 'For Verification',
    upcoming: 'Upcoming',
    completed: 'Completed',
    cancelled: 'Cancelled',
}

function getStatus(booking){
    if (booking.status === 'cancelled') return 'cancelled'
    if (booking.status !== 'upcoming') return 'pending'
    // Only a verified ("upcoming") booking can lapse into "completed" —
    // an unverified one stays "pending" even after its stay date passes.
    if (booking.checkOut && new Date(booking.checkOut).getTime() < Date.now()) return 'completed'
    return 'upcoming'
}

function foodOrderSummary(booking){
    const orders = booking.foodOrders ?? []
    if (orders.length === 0) return 'none'
    return orders.map((order) => `${order.name} x${order.quantity}`).join(', ')
}

function foodOrderTotal(booking){
    return (booking.foodOrders ?? []).reduce((sum, order) => sum + order.total, 0)
}

function stayLabel(booking){
    if (booking.sameDayCheckout) return '1 day use'
    if (!booking.checkIn || !booking.checkOut) return 'Stay length TBA'
    const nights = Math.max(1, Math.round(
        (new Date(booking.checkOut) - new Date(booking.checkIn)) / 86400000
    ))
    return `${nights} night${nights > 1 ? 's' : ''} stay`
}

function BookingCard({ booking, onCancel, onBookAgain, onDelete }){
    const status = getStatus(booking)
    const { start, end } = splitTimes(booking.schedule)
    const paymentKnown = booking.downpayment != null

    return (
        <article className="booking-card">
            <div className="booking-card-header">
                <div className="booking-card-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 11.5 12 4l8 7.5" />
                        <path d="M6 10v9.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10" />
                    </svg>
                </div>
                <div className="booking-card-heading">
                    <h3 className="booking-card-name">{booking.accomodationName}</h3>
                    <p className="booking-card-id">Booking ID: {booking.id}</p>
                </div>
                <span className={`booking-card-status status-${status}`}>
                    {STATUS_LABELS[status]}
                </span>
            </div>

            <div className="booking-card-grid">
                <div className="booking-card-field">
                    <span className="field-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="5" width="18" height="16" rx="2.5" />
                            <path d="M8 3v4M16 3v4M3 10h18" />
                        </svg>
                    </span>
                    <div>
                        <p className="field-label">Check-in</p>
                        <p className="field-value">{formatDate(booking.checkIn)}</p>
                        {start && <p className="field-sub">@{start}</p>}
                    </div>
                </div>

                <div className="booking-card-field">
                    <span className="field-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="5" width="18" height="16" rx="2.5" />
                            <path d="M8 3v4M16 3v4M3 10h18" />
                        </svg>
                    </span>
                    <div>
                        <p className="field-label">Check-out</p>
                        <p className="field-value">{formatDate(booking.checkOut)}</p>
                        {end && <p className="field-sub">@{end}</p>}
                    </div>
                </div>

                <div className="booking-card-field">
                    <span className="field-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="9" cy="8" r="3.2" />
                            <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
                            <circle cx="17" cy="8.5" r="2.4" />
                            <path d="M15.5 14.2c2.4.4 4 2.2 4 4.8" />
                        </svg>
                    </span>
                    <div>
                        <p className="field-label">Guest Details</p>
                        <p className="field-value">{booking.guest?.fullName || 'Not provided'}</p>
                        {booking.pax && <p className="field-sub">{booking.pax} guests</p>}
                    </div>
                </div>

                <div className="booking-card-field">
                    <span className="field-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="6" width="18" height="13" rx="2.2" />
                            <path d="M3 10.5h18" />
                            <path d="M7 15h4" />
                        </svg>
                    </span>
                    <div>
                        <p className="field-label">Payment</p>
                        <p className="field-value">
                            {paymentKnown ? formatPeso(booking.downpayment) : 'Price TBA'}
                        </p>
                        <p className="field-sub">{booking.hasReceipt ? 'paid' : 'pending'}</p>
                    </div>
                </div>
            </div>

            <div className="booking-card-divider" />

            <div className="booking-card-grid booking-card-grid-secondary">
                <div className="booking-card-field booking-card-field-stacked">
                    <p className="field-label">Contact Information</p>
                    <p className="field-value">{booking.guest?.email || 'Not provided'}</p>
                    <p className="field-value">{booking.guest?.mobile || 'Not provided'}</p>
                </div>

                <div className="booking-card-field booking-card-field-stacked">
                    <p className="field-label">Booking Summary</p>
                    <p className="field-value">
                        {stayLabel(booking)}
                        {paymentKnown ? ` • ${formatPeso(booking.downpayment)} total` : ''}
                    </p>
                    <p className="field-sub">Payment: Down Payment</p>
                    <p className="field-sub">
                        Schedule: {booking.schedule?.description ?? 'none'} • Spa: none • Food: {foodOrderSummary(booking)}
                    </p>
                    {booking.foodOrders?.length > 0 && (
                        <p className="field-sub">Food total: {formatPeso(foodOrderTotal(booking))}</p>
                    )}
                </div>
            </div>

            <div className="booking-card-actions">
                {status === 'cancelled' ? (
                    <button
                        type="button"
                        className="booking-card-delete"
                        onClick={() => onDelete(booking.id)}
                    >
                        Delete Booking
                    </button>
                ) : (
                    <button
                        type="button"
                        className="booking-card-cancel"
                        onClick={() => onCancel(booking.id)}
                        disabled={status === 'completed'}
                    >
                        Cancel Booking
                    </button>
                )}
                <button
                    type="button"
                    className="booking-card-again"
                    onClick={() => onBookAgain(booking)}
                >
                    Book Again
                </button>
            </div>
        </article>
    )
}

function MyBooking() {
    const navigate = useNavigate()
    const [bookings, setBookings] = useState(loadBookings)

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }, [])

    function handleCancel(id){
        setBookings((prev) => {
            const next = prev.map((booking) =>
                booking.id === id ? { ...booking, status: 'cancelled' } : booking
            )
            saveBookings(next)
            return next
        })
    }

    function handleDelete(id){
        setBookings((prev) => {
            const next = prev.filter((booking) => booking.id !== id)
            saveBookings(next)
            return next
        })
    }

    function handleBookAgain(booking){
        navigate('/booking', { state: { accomodationId: booking.accomodationId } })
    }

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

                {bookings.length === 0 ? (
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
                ) : (
                    <>
                        <div className="my-booking-list" aria-live="polite">
                            {bookings.map((booking) => (
                                <BookingCard
                                    key={booking.id}
                                    booking={booking}
                                    onCancel={handleCancel}
                                    onBookAgain={handleBookAgain}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>

                        <Link to="/booking" className="my-booking-browse-more">
                            Browse more accommodation
                        </Link>
                    </>
                )}
            </div>

            <Footer />
        </main>
    )
}

export default MyBooking
