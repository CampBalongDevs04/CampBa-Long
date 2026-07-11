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

function Header({ showHero = true, onNavigateHome }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const closeMenu = () => setMenuOpen(false);

    const handleHeaderLinkClick = (event, href) => {
        closeMenu();

        if (href === '#home' && !showHero && onNavigateHome) {
            event.preventDefault();
            onNavigateHome();
        }
    };

    return (
<<<<<<< HEAD
        <>
            <header className={menuOpen ? "site-header menu-open" : "site-header"}>
                <a
                    className="site-logo"
                    href="#home"
                    aria-label="Camp Ba-long home"
                    onClick={(event) => handleHeaderLinkClick(event, '#home')}
                >
                    <img className="site-logo-icon" src={iconBalong} alt="" />
                    <span className="site-logo-copy">
                        <span className="site-logo-text">Camp Ba-long</span>
                        <span className="site-logo-tagline">Nature Farm &amp; Resort</span>
                    </span>
                </a>
=======
        <header className={menuOpen ? "site-header menu-open" : "site-header"}>
            <Link className="site-logo" to="/" aria-label="Camp Ba-long home" onClick={closeMenu}>
                <img className="site-logo-icon" src={iconBalong} alt="" />
                <span className="site-logo-copy">
                    <span className="site-logo-text">Camp Ba-long</span>
                    <span className="site-logo-tagline">Nature Farm &amp; Resort</span>
                </span>
            </Link>
>>>>>>> origin/master

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

<<<<<<< HEAD
                <nav id="site-nav" className="site-navbar">
                    {navLinks.map(({ href, label }) => (
                        <a className="nav-link" href={href} key={href} onClick={(event) => handleHeaderLinkClick(event, href)}>
                            {label}
                        </a>
                    ))}
                    <a className="nav-cta" href="#my-booking" onClick={closeMenu}>Book Now</a>
                </nav>

            </header>
            {showHero && (
            <div className="hero-banner" id="home">
                <div className="hero-content">
                    <h1 className ="hero-title">
                        Book Your<br />
                        Perfect Resort<br />
                        <span className="hero-accent">Getaway</span>
                    </h1>
                    <p className ="hero-subtitle">Escape the everyday with comfortable accommodations, relaxing amenities, delicious dining, and unforgettable experiences—all in one destination. Reserve your stay in just a few clicks.</p>
                    <div className="hero-buttons">
                        <button className="hero-button" type="button">
                            <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                                <rect x="3" y="5" width="18" height="16" rx="2"/>
                                <path d="M3 10h18M8 3v4M16 3v4"/>
                            </svg>
                            Book Now
                        </button>
                        <a className="hero-button hero-button-outline" href="#accommodations">
                            <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                                <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M2 21h20M14 12h.01"/>
                            </svg>
                            Explore Rooms
                        </a>
                    </div>
                </div>

                <div className="hero-features">
                    <div className="hero-feature">
                        <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                            <path d="M3 18v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6M3 18h18M3 18v2M21 18v2M6 11V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>
                        </svg>
                        <div>
                            <h3>Comfortable Stays</h3>
                            <p>Well-appointed rooms for a relaxing stay</p>
                        </div>
                    </div>
                    <div className="hero-feature">
                        <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                            <path d="M2 8c1.5 1 2.5 1 4 0s2.5-1 4 0 2.5 1 4 0 2.5-1 4 0 2.5 1 4 0M2 13c1.5 1 2.5 1 4 0s2.5-1 4 0 2.5 1 4 0 2.5-1 4 0 2.5 1 4 0M2 18c1.5 1 2.5 1 4 0s2.5-1 4 0 2.5 1 4 0 2.5-1 4 0 2.5 1 4 0"/>
                        </svg>
                        <div>
                            <h3>Relaxing Amenities</h3>
                            <p>Pools, spa, and more for your comfort</p>
                        </div>
                    </div>
                    <div className="hero-feature">
                        <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                            <circle cx="12" cy="12" r="8"/>
                            <circle cx="12" cy="12" r="4"/>
                            <path d="M12 2v2M12 20v2"/>
                        </svg>
                        <div>
                            <h3>Delicious Dining</h3>
                            <p>A variety of cuisines to satisfy you</p>
                        </div>
                    </div>
                    <div className="hero-feature">
                        <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                            <path d="M3 8h4l2-3h6l2 3h4v12H3V8Z"/>
                            <circle cx="12" cy="13" r="3.5"/>
                        </svg>
                        <div>
                            <h3>Unforgettable Experiences</h3>
                            <p>Activities and moments you'll cherish forever</p>
                        </div>
                    </div>
                </div>
            </div>
            )}
        </>
=======
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
>>>>>>> origin/master
    )
}

export default Header
