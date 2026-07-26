import { useEffect, useRef } from 'react'
import '../components/css/accomodationList.css'
import { SkeletonImage } from '../../components/skeletons/Skeleton.jsx'
import {
    getAvailability,
    getNextAvailableDate,
    formatShortDate,
} from '../../data/accommodationInventory.js'
import { getAccomodationOptions } from '../../data/accomodationOptions.js'

export default function AccomodationList({ selectedAccomodation, onSelectAccomodation, checkIn, checkOut, rateGroup, droppedUnitNote }){
    const trackRef = useRef(null)
    const hasDates = !!checkIn
    const stayStart = checkIn ?? new Date()
    const stayEnd = checkOut ?? null
    const list = getAccomodationOptions(rateGroup)

    const scrollByCard = (direction) => {
        const track = trackRef.current
        if (!track) return
        const card = track.querySelector('.accomodation-card')
        const step = card ? card.offsetWidth + 12 : 180
        track.scrollBy({ left: direction * step, behavior: 'smooth' })
    }

    // Bring a preselected card (e.g. coming from the home page "Book Now!")
    // into view when the page opens.
    useEffect(() => {
        if (!selectedAccomodation) return
        const track = trackRef.current
        const card = track?.querySelector('.accomodation-card.selected')
        card?.scrollIntoView({ block: 'nearest', inline: 'center' })
    }, [selectedAccomodation])

    return(
        <div className="accomodation-list">
            <p className="accomodation-availability-note">
                {hasDates
                    ? `Showing availability for ${formatShortDate(stayStart)}${stayEnd && formatShortDate(stayEnd) !== formatShortDate(stayStart) ? ` – ${formatShortDate(stayEnd)}` : ''}`
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
                        const availability = unlimited ? null : getAvailability(item.id, stayStart, stayEnd)
                        const isFullyBooked = !unlimited && availability !== null && availability.available === 0
                        const nextAvailable = isFullyBooked
                            ? getNextAvailableDate(item.id, stayStart)
                            : null

                        return (
                            <button
                                type="button"
                                className={`accomodation-card ${selectedAccomodation === item.id ? 'selected' : ''} ${isFullyBooked ? 'fully-booked' : ''}`}
                                key={item.id}
                                disabled={isFullyBooked}
                                onClick={() => onSelectAccomodation?.(item.id)}
                            >
                                <span className="accomodation-card-circle"></span>
                                <div className="accomodation-card-image">
                                    {item.image
                                        ? <SkeletonImage src={item.image} alt={item.name} />
                                        : <span className="accomodation-card-noimage">No image</span>}
                                </div>
                                <div className="accomodation-card-info">
                                    <span className="accomodation-card-name">{item.name}</span>
                                    <span className="accomodation-card-pax">{item.pax}</span>
                                    <span className="accomodation-card-price">
                                        {item.price ? `₱${item.price}` : (rateGroup ? 'Price TBA' : 'Choose schedule')}
                                    </span>
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
                            </button>
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
