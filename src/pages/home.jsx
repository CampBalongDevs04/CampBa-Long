import { Link } from 'react-router'
import '../components/css/Header.css'
import Offers from '../components/offers.jsx'
import Accommodations from '../components/accommodations.jsx'
import Testimonials from '../components/testimonials.jsx'
import Location from '../components/location.jsx'
import { FAQDemo } from '../components/Usage.tsx'
import Contact from '../components/contact.jsx'
import Footer from '../components/footer.jsx'
import { SkeletonImage } from '../components/skeletons/Skeleton.jsx'
import CampBalong from '../assets/images/CampBalong.webp'
import heroVideo from '../assets/video/campbalongVideo.mp4'
import waterSvg from '../assets/svg/water.svg'
import bedSvg from '../assets/svg/bed.svg'
import diningSvg from '../assets/svg/dining.svg'
import camSvg from '../assets/svg/cam.svg'
// Image for the hero circle frame — drop the import in here when it's ready.
const heroCircleImage = CampBalong

function Home() {
    return (
        <>
            <div className="hero-banner" id="home">
                <video
                    className="hero-video"
                    src={heroVideo}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    aria-hidden="true"
                    onCanPlay={(e) => e.currentTarget.classList.add('is-ready')}
                />
                <div className="hero-main">
                <div className="hero-content">
                    <h1 className="hero-title">
                        Book Your<br />
                        Perfect Resort<br />
                        <span className="hero-accent">Getaway</span>
                    </h1>
                    <p className="hero-subtitle">Escape the everyday with comfortable accommodations, relaxing amenities, delicious dining, and unforgettable experiences—all in one destination. Reserve your stay in just a few clicks.</p>
                    <div className="hero-buttons">
                        <Link className="hero-button" to="/my-booking">
                            <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                                <rect x="3" y="5" width="18" height="16" rx="2"/>
                                <path d="M3 10h18M8 3v4M16 3v4"/>
                            </svg>
                            Book Now
                        </Link>
                        <a className="hero-button hero-button-outline" href="#accommodations">
                            <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                                <path d="M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9M10 12v.01"/>
                                <path d="M13 4.56v16.16a1 1 0 0 1-1.24.97L5 20V5.56a2 2 0 0 1 1.51-1.94l4-1A2 2 0 0 1 13 4.56Z"/>
                            </svg>
                            Explore Rooms
                        </a>
                    </div>
                </div>

                <div className="hero-image-circle">
                    {heroCircleImage && <SkeletonImage src={heroCircleImage} alt="Camp Ba-long resort" />}
                </div>
                </div>

                <div className="hero-features">
                    <div className="hero-feature">
                        <img src={bedSvg} alt="" aria-hidden="true" />
                        <div>
                            <h3>Comfortable Stays</h3>
                            <p>Well-appointed rooms for a relaxing stay</p>
                        </div>
                    </div>
                    <div className="hero-feature">
                        <img src={waterSvg} alt="" aria-hidden="true" />
                        <div>
                            <h3>Relaxing Amenities</h3>
                            <p>Pools, spa, and more for your comfort</p>
                        </div>
                    </div>
                    <div className="hero-feature">
                        <img src={diningSvg} alt="" aria-hidden="true" />
                        <div>
                            <h3>Delicious Dining</h3>
                            <p>A variety of cuisines to satisfy you</p>
                        </div>
                    </div>
                    <div className="hero-feature">
                        <img src={camSvg} alt="" aria-hidden="true" />
                        <div>
                            <h3>Unforgettable Experiences</h3>
                            <p>Activities and moments you'll cherish forever</p>
                        </div>
                    </div>
                </div>
            </div>

            <Offers />
            <Accommodations />
            <Testimonials />
            <Location />
            <FAQDemo />
            <Contact />
            <Footer />
        </>
    )
}

export default Home
