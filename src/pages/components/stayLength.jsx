import './css/stayLength.css'
import {
    checkOutForNights,
    countNights,
    maxNightsFrom,
    minNightsFrom,
    nextClosureAfter,
} from '../../data/extendedStay.js'
import {
    describeMaintenanceDayNames,
    useMaintenanceDays,
    WEEKDAY_NAMES,
} from '../../data/maintenanceDays.js'

// THE CALENDAR IS THE RANGE PICKER
// --------------------------------
// Picking Aug 6 and then Aug 9 on the two calendar panels IS how a stay gets
// its length — that is the whole interaction, and there is no ceiling on it: a
// week, a fortnight, whatever the guest wants.
//
// This is the shortcut beside it, for the guest who thinks "a week" rather than
// "the 13th". It holds no state of its own: it reads the nights back out of the
// two dates and writes a check-out date when used, so it and the calendar are
// the same fact said two ways and cannot drift apart.
//
// Only overnight schedules have nights to count — Day Time is a fixed
// 10:00–17:00 block — so the caller hides this for a same-day schedule.

// Jumps worth one tap. Two nights and three cover most weekends; the last two
// are the reason this control exists at all, since nobody wants to count
// fourteen days across two calendar pages to book a fortnight.
const QUICK_PICKS = [
    { nights: 1, label: '1 night' },
    { nights: 2, label: '2 nights' },
    { nights: 3, label: '3 nights' },
    { nights: 7, label: '1 week' },
    { nights: 14, label: '2 weeks' },
]

function formatDate(date){
    if (!date) return null
    return date.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    })
}

export default function StayLength({ checkIn, checkOut, schedule, onChange }){
    // Subscribed so the floor, the ceiling and the note below all move together
    // when staff change the closure — every one of them is derived from it.
    const { days } = useMaintenanceDays()
    const nights = countNights(checkIn, checkOut)
    const floor = minNightsFrom(checkIn)
    const ceiling = maxNightsFrom(checkIn)
    const disabled = !checkIn
    // The closure that's actually setting the ceiling above, so the note and
    // the chip tooltips can name it rather than just saying "unavailable".
    const upcomingClosure = checkIn ? nextClosureAfter(checkIn) : null

    // `direction` is which way the guest is moving, handed down to
    // checkOutForNights() so a value that lands on a maintenance day is nudged
    // the way they were already going — pressing "−" never bounces the number
    // back up.
    const setNights = (value, direction = 1) => {
        if (disabled) return
        const next = checkOutForNights(checkIn, value, direction)
        if (!next) return
        if (checkOut && next.getTime() === checkOut.getTime()) return
        onChange?.(next)
    }

    // An arrival the day before a closure cannot check out into it, so its
    // shortest stay is longer than one night — two with Monday closed, three
    // with Monday and Tuesday. Worth saying rather than leaving "−"
    // mysteriously dead.
    const atFloor = nights > 0 && nights <= floor
    const arrivalDay = checkIn ? WEEKDAY_NAMES[checkIn.getDay()] : ''

    return (
        <div className={`stay-length${disabled ? ' stay-length-disabled' : ''}`}>
            <div className="stay-length-head">
                <span className="stay-length-label" id="stay-length-label">
                    Length of Stay
                </span>
                <span className="stay-length-sub">
                    Set it here or pick your check-out straight on the calendar —
                    each night is charged at the {schedule?.description ?? 'overnight'} rate,
                    unit rate and entrance fees both.
                </span>
            </div>

            <div className="stay-length-counter" role="group" aria-labelledby="stay-length-label">
                <button
                    type="button"
                    className="stay-length-step"
                    aria-label="One night shorter"
                    onClick={() => setNights(nights - 1, -1)}
                    disabled={disabled || nights <= floor}
                >
                    &minus;
                </button>

                <span className="stay-length-count" aria-live="polite" aria-atomic="true">
                    {nights > 0 ? `${nights} ${nights === 1 ? 'night' : 'nights'}` : '—'}
                </span>

                <button
                    type="button"
                    className="stay-length-step"
                    aria-label="One night longer"
                    onClick={() => setNights(Math.max(floor - 1, nights) + 1, 1)}
                    disabled={disabled || nights >= ceiling}
                >
                    +
                </button>
            </div>

            <div className="stay-length-choices">
                {QUICK_PICKS.map(({ nights: value, label }) => {
                    // Grayed out rather than dropped from the row once it
                    // would cross the next closure — a stay can't run through
                    // one any more, so anything past the ceiling simply can't
                    // be booked from this check-in. Still shown, so the guest
                    // sees "1 week" exists and why it isn't on offer here.
                    const blocked = !checkIn || value > ceiling
                    return (
                        <button
                            key={value}
                            type="button"
                            className={`stay-length-chip${value === nights ? ' selected' : ''}${blocked ? ' stay-length-chip-disabled' : ''}`}
                            disabled={blocked}
                            aria-disabled={blocked}
                            title={blocked && upcomingClosure
                                ? `Unavailable — ${formatDate(upcomingClosure)} is a maintenance day, so this check-in can only run up to ${ceiling} night${ceiling === 1 ? '' : 's'}.`
                                : undefined}
                            onClick={() => { if (!blocked) setNights(value, 1) }}
                            aria-pressed={value === nights}
                        >
                            {label}
                        </button>
                    )
                })}
            </div>

            <p className="stay-length-note" role="note">
                <span className="stay-length-note-dot" aria-hidden="true"></span>
                <span className="stay-length-note-body">
                    {!checkIn ? (
                        <>Pick a <strong>check-in date</strong> above, then choose your check-out — or set the nights here.</>
                    ) : nights < 1 ? (
                        <>
                            Choose your <strong>check-out date</strong> on the calendar, or set the
                            nights here. Stay as long as you like.
                        </>
                    ) : (
                        <>
                            Checking out <strong>{formatDate(checkOut)}</strong>
                            {schedule ? ` at ${schedule.time.split(' - ')[1]}` : ''}.
                            {atFloor && floor > 1
                                ? ` A ${arrivalDay} check-in stays at least ${floor} nights`
                                  + ` — nobody checks out on ${describeMaintenanceDayNames(days)}.`
                                : ''}
                            {upcomingClosure
                                ? ` This stay can run up to ${ceiling} night${ceiling === 1 ? '' : 's'}`
                                  + ` — ${formatDate(upcomingClosure)} is a maintenance day.`
                                : ''}
                        </>
                    )}
                </span>
            </p>
        </div>
    )
}
