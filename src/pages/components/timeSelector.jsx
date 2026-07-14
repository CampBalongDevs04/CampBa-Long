const timeOptions = [
    {
        checkIn: 'Day Time: ',
        time: '10:00 AM - 5:00 PM',
        description: "7 Hours",
        note: 'Check-in/out is fixed by schedule: 10:00 AM to 5:00 PM. Late arrivals are not allowed.',
        sameDay: true
    },
    {
        checkIn: 'Day and night Time: ',
        time: '10:00 AM - 8:00 AM',
        description: "12 Hours",
        note: 'Please arrive or depart early to avoid a late check-in. By schedule: 10:00 AM - 8:00 AM. Late arrivals are not allowed.'
    },
    {
        checkIn: 'Night and Day Time: ',
        time: '7:00 PM - 5:00 AM',
        description: '12 Hours',
        note: 'Please arrive or depart early to avoid a late check-in. By schedule: 7:00 PM - 5:00 AM. Late arrivals are not allowed.'
    }
]

export default function TimeSelector({ selectedTime, onSelectTime }){
    return(
        <div className="booking-time-selector">
            <h3 className="title-selector">
                Select Stay Schedule
            </h3>

            <div className="time-choices">
                {timeOptions.map((time, index) => (
                    <button
                        key={index}
                        type="button"
                        className={`time-card ${selectedTime === index ? 'selected' : ''}`}
                        onClick={() => onSelectTime(index)}
                    >
                        <span className="time-card-circle"></span>
                        <div className="time-card-info">
                            <span className="time-card-label">{time.checkIn}</span>
                            <span className="time-card-time">{time.time}</span>
                            <span className="time-card-desc">{time.description}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    )
}

export { timeOptions }
