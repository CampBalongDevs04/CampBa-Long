import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import './foodmenu.css'
import Footer from '../components/footer'
import LotusDividerIcon from '../components/LotusDividerIcon'
import { SkeletonImage } from '../components/skeletons/Skeleton.jsx'
import { useBookings } from '../data/useBookings.js'
// The banner's own words and photos — see CMS → Food Menu → Menu Banner.
import { useMenuHero, loadMenuHero, resolveMenuHeroImage, resolveMenuHeroBackground } from '../data/menuHero.js'
// The How to Order panel and its steps — see CMS → Food Menu → How to Order.
import { useMenuOrder, loadMenuOrder, resolveMenuOrderImage } from '../data/menuOrder.js'
// The heading, toggle label and MENU banner photo each catalog section
// prints — see CMS → Food Menu → Section titles.
import { useMenuSections, loadMenuSections, resolveMenuSectionImage } from '../data/menuSections.js'
// The menu itself lives in Postgres (food_menu_items) — see data/menuDB.js.
// This page renders whatever the catalog says, so a price edited there needs
// no code change here.
import {
  useFoodMenu,
  groupCoffeeMenu,
  formatMenuPrice,
  CLASSIC_COFFEE_OPTIONS,
  FLAVORED_COFFEE_OPTIONS,
  FLAVORED_COFFEE_UPCHARGE,
} from '../data/menuDB.js'

