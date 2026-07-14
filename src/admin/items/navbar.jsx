import { useState } from 'react'
import { Link } from 'react-router'
import '../css/navbar.css'
import logoCamp from '../../assets/images/logocamp.png'

export default function AdminNavbar({ onLogout }) {
    const [menuOpen, setMenuOpen] = useState(false)

    return (
        <header className={menuOpen ? 'admin-header menu-open' : 'admin-header'}>
            <div className="admin-brand">
                <img className="admin-brand-icon" src={logoCamp} alt="" />
                <span className="admin-brand-copy">
                    <span className="admin-brand-text">Camp Ba-long</span>
                    <span className="admin-brand-tagline">Admin Dashboard</span>
                </span>
            </div>

            <button
                className="admin-nav-toggle"
                type="button"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                aria-controls="admin-nav"
                onClick={() => setMenuOpen((open) => !open)}
            >
                <span className="admin-nav-toggle-bar" />
                <span className="admin-nav-toggle-bar" />
                <span className="admin-nav-toggle-bar" />
            </button>

            <nav id="admin-nav" className="admin-navbar">
                <div className="admin-nav-actions">
                    <Link className="admin-nav-site" to="/" onClick={() => setMenuOpen(false)}>
                        View Site
                    </Link>
                    {onLogout && (
                        <button type="button" className="admin-nav-logout" onClick={onLogout}>
                            Log Out
                        </button>
                    )}
                </div>
            </nav>
        </header>
    )
}
