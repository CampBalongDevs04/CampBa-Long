import { useState } from 'react'
import '../css/calendar.css'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]

function startOfDay(date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
}

function isSameDay(a, b) {
    return Boolean(a && b) && startOfDay(a).getTime() === startOfDay(b).getTime()
}

function isBetween(day, start, end) {
    if (!start || !end) return false
    const time = startOfDay(day).getTime()
    return time > startOfDay(start).getTime() && time < startOfDay(end).getTime()
}

function buildMonthCells(year, month) {
    const leadingBlanks = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < leadingBlanks; i++) cells.push(null)
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day))
    return cells
}

export function formatRangeLabel(start, end) {
    if (!start) return 'No dates selected'
    const opts = { month: 'short', day: 'numeric', year: 'numeric' }
    if (!end) return `${start.toLocaleDateString(undefined, opts)} — pick an end date`
    return `${start.toLocaleDateString(undefined, opts)} — ${end.toLocaleDateString(undefined, opts)}`
}

export default function Calendar({ startDate = null, endDate = null, onRangeChange }) {
    const today = startOfDay(new Date())
    const [viewYear, setViewYear] = useState(today.getFullYear())
    const [viewMonth, setViewMonth] = useState(today.getMonth())

    const cells = buildMonthCells(viewYear, viewMonth)

    const goToMonth = (offset) => {
        const next = new Date(viewYear, viewMonth + offset, 1)
        setViewYear(next.getFullYear())
        setViewMonth(next.getMonth())
    }

    const handleDayClick = (day) => {
        if (!onRangeChange) return
        if (!startDate || (startDate && endDate)) {
            onRangeChange({ start: day, end: null })
        } else if (day < startDate) {
            onRangeChange({ start: day, end: startDate })
        } else {
            onRangeChange({ start: startDate, end: day })
        }
    }

    return (
        <div className="excal">
            <div className="excal-header">
                <button
                    type="button"
                    className="excal-nav-btn"
                    aria-label="Previous month"
                    onClick={() => goToMonth(-1)}
                >
                    ‹
                </button>
                <span className="excal-month-label">
                    {MONTHS[viewMonth]} {viewYear}
                </span>
                <button
                    type="button"
                    className="excal-nav-btn"
                    aria-label="Next month"
                    onClick={() => goToMonth(1)}
                >
                    ›
                </button>
            </div>

            <div className="excal-grid">
                {WEEKDAYS.map((weekday) => (
                    <span key={weekday} className="excal-weekday">{weekday}</span>
                ))}
                {cells.map((day, index) => {
                    if (!day) {
                        return <span key={`blank-${index}`} className="excal-day excal-day-blank" />
                    }
                    const isStart = isSameDay(day, startDate)
                    const isEnd = isSameDay(day, endDate)
                    const classes = ['excal-day']
                    if (isStart || isEnd) classes.push('excal-day-selected')
                    if (isBetween(day, startDate, endDate)) classes.push('excal-day-in-range')
                    if (isSameDay(day, today)) classes.push('excal-day-today')
                    return (
                        <button
                            key={day.getTime()}
                            type="button"
                            className={classes.join(' ')}
                            onClick={() => handleDayClick(day)}
                        >
                            {day.getDate()}
                        </button>
                    )
                })}
            </div>

            <p className="excal-range-label">{formatRangeLabel(startDate, endDate)}</p>
        </div>
    )
}
