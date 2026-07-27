import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import './foodmenu.css'
import Footer from '../components/footer'
import LotusDividerIcon from '../components/LotusDividerIcon'
import { SkeletonImage } from '../components/skeletons/Skeleton.jsx'
import food1 from '../assets/images/food1.png'
import food2 from '../assets/images/food2.png'
import food3 from '../assets/images/food3.png'
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
import { useBookings } from './mybooking.jsx'

const orderSteps = [
  'Complete your booking first.',
  'Browse the food menu and select your preferred items.',
  'Choose the quantity for each item.',
  'Review and confirm your order.',
  'The total food cost will automatically be added to your booking receipt.',
]

// The item arrays below are exported so the admin dashboard's food list
// (src/admin/items/foodList.jsx) can reuse the same hardcoded menu data.
export const breakfastItems = [
  { image: menu1, name: 'Sinigang na Liempo', desc: 'Good for 4-5 pax', price: 'PHP 700.00' },
  { image: menu2, name: 'Fried Chicken', desc: 'Good for 3-4 pax', price: 'PHP 350.00' },
  { image: menu3, name: 'Tinola', desc: 'Good for 4-6 pax', price: 'PHP 600.00' },
  { image: menu4, name: 'Inihaw na Liempo', desc: 'Good for 3-4 pax', price: 'PHP 500.00' },
  { image: menu5, name: 'Inihaw na Tilapia', desc: 'Good for 3-4 pax', price: 'PHP 400.00' },
  { image: menu6, name: 'Pork Sisig', desc: 'Good for 3-4 pax', price: 'PHP 400.00' },
  { image: menu7, name: 'Pork Adobo', desc: 'Good for 3-4 pax', price: 'PHP 500.00' },
]

const classicCoffeeOptions = ['Americano', 'Cafe Latte', 'Cappucino', 'Cafe Mocha', 'Caramel Machiatto']
const flavoredCoffeeOptions = ['Vanilla Latte', 'Hazelnut Latte', 'Choco Hazelnut Latte', 'Salted Caramel Latte', 'Matcha Latte', 'White Mocha']
export const FLAVORED_COFFEE_UPCHARGE = 10

export const beverageItems = [
  { image: combo1, name: 'Longsilog', desc: 'Longganisa, Sinangag at Itlog with Classic Hot Coffee', price: 'PHP 230.00', hasCoffeeOption: true },
  { image: combo2, name: 'Hotsilog', desc: 'Hotdog, Sinangag at Itlog with Classic Hot Coffee', price: 'PHP 230.00', hasCoffeeOption: true },
  { image: combo3, name: 'Tapsilog', desc: 'Tapa, Sinangag at Itlog with Classic Hot Coffee', price: 'PHP 260.00', hasCoffeeOption: true },
  { image: combo4, name: 'Tocilog', desc: 'Tocino, Sinangag at Itlog with Classic Hot Coffee', price: 'PHP 260.00', hasCoffeeOption: true },
  { image: combo5, name: 'Chicksilog', desc: 'Chicken, Sinangag at Itlog with Classic Hot Coffee', price: 'PHP 310.00', hasCoffeeOption: true },
  { image: combo6, name: 'Shanghaisilog', desc: 'Shanghai, Sinangag at Itlog with Classic Hot Coffee', price: 'PHP 230.00', hasCoffeeOption: true },
  { image: combo7, name: 'Liemposilog', desc: 'Liempo, Sinangag at Itlog with Classic Hot Coffee', price: 'PHP 310.00', hasCoffeeOption: true },
]

export const preOrderItems = [
  { image: pre1, name: 'Pancit Bihon / Canton', desc: 'Good for 6-7 pax', price: 'PHP 400.00' },
  { image: pre2, name: 'Pancit Bihon / Canton', desc: 'Large Bilao', price: 'PHP 1,500.00' },
  { image: pre3, name: 'Pancit Bihon / Canton', desc: 'Medium Bilao', price: 'PHP 800.00' },
  { image: pre4, name: 'Tofu Sisig', desc: 'Good for 3-4 pax', price: 'PHP 250.00' },
]

