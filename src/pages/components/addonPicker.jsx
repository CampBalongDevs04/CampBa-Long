import './css/addonPicker.css'
import { useResortAddonItems } from '../../data/menuDB.js'
import { useAddonStock } from './useAddonStock.js'

function formatPeso(amount) {
    return `₱${Number(amount ?? 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`
}

// One item's row. Always calls useAddonStock — for an item with no
// stock_total set (the common case), passing a null itemId makes the hook's
// own guard skip polling entirely, so an unlimited add-on costs nothing
// extra; this only does real work for the few items staff have actually
// capped.
function AddonItem({ item, qty, checkIn, checkOut, scheduleKey, onQtyChange }) {
    const limited = item.stockTotal != null
    const stock = useAddonStock({
        itemId: limited ? item.id : null,
        checkIn: limited ? checkIn : null,
        checkOut,
        scheduleKey,
    })

    // While the first answer is still in flight (stock === null) the "+" stays
    // enabled — the server is what actually enforces the ceiling either way
    // (see add_booking_addon()'s stock check), this is only the UX head start.
    const atCap = limited && stock?.available != null && qty >= stock.available

    return (
        <div className={`addon-picker-item${qty > 0 ? ' is-picked' : ''}`}>
            <div className="addon-picker-item-info">
                <span className="addon-picker-item-name">{item.name}</span>
                <span className="addon-picker-item-price">{formatPeso(item.price)}</span>
                {limited && stock?.available != null && (
                    <span className={`addon-picker-item-stock${stock.available === 0 ? ' is-out' : ''}`}>
                        {stock.available > 0 ? `${stock.available} left` : 'None left for these dates'}
                    </span>
                )}
            </div>
            <div className="addon-picker-item-qty">
                <button
                    type="button"
                    aria-label={`Remove one ${item.name}`}
                    onClick={() => onQtyChange(qty - 1)}
                    disabled={qty <= 0}
                >
                    &minus;
                </button>
                <span aria-live="polite">{qty}</span>
                <button
                    type="button"
                    aria-label={`Add one ${item.name}`}
                    onClick={() => onQtyChange(qty + 1)}
                    disabled={atCap}
                >
                    +
                </button>
            </div>
        </div>
    )
}

// Inline, not a popup — appears under the accommodation carousel the moment a
// unit is picked, the same way StayLength appears under the schedule cards
// once one is chosen (see booking.jsx). `picks` is a plain { itemId: qty }
// map held on the booking page, same shape and same lifecycle as kids/
// seniors/pwd: nothing is sent to the database here. reserve() is what turns
// a non-zero pick into an actual order, right after the booking it attaches
// to exists.
//
// `checkIn`/`checkOut`/`scheduleKey` are the guest's current stay window —
// only needed for items with a stock ceiling (see AddonItem above), so
// nothing changes for a booking page render before a schedule is picked.
export default function AddonPicker({ picks, onChange, checkIn, checkOut, scheduleKey }) {
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
                {items.map((item) => (
                    <AddonItem
                        key={item.id}
                        item={item}
                        qty={picks[item.id] ?? 0}
                        checkIn={checkIn}
                        checkOut={checkOut}
                        scheduleKey={scheduleKey}
                        onQtyChange={(qty) => setQty(item.id, qty)}
                    />
                ))}
            </div>
        </div>
    )
}
