import { useState } from 'react'
import '../css/tab.css'

const bookingTabs = [
    { id: 'all', label: 'All' },
    { id: 'upcomming', label: 'Upcomming' },
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Completed' },
    { id: 'paid-full', label: 'Paid Full' },
    { id: 'down-payment', label: 'Down Payment' },
]

export default function Tab({ active, onChange }) {
    const [internalActive, setInternalActive] = useState('all')
    const current = active ?? internalActive

    const handleSelect = (id) => {
        setInternalActive(id)
        if (onChange) onChange(id)
    }

    return (
        <div className="tab-bar" role="tablist" aria-label="Filter bookings">
            {bookingTabs.map(({ id, label }) => (
                <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={current === id}
                    className={current === id ? 'tab-item active' : 'tab-item'}
                    onClick={() => handleSelect(id)}
                >
                    {label}
                </button>
            ))}
        </div>
    )
}
