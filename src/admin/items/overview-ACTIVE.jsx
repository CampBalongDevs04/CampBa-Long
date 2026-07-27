import OverviewList from './overview-list.jsx'

export default function Active() {
    return (
        <OverviewList
            filter="active"
            emptyTitle="No Active bookings yet"
            emptyText="Guests currently checked in — between check-in and check-out — show up here."
        />
    )
}
