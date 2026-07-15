import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import './foodmenu.css'
import Footer from '../components/footer'
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

const orderSteps = [
  'Complete your booking first.',
  'Browse the food menu and select your preferred items.',
  'Choose the quantity for each item.',
  'Review and confirm your order.',
  'The total food cost will automatically be added to your booking receipt.',
]

const breakfastItems = [
  { image: food4, name: 'Hotsilog', desc: 'Hotdog / Egg / Cucumber / Tomato / Fried Rice', price: 'PHP 110.00' },
  { image: food5, name: 'Tapsilog', desc: 'Tapa / Egg / Fried Garlic / Tomato / Fried Rice', price: 'PHP 120.00' },
  { image: food6, name: 'Longsilog', desc: 'Longganisa / Egg / Fried Garlic / Fried Rice', price: 'PHP 120.00' },
]

const beverageItems = [
  { image: food7, name: 'Americano', desc: 'Hot Brewed / Iced', price: 'PHP 100.00' },
  { image: food8, name: 'Salted Caramel', desc: 'Hot Brewed / Iced', price: 'PHP 150.00' },
  { image: food9, name: 'Vanilla Latte', desc: 'Hot Brewed / Iced', price: 'PHP 130.00' },
]

const lunchItems = [
  { image: food11, name: 'Pork Adobo', desc: 'Pork / Soy Sauce / Vinegar / Paminta / Onion / Garlic', price: 'PHP 110.00' },
  { image: food12, name: 'Kare-Kare', desc: 'Pork / Talong / Sitaw / Pechay / Peanut Bagoong', price: 'PHP 120.00' },
  { image: food13, name: 'Paksiw', desc: 'Bangus / Green Chili / Vinegar / Onion / Garlic / Ampalaya', price: 'PHP 120.00' },
]

const coldDrinkItems = [
  { image: food14, name: 'Softdrinks', desc: 'Family Serving', price: 'PHP 100.00' },
  { image: food15, name: 'Strawberry Hibiscus', desc: 'Family Serving / Single', price: 'PHP 150.00' },
  { image: food16, name: 'Blue Lemonade', desc: 'Family Serving / Single', price: 'PHP 130.00' },
]

function MenuFoodRow({ items, rowRef }) {
  const scroll = (direction) => {
    const el = rowRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <div className="menu-row-wrap">
      <button type="button" className="menu-arrow" onClick={() => scroll(-1)} aria-label="Scroll left">
        ‹
      </button>
      <div className="menu-row" ref={rowRef}>
        {items.map((item) => (
          <article className="menu-food-card" key={item.name}>
            <div className="menu-food-image">
              <img src={item.image} alt={item.name} />
            </div>
            <h3 className="menu-food-name">{item.name}</h3>
            <p className="menu-food-desc">{item.desc}</p>
            <p className="menu-food-price">{item.price}</p>
            <button type="button" className="menu-food-add">ADD TO ORDER</button>
          </article>
        ))}
      </div>
      <button type="button" className="menu-arrow" onClick={() => scroll(1)} aria-label="Scroll right">
        ›
      </button>
    </div>
  )
}

function FoodMenuPage() {
  const navigate = useNavigate()
  const howToOrderRef = useRef(null)
  const breakfastRowRef = useRef(null)
  const beverageRowRef = useRef(null)
  const lunchRowRef = useRef(null)
  const coldDrinkRowRef = useRef(null)

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
        <button type="button" className="foodmenu-back" onClick={() => navigate('/')}>
          ← Back to Home
        </button>
        <div className="foodmenu-hero-inner">
          <div className="foodmenu-hero-text">
            <h1 className="foodmenu-hero-title">
              Hungry? We&apos;ve Got You Covered.
            </h1>
            <p className="foodmenu-hero-subtitle">
              Explore our menu and discover dishes you&apos;ll keep coming back for.
            </p>
            <button type="button" className="foodmenu-order-btn" onClick={scrollToHowToOrder}>
              ORDER NOW!
            </button>
          </div>
          <div className="foodmenu-hero-image">
            <img src={food1} alt="Featured dish" />
          </div>
        </div>
      </section>

      <section className="howto-order" ref={howToOrderRef}>
        <h2 className="howto-order-title">HOW TO ORDER</h2>
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
          Note: Food orders are subject to availability and may be modified before the preparation cutoff time.
        </p>
      </section>

      <section className="menu-category">
        <div
          className="menu-category-banner"
          style={{ backgroundImage: `url(${food3})` }}
        >
          <h2 className="menu-category-title">BREAKFAST</h2>
        </div>
        <MenuFoodRow items={breakfastItems} rowRef={breakfastRowRef} />
      </section>

      <section className="menu-category">
        <div className="menu-category-header">
          <span className="menu-subcategory-label">
            Coffee <span className="menu-subcategory-chevron">⌄</span>
          </span>
          <h2 className="menu-category-title plain">BEVERAGES</h2>
        </div>
        <MenuFoodRow items={beverageItems} rowRef={beverageRowRef} />
      </section>

      <section className="menu-category">
        <div
          className="menu-category-banner"
          style={{ backgroundImage: `url(${food10})` }}
        >
          <h2 className="menu-category-title">LUNCH</h2>
        </div>
        <MenuFoodRow items={lunchItems} rowRef={lunchRowRef} />
      </section>

      <section className="menu-category">
        <div className="menu-category-header">
          <span className="menu-subcategory-label">
            Cold Drinks <span className="menu-subcategory-chevron">⌄</span>
          </span>
          <h2 className="menu-category-title plain">BEVERAGES</h2>
        </div>
        <MenuFoodRow items={coldDrinkItems} rowRef={coldDrinkRowRef} />
      </section>
    </main>
    <Footer />
  </>
  )
}

export default FoodMenuPage