// Bukal Cafe by Camp Ba-Long Nature Farm — coffee price list. There are no
// per-flavor photos for these, so the menu renders as price tables instead
// of the photo-card carousel the other categories use.
export const coffeeMenu = [
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
    title: "Iced Fruit Soda and Latte",
    sizeLabels: ['Tall 12oz.', 'Grande 16oz.'],
    flavors: [
      { name: 'Strawberry Soda/Latte', prices: [100, 105] },
      { name: 'Blueberry Soda/Latte', prices: [100, 105] },
      { name: 'Peach Soda/Latte', prices: [100, 105] },
    ],
  },
]

// Flattened per-size list, reused by the admin dashboard's food list and by
// the "add to order" flow (each size is its own orderable line item).
export const coffeeItems = coffeeMenu.flatMap((category) =>
  category.flavors.flatMap((flavor) =>
    flavor.prices.map((price, i) => ({
      image: null,
      name: `${flavor.name} (${category.sizeLabels[i]})`,
      desc: category.title,
      price: `PHP ${price.toFixed(2)}`,
    }))
  )
)

// Kiosk-style order tray. Module-level (same pattern as bookingsStore in
// mybooking.jsx) so it survives client-side navigation away from /menu and
// back — e.g. following the "checkout blocked" links to go make a booking —
// and only resets on a successful checkout, a real page refresh, or closing
// the tab.
let cartStore = []
let cartLineId = 0
const cartListeners = new Set()

function notifyCart() {
  for (const listener of cartListeners) listener()
}

function updateCart(updater) {
  cartStore = updater(cartStore)
  notifyCart()
}

function subscribeCart(listener) {
  cartListeners.add(listener)
  return () => cartListeners.delete(listener)
}

function getCartSnapshot() {
  return cartStore
}

function useCart() {
  const cart = useSyncExternalStore(subscribeCart, getCartSnapshot)

  return {
    cart,
    addToCart(entry) {
      updateCart((prev) => {
        const existing = prev.find((line) => line.name === entry.name)
        if (existing) {
          return prev.map((line) =>
            line.name === entry.name
              ? { ...line, quantity: line.quantity + entry.quantity, total: line.total + entry.total }
              : line
          )
        }
        cartLineId += 1
        return [...prev, { id: cartLineId, ...entry }]
      })
    },
    adjustQuantity(id, delta) {
      updateCart((prev) =>
        prev
          .map((line) =>
            line.id === id
              ? { ...line, quantity: line.quantity + delta, total: line.unitPrice * (line.quantity + delta) }
              : line
          )
          .filter((line) => line.quantity > 0)
      )
    },
    removeLine(id) {
      updateCart((prev) => prev.filter((line) => line.id !== id))
    },
    clearCart() {
      updateCart(() => [])
    },
  }
}

function SubcategoryToggle({ label, expanded, onToggle }) {
  return (
    <button
      type="button"
      className={`menu-subcategory-label${expanded ? '' : ' is-collapsed'}`}
      onClick={onToggle}
      aria-expanded={expanded}
    >
      {label}
      <span className="menu-subcategory-chevron">⌄</span>
    </button>
  )
}

function CategoryTitle({ children, plain }) {
  return (
    <>
      <h2 className={`menu-category-title${plain ? ' plain' : ''}`}>
        <span className="menu-category-title-mark" aria-hidden="true">✦</span>
        {children}
        <span className="menu-category-title-mark" aria-hidden="true">✦</span>
      </h2>
      {plain && <LotusDividerIcon />}
    </>
  )
}

