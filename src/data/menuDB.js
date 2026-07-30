// ============================================================================
//  Camp Ba-long — food menu and spa catalog  (Supabase: campBalongWeb)
// ----------------------------------------------------------------------------
//  ONE catalog for the whole app, backed by Postgres:
//
//    food_menu_items — one row per ORDERABLE LINE. A coffee flavor at three
//                      cup sizes is three rows, because that is what a guest
//                      adds to their order and what an order line points at.
//    spa_services    — one row per treatment.
//
//  See supabase/migrations/20260730120000_food_and_spa_catalog.sql.
//
//  The guest menu page, the guest spa page and both admin lists read from
//  here, so staff can never be shown a different price from the one a guest is
//  charged. Before this module they read arrays literal in the guest pages —
//  and the admin dashboard imported those arrays out of pages/foodmenu.jsx,
//  which meant a price change was a code change.
//
//  WHY THE STORE STARTS FULL INSTEAD OF EMPTY
//  ------------------------------------------
//  Same synchronous-read pattern as accommodationDB.js: components read the
//  current snapshot during render and useSyncExternalStore re-renders them when
//  the rows land. What differs is the empty case. An accommodation whose
//  availability hasn't arrived can honestly say "TBA"; a menu with no dishes on
//  it is just a broken page. So the store starts as the catalog the front end
//  used to hardcode and is REPLACED by the database copy:
//
//    • first paint is immediate and correct;
//    • a price edited in Postgres appears without a redeploy;
//    • a missing .env or a dead network still renders the full menu, matching
//      how the accommodation cards already behave (see README).
//
//  WHY IMAGES ARE KEYS, NOT URLS
//  -----------------------------
//  The photos are bundled assets — Vite hashes them at build time, so the final
//  URL is not knowable from SQL. A row carries the asset's key ('menu1',
//  'massage44') and the maps below turn it into the imported module. An unknown
//  or null key just means no photo; nothing breaks.
// ============================================================================

import { useSyncExternalStore } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js'

import menu1 from '../assets/images/menu1.png'
import menu2 from '../assets/images/menu2.png'
import menu3 from '../assets/images/menu3.png'
import menu4 from '../assets/images/menu4.png'
import menu5 from '../assets/images/menu5.png'
import menu6 from '../assets/images/menu6.png'
import menu7 from '../assets/images/menu7.png'
import combo1 from '../assets/images/combo1.png'
import combo2 from '../assets/images/combo2.png'
import combo3 from '../assets/images/combo3.png'
import combo4 from '../assets/images/combo4.png'
import combo5 from '../assets/images/combo5.png'
import combo6 from '../assets/images/combo6.png'
import combo7 from '../assets/images/combo7.png'
import pre1 from '../assets/images/pre1.png'
import pre2 from '../assets/images/pre2.png'
import pre3 from '../assets/images/pre3.png'
import pre4 from '../assets/images/pre4.png'
import massage11 from '../assets/images/massage11.png'
import massage22 from '../assets/images/massage22.png'
import massage33 from '../assets/images/massage33.png'
import massage44 from '../assets/images/massage44.png'
import massage55 from '../assets/images/massage55.png'
import massage66 from '../assets/images/massage66.png'
import massage77 from '../assets/images/massage77.png'
import massage88 from '../assets/images/massage88.png'

// image_key → bundled asset. The only place the two sides are tied together.
const IMAGES = {
    menu1, menu2, menu3, menu4, menu5, menu6, menu7,
    combo1, combo2, combo3, combo4, combo5, combo6, combo7,
    pre1, pre2, pre3, pre4,
    massage11, massage22, massage33, massage44,
    massage55, massage66, massage77, massage88,
}

// --------------------------------------------------------------- categories
// Every category id here needs a matching tab in admin/items/foodTab.jsx to be
// filterable there; the guest menu page renders them in this order.
export const FOOD_CATEGORIES = [
    { id: 'breakfast', title: 'Foods', menuTitle: 'MENU' },
    { id: 'combo', title: 'Combo Meal', menuTitle: 'COMBO MEAL' },
    { id: 'pre-order', title: 'Pre-Order', menuTitle: 'PRE-ORDER' },
    { id: 'coffee', title: 'Beverages · Bukal Cafe Coffee', menuTitle: 'COFFEE' },
]

