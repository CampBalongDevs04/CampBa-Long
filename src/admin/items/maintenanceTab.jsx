import { useState } from 'react'
import '../css/tab.css'

const maintenanceTabs = [
    { id: 'days', label: 'Maintenance Days' },
    { id: 'site', label: 'Website Blocker' },
]

export default function MaintenanceTab({ active, onChange }) {
    const [internalActive, setInternalActive] = useState('days')
    const current = active ?? internalActive

    const handleSelect = (id) => {
        setInternalActive(id)
        if (onChange) onChange(id)
    }

    return (
        <div className="tab-bar" role="tablist" aria-label="Maintenance view">
            {maintenanceTabs.map(({ id, label }) => (
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
