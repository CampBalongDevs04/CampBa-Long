import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router'
import './App.css'
import Header from './components/Header.jsx'
import SetupNotice from './components/SetupNotice.jsx'
import {
  HomeSkeleton,
  FoodMenuSkeleton,
  SpaServiceSkeleton,
  MyBookingSkeleton,
  BookingPageSkeleton,
  AdminLoginSkeleton,
} from './components/skeletons/PageSkeletons.jsx'

// Each page is its own chunk; while a chunk downloads, the route shows
// a skeleton that mirrors that page's layout (see PageSkeletons.jsx).
const Home = lazy(() => import('./pages/home.jsx'))
const FoodMenu = lazy(() => import('./pages/foodmenu.jsx'))
const SpaService = lazy(() => import('./pages/spaService.jsx'))
const MyBooking = lazy(() => import('./pages/mybooking.jsx'))
const AdminDash = lazy(() => import('./admin/admindash2345.jsx'))
const Booking = lazy(() => import('./pages/booking.jsx'))


function App() {
  const location = useLocation()
  const isAdminPage = location.pathname.startsWith('/admindash2345')

  return (
    <>
      {/* Renders nothing when the keys are present, so this costs a fully
          configured site exactly one boolean check. */}
      <SetupNotice />
      {!isAdminPage && <Header />}
      <Routes>
        <Route path="/" element={
          <Suspense fallback={<HomeSkeleton />}><Home /></Suspense>
        } />
        <Route path="/menu" element={
          <Suspense fallback={<FoodMenuSkeleton />}><FoodMenu /></Suspense>
        } />
        <Route path="/spa" element={
          <Suspense fallback={<SpaServiceSkeleton />}><SpaService /></Suspense>
        } />
        <Route path="/my-booking" element={
          <Suspense fallback={<MyBookingSkeleton />}><MyBooking /></Suspense>
        } />
        <Route path="/booking" element={
          <Suspense fallback={<BookingPageSkeleton />}><Booking /></Suspense>
        } />
        <Route path="/admindash2345" element={
          <Suspense fallback={<AdminLoginSkeleton />}><AdminDash /></Suspense>
        } />
      </Routes>

    </>
  )
}

export default App
