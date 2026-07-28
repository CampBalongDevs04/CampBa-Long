import { useEffect, useState } from 'react'
import '../css/receipt-viewer.css'
import {
    getReceiptUrl,
    getBookingStage,
    DOWNPAYMENT_RATE,
} from '../../data/accommodationDB.js'

// The proof-of-payment lightbox. Staff open this from the bookings table to
// read the guest's uploaded screenshot BEFORE approving the reservation —
// approving is what tells the guest their stay is confirmed, so the amount and
// the reference on the receipt have to be checked against the booking first.
//
// The image lives in a private bucket, so it is fetched as a short-lived signed
// URL every time the viewer mounts rather than kept on the row. That link
// expires on its own, which matters because a receipt carries the guest's name
// and the account they paid from.
//
// Render it only while a receipt is being reviewed — mounting per booking is
// what keeps the signed URL fresh on every open.

function formatPeso(amount) {
    if (amount == null) return '—'
    return `₱${Number(amount).toLocaleString()}`
}

function formatDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

function stayLabel(booking) {
    const from = formatDate(booking.checkIn)
    const to = formatDate(booking.checkOut)
    const dates = from === to ? from : `${from} → ${to}`
    return booking.schedule ? `${dates} · ${booking.schedule.time}` : dates
}

function orderTotal(orders) {
    return orders.reduce((sum, order) => sum + order.total, 0)
}

