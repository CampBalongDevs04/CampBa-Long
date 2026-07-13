import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import './foodmenu.css'
import LeafDeco from '../components/LeafDeco'
import Footer from '../components/footer'



const categories = ['All', 'Seafood', 'Grilled', 'Stew', 'Soup', 'Appetizer', 'Dessert']


const foodItems = [
  {
    category: 'Seafood',
    categories: ['Seafood', 'Grilled'],
    title: 'Inihaw na Tilapia',
    description: 'Fresh tilapia grilled and served with native spices and garden herbs.',
    badge: 'Chef’s Pick',
    price: '₱0.00',
  },
  {
    category: 'Grilled',
    title: 'Pork Barbecue',
    description: 'Marinated native pork skewered and slow-grilled to golden perfection.',
    badge: 'Best Seller',
    price: '₱0.00',
  },
  {
    category: 'Stew',
    title: 'Beef Nilaga',
    description: 'Slow-cooked beef with native vegetables in a rich, savory broth.',
    badge: 'Popular',
    price: '₱0.00',
  },
  {
    category: 'Soup',
    title: 'Sinigang na Baboy',
    description: 'Tamarind soup with fresh catch, vegetables, and tangy broth.',
    badge: 'Spicy',
    price: '₱0.00',
  },
  {
    category: 'Appetizer',
    title: 'Lumpiang Gulay',
    description: 'Crispy spring rolls filled with fresh garden vegetables.',
    badge: 'Light',
    price: '₱0.00',
  },
  {
    category: 'Dessert',
    title: 'Halo-Halo',
    description: 'Creamy mango dessert with sago pearls and tropical sweetness.',
    badge: 'Sweet',
    price: '₱0.00',
  },
];

function FoodMenuPage() {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [animateList, setAnimateList] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [])

  useEffect(() => {
    if (!animateList) return

    const timer = window.setTimeout(() => {
      setAnimateList(false)
    }, 450)

    return () => window.clearTimeout(timer)
  }, [animateList])

  const handleCategoryClick = (category) => {
    if (category === selectedCategory) return
    setSelectedCategory(category)
    setAnimateList(true)
  }

  const filteredItems = selectedCategory === 'All'
    ? foodItems
    : foodItems.filter((item) => {
        const itemCategories = Array.isArray(item.categories) ? item.categories : [item.category]
        return itemCategories.includes(selectedCategory)
      })

  return (
    <>
    <main className="foodmenu-page">
      <div className="foodmenu-container">
        <LeafDeco className="tl" />
        <LeafDeco className="tr" />
        <LeafDeco className="bl" />
        <LeafDeco className="br" />
        <div className="foodmenu-top">
          <button type="button" className="foodmenu-back" onClick={() => navigate('/')}>
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
                onClick={() => handleCategoryClick(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className={`foodmenu-grid ${animateList ? 'slide-in' : ''}`}>
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
    <Footer />
  </>
  )
}

export default FoodMenuPage
