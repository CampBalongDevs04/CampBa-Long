import '../css/tabFoodSpa.css'
import {
    useAccommodationDB,
    useBookingGroups,
    listBookingsWithAddons,
    getBookingStage,
    formatShortDate,
    hasStaffSession,
} from '../../data/accommodationDB.js'

// Shared panel behind the Other Services tabs on the overview (All / Food /
// Spa). Each tab is this component with a different `kind`, so the three can
// never disagree about what a guest ordered — same arrangement as
// overview-list.jsx behind the booking tabs.
//
// One card per BOOKING, not per order line: staff work per guest ("table 3
// wants two Sisig and a foot spa"), so the lines are grouped under the stay
// they belong to rather than listed flat.

const STAGE_LABEL = {
    pending: 'For Verification',
    upcoming: 'Upcomming',
    active: 'Active',
    completed: 'Completed',
    cancelled: 'Cancelled',
}

function formatPeso(amount) {
    return `₱${Number(amount ?? 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`
}

// When the order was placed — stamped by Postgres, not by the guest's clock.
function formatOrderedAt(orderedAt) {
    if (!orderedAt) return ''
    const date = new Date(orderedAt)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })
}

function stayLabel(booking) {
    const from = formatShortDate(booking.checkIn)
    const to = formatShortDate(booking.checkOut)
    const dates = from === to ? from : `${from} – ${to}`
    return booking.schedule ? `${dates} · ${booking.schedule.time}` : dates
}

function OrderGroup({ title, lines, total }) {
    if (lines.length === 0) return null

    return (
        <div className="orderService-group">
            <div className="orderService-group-head">
                <h4 className="orderService-group-title">{title}</h4>
                <span className="orderService-group-total">{formatPeso(total)}</span>
            </div>
            <ul className="orderService-lines">
                {lines.map((line) => (
                    <li key={line.key} className="orderService-line">
                        <span className="orderService-line-name">
                            {line.name}
                            <span className="orderService-line-qty">×{line.quantity}</span>
                        </span>
                        <span className="orderService-line-when">{formatOrderedAt(line.orderedAt)}</span>
                        <span className="orderService-line-total">{formatPeso(line.total)}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default function AddonOrderPanel({ kind = 'all', emptyTitle, emptyText }) {
    useAccommodationDB()
    // listBookingsWithAddons() reads combined reservations too — see the
    // comment in units.jsx on why this needs its own subscription.
    useBookingGroups()
    const entries = listBookingsWithAddons(kind)

    if (entries.length === 0) {
        return (
            <div className="orderService-panel">
                <div className="orderService-empty">
                    <svg
                        className="orderService-empty-icon"
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
                    <h3 className="orderService-empty-title">{emptyTitle}</h3>
                    <p className="orderService-empty-text">
                        {/* An empty board is ambiguous: nobody has ordered, or
                            this account cannot read the bookings table. Say
                            which, rather than looking broken. */}
                        {hasStaffSession()
                            ? emptyText
                            : 'Sign in with a staff account to see guest orders.'}
                    </p>
                </div>
            </div>
        )
    }

    const grandTotal = entries.reduce(
        (sum, entry) => sum + entry.foodTotal + entry.spaTotal + entry.itemsTotal, 0
    )

    return (
        <div className="orderService-panel">
            <div className="orderService-summary">
                <span>
                    {entries.length} booking{entries.length > 1 ? 's' : ''} with orders
                </span>
                <span className="orderService-summary-total">{formatPeso(grandTotal)}</span>
            </div>

            {entries.map(({ booking, food, spa, items, foodTotal, spaTotal, itemsTotal }) => {
                const stage = getBookingStage(booking)
                return (
                    <article key={booking.id} className="orderService-card">
                        <div className="orderService-card-top">
                            <span className="orderService-guest">
                                {booking.guest?.fullName || 'Guest'}
                            </span>
                            <span className={`orderService-stage stage-${stage}`}>
                                {STAGE_LABEL[stage] ?? stage}
                            </span>
                        </div>
                        <p className="orderService-meta">
                            {booking.code ?? booking.id} · {booking.accomodationName}
                            {booking.unitId ? ` · ${booking.unitId}` : ''} — {stayLabel(booking)}
                        </p>

                        <OrderGroup title="Food ordered" lines={food} total={foodTotal} />
                        <OrderGroup title="Spa availed" lines={spa} total={spaTotal} />
                        <OrderGroup title="Add-ons requested" lines={items} total={itemsTotal} />

                        <p className="orderService-card-total">
                            <span>Add-ons on this booking</span>
                            <strong>{formatPeso(foodTotal + spaTotal + itemsTotal)}</strong>
                        </p>
                    </article>
                )
            })}
        </div>
    )
}
