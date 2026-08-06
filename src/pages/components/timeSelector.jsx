// The stay schedules themselves live in the accommodation database
// (STAY_SCHEDULES in data/accommodationDB.js), because each one defines the
// hours a unit is actually held for — availability is computed from the very
// same numbers this selector renders.
//
// entranceFee is charged per head. Day Time is ₱150; the two overnight
// schedules are ₱350. Kids 7 & below are exempt. Seniors are charged the full
// rate here — their discount is given at the resort, not by this system (see
// SENIOR_DISCOUNT_RATE in data/entranceFee.js).
//
// `rateGroup` picks which accommodation rate table applies (see
// getAccomodationOptions in accomodationOptions.js): Day Time has its own
// rates, while the two overnight schedules share the same "overnight" rates
// and unit list.
import { STAY_SCHEDULES } from '../../data/accommodationDB.js'

// Every schedule is offered on every check-in date. A Sunday arrival used to be
// Day-Time-only, because the one overnight stay it could make checked out on
// maintenance Monday — but a stay can run through a Monday now, so a Sunday
// arrival simply stays until the Tuesday. The calendar is what refuses a Monday
// check-out, which is the rule that actually needs enforcing.
export default function TimeSelector({ selectedTime, onSelectTime, checkIn }){
    // Only Sunday arrivals have a shortest stay of two nights rather than one.
    const sundayCheckIn = checkIn != null && checkIn.getDay() === 0

    return(
        <div className="booking-time-selector">
            <h3 className="title-selector">
                Select Stay Schedule
            </h3>

            <div className="time-choices">
                {STAY_SCHEDULES.map((time, index) => (
                    <button
                        key={time.key}
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

            {sundayCheckIn && (
                <p className="time-sunday-note" role="note">
                    Staying overnight from a Sunday? Your stay runs at least until
                    Tuesday — the resort is closed every Monday for maintenance, so
                    nobody checks out on one.
                </p>
            )}
        </div>
    )
}
