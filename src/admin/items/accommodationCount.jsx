import { useState } from 'react'
import '../css/accommodationCount.css'
import {
    ACCOMMODATION_TYPES,
    listUnitIds,
    getUnitDayDetail,
    useAccommodationDB,
    toISODate,
    formatShortDate,
} from '../../data/accommodationDB.js'

const UNIT_STATUS = {
    available: { label: 'Available', className: 'is-available' },
    pending: { label: 'Waiting for Payment', className: 'is-pending' },
    booked: { label: 'Booked', className: 'is-booked' },
}

// Types sharing a poolId (type.poolId ?? type.id, same key listUnitIds() uses)
// collapse into one array together, in catalog order. A type with no pool is
// simply a group of one — this is the whole grouping, not a special case of it.
//
// Pooled groups sort after every single-card group, regardless of where the
// catalog's sort_order happens to put them. A wide, `grid-column: 1 / -1`
// card wedged between two-column cards breaks the grid's reading order
// wherever it lands — pushing it to the end is what keeps the ordinary cards
// reading as an unbroken 2-column block, with the pooled card appended after.
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
    // Live view of the same database the booking page writes to: a guest
    // confirming a stay shows up here without a refresh.
    useAccommodationDB()
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
                {/* Types that share a pool (Small Tent, Big Tent, Tent Pitching —
                    see 20260803120000_shared_tent_pool.sql) are three names sold
                    over the same four physical spots. Three separate cards each
                    listing the same four unit badges under a different name was
                    the actual bug here — this groups by pool instead, so a shared
                    pool gets ONE card with one honest count, and everything
                    unpooled (poolId null) still gets its own card exactly as
                    before, one group of one. */}
                {groupByPool(ACCOMMODATION_TYPES).map((group) => {
                    const pooled = group.length > 1
                    const name = group.map((type) => type.name).join(' · ')
                    const image = group.find((type) => type.image)?.image ?? null

                    // Every member of a pool resolves to the same shared unit
                    // list, so any one of them answers for the whole group.
                    // Per-unit breakdown for the selected day: a unit can be
                    // taken for only part of it (Day Time 10-5) and still be
                    // free that evening, so each booked block is listed with
                    // its hours instead of blacking out the whole day.
                    const units = listUnitIds(group[0].id).map((id) => ({
                        id,
                        ...getUnitDayDetail(id, selectedDate),
                    }))
                    const availableCount = units.filter((unit) => unit.status === 'available').length
                    const pendingCount = units.filter((unit) => unit.status === 'pending').length

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
