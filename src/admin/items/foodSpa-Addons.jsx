import AddonOrderPanel from './addonOrderPanel.jsx'

// "Add-ons" tab of Other Services: only the bookings with a physical item
// requested (towel, pillow, extra bedding, electric fan, …).
export default function Addons() {
    return (
        <AddonOrderPanel
            kind="item"
            emptyTitle="No Add-ons requested yet"
            emptyText="Towels, pillows and other add-ons each guest requests will appear here once they place one."
        />
    )
}
