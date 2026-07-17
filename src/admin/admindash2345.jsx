import { useState } from 'react'
import './css/admin.css'
import Header from '../components/Header.jsx'
import AdminNavbar from './items/navbar.jsx'
import Units from './items/units.jsx'
import Export from './items/export.jsx'
import AdminSidebar from './items/sidebar.jsx'
import Tab from './items/tab.jsx'
import All from './items/overview-ALL.jsx'
import Upcomming from './items/overview-UPCOMMING.jsx'
import Active from './items/overview-ACTIVE.jsx'
import Completed from './items/overview-COMPLETED.jsx'
import Paid from './items/overview-PAIDFULL.jsx'
import DP from './items/overview-DOWNPAYMENT.jsx'
import FoodSpaAll from './items/foodSpa-ALL.jsx'
import Food from './items/foodSpa-Food.jsx'
import Spa from  './items/foodSpa-Spa.jsx'
import LotusDividerIcon from '../components/LotusDividerIcon.jsx'
import logoCamp from '../assets/images/logocamp.png'
import FoodSpa from './items/FoodSpa.jsx'
import ClockDate from './items/extras/clockDate.jsx'
import AccommodationCount from './items/accommodationCount.jsx'



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
                    <Units />
                    <Tab active={activeBookingTab} onChange={setActiveBookingTab} />
                    {activeBookingTab === 'down-payment' && <DP />}
                    {activeBookingTab === 'paid-full' && <Paid />}
                    {activeBookingTab === 'completed' && <Completed />} 
                    {activeBookingTab === 'active' && <Active />}
                    {activeBookingTab === 'upcomming' && <Upcomming /> }
                    {activeBookingTab === 'all' && <All />}


                    <div className ="services-section">
                        <LotusDividerIcon />
                        <h1 className ="services-title">Other Services</h1>
                        <FoodSpa active={activeServiceTab} onChange={setActiveServiceTab} />
                        {activeServiceTab === 'all' && <FoodSpaAll />}
                        {activeServiceTab === 'food' && <Food />}
                        {activeServiceTab === 'spa' && <Spa />}

                    </div>
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
                    </div>
                    <AccommodationCount />
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
                    </div>
                    <Export />
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
