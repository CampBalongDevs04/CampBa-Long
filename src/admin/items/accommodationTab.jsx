import { useState } from 'react'
import '../css/tab.css'

// The Units section has two jobs that want very different screens: who is in
// which unit on a given day, and what the resort sells and for how much. They
// were one page until the second one existed; these tabs are that split.
const unitTabs = [
    { id: 'availability', label: 'Availability' },
    { id: 'manage', label: 'Manage Accommodations' },
    { id: 'addons', label: 'Manage Add-ons' },
]

export default function AccommodationTab({ active, onChange }) {
    const [internalActive, setInternalActive] = useState('availability')
    const current = active ?? internalActive

    const handleSelect = (id) => {
        setInternalActive(id)
        if (onChange) onChange(id)
    }

    return (
        <div className="tab-bar" role="tablist" aria-label="Units view">
            {unitTabs.map(({ id, label }) => (
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
