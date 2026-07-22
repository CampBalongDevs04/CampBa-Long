import { useEffect, useState } from 'react'
import '../css/foodlist.css'
import {
    breakfastItems,
    beverageItems,
    preOrderItems,
    lunchItems,
    coldDrinkItems,
    dinnerItems,
    dinnerDrinkItems,
} from '../../pages/foodmenu.jsx'

// Menu data is hardcoded in pages/foodmenu.jsx — this only regroups it
// under the categories used by the FoodTab filter.
const FOOD_SECTIONS = [
    { category: 'breakfast', title: 'Breakfast', items: breakfastItems },
    { category: 'combo', title: 'Combo Meal', items: beverageItems },
    { category: 'pre-order', title: 'Pre-Order', items: preOrderItems },
    { category: 'lunch', title: 'Lunch', items: lunchItems },
    { category: 'dinner', title: 'Dinner', items: dinnerItems },
    { category: 'beverages', title: 'Beverages · Cold Drinks', items: coldDrinkItems },
    { category: 'beverages', title: 'Beverages · Drinks', items: dinnerDrinkItems },
    // NOTE: 'combo' and 'pre-order' need matching tabs in foodTab.jsx to be
    // filterable; all sections still show under the 'all' tab regardless.
]

// Same key booking.jsx / foodmenu.jsx / mybooking.jsx persist bookings under —
// guest food orders live inside each booking's foodOrders array.
const BOOKINGS_STORAGE_KEY = 'cbl-my-bookings'

function loadUserOrders() {
    let bookings = []
    try {
        bookings = JSON.parse(localStorage.getItem(BOOKINGS_STORAGE_KEY) ?? '[]')
    } catch {
        return []
    }
    return bookings
        .flatMap((booking) =>
            (booking.foodOrders ?? []).map((order) => ({
                ...order,
                guestName: booking.guest?.fullName || 'Guest',
                bookingId: booking.id,
            }))
        )
        .sort((a, b) => new Date(b.orderedAt) - new Date(a.orderedAt))
}

function formatOrderedAt(orderedAt) {
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
    const [orders, setOrders] = useState(loadUserOrders)

    // Refresh when another tab (the guest-facing food menu) saves an order.
    useEffect(() => {
        const handleStorage = (event) => {
            if (event.key === BOOKINGS_STORAGE_KEY) setOrders(loadUserOrders())
        }
        window.addEventListener('storage', handleStorage)
        return () => window.removeEventListener('storage', handleStorage)
    }, [])

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
                        Guest food orders will appear here once they order from the menu.
                    </p>
                </div>
            ) : (
                <div className="foodlist-orders-rows">
                    {orders.map((order, index) => (
                        <article key={`${order.bookingId}-${order.orderedAt}-${index}`} className="foodlist-order-card">
                            <div className="foodlist-order-top">
                                <span className="foodlist-order-guest">{order.guestName}</span>
                                <span className="foodlist-order-date">{formatOrderedAt(order.orderedAt)}</span>
                            </div>
                            <div className="foodlist-order-line">
                                <span className="foodlist-order-item">
                                    {order.name} <span className="foodlist-order-qty">×{order.quantity}</span>
                                </span>
                                <span className="foodlist-order-total">PHP {Number(order.total ?? 0).toFixed(2)}</span>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </aside>
    )
}

export default function FoodList({ category = 'all' }) {
    const sections =
        category === 'all'
            ? FOOD_SECTIONS
            : FOOD_SECTIONS.filter((section) => section.category === category)

    return (
        <div className="foodlist-layout">
            <div className="foodlist-panel">
                {sections.map((section) => (
                    <section key={section.title} className="foodlist-section">
                        <h3 className="foodlist-section-title">{section.title}</h3>
                        <div className="foodlist-rows">
                            {section.items.map((item) => (
                                <article key={item.name} className="foodlist-row">
                                    <div className="foodlist-image">
                                        <img src={item.image} alt={item.name} />
                                    </div>
                                    <div className="foodlist-info">
                                        <h4 className="foodlist-name">{item.name}</h4>
                                        <p className="foodlist-desc">{item.desc}</p>
                                    </div>
                                    <span className="foodlist-price">{item.price}</span>
                                </article>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
            <UserOrders />
        </div>
    )
}
