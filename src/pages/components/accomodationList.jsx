import { useEffect, useRef } from 'react'
import '../components/css/accomodationList.css'
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

export default function AccomodationList({ selectedAccomodation, onSelectAccomodation }){
    const trackRef = useRef(null)

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
            <h3 className="accomodation-list-title">Accommodations</h3>

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
                    {list.map((item) => (
                        <button
                            type="button"
                            className={`accomodation-card ${selectedAccomodation === item.id ? 'selected' : ''}`}
                            key={item.id}
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
                                <span className={`accomodation-card-available ${item.available ? 'is-available' : ''}`}>
                                    {item.available === null
                                        ? 'Availability TBA'
                                        : item.available ? 'Available' : 'Fully booked'}
                                </span>
                            </div>
                        </button>
                    ))}
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
