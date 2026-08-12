import './css/stayLength.css'
import {
    addDays,
    checkOutForNights,
    countNights,
    isSelectableCheckOut,
    MAX_STAY_NIGHTS,
    maxNightsFrom,
    minNightsFrom,
} from '../../data/extendedStay.js'
import {
    describeClosureOn,
    useMaintenanceDays,
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
    useMaintenanceDays()
    const nights = countNights(checkIn, checkOut)
    const floor = minNightsFrom(checkIn)
    const ceiling = maxNightsFrom(checkIn)
    const disabled = !checkIn

    // `floor` (and `ceiling` with it) comes back null when even the shortest
    // possible stay — one night — would run into a maintenance day: nothing
    // legal starts here at all. In practice TimeSelector has already sent the
    // guest back for a different check-in before an overnight schedule (and
    // this control) can be reached from one, but the guard stays here too
    // rather than trusting that from a distance.
    const noStayFromHere = checkIn != null && floor == null

    // The day a longer stay is capped by — the first maintenance day past the
    // ceiling — named by whichever closure it is: 'Mondays' for the weekly
    // pattern, 'August 9, 2026' for a one-off. Null when the guardrail
    // (MAX_STAY_NIGHTS), not a closure, is what stops the stay from going
    // longer.
    const cappedOn = checkIn && ceiling != null && ceiling < MAX_STAY_NIGHTS
        ? describeClosureOn(addDays(checkIn, ceiling + 1))
        : ''

    const setNights = (value) => {
        if (disabled) return
        const next = checkOutForNights(checkIn, value)
        if (!next) return
        if (checkOut && next.getTime() === checkOut.getTime()) return
        onChange?.(next)
    }

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
                    onClick={() => setNights(nights - 1)}
                    disabled={disabled || floor == null || nights <= floor}
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
                    onClick={() => setNights(nights + 1)}
                    disabled={disabled || ceiling == null || nights >= ceiling}
                >
                    +
                </button>
            </div>

            <div className="stay-length-choices">
                {QUICK_PICKS.map(({ nights: value, label }) => {
                    // Every length is always shown — greyed out rather than
                    // dropped when this check-in can't currently reach it, so
                    // "1 week" stays visible as a real option even when a
                    // closure inside it rules it out today. Staff can move
                    // that closure, or the guest can pick a different
                    // check-in, and the chip should not have quietly vanished
                    // in the meantime. Enabled only when it delivers exactly
                    // what it says: the full length, clear of every
                    // maintenance day along it.
                    const target = checkIn ? checkOutForNights(checkIn, value) : null
                    const reachable = target != null
                        && isSelectableCheckOut(checkIn, target)
                        && countNights(checkIn, target) === value
                    return (
                        <button
                            key={value}
                            type="button"
                            className={`stay-length-chip${value === nights ? ' selected' : ''}`}
                            onClick={() => setNights(value)}
                            disabled={!reachable}
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
                    ) : noStayFromHere ? (
                        <>
                            No stay can start here — the resort is closed for
                            maintenance the very next day. Pick a different
                            check-in date.
                        </>
                    ) : nights < 1 ? (
                        <>
                            Choose your <strong>check-out date</strong> on the calendar, or set the
                            nights here.
                            {cappedOn
                                ? ` Up to ${ceiling} night${ceiling === 1 ? '' : 's'} from this date — the resort is closed on ${cappedOn} after that.`
                                : ' Stay as long as you like.'}
                        </>
                    ) : (
                        <>
                            Checking out <strong>{formatDate(checkOut)}</strong>
                            {schedule ? ` at ${schedule.time.split(' - ')[1]}` : ''}.
                            {cappedOn
                                ? ` The longest stay from here is ${ceiling} night${ceiling === 1 ? '' : 's'}`
                                  + ` — the resort is closed on ${cappedOn} for maintenance.`
                                : ''}
                        </>
                    )}
                </span>
            </p>
        </div>
    )
}
