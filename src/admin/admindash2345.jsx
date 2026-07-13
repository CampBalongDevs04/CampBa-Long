import { useState } from 'react'
import './css/admin.css'
import Header from '../components/Header.jsx'


const ADMIN_PASSCODE = 'campbalong2025'

function AdminDash() {
  const [unlocked, setUnlocked] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input === ADMIN_PASSCODE) {
      setUnlocked(true)
      setError('')
    } else {
      setError('Wrong passcode')
    }
  }

  if (!unlocked) {
    return (
        <>
            <Header />
            <div style={{ maxWidth: 320, margin: '120px auto', textAlign: 'center' }}>
                <h2>Admin Access</h2>
                <form onSubmit={handleSubmit}>
                <input
                    type="password"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter passcode"
                    style={{ padding: 8, width: '100%', marginBottom: 8 }}
                />
                <button type="submit" style={{ padding: '8px 16px' }}>
                    Enter
                </button>
                </form>
                {error && <p style={{ color: 'red' }}>{error}</p>}
            </div>

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
