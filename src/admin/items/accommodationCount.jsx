import { useState } from 'react'
import '../css/accommodationCount.css'
import {
    ACCOMMODATION_TYPES,
    listUnitIds,
    getUnitDayDetail,
    useAccommodationDB,
    useBookingGroups,
    toISODate,
    formatShortDate,
} from '../../data/accommodationDB.js'

// The life of a held unit, in the order it moves through: nobody has paid, the
// receipt has been verified, the balance has been settled. 'Booked' is the end
// of that road, not the start of it — a unit nobody has paid for yet says so.
const UNIT_STATUS = {
    available: { label: 'Available', className: 'is-available' },
    pending: { label: 'Waiting for Payment', className: 'is-pending' },
    reserved: { label: 'Reserved', className: 'is-reserved' },
    booked: { label: 'Booked', className: 'is-booked' },
}

function groupByPool(types) {
    const groups = new Map()
    for (const type of types) {
        const key = type.poolId ?? type.id
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(type)
    }
    return [...groups.values()].sort((a, b) => (a.length > 1) - (b.length > 1))
}

export default function AccommodationCount() {

    useAccommodationDB()
    // A unit held by a combined reservation takes its status from the GROUP
    // row, so this board has to re-render when those load or change too —
    // useAccommodationDB() alone only reacts to the single-unit array, and
    // groups land a beat later on the first page load (same reason units.jsx
    // subscribes to both).
    useBookingGroups()
    const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()))
    const isToday = selectedDate === toISODate(new Date())

    return (
        <div className="accommodation-panel">
            <div className="accommodation-date-bar">
                <label htmlFor="accommodation-date">
                    Showing availability for{' '}
                    <strong>{isToday ? 'Today' : formatShortDate(selectedDate)}</strong>
                </label>
                <input
                    id="accommodation-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                />
            </div>

            <div className="accommodation-holder">
                {

                }
                {groupByPool(ACCOMMODATION_TYPES).map((group) => {
                    const pooled = group.length > 1
                    const name = group.map((type) => type.name).join(' · ')
                    const image = group.find((type) => type.image)?.image ?? null

                    
                    const units = listUnitIds(group[0].id).map((id) => ({
                        id,
                        ...getUnitDayDetail(id, selectedDate),
                    }))
                    const countOf = (status) => units.filter((unit) => unit.status === status).length
                    const availableCount = countOf('available')
                    const pendingCount = countOf('pending')
                    const reservedCount = countOf('reserved')

                    return (
                        <div
                            className={`accommodation-card${pooled ? ' accommodation-card-pooled' : ''}`}
                            key={group[0].poolId ?? group[0].id}
                        >
                            <div className="accommodation-card-header">
                                <div className="accommodation-card-image">
                                    {image ? (
                                        <img src={image} alt={name} />
                                    ) : (
                                        <span className="accommodation-card-image-placeholder">
                                            No Image
                                        </span>
                                    )}
                                </div>
                                <div className="accommodation-card-info">
                                    <p className="accommodation-card-name">{name}</p>
                                    <p className="accommodation-card-count">
                                        {availableCount} <span>/ {units.length} available</span>
                                    </p>
                                    {pendingCount > 0 && (
                                        <p className="accommodation-card-pending">
                                            {pendingCount} waiting for payment
                                        </p>
                                    )}
                                    {reservedCount > 0 && (
                                        <p className="accommodation-card-reserved">
                                            {reservedCount} reserved
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="accommodation-unit-grid">
                                {units.map((unit) => (
                                    <div
                                        className={`accommodation-unit ${UNIT_STATUS[unit.status].className}`}
                                        key={unit.id}
                                    >
                                        <span className="accommodation-unit-id">{unit.id}</span>
                                        <span className="accommodation-unit-status">
                                            {UNIT_STATUS[unit.status].label}
                                        </span>
                                        {unit.slots.length > 0 && (
                                            <ul className="accommodation-unit-slots">
                                                {unit.slots.map((slot) => (
                                                    <li key={slot.bookingId} className="accommodation-unit-slot">
                                                        <span className="accommodation-slot-time">{slot.label}</span>
                                                        <span className="accommodation-slot-guest">{slot.guestName}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
