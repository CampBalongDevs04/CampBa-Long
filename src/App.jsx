<<<<<<< HEAD
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
      <Header showHero={activePage === 'home'} onNavigateHome={goHome} />

      {activePage === 'foodmenu' ? (
        <FoodMenuPage onBack={goHome} />
      ) : (
        <>
          <Offers onFoodSelect={openFoodMenu} />
          <Accommodations />
          <Testimonials />
        </>
      )}
=======
import { Routes, Route } from 'react-router'
import './App.css'
import Header from './components/Header.jsx'
import Home from './pages/home.jsx'
import FoodMenu from './pages/foodmenu.jsx'
import SpaService from './pages/spaService.jsx'
import MyBooking from './pages/mybooking.jsx'

function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<FoodMenu />} />
        <Route path="/spa" element={<SpaService />} />
        <Route path="/my-booking" element={<MyBooking />} />
      </Routes>
>>>>>>> origin/master
    </>
  )
}

export default App
