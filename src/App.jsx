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

    </>
  )
}

export default App
