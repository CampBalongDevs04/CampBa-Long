import { useState } from 'react'
import '../css/tab.css'

// Every id here is a food_menu_items.category value — see FOOD_CATEGORIES in
// data/menuDB.js. FoodList filters itself on whichever one is active, so a tab
// whose id doesn't match a category shows an empty panel.
const foodTabs = [
    { id: 'all', label: 'All' },
    { id: 'breakfast', label: 'Foods' },
    { id: 'combo', label: 'Combo Meal' },
    { id: 'pre-order', label: 'Pre-Order' },
    { id: 'coffee', label: 'Beverages' },
]

export default function FoodTab({ active, onChange }) {
    const [internalActive, setInternalActive] = useState('all')
    const current = active ?? internalActive

    const handleSelect = (id) => {
        setInternalActive(id)
        if (onChange) onChange(id)
    }

    return (
        <div className="tab-bar" role="tablist" aria-label="Filter food menu">
            {foodTabs.map(({ id, label }) => (
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
