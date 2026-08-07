import { lazy, Suspense, useEffect, useState } from 'react'
import './css/admin.css'
import { supabase } from '../lib/supabaseClient.js'
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
const AccommodationTab = lazy(() => import('./items/accommodationTab.jsx'))
const AccommodationManage = lazy(() => import('./items/accommodationManage.jsx'))
const SpaService = lazy(() => import('./items/spaService-Tab.jsx'))
const SpaServiceList = lazy(() => import('./items/spaServiceList.jsx'))
const SpaServiceAvails = lazy(() => import('./items/SpaServiceAvails.jsx'))
const CmsTab = lazy(() => import('./items/cmsTab.jsx'))
const HeroBanner = lazy(() => import('./items/heroBanner.jsx'))
const WelcomeSection = lazy(() => import('./items/welcomeSection.jsx'))
const OffersSection = lazy(() => import('./items/offersSection.jsx'))
const AccommodationSection = lazy(() => import('./items/accommodationSection.jsx'))

// Staff sign in with Supabase Auth, not a passcode baked into the bundle.
// The session is what unlocks the bookings table: RLS grants `authenticated`
// full access and gives everyone else nothing, so guest names, emails and
// receipts are never reachable with the public key alone.
//
// Create the staff user once in the Supabase dashboard
// (Authentication → Users → Add user), then sign in with it here.
const ADMIN_PROFILE = {
  name: 'Camp Ba-long Admin',
  role: 'Admin In-Charge',
  email: '',
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
  const [signingIn, setSigningIn] = useState(false)
  const [profile, setProfile] = useState(ADMIN_PROFILE)
  const [activeSection, setActiveSection] = useState('overview')
  const [activeBookingTab, setActiveBookingTab] = useState('all')
  const [activeServiceTab, setActiveServiceTab] = useState('all')
  const [activeFoodTab, setActiveFoodTab] = useState('all')
  const [activeSpaTab, setActiveSpaTab] = useState('services')
  const [activeCmsTab, setActiveCmsTab] = useState('hero')
  // Units opens on the day board — the question staff ask most is "who is in
  // which unit today", not "what does a Teepee cost".
  const [activeUnitTab, setActiveUnitTab] = useState('availability')


  // A session survives a page refresh, so staff aren't kicked out every time
  // they reload the dashboard.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return
      const { data: staff } = await supabase.rpc('is_staff')
      if (staff !== true) return
      setUnlocked(true)
      setProfile({ ...ADMIN_PROFILE, email: data.session.user.email ?? '' })
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUnlocked(false)
    setInput('')
    setInputEmail('')
    setError('')
    setActiveSection('overview')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (signingIn) return
    setSigningIn(true)
    setError('')

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: inputEmail.trim(),
      password: input,
    })

    if (signInError) {
      // Supabase does not say which of the two was wrong, and neither should
      // we — that would let someone probe for valid staff addresses.
      setSigningIn(false)
      setError('Wrong email or password.')
      return
    }

    // Signing in is not the same as being staff: the bookings table is gated
    // on the staff roster, so say so here rather than showing an empty board.
    const { data: staff } = await supabase.rpc('is_staff')
    setSigningIn(false)

    if (staff !== true) {
      await supabase.auth.signOut()
      setError('This account is not authorised for the dashboard.')
      return
    }

    setProfile({ ...ADMIN_PROFILE, email: data.user?.email ?? '' })
    setUnlocked(true)
    setInput('')
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
                            <label htmlFor="admin-passcode">Password</label>
                            <input
                                id="admin-passcode"
                                type="password"
                                value={input}
                                placeholder="Enter password"
                                autoComplete="current-password"
                                onChange={(e) => setInput(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="admin-login-btn" disabled={signingIn}>
                            {signingIn ? 'Signing in…' : 'Enter Dashboard'}
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
            profile={profile}
        />
        <main className="admin-dash-section has-sidebar">
            {activeSection === 'overview' ? (
                <div className="admin-dash-content">
                    <div className="admin-dash-heading">
                        <p className="admin-dash-eyebrow">Camp Ba-long</p>
                        <h1 className="admin-dash-title">Overview</h1>
                        <ClockDate />
                    </div>
                    <Suspense fallback={<StatCardsSkeleton count={6} />}>
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
                    <Suspense fallback={<TabsSkeleton count={2} />}>
                        <AccommodationTab active={activeUnitTab} onChange={setActiveUnitTab} />
                    </Suspense>
                    <Suspense fallback={<StatCardsSkeleton count={6} />}>
                        {activeUnitTab === 'availability' && <AccommodationCount />}
                        {activeUnitTab === 'manage' && <AccommodationManage />}
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
            ) : activeSection === 'cms' ? (
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
                        <h1 className="admin-dash-title">CMS</h1>
                        <ClockDate />
                    </div>
                    <Suspense fallback={<TabsSkeleton count={4} />}>
                        <CmsTab active={activeCmsTab} onChange={setActiveCmsTab} />
                    </Suspense>
                    <Suspense fallback={<PanelSkeleton />}>
                        {activeCmsTab === 'hero' && <HeroBanner />}
                        {activeCmsTab === 'welcome' && <WelcomeSection />}
                        {activeCmsTab === 'offers' && <OffersSection />}
                        {activeCmsTab === 'accommodations' && (
                            // The cards are edited in Units, so the tab that
                            // does not edit them offers a way to get there.
                            <AccommodationSection
                                onGoToUnits={() => {
                                    setActiveUnitTab('manage')
                                    setActiveSection('units')
                                }}
                            />
                        )}
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
