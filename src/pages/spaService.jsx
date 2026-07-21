import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import './components/css/spaService.css'
import Footer from '../components/footer'
import LotusDividerIcon from '../components/LotusDividerIcon'
import { useBookings } from './mybooking.jsx'
import massage1 from '../assets/images/massage1.png'
import massage2 from '../assets/images/massage2.png'
import massage3 from '../assets/images/massage3.png'
import massage4 from '../assets/images/massage4.png'
import massage5 from '../assets/images/massage5.png'
import massage6 from '../assets/images/massage6.png'
import massage11 from '../assets/images/massage11.png'
import massage22 from '../assets/images/massage22.png'
import massage33 from '../assets/images/massage33.png'
import massage44 from '../assets/images/massage44.png'
import massage55 from '../assets/images/massage55.png'
import massage66 from '../assets/images/massage66.png'
import massage77 from '../assets/images/massage77.png'
import massage88 from '../assets/images/massage88.png'

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

const hilotServices = [
    { image: massage11, name: 'Ventosa Cupping', desc: 'Suction cupping therapy that eases muscle tension and improves circulation.', duration: '1hr 30mins', price: 850 },
    { image: massage22, name: 'Traditional Body Massage', desc: 'Full-body Hilot massage rooted in Filipino healing traditions.', duration: '1hr', price: 650 },
    { image: massage33, name: 'Back Massage', desc: 'Targeted kneading to release tension across the back and shoulders.', duration: '30mins', price: 400 },
    { image: massage44, name: 'Moisturizing Facial Detox', desc: 'Deep-cleansing facial that hydrates and refreshes tired skin.', duration: '1hr', price: 500 },
    { image: massage55, name: 'Foot Spa with Reflexology', desc: 'Soothing foot soak paired with pressure-point reflexology.', duration: '1hr', price: 400 },
    { image: massage66, name: 'Hand Massage with Manicure', desc: 'Relaxing hand massage finished with a neat manicure.', duration: '1hr', price: 450 },
    { image: massage77, name: 'Foot Spa Reflexology with Pedi', desc: 'Reflexology foot spa complete with a polished pedicure.', duration: '1hr 30mins', price: 550 },
    { image: massage88, name: 'Manicure and Pedicure', desc: 'Classic hand and foot grooming for a clean, polished finish.', duration: '1hr', price: 300 },
]

const hilotInclusions = [
    'Checking Vital Signs (BP, BT)',
    'Blue Salabat Tea',
    'Banana Leaves Natural Ionizer',
]


