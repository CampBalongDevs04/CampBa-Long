import { useState } from 'react'
import './css/bookingCalendar.css'
import { addDays, countNights, MAX_STAY_NIGHTS } from '../../data/extendedStay.js'

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

// The first date past the end of the longest bookable stay. This is a
// guardrail, not a product rule — a stay is as long as the guest wants one to
// be, a week included — so it sits a generous month out. Maintenance Mondays
// bound the ENDS of a stay rather than its length: they stay unselectable in
// both panels while remaining highlighted inside a range the stay runs through.
function stayLimitAfter(date) {
    return addDays(date, MAX_STAY_NIGHTS + 1)
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
        const isMonday = date.getDay() === 1
        const isBeforeMin = minDate && date.getTime() <= minDate.getTime()
        const isPastMax = maxDate && date.getTime() >= maxDate.getTime()
        const isDisabled = isPast || isMonday || isBeforeMin || isPastMax
        const isSelected = isSameDay(date, selected)
        const isInRange = rangeStart && rangeEnd &&
            date.getTime() > rangeStart.getTime() && date.getTime() < rangeEnd.getTime()

        const classNames = ['cal-cell', 'cal-day']
        if (isMonday) classNames.push('cal-maintenance')
        if (isDisabled) classNames.push('cal-disabled')
        if (isSelected) classNames.push('cal-selected')
        if (isInRange) classNames.push('cal-in-range')
        if (isSameDay(date, today)) classNames.push('cal-today')

        cells.push(
            <button
                key={day}
                type="button"
                className={classNames.join(' ')}
                disabled={isDisabled && !isMonday}
                aria-disabled={isDisabled}
                onClick={() => { if (!isDisabled) onSelect(date) }}
                data-hint={isMonday ? 'Mondays are maintenance day' : undefined}
                aria-label={
                    isMonday
                        ? `${formatDate(date)} — unavailable, Mondays are maintenance day`
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
export default function BookingCalendar({ checkIn = null, checkOut = null, onChange, sameDayCheckout = false }) {
    // Day Time schedule: check-out always happens on the check-in date
    const effectiveCheckOut = sameDayCheckout ? checkIn : checkOut

    function selectCheckIn(date) {
        if (sameDayCheckout) {
            onChange?.({ checkIn: date, checkOut: date })
            return
        }
        // Keep the check-out only if it still describes a stay from the new
        // check-in: after it, and inside the guardrail. Moving the check-in
        // forward past your check-out clears it, so the next click on the
        // right-hand panel reads as the new end of the range.
        const nights = checkOut ? countNights(date, checkOut) : 0
        const nextCheckOut = nights >= 1 && nights <= MAX_STAY_NIGHTS ? checkOut : null
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
                <p className="cal-note">
                    Stay as long as you like — pick your check-in, then your
                    check-out. Mondays are maintenance day, so a stay can&rsquo;t
                    start or end on one, but a longer stay runs straight through.
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
