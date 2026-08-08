import { useEffect, useState } from 'react'
import '../css/crud.css'
import '../css/maintenanceDays.css'
import {
    daysInRange,
    describeMaintenanceDays,
    loadMaintenanceDays,
    maintenanceRange,
    MAX_MAINTENANCE_DAYS,
    normaliseDays,
    saveMaintenanceDays,
    useMaintenanceDays,
    WEEKDAY_NAMES,
    WEEKDAY_SHORT,
} from '../../data/maintenanceDays.js'

// Maintenance — which weekdays the resort closes for turnover.
//
// THE DAY SET IS THE SINGLE SOURCE OF TRUTH
// -----------------------------------------
// One list of weekdays, edited three ways, all writing that same list:
//
//   the From/To selects — the control the resort asked for, "Monday to Tuesday"
//   the chips           — one day at a time, for a closure with a gap in it
//   the calendar        — click a date or a column heading to toggle its weekday
//
// None of the three stores anything of its own, so they cannot disagree: change
// the closure anywhere and all three redraw from the one list.
//
// Storing a start and an end instead would have been the literal reading of the
// request and a worse answer: a scattered closure could not be expressed at
// all, and the two controls would each need their own copy of the truth. With
// one set, the selects simply read "Custom" when the days do not form a range,
// which is honest about what is stored.
//
// The week is a circle, so Saturday → Monday is a real range and daysInRange()
// wraps for it.

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]

function sameDays(a, b) {
    return a.length === b.length && a.every((dow, index) => dow === b[index])
}

// A month of cells, Sunday-first, with the leading blanks the grid needs.
function buildMonthCells(year, month) {
    const cells = []
    for (let i = 0; i < new Date(year, month, 1).getDay(); i += 1) cells.push(null)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day))
    return cells
}

