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
//  A query that SUCCEEDS and returns nothing is a different thing entirely —
//  staff emptied the menu — and it empties the store. Falling back there would
//  keep selling guests dishes the kitchen has just removed.
//
//  TWO WAYS A ROW CARRIES A PHOTO
//  ------------------------------
//  `image_url` is the normal one: staff upload a file in the dashboard, it goes
//  into the `catalog-images` bucket, and the row keeps the URL — see
//  data/catalogImages.js.
//
//  `image_key` is what the rows that SHIPPED with the site use. Their photos
//  are bundled assets, and Vite hashes those at build time, so the final URL is
//  not knowable from SQL — the row names the asset ('menu1', 'massage44') and
//  the map below turns it into the imported module. An unknown or null key just
//  means no photo; nothing breaks.
//
//  The key wins when a row has both, because a bundled photo cannot 404 and is
//  versioned with the build. That is also why uploading in the dashboard CLEARS
//  the key: otherwise the photo staff just picked would lose to the one it was
//  meant to replace.
//
//  WRITING, NOT JUST READING
//  -------------------------
//  The bottom half of this module is the admin dashboard's CRUD over the same
//  two tables. It is here rather than in a module of its own so that a save
//  and the store it invalidates cannot drift apart: every mutation reloads the
//  catalog before it returns, which is what makes a price edited in the Food
//  Menu tab show up on the guest menu page without a redeploy or a refresh.
//  Only the staff roster may actually write — that is enforced by RLS, not by
//  this file.
// ============================================================================

import { useSyncExternalStore } from 'react'
import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

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

// The photo for a row, from whichever of the two it has. A bundled asset beats
// a URL: it is versioned with the build and cannot 404 later. An upload in the
// dashboard clears the key rather than racing this rule.
export function resolveMenuImage(imageKey, imageUrl = null) {
    if (imageKey && IMAGES[imageKey]) return IMAGES[imageKey]
    return imageUrl || null
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
export const FLAVORED_COFFEE_UPCHARGE = 30

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
    id, category, name, desc = null, price, imageKey = null, imageUrl = null,
    groupKey = null, groupTitle = null, sizeLabel = null, hasCoffeeOption = false,
    sortOrder = 0, isActive = true,
}) {
    return {
        id,
        category,
        name,
        desc,
        price: Number(price),
        image: resolveMenuImage(imageKey, imageUrl),
        // The raw columns travel with the item so the dashboard's edit form can
        // be filled from the same object the list renders.
        imageKey,
        imageUrl,
        groupKey,
        groupTitle,
        sizeLabel,
        hasCoffeeOption,
        sortOrder,
        isActive,
        label: sizeLabel ? `${name} (${sizeLabel})` : name,
    }
}

function spaItem({
    id, name, desc = null, duration = null, price,
    imageKey = null, imageUrl = null, sortOrder = 0, isActive = true,
}) {
    return {
        id,
        name,
        desc,
        duration,
        price: Number(price),
        image: resolveMenuImage(imageKey, imageUrl),
        imageKey,
        imageUrl,
        sortOrder,
        isActive,
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
        foodMenu = food.data.map(toFoodItem)
    } else {
        // Every dish was deleted or hidden from the dashboard. That is a real
        // state and it must be shown, not papered over with the built-in menu —
        // otherwise staff would be looking at an empty Food Menu tab while
        // guests still saw seven dishes they can no longer order.
        foodMenu = []
    }

    if (spa.error) {
        console.error('Could not load the spa services:', spa.error.message)
    } else if (spa.data.length > 0) {
        spaServices = spa.data.map(toSpaItem)
    } else {
        spaServices = []
    }

    notify()
}

// Postgres row → the item shape. Shared by the guest catalog above and the
// admin list below, so the two can never disagree about what a row means.
function toFoodItem(row) {
    return foodItem({
        id: row.id,
        category: row.category,
        name: row.name,
        desc: row.description,
        price: row.price,
        imageKey: row.image_key,
        imageUrl: row.image_url,
        groupKey: row.group_key,
        groupTitle: row.group_title,
        sizeLabel: row.size_label,
        hasCoffeeOption: row.has_coffee_option,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    })
}

