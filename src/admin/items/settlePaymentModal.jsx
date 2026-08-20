import { useEffect, useState } from 'react'
import '../css/receipt-viewer.css'
import '../css/settle-payment.css'
import { settleBookingPayment, settleGroupBookingPayment, groupUnitsLabel } from '../../data/accommodationDB.js'

// Discount given in person against an ID at settlement — SEPARATE from
// SENIOR_DISCOUNT_RATE / PWD_DISCOUNT_RATE / KIDS_DISCOUNT_RATE in
// data/entranceFee.js, which stay at 0 on purpose and govern the ONLINE
// quote only (see that file's comments). This is a client-side mirror of the
// same rate settle_booking_payment()/settle_group_booking_payment() use in
// Postgres, so the preview here matches what gets recorded — the same
// deliberate mirrored-arithmetic pattern computeEntranceFee()/
// entrance_breakdown() already use elsewhere in this app.
const SENIOR_SETTLEMENT_RATE = 0.20
const PWD_SETTLEMENT_RATE = 0.20
const KIDS_SETTLEMENT_RATE = 1.00

function formatPeso(amount) {
    if (amount == null) return '—'
    return `₱${Number(amount).toLocaleString()}`
}

function orderTotal(orders) {
    return orders.reduce((sum, order) => sum + order.total, 0)
}

// One category (senior/PWD/kids) — a single quick switch by default,
// covering the common case in one click either way: everyone qualifies, or
// (rarer) nobody does. `verified` starts at `count` (see the useState below)
// so the switch reads ON out of the gate — "presented ID" is the assumption,
// not the exception, since that's what actually happens most of the time.
//
// For a party bigger than one, flipping N individual switches to knock out
// most of a category is real hassle, and losing which specific person is
// verified (a single ON/OFF can't tell "3 of 5" apart from "5 of 5") is a
// real gap — so "Manual selection" swaps the switch for a +/− counter,
// still starting at `count`, so the ONLY motion needed is subtracting the
// exceptions rather than re-building the count from zero.
function SwitchCategory({ title, rateLabel, count, verified, setVerified, manual, setManual, disabled }) {
    if (!count) return null
    const allOn = verified >= count

    return (
        <div className="settle-category">
            <p className="settle-category-title">
                {title}
                <span className="settle-category-rate">{rateLabel}</span>
                {count > 1 && (
                    <button
                        type="button"
                        className="settle-manual-toggle"
                        onClick={() => setManual(!manual)}
                        disabled={disabled}
                    >
                        {manual ? 'Quick toggle' : 'Manual selection'}
                    </button>
                )}
            </p>

            {manual ? (
                <div className="settle-stepper" role="group" aria-label={`${title} verified count`}>
                    <button
                        type="button"
                        className="settle-stepper-btn"
                        aria-label={`Fewer verified — ${title}`}
                        onClick={() => setVerified(Math.max(0, verified - 1))}
                        disabled={disabled || verified <= 0}
                    >
                        &minus;
                    </button>
                    <span className="settle-stepper-value" aria-live="polite" aria-atomic="true">
                        {verified} / {count}
                    </span>
                    <button
                        type="button"
                        className="settle-stepper-btn"
                        aria-label={`More verified — ${title}`}
                        onClick={() => setVerified(Math.min(count, verified + 1))}
                        disabled={disabled || verified >= count}
                    >
                        +
                    </button>
                </div>
            ) : (
                <label className={`settle-switch-chip${allOn ? ' is-on' : ''}`}>
                    <span className="settle-switch-chip-label">
                        {count === 1 ? 'Shown at check-in' : `All ${count} shown at check-in`}
                    </span>
                    <span className="settle-switch">
                        <input
                            type="checkbox"
                            role="switch"
                            checked={allOn}
                            disabled={disabled}
                            onChange={(e) => setVerified(e.target.checked ? count : 0)}
                        />
                        <span className="settle-switch-slider" aria-hidden="true" />
                    </span>
                </label>
            )}
        </div>
    )
}

