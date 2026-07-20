import { useState } from 'react'
import './css/bookingCalendar.css'

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

// First Monday strictly after the given date — no stay may reach it,
// since the resort is closed every Monday for maintenance.
function nextMondayAfter(date) {
    const d = startOfDay(date)
    const daysUntilMonday = ((8 - d.getDay()) % 7) || 7
    d.setDate(d.getDate() + daysUntilMonday)
    return d
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

export default function BookingCalendar({ onChange, sameDayCheckout = false }) {
    const [checkIn, setCheckIn] = useState(null)
    const [checkOut, setCheckOut] = useState(null)

    // Day Time schedule: check-out always happens on the check-in date
    const effectiveCheckOut = sameDayCheckout ? checkIn : checkOut

    function selectCheckIn(date) {
        setCheckIn(date)
        if (sameDayCheckout) {
            onChange?.({ checkIn: date, checkOut: date })
            return
        }
        // a check-out on or before the new check-in, or one that would
        // cross the next Monday (maintenance day), no longer makes sense
        const mondayLimit = nextMondayAfter(date)
        const nextCheckOut =
            checkOut &&
            (date.getTime() >= checkOut.getTime() ||
                checkOut.getTime() >= mondayLimit.getTime())
                ? null
                : checkOut
        setCheckOut(nextCheckOut)
        onChange?.({ checkIn: date, checkOut: nextCheckOut })
    }

    function selectCheckOut(date) {
        setCheckOut(date)
        onChange?.({ checkIn, checkOut: date })
    }

    function clearDates() {
        setCheckIn(null)
        setCheckOut(null)
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
                        maxDate={checkIn ? nextMondayAfter(checkIn) : null}
                        rangeStart={checkIn}
                        rangeEnd={checkOut}
                    />
                )}
            </div>

            <div className="cal-footer">
                <p className="cal-note">
                    Mondays are unavailable — maintenance day.
                    Sunday check-ins are Day Time only.
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
