import OverviewList from './overview-list.jsx'

export default function DP() {
    return (
        <OverviewList
            filter="down-payment"
            emptyTitle="No Down Paid bookings yet"
            emptyText="Bookings with only the 50% down payment on file will appear here."
        />
    )
}