// The calendar, which is both the picture and the control.
//
// It started out as a read-only preview and that was a mistake: a grid of dates
// with some of them shaded is a thing people click, and clicking it did
// nothing. So every cell toggles now.
//
// WHAT CLICKING A DATE MEANS
// --------------------------
// The setting is WEEKLY — "Mondays", not "the 10th of August" — so clicking
// Wednesday the 12th closes every Wednesday, not that one date. That could
// mislead, so it is made obvious rather than hidden: the tooltip on each cell
// names the weekday it will close, and every matching date in the month shades
// at once the moment it is clicked, which teaches the rule in one gesture.
//
// One-off closures ("shut on the 12th for a wedding") are a different feature
// and are deliberately not implied here.
function MonthCalendar({ days, onToggle, atCap }) {
    const today = new Date()
    const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() })

    const step = (offset) => {
        const next = new Date(view.year, view.month + offset, 1)
        setView({ year: next.getFullYear(), month: next.getMonth() })
    }

    const closed = new Set(days)
    const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

    // Closing the last open day would leave no date any guest could arrive on.
    const lockedOpen = (dow) => !closed.has(dow) && atCap
    const cellTitle = (dow) => {
        if (lockedOpen(dow)) return 'At least one day has to stay open — otherwise no guest could arrive on any date.'
        return closed.has(dow)
            ? `Closed. Click to reopen every ${WEEKDAY_NAMES[dow]}.`
            : `Open. Click to close every ${WEEKDAY_NAMES[dow]}.`
    }

    return (
        <div className="mtn-preview">
            <div className="mtn-preview-head">
                <button type="button" className="mtn-preview-nav" onClick={() => step(-1)} aria-label="Previous month">‹</button>
                <span className="mtn-preview-month">{MONTHS[view.month]} {view.year}</span>
                <button type="button" className="mtn-preview-nav" onClick={() => step(1)} aria-label="Next month">›</button>
            </div>

            <div className="mtn-preview-grid">
                {WEEKDAY_SHORT.map((label, dow) => (
                    <button
                        key={label}
                        type="button"
                        className={`mtn-preview-weekday${closed.has(dow) ? ' is-closed' : ''}`}
                        aria-pressed={closed.has(dow)}
                        aria-label={`${WEEKDAY_NAMES[dow]} — ${closed.has(dow) ? 'closed' : 'open'}`}
                        disabled={lockedOpen(dow)}
                        title={cellTitle(dow)}
                        onClick={() => onToggle(dow)}
                    >
                        {label}
                    </button>
                ))}

                {buildMonthCells(view.year, view.month).map((date, index) => {
                    if (!date) return <span key={`blank-${index}`} className="mtn-preview-day is-blank" />
                    const dow = date.getDay()
                    const classes = ['mtn-preview-day']
                    if (closed.has(dow)) classes.push('is-closed')
                    if (date.getTime() === todayKey) classes.push('is-today')
                    return (
                        <button
                            key={date.getTime()}
                            type="button"
                            className={classes.join(' ')}
                            disabled={lockedOpen(dow)}
                            title={cellTitle(dow)}
                            aria-label={
                                `${WEEKDAY_NAMES[dow]} ${MONTHS[view.month]} ${date.getDate()} — `
                                + `${closed.has(dow) ? 'closed' : 'open'}. Toggles every ${WEEKDAY_NAMES[dow]}.`
                            }
                            onClick={() => onToggle(dow)}
                        >
                            {date.getDate()}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export default function MaintenanceDays() {
    const { days: savedDays, loaded, error } = useMaintenanceDays()

    // Null means "following whatever is saved". Anything else is an unsaved
    // edit — which is why this is not seeded from savedDays in an effect: the
    // row can arrive late, or change under a realtime event, and a draft
    // seeded once would silently overwrite it on the next save.
    const [draft, setDraft] = useState(null)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState('')
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        loadMaintenanceDays()
    }, [])

    const days = draft ?? savedDays
    const range = maintenanceRange(days)
    const dirty = draft != null && !sameDays(draft, savedDays)

    // Every edit is a FUNCTION of the current days rather than a value computed
    // during render. Two clicks landing in one batch would otherwise both read
    // the same stale set and the second would silently undo the first —
    // toggling four days quickly leaves two.
    const edit = (transform) => {
        setSaved(false)
        setSaveError('')
        setDraft((previous) => normaliseDays(transform(previous ?? savedDays)))
    }

    // Changing either end rebuilds the whole range. When the days are not a
    // range to begin with ("Custom"), the missing end is taken from the day
    // just picked — which collapses to that single day, and reads as choosing
    // to go back to a range.
    const setFrom = (dow) => edit((current) => {
        const currentRange = maintenanceRange(current)
        return daysInRange(dow, currentRange ? currentRange.end : dow)
    })

    const setTo = (dow) => edit((current) => {
        const currentRange = maintenanceRange(current)
        return daysInRange(currentRange ? currentRange.start : dow, dow)
    })

    const toggle = (dow) => edit((current) => {
        if (current.includes(dow)) return current.filter((d) => d !== dow)
        // The controls are disabled at the cap, but a burst of clicks could
        // still arrive faster than they redraw — so the rule is enforced where
        // the change is made, not only where it is offered.
        if (current.length >= MAX_MAINTENANCE_DAYS) return current
        return [...current, dow]
    })

    const handleSave = async () => {
        if (saving || !dirty) return
        setSaving(true)
        setSaveError('')
        const result = await saveMaintenanceDays(days)
        setSaving(false)
        if (!result.ok) {
            setSaveError(result.message)
            return
        }
        // Back to following the saved value — loadMaintenanceDays() has already
        // refreshed it, so dropping the draft shows what the database now holds
        // rather than what was typed at it.
        setDraft(null)
        setSaved(true)
    }

    return (
        <div className="mtn-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Maintenance Days</h3>
                    <p className="crud-bar-note">
                        The weekdays the resort closes for turnover and cleaning. No stay may
                        start or finish on one — a longer stay runs straight through.
                    </p>
                </div>
                <div className="crud-row-actions">
                    <button
                        type="button"
                        className="crud-btn"
                        disabled={!dirty || saving}
                        onClick={() => { setDraft(null); setSaveError(''); setSaved(false) }}
                    >
                        Discard changes
                    </button>
                    <button
                        type="button"
                        className="crud-btn is-primary"
                        disabled={!dirty || saving}
                        onClick={handleSave}
                    >
                        {saving ? 'Saving…' : 'Save maintenance days'}
                    </button>
                </div>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}
            {saveError && <p className="crud-message is-error">{saveError}</p>}
            {saved && !dirty && (
                <p className="crud-message is-success">
                    Saved. The booking calendar is already using it — anyone with the page open
                    sees the change without reloading.
                </p>
            )}

            <div className="mtn-live">
                <span className="mtn-live-label">On the site now</span>
                <strong className="mtn-live-value">{describeMaintenanceDays(savedDays)}</strong>
                {dirty && (
                    <span className="mtn-live-pending">
                        unsaved: <strong>{describeMaintenanceDays(days)}</strong>
                    </span>
                )}
            </div>

            <section className="mtn-section">
                <h4 className="mtn-section-title">Closed from — to</h4>
                <p className="mtn-section-note">
                    A run of days. It may wrap past the weekend: Saturday to Monday closes
                    Saturday, Sunday and Monday. Pick the same day twice to close just the one.
                </p>

                <div className="mtn-range">
                    <label className="mtn-range-field">
                        <span>From</span>
                        <select
                            value={range ? String(range.start) : ''}
                            onChange={(event) => setFrom(Number(event.target.value))}
                        >
                            {!range && <option value="">Custom</option>}
                            {WEEKDAY_NAMES.map((name, dow) => (
                                <option key={name} value={dow}>{name}</option>
                            ))}
                        </select>
                    </label>

                    <span className="mtn-range-arrow" aria-hidden="true">→</span>

                    <label className="mtn-range-field">
                        <span>To</span>
                        <select
                            value={range ? String(range.end) : ''}
                            onChange={(event) => setTo(Number(event.target.value))}
                        >
                            {!range && <option value="">Custom</option>}
                            {WEEKDAY_NAMES.map((name, dow) => (
                                <option key={name} value={dow}>{name}</option>
                            ))}
                        </select>
                    </label>
                </div>

                {!range && days.length > 0 && (
                    <p className="mtn-section-note mtn-custom-note">
                        These days are not one unbroken run, so there is no range to show.
                        Picking either end above replaces them with a range.
                    </p>
                )}
            </section>

            <section className="mtn-section">
                <h4 className="mtn-section-title">Or pick the days</h4>
                <p className="mtn-section-note">
                    For a closure that skips a day — Monday and Thursday, say. Editing here and
                    editing the range above change the same thing.
                </p>

                <div className="mtn-chips" role="group" aria-label="Maintenance days">
                    {WEEKDAY_NAMES.map((name, dow) => {
                        const on = days.includes(dow)
                        // Closing all seven leaves no date any guest could
                        // arrive on, so the last open day cannot be taken. The
                        // database refuses it too; this just means nobody has
                        // to discover that by having a save rejected.
                        const wouldCloseTheWeek = !on && days.length >= MAX_MAINTENANCE_DAYS
                        return (
                            <button
                                key={name}
                                type="button"
                                className={`mtn-chip${on ? ' is-on' : ''}`}
                                aria-pressed={on}
                                disabled={wouldCloseTheWeek}
                                title={
                                    wouldCloseTheWeek
                                        ? 'At least one day has to stay open — otherwise no guest could arrive on any date.'
                                        : undefined
                                }
                                onClick={() => toggle(dow)}
                            >
                                <span className="mtn-chip-short">{WEEKDAY_SHORT[dow]}</span>
                                <span className="mtn-chip-full">{name}</span>
                            </button>
                        )
                    })}
                </div>

                {days.length === 0 && (
                    <p className="mtn-section-note mtn-custom-note">
                        Nothing is closed. Guests may check in and out on any day of the week.
                    </p>
                )}
            </section>

            <section className="mtn-section">
                <h4 className="mtn-section-title">The calendar</h4>
                <p className="mtn-section-note">
                    {loaded
                        ? 'Click any date — or a column heading — to close that weekday. Shaded '
                          + 'dates are what the booking calendar greys out. Because the closure is '
                          + 'weekly, clicking one Wednesday closes every Wednesday. Guests can still '
                          + 'stay through a closed day; they just cannot arrive or leave on one.'
                        : 'Loading the maintenance days…'}
                </p>
                <MonthCalendar
                    days={days}
                    onToggle={toggle}
                    atCap={days.length >= MAX_MAINTENANCE_DAYS}
                />
            </section>

            <p className="mtn-footnote">
                Bookings already taken keep their dates. Changing the closure decides what
                guests can book from now on; it does not cancel or move a stay that is
                already on the books.
            </p>
        </div>
    )
}