function toSpaItem(row) {
    return spaItem({
        id: row.id,
        name: row.name,
        desc: row.description,
        duration: row.duration_label,
        price: row.price,
        imageKey: row.image_key,
        imageUrl: row.image_url,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active !== false,
    })
}

// Re-read both catalogs. Exported for the dashboard, which calls it after a
// save so the guest-facing store is current before the modal even closes.
export function refreshMenuCatalog() {
    if (!isSupabaseConfigured) return Promise.resolve()
    return loadCatalog()
}

// A dish repriced on the dashboard reaches a guest who is already sitting on
// the menu page. Both tables are public-readable, so this channel works for an
// anonymous visitor — unlike the bookings channel, which deliberately delivers
// nothing to anyone but staff (see accommodationDB.js).
//
// Declared above the boot block below, not next to its function: `const` is not
// hoisted, and the call down there runs while this module is still evaluating.
const CATALOG_CHANNEL = 'menu-catalog-changes'

// Without credentials every call would fail against a placeholder host and
// bury the one useful message from supabaseClient.js. The fallback catalog
// above is already on screen, so the pages look right — they just can't follow
// a price edited in Postgres.
if (isSupabaseConfigured) {
    loadCatalog()
    watchCatalogRealtime()
}

function watchCatalogRealtime() {
    // This module is evaluated more than once under Vite HMR, and supabase-js
    // refuses to attach handlers to a channel that already subscribed.
    for (const channel of supabase.getChannels()) {
        if (channel.topic === `realtime:${CATALOG_CHANNEL}`) {
            supabase.removeChannel(channel)
        }
    }

    supabase
        .channel(CATALOG_CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'food_menu_items' }, onCatalogChanged)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'spa_services' }, onCatalogChanged)
        .subscribe()
}

