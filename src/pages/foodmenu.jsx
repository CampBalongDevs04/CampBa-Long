import { useState } from 'react'
import './foodmenu.css'
import foodItems from './foodmenuData'

const categories = ['All', 'Seafood', 'Grilled', 'Stew', 'Soup', 'Appetizer', 'Vegetarian', 'Dessert']

function FoodMenuPage({ onBack }) {
  const [selectedCategory, setSelectedCategory] = useState('All')

  const filteredItems = selectedCategory === 'All'
    ? foodItems
    : foodItems.filter((item) => item.category === selectedCategory)

  return (
    <main className="foodmenu-page">
      <div className="foodmenu-container">
        <div className="foodmenu-top">
          <button type="button" className="foodmenu-back" onClick={onBack}>
            ← Back to Home
          </button>
          <h1 className="foodmenu-title">OUR FOOD MENU</h1>
          <p className="foodmenu-subtitle">Savor local flavors and fresh ingredients</p>
          <div className="foodmenu-filters">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`foodmenu-filter ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="foodmenu-grid">
          {filteredItems.map(({ category, title, description, badge, price }) => (
            <article className="food-card" key={title}>
              <div className="food-card-badge">{badge}</div>
              <div className="food-card-icon-wrap">
                <span aria-hidden="true">🍃</span>
              </div>
              <div className="food-card-body">
                <div>
                  <p className="food-card-category">{category}</p>
                  <h2 className="food-card-name">{title}</h2>
                  <p className="food-card-text">{description}</p>
                </div>
                <span className="food-card-price">{price}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}

export default FoodMenuPage
