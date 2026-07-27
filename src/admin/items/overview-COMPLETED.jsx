import OverviewList from './overview-list.jsx'

export default function Completed() {
    return (
        <OverviewList
            filter="completed"
            emptyTitle="No Completed bookings yet"
            emptyText="Stays that have already checked out will appear here."
        />
    )
}
