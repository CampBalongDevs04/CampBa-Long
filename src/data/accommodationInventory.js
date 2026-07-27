// Compatibility façade over the accommodation database.
//
// The inventory (types, units, availability) now lives in accommodationDB.js
// together with the bookings that consume it — keeping them in one module is
// what lets the client booking flow and the admin dashboard agree on which
// unit is free. This file just re-exports the read side so the existing
// imports across the app keep working.
//
// New code should import from './accommodationDB.js' directly.
export {
    ACCOMMODATION_TYPES,
    STAY_SCHEDULES,
    toISODate,
    formatShortDate,
    formatClock,
    findAccommodationType,
    listUnitIds,
    occupancyWindow,
    getUnitStatus,
    getUnitDayDetail,
    buildUnits,
    getAvailability,
    getNextAvailableDate,
    assignRandomAvailableUnit,
} from './accommodationDB.js'
