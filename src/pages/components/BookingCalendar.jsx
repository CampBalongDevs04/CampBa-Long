import { useState } from 'react'
import './css/bookingCalendar.css'
import {
    addDays,
    countNights,
    firstMaintenanceDayInRange,
    isMaintenanceDay,
    isSelectableCheckOut,
    MAX_STAY_NIGHTS,
} from '../../data/extendedStay.js'
import {
    describeClosureOn,
    describeMaintenanceDates,
    describeMaintenanceDays,
    isPastDateKey,
    useMaintenanceDays,
} from '../../data/maintenanceDays.js'

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isSameDay(a, b) {
    return a && b && a.getTime() === b.getTime()
}

// The first date past the end of the longest bookable stay. This is an outer
// guardrail against a mis-click holding a unit for a year, not the thing that
// actually shapes the check-out panel day to day — isSelectableCheckOut()
// below does that, disabling any date whose range would cross a maintenance
// day, wherever in the stay it falls.
function stayLimitAfter(date) {
    return addDays(date, MAX_STAY_NIGHTS + 1)
}

// The note under the calendar: 'Mondays are maintenance day', 'Monday to
// Tuesday are maintenance days', 'Mondays are maintenance day, and so are
// Aug 8, 9 and 10'. The closure is a setting now (data/maintenanceDays.js) —
// a weekly pattern plus any number of single dates — so this has to be built
// rather than written.
//
// Dates already past are left out: they close nothing anyone can still book,
// and listing them would make the sentence longer and less true.
function closureLabel(days, dates) {
    const upcoming = dates.filter((key) => !isPastDateKey(key))
    const weekly = days.length === 0
        ? ''
        : `${describeMaintenanceDays(days)} ${days.length === 1 ? 'are maintenance day' : 'are maintenance days'}`

    if (upcoming.length === 0) return weekly
    const single = describeMaintenanceDates(upcoming)
    if (!weekly) return `The resort is closed on ${single}`
    return `${weekly}, and so ${upcoming.length === 1 ? 'is' : 'are'} ${single}`
}

// Why THIS cell is greyed — the weekly pattern for most of them, one date for a
// one-off closure. Per cell rather than one label for the whole calendar,
// because "Mondays are maintenance day" on a greyed August 8th would be a wrong
// answer to the question the guest is actually asking.
function cellClosureLabel(date) {
    const reason = describeClosureOn(date)
    return reason ? `the resort is closed on ${reason} for maintenance` : ''
}

// Why a CHECK-OUT cell is greyed when the date itself is open but the stay
// leading up to it is not — the range from the chosen check-in runs through a
// maintenance day somewhere in between, and this names that day rather than
// the one the guest clicked.
function rangeClosureLabel(checkIn, date) {
    const own = cellClosureLabel(date)
    if (own) return own
    if (!checkIn) return ''
    const blocker = firstMaintenanceDayInRange(checkIn, date)
    if (!blocker) return ''
    const reason = describeClosureOn(blocker)
    return reason
        ? `the stay would run through ${formatDate(blocker)}, closed on ${reason} for maintenance`
        : ''
}

function formatDate(date) {
    if (!date) return 'Select a date'
    return date.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    })
}

