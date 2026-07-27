import { useMemo, useState } from 'react'
import '../css/bookings-manage.css'
import ReceiptViewer from './receiptViewer'
import {
    useAccommodationDB,
    getBookingStage,
    confirmBooking,
    markBookingPaidFull,
    cancelBooking,
} from '../../data/accommodationDB.js'

// Rows come straight from the accommodation database — the same records the
// booking page writes. Approving one here flips it to "upcoming" for the
// guest; cancelling releases the unit's dates back into availability.

const STATUS_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'For Verification' },
    { id: 'upcomming', label: 'Upcomming' },
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Completed' },
]

const STATUS_BADGE = {
    pending: { label: 'For Verification', className: 'is-pending' },
    upcoming: { label: 'Upcomming', className: 'is-upcomming' },
    active: { label: 'Active', className: 'is-active' },
    completed: { label: 'Completed', className: 'is-completed' },
    cancelled: { label: 'Cancelled', className: 'is-cancelled' },
}

const PAYMENT_BADGE = {
    'paid-full': { label: 'Paid Full', className: 'is-paid' },
    'down-payment': { label: 'Down Payment', className: 'is-dp' },
    unpaid: { label: 'Unpaid', className: 'is-unpaid' },
}

function formatDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

function formatRange(booking) {
    const from = formatDate(booking.checkIn)
    const to = formatDate(booking.checkOut)
    return from === to ? from : `${from} → ${to}`
}

// The unit the database assigned, e.g. "A-House Small · AHS-02". Tent pitching
// has no unit to assign, so it falls back to the type name alone.
function unitLabel(booking) {
    if (!booking.unitId) return booking.accomodationName
    return `${booking.accomodationName} · ${booking.unitId}`
}

