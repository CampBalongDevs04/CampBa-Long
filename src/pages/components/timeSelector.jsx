// entranceFee is charged per head. Day Time is ₱150; the two overnight
// schedules are ₱350. Kids 7 & below are exempt; seniors get 10% off.
//
// `rateGroup` picks which accommodation rate table applies (see
// getAccomodationOptions in accomodationOptions.js): Day Time has its own
// rates, while the two overnight schedules share the same "overnight" rates
// and unit list.
const timeOptions = [
    {
        checkIn: 'Day Time: ',
        time: '10:00 AM - 5:00 PM',
        description: "7 Hours",
        note: 'Check-in/out is fixed by schedule: 10:00 AM to 5:00 PM. Late arrivals are not allowed.',
        entranceFee: 150,
        rateGroup: 'day',
        sameDay: true
    },
    {
        checkIn: 'Day and night Time: ',
        time: '10:00 AM - 8:00 AM',
        description: "22 Hours",
        note: 'Please arrive or depart early to avoid a late check-in. By schedule: 10:00 AM - 8:00 AM. Late arrivals are not allowed.',
        entranceFee: 350,
        rateGroup: 'overnight'
    },
    {
        checkIn: 'Night and Day Time: ',
        time: '8:00 PM - 6:00 PM',
        description: '22 Hours',
        note: 'Please arrive or depart early to avoid a late check-in. By schedule: 8:00 PM - 6:00 PM. Late arrivals are not allowed.',
        entranceFee: 350,
        rateGroup: 'overnight'
    }
]

export default function TimeSelector({ selectedTime, onSelectTime, checkIn }){
    // Sunday check-ins can't stay overnight — Monday is maintenance day,
    // so only the same-day Day Time schedule is offered.
    const sundayCheckIn = checkIn != null && checkIn.getDay() === 0

    return(
        <div className="booking-time-selector">
            <h3 className="title-selector">
                Select Stay Schedule
            </h3>

            <div className="time-choices">
                {timeOptions.map((time, index) => {
                    const isDisabled = sundayCheckIn && time.sameDay !== true
                    return (
                        <button
                            key={index}
                            type="button"
                            className={`time-card ${selectedTime === index ? 'selected' : ''} ${isDisabled ? 'time-card-disabled' : ''}`}
                            disabled={isDisabled}
                            aria-disabled={isDisabled}
                            onClick={() => { if (!isDisabled) onSelectTime(index) }}
                        >
                            <span className="time-card-circle"></span>
                            <div className="time-card-info">
                                <span className="time-card-label">{time.checkIn}</span>
                                <span className="time-card-time">{time.time}</span>
                                <span className="time-card-desc">{time.description}</span>
                            </div>
                        </button>
                    )
                })}
            </div>

            {sundayCheckIn && (
                <p className="time-sunday-note" role="note">
                    Sunday check-ins are Day Time only — the resort is closed
                    every Monday for maintenance, so overnight stays are unavailable.
                </p>
            )}
        </div>
    )
}

export { timeOptions }
