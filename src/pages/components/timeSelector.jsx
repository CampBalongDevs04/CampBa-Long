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
import { addDays, minNightsFrom } from '../../data/extendedStay.js'
import { describeClosureOn, useMaintenanceDays } from '../../data/maintenanceDays.js'
import { useBookingPage } from '../../data/bookingPage.js'

// A stay may not include a maintenance day anywhere along it — not at the
// ends, not in the middle (see "HOW LONG A STAY MAY BE" in
// data/extendedStay.js) — so a check-in whose very next day is a closure has
// no overnight stay it can book, of any length: the shortest possible one, one
// night, already fails, and every longer one only adds days to a range that
// already does. Day Time is unaffected — it never has a next day to fail on —
// so it stays offered on every date that is itself open.
export default function TimeSelector({ selectedTime, onSelectTime, checkIn }){
    // Subscribed rather than read once: staff can change the closure from the
    // dashboard while this is on screen, and a schedule that has just become
    // bookable should stop being greyed out.
    useMaintenanceDays()
    // The heading over the cards is editable copy (CMS → Booking → Notes &
    // Inclusions). The cards themselves are not: they are the schedules the
    // booking engine holds units against, edited in Units.
    const { page } = useBookingPage()
    // null means no overnight stay exists from this check-in at all — see
    // minNightsFrom()'s own comment for why that is the only other answer.
    const floor = checkIn != null ? minNightsFrom(checkIn) : 1
    const overnightBlocked = floor == null
    // WHICH closure blocked it: the day after the check-in is the one nobody
    // could check out on, and it may be shut for the week ('Mondays') or shut
    // as a one-off ('August 9, 2026'). Naming the weekly pattern for a one-off
    // closure would send the guest looking for a rule that isn't there.
    const closedOn = overnightBlocked ? describeClosureOn(addDays(checkIn, 1)) : ''

    return(
        <div className="booking-time-selector">
            <h3 className="title-selector">
                {page.scheduleTitle}
            </h3>

            <div className="time-choices">
                {STAY_SCHEDULES.map((time, index) => {
                    const isDisabled = overnightBlocked && time.sameDay !== true
                    return (
                        <button
                            key={time.key}
                            type="button"
                            className={`time-card ${selectedTime === index ? 'selected' : ''} ${isDisabled ? 'time-card-disabled' : ''}`}
                            disabled={isDisabled}
                            aria-disabled={isDisabled}
                            title={isDisabled ? `Unavailable — the resort is closed on ${closedOn} for maintenance, right after this check-in date.` : undefined}
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

            {overnightBlocked && (
                <p className="time-closure-note" role="note">
                    Overnight schedules aren&rsquo;t available from this date — the
                    resort is closed on {closedOn} for maintenance, so nobody checks
                    out the next day. Pick a different check-in date, or stay Day
                    Time only.
                </p>
            )}
        </div>
    )
}
