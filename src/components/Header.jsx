import { useState } from 'react'
import { NavLink, Link } from 'react-router'
import './css/Header.css'
import iconBalong from '../assets/images/logocamp.png'

const navLinks = [
    { to: "/", label: "Home" },
    { to: "/menu", label: "Menu" },
    { to: "/spa", label: "Spa" },
    { to: "/my-booking", label: "My Booking" },
];

function Header() {
    const [menuOpen, setMenuOpen] = useState(false);
    const closeMenu = () => setMenuOpen(false);

    return (
        <header className={menuOpen ? "site-header menu-open" : "site-header"}>
            <Link className="site-logo" to="/" aria-label="Camp Ba-long home" onClick={closeMenu}>
                <img className="site-logo-icon" src={iconBalong} alt="" />
                <span className="site-logo-copy">
                    <span className="site-logo-text">Camp Ba-long</span>
                    <span className="site-logo-tagline">Nature Farm &amp; Resort</span>
                </span>
            </Link>

            <button
                className="nav-toggle"
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                aria-controls="site-nav"
                onClick={() => setMenuOpen((open) => !open)}
            >
                <span className="nav-toggle-bar" />
                <span className="nav-toggle-bar" />
                <span className="nav-toggle-bar" />
            </button>

            <nav id="site-nav" className="site-navbar">
                {navLinks.map(({ to, label }) => (
                    <NavLink
                        className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                        to={to}
                        key={to}
                        onClick={closeMenu}
                    >
                        {label}
                    </NavLink>
                ))}
                <Link className="nav-cta" to="/my-booking" onClick={closeMenu}>Book Now</Link>
            </nav>
        </header>
    )
}

export default Header
