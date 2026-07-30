import {
    useMyBookings,
    cancelBooking,
    deleteBooking,
    addFoodOrder,
    addSpaOrder,
    payBooking,
    findOrderableBooking,
} from './accommodationDB.js'

// The guest-facing façade over the accommodation database, used by My Bookings,
// the food menu and the spa page. Everything underneath lives in
// accommodationDB.js, so a cancellation on one screen immediately frees the
// unit's dates for the next guest and updates the admin Units board — there is
// only one copy of the data.
//
// This list is scoped to the browser that made the bookings. The database
// answers with the rows matching this device's owner token and nothing else, so
// a guest on another phone sees their own reservations, never these.
//
// It sits in its own module rather than in mybooking.jsx because a file that
// exports both a component and a hook opts out of Vite's fast refresh — editing
// the page would reload the browser instead of swapping the component in place.
export function useBookings(){
    // Deliberately NOT the admin store. Signing in as staff must not change
    // what these pages show — that is how a staff phone ended up displaying
    // every guest's reservation on the guest-facing page.
    const bookings = useMyBookings()

    return {
        bookings,
        cancelBooking,
        deleteBooking,
        // Add-ons attach to the most recent live booking (they are stored
        // newest-first). No receipt is needed: payment comes after the booking
        // now, and the down payment includes whatever has been ordered.
        findOrderableBooking,
        addFoodOrderToBooking: addFoodOrder,
        addSpaOrderToBooking: addSpaOrder,
        payBooking,
    }
}
