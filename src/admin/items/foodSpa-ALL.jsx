import AddonOrderPanel from './addonOrderPanel.jsx'

// "All" tab of Other Services: every guest who has ordered food, availed a
// spa treatment, or both. The panel itself lives in addonOrderPanel.jsx and is
// shared with the Food and Spa tabs.
export default function FoodSpaAll() {
    return (
        <AddonOrderPanel
            kind="all"
            emptyTitle="No orders yet"
            emptyText="Food orders and spa avails will appear here once guests order against their bookings."
        />
    )
}
