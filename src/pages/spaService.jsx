import { Link } from 'react-router'
import './components/css/spaService.css'


function SpaService() {
    return (

        <main className="page spa-service-page">
            <div className="spa-hero-banner" id = "spaService">
                <div className="spa-hero-content">
                    <h1 className="spa-title">
                        Reserve Your Moment of<br />
                        Relaxation.<br />
                    </h1>
                    <p className="spa-subtitle">Book your next spa session and indulge in a world of tranquility and rejuvenation.</p>
                    <div className="spa-hero-buttons">
                        <Link className="spa-hero-button" to="/my-booking">
                            <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                                <rect x="3" y="5" width="18" height="16" rx="2"/>
                                <path d="M3 10h18M8 3v4M16 3v4"/>
                            </svg>
                            Book Now
                        </Link>
                    </div>
                </div>
            </div>
            <section className="spa-how-to-reserve">

            </section>
        </main>
    )
}

export default SpaService
