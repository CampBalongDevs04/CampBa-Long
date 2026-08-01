import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router'
import './App.css'
import Header from './components/Header.jsx'
import SetupNotice from './components/SetupNotice.jsx'
import CrispChat from './components/CrispChat.jsx'
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

  // The two pages with a kiosk order tray in the bottom-right corner, which
  // is also where the chat launcher lands. See CrispChat.jsx.
  const hasKioskTray = ['/menu', '/spa'].includes(location.pathname)

  return (
    <>
      {/* Renders nothing when the keys are present, so this costs a fully
          configured site exactly one boolean check. */}
      <SetupNotice />
      {!isAdminPage && <Header />}
      {/* Guest-facing only. Staff on the dashboard have no use for a support
          bubble aimed at guests, and it would sit over the sidebar. */}
      {!isAdminPage && <CrispChat reversed={hasKioskTray} />}
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
