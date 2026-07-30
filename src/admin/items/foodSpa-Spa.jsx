import AddonOrderPanel from './addonOrderPanel.jsx'

// "Spa" tab of Other Services: only the bookings with a treatment availed.
export default function Spa() {
    return (
        <AddonOrderPanel
            kind="spa"
            emptyTitle="No Spa avails yet"
            emptyText="Which treatments each guest availed will appear here once they book one."
        />
    )
}
