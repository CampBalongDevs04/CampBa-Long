// Booking-page accommodation options (name, pax range, price, photo).
// Kept in its own module (not in accomodationList.jsx) so that component
// file only exports a component — mixed exports break Vite Fast Refresh.
import houseSmall from '../assets/temp/A-House-Small.png'
import houseMedium from '../assets/temp/A-House-Medium.png'
import houseFamily from '../assets/temp/A-House-Family.png'

// Info that doesn't change with the stay schedule.
// `freeEntranceExempt` marks units left out of the "free entrance for 2 pax"
// perk (see INCLUSIONS below) — cottage/pavilion on the Day rate and tent
// pitching on the overnight rate charge entrance for every head.
const ACCOMMODATION_INFO = [
    { id: 'teepee', name: 'Teepee', image: null },
    { id: 'small', name: 'A-House Small', image: houseSmall },
    { id: 'medium', name: 'A-House Medium', image: houseMedium },
    { id: 'family', name: 'A-House Family', image: houseFamily },
    { id: 'tent-small', name: 'Small Tent', image: null },
    { id: 'tent-large', name: 'Big Tent', image: null },
    { id: 'cottage', name: 'Cottage', image: null, freeEntranceExempt: true },
    { id: 'pavilion', name: 'Pavillion', image: null, freeEntranceExempt: true },
    // Guests pitching their own tent: flat per-tent fee, no capacity limit,
    // so it has no minPax/maxPax and isn't tracked in accommodationInventory.js.
    { id: 'tent-pitching', name: 'Tent Pitching', image: null, unlimited: true, freeEntranceExempt: true },
]

// Free-entrance headcount granted per booking under the perk above.
export const FREE_ENTRANCE_PAX = 2

// What each stay schedule's rate includes, shown alongside the schedule note.
export const INCLUSIONS = {
    day: [
        'Free entrance for 2 pax (not applicable for cottage & pavilion)',
        'Free parking',
        '3 hours free use of jacuzzi',
        'Free use of charcoal griller',
        'Access to swimming pool, kiddie pool & running water',
        'Access to bathrooms and showers',
    ],
    overnight: [
        'Free entrance for 2 pax (not applicable for tent pitching)',
        'Free parking',
        '3 hours free use of jacuzzi',
        'Free use of charcoal griller',
        'Access to swimming pool, kiddie pool & running water',
        'Access to bathrooms and showers',
        'Beddings included (except tent pitching)',
    ],
}

// Price + pax capacity depend on the stay schedule: Day Time (7 hrs) has its
// own rates, while Day-and-Night and Night-and-Day (both 22 hrs) share the
// same "overnight" rates — see `rateGroup` on each option in timeSelector.jsx.
// A unit is only offered under a schedule if it has an entry here; that's
// why Cottage/Pavilion (day-only) and the tents (overnight-only) don't
// appear in both groups.
const RATES = {
    day: {
        teepee: { price: 900, pax: '4 Pax', minPax: 1, maxPax: 4 },
        small: { price: 1450, pax: '4 Pax', minPax: 1, maxPax: 4 },
        medium: { price: 1900, pax: '4-5 Pax', minPax: 4, maxPax: 5 },
        family: { price: 4000, pax: '8-10 Pax', minPax: 8, maxPax: 10 },
        cottage: { price: 2000, pax: '8-10 Pax', minPax: 8, maxPax: 10 },
        pavilion: { price: 4000, pax: '10-15 Pax', minPax: 10, maxPax: 15 },
    },
    overnight: {
        teepee: { price: 1700, pax: '2-3 Pax', minPax: 2, maxPax: 3 },
        small: { price: 2250, pax: '2-3 Pax', minPax: 2, maxPax: 3 },
        medium: { price: 3200, pax: '4-5 Pax', minPax: 4, maxPax: 5 },
        family: { price: 7000, pax: '8-10 Pax', minPax: 8, maxPax: 10 },
        'tent-small': { price: 900, pax: '2-3 Pax', minPax: 2, maxPax: 3 },
        'tent-large': { price: 1800, pax: '4-6 Pax', minPax: 4, maxPax: 6 },
        'tent-pitching': { price: 500, pax: 'Any group size', minPax: null, maxPax: null },
    },
}

// How a group size sits against one unit's capacity:
//
//   'fit'   — inside minPax–maxPax, or a unit with no capacity at all
//             (Tent Pitching), which always fits.
//   'under' — fewer heads than minPax. STILL BOOKABLE: the rate is charged per
//             unit and not per head, so a smaller group simply pays for the
//             whole unit. Worth saying out loud, never worth blocking.
//   'over'  — more heads than maxPax. NOT bookable: that's how many people the
//             unit physically holds.
export function getPaxFit(pax, option){
    if (!pax || !option || option.maxPax == null) return 'fit'
    if (pax > option.maxPax) return 'over'
    if (option.minPax != null && pax < option.minPax) return 'under'
    return 'fit'
}

// Cards for a given rate group ('day' | 'overnight'), merged with that
// group's price/pax. With no group (no schedule picked yet) every unit is
// returned with price/pax left null, so the UI can show its own
// "select a schedule" placeholder instead of guessing a rate.
export function getAccomodationOptions(rateGroup){
    const rates = rateGroup ? RATES[rateGroup] : null
    return ACCOMMODATION_INFO
        .filter((item) => !rates || rates[item.id])
        .map((item) => {
            const rate = rates?.[item.id]
            return {
                ...item,
                price: rate?.price ?? null,
                pax: rate?.pax ?? null,
                minPax: rate?.minPax ?? null,
                maxPax: rate?.maxPax ?? null,
                freeEntranceExempt: item.freeEntranceExempt === true,
            }
        })
}
