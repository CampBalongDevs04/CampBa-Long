// Booking-page accommodation options (name, pax range, price, photo).
// Kept in its own module (not in accomodationList.jsx) so that component
// file only exports a component — mixed exports break Vite Fast Refresh.
//
// WHERE THE PRICES COME FROM
// --------------------------
// accommodation_rates in Postgres, read through data/accommodationDB.js, so a
// rate edited in the dashboard's Units → Manage tab is the rate the booking
// page quotes — no redeploy. The table further down is the same rate card
// hardcoded, kept as the answer for the moments the database has none:
//
//   • the first paint, before the catalog request has come back;
//   • a missing .env or a dead network, which is the case the whole app is
//     already built to degrade gracefully for (see README).
//
// Screens re-read this on every render and re-render when the catalog lands
// (accomodationList.jsx subscribes via useAccommodationDB), so the swap from
// fallback to database values needs nothing from the components.
import {
    ACCOMMODATION_TYPES,
    findAccommodationRate,
    hasAccommodationRates,
    listAccommodationRates,
    effectiveRatePrice,
    strikethroughRatePrice,
} from './accommodationDB.js'

import houseSmall from '../assets/temp/A-House-Small.png'
import houseMedium from '../assets/temp/A-House-Medium.png'
import houseFamily from '../assets/temp/A-House-Family.png'
import teepeeImage from '../assets/images/acc1.png'
import cottageImage from '../assets/images/acc2.png'
import pavilionImage from '../assets/images/acc3.png'
import tentSmallImage from '../assets/images/acc4.png'
import tentLargeImage from '../assets/images/acc5.png'
import tentPitchingImage from '../assets/images/acc6.png'

// The photos the units SHIPPED with. They are bundled assets, so they are keyed
// by accommodation id here rather than stored in SQL — Vite hashes the
// filenames at build time and the final URL is not knowable from the database.
//
// A photo uploaded in the dashboard lands in `image_url` and overrides the one
// below — see resolveAccommodationImage(). An accommodation added from the
// dashboard has no entry here at all and simply uses its uploaded photo.
const IMAGES_BY_ID = {
    teepee: teepeeImage,
    small: houseSmall,
    medium: houseMedium,
    family: houseFamily,
    'tent-small': tentSmallImage,
    'tent-large': tentLargeImage,
    cottage: cottageImage,
    pavilion: pavilionImage,
    'tent-pitching': tentPitchingImage,
}

// The photo for one accommodation. The UPLOADED one wins: staff who replace a
// unit's photo in the dashboard have said what they want shown, and a bundled
// asset that outranked it would look like the upload had been thrown away.
// Exported so the booking page, the home page cards and the dashboard's own
// preview all answer this question the same way.
export function resolveAccommodationImage(id, imageUrl = null) {
    return imageUrl || IMAGES_BY_ID[id] || null
}

// Info that doesn't change with the stay schedule. The fallback list — the
// database's `accommodation_types` is what is normally shown.
const ACCOMMODATION_INFO = [
    { id: 'teepee', name: 'Teepee', image: teepeeImage },
    { id: 'small', name: 'A-House Small', image: houseSmall },
    { id: 'medium', name: 'A-House Medium', image: houseMedium },
    { id: 'family', name: 'A-House Family', image: houseFamily },
    { id: 'tent-small', name: 'Small Tent', image: tentSmallImage },
    { id: 'tent-large', name: 'Big Tent', image: tentLargeImage },
    { id: 'cottage', name: 'Cottage', image: cottageImage },
    { id: 'pavilion', name: 'Pavillion', image: pavilionImage },
    // Guests pitching their own tent: flat per-tent fee, no group-size ceiling
    // of its own (minPax/maxPax null below) — but it shares the same 4
    // physical tent slots as Small Tent and Big Tent, tracked via pool_id in
    // accommodationInventory.js.
    { id: 'tent-pitching', name: 'Tent Pitching', image: tentPitchingImage },
]

// "Free entrance for 2 pax" IS a real perk (it's on the printed rate card),
// separate from the kids-7-and-below exemption. It used to be advertised here
// but not implemented correctly in computeEntranceFee() — it stacked on top
// of the kids' exemption instead of using the kids as part of its 2-head
// quota, which undercharged every group that had a child in it. See the
// comment on computeEntranceFee() in data/entranceFee.js for how it's applied
// now. Units in FREE_ENTRANCE_EXCLUDED_UNITS don't get the perk at all, per
// the rate card's "not applicable for ..." notes.
export const FREE_ENTRANCE_EXCLUDED_UNITS = new Set(['tent-pitching', 'cottage', 'pavilion', 'table'])

export function isFreeEntranceEligible(unitId){
    return unitId != null && !FREE_ENTRANCE_EXCLUDED_UNITS.has(unitId)
}

