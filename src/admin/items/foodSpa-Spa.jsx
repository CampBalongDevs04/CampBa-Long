import '../css/tabFoodSpa.css'

const orderService = [] 

export default function Spa() {
    
    if (orderService.length === 0) {
        return (
            <div className="orderService-panel">
                <div className="orderService-empty">
                    <svg
                        className="orderService-empty-icon"
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
                    <h3 className="orderService-empty-title">No Spa bookings yet</h3>
                    <p className="orderService-empty-text">
                        New Spa reservations will appear here once guests start booking.
                    </p>
                </div>
            </div>
        )
    }

    // List state — runs once bookings has data
    return (
        <div className="orderService-panel">
            {orderService.map((orderService) => (
                <div key={orderService.id} className="orderService-card">
                    {orderService.guestName}
                </div>
            ))}
        </div>
    )
}