// Where the banner's button goes decides what it is — same reasoning as
// HeroButton in pages/home.jsx. A path is routed inside the app, so it must
// be a <Link>; an anchor like "#how-to-order" scrolls to that panel further
// down this same page (html has scroll-behavior: smooth — see
// components/css/Header.css — so this needs no scrollIntoView of its own);
// anything else is somewhere off the site.
function OrderButton({ href, label, className, children }) {
  if (!label) return null
  const target = href || '#how-to-order'

  if (target.startsWith('/')) {
    return (
      <Link className={className} to={target}>
        {children}
        {label}
      </Link>
    )
  }

  const external = /^https?:\/\//i.test(target)
  return (
    <a
      className={className}
      href={target}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
      {label}
    </a>
  )
}

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
    item.hasCoffeeOption ? CLASSIC_COFFEE_OPTIONS[0] : null
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

  const isFlavoredCoffee = coffeeChoice && FLAVORED_COFFEE_OPTIONS.includes(coffeeChoice)
  const coffeeUpcharge = isFlavoredCoffee ? FLAVORED_COFFEE_UPCHARGE : 0
  const unitPrice = Number(item.price) + coffeeUpcharge
  const total = unitPrice * quantity

  const handleConfirm = () => {
    const orderName = item.hasCoffeeOption && coffeeChoice ? `${item.label} (${coffeeChoice})` : item.label
    onAddToCart({
      // The catalog row this line came from, so the admin dashboard can group
      // orders by menu item instead of by whatever the name read at the time.
      itemId: item.id,
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
        aria-label={`Order ${item.label}`}
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
                <SkeletonImage src={item.image} alt={item.label} />
              </div>
            )}
            <div className="food-order-details">
              {showingCoffeeStep ? (
                <>
                  <h3 className="food-order-name">{item.label}</h3>

                  <div className="food-order-coffee">
                    <p className="food-order-coffee-label">Pick Your Coffee</p>

                    <span className="food-order-coffee-group-title">Classic Hot Coffee</span>
                    <div className="food-order-coffee-options">
                      {CLASSIC_COFFEE_OPTIONS.map((option) => (
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
                      {FLAVORED_COFFEE_OPTIONS.map((option) => (
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
                  <h3 className="food-order-name">{item.label}</h3>
                  <p className="food-order-desc">{item.desc}</p>
                  <p className="food-order-price">{formatMenuPrice(item.price)}</p>

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

  // A category with every item deactivated in the catalog has nothing to
  // slide through, and the track's arithmetic is all relative to `total`.
  // Checked after the hooks so the order they run in never changes.
  if (total === 0) return null

  return (
    <div className="menu-row-wrap">
      <button type="button" className="menu-arrow" onClick={showPrev} aria-label="Show previous item">
        ‹
      </button>
      <div className="menu-row">
        <div className="menu-row-track" ref={trackRef} onTransitionEnd={handleTransitionEnd}>
          {combined.map((item, i) => (
            <article className="menu-food-card" key={`${item.id}-${i}`}>
              <div className="menu-food-image">
                <SkeletonImage src={item.image} alt={item.name} />
              </div>
              <h3 className="menu-food-name">{item.name}</h3>
              <p className="menu-food-desc">{item.desc}</p>
              <p className="menu-food-price">{formatMenuPrice(item.price)}</p>
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
              {/* Walked per SIZE COLUMN rather than per price, so a flavor the
                  catalog doesn't sell in every size leaves a blank cell
                  instead of sliding its neighbours one column left. */}
              {category.sizeLabels.map((size, i) => {
                const item = flavor.items[i]
                return (
                  <td key={size}>
                    {item ? (
                      <button
                        type="button"
                        className="coffee-price-btn"
                        onClick={() => onAddToOrder(item)}
                      >
                        {item.price}
                      </button>
                    ) : (
                      <span className="coffee-price-none" aria-hidden="true">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CoffeeMenuSection({ groups, onAddToOrder }) {
  // Two independently-stacking columns (instead of a strict grid) so a
  // shorter card's column keeps flowing upward instead of leaving a gap
  // underneath it — the left column ends up: Classic Hot, Flavored Hot,
  // Iced Fruit Soda and Latte; the right column: Classic Iced, Flavored Iced.
  const leftColumn = groups.filter((_, i) => i % 2 === 0)
  const rightColumn = groups.filter((_, i) => i % 2 === 1)

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
          <span className="kiosk-checkout-bag" aria-hidden="true" />
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
                You need a booking before you can order. Reserve your stay
                first — food is added to your down payment, so ordering
                before you pay keeps it to one payment.
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
  const { findOrderableBooking, addFoodOrderToBooking } = useBookings()

  // The banner's headline, subtitle, button label and photos — straight from
  // menu_hero. Re-renders on its own once the row lands, so nothing here has
  // to wait for it.
  const { hero: menuHero } = useMenuHero()
  // The How to Order panel and its steps — straight from menu_order /
  // menu_order_steps.
  const { panel: howToOrder, activeSteps: howToOrderSteps } = useMenuOrder()
  // The heading each catalog section prints — straight from menu_sections.
  const { sections: menuSections } = useMenuSections()
  useEffect(() => {
    loadMenuHero()
    loadMenuOrder()
    loadMenuSections()
  }, [])

  // The menu, straight from food_menu_items. Re-renders on its own once the
  // rows land, so nothing here has to wait for them.
  const menu = useFoodMenu()
  const breakfastItems = menu.filter((item) => item.category === 'breakfast')
  const beverageItems = menu.filter((item) => item.category === 'combo')
  const preOrderItems = menu.filter((item) => item.category === 'pre-order')
  const coffeeGroups = groupCoffeeMenu(menu)

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
    cart.forEach((line) => {
      addFoodOrderToBooking(targetBooking, {
        // The catalog row, so staff can group the kitchen's work by dish.
        itemId: line.itemId,
        name: line.name,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        total: line.total,
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
      <section
        className="foodmenu-hero"
        // Only set when staff have uploaded one: the stylesheet already
        // paints the backdrop the site shipped with, and an inline style that
        // repeated it would make the CSS look dead the next time somebody
        // reads it — same reasoning as the home hero's background.
        style={menuHero.backgroundUrl
          ? { '--foodmenu-hero-bg': `url(${resolveMenuHeroBackground(menuHero.backgroundUrl)})` }
          : undefined}
      >
        <div className="foodmenu-hero-inner">
          <div className="foodmenu-hero-content">
            <h1 className="foodmenu-hero-title">
              {menuHero.titleLines.map((line, index) => (
                <span key={`${line}-${index}`}>{line}<br /></span>
              ))}
            </h1>
            <p className="foodmenu-hero-subtitle">{menuHero.subtitle}</p>
            <div className="foodmenu-hero-buttons">
              <OrderButton
                className="foodmenu-order-btn"
                href={menuHero.buttonHref}
                label={menuHero.buttonLabel}
              >
                <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                  <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                  <path d="M7 2v20" />
                  <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                </svg>
              </OrderButton>
            </div>
          </div>
          <div className="foodmenu-hero-image">
            <SkeletonImage src={resolveMenuHeroImage(menuHero.imageUrl)} alt="Featured dish" />
          </div>
        </div>
      </section>

      <section className="howto-order" id="how-to-order">
        <div className="howto-order-panel">
          <div className="howto-order-image">
            <img src={resolveMenuOrderImage(howToOrder.imageUrl)} alt="Chef preparing a dish" />
          </div>
          <div className="howto-order-content">
            <h3>{howToOrder.heading}</h3>
            <ol>
              {howToOrderSteps.map((step) => (
                <li key={step.id}>{step.step}</li>
              ))}
            </ol>
          </div>
        </div>
        {(howToOrder.noteLabel || howToOrder.noteText) && (
          <p className="howto-order-note">
            <span className="howto-order-note-icon" aria-hidden="true">!</span>
            <span>
              {howToOrder.noteLabel && <strong>{howToOrder.noteLabel} </strong>}
              {howToOrder.noteText}
            </span>
          </p>
        )}
      </section>

      <section className="menu-category">
        <div
          className="menu-category-banner"
          style={{ backgroundImage: `url(${resolveMenuSectionImage(menuSections.menuImageUrl)})` }}
        >
          <CategoryTitle>{menuSections.menuTitle}</CategoryTitle>
        </div>
        <div className="menu-category-toggle-row">
          <SubcategoryToggle
            label={menuSections.menuToggleLabel}
            expanded={expanded.breakfast}
            onToggle={() => toggleSection('breakfast')}
          />
        </div>
        {expanded.breakfast && <MenuFoodRow items={breakfastItems} onAddToOrder={setOrderItem} />}
      </section>

      <section className="menu-category">
        <div className="menu-category-header">
          <CategoryTitle plain>{menuSections.comboTitle}</CategoryTitle>
          <SubcategoryToggle
            label={menuSections.comboToggleLabel}
            expanded={expanded.beverages}
            onToggle={() => toggleSection('beverages')}
          />
        </div>
        {expanded.beverages && <MenuFoodRow items={beverageItems} onAddToOrder={setOrderItem} />}
      </section>

      <section className="menu-category">
        <div className="menu-category-header">
          <CategoryTitle plain>{menuSections.preorderTitle}</CategoryTitle>
          <SubcategoryToggle
            label={menuSections.preorderToggleLabel}
            expanded={expanded.preOrder}
            onToggle={() => toggleSection('preOrder')}
          />
        </div>
        {expanded.preOrder && <MenuFoodRow items={preOrderItems} onAddToOrder={setOrderItem} />}
      </section>

      <section className="menu-category coffee-menu-section">
        <div className="menu-category-header">
          {menuSections.coffeeEyebrow && (
            <p className="coffee-menu-eyebrow">{menuSections.coffeeEyebrow}</p>
          )}
          <CategoryTitle plain>{menuSections.coffeeTitle}</CategoryTitle>
          <SubcategoryToggle
            label={menuSections.coffeeToggleLabel}
            expanded={expanded.coffee}
            onToggle={() => toggleSection('coffee')}
          />
        </div>
        {expanded.coffee && <CoffeeMenuSection groups={coffeeGroups} onAddToOrder={setOrderItem} />}
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