export default function BookingsManage() {
    const bookings = useAccommodationDB()
    const [filter, setFilter] = useState('all')
    const [query, setQuery] = useState('')
    // The receipt under review, held by id rather than by object so the open
    // lightbox follows the live row — approving it there repaints the footer
    // instead of leaving a stale Approve button behind.
    const [reviewingId, setReviewingId] = useState(null)

    const rows = useMemo(
        () => bookings.map((booking) => ({ ...booking, stage: getBookingStage(booking) })),
        [bookings],
    )

    const reviewing = rows.find((b) => b.id === reviewingId) ?? null

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase()
        return rows.filter((b) => {
            const matchesFilter =
                filter === 'all' ||
                (filter === 'upcomming' ? b.stage === 'upcoming' : b.stage === filter)
            const matchesQuery =
                q === '' ||
                (b.guest?.fullName ?? '').toLowerCase().includes(q) ||
                (b.code ?? '').toLowerCase().includes(q) ||
                unitLabel(b).toLowerCase().includes(q)
            return matchesFilter && matchesQuery
        })
    }, [rows, filter, query])

    const countFor = (id) => {
        if (id === 'all') return rows.length
        const stage = id === 'upcomming' ? 'upcoming' : id
        return rows.filter((b) => b.stage === stage).length
    }

    return (
        <div className="bookings-manage">
            <div className="bookings-toolbar">
                <div className="bookings-search">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="7" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="search"
                        placeholder="Search guest, booking ID, or unit…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Search bookings"
                    />
                </div>

                <div className="bookings-filters" role="tablist" aria-label="Filter by status">
                    {STATUS_FILTERS.map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={filter === id}
                            className={filter === id ? 'bookings-filter active' : 'bookings-filter'}
                            onClick={() => setFilter(id)}
                        >
                            {label}
                            <span className="bookings-filter-count">{countFor(id)}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="bookings-panel">
                {visible.length === 0 ? (
                    <div className="bookings-empty">
                        <svg
                            className="bookings-empty-icon"
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
                        <h3 className="bookings-empty-title">No bookings found</h3>
                        <p className="bookings-empty-text">
                            {query || filter !== 'all'
                                ? 'Try a different search or status filter.'
                                : 'New reservations will appear here once guests start booking.'}
                        </p>
                    </div>
                ) : (
                    <div className="bookings-table-wrap">
                        <table className="bookings-table">
                            <thead>
                                <tr>
                                    <th>Booking ID</th>
                                    <th>Guest</th>
                                    <th>Unit</th>
                                    <th>Stay</th>
                                    <th>Schedule</th>
                                    <th>Payment</th>
                                    <th>Receipt</th>
                                    <th>Status</th>
                                    <th className="col-total">Total</th>
                                    <th className="col-actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((b) => {
                                    const status = STATUS_BADGE[b.stage] || {}
                                    const payment = PAYMENT_BADGE[b.payment] || {}
                                    return (
                                        <tr key={b.id}>
                                            {/* Staff quote the CBL-… code to guests, not the uuid. */}
                                            <td className="col-id">{b.code ?? b.id}</td>
                                            <td>{b.guest?.fullName || '—'}</td>
                                            <td>{unitLabel(b)}</td>
                                            <td>{formatRange(b)}</td>
                                            <td>{b.schedule?.time ?? '—'}</td>
                                            <td>
                                                <span className={`bookings-badge ${payment.className || ''}`}>
                                                    {payment.label || b.payment}
                                                </span>
                                            </td>
                                            {/* Proof of payment. The image has to be
                                                read before Approve is pressed, so the
                                                button sits in its own column rather
                                                than among the row actions. */}
                                            <td className="col-receipt">
                                                {b.receiptPath ? (
                                                    <button
                                                        type="button"
                                                        className="bookings-action bookings-action-receipt"
                                                        onClick={() => setReviewingId(b.id)}
                                                    >
                                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                            <path d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12Z" />
                                                            <circle cx="12" cy="12" r="3" />
                                                        </svg>
                                                        View
                                                    </button>
                                                ) : b.hasReceipt ? (
                                                    /* Booked before receipt images were
                                                       kept — flagged, not hidden, so
                                                       staff know to ask the guest. */
                                                    <button
                                                        type="button"
                                                        className="bookings-action bookings-action-receipt is-missing"
                                                        onClick={() => setReviewingId(b.id)}
                                                    >
                                                        No image
                                                    </button>
                                                ) : (
                                                    <span className="bookings-receipt-none">None</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`bookings-badge ${status.className || ''}`}>
                                                    {status.label || b.stage}
                                                </span>
                                            </td>
                                            <td className="col-total">₱{Number(b.total ?? 0).toLocaleString()}</td>
                                            <td className="col-actions">
                                                {/* Verifying the receipt turns the hold into a
                                                    confirmed stay on the guest's side — so when
                                                    there is an image to check, this opens it and
                                                    Approve lives inside the viewer. Approving
                                                    without looking is the one thing this screen
                                                    should not make easy. */}
                                                {b.stage === 'pending' && (
                                                    <button
                                                        type="button"
                                                        className="bookings-action"
                                                        onClick={() =>
                                                            b.receiptPath
                                                                ? setReviewingId(b.id)
                                                                : confirmBooking(b.id)
                                                        }
                                                    >
                                                        {b.receiptPath ? 'Review' : 'Approve'}
                                                    </button>
                                                )}
                                                {b.stage !== 'cancelled' && b.payment !== 'paid-full' && (
                                                    <button
                                                        type="button"
                                                        className="bookings-action"
                                                        onClick={() => markBookingPaidFull(b.id)}
                                                    >
                                                        Mark Paid
                                                    </button>
                                                )}
                                                {b.stage !== 'cancelled' && b.stage !== 'completed' && (
                                                    <button
                                                        type="button"
                                                        className="bookings-action bookings-action-danger"
                                                        onClick={() => cancelBooking(b.id)}
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Mounted per booking: a fresh mount is what re-mints the
                short-lived signed URL for the image. */}
            {reviewing && (
                <ReceiptViewer
                    key={reviewing.id}
                    booking={reviewing}
                    onClose={() => setReviewingId(null)}
                    onApprove={(booking) => confirmBooking(booking.id)}
                    onCancel={(booking) => cancelBooking(booking.id)}
                />
            )}
        </div>
    )
}
