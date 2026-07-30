import { useEffect, useRef, useState } from 'react'
import './css/bookingPayment.css'
import Payment from './payment.jsx'
import { payBooking, getBookingStage } from '../../data/accommodationDB.js'

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

function ChargeRow({ label, sub, value, tone }){
    return (
        <div className={`pay-row${tone ? ` pay-row-${tone}` : ''}`}>
            <span className="pay-row-label">
                {label}
                {sub && <span className="pay-row-sub">{sub}</span>}
            </span>
            <span className="pay-row-value">{value}</span>
        </div>
    )
}

export default function BookingPayment({ booking, autoOpen = false }){
    const panelRef = useRef(null)
    // null until the guest touches the header, so `autoOpen` can still win when
    // it arrives late — it is derived from the booking list, which lands a beat
    // after this mounts. Once they have opened or closed it themselves, their
    // choice sticks.
    const [toggled, setToggled] = useState(null)
    const open = toggled ?? autoOpen
    const [receipt, setReceipt] = useState(null)
    const [status, setStatus] = useState('idle')   // idle | sending | sent
    const [error, setError] = useState(null)

    const stage = getBookingStage(booking)
    const foodTotal = orderTotal(booking.foodOrders)
    const spaTotal = orderTotal(booking.spaOrders)
    const unitRate = booking.price ?? 0
    const entranceTotal = booking.entrance?.total ?? 0
    const stayTotal = booking.stayTotal ?? unitRate + entranceTotal + foodTotal + spaTotal
    const dueNow = booking.downpayment ?? 0
    const submitted = booking.paidSubmitted ?? 0
    // Rounded to centavos before comparing: a fraction of a peso left over from
    // an odd-numbered total must not keep a settled booking looking unpaid.
    const outstanding = Math.max(0, Math.round((dueNow - submitted) * 100) / 100)
    const settled = outstanding === 0 && submitted > 0
    const onSiteBalance = Math.max(0, stayTotal - dueNow)

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
        if (!receipt){
            setError('Choose a screenshot of your payment first.')
            return
        }
        setError(null)
        setStatus('sending')

        const result = await payBooking(booking.id, receipt)

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
                </span>
                <span className="booking-pay-chevron" aria-hidden="true">{open ? '﹀' : '︿'}</span>
            </button>

            {open && (
                <div className="booking-pay-body">
                    <div className="booking-pay-charges">
                        <ChargeRow
                            label="Accommodation"
                            sub={booking.accomodationName}
                            value={booking.price != null ? formatPeso(unitRate) : 'Price TBA'}
                        />
                        {entranceTotal > 0 && (
                            <ChargeRow
                                label="Entrance fees"
                                sub={`${formatPeso(booking.entrance.perHead)}/head`}
                                value={formatPeso(entranceTotal)}
                            />
                        )}
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
                        <ChargeRow label="Stay subtotal" value={formatPeso(stayTotal)} tone="subtotal" />
                        <ChargeRow
                            label="Down payment (50%)"
                            sub="payable now"
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
                            label={settled ? 'Nothing left to pay' : 'Amount to pay'}
                            value={formatPeso(outstanding)}
                            tone="total"
                        />
                        <ChargeRow
                            label="Balance on-site"
                            sub="settled at check-in"
                            value={formatPeso(onSiteBalance)}
                        />
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
                    ) : (
                        <>
                            {submitted > 0 && (
                                <p className="booking-pay-topup" role="status">
                                    You have already sent {formatPeso(submitted)}. Add-ons
                                    ordered since then bring the down payment to{' '}
                                    {formatPeso(dueNow)}, so {formatPeso(outstanding)} is
                                    still outstanding.
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
                                        <strong className="payment-note-heading">
                                            Send {formatPeso(outstanding)}.
                                        </strong>{' '}
                                        Scan the QR of your preferred method, then upload the
                                        screenshot as proof. Your unit stays held while we
                                        verify it.
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
