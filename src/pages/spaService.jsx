import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import './components/css/spaService.css'
import Footer from '../components/footer'
import LotusDividerIcon from '../components/LotusDividerIcon'
import { useBookings } from '../data/useBookings.js'
import { SkeletonImage } from '../components/skeletons/Skeleton.jsx'
// The treatments and their prices live in Postgres (spa_services) — see
// data/menuDB.js — and are edited in the dashboard's Spa section.
import { useSpaServices } from '../data/menuDB.js'
// Everything on this page that is words and decorative pictures rather than
// treatments now comes from its own row in Postgres, edited in the
// dashboard's CMS → Spa Service. It was all hardcoded here until then, so
// changing a heading was a code change and a redeploy.
import { useSpaHero } from '../data/spaHero.js'
import { useSpaReserve } from '../data/spaReserve.js'
import { useSpaGallery, resolveSpaGalleryPhotos } from '../data/spaGallery.js'
import { useSpaHilot } from '../data/spaHilot.js'

// Where a button goes decides what it is, the same three-way split the home
// and menu pages already make. The one difference: an anchor is scrolled to
// rather than jumped to, because that is what this button did when its
// destination was hardcoded and a CMS field should not have quietly changed
// how it feels to press.
function SpaHeroButton({ href, label, className, children }) {
    if (!label) return null
    const target = href || '#how-to-reserve'

    if (target.startsWith('/')) {
        return (
            <Link className={className} to={target}>
                {children}
                {label}
            </Link>
        )
    }

    if (target.startsWith('#')) {
        return (
            <button
                type="button"
                className={className}
                onClick={() =>
                    document.getElementById(target.slice(1))?.scrollIntoView({ behavior: 'smooth' })
                }
            >
                {children}
                {label}
            </button>
        )
    }

    return (
        <a className={className} href={target} target="_blank" rel="noopener noreferrer">
            {children}
            {label}
        </a>
    )
}


// Kiosk-style order tray. Module-level (same pattern as bookingsStore in
// mybooking.jsx and the food cart in foodmenu.jsx) so it survives
// client-side navigation away from /spa and back — e.g. following the
// "checkout blocked" links to go make a booking — and only resets on a
// successful checkout, a real page refresh, or closing the tab.
let spaCartStore = []
let spaCartLineId = 0
const spaCartListeners = new Set()

function notifySpaCart() {
    for (const listener of spaCartListeners) listener()
}

function updateSpaCart(updater) {
    spaCartStore = updater(spaCartStore)
    notifySpaCart()
}

function subscribeSpaCart(listener) {
    spaCartListeners.add(listener)
    return () => spaCartListeners.delete(listener)
}

function getSpaCartSnapshot() {
    return spaCartStore
}

function useSpaCart() {
    const cart = useSyncExternalStore(subscribeSpaCart, getSpaCartSnapshot)

    return {
        cart,
        addToCart(entry) {
            updateSpaCart((prev) => {
                const existing = prev.find((line) => line.name === entry.name)
                if (existing) {
                    return prev.map((line) =>
                        line.name === entry.name
                            ? { ...line, quantity: line.quantity + entry.quantity, total: line.total + entry.total }
                            : line
                    )
                }
                spaCartLineId += 1
                return [...prev, { id: spaCartLineId, ...entry }]
            })
        },
        adjustQuantity(id, delta) {
            updateSpaCart((prev) =>
                prev
                    .map((line) =>
                        line.id === id
                            ? { ...line, quantity: line.quantity + delta, total: line.unitPrice * (line.quantity + delta) }
                            : line
                    )
                    .filter((line) => line.quantity > 0)
            )
        },
        removeLine(id) {
            updateSpaCart((prev) => prev.filter((line) => line.id !== id))
        },
        clearCart() {
            updateSpaCart(() => [])
        },
    }
}

