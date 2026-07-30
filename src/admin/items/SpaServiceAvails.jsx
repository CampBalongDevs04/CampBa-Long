import '../css/tabFoodSpa.css'
import {
    useAccommodationDB,
    summariseAddonOrders,
    hasStaffSession,
} from '../../data/accommodationDB.js'
import { useSpaServices } from '../../data/menuDB.js'

// "Avails" tab of the Spa section. The overview's Spa tab answers "what did
// this guest book"; this one answers the other question staff ask — "which
// treatments are being availed, and by whom" — so it is rolled up per service
// with the guests waiting on each one listed underneath.

function formatPeso(amount) {
    return `₱${Number(amount ?? 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`
}

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

export default function SpaServiceAvails() {
    useAccommodationDB()
    const services = useSpaServices()
    const availed = summariseAddonOrders('spa')

    if (availed.length === 0) {
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
                    <h3 className="orderService-empty-title">No Spa avails yet</h3>
                    <p className="orderService-empty-text">
                        {hasStaffSession()
                            ? 'Once guests avail a treatment, each service and who booked it appears here.'
                            : 'Sign in with a staff account to see guest avails.'}
                    </p>
                </div>
            </div>
        )
    }

    const totalAvailed = availed.reduce((sum, entry) => sum + entry.quantity, 0)
    const grandTotal = availed.reduce((sum, entry) => sum + entry.total, 0)

    return (
        <div className="orderService-panel">
            <div className="orderService-summary">
                <span>
                    {totalAvailed} session{totalAvailed > 1 ? 's' : ''} across{' '}
                    {availed.length} treatment{availed.length > 1 ? 's' : ''}
                </span>
                <span className="orderService-summary-total">{formatPeso(grandTotal)}</span>
            </div>

            {availed.map((entry) => {
                // Matched on the catalog id the order line carries; orders taken
                // before spa_services existed fall back to the name they were
                // stored under, so nothing drops off this list.
                const service =
                    services.find((item) => item.id === entry.itemId) ??
                    services.find((item) => item.name === entry.name) ??
                    null

                return (
                    <article key={entry.key} className="spa-avail-row">
                        <div className="spa-avail-image">
                            {service?.image ? (
                                <img src={service.image} alt={entry.name} />
                            ) : (
                                <span aria-hidden="true">🧖</span>
                            )}
                        </div>

                        <div className="spa-avail-info">
                            <h4 className="spa-avail-name">{entry.name}</h4>
                            <p className="spa-avail-sub">
                                {service?.duration ? `${service.duration} · ` : ''}
                                {formatPeso(service?.price ?? entry.guests[0]?.unitPrice)} each
                            </p>
                            <ul className="spa-avail-guests">
                                {entry.guests.map((line) => (
                                    <li key={line.key}>
                                        <span className="spa-avail-guest-name">{line.guestName}</span>
                                        <span className="spa-avail-guest-meta">
                                            {line.code} · ×{line.quantity}
                                            {line.orderedAt ? ` · ${formatOrderedAt(line.orderedAt)}` : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="spa-avail-figures">
                            <span className="spa-avail-count">×{entry.quantity}</span>
                            <span className="spa-avail-total">{formatPeso(entry.total)}</span>
                        </div>
                    </article>
                )
            })}
        </div>
    )
}
