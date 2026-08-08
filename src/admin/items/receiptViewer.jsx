import { useEffect, useState } from 'react'
import '../css/receipt-viewer.css'
import {
    getReceiptUrl,
    getBookingStage,
    DOWNPAYMENT_RATE,
    groupUnitsLabel,
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

// When a screenshot was sent. The time matters here in a way the date alone
// does not: two receipts on the same day are told apart by it.
function formatDateTime(iso) {
    if (!iso) return null
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
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
    // null until the signed URLs come back — that absence IS the loading state,
    // so nothing has to be set from inside the effect body.
    const [resolved, setResolved] = useState(null)
    // Receipts are phone screenshots: tall and narrow. Fitted to the panel by
    // default so the whole thing is visible, with a click to blow one up on the
    // reference number, which is usually the part staff need to read. Held per
    // sheet, because a booking can carry more than one.
    const [zoomedIndex, setZoomedIndex] = useState(null)

    // EVERY screenshot on this booking, oldest first. A guest who orders food
    // after paying owes the difference and sends a second one, so showing only
    // the latest would leave staff verifying a part-payment against the full
    // amount with no way to see where the rest went.
    //
    // Deliberately NOT wrapped in useMemo. Nothing depends on this array's
    // identity — pathKey below is the stable dependency, and it is a string —
    // so memoising it bought nothing, while the hand-written dependency list
    // ([booking?.receipts, booking?.receiptPath]) was narrower than the one
    // React Compiler infers from the body (booking). Facing that mismatch the
    // compiler refuses to touch the component at all, so one useMemo that was
    // never load-bearing was costing the whole viewer its optimization.
    const withPaths = (booking?.receipts ?? []).filter((entry) => entry.path)
    // Bookings taken before receipts became a list carry a single path on the
    // row and no history to go with it.
    const receipts = withPaths.length > 0
        ? withPaths
        : booking?.receiptPath
            ? [{ path: booking.receiptPath, amount: null, uploadedAt: null }]
            : []

    // A stable dependency. The booking object is rebuilt on every store poll, so
    // depending on the array itself would re-mint every signed URL twice a
    // minute and flicker the images out from under whoever is reading them.
    const pathKey = receipts.map((entry) => entry.path).join('|')

    useEffect(() => {
        if (!pathKey) return
        // Replies that land after this viewer is gone must not be applied.
        let current = true
        Promise.all(pathKey.split('|').map((path) => getReceiptUrl(path)))
            .then((results) => {
                if (!current) return
                setResolved(
                    results.map((result) =>
                        result.ok ? { url: result.url } : { error: result.message },
                    ),
                )
            })
        return () => {
            current = false
        }
    }, [pathKey])

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
    // What the receipt should actually say: the down payment, not the stay
    // total. This is the figure being verified — 50% of the unit rate, the
    // entrance fees and any food or spa the guest ordered, computed by the
    // database rather than here so it always matches what the guest was shown.
    const expected = booking.downpayment
        ?? (booking.stayTotal != null ? booking.stayTotal * DOWNPAYMENT_RATE : null)
    // What has been credited across every screenshot, and whether that covers
    // the amount asked for. A shortfall is normal rather than suspicious: it is
    // what add-ons ordered after a payment look like.
    const submitted = Number(booking.paidSubmitted ?? 0)
    const shortfall = expected != null
        ? Math.max(0, Math.round((expected - submitted) * 100) / 100)
        : 0

    // No image to show — either the guest uploaded nothing, or the booking
    // predates the storage bucket and only recorded that a receipt existed.
    const missingImage = receipts.length > 0
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
                            <dt>Submitted so far</dt>
                            <dd>
                                {formatPeso(submitted)}
                                {receipts.length > 1 ? ` · ${receipts.length} receipts` : ''}
                                {shortfall > 0 ? ` · ${formatPeso(shortfall)} short` : ''}
                            </dd>
                        </div>
                        <div className="receipt-fact">
                            <dt>{booking.isGroup ? 'Units' : 'Unit'}</dt>
                            <dd>
                                {booking.isGroup
                                    ? groupUnitsLabel(booking.units) || 'Combined reservation'
                                    : `${booking.accomodationName}${booking.unitId ? ` · ${booking.unitId}` : ''}`}
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

                    <div className="receipt-stage">
                        {missingImage && (
                            <p className="receipt-note receipt-note-warn" role="alert">
                                {missingImage}
                            </p>
                        )}

                        {receipts.length > 0 && (
                            <div className="receipt-sheets">
                                {receipts.map((entry, index) => {
                                    const state = resolved?.[index]
                                    const zoomed = zoomedIndex === index
                                    const when = formatDateTime(entry.uploadedAt)
                                    return (
                                        <figure
                                            className={`receipt-sheet${zoomed ? ' is-zoomed' : ''}`}
                                            key={`${entry.path}-${index}`}
                                        >
                                            {/* A single receipt needs no label —
                                                it is obvious what it is. */}
                                            {receipts.length > 1 && (
                                                <figcaption className="receipt-sheet-caption">
                                                    <span className="receipt-sheet-index">
                                                        Receipt {index + 1} of {receipts.length}
                                                    </span>
                                                    <span className="receipt-sheet-meta">
                                                        {entry.amount != null ? formatPeso(entry.amount) : ''}
                                                        {entry.amount != null && when ? ' · ' : ''}
                                                        {when ?? ''}
                                                    </span>
                                                </figcaption>
                                            )}

                                            {!state && (
                                                <p className="receipt-note">Loading receipt…</p>
                                            )}

                                            {state?.error && (
                                                <p className="receipt-note receipt-note-warn" role="alert">
                                                    {state.error}
                                                </p>
                                            )}

                                            {state?.url && (
                                                <>
                                                    <img
                                                        className="receipt-image"
                                                        src={state.url}
                                                        alt={
                                                            receipts.length > 1
                                                                ? `Payment receipt ${index + 1} of ${receipts.length} uploaded by ${booking.guest?.fullName || 'the guest'}`
                                                                : `Payment receipt uploaded by ${booking.guest?.fullName || 'the guest'}`
                                                        }
                                                        onClick={() =>
                                                            setZoomedIndex(zoomed ? null : index)
                                                        }
                                                        title={zoomed ? 'Click to fit' : 'Click to zoom'}
                                                    />
                                                    {/* Full resolution in its own
                                                        tab, for a screenshot too
                                                        dense to read inline. The
                                                        signed link expires shortly
                                                        either way. */}
                                                    <a
                                                        className="receipt-sheet-link"
                                                        href={state.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        Open full size
                                                    </a>
                                                </>
                                            )}
                                        </figure>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <footer className="receipt-foot">
                    {/* Zooming and opening full size are per screenshot now, so
                        they live under each image rather than down here where
                        they could only ever have meant one of them. */}
                    <div className="receipt-foot-left">
                        {receipts.length > 0 && (
                            <p className="receipt-foot-hint">
                                {receipts.length > 1
                                    ? `${receipts.length} receipts on this booking — click any image to zoom`
                                    : 'Click the image to zoom'}
                            </p>
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