// The coffee a combo meal comes with. This is a rule about the combo, not a
// price list, which is why it isn't a column on food_menu_items: picking a
// flavored cup adds a flat upcharge to whatever the combo costs.
export const CLASSIC_COFFEE_OPTIONS = [
    'Americano', 'Cafe Latte', 'Cappucino', 'Cafe Mocha', 'Caramel Machiatto',
]
export const FLAVORED_COFFEE_OPTIONS = [
    'Vanilla Latte', 'Hazelnut Latte', 'Choco Hazelnut Latte',
    'Salted Caramel Latte', 'Matcha Latte', 'White Mocha',
]
export const FLAVORED_COFFEE_UPCHARGE = 10

// ------------------------------------------------------------------ defaults
// The seed's twin. Kept compact — coffee is authored as (flavor × sizes) and
// flattened below, exactly like the migration expands it — so the 95 orderable
// lines don't have to be spelled out twice.

const DEFAULT_DISHES = [
    { id: 'sinigang-na-liempo', category: 'breakfast', name: 'Sinigang na Liempo', desc: 'Good for 4-5 pax', price: 700, imageKey: 'menu1' },
    { id: 'fried-chicken', category: 'breakfast', name: 'Fried Chicken', desc: 'Good for 3-4 pax', price: 350, imageKey: 'menu2' },
    { id: 'tinola', category: 'breakfast', name: 'Tinola', desc: 'Good for 4-6 pax', price: 600, imageKey: 'menu3' },
    { id: 'inihaw-na-liempo', category: 'breakfast', name: 'Inihaw na Liempo', desc: 'Good for 3-4 pax', price: 500, imageKey: 'menu4' },
    { id: 'inihaw-na-tilapia', category: 'breakfast', name: 'Inihaw na Tilapia', desc: 'Good for 3-4 pax', price: 400, imageKey: 'menu5' },
    { id: 'pork-sisig', category: 'breakfast', name: 'Pork Sisig', desc: 'Good for 3-4 pax', price: 400, imageKey: 'menu6' },
    { id: 'pork-adobo', category: 'breakfast', name: 'Pork Adobo', desc: 'Good for 3-4 pax', price: 500, imageKey: 'menu7' },

    { id: 'longsilog', category: 'combo', name: 'Longsilog', desc: 'Longganisa, Sinangag at Itlog with Classic Hot Coffee', price: 230, imageKey: 'combo1', hasCoffeeOption: true },
    { id: 'hotsilog', category: 'combo', name: 'Hotsilog', desc: 'Hotdog, Sinangag at Itlog with Classic Hot Coffee', price: 230, imageKey: 'combo2', hasCoffeeOption: true },
    { id: 'tapsilog', category: 'combo', name: 'Tapsilog', desc: 'Tapa, Sinangag at Itlog with Classic Hot Coffee', price: 260, imageKey: 'combo3', hasCoffeeOption: true },
    { id: 'tocilog', category: 'combo', name: 'Tocilog', desc: 'Tocino, Sinangag at Itlog with Classic Hot Coffee', price: 260, imageKey: 'combo4', hasCoffeeOption: true },
    { id: 'chicksilog', category: 'combo', name: 'Chicksilog', desc: 'Chicken, Sinangag at Itlog with Classic Hot Coffee', price: 310, imageKey: 'combo5', hasCoffeeOption: true },
    { id: 'shanghaisilog', category: 'combo', name: 'Shanghaisilog', desc: 'Shanghai, Sinangag at Itlog with Classic Hot Coffee', price: 230, imageKey: 'combo6', hasCoffeeOption: true },
    { id: 'liemposilog', category: 'combo', name: 'Liemposilog', desc: 'Liempo, Sinangag at Itlog with Classic Hot Coffee', price: 310, imageKey: 'combo7', hasCoffeeOption: true },

    { id: 'pre-order-pancit-tray', category: 'pre-order', name: 'Pancit Bihon / Canton', desc: 'Good for 6-7 pax', price: 400, imageKey: 'pre1' },
    { id: 'pre-order-pancit-large', category: 'pre-order', name: 'Pancit Bihon / Canton', desc: 'Large Bilao', price: 1500, imageKey: 'pre2' },
    { id: 'pre-order-pancit-medium', category: 'pre-order', name: 'Pancit Bihon / Canton', desc: 'Medium Bilao', price: 800, imageKey: 'pre3' },
    { id: 'pre-order-tofu-sisig', category: 'pre-order', name: 'Tofu Sisig', desc: 'Good for 3-4 pax', price: 250, imageKey: 'pre4' },
]