// Physical add-ons (Towel, Pillow, Extra Bedding, Electric Fan — see
// menuDB.js's DEFAULT_ADDON_ITEMS) are only for units with resort-provided
// overnight bedding: Teepee and the three A-House sizes. Table and Chairs,
// Cottage and Pavilion are day-use with nothing to add bedding to, and Tent
// Pitching guests bring their own tent and gear — nothing of the resort's to
// add towels or a fan to either. Small Tent and Big Tent are NOT excluded:
// those are resort-provided tents guests actually sleep in.
//
// Same membership as FREE_ENTRANCE_EXCLUDED_UNITS today, kept as its own set
// on purpose — the two answer different questions (an entrance-fee perk vs.
// what physical items a unit can use) and nothing guarantees they keep
// matching as units are added or the rate card changes.
export const ADDON_EXCLUDED_UNITS = new Set(['tent-pitching', 'cottage', 'pavilion', 'table'])

export function isAddonEligible(unitId){
    return unitId != null && !ADDON_EXCLUDED_UNITS.has(unitId)
}

// What each rate group includes used to be an INCLUSIONS constant here. It is
// editable copy now — booking_inclusions in Postgres, read through
// inclusionsFor() in data/bookingPage.js, which keeps the same list as its
// fallback. Kept out of this module rather than re-exported from it: two names
// for one list is how the two copies drift apart.

// Price + pax capacity depend on the stay schedule: Day Time (7 hrs) has its
// own rates, while Day-and-Night and Night-and-Day (both 22 hrs) share the
// same "overnight" rates — see `rateGroup` on each option in timeSelector.jsx.
// A unit is only offered under a schedule if it has an entry here; that's
// why Cottage/Pavilion (day-only) and the tents (overnight-only) don't
// appear in both groups.
//
// FALLBACK ONLY — accommodation_rates is the live copy. These values are the
// seeded ones, so a database that has never been edited answers identically.
const FALLBACK_RATES = {
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
// The "Rent All Resort" card has no dedicated id or flag of its own — it's
// just an accommodation_types row staff added through the dashboard, whose id
// was slugified from whatever they typed. Matched by name instead of a
// hardcoded id so this survives that row's id being whatever it happens to
// be; if staff ever rename it to something without "rent all" in it, the
// Rent Resort toggle simply stops finding it rather than pointing at the
// wrong card.
export function isRentAllOption(item){
    return item != null && /rent all/i.test(item.name)
}

export function findRentAllOption(options){
    return options.find(isRentAllOption) ?? null
}

// The number Rent Resort mode auto-fills Number of Guests with. Prefers the
// rate's structured `maxPax`, but that field is easy for staff to leave blank
// when they set up a rate — they typed "60 Pax" into the free-text label and
// never touched the separate Max Pax box next to it. Falling back to the
// largest number IN that label (so "60 Pax" still yields 60, and a range like
// "8-10 Pax" yields 10) means the auto-fill works off what staff actually
// entered, not just the field they happened to also fill in.
export function rentAllCapacity(option){
    if (!option) return null
    if (option.maxPax != null) return option.maxPax
    const matches = String(option.pax ?? '').match(/\d+/g)
    return matches ? Math.max(...matches.map(Number)) : null
}

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
//
// A unit with no rate for the group is left out entirely, which is what makes
// Cottage day-only and the tents overnight-only — and what makes deleting a
// rate in the dashboard the way to stop offering a unit under one schedule.
export function getAccomodationOptions(rateGroup){
    return hasAccommodationRates()
        ? optionsFromDatabase(rateGroup)
        : optionsFromFallback(rateGroup)
}

function optionsFromDatabase(rateGroup){
    const offered = rateGroup
        ? new Set(listAccommodationRates(rateGroup).map((rate) => rate.typeId))
        : null

    return ACCOMMODATION_TYPES
        .filter((type) => !offered || offered.has(type.id))
        .map((type) => {
            const rate = rateGroup ? findAccommodationRate(type.id, rateGroup) : null
            return {
                id: type.id,
                name: type.name,
                // Whatever staff uploaded for it, falling back to the photo the
                // unit shipped with — or none, which the cards already render
                // as "No image".
                image: resolveAccommodationImage(type.id, type.image),
                // `price` is ALWAYS what the guest pays, promo or not — every
                // screen downstream (the card, the summary, the amount the
                // booking is created with) reads this one field and none of
                // them has to know a promo is on.
                price: effectiveRatePrice(rate),
                // The standing rate to strike through beside it, or null when
                // there is no promo running. Display only.
                originalPrice: strikethroughRatePrice(rate),
                pax: rate?.paxLabel ?? null,
                minPax: rate?.minPax ?? null,
                maxPax: rate?.maxPax ?? null,
            }
        })
}

function optionsFromFallback(rateGroup){
    const rates = rateGroup ? FALLBACK_RATES[rateGroup] : null
    return ACCOMMODATION_INFO
        .filter((item) => !rates || rates[item.id])
        .map((item) => {
            const rate = rates?.[item.id]
            return {
                ...item,
                price: rate?.price ?? null,
                // Promos live in the database only — there is nothing to run one
                // against here, so the fallback card never shows a struck price.
                originalPrice: null,
                pax: rate?.pax ?? null,
                minPax: rate?.minPax ?? null,
                maxPax: rate?.maxPax ?? null,
            }
        })
}
