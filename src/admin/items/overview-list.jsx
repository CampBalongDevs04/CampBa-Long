import { useState } from 'react'
import '../css/booking-tabs.css'
import ReceiptViewer from './receiptViewer'
import {
    useAccommodationDB,
    useBookingGroups,
    listBookings,
    getBookingStage,
    formatShortDate,
    groupUnitsLabel,
} from '../../data/accommodationDB.js'
import useBookingDecision from './bookingDecision'

// Shared panel behind every overview tab (All / Upcomming / Active /
// Completed / Paid Full / Down Payment). Each tab is just this component with
// a different `filter`, so they all read the one accommodation database and
// can never drift apart.

const STAGE_LABEL = {
    pending: 'For Verification',
    upcoming: 'Upcomming',
    active: 'Active',
    completed: 'Completed',
    cancelled: 'Cancelled',
}

const PAYMENT_LABEL = {
    'paid-full': 'Paid Full',
    'down-payment': 'Down Payment',
    unpaid: 'Unpaid',
}

function stayLabel(booking) {
    const from = formatShortDate(booking.checkIn)
    const to = formatShortDate(booking.checkOut)
    const dates = from === to ? from : `${from} – ${to}`
    return booking.schedule ? `${dates} · ${booking.schedule.time}` : dates
}

function orderTotal(orders) {
    return (orders ?? []).reduce((sum, order) => sum + order.total, 0)
}

export default function OverviewList({ filter = 'all', emptyTitle, emptyText }) {
    useAccommodationDB()
    // listBookings() reads combined reservations too — see the comment in
    // units.jsx on why this needs its own subscription, not just the one above.
    useBookingGroups()
    const bookings = listBookings(filter)
    // Held by id so the open lightbox tracks the live row (see bookingsManage).
    const [reviewingId, setReviewingId] = useState(null)
    const reviewing = bookings.find((booking) => booking.id === reviewingId) ?? null
    // The same Approve / Reject the Bookings tab uses — the guest is emailed
    // and the popup says whether it reached them. This screen used to call
    // confirmBooking() straight from the lightbox footer, so an approval made
    // here told the guest nothing at all.
    const { approve, reject, decisionModal } = useBookingDecision()

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
                    <h3 className="booking-empty-title">{emptyTitle}</h3>
                    <p className="booking-empty-text">{emptyText}</p>
                </div>

                {/* Also here, not only in the list below: approving the last
                    row of a filtered tab empties the list, and this component
                    returns the empty state in the same render that sets the
                    result. Left out, the popup reporting whether the guest was
                    emailed would be unmounted before it ever appeared — on
                    exactly the approval staff were watching. */}
                {decisionModal}
            </div>
        )
    }

    return (
        <div className="booking-panel">
            {bookings.map((booking) => {
                const stage = getBookingStage(booking)
                const foodTotal = orderTotal(booking.foodOrders)
                const spaTotal = orderTotal(booking.spaOrders)
                // The amount shown must match the label beside it — a
                // "Down Payment" row showing the full price is misleading.
                // A paid-full booking reads `stayTotal` (the whole stay, not
                // just the unit rate — see fromRow()), discounted down to
                // `settlementCollected` if a senior/PWD/kids discount was
                // honored at settlement (settleBookingPayment()).
                const displayAmount =
                    booking.payment === 'down-payment' && booking.downpayment != null
                        ? booking.downpayment
                        : booking.settlementCollected ?? booking.stayTotal ?? booking.total
                return (
                    <div key={booking.id} className="booking-card">
                        <div className="booking-row-top">
                            <span className="booking-row-guest">
                                {booking.guest?.fullName || 'Guest'}
                            </span>
                            <span className={`booking-row-stage stage-${stage}`}>
                                {STAGE_LABEL[stage] ?? stage}
                            </span>
                        </div>
                        <p className="booking-row-meta">
                            {booking.isGroup
                                ? (groupUnitsLabel(booking.units) || 'Combined reservation')
                                : `${booking.accomodationName}${booking.unitId ? ` · ${booking.unitId}` : ''}`}
                            {' '}— {stayLabel(booking)}
                        </p>
                        <p className="booking-row-meta booking-row-sub">
                            {booking.code ?? booking.id} · {PAYMENT_LABEL[booking.payment] ?? booking.payment}
                            {displayAmount != null ? ` · ₱${Number(displayAmount).toLocaleString()}` : ''}
                            {foodTotal > 0 ? ` · Food: ₱${foodTotal.toLocaleString()}` : ''}
                            {spaTotal > 0 ? ` · Spa: ₱${spaTotal.toLocaleString()}` : ''}
                        </p>

                        {/* The uploaded proof of payment, opened right where the
                            stay is being reviewed. */}
                        {booking.receiptPath && (
                            <button
                                type="button"
                                className="booking-row-receipt"
                                onClick={() => setReviewingId(booking.id)}
                            >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12Z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                                View receipt
                            </button>
                        )}
                    </div>
                )
            })}

            {reviewing && (
                <ReceiptViewer
                    key={reviewing.id}
                    booking={reviewing}
                    onClose={() => setReviewingId(null)}
                    onApprove={approve}
                    onCancel={reject}
                />
            )}

            {decisionModal}
        </div>
    )
}