const DEFAULT_COFFEE_GROUPS = [
    {
        key: 'classic-hot',
        title: 'Classic Hot Coffee',
        sizeLabels: ['8oz.', '12oz.', '16oz.'],
        flavors: [
            { name: 'Americano', prices: [110, 125, 130] },
            { name: 'Cafe Latte', prices: [120, 125, 140] },
            { name: 'Cappuccino', prices: [125, 140, 145] },
            { name: 'Cafe Mocha', prices: [125, 140, 145] },
            { name: 'White Mocha', prices: [125, 140, 145] },
            { name: 'Caramel Machiatto', prices: [125, 140, 145] },
            { name: 'Spanish Latte', prices: [125, 140, 145] },
        ],
    },
    {
        key: 'classic-iced',
        title: 'Classic Iced Coffee',
        sizeLabels: ['Tall 12oz.', 'Grande 16oz.'],
        flavors: [
            { name: 'Americano', prices: [125, 130] },
            { name: 'Cafe Latte', prices: [125, 130] },
            { name: 'Cappuccino', prices: [140, 145] },
            { name: 'Cafe Mocha', prices: [140, 145] },
            { name: 'Caramel Machiatto', prices: [140, 145] },
            { name: 'Spanish Latte', prices: [140, 145] },
        ],
    },
    {
        key: 'flavored-hot',
        title: 'Flavored Hot Special',
        sizeLabels: ['8oz.', '12oz.', '16oz.'],
        flavors: [
            { name: 'Vanilla Latte', prices: [130, 145, 155] },
            { name: 'Hazelnut Latte', prices: [130, 145, 155] },
            { name: 'Choco Hazelnut Latte', prices: [130, 145, 155] },
            { name: 'Salted Caramel Latte', prices: [130, 145, 155] },
            { name: 'Matcha Latte', prices: [130, 145, 155] },
            { name: 'Strawberry Matcha Latte', prices: [135, 160, 160] },
        ],
    },
    {
        key: 'flavored-iced',
        title: 'Flavored Iced Special',
        sizeLabels: ['Tall 12oz.', 'Grande 16oz.'],
        flavors: [
            { name: 'Vanilla Latte', prices: [145, 155] },
            { name: 'Hazelnut Latte', prices: [145, 155] },
            { name: 'Choco Hazelnut Latte', prices: [145, 155] },
            { name: 'Salted Caramel Latte', prices: [145, 155] },
            { name: 'Matcha Latte', prices: [145, 155] },
            { name: 'Brown Sugar Latte', prices: [145, 155] },
            { name: 'Cinnamon Latte', prices: [145, 155] },
            { name: 'White Chocolate Mocha', prices: [150, 160] },
            { name: 'Cookie Dough Latte', prices: [150, 160] },
            { name: 'Strawberry Matcha Latte', prices: [150, 160] },
        ],
    },
    {
        key: 'iced-fruit',
        title: 'Iced Fruit Soda and Latte',
        sizeLabels: ['Tall 12oz.', 'Grande 16oz.'],
        flavors: [
            { name: 'Strawberry Soda/Latte', prices: [100, 105] },
            { name: 'Blueberry Soda/Latte', prices: [100, 105] },
            { name: 'Peach Soda/Latte', prices: [100, 105] },
        ],
    },
]

