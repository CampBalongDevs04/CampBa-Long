import { useEffect, useState } from 'react'
import '../css/receipt-viewer.css'
import {
    getReceiptUrl,
    getBookingStage,
    DOWNPAYMENT_RATE,
    groupUnitsLabel,
    guestPartyLabel,
} from '../../data/accommodationDB.js'
import { splitFreeEntrance } from '../../data/entranceFee.js'

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

// When the reservation itself was made — as opposed to formatDateTime() above,
// which is when a screenshot arrived. Carries the year, unlike that one:
// receipts are read close to when they land, but a booking can be reopened
// long after, and "Aug 11" alone would be ambiguous by then.
function formatBookedAt(iso) {
    if (!iso) return '—'
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
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

// What the units on this reservation cost, before entrance and add-ons. Stored
// per-row for a single booking (`price`) and rolled up for a combined one
// (`unitSubtotal`), which is the only difference between the two shapes here.
function unitCost(booking) {
    const amount = booking.isGroup ? booking.unitSubtotal : booking.price
    return amount != null ? Number(amount) : null
}

// The entrance line's own arithmetic, in the words the guest's saved receipt
// uses (pages/components/receiptImage.js) — every head at the schedule's rate,
// then what came off it. Kids and the rate card's free-entrance inclusion are
// stored as one combined bucket on the row, so they are split back out here;
// see splitFreeEntrance() for why the split is recoverable at all.
//
// The senior and PWD counts are NOT arithmetic on this screen: the resort gives
// both discounts in person against an ID (see data/entranceFee.js), so what
// staff need here is the count, which is why it rides in the Guests fact above
// rather than as a deduction. A booking old enough to carry a stored senior
// discount still shows it — the row is read, never recomputed.
function entranceNotes(booking) {
    const entrance = booking.entrance ?? {}
    const { kidsApplied, kidsFree, perkApplied, perkSavings } = splitFreeEntrance({
        freeApplied: entrance.freeApplied,
        freeSavings: entrance.freeSavings,
        kids: booking.kids,
        perHead: entrance.perHead,
    })
    return [
        entrance.perHead > 0 ? `${formatPeso(entrance.perHead)}/head` : null,
        booking.pax ? `${booking.pax} pax` : null,
        kidsApplied > 0 ? `${kidsApplied} free (kids) −${formatPeso(kidsFree)}` : null,
        perkApplied > 0 ? `${perkApplied} free (inclusion) −${formatPeso(perkSavings)}` : null,
        entrance.seniorDiscount > 0
            ? `senior discount −${formatPeso(entrance.seniorDiscount)}`
            : null,
    ].filter(Boolean).join(' · ')
}

// One line of the breakdown: what it is, the arithmetic behind it, the amount.
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
    const itemOrders = booking.itemOrders ?? []

    // Everything the stay costs, line by line, so the down payment above can be
    // checked against the arithmetic it came from rather than taken on trust.
    // `stayTotal` is the stored figure (Postgres adds it up, same as it does the
    // down payment); the fallback only covers a row saved before it existed.
    const units = unitCost(booking)
    const entranceTotal = Number(booking.entrance?.total ?? 0)
    const addOnsTotal = orderTotal(foodOrders) + orderTotal(spaOrders) + orderTotal(itemOrders)
    const stayTotal = Number(booking.stayTotal ?? (units ?? 0) + entranceTotal + addOnsTotal)
    // What the desk still collects. A booking marked paid-full is settled
    // whatever the screenshots add up to — that flag IS staff saying so.
    const credited = booking.payment === 'paid-full' ? stayTotal : submitted
    const dueOnArrival = Math.max(0, Math.round((stayTotal - credited) * 100) / 100)

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
                            <dt>Booked on</dt>
                            <dd>{formatBookedAt(booking.createdAt)}</dd>
                        </div>
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
                        {/* The counts the desk acts on. Senior and PWD discounts
                            are given in person against an ID, so this is the
                            only place the amount of them is decided — a count
                            staff cannot see is a discount that cannot happen. */}
                        <div className="receipt-fact">
                            <dt>Guests</dt>
                            <dd>{guestPartyLabel(booking)}</dd>
                        </div>
                        <div className="receipt-fact">
                            <dt>Mobile</dt>
                            <dd>{booking.guest?.mobile || '—'}</dd>
                        </div>
                        <div className="receipt-fact">
                            <dt>Email</dt>
                            <dd>{booking.guest?.email || '—'}</dd>
                        </div>
                    </dl>

                    {/* One ledger rather than a section per kind: it is read top
                        to bottom and has to arrive at the total, which section
                        headings above a grand total actively work against. */}
                    <div className="receipt-orders">
                        <p className="receipt-orders-title">Cost breakdown</p>

                        <CostRow
                            label={booking.isGroup ? 'Accommodation' : booking.accomodationName}
                            note={
                                booking.isGroup
                                    ? groupUnitsLabel(booking.units)
                                    : booking.unitId
                            }
                            value={units != null ? formatPeso(units) : 'To be advised'}
                        />

                        {entranceTotal > 0 && (
                            <CostRow
                                label="Entrance fees"
                                note={entranceNotes(booking)}
                                value={formatPeso(entranceTotal)}
                            />
                        )}

                        {foodOrders.map((order, index) => (
                            <CostRow
                                key={`food-${index}`}
                                label={`Food · ${order.name}`}
                                note={order.quantity ? `× ${order.quantity}` : null}
                                value={formatPeso(order.total)}
                            />
                        ))}
                        {spaOrders.map((order, index) => (
                            <CostRow
                                key={`spa-${index}`}
                                label={`Spa · ${order.name}`}
                                note={order.quantity ? `× ${order.quantity}` : null}
                                value={formatPeso(order.total)}
                            />
                        ))}
                        {itemOrders.map((order, index) => (
                            <CostRow
                                key={`item-${index}`}
                                label={`Add-on · ${order.name}`}
                                note={order.quantity ? `× ${order.quantity}` : null}
                                value={formatPeso(order.total)}
                            />
                        ))}

                        <CostRow
                            label="Total cost of booking"
                            note="units, entrance and add-ons"
                            value={formatPeso(stayTotal)}
                            variant="receipt-order-total"
                        />
                        <CostRow
                            label={`Down payment (${Math.round(DOWNPAYMENT_RATE * 100)}%)`}
                            value={formatPeso(expected)}
                        />
                        {/* The figure the desk collects on arrival — what the
                            balance actually is, not half the total, once part
                            payments and a paid-full mark are taken off. */}
                        <CostRow
                            label={dueOnArrival > 0 ? 'Balance on arrival' : 'Settled'}
                            note={credited > 0 ? `${formatPeso(credited)} received` : null}
                            value={formatPeso(dueOnArrival)}
                        />
                    </div>

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
