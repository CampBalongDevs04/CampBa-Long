import { Routes, Route, useLocation } from 'react-router'
import './App.css'
import Header from './components/Header.jsx'
import Home from './pages/home.jsx'
import FoodMenu from './pages/foodmenu.jsx'
import SpaService from './pages/spaService.jsx'
import MyBooking from './pages/mybooking.jsx'
import AdminDash from './admin/admindash2345.jsx'
import Booking from './pages/booking.jsx'


function App() {
  const location = useLocation()
  const isAdminPage = location.pathname.startsWith('/admindash2345')

  return (
    <>
      {!isAdminPage && <Header />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<FoodMenu />} />
        <Route path="/spa" element={<SpaService />} />
        <Route path="/my-booking" element={<MyBooking />} />
        <Route path="/booking" element={<Booking />} />
        <Route path="/admindash2345" element={<AdminDash />} />
      </Routes>

    </>
  )
}

export default App
