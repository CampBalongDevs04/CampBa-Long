import { useEffect, useRef, useState } from 'react'
import './css/bookingPayment.css'
import Payment from './payment.jsx'
import PaymentCountdown from './paymentCountdown.jsx'
import { formatCountdown, usePaymentWindow } from './usePaymentWindow.js'
import { payBooking, getBookingStage, DOWNPAYMENT_RATE } from '../../data/accommodationDB.js'
import { countNights } from '../../data/extendedStay.js'
import { useMyBookingPage, fillTokens } from '../../data/myBookingPage.js'

// The payment panel inside a My Bookings card. Paying used to be step 4 of the
// booking form, before the reservation existed; it lives here now, next to the
// receipt the guest can save, because two things follow from the unit being held
// first:
//
//   • the guest is paying against a REAL booking, so the amount can include the
//     food and spa they have ordered against it;
//   • the figure is whatever the database says it is right now. It is not
//     recomputed here — bookings.downpayment is a generated column — so this
//     panel cannot quote a number the admin dashboard disagrees with.
//
// Order food or a treatment after paying and the total goes up. That is not an
// error state: the panel shows what has already been sent, what is now due, and
// asks for the difference.
//
// THE CLOCK
// ---------
// Holding the unit first is only fair to the next guest if the hold expires, so
// a booking with nothing paid against it is held for ten minutes and then
// cancelled. The countdown below is that rule made visible; the rule itself is
// in Postgres, which is why nothing here can extend it. Once a receipt is in —
// even an unverified one — the clock is gone for good, so a guest topping up
// for food ordered afterwards is never racing anything.

function formatPeso(amount){
    return `₱${Number(amount ?? 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`
}