function onCatalogChanged() {
    loadCatalog()
    // Only if a dashboard panel is actually open — nothing else needs the
    // hidden rows, and a guest's session cannot read them anyway.
    if (adminCatalog.loaded) loadAdminCatalog()
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

// =============================================================== admin store
//
//  A SECOND list, deliberately. The store above is what guests are sold, so it
//  holds active rows only; the dashboard manages the table itself and has to
//  see a hidden row to be able to bring it back. Keeping them apart is what
//  makes it impossible for an item staff took off the menu to reappear on the
//  guest page because some component read the wrong list.
//
//  It stays empty until a dashboard panel asks for it — a guest never loads
//  rows they aren't allowed to act on.

let adminCatalog = { food: [], spa: [], loaded: false, error: null }

function getAdminCatalog() {
    return adminCatalog
}

function commitAdminCatalog(next) {
    adminCatalog = { ...adminCatalog, ...next }
    notify()
}

// Every row in both catalogs, hidden ones included, newest ordering first by
// category then sort_order — the order the dashboard lists them in.
export async function loadAdminCatalog() {
    if (!isSupabaseConfigured) {
        commitAdminCatalog({ loaded: true, error: SUPABASE_SETUP_MESSAGE })
        return
    }

    const [food, spa] = await Promise.all([
        supabase.from('food_menu_items').select('*').order('category').order('sort_order'),
        supabase.from('spa_services').select('*').order('sort_order'),
    ])

    const error = food.error ?? spa.error
    if (error) {
        console.error('Could not load the catalog for editing:', error.message)
        commitAdminCatalog({ loaded: true, error: describeSupabaseError(error) })
        return
    }

    commitAdminCatalog({
        food: food.data.map(toFoodItem),
        spa: spa.data.map(toSpaItem),
        loaded: true,
        error: null,
    })
}

// Subscribe a dashboard panel to the editable catalog.
export function useAdminCatalog() {
    return useSyncExternalStore(subscribe, getAdminCatalog)
}

// ================================================================= mutations
//
//  Only the staff roster can write these tables — the policies in
//  20260730120000_food_and_spa_catalog.sql say so, and a guest who called any
//  of the functions below would simply be refused by Postgres. Nothing here is
//  the security boundary; it is the shape of the edit.

// 'Sinigang na Liempo' → 'sinigang-na-liempo'. Ids are stable text keys, not
// generated numbers, because a stored order line points at one by id.
function slugify(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
}

// A slug nobody is using yet. An id is what an order line and a price edit both
// point at, so two dishes sharing one would silently overwrite each other.
function uniqueId(base, taken) {
    const root = base || 'item'
    if (!taken.has(root)) return root
    let suffix = 2
    while (taken.has(`${root}-${suffix}`)) suffix += 1
    return `${root}-${suffix}`
}

function priceOrError(price) {
    const value = Number(price)
    if (!Number.isFinite(value) || value < 0) return null
    return Math.round(value * 100) / 100
}

// Both saves take the whole row and upsert it, so the caller does not have to
// know whether it is creating or editing — a form that was opened on an
// existing item simply arrives with its id filled in.
export async function saveFoodItem(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const name = String(draft.name ?? '').trim()
    if (!name) return { ok: false, message: 'Give the item a name.' }

    const price = priceOrError(draft.price)
    if (price == null) return { ok: false, message: 'Enter a price of 0 or more.' }

    const category = draft.category
    if (!FOOD_CATEGORIES.some((entry) => entry.id === category)) {
        return { ok: false, message: 'Pick a category for the item.' }
    }

    // A coffee row is only orderable at a size, so the size is part of what
    // makes it a distinct row — and of its id.
    const sizeLabel = String(draft.sizeLabel ?? '').trim() || null
    const groupKey = String(draft.groupKey ?? '').trim() || null

    const taken = new Set(adminCatalog.food.map((item) => item.id))
    if (draft.id) taken.delete(draft.id)
    const id = draft.id
        || uniqueId(slugify([category === 'coffee' ? 'coffee' : '', groupKey, name, sizeLabel].filter(Boolean).join('-')), taken)

    const row = {
        id,
        category,
        name,
        description: String(draft.desc ?? '').trim() || null,
        price,
        image_key: String(draft.imageKey ?? '').trim() || null,
        image_url: String(draft.imageUrl ?? '').trim() || null,
        group_key: groupKey,
        group_title: String(draft.groupTitle ?? '').trim() || null,
        size_label: sizeLabel,
        has_coffee_option: Boolean(draft.hasCoffeeOption),
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    const { error } = await supabase.from('food_menu_items').upsert(row)
    if (error) {
        console.error('Could not save the menu item:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    await Promise.all([loadCatalog(), loadAdminCatalog()])
    return { ok: true, id }
}

export async function deleteFoodItem(id) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { error } = await supabase.from('food_menu_items').delete().eq('id', id)
    if (error) {
        console.error('Could not delete the menu item:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    // Orders already placed against it keep the name and price they were
    // charged (see add_booking_addon) — deleting the row does not rewrite
    // anyone's bill, it only stops the item being sold again.
    await Promise.all([loadCatalog(), loadAdminCatalog()])
    return { ok: true }
}

export async function saveSpaService(draft) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const name = String(draft.name ?? '').trim()
    if (!name) return { ok: false, message: 'Give the treatment a name.' }

    const price = priceOrError(draft.price)
    if (price == null) return { ok: false, message: 'Enter a price of 0 or more.' }

    const taken = new Set(adminCatalog.spa.map((service) => service.id))
    if (draft.id) taken.delete(draft.id)
    const id = draft.id || uniqueId(slugify(name), taken)

    const row = {
        id,
        name,
        description: String(draft.desc ?? '').trim() || null,
        duration_label: String(draft.duration ?? '').trim() || null,
        price,
        image_key: String(draft.imageKey ?? '').trim() || null,
        image_url: String(draft.imageUrl ?? '').trim() || null,
        sort_order: Number(draft.sortOrder) || 0,
        is_active: draft.isActive !== false,
    }

    const { error } = await supabase.from('spa_services').upsert(row)
    if (error) {
        console.error('Could not save the spa service:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    await Promise.all([loadCatalog(), loadAdminCatalog()])
    return { ok: true, id }
}

export async function deleteSpaService(id) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    const { error } = await supabase.from('spa_services').delete().eq('id', id)
    if (error) {
        console.error('Could not delete the spa service:', error.message)
        return { ok: false, message: describeSupabaseError(error) }
    }

    await Promise.all([loadCatalog(), loadAdminCatalog()])
    return { ok: true }
}
