import { useEffect, useState } from 'react'
import '../css/foodlist.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useAdminCatalog,
    loadAdminCatalog,
    saveFoodItem,
    deleteFoodItem,
    renameCoffeeTable,
    renameCoffeeSize,
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

// The Cup Size dropdown's escape hatch (foodFields below) — picking this
// reveals a plain text field to name a size that doesn't exist in the table
// yet, since a dropdown can only ever offer sizes that already exist
// somewhere. saveCoffeeItem() is what turns it back into a real sizeLabel
// before saveFoodItem() ever sees it; the sentinel itself is never stored.
const NEW_SIZE_OPTION = '__new_size__'

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
// where staff read it. A gap (flavor.items[i] is undefined — this flavor has
// no row at this size yet) is clickable too, via onAddCell: there's nothing
// to open, so it opens a NEW row instead, pre-filled with the flavor and size
// it was clicked under so filling the gap is "type a price," not "retype the
// flavor, table and size by hand."
function CoffeeTables({ groups, onEdit, onEditTable, onAddCell }) {
    return (
        <div className="foodlist-coffee">
            <p className="foodlist-note">
                Prices in PHP, per cup size. Tap a price to edit that size, or a
                blank cell to price it for the first time.
            </p>
            {groups.map((group) => (
                <div key={group.key} className="foodlist-coffee-group">
                    <div className="foodlist-coffee-title-bar">
                        <h4 className="foodlist-coffee-title">{group.title}</h4>
                        <button
                            type="button"
                            className="crud-btn is-small"
                            onClick={() => onEditTable(group)}
                        >
                            Edit
                        </button>
                    </div>
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
                                                    <button
                                                        type="button"
                                                        className="foodlist-coffee-cell foodlist-coffee-cell-empty"
                                                        aria-label={`Price ${flavor.name} at ${size || 'this size'}`}
                                                        onClick={() => onAddCell(group, flavor.name, size)}
                                                    >
                                                        —
                                                    </button>
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
//
// `tableOptions` is the dropdown for an EXISTING price table — {value: key,
// label: title} pairs built from `coffeeGroups` (groupCoffeeMenu() over the
// live catalog, see FoodList below) — so picking one never involves typing or
// copying a raw group_key by hand. `values.newTable` (set by blankFoodItem
// when "+ Add table" opened this form, as opposed to "+ Add flavor") swaps
// that dropdown for a plain text field instead: naming a brand-new table
// rather than joining one that already exists. saveFoodItem() is what tells
// the two apart on save — a groupKey that arrived already set is "join," a
// bare groupTitle is "create new" — and slugifies the new table's id itself,
// the same way it already slugifies the item's own id.
//
// Cup Size follows the same "pick, don't type" logic once a table is chosen:
// its options are THAT table's existing sizeLabels, looked up from
// `coffeeGroups` by `values.groupKey`. Introducing a size that doesn't exist
// anywhere yet is deliberately not possible from here — that's what "Edit" on
// the table itself (tableEditFields below) is for, since a brand-new size
// needs to survive even before it has a second flavor to keep it company.
function foodFields(values, tableOptions = [], coffeeGroups = []) {
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
        // Every size the CURRENTLY picked table already has, or nothing if no
        // table is picked yet (or this is the "+ Add table" flow, which has
        // no table to look sizes up on).
        const selectedGroup = coffeeGroups.find((group) => group.key === values.groupKey)
        const sizeOptions = (selectedGroup?.sizeLabels ?? [])
            .filter(Boolean) // a blank/legacy size_label has no name to show in a dropdown
            .map((size) => ({ value: size, label: size }))
        const addingNewSize = !values.newTable && values.sizeLabel === NEW_SIZE_OPTION

        fields.push([
            values.newTable
                ? {
                    name: 'groupTitle',
                    label: 'New table name',
                    placeholder: 'Iced Fruit Soda',
                    help: 'Starts a new price table on the menu, priced at the flavor, size '
                        + 'and price entered below.',
                }
                : {
                    name: 'groupKey',
                    label: 'Price table',
                    type: 'select',
                    // A leading blank option so an untouched dropdown reads as
                    // "nothing chosen" both to the admin and to values.groupKey
                    // — without it, a native <select> whose value matches no
                    // option visually shows the FIRST table as picked while
                    // React's own state stays empty, and a save without ever
                    // touching the field would silently land on that table
                    // instead of the "pick a table" refusal it should get.
                    options: [{ value: '', label: 'Choose a table…' }, ...tableOptions],
                    help: 'Which table on the menu this cup appears in.',
                    // Switching tables invalidates whatever size was picked
                    // for the OLD table — Classic Hot Coffee's "12oz." is not
                    // a real option once Iced Fruit Soda is selected instead.
                    // Without clearing it, a save made right after switching
                    // (without re-touching Cup Size) would silently carry the
                    // stale size over instead of refusing for having none.
                    clears: ['sizeLabel'],
                },
            values.newTable
                ? {
                    name: 'sizeLabel',
                    label: 'Cup size',
                    placeholder: '12oz.',
                    help: 'This table’s first size.',
                }
                : {
                    name: 'sizeLabel',
                    label: 'Cup size',
                    type: 'select',
                    disabled: !values.groupKey,
                    options: [
                        { value: '', label: values.groupKey ? 'Choose a size…' : 'Pick a price table first' },
                        ...sizeOptions,
                        // Only offered once a table is picked — a size is
                        // always new FOR a specific table, so there is
                        // nothing to attach it to before then.
                        ...(values.groupKey ? [{ value: NEW_SIZE_OPTION, label: '+ New cup size…' }] : []),
                    ],
                    help: 'The column it sits in.',
                },
        ])

        // Revealed only once "+ New cup size…" is picked above — the actual
        // name saveCoffeeItem() turns back into sizeLabel at submit time (see
        // below), since the sentinel itself is never a real size.
        if (addingNewSize) {
            fields.push({
                name: 'newSizeLabel',
                label: 'New cup size name',
                placeholder: '20oz.',
            })
        }
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
// form opens already belonging where they are standing. `newTable` is
// transient UI state, read only by foodFields() above to decide which shape
// the Price Table field takes — saveFoodItem() never sees it.
function blankFoodItem(category, { newTable = false } = {}) {
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
        newTable,
    }
}

// A blank row for a specific GAP in a coffee table's grid — clicking the "—"
// under, say, Americano's 20oz. column. Same blank draft as blankFoodItem(),
// with the flavor, table and size already filled in from the cell that was
// clicked, so the form CrudModal opens is "type a price" rather than
// "re-enter three things staff can already see on screen."
function blankCoffeeCell(group, flavorName, size) {
    return {
        ...blankFoodItem('coffee', { newTable: false }),
        name: flavorName,
        groupKey: group.key,
        groupTitle: group.title,
        sizeLabel: size,
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
        // Already belongs to a table — Price Table renders as the dropdown,
        // same as "+ Add flavor", so editing can also move a size to a
        // different existing table rather than being locked to its own.
        newTable: false,
    }
}

// The item modal's onSubmit — saveFoodItem() for everything except the one
// case it doesn't know about: NEW_SIZE_OPTION picked in the Cup Size
// dropdown (foodFields above). That sentinel is never a real size, so it's
// swapped here for whatever was typed into the "New cup size name" field
// that picking it revealed — refusing the save outright if that was left
// blank, rather than silently landing the row in the unlabelled column.
function saveCoffeeItem(draft) {
    if (draft.sizeLabel !== NEW_SIZE_OPTION) return saveFoodItem(draft)

    const newSize = String(draft.newSizeLabel ?? '').trim()
    if (!newSize) return Promise.resolve({ ok: false, message: 'Type a name for the new cup size.' })

    return saveFoodItem({ ...draft, sizeLabel: newSize })
}

// The "Edit" panel opened from a table's own heading — a fixed set of fields
// for the `group` snapshot the button was clicked on (not a function of
// `values`; the table's shape doesn't change while the modal is open). One
// field to rename the table, one per existing cup size to rename that
// column. Introducing a brand-new size lives in "+ Add flavor" instead (its
// Cup Size dropdown's "+ New cup size…" option, see foodFields/
// saveCoffeeItem above) — one flow to learn instead of two, now that adding a
// size always comes with a flavor and price anyway.
function tableEditFields(group) {
    const fields = [
        { name: 'title', label: 'Table name', placeholder: group.title },
    ]

    group.sizeLabels.forEach((size, i) => {
        fields.push({
            name: `size_${i}`,
            label: `Cup size ${i + 1}`,
            placeholder: size || '(blank)',
            help: i === 0 ? 'Renaming a size moves every flavor priced at it, in one go.' : undefined,
        })
    })

    return fields
}

function tableEditInitial(group) {
    const values = { title: group.title }
    group.sizeLabels.forEach((size, i) => {
        values[`size_${i}`] = size
    })
    return values
}

// A table rename and any number of size renames, each its own bulk update
// (see renameCoffeeTable/renameCoffeeSize in menuDB.js) so a failure partway
// through leaves whatever already landed in place rather than losing it.
async function saveTableEdits(group, values) {
    const newTitle = String(values.title ?? '').trim()
    if (!newTitle) return { ok: false, message: 'Give the table a name.' }

    if (newTitle !== group.title) {
        const result = await renameCoffeeTable(group.key, newTitle)
        if (!result.ok) return result
    }

    for (let i = 0; i < group.sizeLabels.length; i += 1) {
        const oldSize = group.sizeLabels[i]
        const newSize = String(values[`size_${i}`] ?? '').trim()
        if (newSize && newSize !== oldSize) {
            const result = await renameCoffeeSize(group.key, oldSize, newSize)
            if (!result.ok) return result
        }
    }

    return { ok: true }
}

export default function FoodList({ category = 'all' }) {
    const catalog = useAdminCatalog()
    const [editing, setEditing] = useState(null)
    // The per-table "Edit" panel — a `group` from groupCoffeeMenu(), separate
    // from `editing` above (which is always a single item's draft) since the
    // two open different CrudModal instances with different field shapes.
    const [editingTable, setEditingTable] = useState(null)

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

    // Every price table that exists right now — over the FULL admin catalog
    // (hidden rows included), not just what's visible under the current tab,
    // so a table whose only rows are currently switched off is still
    // pickable. groupCoffeeMenu() already ignores non-coffee rows on its own.
    // `tableOptions` feeds the "Price table" dropdown; `coffeeGroups` itself
    // is also handed to foodFields() so it can look up a picked table's own
    // sizeLabels for the "Cup size" dropdown right next to it.
    const coffeeGroups = groupCoffeeMenu(catalog.food)
    const tableOptions = coffeeGroups.map((group) => ({
        value: group.key,
        label: group.title,
    }))

    return (
        <div className="foodlist-layout">
            <div className="foodlist-panel">
                {catalog.error && <p className="crud-message is-error">{catalog.error}</p>}

                {sections.map((section) => (
                    <section key={section.id} className="foodlist-section">
                        <div className="crud-bar">
                            <h3 className="crud-bar-title">{section.title}</h3>
                            {section.id === 'coffee' ? (
                                <div className="crud-bar-actions">
                                    <button
                                        type="button"
                                        className="crud-btn is-small"
                                        onClick={() => setEditing(blankFoodItem('coffee', { newTable: true }))}
                                    >
                                        + Add table
                                    </button>
                                    <button
                                        type="button"
                                        className="crud-btn is-primary is-small"
                                        disabled={tableOptions.length === 0}
                                        title={tableOptions.length === 0 ? 'Add a table first.' : undefined}
                                        onClick={() => setEditing(blankFoodItem('coffee', { newTable: false }))}
                                    >
                                        + Add flavor
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="crud-btn is-primary is-small"
                                    onClick={() => setEditing(blankFoodItem(section.id))}
                                >
                                    + Add an item
                                </button>
                            )}
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
                                onEditTable={setEditingTable}
                                onAddCell={(group, flavorName, size) => setEditing(blankCoffeeCell(group, flavorName, size))}
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
                    title={
                        editing.id
                            ? 'Edit menu item'
                            : editing.newTable ? 'New price table' : 'New menu item'
                    }
                    subtitle={
                        editing.id
                            ? 'Saved straight to the menu — the guest page follows this price immediately. '
                              + 'Orders already placed keep what they were charged.'
                            : 'This goes on the guest menu as soon as you save it.'
                    }
                    fields={(values) => foodFields(values, tableOptions, coffeeGroups)}
                    initial={editing}
                    submitLabel={editing.id ? 'Save changes' : 'Add to menu'}
                    onSubmit={saveCoffeeItem}
                    onDelete={editing.id ? () => deleteFoodItem(editing.id) : null}
                    deleteLabel="Delete item"
                    onClose={() => setEditing(null)}
                />
            )}

            {editingTable && (
                <CrudModal
                    title="Edit price table"
                    subtitle="Rename the table or rename a cup size — each change saves independently."
                    fields={tableEditFields(editingTable)}
                    initial={tableEditInitial(editingTable)}
                    submitLabel="Save changes"
                    onSubmit={(values) => saveTableEdits(editingTable, values)}
                    onClose={() => setEditingTable(null)}
                />
            )}
        </div>
    )
}
