import '../css/units.css'

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
]

function formatCount(unit, stats) {
    const value = stats?.[unit.key] ?? unit.count ?? 0
    if (unit.isCurrency) {
        return `₱${Number(value).toLocaleString()}`
    }
    return Number(value).toLocaleString()
}

export default function Units({ stats }) {
    return (
        <div className="units-holder">
            {units.map((unit) => (
                <div className="unit-card" key={unit.name}>
                    <p className="unit-card-count">{formatCount(unit, stats)}</p>
                    <p className="unit-card-name">{unit.name}</p>
                </div>
            ))}
        </div>
    )
}
