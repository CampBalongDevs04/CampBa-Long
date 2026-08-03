import { useEffect, useState } from 'react'
import '../css/foodlist.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useAdminCatalog,
    loadAdminCatalog,
    saveFoodItem,
    deleteFoodItem,
    resolveMenuImage,
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

// The Food Menu section of the dashboard: the menu on the left — which staff
// now EDIT here rather than through a developer — and what guests have actually
// ordered on the right.
//
// Both halves come from Postgres. The menu used to be imported out of
// pages/foodmenu.jsx (so a price change meant a redeploy) and the orders were
// read out of a `cbl-my-bookings` localStorage key that stopped existing when
// bookings moved to the database — which is why this panel was permanently
// empty. Orders are read from the booking rows the staff session can see, so
// this shows every guest's order, not just whoever used this browser.
//
// WHY THIS LIST IS NOT useFoodMenu()
// ----------------------------------
// That store is the guest menu: active rows only. This panel manages the table,
// so it reads the admin list — an item switched off has to stay visible HERE to
// be switchable back on, while staying invisible on the guest page.

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

function ItemRows({ items, onEdit }) {
    return (
        <div className="foodlist-rows">
            {items.map((item) => (
                <article
                    key={item.id}
                    className={`foodlist-row ${item.isActive ? '' : 'crud-is-hidden'}`}
                >
                    <div className="foodlist-image">
                        {item.image ? (
                            <img src={item.image} alt={item.name} />
                        ) : (
                            <span className="foodlist-image-empty">No photo</span>
                        )}
                    </div>
                    <div className="foodlist-info">
                        <h4 className="foodlist-name">
                            {item.name}
                            {!item.isActive && <span className="crud-hidden-tag">Hidden</span>}
                        </h4>
                        <p className="foodlist-desc">{item.desc}</p>
                        {item.hasCoffeeOption && (
                            <p className="foodlist-note">
                                Guest picks the coffee — flavored adds PHP{' '}
                                {FLAVORED_COFFEE_UPCHARGE.toFixed(2)}
                            </p>
                        )}
                    </div>
                    <span className="foodlist-price">{formatMenuPrice(item.price)}</span>
                    <div className="crud-row-actions">
                        <button
                            type="button"
                            className="crud-btn is-small"
                            onClick={() => onEdit(item)}
                        >
                            Edit
                        </button>
                    </div>
                </article>
            ))}
        </div>
    )
}