function FoodOrderModal({ item, onClose, onAddToCart }) {
  const [quantity, setQuantity] = useState(1)
  const [confirmed, setConfirmed] = useState(false)
  const [coffeeChoice, setCoffeeChoice] = useState(
    item.hasCoffeeOption ? classicCoffeeOptions[0] : null
  )
  const [step, setStep] = useState('details')
  const showingCoffeeStep = item.hasCoffeeOption && step === 'coffee'

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  useEffect(() => {
    if (!confirmed) return
    const timer = setTimeout(onClose, 900)
    return () => clearTimeout(timer)
  }, [confirmed, onClose])

  const decrease = () => setQuantity((current) => Math.max(1, current - 1))
  const increase = () => setQuantity((current) => current + 1)

  const isFlavoredCoffee = coffeeChoice && flavoredCoffeeOptions.includes(coffeeChoice)
  const coffeeUpcharge = isFlavoredCoffee ? FLAVORED_COFFEE_UPCHARGE : 0
  const unitPrice = (Number(item.price.replace(/[^0-9.]/g, '')) || 0) + coffeeUpcharge
  const total = unitPrice * quantity

  const handleConfirm = () => {
    const orderName = item.hasCoffeeOption && coffeeChoice ? `${item.name} (${coffeeChoice})` : item.name
    onAddToCart({
      image: item.image,
      name: orderName,
      unitPrice,
      quantity,
      total,
    })
    setConfirmed(true)
  }

  return (
    <div className="food-order-overlay" onClick={onClose}>
      <div
        className="food-order-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Order ${item.name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="food-order-close" onClick={onClose} aria-label="Close">
          &times;
        </button>

        {confirmed ? (
          <div className="food-order-confirmed">
            <span className="food-order-confirmed-icon" aria-hidden="true">✓</span>
            <p>Added to your order!</p>
          </div>
        ) : (
          <div className={`food-order-body${item.image ? '' : ' no-image'}`}>
            {item.image && (
              <div className="food-order-image">
                <SkeletonImage src={item.image} alt={item.name} />
              </div>
            )}
            <div className="food-order-details">
              {showingCoffeeStep ? (
                <>
                  <h3 className="food-order-name">{item.name}</h3>

                  <div className="food-order-coffee">
                    <p className="food-order-coffee-label">Pick Your Coffee</p>

                    <span className="food-order-coffee-group-title">Classic Hot Coffee</span>
                    <div className="food-order-coffee-options">
                      {classicCoffeeOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`food-order-coffee-option${coffeeChoice === option ? ' is-selected' : ''}`}
                          onClick={() => setCoffeeChoice(option)}
                          aria-pressed={coffeeChoice === option}
                        >
                          {option}
                        </button>
                      ))}
                    </div>

                    <span className="food-order-coffee-group-title">
                      Flavored Hot Special <span className="food-order-coffee-upcharge">+ PHP {FLAVORED_COFFEE_UPCHARGE.toFixed(2)}</span>
                    </span>
                    <div className="food-order-coffee-options">
                      {flavoredCoffeeOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`food-order-coffee-option${coffeeChoice === option ? ' is-selected' : ''}`}
                          onClick={() => setCoffeeChoice(option)}
                          aria-pressed={coffeeChoice === option}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="food-order-total">
                    Total: PHP {total.toFixed(2)}
                    {isFlavoredCoffee && (
                      <span className="food-order-total-note"> (includes +PHP {FLAVORED_COFFEE_UPCHARGE.toFixed(2)} flavored coffee)</span>
                    )}
                  </p>

                  <div className="food-order-step-actions">
                    <button type="button" className="food-order-back" onClick={() => setStep('details')}>
                      ‹ Back
                    </button>
                    <button type="button" className="food-order-confirm" onClick={handleConfirm}>
                      Add to Order
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="food-order-name">{item.name}</h3>
                  <p className="food-order-desc">{item.desc}</p>
                  <p className="food-order-price">{item.price}</p>

                  <div className="food-order-quantity">
                    <button
                      type="button"
                      onClick={decrease}
                      aria-label="Decrease quantity"
                      disabled={quantity <= 1}
                    >
                      −
                    </button>
                    <span>{quantity}</span>
                    <button type="button" onClick={increase} aria-label="Increase quantity">
                      +
                    </button>
                  </div>

                  {!item.hasCoffeeOption && (
                    <p className="food-order-total">Total: PHP {total.toFixed(2)}</p>
                  )}

                  <button
                    type="button"
                    className="food-order-confirm"
                    onClick={item.hasCoffeeOption ? () => setStep('coffee') : handleConfirm}
                  >
                    {item.hasCoffeeOption ? 'Next' : 'Add to Order'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MenuFoodRow({ items, onAddToOrder }) {
  const total = items.length
  // Three back-to-back copies of the items give a buffer cycle on either
  // side, so the track can always slide one more step in either direction.
  const combined = [...items, ...items, ...items]

  const trackRef = useRef(null)
  const skipTransitionRef = useRef(true)
  const [position, setPosition] = useState(total)

  const applyOffset = useCallback((animate) => {
    const track = trackRef.current
    const target = track?.children[position]
    if (!track || !target) return
    const trackRect = track.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const shift = targetRect.left - trackRect.left
    track.style.transition = animate ? '' : 'none'
    track.style.transform = `translateX(${-shift}px)`
    if (!animate) {
      // Force layout so the browser commits the jump before transitions resume.
      void track.offsetHeight
      track.style.transition = ''
    }
  }, [position])

  useLayoutEffect(() => {
    applyOffset(!skipTransitionRef.current)
    skipTransitionRef.current = false
  }, [applyOffset])

  useEffect(() => {
    const handleResize = () => applyOffset(false)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [applyOffset])

  const handleTransitionEnd = () => {
    if (position >= total * 2) {
      skipTransitionRef.current = true
      setPosition((current) => current - total)
    } else if (position < total) {
      skipTransitionRef.current = true
      setPosition((current) => current + total)
    }
  }

  const showPrev = () => setPosition((current) => current - 1)
  const showNext = () => setPosition((current) => current + 1)

  return (
    <div className="menu-row-wrap">
      <button type="button" className="menu-arrow" onClick={showPrev} aria-label="Show previous item">
        ‹
      </button>
      <div className="menu-row">
        <div className="menu-row-track" ref={trackRef} onTransitionEnd={handleTransitionEnd}>
          {combined.map((item, i) => (
            <article className="menu-food-card" key={`${item.name}-${i}`}>
              <div className="menu-food-image">
                <SkeletonImage src={item.image} alt={item.name} />
              </div>
              <h3 className="menu-food-name">{item.name}</h3>
              <p className="menu-food-desc">{item.desc}</p>
              <p className="menu-food-price">{item.price}</p>
              <button
                type="button"
                className="menu-food-add"
                onClick={() => onAddToOrder(item)}
              >
                ADD TO ORDER
              </button>
            </article>
          ))}
        </div>
      </div>
      <button type="button" className="menu-arrow" onClick={showNext} aria-label="Show next item">
        ›
      </button>
    </div>
  )
}

function CoffeeMenuCategory({ category, onAddToOrder }) {
  return (
    <div className="coffee-card">
      <h3 className="coffee-card-title">{category.title}</h3>
      <table className="coffee-table">
        <thead>
          <tr>
            <th className="coffee-table-flavor-head">Flavor</th>
            {category.sizeLabels.map((size) => (
              <th key={size}>{size}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {category.flavors.map((flavor) => (
            <tr key={flavor.name}>
              <td className="coffee-table-flavor">{flavor.name}</td>
              {flavor.prices.map((price, i) => (
                <td key={category.sizeLabels[i]}>
                  <button
                    type="button"
                    className="coffee-price-btn"
                    onClick={() =>
                      onAddToOrder({
                        image: null,
                        name: `${flavor.name} (${category.sizeLabels[i]})`,
                        desc: category.title,
                        price: `PHP ${price.toFixed(2)}`,
                      })
                    }
                  >
                    {price}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CoffeeMenuSection({ onAddToOrder }) {
  // Two independently-stacking columns (instead of a strict grid) so a
  // shorter card's column keeps flowing upward instead of leaving a gap
  // underneath it — the left column ends up: Classic Hot, Flavored Hot,
  // Iced Fruit Soda and Latte; the right column: Classic Iced, Flavored Iced.
  const leftColumn = coffeeMenu.filter((_, i) => i % 2 === 0)
  const rightColumn = coffeeMenu.filter((_, i) => i % 2 === 1)

  return (
    <div className="coffee-menu-wrap">
      <p className="coffee-menu-hint">Tap a price to add that size to your order.</p>
      <div className="coffee-menu-grid">
        <div className="coffee-menu-column">
          {leftColumn.map((category) => (
            <CoffeeMenuCategory key={category.key} category={category} onAddToOrder={onAddToOrder} />
          ))}
        </div>
        <div className="coffee-menu-column">
          {rightColumn.map((category) => (
            <CoffeeMenuCategory key={category.key} category={category} onAddToOrder={onAddToOrder} />
          ))}
        </div>
      </div>
    </div>
  )
}

function CheckoutPanel({ cart, status, onIncrease, onDecrease, onRemove, onPlaceOrder, onDismissBlocked }) {
  const [collapsed, setCollapsed] = useState(false)

  if (cart.length === 0 && status !== 'success') return null

  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0)
  const subtotal = cart.reduce((sum, line) => sum + line.total, 0)

  return (
    <aside className={`kiosk-checkout${collapsed ? ' is-collapsed' : ''}`} aria-label="Your order">
      <button
        type="button"
        className="kiosk-checkout-header"
        onClick={() => setCollapsed((current) => !current)}
        aria-expanded={!collapsed}
      >
        <span className="kiosk-checkout-header-left">
          <span className="kiosk-checkout-bag" aria-hidden="true">🛍</span>
          <span className="kiosk-checkout-title">Your Order</span>
          {itemCount > 0 && <span className="kiosk-checkout-count">{itemCount}</span>}
        </span>
        <span className="kiosk-checkout-chevron" aria-hidden="true">{collapsed ? '︿' : '﹀'}</span>
      </button>

      {!collapsed && (
        <div className="kiosk-checkout-body">
          {status === 'success' ? (
            <div className="kiosk-checkout-success">
              <span className="kiosk-checkout-success-icon" aria-hidden="true">✓</span>
              <p>Order sent to your booking receipt!</p>
            </div>
          ) : status === 'blocked' ? (
            <div className="kiosk-checkout-blocked">
              <span className="kiosk-checkout-blocked-icon" aria-hidden="true">!</span>
              <p>
                You need a confirmed booking with an uploaded down-payment
                receipt before you can place this order.
              </p>
              <div className="kiosk-checkout-blocked-actions">
                <Link to="/my-booking" className="kiosk-checkout-blocked-link">
                  View My Bookings
                </Link>
                <Link to="/booking" className="kiosk-checkout-blocked-link primary">
                  Book Now
                </Link>
              </div>
              <button type="button" className="kiosk-checkout-back" onClick={onDismissBlocked}>
                ‹ Back to Order
              </button>
            </div>
          ) : (
            <>
              <ul className="kiosk-checkout-list">
                {cart.map((line) => (
                  <li className="kiosk-checkout-item" key={line.id}>
                    <div className={`kiosk-checkout-thumb${line.image ? '' : ' is-empty'}`}>
                      {line.image ? <img src={line.image} alt="" /> : <span aria-hidden="true">☕</span>}
                    </div>
                    <div className="kiosk-checkout-item-info">
                      <p className="kiosk-checkout-item-name">{line.name}</p>
                      <p className="kiosk-checkout-item-price">PHP {line.unitPrice.toFixed(2)} each</p>
                    </div>
                    <div className="kiosk-checkout-item-controls">
                      <div className="kiosk-checkout-stepper">
                        <button type="button" onClick={() => onDecrease(line.id)} aria-label={`Decrease ${line.name}`}>
                          −
                        </button>
                        <span>{line.quantity}</span>
                        <button type="button" onClick={() => onIncrease(line.id)} aria-label={`Increase ${line.name}`}>
                          +
                        </button>
                      </div>
                      <p className="kiosk-checkout-item-total">PHP {line.total.toFixed(2)}</p>
                    </div>
                    <button
                      type="button"
                      className="kiosk-checkout-remove"
                      onClick={() => onRemove(line.id)}
                      aria-label={`Remove ${line.name} from order`}
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>

              <div className="kiosk-checkout-summary">
                <div className="kiosk-checkout-summary-row kiosk-checkout-summary-total">
                  <span>Total</span>
                  <span>PHP {subtotal.toFixed(2)}</span>
                </div>
              </div>

              <button type="button" className="kiosk-checkout-place" onClick={onPlaceOrder}>
                Place Order · PHP {subtotal.toFixed(2)}
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  )
}

function FoodMenuPage() {
  const howToOrderRef = useRef(null)
  const { findOrderableBooking, addFoodOrderToBooking } = useBookings()

  const [expanded, setExpanded] = useState({
    breakfast: true,
    beverages: true,
    preOrder: true,
    coffee: true,
  })

  const [orderItem, setOrderItem] = useState(null)

  // Items picked in the modal land here first — a kiosk-style order tray —
  // and only get pushed onto the booking receipt once the guest checks out.
  const { cart, addToCart: addLineToCart, adjustQuantity: adjustCartQuantity, removeLine: removeCartLine, clearCart } = useCart()
  const [checkoutStatus, setCheckoutStatus] = useState('idle') // idle | blocked | success

  const toggleSection = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const scrollToHowToOrder = () => {
    howToOrderRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const addToCart = (entry) => {
    setCheckoutStatus('idle')
    addLineToCart(entry)
  }

  const handlePlaceOrder = () => {
    // Eligibility is only checked at checkout, so browsing and building
    // the order tray never requires a booking up front.
    const targetBooking = findOrderableBooking()
    if (!targetBooking) {
      setCheckoutStatus('blocked')
      return
    }
    const orderedAt = new Date().toISOString()
    cart.forEach((line) => {
      addFoodOrderToBooking(targetBooking.id, {
        name: line.name,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        total: line.total,
        orderedAt,
      })
    })
    clearCart()
    setCheckoutStatus('success')
  }

  useEffect(() => {
    if (checkoutStatus !== 'success') return
    const timer = setTimeout(() => setCheckoutStatus('idle'), 2200)
    return () => clearTimeout(timer)
  }, [checkoutStatus])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [])

  return (
    <>
    <main className="foodmenu-page">
      <section className="foodmenu-hero">
        <div className="foodmenu-hero-inner">
          <div className="foodmenu-hero-content">
            <h1 className="foodmenu-hero-title">
              Hungry? We&apos;ve Got<br />
              You Covered.
            </h1>
            <p className="foodmenu-hero-subtitle">
              Explore our menu and discover dishes you&apos;ll keep coming back for.
            </p>
            <div className="foodmenu-hero-buttons">
              <button type="button" className="foodmenu-order-btn" onClick={scrollToHowToOrder}>
                <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                  <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                  <path d="M7 2v20" />
                  <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                </svg>
                Order Now
              </button>
            </div>
          </div>
          <div className="foodmenu-hero-image">
            <SkeletonImage src={food1} alt="Featured dish" />
          </div>
        </div>
      </section>

      <section className="howto-order" ref={howToOrderRef}>
        <div className="howto-order-panel">
          <div className="howto-order-image">
            <img src={food2} alt="Chef preparing a dish" />
          </div>
          <div className="howto-order-content">
            <h3>How to Order Food</h3>
            <ol>
              {orderSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
        <p className="howto-order-note">
          <span className="howto-order-note-icon" aria-hidden="true">!</span>
          <span><strong>Note:</strong> Food orders are subject to availability and may be modified before the preparation cutoff time.</span>
        </p>
      </section>

      <section className="menu-category">
        <div
          className="menu-category-banner"
          style={{ backgroundImage: `url(${food3})` }}
        >
          <CategoryTitle>MENU</CategoryTitle>
        </div>
        <div className="menu-category-toggle-row">
          <SubcategoryToggle
            label="Foods"
            expanded={expanded.breakfast}
            onToggle={() => toggleSection('breakfast')}
          />
        </div>
        {expanded.breakfast && <MenuFoodRow items={breakfastItems} onAddToOrder={setOrderItem} />}
      </section>

      <section className="menu-category">
        <div className="menu-category-header">
          <CategoryTitle plain>COMBO MEAL</CategoryTitle>
          <SubcategoryToggle
            label="Meals"
            expanded={expanded.beverages}
            onToggle={() => toggleSection('beverages')}
          />
        </div>
        {expanded.beverages && <MenuFoodRow items={beverageItems} onAddToOrder={setOrderItem} />}
      </section>

      <section className="menu-category">
        <div className="menu-category-header">
          <CategoryTitle plain>PRE-ORDER</CategoryTitle>
          <SubcategoryToggle
            label="Foods"
            expanded={expanded.preOrder}
            onToggle={() => toggleSection('preOrder')}
          />
        </div>
        {expanded.preOrder && <MenuFoodRow items={preOrderItems} onAddToOrder={setOrderItem} />}
      </section>

      <section className="menu-category coffee-menu-section">
        <div className="menu-category-header">
          <p className="coffee-menu-eyebrow">Bukal Cafe by Camp Ba-Long Nature Farm</p>
          <CategoryTitle plain>COFFEE</CategoryTitle>
          <SubcategoryToggle
            label="Coffee Menu"
            expanded={expanded.coffee}
            onToggle={() => toggleSection('coffee')}
          />
        </div>
        {expanded.coffee && <CoffeeMenuSection onAddToOrder={setOrderItem} />}
      </section>

    </main>

    <Footer />
    {orderItem && (
      <FoodOrderModal item={orderItem} onClose={() => setOrderItem(null)} onAddToCart={addToCart} />
    )}
    <CheckoutPanel
      cart={cart}
      status={checkoutStatus}
      onIncrease={(id) => adjustCartQuantity(id, 1)}
      onDecrease={(id) => adjustCartQuantity(id, -1)}
      onRemove={removeCartLine}
      onPlaceOrder={handlePlaceOrder}
      onDismissBlocked={() => setCheckoutStatus('idle')}
    />
  </>
  )
}

export default FoodMenuPage
