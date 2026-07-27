import OverviewList from './overview-list.jsx'

export default function All() {
    return (
        <OverviewList
            filter="all"
            emptyTitle="No bookings yet"
            emptyText="New reservations will appear here once guests start booking."
        />
    )
}
