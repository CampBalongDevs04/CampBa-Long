import './css/Header.css'
import iconBalong from '../assets/images/logocamp.png'

function Header() {
    return (
        <>
            <header>
                <a className="site-logo" href="#home" aria-label="Camp Ba-long home">
                    <img className="site-logo-icon" src={iconBalong} alt="" />
                    <span className="site-logo-copy">
                        <span className="site-logo-text">Camp Ba-long</span>
                        <span className="site-logo-tagline">Nature Farm. Where you can connect with your inner peace!</span>
                    </span>
                </a>

                <nav className="site-navbar">
                    <a href="#home" id="home">HOME</a>
                    <a href="#food" >MENU</a>
                    <a href="#spa">SPA</a>
                    <a href="#my-booking">MY BOOKING</a>
                    <a href="#user-log" className="site-navbar-icon" aria-label="User account">
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M8 7C9.65685 7 11 5.65685 11 4C11 2.34315 9.65685 1 8 1C6.34315 1 5 2.34315 5 4C5 5.65685 6.34315 7 8 7Z" fill="currentColor" />
                            <path d="M14 12C14 10.3431 12.6569 9 11 9H5C3.34315 9 2 10.3431 2 12V15H14V12Z" fill="currentColor" />
                        </svg>
                    </a>
                </nav>
                
            </header>
            <div className ="hero-banner">
                <div className="hero-content">
                    <h1 className ="hero-title">Welcome to Camp Ba-long<span id="hero-title">Nature Farm<span className="hero-dot" aria-hidden="true"></span></span></h1>
                    <p className ="hero-subtitle">Where you can connect your inner peace.</p>
                    <button className="hero-button" type="button">BOOK NOW!</button>
                </div>
            </div>
        </>
    )
}

export default Header