function SpaOrderModal({ item, onClose }) {
    const { findOrderableBooking, addSpaOrderToBooking } = useBookings()
    const [quantity, setQuantity] = useState(1)
    const [confirmed, setConfirmed] = useState(false)
    const [blocked, setBlocked] = useState(false)

    useEffect(() => {
        const handleKey = (event) => {
            if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKey)
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', handleKey)
            document.body.style.overflow = ''
        }
    }, [onClose])

    useEffect(() => {
        if (!confirmed) return
        const timer = setTimeout(onClose, 1400)
        return () => clearTimeout(timer)
    }, [confirmed, onClose])

    const decrease = () => setQuantity((current) => Math.max(1, current - 1))
    const increase = () => setQuantity((current) => current + 1)

    const total = item.price * quantity

    const handleConfirm = () => {
        const targetBooking = findOrderableBooking()
        if (!targetBooking) {
            setBlocked(true)
            return
        }
        addSpaOrderToBooking(targetBooking.id, {
            name: item.name,
            unitPrice: item.price,
            quantity,
            total,
            orderedAt: new Date().toISOString(),
        })
        setConfirmed(true)
    }

    return (
        <div className="spa-order-overlay" onClick={onClose}>
            <div
                className="spa-order-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`Book ${item.name}`}
                onClick={(event) => event.stopPropagation()}
            >
                <button type="button" className="spa-order-close" onClick={onClose} aria-label="Close">
                    &times;
                </button>

                {confirmed ? (
                    <div className="spa-order-confirmed">
                        <span className="spa-order-confirmed-icon" aria-hidden="true">✓</span>
                        <p>Added to your booking receipt!</p>
                    </div>
                ) : blocked ? (
                    <div className="spa-order-blocked">
                        <span className="spa-order-blocked-icon" aria-hidden="true">!</span>
                        <p>
                            You need a confirmed booking with an uploaded down-payment
                            receipt before you can add a spa service.
                        </p>
                        <div className="spa-order-blocked-actions">
                            <Link to="/my-booking" className="spa-order-blocked-link">
                                View My Bookings
                            </Link>
                            <Link to="/booking" className="spa-order-blocked-link spa-order-blocked-link-primary">
                                Book Now
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="spa-order-body">
                        <div className="spa-order-image">
                            <img src={item.image} alt={item.name} />
                            <span className="spa-order-duration">
                                <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                                    <circle cx="12" cy="12" r="9" />
                                    <path d="M12 7v5l3.5 2" />
                                </svg>
                                {item.duration}
                            </span>
                        </div>
                        <div className="spa-order-details">
                            <h3 className="spa-order-name">{item.name}</h3>
                            <p className="spa-order-desc">{item.desc}</p>
                            <p className="spa-order-price">&#8369;{item.price.toLocaleString('en-PH')}</p>

                            <div className="spa-order-quantity">
                                <button
                                    type="button"
                                    onClick={decrease}
                                    aria-label="Decrease quantity"
                                    disabled={quantity <= 1}
                                >
                                    −
                                </button>
                                <span>{quantity}</span>
                                <button type="button" onClick={increase} aria-label="Increase quantity">
                                    +
                                </button>
                            </div>

                            <p className="spa-order-total">Total: &#8369;{total.toLocaleString('en-PH')}</p>

                            <button type="button" className="spa-order-confirm" onClick={handleConfirm}>
                                Add to Booking Receipt
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function SpaService() {
    const sectionsRef = useRef(null)
    const howToReserveRef = useRef(null)
    const [orderItem, setOrderItem] = useState(null)

    const scrollToHowToReserve = () => {
        howToReserveRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        const items = sectionsRef.current?.querySelectorAll('.spa-service-item, .hilot-card')
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

        <main className="page spa-service-page" ref={sectionsRef}>
            <div className="spa-hero-banner" id = "spaService">
                <div className="spa-hero-content">
                    <h1 className="spa-title">
                        Reserve Your Moment of<br />
                        Relaxation.<br />
                    </h1>
                    <p className="spa-subtitle">Book your next spa session and indulge in a world of tranquility and rejuvenation.</p>
                    <div className="spa-hero-buttons">
                        <button type="button" className="spa-hero-button" onClick={scrollToHowToReserve}>
                            <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                                <rect x="3" y="5" width="18" height="16" rx="2"/>
                                <path d="M3 10h18M8 3v4M16 3v4"/>
                            </svg>
                            Book Now
                        </button>
                    </div>
                </div>
            </div>
            <section className="spa-how-to-reserve" ref={howToReserveRef}>
                
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
                <div className="spa-service-images">
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

            <section className="spa-hilot-section">
                <div className="spa-hilot-glow" aria-hidden="true"></div>
                <div className="spa-hilot-header">
                    <LotusDividerIcon />
                    <span className="spa-hilot-eyebrow">Our Services</span>
                    <h1 className="spa-hilot-title">Hilot Wellness Spa</h1>
                    <p className="spa-hilot-subtitle">
                        Time-honored Filipino healing rituals paired with modern comfort. Choose the treatment that speaks to what your body needs today.
                    </p>
                </div>

                <div className="spa-hilot-grid">
                    {hilotServices.map((item, index) => (
                        <article
                            className="hilot-card"
                            key={item.name}
                            role="button"
                            tabIndex={0}
                            aria-haspopup="dialog"
                            style={{ transitionDelay: `${(index % 4) * 100}ms` }}
                            onClick={() => setOrderItem(item)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    setOrderItem(item)
                                }
                            }}
                        >
                            <div className="hilot-card-media">
                                <img src={item.image} alt={item.name} loading="lazy" />
                                <span className="hilot-card-price">&#8369;{item.price}</span>
                                <span className="hilot-card-overlay">
                                    <span className="hilot-card-overlay-btn">Select Treatment</span>
                                </span>
                            </div>
                            <div className="hilot-card-body">
                                <h3 className="hilot-card-name">{item.name}</h3>
                                <span className="hilot-card-duration">
                                    <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                                        <circle cx="12" cy="12" r="9" />
                                        <path d="M12 7v5l3.5 2" />
                                    </svg>
                                    {item.duration}
                                </span>
                            </div>
                        </article>
                    ))}
                </div>

                <div className="hilot-inclusions">
                    <span className="hilot-inclusions-label">Free Exclusive Inclusions</span>
                    <ul className="hilot-inclusions-list">
                        {hilotInclusions.map((item) => (
                            <li key={item}>
                                <svg viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
                                    <path d="M4 12l5 5L20 6" />
                                </svg>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <Footer />

            {orderItem && <SpaOrderModal item={orderItem} onClose={() => setOrderItem(null)} />}
        </main>
    )
}

export default SpaService