// Replaces the plain "Mark Paid" flip for any booking — single unit OR a
// combined reservation (booking.isGroup) — that has a senior, PWD or kids
// count on it; see bookingsManage.jsx, which only opens this when at least
// one of those is > 0. A booking with none of them keeps the old one-click
// markBookingPaidFull()/markBookingGroupPaidFull(), since there is nothing
// here for staff to verify. A group's counts live only on the group row
// itself (never per member unit — see book_stay_group()), so there's no
// per-unit branching needed below beyond which RPC handleConfirm calls.
//
// Every figure below (discount, amount to collect) is a PREVIEW, computed
// the same way settle_booking_payment()/settle_group_booking_payment()
// compute the real one server-side — the RPC only ever receives a per-head
// VERIFIED COUNT (however many switches are on), never a peso figure this
// component invents and asks Postgres to trust.
export default function SettlePaymentModal({ booking, onClose }) {
    const seniors = booking?.seniors ?? 0
    const pwd = booking?.pwd ?? 0
    const kids = booking?.kids ?? 0

    // Starts at the full count — see SwitchCategory's header comment.
    const [seniorVerified, setSeniorVerified] = useState(seniors)
    const [pwdVerified, setPwdVerified] = useState(pwd)
    const [kidsVerified, setKidsVerified] = useState(kids)
    // Which categories are in "manual selection" (+/−) mode rather than the
    // default quick switch — per category, since a party can have e.g. one
    // PWD (no need for manual) alongside five kids (where it helps).
    const [seniorManual, setSeniorManual] = useState(false)
    const [pwdManual, setPwdManual] = useState(false)
    const [kidsManual, setKidsManual] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(null)

    // Same lock/escape behaviour as ReceiptViewer, which this modal replaces
    // Mark Paid's one click with.
    useEffect(() => {
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [])

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape' && !submitting) onClose?.()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [onClose, submitting])

    if (!booking) return null

    const perHead = Number(booking.entrance?.perHead ?? 0)
    const entranceTotal = Number(booking.entrance?.total ?? 0)
    const foodOrders = booking.foodOrders ?? []
    const spaOrders = booking.spaOrders ?? []
    const itemOrders = booking.itemOrders ?? []
    const addOnsTotal = orderTotal(foodOrders) + orderTotal(spaOrders) + orderTotal(itemOrders)
    const unitCost = booking.isGroup ? booking.unitSubtotal : booking.price
    const stayTotal = Number(booking.stayTotal ?? (unitCost ?? 0) + entranceTotal + addOnsTotal)
    const alreadyCollected = Number(booking.paidSubmitted ?? 0)

    // One line, not the full itemised receipt: staff already reviewed that
    // in Proof of Payment before this booking ever got here. What this
    // screen needs is the two totals the verify step below acts on.
    const unitLabel = booking.isGroup ? groupUnitsLabel(booking.units) : booking.accomodationName
    const summaryNote = [
        unitLabel,
        entranceTotal > 0 ? 'entrance fees' : null,
        addOnsTotal > 0 ? 'add-ons' : null,
    ].filter(Boolean).join(' + ')

    const discount = Math.round(
        perHead
        * (seniorVerified * SENIOR_SETTLEMENT_RATE + pwdVerified * PWD_SETTLEMENT_RATE + kidsVerified * KIDS_SETTLEMENT_RATE)
        * 100,
    ) / 100
    const amountToCollect = Math.max(0, Math.round((stayTotal - alreadyCollected - discount) * 100) / 100)

    const handleConfirm = async () => {
        setSubmitting(true)
        setError(null)
        const result = booking.isGroup
            ? await settleGroupBookingPayment(booking.id, { seniorVerified, pwdVerified, kidsVerified })
            : await settleBookingPayment(booking.id, { seniorVerified, pwdVerified, kidsVerified })
        setSubmitting(false)
        if (!result.ok) {
            setError(result.message || 'Could not settle this payment.')
            return
        }
        onClose?.()
    }

    return (
        <div
            className="receipt-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settle-payment-title"
            onClick={(e) => {
                if (e.target === e.currentTarget && !submitting) onClose?.()
            }}
        >
            <div className="receipt-modal settle-modal">
                <header className="receipt-head">
                    <div className="receipt-head-text">
                        <h2 className="receipt-title settle-title" id="settle-payment-title">
                            <svg className="settle-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
                                <path d="M2.5 10.5h19" />
                                <circle cx="16.5" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
                            </svg>
                            Settle Payment
                        </h2>
                        <p className="receipt-subtitle">
                            {booking.guest?.fullName || 'Guest'} · {booking.code ?? booking.id}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="receipt-close"
                        aria-label="Close"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        &times;
                    </button>
                </header>

                <div className="receipt-body settle-body">
                    {/* One row, two figures, side by side — not two stacked
                        rows each with their own padding. Staff already saw
                        the itemised breakdown in Proof of Payment; this is
                        just enough to place the numbers below in context. */}
                    <div className="settle-summary">
                        <div className="settle-summary-cols">
                            <div className="settle-summary-col">
                                <span className="settle-summary-tag">Total</span>
                                <span className="settle-summary-value">{formatPeso(stayTotal)}</span>
                            </div>
                            <div className="settle-summary-col">
                                <span className="settle-summary-tag">Paid online</span>
                                <span className="settle-summary-value">{formatPeso(alreadyCollected)}</span>
                            </div>
                        </div>
                        <p className="settle-summary-note">{summaryNote}</p>
                    </div>

                    <div className="settle-discounts">
                        <p className="settle-discounts-title">Verify discounts at settlement</p>
                        <p className="settle-discounts-hint">
                            Starts ON for everyone — flip off whoever didn't show valid ID.
                        </p>

                        <SwitchCategory
                            title="Senior citizens"
                            rateLabel="20% off entrance"
                            count={seniors}
                            verified={seniorVerified}
                            setVerified={setSeniorVerified}
                            manual={seniorManual}
                            setManual={setSeniorManual}
                            disabled={submitting}
                        />
                        <SwitchCategory
                            title="PWD"
                            rateLabel="20% off entrance"
                            count={pwd}
                            verified={pwdVerified}
                            setVerified={setPwdVerified}
                            manual={pwdManual}
                            setManual={setPwdManual}
                            disabled={submitting}
                        />
                        <SwitchCategory
                            title="Kids 7 & below"
                            rateLabel="Free"
                            count={kids}
                            verified={kidsVerified}
                            setVerified={setKidsVerified}
                            manual={kidsManual}
                            setManual={setKidsManual}
                            disabled={submitting}
                        />

                        {seniors + pwd + kids === 0 && (
                            <p className="settle-discounts-hint">
                                No senior, PWD or kids guests are on this booking.
                            </p>
                        )}
                    </div>

                    <div className="settle-result">
                        <div className="settle-result-row">
                            <span>Discount</span>
                            <span>{discount > 0 ? `− ${formatPeso(discount)}` : formatPeso(0)}</span>
                        </div>
                        <div className="settle-result-row settle-result-total">
                            <span>Amount to collect</span>
                            <span>{formatPeso(amountToCollect)}</span>
                        </div>
                    </div>

                    {error && (
                        <p className="receipt-note receipt-note-warn" role="alert">
                            {error}
                        </p>
                    )}
                </div>

                <footer className="receipt-foot">
                    <div className="receipt-foot-left" />
                    <div className="receipt-foot-right">
                        <button type="button" className="receipt-btn" onClick={onClose} disabled={submitting}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="receipt-btn receipt-btn-primary"
                            onClick={handleConfirm}
                            disabled={submitting}
                        >
                            {submitting ? 'Settling…' : 'Confirm & Mark Paid'}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    )
}
