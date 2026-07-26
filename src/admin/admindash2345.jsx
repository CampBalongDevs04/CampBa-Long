import { lazy, Suspense, useState } from 'react'
import './css/admin.css'
import Header from '../components/Header.jsx'
import AdminNavbar from './items/navbar.jsx'
import AdminSidebar from './items/sidebar.jsx'
import LotusDividerIcon from '../components/LotusDividerIcon.jsx'
import logoCamp from '../assets/images/logocamp.png'
import ClockDate from './items/extras/clockDate.jsx'
import {
    StatCardsSkeleton,
    TabsSkeleton,
    PanelSkeleton,
    ListSkeleton,
    TableSkeleton,
} from '../components/skeletons/Skeleton.jsx'

// Dashboard widgets are lazy chunks: the login screen stays light, and
// each area shows a matching skeleton while its widget code loads.
const Units = lazy(() => import('./items/units.jsx'))
const BookingsManage = lazy(() => import('./items/bookingsManage.jsx'))
const Export = lazy(() => import('./items/export.jsx'))
const Tab = lazy(() => import('./items/tab.jsx'))
const All = lazy(() => import('./items/overview-ALL.jsx'))
const Upcomming = lazy(() => import('./items/overview-UPCOMMING.jsx'))
const Active = lazy(() => import('./items/overview-ACTIVE.jsx'))
const Completed = lazy(() => import('./items/overview-COMPLETED.jsx'))
const Paid = lazy(() => import('./items/overview-PAIDFULL.jsx'))
const DP = lazy(() => import('./items/overview-DOWNPAYMENT.jsx'))
const FoodSpaAll = lazy(() => import('./items/foodSpa-ALL.jsx'))
const Food = lazy(() => import('./items/foodSpa-Food.jsx'))
const Spa = lazy(() => import('./items/foodSpa-Spa.jsx'))
const FoodSpa = lazy(() => import('./items/FoodSpa.jsx'))
const FoodTab = lazy(() => import('./items/foodTab.jsx'))
const FoodList = lazy(() => import('./items/foodList.jsx'))
const AccommodationCount = lazy(() => import('./items/accommodationCount.jsx'))
const SpaService = lazy(() => import('./items/spaService-Tab.jsx'))
const SpaServiceList = lazy(() => import('./items/spaServiceList.jsx'))
const SpaServiceAvails = lazy(() => import('./items/SpaServiceAvails.jsx'))

const ADMIN_PASSCODE = 'campbalong2025'
const ADMIN_EMAIL ='campbalong@gmail.com'

const ADMIN_PROFILE = {
  name: 'Camp Ba-long Admin',
  role: 'Admin In-Charge',
  email: ADMIN_EMAIL,
}

const SECTION_LABELS = {
  overview: 'Overview',
  bookings: 'Bookings',
  units: 'Units',
  menu: 'Food Menu',
  spa: 'Spa',
  cms: 'CMS',
  export: 'Export Reports',
}

