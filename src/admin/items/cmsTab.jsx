import { useState } from 'react'
import '../css/tab.css'

// CMS is the section for the site's own copy — the words and pictures on the
// public pages, as opposed to what the resort sells and who has booked it.
// One tab per block of the home page, in the order a visitor scrolls past
// them, so finding the right tab is the same as remembering where on the page
// the thing sits.
const cmsTabs = [
    { id: 'hero', label: 'Hero Banner' },
    { id: 'welcome', label: 'Welcome Section' },
    { id: 'offers', label: 'What We Offer' },
    // Heading only — the cards come from the accommodation catalog, which is
    // edited in Units. The tab says so on screen.
    { id: 'accommodations', label: 'Accommodations' },
]

export default function CmsTab({ active, onChange }) {
    const [internalActive, setInternalActive] = useState('hero')
    const current = active ?? internalActive

    const handleSelect = (id) => {
        setInternalActive(id)
        if (onChange) onChange(id)
    }

    return (
        <div className="tab-bar" role="tablist" aria-label="CMS view">
            {cmsTabs.map(({ id, label }) => (
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