function CalendarPanel({ label, variant, selected, onSelect, minDate, maxDate, rangeStart, rangeEnd }) {
    const today = startOfDay(new Date())
    const initialView = selected || minDate || today
    const [viewYear, setViewYear] = useState(initialView.getFullYear())
    const [viewMonth, setViewMonth] = useState(initialView.getMonth())

    // Follow a selection that was made somewhere else. The nights stepper can
    // set a check-out several days out — "5 nights" from Oct 28 lands in
    // November — and a panel still showing October would look like the chip
    // had done nothing.
    //
    // Adjusted during render rather than in an effect, which is React's own
    // advice for state that has to follow a prop: an effect would paint the
    // stale month first and then correct it. The guard is the last selection
    // this ran for, so browsing ahead by hand afterwards is left alone.
    const selectedTime = selected ? selected.getTime() : null
    const [lastSelectedTime, setLastSelectedTime] = useState(selectedTime)
    if (selectedTime !== lastSelectedTime) {
        setLastSelectedTime(selectedTime)
        if (selected) {
            setViewYear(selected.getFullYear())
            setViewMonth(selected.getMonth())
        }
    }

    const firstOfMonth = new Date(viewYear, viewMonth, 1)
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const leadingBlanks = firstOfMonth.getDay()

    const canGoPrev = viewYear > today.getFullYear() ||
        (viewYear === today.getFullYear() && viewMonth > today.getMonth())

    function goPrev() {
        if (!canGoPrev) return
        if (viewMonth === 0) {
            setViewMonth(11)
            setViewYear(viewYear - 1)
        } else {
            setViewMonth(viewMonth - 1)
        }
    }

    function goNext() {
        if (viewMonth === 11) {
            setViewMonth(0)
            setViewYear(viewYear + 1)
        } else {
            setViewMonth(viewMonth + 1)
        }
    }

    const cells = []
    for (let i = 0; i < leadingBlanks; i++) {
        cells.push(<div key={`blank-${i}`} className="cal-cell cal-blank" />)
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(viewYear, viewMonth, day)
        const isPast = date.getTime() < today.getTime()
        // A check-in cell only answers for itself — whichever days the resort
        // has closed, not a hardcoded Monday. A check-out cell answers for the
        // whole stay it would complete: `minDate` is the chosen check-in here
        // (see the two CalendarPanel call sites below), so a date that is
        // itself open still greys out if reaching it from that check-in would
        // run through a maintenance day anywhere in between.
        const isClosed = variant === 'checkout' && minDate
            ? !isSelectableCheckOut(minDate, date)
            : isMaintenanceDay(date)
        const isBeforeMin = minDate && date.getTime() <= minDate.getTime()
        const isPastMax = maxDate && date.getTime() >= maxDate.getTime()

        const isDisabled = isPast || isClosed || isBeforeMin || isPastMax
        const isSelected = isSameDay(date, selected)
        const isInRange = rangeStart && rangeEnd &&
            date.getTime() > rangeStart.getTime() && date.getTime() < rangeEnd.getTime()

        const closedBecause = isClosed
            ? (variant === 'checkout' ? rangeClosureLabel(minDate, date) : cellClosureLabel(date))
            : ''

        const classNames = ['cal-cell', 'cal-day']
        if (isClosed) classNames.push('cal-maintenance')
        if (isDisabled) classNames.push('cal-disabled')
        if (isSelected) classNames.push('cal-selected')
        if (isInRange) classNames.push('cal-in-range')
        if (isSameDay(date, today)) classNames.push('cal-today')

        cells.push(
            <button
                key={day}
                type="button"
                className={classNames.join(' ')}
                // A closed day stays focusable so its tooltip is reachable —
                // "why can't I pick this?" is worth answering, where a past
                // date needs no explanation.
                disabled={isDisabled && !isClosed}
                aria-disabled={isDisabled}
                onClick={() => { if (!isDisabled) onSelect(date) }}
                data-hint={closedBecause || undefined}
                aria-label={
                    closedBecause
                        ? `${formatDate(date)} — unavailable, ${closedBecause}`
                        : formatDate(date)
                }
            >
                {day}
            </button>
        )
    }

    return (
        <div className={`cal-panel cal-panel-${variant}`}>
            <div className="cal-panel-title">
                <span className="cal-panel-label">{label}</span>
                <span className="cal-panel-value">{formatDate(selected)}</span>
            </div>

            <div className="cal-header">
                <button
                    type="button"
                    className="cal-nav"
                    onClick={goPrev}
                    disabled={!canGoPrev}
                    aria-label="Previous month"
                >
                    &#8249;
                </button>
                <span className="cal-month-label">
                    {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <button
                    type="button"
                    className="cal-nav"
                    onClick={goNext}
                    aria-label="Next month"
                >
                    &#8250;
                </button>
            </div>

            <div className="cal-grid cal-weekdays">
                {WEEKDAYS.map(wd => (
                    <div key={wd} className="cal-cell cal-weekday">{wd}</div>
                ))}
            </div>

            <div className="cal-grid">
                {cells}
            </div>
        </div>
    )
}

function SameDayPanel({ checkIn }) {
    const dateLabel = checkIn
        ? `${checkIn.getMonth() + 1}/${checkIn.getDate()}/${checkIn.getFullYear()}`
        : 'Select a check-in date'

    return (
        <div className="cal-panel cal-panel-checkout cal-panel-sameday">
            <span className="cal-sameday-title">Same Day Check Out</span>
            <svg
                className="cal-sameday-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <rect x="3" y="5" width="18" height="16" rx="2.5" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <rect x="6.5" y="2.5" width="3" height="4.5" rx="1.5" />
                <rect x="14.5" y="2.5" width="3" height="4.5" rx="1.5" />
            </svg>
            <span className="cal-sameday-date">{dateLabel}</span>
            <p className="cal-sameday-note">
                Day Time strictly 10:00am to 5:00pm on the same calendar
            </p>
        </div>
    )
}

// CONTROLLED. The dates used to live here as local state and be mirrored up to
// the booking page through onChange, which was fine while this was the only
// thing that could move them. The nights stepper (stayLength.jsx) sets a
// check-out date too, and two copies of the same fact would have drifted the
// moment either one wrote — so the booking page owns the pair and this renders
// what it is given.
export default function BookingCalendar({
    checkIn = null, checkOut = null, onChange, sameDayCheckout = false,
}) {
    // Subscribed rather than read once: staff can change the closure from the
    // dashboard while this calendar is open, and the cells have to regrey
    // themselves rather than keep offering a date the database now refuses.
    const { days, dates } = useMaintenanceDays()
    const closure = closureLabel(days, dates)

    // Day Time schedule: check-out always happens on the check-in date
    const effectiveCheckOut = sameDayCheckout ? checkIn : checkOut

    function selectCheckIn(date) {
        if (sameDayCheckout) {
            onChange?.({ checkIn: date, checkOut: date })
            return
        }
        // Keep the check-out only if it still describes a legal stay from the
        // new check-in: after it, inside the guardrail, and clear of any
        // maintenance day in between. Moving the check-in past your check-out
        // — or across a closure that now sits inside the range — clears it, so
        // the next click on the right-hand panel reads as the new end of the
        // range.
        const nextCheckOut = checkOut && isSelectableCheckOut(date, checkOut) ? checkOut : null
        onChange?.({ checkIn: date, checkOut: nextCheckOut })
    }

    function selectCheckOut(date) {
        onChange?.({ checkIn, checkOut: date })
    }

    function clearDates() {
        onChange?.({ checkIn: null, checkOut: null })
    }

    return (
        <div className="booking-calendar">
            <div className="cal-panels">
                <CalendarPanel
                    label="Check-in"
                    variant="checkin"
                    selected={checkIn}
                    onSelect={selectCheckIn}
                    rangeStart={checkIn}
                    rangeEnd={effectiveCheckOut}
                />
                {sameDayCheckout ? (
                    <SameDayPanel checkIn={checkIn} />
                ) : (
                    <CalendarPanel
                        label="Check-out"
                        variant="checkout"
                        selected={checkOut}
                        onSelect={selectCheckOut}
                        minDate={checkIn}
                        maxDate={checkIn ? stayLimitAfter(checkIn) : null}
                        rangeStart={checkIn}
                        rangeEnd={checkOut}
                    />
                )}
            </div>

            {/* The range, stated as the guest built it. Two panels can be read
                as two unrelated dates; this is the one line that says they are
                a stay, and how long it is. */}
            {!sameDayCheckout && checkIn && checkOut && (
                <p className="cal-range-summary" aria-live="polite">
                    <strong>{formatDate(checkIn)}</strong> &rarr; <strong>{formatDate(checkOut)}</strong>
                    <span className="cal-range-nights">
                        {countNights(checkIn, checkOut)} night
                        {countNights(checkIn, checkOut) === 1 ? '' : 's'}
                    </span>
                </p>
            )}

            <div className="cal-footer">
                {/* With nothing closed there is no rule to explain, and a
                    sentence about maintenance days would be describing
                    something the calendar is not doing. */}
                <p className="cal-note">
                    Stay as long as you like — pick your check-in, then your
                    check-out.
                    {closure && (
                        <> {closure}, so a stay can&rsquo;t start, end, or run
                        through one — check out before it, or ask us about the
                        dates around it.</>
                    )}
                </p>
                {(checkIn || checkOut) && (
                    <button type="button" className="cal-clear" onClick={clearDates}>
                        Clear dates
                    </button>
                )}
            </div>
        </div>
    )
}
