import { useState } from 'react'
import './css/admin.css'
import Header from '../components/Header.jsx'
import LotusDividerIcon from '../components/LotusDividerIcon.jsx'
import logoCamp from '../assets/images/logocamp.png'


const ADMIN_PASSCODE = 'campbalong2025'
const ADMIN_EMAIL ='campbalong@gmail.com'

function AdminDash() {
  const [unlocked, setUnlocked] = useState(false)
  const [input, setInput] = useState('')
  const [inputEmail, setInputEmail] = useState('')
  const [error, setError] = useState('')

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
        <Header />
        <div style={{ padding: 24 }}>
        <h1>Admin Dashboard</h1>
        <p>Welcome, admin. Build your dashboard content here.</p>
        </div>
    </>
  )
}

export default AdminDash
