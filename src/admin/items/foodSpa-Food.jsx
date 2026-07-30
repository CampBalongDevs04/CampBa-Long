import AddonOrderPanel from './addonOrderPanel.jsx'

// "Food" tab of Other Services: only the bookings with something for the
// kitchen, so a stay that just booked a massage is not on this list.
export default function Food() {
    return (
        <AddonOrderPanel
            kind="food"
            emptyTitle="No Food Orders yet"
            emptyText="What each guest ordered from the menu will appear here once they place an order."
        />
    )
}
