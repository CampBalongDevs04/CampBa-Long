import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import './foodmenu.css'
import Footer from '../components/footer'
import LotusDividerIcon from '../components/LotusDividerIcon'
import food1 from '../assets/images/food1.png'
import food2 from '../assets/images/food2.png'
import food3 from '../assets/images/food3.png'
import food4 from '../assets/images/food4.png'
import food5 from '../assets/images/food5.png'
import food6 from '../assets/images/food6.png'
import food7 from '../assets/images/food7.png'
import food8 from '../assets/images/food8.png'
import food9 from '../assets/images/food9.png'
import food10 from '../assets/images/food10.png'
import food11 from '../assets/images/food11.png'
import food12 from '../assets/images/food12.png'
import food13 from '../assets/images/food13.png'
import food14 from '../assets/images/food14.png'
import food15 from '../assets/images/food15.png'
import food16 from '../assets/images/food16.png'
import food17 from '../assets/images/food17.png'
import food18 from '../assets/images/food18.png'
import food19 from '../assets/images/food19.png'
import food20 from '../assets/images/food20.png'
import food21 from '../assets/images/food21.png'
import food22 from '../assets/images/food22.png'
import food23 from '../assets/images/food23.png'
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
  { image: food4, name: 'Hotsilog', desc: 'Hotdog / Egg / Cucumber / Tomato / Fried Rice', price: 'PHP 110.00' },
  { image: food5, name: 'Tapsilog', desc: 'Tapa / Egg / Fried Garlic / Tomato / Fried Rice', price: 'PHP 120.00' },
  { image: food6, name: 'Longsilog', desc: 'Longganisa / Egg / Fried Garlic / Fried Rice', price: 'PHP 120.00' },
]

export const beverageItems = [
  { image: food7, name: 'Americano', desc: 'Hot Brewed / Iced', price: 'PHP 100.00' },
  { image: food8, name: 'Salted Caramel', desc: 'Hot Brewed / Iced', price: 'PHP 150.00' },
  { image: food9, name: 'Vanilla Latte', desc: 'Hot Brewed / Iced', price: 'PHP 130.00' },
]

export const lunchItems = [
  { image: food11, name: 'Pork Adobo', desc: 'Pork / Soy Sauce / Vinegar / Paminta / Onion / Garlic', price: 'PHP 110.00' },
  { image: food12, name: 'Kare-Kare', desc: 'Pork / Talong / Sitaw / Pechay / Peanut Bagoong', price: 'PHP 120.00' },
  { image: food13, name: 'Paksiw', desc: 'Bangus / Green Chili / Vinegar / Onion / Garlic / Ampalaya', price: 'PHP 120.00' },
]

export const coldDrinkItems = [
  { image: food14, name: 'Softdrinks', desc: 'Family Serving', price: 'PHP 100.00' },
  { image: food15, name: 'Strawberry Hibiscus', desc: 'Family Serving / Single', price: 'PHP 150.00' },
  { image: food16, name: 'Blue Lemonade', desc: 'Family Serving / Single', price: 'PHP 130.00' },
]
export const dinnerItems = [
  { image: food18, name: 'Pork Chicken Adobo', desc: 'Pork / Chicken / Soy Sauce / Vinegar / Paminta / Onion / Garlic', price: 'PHP 125.00' },
  { image: food19, name: 'Menudo', desc: 'Pork / Liver / Potato / Carrot / Bell Pepper / Tomato Sauce', price: 'PHP 140.00' },
  { image: food20, name: 'Monggo', desc: 'Mung Beans / Sitaw / Ampalaya / Malunggay / Pork', price: 'PHP 110.00' },
]

export const dinnerDrinkItems = [
  { image: food21, name: "Sago't Gulaman Special", desc: 'Single Serving', price: 'PHP 65.00' },
  { image: food22, name: 'Calamansi Juice', desc: 'Family Serving', price: 'PHP 130.00' },
  { image: food23, name: 'Creamy Melon Vanilla', desc: 'Family Serving', price: 'PHP 150.00' },
]

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

