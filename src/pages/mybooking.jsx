import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import './components/css/mybooking.css'
import Footer from '../components/footer'
import {
    useAccommodationDB,
    cancelBooking as dbCancelBooking,
    deleteBooking as dbDeleteBooking,
    addFoodOrder,
    addSpaOrder,
    findOrderableBooking,
    getBookingStage,
    bookingsPersistOnThisDevice,
    forgetMyBookings,
} from '../data/accommodationDB.js'

// Guest-facing view over the accommodation database. Everything lives in
// data/accommodationDB.js so a cancellation here immediately frees the unit's
// dates for the next guest and updates the admin Units board — there is only
// one copy of the data.
//
// This list is scoped to the browser that made the bookings. The database
// answers with the rows matching this device's owner token and nothing else,
// so a guest on another phone sees their own reservations here, never these.
export function useBookings(){
    const bookings = useAccommodationDB()

    return {
        bookings,
        cancelBooking: dbCancelBooking,
        deleteBooking: dbDeleteBooking,
        // Food/spa can only be added to a booking that has an uploaded
        // down-payment receipt on file. The most recent eligible booking
        // (bookings are stored newest-first) is the one an order attaches to.
        findOrderableBooking,
        addFoodOrderToBooking: addFoodOrder,
        addSpaOrderToBooking: addSpaOrder,
    }
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

// Defensive on purpose: this runs against fields that come back from the
// database, and one missing number used to take the whole page down with it.
function formatPeso(amount){
    return `₱${Number(amount ?? 0).toLocaleString('en-PH')}`
}

const STATUS_LABELS = {
    pending: 'For Verification',
    upcoming: 'Upcoming',
    active: 'Checked In',
    completed: 'Completed',
    cancelled: 'Cancelled',
}

function foodOrderSummary(booking){
    const orders = booking.foodOrders ?? []
    if (orders.length === 0) return 'none'
    return orders.map((order) => `${order.name} x${order.quantity}`).join(', ')
}

function foodOrderTotal(booking){
    return (booking.foodOrders ?? []).reduce((sum, order) => sum + order.total, 0)
}

function spaOrderSummary(booking){
    const orders = booking.spaOrders ?? []
    if (orders.length === 0) return 'none'
    return orders.map((order) => `${order.name} x${order.quantity}`).join(', ')
}

function spaOrderTotal(booking){
    return (booking.spaOrders ?? []).reduce((sum, order) => sum + order.total, 0)
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
    const status = getBookingStage(booking)
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
                    <p className="booking-card-id">
                        {/* The CBL-… code is the human reference; `id` is the
                            database uuid and never shown to guests. */}
                        Booking ID: {booking.code ?? booking.id}
                        {/* The exact unit held for these hours, assigned by the
                            database when the booking was made. */}
                        {booking.unitId ? ` • Unit ${booking.unitId}` : ''}
                    </p>
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
                        {booking.kids > 0 && (
                            <p className="field-sub">{booking.kids} kids (7 &amp; below, no entrance fee)</p>
                        )}
                        {booking.seniors > 0 && (
                            <p className="field-sub">{booking.seniors} senior citizens (10% off, ID required)</p>
                        )}
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

                {booking.entrance?.total > 0 && (
                    <div className="booking-card-field">
                        <span className="field-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
                                <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
                                <path d="M9 12h6" />
                            </svg>
                        </span>
                        <div>
                            <p className="field-label">Entrance Fee</p>
                            <p className="field-value">{formatPeso(booking.entrance.total)}</p>
                            <p className="field-sub">
                                {formatPeso(booking.entrance.perHead)}/head, paid on-site
                                {booking.entrance.freeApplied > 0
                                    ? ` • free entrance (${booking.entrance.freeApplied} pax) −${formatPeso(booking.entrance.freeSavings)}`
                                    : ''}
                                {booking.entrance.seniorDiscount > 0
                                    ? ` • senior discount −${formatPeso(booking.entrance.seniorDiscount)}`
                                    : ''}
                            </p>
                        </div>
                    </div>
                )}
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
                        Schedule: {booking.schedule?.description ?? 'none'} • Spa: {spaOrderSummary(booking)} • Food: {foodOrderSummary(booking)}
                    </p>
                    {booking.spaOrders?.length > 0 && (
                        <p className="field-sub">Spa total: {formatPeso(spaOrderTotal(booking))}</p>
                    )}
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
    const { bookings, cancelBooking, deleteBooking } = useBookings()
    const [error, setError] = useState(null)
    // False in a private window that blocks localStorage: the reservation is
    // real and staff have it, but this tab is the only thing holding the key
    // to the list. Better to say so than to let it vanish unexplained.
    const persistent = bookingsPersistOnThisDevice()

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }, [])

    // Cancelling and clearing are database writes that the database can refuse
    // — a stay that has already ended, or a booking that isn't this device's.
    // Both used to be assumed to work; now the guest is told when they don't.
    async function handleCancel(id){
        setError(null)
        const result = await cancelBooking(id)
        if (result && !result.ok) setError(result.message)
    }

    async function handleDelete(id){
        setError(null)
        const result = await deleteBooking(id)
        if (result && !result.ok) setError(result.message)
    }

    async function handleForget(){
        setError(null)
        await forgetMyBookings()
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
                    <p className="my-booking-privacy">
                        Only the bookings made on this device appear here. Open the site on
                        another phone or browser and you will see that device&apos;s bookings
                        instead — your details are never shown to another guest.
                    </p>
                    {!persistent && (
                        <p className="my-booking-warning" role="status">
                            This browser is not saving anything, so this list will be empty when
                            you come back. Keep your booking ID — staff can find your reservation
                            with it.
                        </p>
                    )}
                </header>

                {error && (
                    <p className="my-booking-error" role="alert">{error}</p>
                )}

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

                        {/* For a shared or borrowed phone: drop this device's key
                            to the list. The reservations stay with the resort. */}
                        <button
                            type="button"
                            className="my-booking-forget"
                            onClick={handleForget}
                        >
                            Not your bookings? Clear them from this device
                        </button>
                    </>
                )}
            </div>

            <Footer />
        </main>
    )
}

export default MyBooking
