// The stay schedules themselves live in the accommodation database
// (STAY_SCHEDULES in data/accommodationDB.js), because each one defines the
// hours a unit is actually held for — availability is computed from the very
// same numbers this selector renders.
//
// entranceFee is charged per head. Day Time is ₱150; the two overnight
// schedules are ₱350. Kids 7 & below are exempt; seniors get 10% off.
//
// `rateGroup` picks which accommodation rate table applies (see
// getAccomodationOptions in accomodationOptions.js): Day Time has its own
// rates, while the two overnight schedules share the same "overnight" rates
// and unit list.
import { STAY_SCHEDULES } from '../../data/accommodationDB.js'

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
                {STAY_SCHEDULES.map((time, index) => {
                    const isDisabled = sundayCheckIn && time.sameDay !== true
                    return (
                        <button
                            key={time.key}
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
