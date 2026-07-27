import '../css/units.css'
import { useAccommodationDB, getBookingStats, getDayOccupancy } from '../../data/accommodationDB.js'

const units = [
    {
        name: "Total Booking",
        count: null,
        key: "totalBooking",
    },
    {
        name: "Upcomming",
        count: null,
        key: "upcomming",
    },
    {
        name: "Active",
        count: null,
        key: "active",
    },
    {
        name: "Revenue",
        count: null,
        key: "revenue",
        isCurrency: true,
    },
    {
        name: "Pending Payment",
        count: null,
        key: "pendingPayment",
    },
    {
        name: "Units Free Today",
        count: null,
        key: "unitsFreeToday",
    },
]

function formatCount(unit, stats) {
    const value = stats?.[unit.key] ?? unit.count ?? 0
    if (unit.isCurrency) {
        return `₱${Number(value).toLocaleString()}`
    }
    return Number(value).toLocaleString()
}

// Counts come from the accommodation database unless a `stats` prop overrides
// them, so the cards move the moment a guest books or an admin cancels.
export default function Units({ stats }) {
    useAccommodationDB()
    const occupancy = getDayOccupancy()
    const live = {
        ...getBookingStats(),
        unitsFreeToday: occupancy.available,
        ...stats,
    }

    return (
        <div className="units-holder">
            {units.map((unit) => (
                <div className="unit-card" key={unit.name}>
                    <p className="unit-card-count">{formatCount(unit, live)}</p>
                    <p className="unit-card-name">{unit.name}</p>
                </div>
            ))}
        </div>
    )
}
