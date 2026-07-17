// Booking-page accommodation options (name, pax range, price, photo).
// Kept in its own module (not in accomodationList.jsx) so that component
// file only exports a component — mixed exports break Vite Fast Refresh.
import houseSmall from '../assets/temp/A-House-Small.png'
import houseMedium from '../assets/temp/A-House-Medium.png'
import houseFamily from '../assets/temp/A-House-Family.png'

export const accomodationOptions = [
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
