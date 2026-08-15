import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import './components/css/mybooking.css'
import Footer from '../components/footer'
import Seo from '../components/Seo.jsx'
import BookingPayment from './components/bookingPayment.jsx'
import { saveReceiptImage } from './components/receiptImage.js'
import { useBookings } from '../data/useBookings.js'
import {
    getBookingStage,
    bookingsPersistOnThisDevice,
    forgetMyBookings,
    wasCancelledByPaymentTimeout,
    canGuestCancel,
    hasPaidSomething,
    PAYMENT_WINDOW_MINUTES,
    useMyBookingGroups,
    cancelBookingGroup,
    deleteBookingGroup,
    payBookingGroup,
    groupUnitCounts,
} from '../data/accommodationDB.js'
import { splitFreeEntrance } from '../data/entranceFee.js'
import { countNights } from '../data/extendedStay.js'
import { useMyBookingPage, fillTokens, unitTokens } from '../data/myBookingPage.js'

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

// What stands where the Cancel button used to, on a booking that can no longer
// be called off from here. Two different facts, and a guest is owed whichever
// one applies:
//
//   • The down payment is already with the resort. Cancelling from a phone
//     would release the unit while the money is still held against a stay that
//     no longer exists, so this one goes through a person — which is what
//     "Cancellation is no longer allowed once the down payment has been made"
//     on the booking page has always meant.
//   • The stay is simply over.
//
// Said out loud rather than left as a gap. A button that quietly disappears
// reads as a page that failed to load, and the guest's next move — message the
// resort — is exactly what an empty space cannot tell them.
function NoCancelNote({ booking, thing }){
    return (
        <p className="booking-card-nocancel" role="note">
            {hasPaidSomething(booking)
                ? `Your down payment is with us, so this ${thing} can no longer be cancelled`
                  + ' here. Message the resort if you need to change it.'
                : 'This stay is over, so it can no longer be cancelled.'}
        </p>
    )
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

function itemOrderSummary(booking){
    const orders = booking.itemOrders ?? []
    if (orders.length === 0) return 'none'
    return orders.map((order) => `${order.name} x${order.quantity}`).join(', ')
}

function itemOrderTotal(booking){
    return (booking.itemOrders ?? []).reduce((sum, order) => sum + order.total, 0)
}

// How many nights this booking was BILLED for — the same count the booking page
// multiplied the rates by, recovered from the two dates the row stores.
function stayNights(booking){
    if (booking.sameDayCheckout) return 1
    return Math.max(1, countNights(booking.checkIn, booking.checkOut))
}

function stayLabel(booking){
    if (booking.sameDayCheckout) return '1 day use'
    if (!booking.checkIn || !booking.checkOut) return 'Stay length TBA'
    const nights = stayNights(booking)
    return `${nights} night${nights > 1 ? 's' : ''} stay`
}

// `entrance.perHead` is stored as what one full-fare head owes FOR THE WHOLE
// STAY (the nightly rate already multiplied by the nights — see
// data/extendedStay.js). On a one-night booking that is the nightly rate and
// needs no explaining; on a longer one, "₱1,050/head" only makes sense with
// the nights it covers said next to it.
function perHeadLabel(booking, formatted){
    const nights = stayNights(booking)
    return nights > 1 ? `${formatted}/head for ${nights} nights` : `${formatted}/head`
}

function BookingCard({ booking, onCancel, onBookAgain, onDelete, onSaveReceipt, payNow }){
    const { page: copy } = useMyBookingPage()
    const status = getBookingStage(booking)
    const { start, end } = splitTimes(booking.schedule)
    const paymentKnown = booking.downpayment != null
    const outstanding = Math.max(
        0,
        Math.round(((booking.downpayment ?? 0) - (booking.paidSubmitted ?? 0)) * 100) / 100,
    )
    // Cancelled by the clock, not by anyone. Worth distinguishing on the card:
    // a guest looking at "Cancelled" on a stay they still want needs to be told
    // that nothing went wrong with their booking and they can simply make it
    // again — not left to guess whether the resort turned them away.
    const timedOut = wasCancelledByPaymentTimeout(booking)

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
                        {/* No percentage on the line below, on purpose. This card
                            shows a booking that was priced when it was made, and
                            the senior rate can change afterwards — quoting today's
                            rate against an older booking would describe it
                            wrongly. What that booking actually got is the peso
                            figure in the entrance breakdown further down, which is
                            stored on the row itself. */}
                        {booking.seniors > 0 && (
                            <p className="field-sub">{booking.seniors} senior citizens — discount claimed at the resort, bring a valid ID</p>
                        )}
                        {booking.pwd > 0 && (
                            <p className="field-sub">{booking.pwd} PWD guests — discount claimed at the resort, bring a valid PWD ID</p>
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
                        <p className="field-label">Down payment (50%)</p>
                        <p className="field-value">
                            {paymentKnown ? formatPeso(booking.downpayment) : 'Price TBA'}
                        </p>
                        <p className="field-sub">
                            {outstanding > 0
                                ? `${formatPeso(outstanding)} still due`
                                : booking.hasReceipt
                                    ? 'receipt submitted'
                                    : 'pending'}
                        </p>
                    </div>
                </div>

                {booking.entrance?.total > 0 && (() => {
                    const { kidsApplied, kidsFree, perkApplied, perkSavings } = splitFreeEntrance({
                        freeApplied: booking.entrance.freeApplied,
                        freeSavings: booking.entrance.freeSavings,
                        kids: booking.kids,
                        perHead: booking.entrance.perHead,
                    })
                    return (
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
                                    {perHeadLabel(booking, formatPeso(booking.entrance.perHead))}, half prepaid
                                    {kidsApplied > 0
                                        ? ` • free entrance (${kidsApplied} pax, kids 7 & below) −${formatPeso(kidsFree)}`
                                        : ''}
                                    {perkApplied > 0
                                        ? ` • free entrance (${perkApplied} pax, resort inclusion) −${formatPeso(perkSavings)}`
                                        : ''}
                                    {booking.entrance.seniorDiscount > 0
                                        ? ` • senior discount −${formatPeso(booking.entrance.seniorDiscount)}`
                                        : ''}
                                </p>
                            </div>
                        </div>
                    )
                })()}
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
                        {booking.stayTotal ? ` • ${formatPeso(booking.stayTotal)} total` : ''}
                    </p>
                    <p className="field-sub">Payment: Down Payment</p>
                    <p className="field-sub">
                        Schedule: {booking.schedule?.description ?? 'none'} • Spa: {spaOrderSummary(booking)} • Food: {foodOrderSummary(booking)} • Add-ons: {itemOrderSummary(booking)}
                    </p>
                    {booking.spaOrders?.length > 0 && (
                        <p className="field-sub">Spa total: {formatPeso(spaOrderTotal(booking))}</p>
                    )}
                    {booking.foodOrders?.length > 0 && (
                        <p className="field-sub">Food total: {formatPeso(foodOrderTotal(booking))}</p>
                    )}
                    {booking.itemOrders?.length > 0 && (
                        <p className="field-sub">Add-ons total: {formatPeso(itemOrderTotal(booking))}</p>
                    )}
                </div>
            </div>

            {/* The payment panel renders nothing on a cancelled booking, so the
                explanation for THIS cancellation goes in its place. */}
            {timedOut && (
                <div className="booking-card-timeout" role="status">
                    <span className="booking-card-timeout-icon" aria-hidden="true">⏱</span>
                    <div>
                        <p className="booking-card-timeout-title">
                            Payment window closed — please try to book again
                        </p>
                        <p className="booking-card-timeout-text">
                            A unit is held for {PAYMENT_WINDOW_MINUTES} minutes while you
                            send the down payment. No receipt arrived in that time, so this
                            booking was cancelled automatically and{' '}
                            {booking.unitId ? `unit ${booking.unitId}` : 'the unit'} went
                            back to other guests. You were not charged anything.
                        </p>
                        <p className="booking-card-timeout-text">
                            Use <strong>Book Again</strong> below to start over — have your
                            GCash or bank app ready first, and upload the screenshot as soon
                            as the unit is reserved.
                        </p>
                    </div>
                </div>
            )}

            {/* The QR codes, the amount due and the receipt upload — moved here
                from the booking form, so paying happens against a unit that is
                already held rather than one that might be gone. */}
            <BookingPayment booking={booking} autoOpen={payNow} />

            <div className="booking-card-actions">
                {status === 'cancelled' ? (
                    <button
                        type="button"
                        className="booking-card-delete"
                        onClick={() => onDelete(booking.id)}
                    >
                        Delete Booking
                    </button>
                ) : canGuestCancel(booking) ? (
                    <button
                        type="button"
                        className="booking-card-cancel"
                        onClick={() => onCancel(booking.id)}
                    >
                        Cancel Booking
                    </button>
                ) : (
                    <NoCancelNote booking={booking} thing="booking" />
                )}
                <button
                    type="button"
                    className="booking-card-receipt"
                    onClick={() => onSaveReceipt(booking)}
                >
                    {copy.saveReceiptLabel}
                </button>
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

// A combined reservation's card — same shape as BookingCard, since it is the
// same lifecycle (held → paid → confirmed) and the same payment panel, just
// naming several units instead of one. Kept as its own component rather than
// branching inside BookingCard because so much of the "one unit" framing
// (the header's unit id, the singular accomodationName) has no single answer
// here — it reads better written straight through than threaded with ternaries.
function GroupBookingCard({ group, onCancel, onDelete, onSaveReceipt, payNow }){
    const { page: copy } = useMyBookingPage()
    const status = getBookingStage(group)
    const { start, end } = splitTimes(group.schedule)
    const outstanding = Math.max(
        0,
        Math.round(((group.downpayment ?? 0) - (group.paidSubmitted ?? 0)) * 100) / 100,
    )
    const timedOut = wasCancelledByPaymentTimeout(group)
    const counts = groupUnitCounts(group.units)
    const unitCount = group.units?.length ?? 0
    const accommodationLabel = counts
        .map((entry) => `${entry.name}${entry.qty > 1 ? ` ×${entry.qty}` : ''}`)
        .join(', ') || 'Combined Reservation'
    const releasedLabel = unitCount > 1 ? 'your units' : 'your unit'

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
                    <h3 className="booking-card-name">{accommodationLabel}</h3>
                    <p className="booking-card-id">
                        Booking ID: {group.code ?? group.id}
                        {' '}• {unitCount} unit{unitCount === 1 ? '' : 's'}
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
                        <p className="field-value">{formatDate(group.checkIn)}</p>
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
                        <p className="field-value">{formatDate(group.checkOut)}</p>
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
                        <p className="field-value">{group.guest?.fullName || 'Not provided'}</p>
                        {group.pax && <p className="field-sub">{group.pax} guests</p>}
                        {group.kids > 0 && (
                            <p className="field-sub">{group.kids} kids (7 &amp; below, no entrance fee)</p>
                        )}
                        {/* Same reasoning as the single-booking card: the rate
                            that priced this reservation is whatever it was on
                            the day, not today's. */}
                        {group.seniors > 0 && (
                            <p className="field-sub">{group.seniors} senior citizens — discount claimed at the resort, bring a valid ID</p>
                        )}
                        {group.pwd > 0 && (
                            <p className="field-sub">{group.pwd} PWD guests — discount claimed at the resort, bring a valid PWD ID</p>
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
                        <p className="field-label">Down payment (50%)</p>
                        <p className="field-value">
                            {group.downpayment != null ? formatPeso(group.downpayment) : 'Price TBA'}
                        </p>
                        <p className="field-sub">
                            {outstanding > 0
                                ? `${formatPeso(outstanding)} still due`
                                : group.hasReceipt
                                    ? 'receipt submitted'
                                    : 'pending'}
                        </p>
                    </div>
                </div>

                <div className="booking-card-field booking-card-field-stacked">
                    <p className="field-label">Units in this reservation</p>
                    {counts.map((entry) => (
                        <p className="field-value" key={entry.name}>
                            {entry.name}{entry.qty > 1 ? ` ×${entry.qty}` : ''}
                        </p>
                    ))}
                </div>

                {group.entrance?.total > 0 && (() => {
                    const { kidsApplied, kidsFree, perkApplied, perkSavings } = splitFreeEntrance({
                        freeApplied: group.entrance.freeApplied,
                        freeSavings: group.entrance.freeSavings,
                        kids: group.kids,
                        perHead: group.entrance.perHead,
                    })
                    return (
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
                                <p className="field-value">{formatPeso(group.entrance.total)}</p>
                                <p className="field-sub">
                                    {perHeadLabel(group, formatPeso(group.entrance.perHead))}, half prepaid
                                    {kidsApplied > 0
                                        ? ` • free entrance (${kidsApplied} pax, kids 7 & below) −${formatPeso(kidsFree)}`
                                        : ''}
                                    {perkApplied > 0
                                        ? ` • free entrance (${perkApplied} pax, resort inclusion) −${formatPeso(perkSavings)}`
                                        : ''}
                                    {group.entrance.seniorDiscount > 0
                                        ? ` • senior discount −${formatPeso(group.entrance.seniorDiscount)}`
                                        : ''}
                                </p>
                            </div>
                        </div>
                    )
                })()}
            </div>

            <div className="booking-card-divider" />

            <div className="booking-card-grid booking-card-grid-secondary">
                <div className="booking-card-field booking-card-field-stacked">
                    <p className="field-label">Contact Information</p>
                    <p className="field-value">{group.guest?.email || 'Not provided'}</p>
                    <p className="field-value">{group.guest?.mobile || 'Not provided'}</p>
                </div>

                <div className="booking-card-field booking-card-field-stacked">
                    <p className="field-label">Booking Summary</p>
                    <p className="field-value">
                        {stayLabel(group)}
                        {group.stayTotal ? ` • ${formatPeso(group.stayTotal)} total` : ''}
                    </p>
                    <p className="field-sub">Payment: Down Payment</p>
                    <p className="field-sub">
                        Schedule: {group.schedule?.description ?? 'none'} • Spa: {spaOrderSummary(group)} • Food: {foodOrderSummary(group)} • Add-ons: {itemOrderSummary(group)}
                    </p>
                    {group.spaOrders?.length > 0 && (
                        <p className="field-sub">Spa total: {formatPeso(spaOrderTotal(group))}</p>
                    )}
                    {group.foodOrders?.length > 0 && (
                        <p className="field-sub">Food total: {formatPeso(foodOrderTotal(group))}</p>
                    )}
                    {group.itemOrders?.length > 0 && (
                        <p className="field-sub">Add-ons total: {formatPeso(itemOrderTotal(group))}</p>
                    )}
                </div>
            </div>

            {timedOut && (
                <div className="booking-card-timeout" role="status">
                    <span className="booking-card-timeout-icon" aria-hidden="true">⏱</span>
                    <div>
                        <p className="booking-card-timeout-title">
                            Payment window closed — please try to book again
                        </p>
                        <p className="booking-card-timeout-text">
                            Every unit in this reservation is held for {PAYMENT_WINDOW_MINUTES} minutes
                            while you send the down payment. No receipt arrived in that time, so
                            this reservation was cancelled automatically and {releasedLabel} went
                            back to other guests. You were not charged anything.
                        </p>
                        <p className="booking-card-timeout-text">
                            Start a new cart below to book again — have your GCash or bank app
                            ready first, and upload the screenshot as soon as it's reserved.
                        </p>
                    </div>
                </div>
            )}

            <BookingPayment
                booking={group}
                autoOpen={payNow}
                onPay={payBookingGroup}
                accommodationLabel={accommodationLabel}
                releasedLabel={releasedLabel}
            />

            <div className="booking-card-actions">
                {status === 'cancelled' ? (
                    <button
                        type="button"
                        className="booking-card-delete"
                        onClick={() => onDelete(group.id)}
                    >
                        Delete Booking
                    </button>
                ) : canGuestCancel(group) ? (
                    <button
                        type="button"
                        className="booking-card-cancel"
                        onClick={() => onCancel(group.id)}
                    >
                        Cancel Reservation
                    </button>
                ) : (
                    <NoCancelNote booking={group} thing="reservation" />
                )}
                <button
                    type="button"
                    className="booking-card-receipt"
                    onClick={() => onSaveReceipt(group)}
                >
                    {copy.saveReceiptLabel}
                </button>
            </div>
        </article>
    )
}

function MyBooking() {
    const navigate = useNavigate()
    const location = useLocation()
    const { bookings, cancelBooking, deleteBooking } = useBookings()
    const groups = useMyBookingGroups()
    // Everything a guest reads on this page that is not their own booking —
    // edited in CMS → My Booking (data/myBookingPage.js).
    const { page: copy } = useMyBookingPage()
    const [error, setError] = useState(null)
    // False in a private window that blocks localStorage: the reservation is
    // real and staff have it, but this tab is the only thing holding the key
    // to the list. Better to say so than to let it vanish unexplained.
    const persistent = bookingsPersistOnThisDevice()

    // Single-unit and combined reservations interleaved, newest first — one
    // list to a guest who booked some of each, not two separate ones to
    // reconcile by eye. Each row already knows which kind it is (`isGroup`).
    const entries = [...bookings, ...groups].sort(
        (a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0)
    )

    // Set when the guest arrives straight from a completed booking — a
    // 'CBL-…' code from bookings, or a 'CBG-…' one from groups.
    const justBooked = location.state?.justBooked
        ? bookings.find((booking) => booking.code === location.state.justBooked)
            ?? groups.find((group) => group.code === location.state.justBooked)
        : null
    // The booking form sends the guest here TO PAY, so that one card's payment
    // panel opens itself. Only that card: opening every panel on a list of past
    // stays would bury the one reservation this visit is about.
    const payNowId = location.state?.payNow ? justBooked?.id : null

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

    // Same two writes, for a combined reservation.
    async function handleCancelGroup(id){
        setError(null)
        const result = await cancelBookingGroup(id)
        if (result && !result.ok) setError(result.message)
    }

    async function handleDeleteGroup(id){
        setError(null)
        const result = await deleteBookingGroup(id)
        if (result && !result.ok) setError(result.message)
    }

    async function handleForget(){
        setError(null)
        await forgetMyBookings()
    }

    function handleBookAgain(booking){
        navigate('/booking', { state: { accomodationId: booking.accomodationId } })
    }

    // Draws the booking as a PNG and hands it to the browser's downloader.
    // Nothing leaves the device: the image is built from the row already on
    // screen, so this works with no signal at the resort's gate.
    async function handleSaveReceipt(booking){
        setError(null)
        const result = await saveReceiptImage(
            booking,
            STATUS_LABELS[getBookingStage(booking)],
        )
        if (!result.ok) setError(result.message)
    }

    return (
        <>
        <Seo path="/my-booking" />
        <main className="page my-booking-page">
            <div className="my-booking-shell">
                <header className="my-booking-hero">
                    {copy.eyebrow && <p className="my-booking-eyebrow">{copy.eyebrow}</p>}
                    <h1 className="my-booking-title">{copy.title}</h1>
                    {copy.tagline && <p className="my-booking-tagline">{copy.tagline}</p>}
                    {copy.privacyNote && (
                        <p className="my-booking-privacy">{copy.privacyNote}</p>
                    )}
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

                {justBooked && (() => {
                    /* One panel, two things it can be saying. `payNowId` is set
                       only when the guest arrived here to pay, so that version
                       is about a running clock; otherwise the money is already
                       in and the panel is about keeping the receipt.

                       The wording of both is staff's (CMS → My Booking → Save
                       Receipt Note). What the browser knows — the booking's
                       code, its down payment, the minutes on the hold, and
                       whether this is one unit or several — goes in as tokens,
                       because those change per booking and cannot be typed. */
                    const tokens = {
                        code: justBooked.code,
                        amount: formatPeso(justBooked.downpayment),
                        minutes: PAYMENT_WINDOW_MINUTES,
                        ...unitTokens(justBooked.isGroup),
                    }
                    const title = payNowId ? copy.holdTitle : copy.savedTitle
                    const text = payNowId ? copy.holdText : copy.savedText

                    return (
                        <section className="my-booking-confirmed" role="status">
                            <p className="my-booking-confirmed-title">
                                {fillTokens(title, tokens)}
                            </p>
                            {text && (
                                <p className="my-booking-confirmed-text">
                                    {fillTokens(text, tokens)}
                                </p>
                            )}
                            <button
                                type="button"
                                className="my-booking-confirmed-save"
                                onClick={() => handleSaveReceipt(justBooked)}
                            >
                                {copy.saveReceiptLabel}
                            </button>
                        </section>
                    )
                })()}

                {entries.length === 0 ? (
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
                            {entries.map((entry) => (
                                entry.isGroup ? (
                                    <GroupBookingCard
                                        key={entry.id}
                                        group={entry}
                                        onCancel={handleCancelGroup}
                                        onDelete={handleDeleteGroup}
                                        onSaveReceipt={handleSaveReceipt}
                                        payNow={entry.id === payNowId}
                                    />
                                ) : (
                                    <BookingCard
                                        key={entry.id}
                                        booking={entry}
                                        onCancel={handleCancel}
                                        onBookAgain={handleBookAgain}
                                        onDelete={handleDelete}
                                        onSaveReceipt={handleSaveReceipt}
                                        payNow={entry.id === payNowId}
                                    />
                                )
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
        </>
    )
}

export default MyBooking