function SpaOrderModal({ item, onClose, onAddToCart }) {
    const [quantity, setQuantity] = useState(1)
    const [confirmed, setConfirmed] = useState(false)

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
        const timer = setTimeout(onClose, 900)
        return () => clearTimeout(timer)
    }, [confirmed, onClose])

    const decrease = () => setQuantity((current) => Math.max(1, current - 1))
    const increase = () => setQuantity((current) => current + 1)

    const total = item.price * quantity

    const handleConfirm = () => {
        onAddToCart({
            // The spa_services row this line came from, so the dashboard can
            // group avails by treatment rather than by display name.
            itemId: item.id,
            image: item.image,
            name: item.name,
            unitPrice: item.price,
            quantity,
            total,
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
                        <p>Added to your order!</p>
                    </div>
                ) : (
                    <div className="spa-order-body">
                        <div className="spa-order-image">
                            <SkeletonImage src={item.image} alt={item.name} />
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
                                Add to Order
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function SpaCheckoutPanel({ cart, status, onIncrease, onDecrease, onRemove, onPlaceOrder, onDismissBlocked }) {
    const [collapsed, setCollapsed] = useState(false)

    if (cart.length === 0 && status !== 'success') return null

    const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0)
    const subtotal = cart.reduce((sum, line) => sum + line.total, 0)

    return (
        <aside className={`spa-checkout${collapsed ? ' is-collapsed' : ''}`} aria-label="Your order">
            <button
                type="button"
                className="spa-checkout-header"
                onClick={() => setCollapsed((current) => !current)}
                aria-expanded={!collapsed}
            >
                <span className="spa-checkout-header-left">
                    <span className="spa-checkout-bag" aria-hidden="true">🧖</span>
                    <span className="spa-checkout-title">Your Order</span>
                    {itemCount > 0 && <span className="spa-checkout-count">{itemCount}</span>}
                </span>
                <span className="spa-checkout-chevron" aria-hidden="true">{collapsed ? '︿' : '﹀'}</span>
            </button>

            {!collapsed && (
                <div className="spa-checkout-body">
                    {status === 'success' ? (
                        <div className="spa-checkout-success">
                            <span className="spa-checkout-success-icon" aria-hidden="true">✓</span>
                            <p>Order sent to your booking receipt!</p>
                        </div>
                    ) : status === 'blocked' ? (
                        <div className="spa-checkout-blocked">
                            <span className="spa-checkout-blocked-icon" aria-hidden="true">!</span>
                            <p>
                                You need a booking before you can reserve a treatment.
                                Book your stay first — spa services are added to your
                                down payment, so booking one before you pay keeps it
                                to a single payment.
                            </p>
                            <div className="spa-checkout-blocked-actions">
                                <Link to="/my-booking" className="spa-checkout-blocked-link">
                                    View My Bookings
                                </Link>
                                <Link to="/booking" className="spa-checkout-blocked-link primary">
                                    Book Now
                                </Link>
                            </div>
                            <button type="button" className="spa-checkout-back" onClick={onDismissBlocked}>
                                ‹ Back to Order
                            </button>
                        </div>
                    ) : (
                        <>
                            <ul className="spa-checkout-list">
                                {cart.map((line) => (
                                    <li className="spa-checkout-item" key={line.id}>
                                        <div className={`spa-checkout-thumb${line.image ? '' : ' is-empty'}`}>
                                            {line.image ? <img src={line.image} alt="" /> : <span aria-hidden="true">🧖</span>}
                                        </div>
                                        <div className="spa-checkout-item-info">
                                            <p className="spa-checkout-item-name">{line.name}</p>
                                            <p className="spa-checkout-item-price">&#8369;{line.unitPrice.toLocaleString('en-PH')} each</p>
                                        </div>
                                        <div className="spa-checkout-item-controls">
                                            <div className="spa-checkout-stepper">
                                                <button type="button" onClick={() => onDecrease(line.id)} aria-label={`Decrease ${line.name}`}>
                                                    −
                                                </button>
                                                <span>{line.quantity}</span>
                                                <button type="button" onClick={() => onIncrease(line.id)} aria-label={`Increase ${line.name}`}>
                                                    +
                                                </button>
                                            </div>
                                            <p className="spa-checkout-item-total">&#8369;{line.total.toLocaleString('en-PH')}</p>
                                        </div>
                                        <button
                                            type="button"
                                            className="spa-checkout-remove"
                                            onClick={() => onRemove(line.id)}
                                            aria-label={`Remove ${line.name} from order`}
                                        >
                                            &times;
                                        </button>
                                    </li>
                                ))}
                            </ul>

                            <div className="spa-checkout-summary">
                                <div className="spa-checkout-summary-row spa-checkout-summary-total">
                                    <span>Total</span>
                                    <span>&#8369;{subtotal.toLocaleString('en-PH')}</span>
                                </div>
                            </div>

                            <button type="button" className="spa-checkout-place" onClick={onPlaceOrder}>
                                Place Order · &#8369;{subtotal.toLocaleString('en-PH')}
                            </button>
                        </>
                    )}
                </div>
            )}
        </aside>
    )
}

function SpaService() {
    const sectionsRef = useRef(null)
    const [orderItem, setOrderItem] = useState(null)
    const { findOrderableBooking, addSpaOrderToBooking } = useBookings()
    // The treatment list, straight from spa_services.
    const hilotServices = useSpaServices()
    // The page's own copy and decorative photos, straight from the CMS.
    const { hero } = useSpaHero()
    const { panel: reserve, activeSteps: reserveSteps } = useSpaReserve()
    const { gallery } = useSpaGallery()
    const { hilot, activeInclusions } = useSpaHilot()
    const galleryPhotos = resolveSpaGalleryPhotos(gallery.photos)
    const { cart, addToCart: addLineToCart, adjustQuantity, removeLine, clearCart } = useSpaCart()
    const [checkoutStatus, setCheckoutStatus] = useState('idle') // idle | blocked | success

    const addToCart = (entry) => {
        setCheckoutStatus('idle')
        addLineToCart(entry)
    }

    const handlePlaceOrder = () => {
        // Eligibility is only checked at checkout, so browsing and building
        // the order tray never requires a booking up front.
        const targetBooking = findOrderableBooking()
        if (!targetBooking) {
            setCheckoutStatus('blocked')
            return
        }
        cart.forEach((line) => {
            addSpaOrderToBooking(targetBooking, {
                itemId: line.itemId,
                name: line.name,
                unitPrice: line.unitPrice,
                quantity: line.quantity,
                total: line.total,
            })
        })
        clearCart()
        setCheckoutStatus('success')
    }

    useEffect(() => {
        if (checkoutStatus !== 'success') return
        const timer = setTimeout(() => setCheckoutStatus('idle'), 2200)
        return () => clearTimeout(timer)
    }, [checkoutStatus])

    // Both lists this watches arrive from the database AFTER the first paint —
    // the treatment cards always did, and the gallery photos do now that they
    // are CMS content rather than six imports. So it re-runs whenever either
    // list changes, not once on mount.
    //
    // Running once was already wrong: .hilot-card starts at opacity 0 and only
    // .is-visible brings it back, so cards that mounted after the single pass
    // were never observed and never became visible at all. Re-observing an
    // element that already carries the class is harmless — it is unobserved
    // again the moment it intersects — so there is nothing to reconcile here
    // beyond letting the effect run again.
    useEffect(() => {
        const items = sectionsRef.current?.querySelectorAll('.spa-service-item, .hilot-card')
        if (!items || items.length === 0) return undefined

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
    }, [galleryPhotos, hilotServices])

    return (

        <main className="page spa-service-page" ref={sectionsRef}>
            {/* The backdrop is only set inline once staff have uploaded one.
                The stylesheet already paints the photo the site shipped with,
                and an inline style that repeated it would make the CSS look
                dead the next time somebody reads it — the same reasoning
                home.jsx uses for the home hero. */}
            <div
                className="spa-hero-banner"
                id="spaService"
                style={hero.backgroundUrl ? { '--spa-hero-bg': `url(${hero.backgroundUrl})` } : undefined}
            >
                <div className="spa-hero-content">
                    <h1 className="spa-title">
                        {hero.titleLines.map((line, index) => (
                            <span key={`${line}-${index}`}>{line}<br /></span>
                        ))}
                    </h1>
                    {hero.subtitle && <p className="spa-subtitle">{hero.subtitle}</p>}
                    <div className="spa-hero-buttons">
                        <SpaHeroButton
                            className="spa-hero-button"
                            href={hero.buttonHref}
                            label={hero.buttonLabel}
                        >
                            <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                                <rect x="3" y="5" width="18" height="16" rx="2"/>
                                <path d="M3 10h18M8 3v4M16 3v4"/>
                            </svg>
                        </SpaHeroButton>
                    </div>
                </div>
            </div>
            {/* The id is what the banner button's "#how-to-reserve" scrolls to,
                so a staff member can point the button here from the dashboard. */}
            <section className="spa-how-to-reserve" id="how-to-reserve">

                <div className="spa-how-to-header">
                    <LotusDividerIcon />
                    <h1 className = "spa-header-title">
                        {reserve.heading}
                    </h1>
                </div>

            <div className ="Spa-instruction-container">

                <div
                    className ="spa-image"
                    style={reserve.imageUrl ? { backgroundImage: `url(${reserve.imageUrl})` } : undefined}
                >

                </div>

                <div className ="spa-instruction">
                    <div className="spa-instruction-item">
                        {reserve.stepsTitle && (
                            <h2 className="spa-instruction-title">{reserve.stepsTitle}</h2>
                        )}
                        {/* Gone entirely rather than left as an empty list, the
                            same as every other CMS list on the site: staff who
                            deleted every step deleted the list. */}
                        {reserveSteps.length > 0 && (
                            <ol className="spa-instruction-steps">
                                {reserveSteps.map((step) => (
                                    <li key={step.id}>{step.step}</li>
                                ))}
                            </ol>
                        )}
                    </div>
                </div>
            </div>
            </section>

            <section className ="spa-service-section">
                <div className="spa-service-header">
                    <LotusDividerIcon />
                    <h1 className="spa-service-title">
                    {gallery.heading}
                    </h1>

                    {gallery.subtitle && (
                        <p className="spa-service-subtitle">
                        {gallery.subtitle}
                        </p>
                    )}
                </div>
                <div className="spa-service-images">
                    {galleryPhotos.map((photo, index) => (
                        <div
                            className="spa-service-item"
                            key={`${photo}-${index}`}
                            style={{ transitionDelay: `${(index % 3) * 120}ms` }}
                        >
                            <SkeletonImage src={photo} alt={`Spa massage service ${index + 1}`} loading="lazy" />
                        </div>
                    ))}
                </div>
            </section>

            <section className="spa-hilot-section">
                <div className="spa-hilot-glow" aria-hidden="true"></div>
                <div className="spa-hilot-header">
                    <LotusDividerIcon />
                    {hilot.eyebrow && <span className="spa-hilot-eyebrow">{hilot.eyebrow}</span>}
                    <h1 className="spa-hilot-title">{hilot.title}</h1>
                    {hilot.subtitle && (
                        <p className="spa-hilot-subtitle">
                            {hilot.subtitle}
                        </p>
                    )}
                </div>

                <div className="spa-hilot-grid">
                    {hilotServices.map((item, index) => (
                        <article
                            className="hilot-card"
                            key={item.id}
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
                                <SkeletonImage src={item.image} alt={item.name} loading="lazy" />
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

                {/* Gone entirely rather than left as a bare label, the same as
                    the reserve steps above: staff who deleted every inclusion
                    deleted the strip. */}
                {activeInclusions.length > 0 && (
                    <div className="hilot-inclusions">
                        {hilot.inclusionsLabel && (
                            <span className="hilot-inclusions-label">{hilot.inclusionsLabel}</span>
                        )}
                        <ul className="hilot-inclusions-list">
                            {activeInclusions.map((row) => (
                                <li key={row.id}>
                                    <svg viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
                                        <path d="M4 12l5 5L20 6" />
                                    </svg>
                                    {row.item}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>

            <Footer />

            {orderItem && (
                <SpaOrderModal item={orderItem} onClose={() => setOrderItem(null)} onAddToCart={addToCart} />
            )}
            <SpaCheckoutPanel
                cart={cart}
                status={checkoutStatus}
                onIncrease={(id) => adjustQuantity(id, 1)}
                onDecrease={(id) => adjustQuantity(id, -1)}
                onRemove={removeLine}
                onPlaceOrder={handlePlaceOrder}
                onDismissBlocked={() => setCheckoutStatus('idle')}
            />
        </main>
    )
}

export default SpaService
