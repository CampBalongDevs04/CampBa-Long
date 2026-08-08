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
import { minNightsFrom } from '../../data/extendedStay.js'
import { describeMaintenanceDays, useMaintenanceDays } from '../../data/maintenanceDays.js'

// Every schedule is offered on every check-in date. A Sunday arrival used to be
// Day-Time-only, because the one overnight stay it could make checked out on
// maintenance Monday — but a stay can run through a closure now, so a Sunday
// arrival simply stays until the Tuesday. The calendar is what refuses a
// check-out on a closed day, which is the rule that actually needs enforcing.
export default function TimeSelector({ selectedTime, onSelectTime, checkIn }){
    const { days } = useMaintenanceDays()
    // Which arrivals have a shortest stay longer than one night depends on
    // where the closure falls, so it is asked rather than assumed: with Monday
    // closed it is Sunday arrivals, with Monday and Tuesday closed it is
    // Saturday and Sunday arrivals too.
    const floor = checkIn != null ? minNightsFrom(checkIn) : 1

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

            {floor > 1 && (
                <p className="time-closure-note" role="note">
                    Staying overnight from this date? Your stay runs at least {floor} nights
                    — the resort is closed {describeMaintenanceDays(days)} for maintenance,
                    so nobody checks out on one.
                </p>
            )}
        </div>
    )
}
