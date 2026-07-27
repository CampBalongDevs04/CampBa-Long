import OverviewList from './overview-list.jsx'

export default function Paid() {
    return (
        <OverviewList
            filter="paid-full"
            emptyTitle="No Fully Paid bookings yet"
            emptyText="Bookings whose balance has been settled will appear here."
        />
    )
}
