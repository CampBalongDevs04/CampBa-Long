import { useEffect, useState } from 'react'
import './foodmenu.css'
import foodItems from './foodmenuData'

const categories = ['All', 'Seafood', 'Grilled', 'Stew', 'Soup', 'Appetizer', 'Dessert']

function FoodMenuPage({ onBack }) {
  const [selectedCategory, setSelectedCategory] = useState('All')

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [])

  const filteredItems = selectedCategory === 'All'
    ? foodItems
    : foodItems.filter((item) => {
        const itemCategories = Array.isArray(item.categories) ? item.categories : [item.category]
        return itemCategories.includes(selectedCategory)
      })

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
          {filteredItems.map((item) => {
            const { category, title, description, badge, price, categories } = item
            const displayCategory = Array.isArray(categories) ? categories.join(' • ') : category

            return (
              <article className="food-card" key={title}>
                <div className="food-card-badge">{badge}</div>
                <div className="food-card-icon-wrap">
                  <span aria-hidden="true">🍃</span>
                </div>
                <div className="food-card-body">
                  <div>
                    <p className="food-card-category">{displayCategory}</p>
                    <h2 className="food-card-name">{title}</h2>
                    <p className="food-card-text">{description}</p>
                  </div>
                  <span className="food-card-price">{price}</span>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </main>
  )
}

export default FoodMenuPage
