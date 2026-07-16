import '../css/booking-tabs.css'

const bookings =[]

export default function DP(){
    if (bookings.length === 0){
        return(
            <div className="booking-panel">
                <div className="booking-empty">
                    <svg 
                        className="booking-empty-icon"
                        viewBox="0 0 24 24"
                        width="44"
                        height="44"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <h3 className="booking-empty-title">No Down Paid bookings yet</h3>
                    <p className="booking-empty-text">
                        Down Paid reservations will appear here once guests start booking.
                    </p>
                </div>
            </div>
        )
    }
    return (
        <div className="booking-panel">
            {bookings.map((booking) => (
                <div key={booking.id} className="booking-card">
                    {booking.guestName}
                </div>  
            ))}
        </div>
    )



}