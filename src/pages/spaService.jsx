import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import './components/css/spaService.css'
import Footer from '../components/footer'
import LotusDividerIcon from '../components/LotusDividerIcon'
import massage1 from '../assets/images/massage1.png'
import massage2 from '../assets/images/massage2.png'
import massage3 from '../assets/images/massage3.png'
import massage4 from '../assets/images/massage4.png'
import massage5 from '../assets/images/massage5.png'
import massage6 from '../assets/images/massage6.png'

const instructions = [
    {
        title: 'How to Order',
        descriptions: ['Complete your booking first.', 
            'Browse the Spa Service', 
            'Input How Many Pax', 
            'Review and Confirm your Service', 
            'The total Spa Service will automatically be added to your booking receipt.' 
        ]
    }

]
const service =[
    {
        image: massage1,
    },
    {
        image: massage2,
    },
    {
        image: massage3,
    },
    {
        image: massage4,
    },
    {
        image: massage5,
    },
    {
        image: massage6,
    },
]


function SpaService() {
    const [pax, setPax] = useState('')
    const galleryRef = useRef(null)

    useEffect(() => {
        const items = galleryRef.current?.querySelectorAll('.spa-service-item')
        if (!items || items.length === 0) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible')
                        observer.unobserve(entry.target)
                    }
                })
            },
            { threshold: 0.2 }
        )
        items.forEach((item) => observer.observe(item))
        return () => observer.disconnect()
    }, [])

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
                
                <div className="spa-how-to-header">
                    <LotusDividerIcon />
                    <h1 className = "spa-header-title">
                        How to book Spa Service
                    </h1>
                </div>
            
            <div className ="Spa-instruction-container">

                <div className ="spa-image">

                </div>

                <div className ="spa-instruction">
                    {instructions.map((instruction) => (
                        <div className="spa-instruction-item" key={instruction.title}>
                            <h2 className="spa-instruction-title">{instruction.title}</h2>
                            <ol className="spa-instruction-steps">
                                {instruction.descriptions.map((step) => (
                                    <li key={step}>{step}</li>
                                ))}
                            </ol>
                        </div>
                    ))}
                </div>
            </div>
            </section>

            <section className ="spa-service-section">
                <div className="spa-service-header">
                    <LotusDividerIcon />
                    <h1 className="spa-service-title">
                    Relax. Refresh. Rejuvenate.
                    </h1>

                    <p className="spa-service-subtitle">
                    Indulge in luxurious spa treatments designed to restore your body, calm your mind, and renew your spirit. Book your appointment in just a few clicks.
                    </p>
                </div>
                <div className="pax-input">
                    <input
                        className="how-many-pax"
                        type="number"
                        id="pax"
                        min="1"
                        max="20"
                        placeholder="How many pax?"
                        aria-label="How many pax?"
                        value={pax}
                        onChange={(e) => setPax(e.target.value)}
                    />
                    <button
                        className="pax-submit"
                        type="button"
                        disabled={!pax || Number(pax) < 1}
                    >
                        Add to Your Booking
                    </button>
                </div>

                <div className="spa-service-images" ref={galleryRef}>
                    {service.map((item, index) => (
                        <div
                            className="spa-service-item"
                            key={item.image}
                            style={{ transitionDelay: `${(index % 3) * 120}ms` }}
                        >
                            <img src={item.image} alt={`Spa massage service ${index + 1}`} loading="lazy" />
                        </div>
                    ))}
                </div>
            </section>


            <Footer />
        </main>
    )
}

export default SpaService
