import { useState } from 'react'
import '../css/accommodationCount.css'
import {
    ACCOMMODATION_TYPES,
    buildUnits,
    getUnitStatus,
    assignRandomAvailableUnit,
    toISODate,
    formatShortDate,
} from '../../data/accommodationInventory.js'

const UNIT_STATUS = {
    available: { label: 'Available', className: 'is-available' },
    pending: { label: 'Waiting for Payment', className: 'is-pending' },
    booked: { label: 'Booked', className: 'is-booked' },
}

// Re-exported so existing imports from this file keep working.
export { ACCOMMODATION_TYPES, getUnitStatus, assignRandomAvailableUnit }

export default function AccommodationCount() {
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
                {ACCOMMODATION_TYPES.map((type) => {
                    const units = buildUnits(type, selectedDate)
                    const availableCount = units.filter((unit) => unit.status === 'available').length
                    const pendingCount = units.filter((unit) => unit.status === 'pending').length

                    return (
                        <div className="accommodation-card" key={type.prefix}>
                            <div className="accommodation-card-header">
                                <div className="accommodation-card-image">
                                    {type.image ? (
                                        <img src={type.image} alt={type.name} />
                                    ) : (
                                        <span className="accommodation-card-image-placeholder">
                                            No Image
                                        </span>
                                    )}
                                </div>
                                <div className="accommodation-card-info">
                                    <p className="accommodation-card-name">{type.name}</p>
                                    <p className="accommodation-card-count">
                                        {availableCount} <span>/ {type.total} available</span>
                                    </p>
                                    {pendingCount > 0 && (
                                        <p className="accommodation-card-pending">
                                            {pendingCount} waiting for payment
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