// Coffee is priced per cup size, so it renders as tables rather than image
// rows. Every cell IS its own catalog row, which is why tapping one opens that
// row's form — the price a guest pays for a 12oz Cafe Latte is edited exactly
// where staff read it.
function CoffeeTables({ groups, onEdit }) {
    return (
        <div className="foodlist-coffee">
            <p className="foodlist-note">
                Prices in PHP, per cup size. Tap a price to edit that size.
            </p>
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
                                                {flavor.items[i] ? (
                                                    <button
                                                        type="button"
                                                        className={`foodlist-coffee-cell ${flavor.items[i].isActive ? '' : 'crud-is-hidden'}`}
                                                        onClick={() => onEdit(flavor.items[i])}
                                                    >
                                                        {flavor.items[i].price.toFixed(2)}
                                                    </button>
                                                ) : (
                                                    '—'
                                                )}
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

// The form's shape follows the category: only a coffee row belongs to a price
// table and a cup size, and only a combo comes with a coffee the guest picks.
function foodFields(values) {
    const isCoffee = values.category === 'coffee'

    const fields = [
        { name: 'name', label: 'Name', placeholder: 'Sinigang na Liempo' },
        {
            name: 'desc',
            label: 'Description',
            type: 'textarea',
            placeholder: 'Good for 4-5 pax',
        },
        [
            { name: 'price', label: 'Price (PHP)', type: 'number', placeholder: '700' },
            {
                name: 'category',
                label: 'Category',
                type: 'select',
                options: FOOD_CATEGORIES.map((entry) => ({ value: entry.id, label: entry.title })),
            },
        ],
    ]

    if (isCoffee) {
        fields.push([
            {
                name: 'groupTitle',
                label: 'Price table',
                placeholder: 'Classic Hot Coffee',
                help: 'Which table on the menu this cup appears in.',
            },
            {
                name: 'sizeLabel',
                label: 'Cup size',
                placeholder: '12oz.',
                help: 'The column it sits in.',
            },
        ])
        fields.push({
            name: 'groupKey',
            label: 'Table id',
            placeholder: 'classic-hot',
            help: 'Rows sharing this id share a table. Copy it from a cup already in the table you want.',
        })
    } else {
        // The photo is uploaded, not named. A dish that shipped with the site
        // still has its bundled asset behind `imageKey`, which is what fills the
        // frame until staff replace it — and the upload clears the key so the
        // new photo is the one the guest menu shows.
        fields.push({
            name: 'imageUrl',
            label: 'Photo',
            type: 'image',
            folder: 'food',
            preview: resolveMenuImage(values.imageKey, values.imageUrl),
            clears: ['imageKey'],
            help: 'Shown on the guest menu card. JPG, PNG or WebP, up to 5 MB.',
        })
        fields.push({ name: 'sortOrder', label: 'Position', type: 'number', help: 'Lower shows first.' })
    }

    if (values.category === 'combo') {
        fields.push({
            name: 'hasCoffeeOption',
            label: `Guest picks the included coffee (flavored adds PHP ${FLAVORED_COFFEE_UPCHARGE.toFixed(2)})`,
            type: 'checkbox',
        })
    }

    if (isCoffee) {
        fields.push({ name: 'sortOrder', label: 'Position', type: 'number', help: 'Lower shows first.' })
    }

    fields.push({ name: 'isActive', label: 'Show this on the guest menu', type: 'checkbox' })

    return fields
}

// A blank row for the category the staff member pressed "Add" under, so the
// form opens already belonging where they are standing.
function blankFoodItem(category) {
    return {
        id: null,
        category: category === 'all' ? 'breakfast' : category,
        name: '',
        desc: '',
        price: '',
        imageKey: '',
        imageUrl: '',
        groupKey: '',
        groupTitle: '',
        sizeLabel: '',
        hasCoffeeOption: false,
        sortOrder: 0,
        isActive: true,
    }
}

function toDraft(item) {
    return {
        id: item.id,
        category: item.category,
        name: item.name,
        desc: item.desc ?? '',
        price: String(item.price),
        imageKey: item.imageKey ?? '',
        imageUrl: item.imageUrl ?? '',
        groupKey: item.groupKey ?? '',
        groupTitle: item.groupTitle ?? '',
        sizeLabel: item.sizeLabel ?? '',
        hasCoffeeOption: item.hasCoffeeOption,
        sortOrder: item.sortOrder ?? 0,
        isActive: item.isActive,
    }
}

export default function FoodList({ category = 'all' }) {
    const catalog = useAdminCatalog()
    const [editing, setEditing] = useState(null)

    // Loaded when a dashboard panel first opens rather than on boot: these are
    // the rows including the hidden ones, and only staff may read them.
    useEffect(() => {
        loadAdminCatalog()
    }, [])

    // Sections come from the catalog's own categories, so a new one needs a tab
    // in foodTab.jsx to be filterable but no change here; the 'all' tab shows
    // everything. Unlike the guest menu, an EMPTY section is still rendered —
    // it is where the first item of that category gets added.
    const sections = FOOD_CATEGORIES
        .filter((section) => category === 'all' || section.id === category)
        .map((section) => ({
            ...section,
            items: catalog.food.filter((item) => item.category === section.id),
        }))

    return (
        <div className="foodlist-layout">
            <div className="foodlist-panel">
                {catalog.error && <p className="crud-message is-error">{catalog.error}</p>}

                {sections.map((section) => (
                    <section key={section.id} className="foodlist-section">
                        <div className="crud-bar">
                            <h3 className="crud-bar-title">{section.title}</h3>
                            <button
                                type="button"
                                className="crud-btn is-primary is-small"
                                onClick={() => setEditing(blankFoodItem(section.id))}
                            >
                                + Add {section.id === 'coffee' ? 'a cup size' : 'an item'}
                            </button>
                        </div>

                        {section.items.length === 0 ? (
                            <p className="crud-empty">
                                {catalog.loaded
                                    ? `Nothing on the ${section.title} menu yet.`
                                    : 'Loading the menu…'}
                            </p>
                        ) : section.id === 'coffee' ? (
                            <CoffeeTables
                                groups={groupCoffeeMenu(section.items)}
                                onEdit={(item) => setEditing(toDraft(item))}
                            />
                        ) : (
                            <ItemRows
                                items={section.items}
                                onEdit={(item) => setEditing(toDraft(item))}
                            />
                        )}
                    </section>
                ))}
            </div>
            <UserOrders />

            {editing && (
                <CrudModal
                    title={editing.id ? 'Edit menu item' : 'New menu item'}
                    subtitle={
                        editing.id
                            ? 'Saved straight to the menu — the guest page follows this price immediately. '
                              + 'Orders already placed keep what they were charged.'
                            : 'This goes on the guest menu as soon as you save it.'
                    }
                    fields={foodFields}
                    initial={editing}
                    submitLabel={editing.id ? 'Save changes' : 'Add to menu'}
                    onSubmit={saveFoodItem}
                    onDelete={editing.id ? () => deleteFoodItem(editing.id) : null}
                    deleteLabel="Delete item"
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    )
}