function formatSubmittedAt(iso){
    if (!iso) return ''
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('en-PH', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
}

function orderTotal(orders){
    return (orders ?? []).reduce((sum, order) => sum + Number(order.total ?? 0), 0)
}

// Centavos. Every figure shown is rounded before it is displayed or compared,
// so the arithmetic the guest reads off the panel adds up on the page rather
// than only to full precision behind it.
function round2(amount){
    return Math.round(Number(amount ?? 0) * 100) / 100
}

const RATE_LABEL = `${DOWNPAYMENT_RATE * 100}%`

function ChargeRow({ label, sub, note, value, tone }){
    return (
        <div className={`pay-row${tone ? ` pay-row-${tone}` : ''}`}>
            <span className="pay-row-label">
                {label}
                {sub && <span className="pay-row-sub">{sub}</span>}
                {note && <span className="pay-row-note">{note}</span>}
            </span>
            <span className="pay-row-value">{value}</span>
        </div>
    )
}

// A titled block of charges. The panel is three of these — what the booking
// costs, what the add-ons cost, and the sum — because "your food is charged at
// 50% too" is a statement about grouping, and a flat list cannot make it.
function ChargeGroup({ title, note, children }){
    return (
        <div className="pay-group">
            <p className="pay-group-title">{title}</p>
            {children}
            {note && <p className="pay-group-note">{note}</p>}
        </div>
    )
}

export default function BookingPayment({
    booking,
    autoOpen = false,
    // Swapped for payBookingGroup(groupId, file) by GroupBookingCard — same
    // (id, file) shape, so everything below is unaware which one it's calling.
    onPay = payBooking,
    // What the "Accommodation" charge row's sub-label reads, and what the
    // payment-closed message calls the thing that went back on the market.
    // A group reservation has neither a single accomodationName nor a single
    // unitId, so GroupBookingCard supplies its own.
    accommodationLabel = booking.accomodationName,
    releasedLabel = booking.unitId ? `unit ${booking.unitId}` : 'your unit',
}){
    const panelRef = useRef(null)
    const [receipt, setReceipt] = useState(null)
    const [status, setStatus] = useState('idle')   // idle | sending | sent
    const [error, setError] = useState(null)
    // The wording of the note above the QR codes, edited in
    // CMS → My Booking → Payment & QR. Its {amount} is filled in below, once
    // what is outstanding has been worked out.
    const { page: copy } = useMyBookingPage()

    const stage = getBookingStage(booking)
    // Ten minutes to pay, counted against the resort's clock. `tracked` is true
    // only while the unit is held with nothing sent against it.
    const payWindow = usePaymentWindow(booking)

    // null until the guest touches the header, so the defaults below can still
    // win when they arrive late — they are derived from the booking list, which
    // lands a beat after this mounts. Once the guest has opened or closed it
    // themselves, their choice sticks.
    const [toggled, setToggled] = useState(null)
    // Open by default while the clock is running. A collapsed panel on a
    // booking with four minutes left is a countdown nobody can see.
    const open = toggled ?? (autoOpen || payWindow.tracked)
    const foodTotal = round2(orderTotal(booking.foodOrders))
    const spaTotal = round2(orderTotal(booking.spaOrders))
    const itemsTotal = round2(orderTotal(booking.itemOrders))
    // A single-unit booking has `price`; a combined reservation has
    // `unitSubtotal` instead (the sum across every unit) — never both.
    const unitRate = booking.price ?? booking.unitSubtotal ?? 0
    const entranceTotal = booking.entrance?.total ?? 0
    // Both figures above are for the WHOLE stay: an extended booking's `price`
    // is the nightly rate already multiplied by its nights, and the entrance
    // breakdown was scaled the same way when the booking was created (see
    // data/extendedStay.js). Nothing here multiplies — it only needs to say
    // how many nights the numbers already cover.
    const nights = booking.sameDayCheckout
        ? 1
        : Math.max(1, countNights(booking.checkIn, booking.checkOut))
    const nightsNote = nights > 1 ? ` for ${nights} nights` : ''

    // The two halves of what this stay costs, kept apart on purpose. Entrance
    // fees belong with the unit — they are settled together when the booking is
    // paid — while food and spa can be ordered at any time, including after
    // that payment has gone through. Both are charged at the same 50%.
    const bookingBase = round2(unitRate + entranceTotal)
    const addonsBase = round2(foodTotal + spaTotal + itemsTotal)
    const stayTotal = round2(booking.stayTotal ?? bookingBase + addonsBase)

    const dueNow = round2(booking.downpayment ?? stayTotal * DOWNPAYMENT_RATE)
    const bookingDue = round2(bookingBase * DOWNPAYMENT_RATE)
    // Taken as the remainder rather than computed from addonsBase, so the two
    // lines always add up to the figure Postgres generated. Rounding each half
    // independently can land a centavo apart from rounding the whole, and a
    // breakdown that does not sum to its own total is worse than a centavo.
    const addonsDue = Math.max(0, round2(dueNow - bookingDue))

    const submitted = round2(booking.paidSubmitted ?? 0)
    // Rounded to centavos before comparing: a fraction of a peso left over from
    // an odd-numbered total must not keep a settled booking looking unpaid.
    const outstanding = Math.max(0, round2(dueNow - submitted))
    const settled = outstanding === 0 && submitted > 0
    const onSiteBalance = Math.max(0, round2(stayTotal - dueNow))

    // Whether the booking's own 50% is already covered. When it is, what is
    // outstanding is the add-ons' 50% and nothing else — so the panel asks for
    // that on its own terms instead of quoting one merged figure the guest has
    // to reverse-engineer.
    const bookingPaid = submitted > 0 && submitted >= bookingDue
    const payingAddonsOnly = bookingPaid && outstanding > 0

    // Arriving straight from the booking form: bring the panel into view, since
    // paying is the whole reason the guest was sent here. Opening it is handled
    // by `open` above — this effect only scrolls.
    useEffect(() => {
        if (!autoOpen) return
        const timer = setTimeout(() => {
            panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 250)
        return () => clearTimeout(timer)
    }, [autoOpen])

    // The success note is transient; the panel underneath it re-renders from the
    // updated booking row, which is the real confirmation.
    useEffect(() => {
        if (status !== 'sent') return
        const timer = setTimeout(() => setStatus('idle'), 4000)
        return () => clearTimeout(timer)
    }, [status])

    async function handleSubmit(){
        if (status === 'sending') return
        // The upload takes a moment, and the database would refuse the receipt
        // at the end of it. Saying so now beats sending an image to a booking
        // that no longer exists.
        if (payWindow.expired){
            setError(
                `Your ${payWindow.windowMinutes} minute payment window has closed, `
                + 'so this booking was cancelled. Please try to book again.',
            )
            return
        }
        if (!receipt){
            setError('Choose a screenshot of your payment first.')
            return
        }
        setError(null)
        setStatus('sending')

        const result = await onPay(booking.id, receipt)

        if (!result.ok){
            setStatus('idle')
            setError(result.message)
            return
        }

        // Clearing the file is what tells Payment to drop its preview, so a
        // receipt already on its way to staff stops looking like a draft.
        setReceipt(null)
        setStatus('sent')
    }

    // Nothing to collect on a stay that is over or called off.
    if (stage === 'cancelled' || stage === 'completed') return null

    return (
        <section className="booking-pay" ref={panelRef} aria-label="Payment">
            <button
                type="button"
                className="booking-pay-header"
                onClick={() => setToggled(!open)}
                aria-expanded={open}
            >
                <span className="booking-pay-header-text">
                    <span className="booking-pay-title">Payment</span>
                    <span className={`booking-pay-badge${settled ? ' is-settled' : ''}`}>
                        {settled
                            ? booking.payment === 'paid-full'
                                ? 'Paid in full'
                                : 'Receipt submitted'
                            : `${formatPeso(outstanding)} due`}
                    </span>
                    {/* Repeated in the header so the deadline survives the
                        panel being collapsed — the one number a guest must not
                        have to open something to find. */}
                    {payWindow.tracked && (
                        <span className="booking-pay-timer">
                            {payWindow.expired
                                ? 'Payment closed'
                                : `${formatCountdown(payWindow.msLeft)} left to pay`}
                        </span>
                    )}
                </span>
                <span className="booking-pay-chevron" aria-hidden="true">{open ? '﹀' : '︿'}</span>
            </button>

            {open && (
                <div className="booking-pay-body">
                    <div className="booking-pay-charges">
                        <ChargeGroup
                            title="Booking"
                            note={`Entrance fees are part of the booking, so they are inside the ${RATE_LABEL} — not a separate charge on arrival.`}
                        >
                            <ChargeRow
                                label="Accommodation"
                                sub={`${accommodationLabel}${nightsNote}`}
                                value={(booking.price ?? booking.unitSubtotal) != null ? formatPeso(unitRate) : 'Price TBA'}
                            />
                            {entranceTotal > 0 && (
                                <ChargeRow
                                    label="Entrance fees"
                                    sub={`${formatPeso(booking.entrance.perHead)}/head${nightsNote}`}
                                    value={formatPeso(entranceTotal)}
                                />
                            )}
                            <ChargeRow
                                label="Booking subtotal"
                                sub={
                                    entranceTotal > 0
                                        ? `${formatPeso(unitRate)} + ${formatPeso(entranceTotal)}`
                                        : null
                                }
                                value={formatPeso(bookingBase)}
                                tone="subtotal"
                            />
                            <ChargeRow
                                label={`Booking down payment (${RATE_LABEL})`}
                                sub={`${formatPeso(bookingBase)} × ${RATE_LABEL}`}
                                value={formatPeso(bookingDue)}
                                tone="due"
                            />
                        </ChargeGroup>

                        {addonsBase > 0 && (
                            <ChargeGroup
                                title="Food, spa & add-ons"
                                note={
                                    bookingPaid
                                        ? `Ordered after your booking was paid, so this ${RATE_LABEL} is asked for on its own — your booking payment stays as it is.`
                                        : `Ordered before you pay, so this ${RATE_LABEL} is collected together with the booking below.`
                                }
                            >
                                {foodTotal > 0 && (
                                    <ChargeRow
                                        label="Food orders"
                                        sub={`${booking.foodOrders.length} item${booking.foodOrders.length > 1 ? 's' : ''}`}
                                        value={formatPeso(foodTotal)}
                                    />
                                )}
                                {spaTotal > 0 && (
                                    <ChargeRow
                                        label="Spa services"
                                        sub={`${booking.spaOrders.length} treatment${booking.spaOrders.length > 1 ? 's' : ''}`}
                                        value={formatPeso(spaTotal)}
                                    />
                                )}
                                {itemsTotal > 0 && (
                                    <ChargeRow
                                        label="Add-ons"
                                        sub={`${booking.itemOrders.length} item${booking.itemOrders.length > 1 ? 's' : ''}`}
                                        value={formatPeso(itemsTotal)}
                                    />
                                )}
                                <ChargeRow
                                    label="Add-ons subtotal"
                                    sub={(() => {
                                        const parts = [foodTotal, spaTotal, itemsTotal].filter((part) => part > 0)
                                        return parts.length > 1 ? parts.map(formatPeso).join(' + ') : null
                                    })()}
                                    value={formatPeso(addonsBase)}
                                    tone="subtotal"
                                />
                                <ChargeRow
                                    label={`Add-ons down payment (${RATE_LABEL})`}
                                    sub={`${formatPeso(addonsBase)} × ${RATE_LABEL}`}
                                    value={formatPeso(addonsDue)}
                                    tone="due"
                                />
                            </ChargeGroup>
                        )}

                        <ChargeGroup title="The math">
                            <ChargeRow
                                label="Stay total"
                                sub={
                                    addonsBase > 0
                                        ? `${formatPeso(bookingBase)} booking + ${formatPeso(addonsBase)} add-ons`
                                        : 'accommodation + entrance fees'
                                }
                                value={formatPeso(stayTotal)}
                                tone="subtotal"
                            />
                            <ChargeRow
                                label={`Down payment (${RATE_LABEL})`}
                                sub={
                                    addonsBase > 0
                                        ? `${formatPeso(stayTotal)} × ${RATE_LABEL} = ${formatPeso(bookingDue)} + ${formatPeso(addonsDue)}`
                                        : `${formatPeso(stayTotal)} × ${RATE_LABEL}`
                                }
                                value={formatPeso(dueNow)}
                                tone="due"
                            />
                            {submitted > 0 && (
                                <ChargeRow
                                    label="Already submitted"
                                    sub={
                                        booking.receipts?.length > 1
                                            ? `${booking.receipts.length} receipts`
                                            : formatSubmittedAt(booking.receipts?.[0]?.uploadedAt)
                                    }
                                    value={`− ${formatPeso(submitted)}`}
                                    tone="credit"
                                />
                            )}
                            <ChargeRow
                                label={settled ? 'Nothing left to pay' : 'Amount to pay now'}
                                sub={
                                    submitted > 0
                                        ? `${formatPeso(dueNow)} − ${formatPeso(submitted)}`
                                        : payingAddonsOnly
                                            ? 'the add-ons’ half'
                                            : null
                                }
                                value={formatPeso(outstanding)}
                                tone="total"
                            />
                            <ChargeRow
                                label="Balance on-site"
                                sub={`the other ${RATE_LABEL} — ${formatPeso(stayTotal)} − ${formatPeso(dueNow)}`}
                                // Senior, PWD and kids discounts are given in
                                // person against an ID (see entranceFee.js) —
                                // this is quoted at the full rate, so only a
                                // party that actually has one of those guests
                                // stands to see it come down. Shown here, not
                                // as a promised amount, since the desk decides
                                // it — see settlePaymentModal.jsx on the admin
                                // side for where that discount is verified.
                                note={
                                    (booking.seniors ?? 0) + (booking.pwd ?? 0) + (booking.kids ?? 0) > 0
                                        ? 'This balance may be lower once a senior, PWD, or kids discount is verified at check-in.'
                                        : null
                                }
                                value={formatPeso(onSiteBalance)}
                            />
                        </ChargeGroup>
                    </div>

                    {settled ? (
                        <div className="booking-pay-settled" role="status">
                            <span className="booking-pay-settled-icon" aria-hidden="true">✓</span>
                            <div>
                                <p className="booking-pay-settled-title">
                                    {booking.payment === 'paid-full'
                                        ? 'This booking is paid in full.'
                                        : 'Your down payment is with us.'}
                                </p>
                                <p className="booking-pay-settled-text">
                                    {stage === 'pending'
                                        ? 'We are checking the receipt and will confirm by email or SMS.'
                                        : 'Your reservation is confirmed. Bring your receipt to check-in.'}
                                    {' '}Order food or a spa treatment later and any difference
                                    will show up here.
                                </p>
                            </div>
                        </div>
                    ) : payWindow.expired ? (
                        /* The clock reached zero. Postgres has been told, and
                           the cancelled row is on its way back — at which point
                           this whole panel disappears with the booking. Until
                           then the guest gets the reason and the way out,
                           rather than an upload button that would be refused. */
                        <div className="booking-pay-closed" role="alert">
                            <span className="booking-pay-closed-icon" aria-hidden="true">⏱</span>
                            <div>
                                <p className="booking-pay-closed-title">
                                    Payment window closed
                                </p>
                                <p className="booking-pay-closed-text">
                                    Your {payWindow.windowMinutes} minutes to send the{' '}
                                    {formatPeso(outstanding)} down payment have passed, so
                                    this booking has been cancelled and{' '}
                                    {releasedLabel}{' '}
                                    is back on the market. Nothing has been charged.
                                </p>
                                <p className="booking-pay-closed-text">
                                    <strong>Please try to book again</strong> — have your
                                    GCash or bank app open when you reserve, so the receipt
                                    goes up inside the {payWindow.windowMinutes} minutes.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {payWindow.tracked && (
                                <PaymentCountdown
                                    msLeft={payWindow.msLeft}
                                    totalMs={payWindow.totalMs}
                                    windowMinutes={payWindow.windowMinutes}
                                />
                            )}

                            {submitted > 0 && (
                                <p className="booking-pay-topup" role="status">
                                    {payingAddonsOnly ? (
                                        <>
                                            Your booking is paid — {formatPeso(submitted)} sent,
                                            covering the {formatPeso(bookingDue)} due on{' '}
                                            {formatPeso(bookingBase)}. The food and spa you
                                            ordered afterwards are billed separately at{' '}
                                            {RATE_LABEL}: {formatPeso(addonsBase)} ×{' '}
                                            {RATE_LABEL} = {formatPeso(addonsDue)}, leaving{' '}
                                            {formatPeso(outstanding)} to send. Nothing about
                                            your booking payment changes.
                                        </>
                                    ) : (
                                        <>
                                            You have already sent {formatPeso(submitted)}. Add-ons
                                            ordered since then bring the down payment to{' '}
                                            {formatPeso(dueNow)}, so {formatPeso(outstanding)} is
                                            still outstanding.
                                        </>
                                    )}
                                </p>
                            )}

                            <Payment
                                receipt={receipt}
                                onReceiptChange={(file) => {
                                    setError(null)
                                    setReceipt(file)
                                }}
                                disabled={status === 'sending'}
                                inputId={`receipt-upload-${booking.id}`}
                                note={
                                    <>
                                        {copy.payNoteHeading && (
                                            <>
                                                <strong className="payment-note-heading">
                                                    {fillTokens(copy.payNoteHeading, {
                                                        amount: formatPeso(outstanding),
                                                    })}
                                                </strong>{' '}
                                            </>
                                        )}
                                        {fillTokens(copy.payNoteText, {
                                            amount: formatPeso(outstanding),
                                        })}
                                    </>
                                }
                            />

                            {status === 'sent' && (
                                <p className="booking-pay-ok" role="status">
                                    Receipt received — we will confirm once it is verified.
                                </p>
                            )}

                            {error && (
                                <p className="booking-pay-error" role="alert">{error}</p>
                            )}

                            <button
                                type="button"
                                className="booking-pay-submit"
                                onClick={handleSubmit}
                                disabled={!receipt || status === 'sending'}
                            >
                                {status === 'sending'
                                    ? 'Sending your receipt…'
                                    : `Submit Payment · ${formatPeso(outstanding)}`}
                            </button>
                        </>
                    )}
                </div>
            )}
        </section>
    )
}