function AdminDash() {
  const [unlocked, setUnlocked] = useState(false)
  const [input, setInput] = useState('')
  const [inputEmail, setInputEmail] = useState('')
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState('overview')
  const [activeBookingTab, setActiveBookingTab] = useState('all')
  const [activeServiceTab, setActiveServiceTab] = useState('all')
  const [activeFoodTab, setActiveFoodTab] = useState('all')
  const [activeSpaTab, setActiveSpaTab] = useState('services')


  const handleLogout = () => {
    setUnlocked(false)
    setInput('')
    setInputEmail('')
    setActiveSection('overview')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (inputEmail !== ADMIN_EMAIL) {
      setError('Wrong email')
    } else if (input !== ADMIN_PASSCODE) {
      setError('Wrong passcode')
    } else {
      setUnlocked(true)
      setError('')
    }
  }

  if (!unlocked) {
    return (
        <>
            <Header />
            <section className="admin-login-section">
                <div className="admin-login-card">
                    <img src={logoCamp} alt="Camp Ba-long" className="admin-login-logo" />
                    <p className="admin-login-eyebrow">Camp Ba-long</p>
                    <h2 className="admin-login-title">Admin Access</h2>
                    <p className="admin-login-subtext">Sign in to manage the resort dashboard.</p>
                    <LotusDividerIcon />
                    <form className="admin-login-form" onSubmit={handleSubmit}>
                        <div className="admin-login-field">
                            <label htmlFor="admin-email">Email</label>
                            <input
                                id="admin-email"
                                type="email"
                                value={inputEmail}
                                placeholder="Enter email"
                                onChange={(e) => setInputEmail(e.target.value)}
                            />
                        </div>
                        <div className="admin-login-field">
                            <label htmlFor="admin-passcode">Passcode</label>
                            <input
                                id="admin-passcode"
                                type="password"
                                value={input}
                                placeholder="Enter passcode"
                                onChange={(e) => setInput(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="admin-login-btn">
                            Enter Dashboard
                        </button>
                    </form>
                    {error && <p className="admin-login-error">{error}</p>}
                </div>
            </section>
      </>
    )
  }

  return (
    <>
        <AdminNavbar onLogout={handleLogout} />
        <AdminSidebar
            activeItem={activeSection}
            onSelect={setActiveSection}
            onLogout={handleLogout}
            profile={ADMIN_PROFILE}
        />
        <main className="admin-dash-section has-sidebar">
            {activeSection === 'overview' ? (
                <div className="admin-dash-content">
                    <div className="admin-dash-heading">
                        <p className="admin-dash-eyebrow">Camp Ba-long</p>
                        <h1 className="admin-dash-title">Overview</h1>
                        <ClockDate />
                    </div>
                    <Suspense fallback={<StatCardsSkeleton count={5} />}>
                        <Units />
                    </Suspense>
                    <Suspense fallback={<TabsSkeleton count={6} />}>
                        <Tab active={activeBookingTab} onChange={setActiveBookingTab} />
                    </Suspense>
                    <Suspense fallback={<PanelSkeleton />}>
                        {activeBookingTab === 'down-payment' && <DP />}
                        {activeBookingTab === 'paid-full' && <Paid />}
                        {activeBookingTab === 'completed' && <Completed />}
                        {activeBookingTab === 'active' && <Active />}
                        {activeBookingTab === 'upcomming' && <Upcomming /> }
                        {activeBookingTab === 'all' && <All />}
                    </Suspense>


                    <div className ="services-section">
                        <LotusDividerIcon />
                        <h1 className ="services-title">Other Services</h1>
                        <Suspense fallback={<TabsSkeleton count={3} />}>
                            <FoodSpa active={activeServiceTab} onChange={setActiveServiceTab} />
                        </Suspense>
                        <Suspense fallback={<PanelSkeleton />}>
                            {activeServiceTab === 'all' && <FoodSpaAll />}
                            {activeServiceTab === 'food' && <Food />}
                            {activeServiceTab === 'spa' && <Spa />}
                        </Suspense>

                    </div>
                </div>
            ) : activeSection === 'bookings' ? (
                <div className="admin-dash-content">
                    <button
                        type="button"
                        className="admin-dash-back"
                        onClick={() => setActiveSection('overview')}
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <path d="M12 19l-7-7 7-7" />
                        </svg>
                        Back to Overview
                    </button>
                    <div className="admin-dash-heading">
                        <p className="admin-dash-eyebrow">Camp Ba-long</p>
                        <h1 className="admin-dash-title">Bookings</h1>
                        <ClockDate />
                    </div>
                    <Suspense fallback={<TableSkeleton rows={5} cols={6} />}>
                        <BookingsManage />
                    </Suspense>
                </div>
            ) : activeSection === 'units' ? (
                <div className="admin-dash-content">
                    <button
                        type="button"
                        className="admin-dash-back"
                        onClick={() => setActiveSection('overview')}
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <path d="M12 19l-7-7 7-7" />
                        </svg>
                        Back to Overview
                    </button>
                    <div className="admin-dash-heading">
                        <p className="admin-dash-eyebrow">Camp Ba-long</p>
                        <h1 className="admin-dash-title">Units</h1>
                        <ClockDate />
                    </div>
                    <Suspense fallback={<StatCardsSkeleton count={6} />}>
                        <AccommodationCount />
                    </Suspense>
                </div>
            ) : activeSection === 'menu' ? (
                <div className="admin-dash-content">
                    <button
                        type="button"
                        className="admin-dash-back"
                        onClick={() => setActiveSection('overview')}
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <path d="M12 19l-7-7 7-7" />
                        </svg>
                        Back to Overview
                    </button>
                    <div className="admin-dash-heading">
                        <p className="admin-dash-eyebrow">Camp Ba-long</p>
                        <h1 className="admin-dash-title">Food Menu</h1>
                        <ClockDate />
                    </div>
                    <Suspense fallback={<TabsSkeleton count={5} />}>
                        <FoodTab active={activeFoodTab} onChange={setActiveFoodTab} />
                    </Suspense>
                    <Suspense fallback={<ListSkeleton rows={5} />}>
                        {/* FoodList filters itself, so new tabs in foodTab.jsx
                            need no change here. */}
                        <FoodList category={activeFoodTab} />
                    </Suspense>
                </div>

            ): activeSection === 'spa' ? (
                <div className="admin-dash-content">
                    <button
                        type="button"
                        className="admin-dash-back"
                        onClick={() => setActiveSection('overview')}
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <path d="M12 19l-7-7 7-7" />
                        </svg>
                        Back to Overview
                    </button>
                    <div className="admin-dash-heading">
                        <p className="admin-dash-eyebrow">Camp Ba-long</p>
                        <h1 className="admin-dash-title">Spa Services</h1>
                        <ClockDate />
                    </div>
                    <Suspense fallback={<TabsSkeleton count={2} />}>
                        <SpaService active={activeSpaTab} onChange={setActiveSpaTab} />
                    </Suspense>
                    <Suspense fallback={<TableSkeleton rows={4} cols={4} />}>
                        {activeSpaTab === 'services' && <SpaServiceList />}
                        {activeSpaTab === 'avail' && <SpaServiceAvails />}
                    </Suspense>
                </div>
            ) : activeSection === 'export' ? (
                <div className="admin-dash-content">
                    <button
                        type="button"
                        className="admin-dash-back"
                        onClick={() => setActiveSection('overview')}
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <path d="M12 19l-7-7 7-7" />
                        </svg>
                        Back to Overview
                    </button>
                    <div className="admin-dash-heading">
                        <p className="admin-dash-eyebrow">Camp Ba-long</p>
                        <h1 className="admin-dash-title">Export Reports</h1>
                        <ClockDate />
                    </div>
                    <Suspense fallback={<TableSkeleton rows={3} cols={3} />}>
                        <Export />
                    </Suspense>
                </div>
            ) : (
                <div className="admin-dash-content">
                    <button
                        type="button"
                        className="admin-dash-back"
                        onClick={() => setActiveSection('overview')}
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <path d="M12 19l-7-7 7-7" />
                        </svg>
                        Back to Overview
                    </button>
                    <div className="admin-dash-heading">
                        <p className="admin-dash-eyebrow">Camp Ba-long</p>
                        <h1 className="admin-dash-title">{SECTION_LABELS[activeSection] || activeSection}</h1>
                    </div>
                    <p className="admin-dash-placeholder">
                        Build the "{SECTION_LABELS[activeSection] || activeSection}" section content here.
                    </p>
                </div>
            )}
        </main>
    </>
  )
}

export default AdminDash
