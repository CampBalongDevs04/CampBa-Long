import { useState } from 'react'
import './App.css'
import Header from './components/Header.jsx'
import Offers from './components/offers.jsx'
import Accommodations from './components/accommodations.jsx'
import Testimonials from './components/testimonials.jsx'
import FoodMenuPage from './pages/foodmenu.jsx'





function App() {
  const [activePage, setActivePage] = useState('home')

  const openFoodMenu = () => setActivePage('foodmenu')
  const goHome = () => setActivePage('home')

  return (
    <>
      <Header
        showHero={activePage === 'home'}
        onNavigateHome={goHome}
        onOpenFoodMenu={openFoodMenu}
      />

      {activePage === 'foodmenu' ? (
        <FoodMenuPage onBack={goHome} />
      ) : (
        <>
          <Offers onFoodSelect={openFoodMenu} />
          <Accommodations />
          <Testimonials />
        </>
      )}
    </>
  )
}

export default App