const DEFAULT_SPA_SERVICES = [
    { id: 'ventosa-cupping', name: 'Ventosa Cupping', desc: 'Suction cupping therapy that eases muscle tension and improves circulation.', duration: '1hr 30mins', price: 850, imageKey: 'massage11' },
    { id: 'traditional-body-massage', name: 'Traditional Body Massage', desc: 'Full-body Hilot massage rooted in Filipino healing traditions.', duration: '1hr', price: 650, imageKey: 'massage22' },
    { id: 'back-massage', name: 'Back Massage', desc: 'Targeted kneading to release tension across the back and shoulders.', duration: '30mins', price: 400, imageKey: 'massage33' },
    { id: 'facial-detox', name: 'Moisturizing Facial Detox', desc: 'Deep-cleansing facial that hydrates and refreshes tired skin.', duration: '1hr', price: 500, imageKey: 'massage44' },
    { id: 'foot-spa-reflexology', name: 'Foot Spa with Reflexology', desc: 'Soothing foot soak paired with pressure-point reflexology.', duration: '1hr', price: 650, imageKey: 'massage55' },
    { id: 'hand-massage-manicure', name: 'Hand Massage with Manicure', desc: 'Relaxing hand massage finished with a neat manicure.', duration: '1hr', price: 450, imageKey: 'massage66' },
    { id: 'foot-spa-reflexology-pedi', name: 'Foot Spa Reflexology with Pedi', desc: 'Reflexology foot spa complete with a polished pedicure.', duration: '1hr 30mins', price: 550, imageKey: 'massage77' },
    { id: 'manicure-and-pedicure', name: 'Manicure and Pedicure', desc: 'Classic hand and foot grooming for a clean, polished finish.', duration: '1hr', price: 300, imageKey: 'massage88' },
]

// --------------------------------------------------------------- item shape
// The one shape every screen consumes, whether the row came from Postgres or
// from the defaults above. `label` is what goes on an order line: a coffee is
// only orderable at a given size, so the size belongs in its name.
function foodItem({
    id, category, name, desc = null, price, imageKey = null,
    groupKey = null, groupTitle = null, sizeLabel = null, hasCoffeeOption = false,
}) {
    return {
        id,
        category,
        name,
        desc,
        price: Number(price),
        image: imageKey ? IMAGES[imageKey] ?? null : null,
        groupKey,
        groupTitle,
        sizeLabel,
        hasCoffeeOption,
        label: sizeLabel ? `${name} (${sizeLabel})` : name,
    }
}

function spaItem({ id, name, desc = null, duration = null, price, imageKey = null }) {
    return {
        id,
        name,
        desc,
        duration,
        price: Number(price),
        image: imageKey ? IMAGES[imageKey] ?? null : null,
        label: name,
    }
}

// Flatten the authored coffee tables into one orderable row per (flavor, size),
// with the same ids the migration generates so an order placed against the
// fallback menu still resolves to a catalog row once the database answers.
function flattenCoffee(groups) {
    return groups.flatMap((group) =>
        group.flavors.flatMap((flavor) =>
            flavor.prices.map((price, index) => {
                const slug = flavor.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                return foodItem({
                    id: `coffee-${group.key}-${slug}-${index + 1}`,
                    category: 'coffee',
                    name: flavor.name,
                    desc: group.title,
                    price,
                    groupKey: group.key,
                    groupTitle: group.title,
                    sizeLabel: group.sizeLabels[index],
                })
            })
        )
    )
}

const FALLBACK_FOOD = [...DEFAULT_DISHES.map(foodItem), ...flattenCoffee(DEFAULT_COFFEE_GROUPS)]
const FALLBACK_SPA = DEFAULT_SPA_SERVICES.map(spaItem)

// ===================================================================== store

let foodMenu = FALLBACK_FOOD
let spaServices = FALLBACK_SPA

const listeners = new Set()

function notify() {
    for (const listener of listeners) listener()
}

function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function getFoodMenu() {
    return foodMenu
}

export function getSpaServices() {
    return spaServices
}

