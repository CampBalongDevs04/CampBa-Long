import '../css/units.css'
import { useAccommodationDB, useBookingGroups, getBookingStats, getDayOccupancy } from '../../data/accommodationDB.js'

// Line icons drawn at 24×24 and stroked with currentColor, so a card's tone
// class colours its icon along with everything else in it.
const ICONS = {
    wallet: (
        <>
            <path d="M3 8a2.5 2.5 0 0 1 2.5-2.5H17A1.5 1.5 0 0 1 18.5 7v1" />
            <rect x="3" y="8" width="18" height="11" rx="2.5" />
            <path d="M21 11.5h-3.6a2.25 2.25 0 0 0 0 4.5H21" />
        </>
    ),
    calendar: (
        <>
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M3 10h18M8 3v4M16 3v4" />
        </>
    ),
    clock: (
        <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7v5.3l3.4 2" />
        </>
    ),
    guest: (
        <>
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20.5c0-3.6 3.1-5.8 7-5.8s7 2.2 7 5.8" />
        </>
    ),
    hourglass: (
        <>
            <path d="M6.5 3.5h11M6.5 20.5h11" />
            <path d="M8 3.5v3.2c0 1.7 4 3.3 4 5.3s-4 3.6-4 5.3v3.2" />
            <path d="M16 3.5v3.2c0 1.7-4 3.3-4 5.3s4 3.6 4 5.3v3.2" />
        </>
    ),
    // No ridge line down the middle: with one, a tent at 17px is a hazard sign.
    tent: (
        <>
            <path d="M12 4 2.5 20.5h19z" />
            <path d="m8.6 20.5 3.4-7 3.4 7" />
        </>
    ),
}

function Icon({ name }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[name]}
        </svg>
    )
}

// The four counts that sit beside the revenue panel. Each carries its own note
// so a number nobody explained ("3") reads as a sentence ("3 bookings nobody
// has paid for yet") without anyone having to ask what it counts.
const COUNT_CARDS = [
    { key: 'totalBooking', name: 'Total Bookings', note: 'Cancelled excluded', icon: 'calendar' },
    { key: 'upcomming', name: 'Upcoming', note: 'Booked, not yet arrived', icon: 'clock' },
    { key: 'active', name: 'Active Now', note: 'Guests on the grounds', icon: 'guest', liveTone: 'leaf' },
    { key: 'pendingPayment', name: 'Pending Payment', note: 'Needs a follow-up', icon: 'hourglass', liveTone: 'amber' },
]

const number = (value) => Number(value ?? 0).toLocaleString()

// Counts come from the accommodation database unless a `stats` prop overrides
// them, so the cards move the moment a guest books or an admin cancels.
export default function Units({ stats }) {
    useAccommodationDB()
    // getBookingStats() reads combined reservations too (booking_groups), so
    // this needs its own subscription — useAccommodationDB() alone only
    // re-renders when the single-unit bookings array changes identity, and
    // groups usually finish loading a beat later on the initial page load.
    // Without this, the cards showed last, stale numbers until something
    // else (switching tabs) forced a remount.
    useBookingGroups()
    const occupancy = getDayOccupancy()
    const live = {
        ...getBookingStats(),
        unitsFreeToday: occupancy.available,
        ...stats,
    }

    // `stats` may override the free count on its own, so occupied is derived
    // back from what is actually on screen rather than from occupancy.taken.
    const totalUnits = occupancy.total
    const freeToday = Math.min(Math.max(Number(live.unitsFreeToday ?? 0), 0), totalUnits)
    const takenToday = totalUnits - freeToday
    const takenPct = totalUnits ? Math.round((takenToday / totalUnits) * 100) : 0

    return (
        <div className="stat-board">
            {/* Revenue leads on its own dark panel: it is the number the owner
                opens this page for, and at equal weight it disappeared into
                the row beside "Active: 0". */}
            <article className="stat-hero">
                <div className="stat-head">
                    <span className="stat-chip"><Icon name="wallet" /></span>
                    <p className="stat-label">Revenue</p>
                </div>
                <p className="stat-hero-value">
                    <span className="stat-currency">₱</span>{number(live.revenue)}
                </p>
                <p className="stat-hero-note">Paid in full plus down payments received to date.</p>
                <div className="stat-hero-foot">
                    <div className="stat-mini">
                        <b>{number(live.totalBooking)}</b>
                        <span>Bookings counted</span>
                    </div>
                    <div className="stat-mini">
                        <b>{number(live.pendingPayment)}</b>
                        <span>Still unpaid</span>
                    </div>
                </div>
            </article>

            {COUNT_CARDS.map((card) => {
                const value = Number(live[card.key] ?? 0)
                // A tone is earned, not decorative: nothing is amber at zero,
                // so colour on this row always means "look here".
                const tone = value > 0 && card.liveTone ? ` tone-${card.liveTone}` : ''
                return (
                    <article className={`stat-card${tone}`} key={card.key}>
                        <div className="stat-head">
                            <span className="stat-chip"><Icon name={card.icon} /></span>
                            <p className="stat-label">{card.name}</p>
                        </div>
                        <p className="stat-value">{value.toLocaleString()}</p>
                        <p className="stat-note">{card.note}</p>
                    </article>
                )
            })}

            {/* Occupancy is a ratio, not a count — "16" means nothing without
                the 19 it is out of, so the card carries the whole board. */}
            <article className="stat-card stat-wide">
                <div className="stat-wide-lead">
                    <div className="stat-head">
                        <span className="stat-chip"><Icon name="tent" /></span>
                        <p className="stat-label">Units Free Today</p>
                    </div>
                    <p className="stat-value">
                        {freeToday.toLocaleString()}
                        <span className="stat-of">of {totalUnits.toLocaleString()}</span>
                    </p>
                </div>
                <div className="stat-wide-meter">
                    {totalUnits > 0 && totalUnits <= 48 ? (
                        <div className="occ-pips" aria-hidden="true">
                            {Array.from({ length: totalUnits }, (_, i) => (
                                <span className={`occ-pip${i < takenToday ? ' is-taken' : ''}`} key={i} />
                            ))}
                        </div>
                    ) : (
                        <div className="occ-bar" aria-hidden="true">
                            <span style={{ width: `${takenPct}%` }} />
                        </div>
                    )}
                    <div className="occ-legend">
                        <span className="occ-key is-taken">{takenToday.toLocaleString()} occupied</span>
                        <span className="occ-key">{freeToday.toLocaleString()} free</span>
                        <span className="occ-pct">{takenPct}% full</span>
                    </div>
                </div>
            </article>
        </div>
    )
}
