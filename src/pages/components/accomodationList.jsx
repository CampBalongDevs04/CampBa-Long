import { useEffect, useRef } from 'react'
import '../components/css/accomodationList.css'
import {
    getAvailability,
    getNextAvailableDate,
    formatShortDate,
} from '../../data/accommodationInventory.js'
import houseSmall from '../../assets/temp/A-House-Small.png'
import houseMedium from '../../assets/temp/A-House-Medium.png'
import houseFamily from '../../assets/temp/A-House-Family.png'

const list = [
    {
        id: 'table',
        name: 'Table',
        pax: '1-2 Pax',
        minPax: 1,
        maxPax: 2,
        available: null,
        price: null,
        image: null,
    },
    {
        id: 'tent',
        name: 'Camping Tent',
        pax: '1-3 Pax',
        minPax: 1,
        maxPax: 3,
        available: null,
        price: null,
        image: null,
    },
    {
        id: 'small',
        name: 'A-House Small',
        pax: '1-2 Pax',
        minPax: 1,
        maxPax: 2,
        available: null,
        price: null,
        image: houseSmall,
    },
    {
        id: 'medium',
        name: 'A-House Medium',
        pax: '2-4 Pax',
        minPax: 2,
        maxPax: 4,
        available: null,
        price: null,
        image: houseMedium,
    },
    {
        id: 'large',
        name: 'A-House Family',
        pax: '4-6 Pax',
        minPax: 4,
        maxPax: 6,
        available: null,
        price: null,
        image: houseFamily,
    },
    {
        id: 'pavilion',
        name: 'Pavillion',
        pax: '10-15 Pax',
        minPax: 10,
        maxPax: 15,
        available: null,
        price: null,
        image: null,
    }
]

export default function AccomodationList({ selectedAccomodation, onSelectAccomodation, checkIn, checkOut }){
    const trackRef = useRef(null)
    const hasDates = !!checkIn
    const stayStart = checkIn ?? new Date()
    const stayEnd = checkOut ?? null

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
                        const availability = getAvailability(item.id, stayStart, stayEnd)
                        const isFullyBooked = availability !== null && availability.available === 0
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
                                        ? <img src={item.image} alt={item.name} />
                                        : <span className="accomodation-card-noimage">No image</span>}
                                </div>
                                <div className="accomodation-card-info">
                                    <span className="accomodation-card-name">{item.name}</span>
                                    <span className="accomodation-card-pax">{item.pax}</span>
                                    <span className="accomodation-card-price">
                                        {item.price ? `₱${item.price}` : 'Price TBA'}
                                    </span>
                                    <span className={`accomodation-card-available ${availability && availability.available > 0 ? 'is-available' : ''}`}>
                                        {availability === null
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

export { list as accomodationOptions }