export function useFoodMenu() {
    return useSyncExternalStore(subscribe, getFoodMenu)
}

export function useSpaServices() {
    return useSyncExternalStore(subscribe, getSpaServices)
}

// =================================================================== loading

// Both tables are public (RLS allows anon select), so this needs no session —
// the guest menu page and the admin dashboard load the catalog the same way.
async function loadCatalog() {
    const [food, spa] = await Promise.all([
        supabase
            .from('food_menu_items')
            .select('*')
            .eq('is_active', true)
            .order('sort_order'),
        supabase
            .from('spa_services')
            .select('*')
            .eq('is_active', true)
            .order('sort_order'),
    ])

    // A failure here is not fatal and must not be silent: the screens keep
    // rendering the built-in menu, so the only symptom would be prices that
    // quietly refuse to follow the database.
    if (food.error) {
        console.error('Could not load the food menu:', food.error.message)
    } else if (food.data.length > 0) {
        foodMenu = food.data.map((row) =>
            foodItem({
                id: row.id,
                category: row.category,
                name: row.name,
                desc: row.description,
                price: row.price,
                imageKey: row.image_key,
                groupKey: row.group_key,
                groupTitle: row.group_title,
                sizeLabel: row.size_label,
                hasCoffeeOption: row.has_coffee_option,
            }),
        )
    }

    if (spa.error) {
        console.error('Could not load the spa services:', spa.error.message)
    } else if (spa.data.length > 0) {
        spaServices = spa.data.map((row) =>
            spaItem({
                id: row.id,
                name: row.name,
                desc: row.description,
                duration: row.duration_label,
                price: row.price,
                imageKey: row.image_key,
            }),
        )
    }

    notify()
}

// Without credentials every call would fail against a placeholder host and
// bury the one useful message from supabaseClient.js. The fallback catalog
// above is already on screen, so the pages look right — they just can't follow
// a price edited in Postgres.
if (isSupabaseConfigured) {
    loadCatalog()
}

// =================================================================== queries

export function listFoodItems(category = 'all') {
    if (category === 'all') return foodMenu
    return foodMenu.filter((item) => item.category === category)
}

export function findFoodItem(id) {
    return foodMenu.find((item) => item.id === id) ?? null
}

export function findSpaService(id) {
    return spaServices.find((service) => service.id === id) ?? null
}

// Rebuild the coffee price tables from the flat rows: one table per group, a
// column per cup size, a row per flavor. Cells are the orderable items
// themselves, so tapping a price adds that exact catalog row — and a flavor
// that isn't sold in every size leaves a hole rather than shifting the columns
// under its neighbours.
export function groupCoffeeMenu(items = foodMenu) {
    const groups = new Map()

    for (const item of items) {
        if (item.category !== 'coffee' || !item.groupKey) continue

        if (!groups.has(item.groupKey)) {
            groups.set(item.groupKey, {
                key: item.groupKey,
                title: item.groupTitle ?? item.groupKey,
                sizeLabels: [],
                flavors: [],
                byFlavor: new Map(),
            })
        }
        const group = groups.get(item.groupKey)

        const size = item.sizeLabel ?? ''
        let column = group.sizeLabels.indexOf(size)
        if (column === -1) {
            column = group.sizeLabels.push(size) - 1
        }

        let flavor = group.byFlavor.get(item.name)
        if (!flavor) {
            flavor = { name: item.name, items: [] }
            group.byFlavor.set(item.name, flavor)
            group.flavors.push(flavor)
        }
        flavor.items[column] = item
    }

    // `byFlavor` is only the lookup used while building; it is dropped here so
    // the shape handed to the components is just the table they render.
    return [...groups.values()].map((group) => ({
        key: group.key,
        title: group.title,
        sizeLabels: group.sizeLabels,
        flavors: group.flavors,
    }))
}

// 'PHP 700.00' — the menu's own format, kept in one place so the guest cards,
// the order modal and the admin list can't drift apart.
export function formatMenuPrice(price) {
    return `PHP ${Number(price ?? 0).toFixed(2)}`
}
