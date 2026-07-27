import OverviewList from './overview-list.jsx'

export default function Upcomming() {
    return (
        <OverviewList
            filter="upcomming"
            emptyTitle="No Upcomming bookings yet"
            emptyText="Verified reservations that haven't started yet will appear here."
        />
    )
}
