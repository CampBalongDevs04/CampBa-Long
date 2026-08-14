import './css/addonPicker.css'
import { useResortAddonItems } from '../../data/menuDB.js'

function formatPeso(amount) {
    return `₱${Number(amount ?? 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`
}

// Inline, not a popup — appears under the accommodation carousel the moment a
// unit is picked, the same way StayLength appears under the schedule cards
// once one is chosen (see booking.jsx). `picks` is a plain { itemId: qty }
// map held on the booking page, same shape and same lifecycle as kids/
// seniors/pwd: nothing is sent to the database here. reserve() is what turns
// a non-zero pick into an actual order, right after the booking it attaches
// to exists.
export default function AddonPicker({ picks, onChange }) {
    const items = useResortAddonItems()
    if (items.length === 0) return null

    const setQty = (id, qty) => {
        const next = { ...picks }
        if (qty <= 0) delete next[id]
        else next[id] = qty
        onChange(next)
    }

    return (
        <div className="addon-picker">
            <p className="addon-picker-label">Add anything to your stay?</p>
            <div className="addon-picker-list">
                {items.map((item) => {
                    const qty = picks[item.id] ?? 0
                    return (
                        <div className={`addon-picker-item${qty > 0 ? ' is-picked' : ''}`} key={item.id}>
                            <div className="addon-picker-item-info">
                                <span className="addon-picker-item-name">{item.name}</span>
                                <span className="addon-picker-item-price">{formatPeso(item.price)}</span>
                            </div>
                            <div className="addon-picker-item-qty">
                                <button
                                    type="button"
                                    aria-label={`Remove one ${item.name}`}
                                    onClick={() => setQty(item.id, qty - 1)}
                                    disabled={qty <= 0}
                                >
                                    &minus;
                                </button>
                                <span aria-live="polite">{qty}</span>
                                <button
                                    type="button"
                                    aria-label={`Add one ${item.name}`}
                                    onClick={() => setQty(item.id, qty + 1)}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
