import { useMemo, useState } from 'react'
import '../css/bookings-manage.css'

// Sample data — replace with database bookings later.
// Shape is intentionally close to what a booking record will hold so the
// table columns below map straight onto the real data when it arrives.
const SAMPLE_BOOKINGS = [
    {
        id: 'CB-1042',
        guestName: 'Maria Santos',
        unit: 'Villa 2',
        checkIn: '2026-07-25',
        checkOut: '2026-07-26',
        schedule: 'Day and Night',
        total: 8500,
        payment: 'paid-full',
        status: 'upcomming',
    },
    {
        id: 'CB-1041',
        guestName: 'Jose Reyes',
        unit: 'Cabin 1',
        checkIn: '2026-07-22',
        checkOut: '2026-07-22',
        schedule: 'Day Time',
        total: 4200,
        payment: 'down-payment',
        status: 'active',
    },
    {
        id: 'CB-1039',
        guestName: 'Andrea Cruz',
        unit: 'Villa 1',
        checkIn: '2026-07-18',
        checkOut: '2026-07-19',
        schedule: 'Night and Day',
        total: 9100,
        payment: 'paid-full',
        status: 'completed',
    },
]

const STATUS_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'upcomming', label: 'Upcomming' },
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Completed' },
]

const STATUS_BADGE = {
    upcomming: { label: 'Upcomming', className: 'is-upcomming' },
    active: { label: 'Active', className: 'is-active' },
    completed: { label: 'Completed', className: 'is-completed' },
    cancelled: { label: 'Cancelled', className: 'is-cancelled' },
}

const PAYMENT_BADGE = {
    'paid-full': { label: 'Paid Full', className: 'is-paid' },
    'down-payment': { label: 'Down Payment', className: 'is-dp' },
    unpaid: { label: 'Unpaid', className: 'is-unpaid' },
}

function formatDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

function formatRange(checkIn, checkOut) {
    if (checkIn === checkOut) return formatDate(checkIn)
    return `${formatDate(checkIn)} → ${formatDate(checkOut)}`
}

export default function BookingsManage() {
    // Swap SAMPLE_BOOKINGS for real data (props / fetch) when the backend is ready.
    const [bookings] = useState(SAMPLE_BOOKINGS)
    const [filter, setFilter] = useState('all')
    const [query, setQuery] = useState('')

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase()
        return bookings.filter((b) => {
            const matchesFilter = filter === 'all' || b.status === filter
            const matchesQuery =
                q === '' ||
                b.guestName.toLowerCase().includes(q) ||
                b.id.toLowerCase().includes(q) ||
                b.unit.toLowerCase().includes(q)
            return matchesFilter && matchesQuery
        })
    }, [bookings, filter, query])

    const countFor = (id) =>
        id === 'all' ? bookings.length : bookings.filter((b) => b.status === id).length

    return (
        <div className="bookings-manage">
            <div className="bookings-toolbar">
                <div className="bookings-search">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="7" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="search"
                        placeholder="Search guest, booking ID, or unit…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Search bookings"
                    />
                </div>

                <div className="bookings-filters" role="tablist" aria-label="Filter by status">
                    {STATUS_FILTERS.map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={filter === id}
                            className={filter === id ? 'bookings-filter active' : 'bookings-filter'}
                            onClick={() => setFilter(id)}
                        >
                            {label}
                            <span className="bookings-filter-count">{countFor(id)}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="bookings-panel">
                {visible.length === 0 ? (
                    <div className="bookings-empty">
                        <svg
                            className="bookings-empty-icon"
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
                        <h3 className="bookings-empty-title">No bookings found</h3>
                        <p className="bookings-empty-text">
                            {query || filter !== 'all'
                                ? 'Try a different search or status filter.'
                                : 'New reservations will appear here once guests start booking.'}
                        </p>
                    </div>
                ) : (
                    <div className="bookings-table-wrap">
                        <table className="bookings-table">
                            <thead>
                                <tr>
                                    <th>Booking ID</th>
                                    <th>Guest</th>
                                    <th>Unit</th>
                                    <th>Stay</th>
                                    <th>Schedule</th>
                                    <th>Payment</th>
                                    <th>Status</th>
                                    <th className="col-total">Total</th>
                                    <th className="col-actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((b) => {
                                    const status = STATUS_BADGE[b.status] || {}
                                    const payment = PAYMENT_BADGE[b.payment] || {}
                                    return (
                                        <tr key={b.id}>
                                            <td className="col-id">{b.id}</td>
                                            <td>{b.guestName}</td>
                                            <td>{b.unit}</td>
                                            <td>{formatRange(b.checkIn, b.checkOut)}</td>
                                            <td>{b.schedule}</td>
                                            <td>
                                                <span className={`bookings-badge ${payment.className || ''}`}>
                                                    {payment.label || b.payment}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`bookings-badge ${status.className || ''}`}>
                                                    {status.label || b.status}
                                                </span>
                                            </td>
                                            <td className="col-total">₱{Number(b.total).toLocaleString()}</td>
                                            <td className="col-actions">
                                                <button type="button" className="bookings-action">
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
