import '../css/foodlist.css'
import {
    breakfastItems,
    beverageItems,
    lunchItems,
    coldDrinkItems,
    dinnerItems,
    dinnerDrinkItems,
} from '../../pages/foodmenu.jsx'

// Menu data is hardcoded in pages/foodmenu.jsx — this only regroups it
// under the categories used by the FoodTab filter.
const FOOD_SECTIONS = [
    { category: 'breakfast', title: 'Breakfast', items: breakfastItems },
    { category: 'lunch', title: 'Lunch', items: lunchItems },
    { category: 'dinner', title: 'Dinner', items: dinnerItems },
    { category: 'beverages', title: 'Beverages · Coffee', items: beverageItems },
    { category: 'beverages', title: 'Beverages · Cold Drinks', items: coldDrinkItems },
    { category: 'beverages', title: 'Beverages · Drinks', items: dinnerDrinkItems },
]

export default function FoodList({ category = 'all' }) {
    const sections =
        category === 'all'
            ? FOOD_SECTIONS
            : FOOD_SECTIONS.filter((section) => section.category === category)

    return (
        <div className="foodlist-panel">
            {sections.map((section) => (
                <section key={section.title} className="foodlist-section">
                    <h3 className="foodlist-section-title">{section.title}</h3>
                    <div className="foodlist-rows">
                        {section.items.map((item) => (
                            <article key={item.name} className="foodlist-row">
                                <div className="foodlist-image">
                                    <img src={item.image} alt={item.name} />
                                </div>
                                <div className="foodlist-info">
                                    <h4 className="foodlist-name">{item.name}</h4>
                                    <p className="foodlist-desc">{item.desc}</p>
                                </div>
                                <span className="foodlist-price">{item.price}</span>
                            </article>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    )
}