export default function ReceiptViewer({ booking, onClose, onApprove, onCancel }) {
    // null until the signed URL comes back — that absence IS the loading state,
    // so nothing has to be set from inside the effect body.
    const [resolved, setResolved] = useState(null)
    // Receipts are phone screenshots: tall and narrow. Fitted to the panel by
    // default so the whole thing is visible, with a click to blow it up on the
    // reference number, which is usually the part staff need to read.
    const [zoomed, setZoomed] = useState(false)

    const receiptPath = booking?.receiptPath ?? null

    useEffect(() => {
        if (!receiptPath) return
        // A reply that lands after this viewer is gone must not be applied.
        let current = true
        getReceiptUrl(receiptPath).then((result) => {
            if (!current) return
            setResolved(result.ok ? { url: result.url } : { error: result.message })
        })
        return () => {
            current = false
        }
    }, [receiptPath])

    // The dashboard behind must not scroll while the overlay is up. Kept apart
    // from the key handler below so it locks once on open and unlocks once on
    // close, rather than on every repaint of the panel.
    useEffect(() => {
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [])

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose?.()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [onClose])

    if (!booking) return null

    const stage = getBookingStage(booking)
    const pending = stage === 'pending'
    // What the receipt should actually say: the down payment, not the total.
    // This is the figure being verified.
    const expected = booking.downpayment
        ?? (booking.total != null ? booking.total * DOWNPAYMENT_RATE : null)

    // No image to show — either the guest uploaded nothing, or the booking
    // predates the storage bucket and only recorded that a receipt existed.
    const missingImage = receiptPath
        ? null
        : booking.hasReceipt
            ? 'This booking was made before receipt images were kept, so there is no image to show. Verify the payment with the guest directly.'
            : 'This guest did not upload a receipt.'

    const foodOrders = booking.foodOrders ?? []
    const spaOrders = booking.spaOrders ?? []
    const hasAddOns = foodOrders.length > 0 || spaOrders.length > 0

    return (
        <div
            className="receipt-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-viewer-title"
            /* Only a click that both starts and ends on the backdrop closes —
               otherwise dragging across the image would dismiss the viewer. */
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.()
            }}
        >
            <div className="receipt-modal">
                <header className="receipt-head">
                    <div className="receipt-head-text">
                        <h2 className="receipt-title" id="receipt-viewer-title">
                            Proof of Payment
                        </h2>
                        <p className="receipt-subtitle">
                            {booking.guest?.fullName || 'Guest'} · {booking.code ?? booking.id}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="receipt-close"
                        aria-label="Close receipt"
                        onClick={onClose}
                    >
                        &times;
                    </button>
                </header>

                {/* The only part that scrolls — the food/spa breakdown can grow
                    arbitrarily long, and without this the header and, worse,
                    the Approve/Reject footer would get pushed past the modal's
                    max-height and clipped off entirely. */}
                <div className="receipt-body">
                    <dl className="receipt-facts">
                        <div className="receipt-fact">
                            <dt>Expected down payment</dt>
                            <dd className="receipt-fact-strong">{formatPeso(expected)}</dd>
                        </div>
                        <div className="receipt-fact">
                            <dt>Unit</dt>
                            <dd>
                                {booking.accomodationName}
                                {booking.unitId ? ` · ${booking.unitId}` : ''}
                            </dd>
                        </div>
                        <div className="receipt-fact">
                            <dt>Stay</dt>
                            <dd>{stayLabel(booking)}</dd>
                        </div>
                        <div className="receipt-fact">
                            <dt>Mobile</dt>
                            <dd>{booking.guest?.mobile || '—'}</dd>
                        </div>
                    </dl>

                    {hasAddOns && (
                        <div className="receipt-orders">
                            {foodOrders.length > 0 && (
                                <div className="receipt-orders-group">
                                    <p className="receipt-orders-title">Food orders</p>
                                    {foodOrders.map((order, index) => (
                                        <div className="receipt-order-row" key={`food-${index}`}>
                                            <span>{order.name} × {order.quantity}</span>
                                            <span>{formatPeso(order.total)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {spaOrders.length > 0 && (
                                <div className="receipt-orders-group">
                                    <p className="receipt-orders-title">Spa orders</p>
                                    {spaOrders.map((order, index) => (
                                        <div className="receipt-order-row" key={`spa-${index}`}>
                                            <span>{order.name} × {order.quantity}</span>
                                            <span>{formatPeso(order.total)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="receipt-order-row receipt-order-total">
                                <span>Add-ons total</span>
                                <span>{formatPeso(orderTotal(foodOrders) + orderTotal(spaOrders))}</span>
                            </div>
                        </div>
                    )}

                    <div className={`receipt-stage ${zoomed ? 'is-zoomed' : ''}`}>
                        {missingImage && (
                            <p className="receipt-note receipt-note-warn" role="alert">
                                {missingImage}
                            </p>
                        )}

                        {!missingImage && !resolved && (
                            <p className="receipt-note">Loading receipt…</p>
                        )}

                        {resolved?.error && (
                            <p className="receipt-note receipt-note-warn" role="alert">
                                {resolved.error}
                            </p>
                        )}

                        {resolved?.url && (
                            <img
                                className="receipt-image"
                                src={resolved.url}
                                alt={`Payment receipt uploaded by ${booking.guest?.fullName || 'the guest'}`}
                                onClick={() => setZoomed((value) => !value)}
                                title={zoomed ? 'Click to fit' : 'Click to zoom'}
                            />
                        )}
                    </div>
                </div>

                <footer className="receipt-foot">
                    <div className="receipt-foot-left">
                        {resolved?.url && (
                            <>
                                <button
                                    type="button"
                                    className="receipt-btn"
                                    onClick={() => setZoomed((value) => !value)}
                                >
                                    {zoomed ? 'Fit to screen' : 'Zoom in'}
                                </button>
                                {/* Full resolution in its own tab, for a
                                    screenshot too dense to read inline. The
                                    signed link expires shortly either way. */}
                                <a
                                    className="receipt-btn"
                                    href={resolved.url}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Open full size
                                </a>
                            </>
                        )}
                    </div>

                    <div className="receipt-foot-right">
                        {pending ? (
                            <>
                                <button
                                    type="button"
                                    className="receipt-btn receipt-btn-danger"
                                    onClick={() => {
                                        onCancel?.(booking)
                                        onClose?.()
                                    }}
                                >
                                    Reject &amp; Cancel
                                </button>
                                {/* Same action as the table's Approve, placed
                                    where the receipt was actually reviewed. */}
                                <button
                                    type="button"
                                    className="receipt-btn receipt-btn-primary"
                                    onClick={() => {
                                        onApprove?.(booking)
                                        onClose?.()
                                    }}
                                >
                                    Verified — Approve
                                </button>
                            </>
                        ) : (
                            <button type="button" className="receipt-btn" onClick={onClose}>
                                Close
                            </button>
                        )}
                    </div>
                </footer>
            </div>
        </div>
    )
}
