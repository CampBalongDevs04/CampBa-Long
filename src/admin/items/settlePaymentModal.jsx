import { useEffect, useState } from 'react'
import '../css/receipt-viewer.css'
import '../css/settle-payment.css'
import { settleBookingPayment, settleGroupBookingPayment, groupUnitsLabel } from '../../data/accommodationDB.js'

// Discount given in person against an ID at settlement — SEPARATE from
// SENIOR_DISCOUNT_RATE / PWD_DISCOUNT_RATE / KIDS_DISCOUNT_RATE in
// data/entranceFee.js, which stay at 0 on purpose and govern the ONLINE
// quote only (see that file's comments). This is a client-side mirror of the
// same rate settle_booking_payment() uses in Postgres (see
// supabase/migrations/20260819120000_settle_booking_payment.sql) so the
// preview here matches what gets recorded — the same deliberate
// mirrored-arithmetic pattern computeEntranceFee()/entrance_breakdown()
// already use elsewhere in this app.
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

function CostRow({ label, note, value, variant = '' }) {
    return (
        <div className={`receipt-order-row${variant ? ` ${variant}` : ''}`}>
            <span className="receipt-cost-label">
                {label}
                {note ? <span className="receipt-cost-note">{note}</span> : null}
            </span>
            <span>{value}</span>
        </div>
    )
}

// One party count staff can dial down from "declared at booking" to "actually
// verified" — never up past it, since the desk cannot give a discount to more
// people than the guest brought. Absent entirely once the booking has none of
// this kind, same as the booking form's own steppers only show what applies.
function StepRow({ label, note, max, value, onChange }) {
    if (!max) return null
    return (
        <div className="settle-step-row">
            <div className="settle-step-label">
                <span>{label}</span>
                {note ? <span className="settle-step-note">{note}</span> : null}
            </div>
            <div className="settle-stepper" role="group" aria-label={label}>
                <button
                    type="button"
                    className="settle-step-btn"
                    aria-label={`Fewer verified — ${label}`}
                    onClick={() => onChange(Math.max(0, value - 1))}
                    disabled={value <= 0}
                >
                    &minus;
                </button>
                <span className="settle-step-value" aria-live="polite" aria-atomic="true">
                    {value} / {max}
                </span>
                <button
                    type="button"
                    className="settle-step-btn"
                    aria-label={`More verified — ${label}`}
                    onClick={() => onChange(Math.min(max, value + 1))}
                    disabled={value >= max}
                >
                    +
                </button>
            </div>
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
// compute the real one server-side — the RPC is what actually decides and
// locks in the numbers on Confirm; nothing this component computes is sent
// as a peso amount, only the verified counts.
export default function SettlePaymentModal({ booking, onClose }) {
    const [seniorVerified, setSeniorVerified] = useState(0)
    const [pwdVerified, setPwdVerified] = useState(0)
    const [kidsVerified, setKidsVerified] = useState(0)
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

    const seniors = booking.seniors ?? 0
    const pwd = booking.pwd ?? 0
    const kids = booking.kids ?? 0

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
            <div className="receipt-modal">
                <header className="receipt-head">
                    <div className="receipt-head-text">
                        <h2 className="receipt-title" id="settle-payment-title">
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

                <div className="receipt-body">
                    <div className="receipt-orders">
                        <p className="receipt-orders-title">Cost breakdown</p>
                        <CostRow
                            label={booking.isGroup ? 'Accommodation' : booking.accomodationName}
                            note={booking.isGroup ? groupUnitsLabel(booking.units) : booking.unitId}
                            value={formatPeso(unitCost)}
                        />
                        {entranceTotal > 0 && (
                            <CostRow
                                label="Entrance fees"
                                note={`${formatPeso(perHead)}/head · ${booking.pax ?? 0} pax`}
                                value={formatPeso(entranceTotal)}
                            />
                        )}
                        {foodOrders.map((order, index) => (
                            <CostRow key={`food-${index}`} label={`Food · ${order.name}`} value={formatPeso(order.total)} />
                        ))}
                        {spaOrders.map((order, index) => (
                            <CostRow key={`spa-${index}`} label={`Spa · ${order.name}`} value={formatPeso(order.total)} />
                        ))}
                        {itemOrders.map((order, index) => (
                            <CostRow key={`item-${index}`} label={`Add-on · ${order.name}`} value={formatPeso(order.total)} />
                        ))}
                        <CostRow
                            label="Total cost of booking"
                            value={formatPeso(stayTotal)}
                            variant="receipt-order-total"
                        />
                        <CostRow label="Already collected online" value={formatPeso(alreadyCollected)} />
                    </div>

                    <div className="settle-discounts">
                        <p className="receipt-orders-title">Verify discounts at settlement</p>
                        <p className="settle-discounts-hint">
                            Given in person against an ID — dial up only what was actually shown at
                            check-in. Senior and PWD are 20% off the entrance fee; kids 7 and below
                            are free.
                        </p>
                        <StepRow
                            label="Senior citizens"
                            note={`${Math.round(SENIOR_SETTLEMENT_RATE * 100)}% off entrance`}
                            max={seniors}
                            value={seniorVerified}
                            onChange={setSeniorVerified}
                        />
                        <StepRow
                            label="PWD"
                            note={`${Math.round(PWD_SETTLEMENT_RATE * 100)}% off entrance`}
                            max={pwd}
                            value={pwdVerified}
                            onChange={setPwdVerified}
                        />
                        <StepRow
                            label="Kids 7 & below"
                            note="Free"
                            max={kids}
                            value={kidsVerified}
                            onChange={setKidsVerified}
                        />
                        {seniors + pwd + kids === 0 && (
                            <p className="settle-discounts-hint">
                                No senior, PWD or kids guests are on this booking.
                            </p>
                        )}
                    </div>

                    <div className="receipt-orders">
                        <CostRow label="Discount given" value={discount > 0 ? `− ${formatPeso(discount)}` : formatPeso(0)} />
                        <CostRow
                            label="Amount to collect"
                            value={formatPeso(amountToCollect)}
                            variant="receipt-order-total"
                        />
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