function FoodOrderModal({ item, onClose }) {
  const { findOrderableBooking, addFoodOrderToBooking } = useBookings()
  const [quantity, setQuantity] = useState(1)
  const [confirmed, setConfirmed] = useState(false)
  const [blocked, setBlocked] = useState(false)

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
    const timer = setTimeout(onClose, 1400)
    return () => clearTimeout(timer)
  }, [confirmed, onClose])

  const decrease = () => setQuantity((current) => Math.max(1, current - 1))
  const increase = () => setQuantity((current) => current + 1)

  const unitPrice = Number(item.price.replace(/[^0-9.]/g, '')) || 0
  const total = unitPrice * quantity

  const handleConfirm = () => {
    // Eligibility is only checked once the guest actually tries to
    // confirm, so the ordering form is what they see first.
    const targetBooking = findOrderableBooking()
    if (!targetBooking) {
      setBlocked(true)
      return
    }
    addFoodOrderToBooking(targetBooking.id, {
      name: item.name,
      unitPrice,
      quantity,
      total,
      orderedAt: new Date().toISOString(),
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
            <p>Added to your booking receipt!</p>
          </div>
        ) : blocked ? (
          <div className="food-order-blocked">
            <span className="food-order-blocked-icon" aria-hidden="true">!</span>
            <p>
              You need a confirmed booking with an uploaded down-payment
              receipt before you can order food.
            </p>
            <div className="food-order-blocked-actions">
              <Link to="/my-booking" className="food-order-blocked-link">
                View My Bookings
              </Link>
              <Link to="/booking" className="food-order-blocked-link food-order-blocked-link-primary">
                Book Now
              </Link>
            </div>
          </div>
        ) : (
          <div className="food-order-body">
            <div className="food-order-image">
              <img src={item.image} alt={item.name} />
            </div>
            <div className="food-order-details">
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

              <p className="food-order-total">Total: PHP {total.toFixed(2)}</p>

              <button type="button" className="food-order-confirm" onClick={handleConfirm}>
                Add to Booking Receipt
              </button>
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
                <img src={item.image} alt={item.name} />
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

function FoodMenuPage() {
  const howToOrderRef = useRef(null)

  const [expanded, setExpanded] = useState({
    breakfast: true,
    beverages: true,
    lunch: true,
    coldDrinks: true,
    dinner: true,
    dinnerDrinks: true,
  })

  const [orderItem, setOrderItem] = useState(null)

  const toggleSection = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const scrollToHowToOrder = () => {
    howToOrderRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

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
            <img src={food1} alt="Featured dish" />
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
          <CategoryTitle>BREAKFAST</CategoryTitle>
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
          <CategoryTitle plain>BEVERAGES</CategoryTitle>
          <SubcategoryToggle
            label="Coffee"
            expanded={expanded.beverages}
            onToggle={() => toggleSection('beverages')}
          />
        </div>
        {expanded.beverages && <MenuFoodRow items={beverageItems} onAddToOrder={setOrderItem} />}
      </section>

      <section className="menu-category">
        <div
          className="menu-category-banner"
          style={{ backgroundImage: `url(${food10})` }}
        >
          <CategoryTitle>LUNCH</CategoryTitle>
        </div>
        <div className="menu-category-toggle-row">
          <SubcategoryToggle
            label="Foods"
            expanded={expanded.lunch}
            onToggle={() => toggleSection('lunch')}
          />
        </div>
        {expanded.lunch && <MenuFoodRow items={lunchItems} onAddToOrder={setOrderItem} />}
      </section>

      <section className="menu-category">
        <div className="menu-category-header">
          <CategoryTitle plain>BEVERAGES</CategoryTitle>
          <SubcategoryToggle
            label="Cold Drinks"
            expanded={expanded.coldDrinks}
            onToggle={() => toggleSection('coldDrinks')}
          />
        </div>
        {expanded.coldDrinks && <MenuFoodRow items={coldDrinkItems} onAddToOrder={setOrderItem} />}
      </section>

      <section className="menu-category">
        <div
          className="menu-category-banner"
          style={{ backgroundImage: `url(${food17})` }}
        >
          <CategoryTitle>DINNER</CategoryTitle>
        </div>
        <div className="menu-category-toggle-row">
          <SubcategoryToggle
            label="Foods"
            expanded={expanded.dinner}
            onToggle={() => toggleSection('dinner')}
          />
        </div>
        {expanded.dinner && <MenuFoodRow items={dinnerItems} onAddToOrder={setOrderItem} />}
      </section>

      <section className="menu-category">
        <div className="menu-category-header">
          <CategoryTitle plain>BEVERAGES</CategoryTitle>
          <SubcategoryToggle
            label="Drinks"
            expanded={expanded.dinnerDrinks}
            onToggle={() => toggleSection('dinnerDrinks')}
          />
        </div>
        {expanded.dinnerDrinks && <MenuFoodRow items={dinnerDrinkItems} onAddToOrder={setOrderItem} />}
      </section>


    </main>

    <Footer />
    {orderItem && (
      <FoodOrderModal item={orderItem} onClose={() => setOrderItem(null)} />
    )}
  </>
  )
}

export default FoodMenuPage
