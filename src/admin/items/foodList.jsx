import '../css/foodlist.css'
import {
    useFoodMenu,
    groupCoffeeMenu,
    formatMenuPrice,
    FOOD_CATEGORIES,
    FLAVORED_COFFEE_UPCHARGE,
} from '../../data/menuDB.js'
import {
    useAccommodationDB,
    listAddonOrders,
    hasStaffSession,
} from '../../data/accommodationDB.js'

// The Food Menu section of the dashboard: the menu on the left, what guests
// have actually ordered on the right.
//
// Both halves now come from Postgres. The menu used to be imported out of
// pages/foodmenu.jsx (so a price change meant a redeploy) and the orders were
// read out of a `cbl-my-bookings` localStorage key that stopped existing when
// bookings moved to the database — which is why this panel was permanently
// empty. Orders are read from the booking rows the staff session can see, so
// this shows every guest's order, not just whoever used this browser.

function formatOrderedAt(orderedAt) {
    if (!orderedAt) return ''
    const date = new Date(orderedAt)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })
}

function UserOrders() {
    useAccommodationDB()
    const orders = listAddonOrders('food')

    return (
        <aside className="foodlist-orders">
            <h3 className="foodlist-section-title">User Orders</h3>
            {orders.length === 0 ? (
                <div className="foodlist-orders-empty">
                    <svg
                        viewBox="0 0 24 24"
                        width="36"
                        height="36"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M3 6h18l-1.5 13a2 2 0 0 1-2 1.8H6.5a2 2 0 0 1-2-1.8Z" />
                        <path d="M8 10V5a4 4 0 0 1 8 0v5" />
                    </svg>
                    <p className="foodlist-orders-empty-title">No orders yet</p>
                    <p className="foodlist-orders-empty-text">
                        {hasStaffSession()
                            ? 'Guest food orders will appear here once they order from the menu.'
                            : 'Sign in with a staff account to see guest food orders.'}
                    </p>
                </div>
            ) : (
                <div className="foodlist-orders-rows">
                    {orders.map((order) => (
                        <article key={order.key} className="foodlist-order-card">
                            <div className="foodlist-order-top">
                                <span className="foodlist-order-guest">{order.guestName}</span>
                                <span className="foodlist-order-date">{formatOrderedAt(order.orderedAt)}</span>
                            </div>
                            <div className="foodlist-order-line">
                                <span className="foodlist-order-item">
                                    {order.name} <span className="foodlist-order-qty">×{order.quantity}</span>
                                </span>
                                <span className="foodlist-order-total">{formatMenuPrice(order.total)}</span>
                            </div>
                            {/* Which stay the kitchen is cooking for. */}
                            <p className="foodlist-order-booking">
                                {order.code}
                                {order.unitId ? ` · ${order.unitId}` : ''}
                            </p>
                        </article>
                    ))}
                </div>
            )}
        </aside>
    )
}

function ItemRows({ items }) {
    return (
        <div className="foodlist-rows">
            {items.map((item) => (
                <article key={item.id} className="foodlist-row">
                    <div className="foodlist-image">
                        <img src={item.image} alt={item.name} />
                    </div>
                    <div className="foodlist-info">
                        <h4 className="foodlist-name">{item.name}</h4>
                        <p className="foodlist-desc">{item.desc}</p>
                        {item.hasCoffeeOption && (
                            <p className="foodlist-note">
                                Guest picks the coffee — flavored adds PHP{' '}
                                {FLAVORED_COFFEE_UPCHARGE.toFixed(2)}
                            </p>
                        )}
                    </div>
                    <span className="foodlist-price">{formatMenuPrice(item.price)}</span>
                </article>
            ))}
        </div>
    )
}

function CoffeeTables({ groups }) {
    return (
        <div className="foodlist-coffee">
            <p className="foodlist-note">Prices in PHP, per cup size.</p>
            {groups.map((group) => (
                <div key={group.key} className="foodlist-coffee-group">
                    <h4 className="foodlist-coffee-title">{group.title}</h4>
                    <div className="foodlist-coffee-scroll">
                        <table className="foodlist-coffee-table">
                            <thead>
                                <tr>
                                    <th className="foodlist-coffee-flavor">Flavor</th>
                                    {group.sizeLabels.map((size) => (
                                        <th key={size}>{size}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {group.flavors.map((flavor) => (
                                    <tr key={flavor.name}>
                                        <td className="foodlist-coffee-flavor">{flavor.name}</td>
                                        {/* Per size column, so a flavor not sold
                                            in every cup size leaves a gap
                                            instead of shifting the row. */}
                                        {group.sizeLabels.map((size, i) => (
                                            <td key={size}>
                                                {flavor.items[i]
                                                    ? flavor.items[i].price.toFixed(2)
                                                    : '—'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    )
}

export default function FoodList({ category = 'all' }) {
    const menu = useFoodMenu()

    // Categories come from the catalog, so a new one needs a tab in
    // foodTab.jsx to be filterable but no change here; the 'all' tab shows
    // everything regardless. Bukal Cafe coffee has no per-flavor photos — it is
    // priced per cup size, so it renders as tables rather than image rows.
    const sections = FOOD_CATEGORIES
        .filter((section) => category === 'all' || section.id === category)
        .map((section) => ({
            ...section,
            items: menu.filter((item) => item.category === section.id),
        }))
        .filter((section) => section.items.length > 0)

    return (
        <div className="foodlist-layout">
            <div className="foodlist-panel">
                {sections.map((section) => (
                    <section key={section.id} className="foodlist-section">
                        <h3 className="foodlist-section-title">{section.title}</h3>
                        {section.id === 'coffee' ? (
                            <CoffeeTables groups={groupCoffeeMenu(section.items)} />
                        ) : (
                            <ItemRows items={section.items} />
                        )}
                    </section>
                ))}
            </div>
            <UserOrders />
        </div>
    )
}
