import { useEffect, useRef } from 'react'
import '../components/css/accomodationList.css'
import { SkeletonImage } from '../../components/skeletons/Skeleton.jsx'
import {
    getAvailability,
    getNextAvailableDate,
    formatShortDate,
    useAccommodationDB,
    getSchedule,
} from '../../data/accommodationDB.js'
import { getAccomodationOptions } from '../../data/accomodationOptions.js'

export default function AccomodationList({ cart, onQtyChange, checkIn, checkOut, rateGroup, scheduleKey, droppedUnitNote }){
    const trackRef = useRef(null)
    // Re-renders whenever anything is booked or cancelled — anywhere in the
    // app — so the counts below are never stale.
    useAccommodationDB()
    const hasDates = !!checkIn
    const stayStart = checkIn ?? new Date()
    const stayEnd = checkOut ?? null
    const list = getAccomodationOptions(rateGroup)
    const schedule = getSchedule(scheduleKey)
    const cartCount = (id) => cart?.[id] ?? 0
    const hasSelection = Object.values(cart ?? {}).some((qty) => qty > 0)

    const scrollByCard = (direction) => {
        const track = trackRef.current
        if (!track) return
        const card = track.querySelector('.accomodation-card')
        const step = card ? card.offsetWidth + 12 : 180
        track.scrollBy({ left: direction * step, behavior: 'smooth' })
    }

    // Bring a preselected card (e.g. coming from the home page "Book Now!")
    // into view when the page opens.
    //
    // The TRACK is scrolled, not the card — scrollIntoView() walks every
    // scrollable ancestor including the page itself, so centring a card that
    // sits below the fold would drag the whole booking page down to step 2 and
    // land the guest past the dates they still have to pick. Only this carousel
    // has anything to move here.
    useEffect(() => {
        if (!hasSelection) return
        const track = trackRef.current
        const card = track?.querySelector('.accomodation-card.selected')
        if (!track || !card) return
        // Measured as a DELTA between the two rectangles rather than from
        // card.offsetLeft: the track is position:static, so offsetLeft is
        // counted from the booking shell around it and centring on it lands the
        // card off to one side. The browser clamps the result at both ends.
        const cardBox = card.getBoundingClientRect()
        const trackBox = track.getBoundingClientRect()
        track.scrollLeft +=
            (cardBox.left + cardBox.width / 2) - (trackBox.left + trackBox.width / 2)
    }, [hasSelection])

    return(
        <div className="accomodation-list">
            <p className="accomodation-availability-note">
                {hasDates
                    ? `Showing availability for ${formatShortDate(stayStart)}${stayEnd && formatShortDate(stayEnd) !== formatShortDate(stayStart) ? ` – ${formatShortDate(stayEnd)}` : ''}${schedule ? `, ${schedule.time}` : ''}`
                    : 'Showing availability for today — pick your dates in step 1 to check your stay.'}
            </p>
            {!rateGroup && (
                <p className="accomodation-schedule-note">
                    Select a stay schedule above to see pricing and the units available for it.
                </p>
            )}
            {droppedUnitNote && (
                <p className="accomodation-dropped-note" role="status">{droppedUnitNote}</p>
            )}
            <div className="accomodation-carousel">
                <button
                    type="button"
                    className="carousel-arrow"
                    aria-label="Previous accomodation"
                    onClick={() => scrollByCard(-1)}
                >
                    &#8249;
                </button>

                <div className="accomodation-track" ref={trackRef}>
                    {list.map((item) => {
                        const unlimited = item.unlimited === true
                        const availability = unlimited
                            ? null
                            : getAvailability(item.id, stayStart, stayEnd, scheduleKey)
                        const isFullyBooked = !unlimited && availability !== null && availability.available === 0
                        const nextAvailable = isFullyBooked
                            ? getNextAvailableDate(item.id, stayStart, 60, scheduleKey)
                            : null
                        // What the promo takes off, in pesos. `originalPrice` is
                        // only set while one is running, so this doubles as the
                        // test for whether to say anything at all.
                        const promoSaving =
                            item.originalPrice != null && item.price != null
                                ? item.originalPrice - item.price
                                : null

                        const qty = cartCount(item.id)
                        // Capped at what's actually free for the stay — a
                        // guest can put 2 Teepees in the cart when 2 are open,
                        // never 3. Unlimited (tent pitching) and "no schedule
                        // picked yet" (availability still null) both leave the
                        // + button enabled; there's simply no ceiling to check yet.
                        const maxQty = unlimited || availability == null ? null : availability.available
                        const atMax = maxQty != null && qty >= maxQty
                        const canAdd = !isFullyBooked && !atMax

                        return (
                            <div
                                className={`accomodation-card ${qty > 0 ? 'selected' : ''} ${isFullyBooked ? 'fully-booked' : ''}`}
                                key={item.id}
                            >
                                {qty > 0 && (
                                    <span className="accomodation-card-circle" aria-hidden="true">{qty}</span>
                                )}
                                <div className="accomodation-card-image">
                                    {item.image
                                        ? <SkeletonImage src={item.image} alt={item.name} />
                                        : <span className="accomodation-card-noimage">No image</span>}
                                    {/* On the photo rather than down in the
                                        price line, because the carousel is
                                        scrolled past sideways — a guest should
                                        be able to spot which units are on promo
                                        without stopping to read each card. */}
                                    {promoSaving != null && (
                                        <span className="accomodation-card-promo-flag">Promo</span>
                                    )}
                                </div>
                                <div className="accomodation-card-info">
                                    <span className="accomodation-card-name">{item.name}</span>
                                    <span className="accomodation-card-pax">{item.pax}</span>
                                    {/* With a promo on, the standing rate is
                                        shown struck through before the price
                                        being charged — the discount is only
                                        legible next to what it came down from.
                                        `item.price` is already the promo one;
                                        `originalPrice` is null the rest of the
                                        time, which is the plain single price. */}
                                    <span className="accomodation-card-price">
                                        {item.price ? (
                                            item.originalPrice ? (
                                                <>
                                                    <s className="accomodation-card-price-was">
                                                        ₱{item.originalPrice}
                                                    </s>
                                                    <span className="accomodation-card-price-now">
                                                        ₱{item.price}
                                                    </span>
                                                </>
                                            ) : (
                                                `₱${item.price}`
                                            )
                                        ) : (rateGroup ? 'Price TBA' : 'Choose schedule')}
                                    </span>
                                    {/* The strike-through says the price moved;
                                        this says by how much, which is the part
                                        a guest is actually deciding on. Only
                                        shown when there IS a saving, so it can
                                        never read "save ₱0". */}
                                    {promoSaving > 0 && (
                                        <span className="accomodation-card-promo-hint">
                                            Save ₱{promoSaving.toLocaleString('en-PH')} today
                                        </span>
                                    )}
                                    <span className={`accomodation-card-available ${unlimited || (availability && availability.available > 0) ? 'is-available' : ''}`}>
                                        {unlimited
                                            ? 'Available'
                                            : availability === null
                                                ? 'Availability TBA'
                                                : isFullyBooked
                                                    ? `Fully booked${nextAvailable ? ` · free ${formatShortDate(nextAvailable)}` : ''}`
                                                    : `${availability.available} of ${availability.total} available`}
                                    </span>
                                </div>
                                <div className="accomodation-card-qty">
                                    <button
                                        type="button"
                                        className="accomodation-card-qty-step"
                                        aria-label={`Remove one ${item.name}`}
                                        onClick={() => onQtyChange?.(item.id, qty - 1)}
                                        disabled={qty <= 0}
                                    >
                                        &minus;
                                    </button>
                                    <span className="accomodation-card-qty-count" aria-live="polite">
                                        {qty} {qty === 1 ? 'unit' : 'units'}
                                    </span>
                                    <button
                                        type="button"
                                        className="accomodation-card-qty-step"
                                        aria-label={`Add one ${item.name}`}
                                        onClick={() => onQtyChange?.(item.id, qty + 1)}
                                        disabled={!canAdd}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <button
                    type="button"
                    className="carousel-arrow"
                    aria-label="Next accomodation"
                    onClick={() => scrollByCard(1)}
                >
                    &#8250;
                </button>
            </div>
        </div>
    )
}
