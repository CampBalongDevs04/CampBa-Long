import { useEffect, useState } from 'react'
import '../css/crud.css'
import '../css/maintenanceDays.css'
import {
    dateKey,
    daysInRange,
    describeClosure,
    formatDateKey,
    isPastDateKey,
    loadMaintenanceDays,
    maintenanceRange,
    MAX_MAINTENANCE_DATES,
    MAX_MAINTENANCE_DAYS,
    normaliseDates,
    normaliseDays,
    parseDateKey,
    saveMaintenanceDays,
    todayKey,
    useMaintenanceDays,
    WEEKDAY_NAMES,
    WEEKDAY_SHORT,
} from '../../data/maintenanceDays.js'

// Maintenance — when the resort closes for turnover.
//
// TWO CLOSURES, NOT ONE CONTROL WITH A MODE
// -----------------------------------------
// The resort closes in two different ways and they are stored, edited and
// explained separately:
//
//   the WEEKLY closure — "Mondays", every week, until staff change it
//   the ONE-OFF dates  — "August 8, 9 and 10", closed once, gone afterwards
//
// Folding them together would have been the smaller change and the wrong one:
// a repaint on the 8th–10th is not a rule about Saturdays, and storing it as
// one would close every Saturday of the year. So they stay two lists, and a
// date is closed when either says so.
//
// THE WEEKLY DAY SET IS THE SINGLE SOURCE OF TRUTH
// ------------------------------------------------
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

// What a click on the calendar means. The grid can express both closures and a
// click cannot mean both at once, so the mode is asked rather than guessed —
// see the comment on MonthCalendar.
const WEEKLY = 'weekly'
const SINGLE = 'single'

function sameList(a, b) {
    return a.length === b.length && a.every((value, index) => value === b[index])
}

// A month of cells, Sunday-first, with the leading blanks the grid needs.
function buildMonthCells(year, month) {
    const cells = []
    for (let i = 0; i < new Date(year, month, 1).getDay(); i += 1) cells.push(null)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day))
    return cells
}

// 'Sat, Aug 8' — and with the year on it once the date is not in this one, so a
// closure booked for next January cannot be misread as one next week.
function chipLabel(key) {
    const date = parseDateKey(key)
    if (!date) return key
    const sameYear = date.getFullYear() === new Date().getFullYear()
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
    })
}

// The calendar, which is both the picture and the control.
//
// It started out as a read-only preview and that was a mistake: a grid of dates
// with some of them shaded is a thing people click, and clicking it did
// nothing. So every cell toggles now.
//
// WHAT CLICKING A DATE MEANS
// --------------------------
// It depends, and that is why the switch above it exists rather than a rule to
// memorise. In WEEKLY mode a click on Wednesday the 12th closes every
// Wednesday — the whole column shades at once, which teaches the rule in one
// gesture. In SINGLE mode the same click closes the 12th and nothing else.
//
// Both readings are things staff genuinely want, they cannot both be the
// default, and a modifier key would be a secret. So the mode is a visible
// control, the tooltip on each cell names exactly what will happen, and the two
// closures are shaded differently — hatched for the weekly pattern, solid for a
// one-off — so the picture says which is which without a legend.
function MonthCalendar({ days, dates, mode, onToggleDow, onToggleDate, atCap, canPickDates }) {
    const today = new Date()
    const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() })

    const step = (offset) => {
        const next = new Date(view.year, view.month + offset, 1)
        setView({ year: next.getFullYear(), month: next.getMonth() })
    }

    const closed = new Set(days)
    const single = new Set(dates)
    const weekly = mode === WEEKLY
    const todayStamp = dateKey(today)

    // Closing the last open weekday would leave no date any guest could arrive
    // on. Only the weekly closure can do that — a one-off date closes one date.
    const lockedOpen = (dow) => weekly && !closed.has(dow) && atCap

    const cellState = (date) => {
        const dow = date.getDay()
        const key = dateKey(date)
        const isWeeklyClosed = closed.has(dow)
        const isSingleClosed = single.has(key)

        if (weekly) {
            return {
                key,
                isWeeklyClosed,
                isSingleClosed,
                disabled: lockedOpen(dow),
                title: lockedOpen(dow)
                    ? 'At least one day has to stay open — otherwise no guest could arrive on any date.'
                    : isWeeklyClosed
                        ? `Closed. Click to reopen every ${WEEKDAY_NAMES[dow]}.`
                        : `Open. Click to close every ${WEEKDAY_NAMES[dow]}.`,
                action: () => onToggleDow(dow),
            }
        }

        // Single-date mode. A date the weekly closure already covers is not
        // editable here: adding it would store a closure that changes nothing,
        // and removing it is not this control's to do.
        if (isWeeklyClosed) {
            return {
                key,
                isWeeklyClosed,
                isSingleClosed,
                disabled: true,
                title: `Already closed — every ${WEEKDAY_NAMES[dow]} is a maintenance day. `
                    + 'Change that in the weekly closure above.',
                action: null,
            }
        }

        // A closure in the past cannot stop a booking that has already been
        // taken, so all it would do is sit in the list.
        if (key < todayStamp) {
            return {
                key,
                isWeeklyClosed,
                isSingleClosed,
                disabled: true,
                title: 'That date has already passed.',
                action: null,
            }
        }

        return {
            key,
            isWeeklyClosed,
            isSingleClosed,
            disabled: !canPickDates,
            title: isSingleClosed
                ? `Closed on ${formatDateKey(key, { long: true })}. Click to reopen it.`
                : `Open. Click to close ${formatDateKey(key, { long: true })} — that date only.`,
            action: () => onToggleDate(key),
        }
    }

    return (
        <div className="mtn-preview">
            <div className="mtn-preview-head">
                <button type="button" className="mtn-preview-nav" onClick={() => step(-1)} aria-label="Previous month">‹</button>
                <span className="mtn-preview-month">{MONTHS[view.month]} {view.year}</span>
                <button type="button" className="mtn-preview-nav" onClick={() => step(1)} aria-label="Next month">›</button>
            </div>

            <div className="mtn-preview-grid">
                {WEEKDAY_SHORT.map((label, dow) => {
                    const isClosed = closed.has(dow)
                    // The heading toggles the WEEKLY closure, which is not what
                    // a click means in single-date mode — so there it stops
                    // being a control and goes back to being a heading.
                    if (!weekly) {
                        return (
                            <span
                                key={label}
                                className={`mtn-preview-weekday${isClosed ? ' is-closed' : ''}`}
                            >
                                {label}
                            </span>
                        )
                    }
                    return (
                        <button
                            key={label}
                            type="button"
                            className={`mtn-preview-weekday${isClosed ? ' is-closed' : ''}`}
                            aria-pressed={isClosed}
                            aria-label={`${WEEKDAY_NAMES[dow]} — ${isClosed ? 'closed' : 'open'}`}
                            disabled={lockedOpen(dow)}
                            title={
                                lockedOpen(dow)
                                    ? 'At least one day has to stay open — otherwise no guest could arrive on any date.'
                                    : `Click to ${isClosed ? 'reopen' : 'close'} every ${WEEKDAY_NAMES[dow]}.`
                            }
                            onClick={() => onToggleDow(dow)}
                        >
                            {label}
                        </button>
                    )
                })}

                {buildMonthCells(view.year, view.month).map((date, index) => {
                    if (!date) return <span key={`blank-${index}`} className="mtn-preview-day is-blank" />
                    const cell = cellState(date)
                    const classes = ['mtn-preview-day']
                    if (cell.isWeeklyClosed) classes.push('is-closed')
                    if (cell.isSingleClosed) classes.push('is-single')
                    if (cell.key === todayStamp) classes.push('is-today')
                    return (
                        <button
                            key={cell.key}
                            type="button"
                            className={classes.join(' ')}
                            disabled={cell.disabled}
                            title={cell.title}
                            aria-label={`${formatDateKey(cell.key, { long: true })} — ${cell.title}`}
                            onClick={() => cell.action?.()}
                        >
                            {date.getDate()}
                        </button>
                    )
                })}
            </div>

            <p className="mtn-legend">
                <span className="mtn-legend-item"><span className="mtn-legend-swatch is-closed" aria-hidden="true" />every week</span>
                <span className="mtn-legend-item"><span className="mtn-legend-swatch is-single" aria-hidden="true" />this date only</span>
            </p>
        </div>
    )
}

export default function MaintenanceDays() {
    const { days: savedDays, dates: savedDates, supportsDates, loaded, error } = useMaintenanceDays()

    // Null means "following whatever is saved". Anything else is an unsaved
    // edit — which is why neither is seeded from the saved value in an effect:
    // the row can arrive late, or change under a realtime event, and a draft
    // seeded once would silently overwrite it on the next save.
    //
    // Two drafts rather than one object, so editing the weekly closure does not
    // pin a stale copy of the dates, or the other way round.
    const [draftDays, setDraftDays] = useState(null)
    const [draftDates, setDraftDates] = useState(null)
    const [mode, setMode] = useState(WEEKLY)
    const [pending, setPending] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState('')
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        loadMaintenanceDays()
    }, [])

    const days = draftDays ?? savedDays
    const dates = draftDates ?? savedDates
    const range = maintenanceRange(days)
    const dirty = (draftDays != null && !sameList(draftDays, savedDays))
        || (draftDates != null && !sameList(draftDates, savedDates))

    const upcoming = dates.filter((key) => !isPastDateKey(key))
    const past = dates.filter((key) => isPastDateKey(key))

    const touched = () => {
        setSaved(false)
        setSaveError('')
    }

    // Every edit is a FUNCTION of the current value rather than a value computed
    // during render. Two clicks landing in one batch would otherwise both read
    // the same stale set and the second would silently undo the first —
    // toggling four days quickly leaves two.
    const edit = (transform) => {
        touched()
        setDraftDays((previous) => normaliseDays(transform(previous ?? savedDays)))
    }

    const editDates = (transform) => {
        touched()
        setDraftDates((previous) => normaliseDates(transform(previous ?? savedDates)))
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

    const toggleDate = (key) => editDates((current) => {
        if (current.includes(key)) return current.filter((value) => value !== key)
        if (current.length >= MAX_MAINTENANCE_DATES) return current
        return [...current, key]
    })

    const removeDate = (key) => editDates((current) => current.filter((value) => value !== key))

    const clearPast = () => editDates((current) => current.filter((key) => !isPastDateKey(key)))

    // The typed date, for a closure months out that would take a lot of
    // clicking through months to reach. Adds rather than toggles: typing a date
    // that is already closed and watching it disappear would read as a bug.
    const addPending = () => {
        const key = dateKey(pending)
        if (!key) return
        setPending('')
        editDates((current) => (
            current.includes(key) || current.length >= MAX_MAINTENANCE_DATES
                ? current
                : [...current, key]
        ))
    }

    const handleSave = async () => {
        if (saving || !dirty) return
        setSaving(true)
        setSaveError('')
        const result = await saveMaintenanceDays(days, dates)
        setSaving(false)
        if (!result.ok) {
            setSaveError(result.message)
            return
        }
        // Back to following the saved value — loadMaintenanceDays() has already
        // refreshed it, so dropping the drafts shows what the database now holds
        // rather than what was typed at it.
        setDraftDays(null)
        setDraftDates(null)
        setSaved(true)
    }

    const discard = () => {
        setDraftDays(null)
        setDraftDates(null)
        setSaveError('')
        setSaved(false)
    }

    return (
        <div className="mtn-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Maintenance Days</h3>
                    <p className="crud-bar-note">
                        When the resort closes for turnover and cleaning — every week, and on
                        single dates. No stay may start or finish on a closed day; a longer
                        stay runs straight through.
                    </p>
                </div>
                <div className="crud-row-actions">
                    <button
                        type="button"
                        className="crud-btn"
                        disabled={!dirty || saving}
                        onClick={discard}
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
            {loaded && !supportsDates && (
                <p className="crud-message is-error">
                    Single dates are unavailable on this database — the
                    20260810120000_maintenance_dates migration has not been applied to it
                    yet. The weekly closure below still works.
                </p>
            )}
            {saved && !dirty && (
                <p className="crud-message is-success">
                    Saved. The booking calendar is already using it — anyone with the page open
                    sees the change without reloading.
                </p>
            )}

            <div className="mtn-live">
                <span className="mtn-live-label">On the site now</span>
                <strong className="mtn-live-value">{describeClosure(savedDays, savedDates)}</strong>
                {dirty && (
                    <span className="mtn-live-pending">
                        unsaved: <strong>{describeClosure(days, dates)}</strong>
                    </span>
                )}
            </div>

            <section className="mtn-section">
                <h4 className="mtn-section-title">Every week — closed from / to</h4>
                <p className="mtn-section-note">
                    A run of days, repeating every week. It may wrap past the weekend:
                    Saturday to Monday closes Saturday, Sunday and Monday. Pick the same day
                    twice to close just the one.
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
                <h4 className="mtn-section-title">Or pick the weekdays</h4>
                <p className="mtn-section-note">
                    For a weekly closure that skips a day — Monday and Thursday, say. Editing
                    here and editing the range above change the same thing.
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
                        Nothing is closed weekly. Guests may check in and out on any day of the
                        week, except on the single dates below.
                    </p>
                )}
            </section>

            <section className="mtn-section">
                <h4 className="mtn-section-title">Single dates</h4>
                <p className="mtn-section-note">
                    Closures that happen once — August 8, 9 and 10 for a repaint, a fiesta, a
                    private event. These do not repeat: once the date has passed it stops
                    affecting anything, and it can be removed. Pick them on the calendar
                    below, or type one here.
                </p>

                <div className="mtn-datepick">
                    <label className="mtn-range-field">
                        <span>Add a date</span>
                        <input
                            type="date"
                            value={pending}
                            min={todayKey()}
                            disabled={!supportsDates}
                            onChange={(event) => setPending(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault()
                                    addPending()
                                }
                            }}
                        />
                    </label>
                    <button
                        type="button"
                        className="crud-btn"
                        disabled={!supportsDates || !dateKey(pending)}
                        onClick={addPending}
                    >
                        Add date
                    </button>
                </div>

                {upcoming.length > 0 ? (
                    <div className="mtn-chips mtn-date-chips" role="group" aria-label="Single maintenance dates">
                        {upcoming.map((key) => (
                            <button
                                key={key}
                                type="button"
                                className="mtn-chip is-on mtn-date-chip"
                                title={`Closed on ${formatDateKey(key, { long: true })}. Click to remove it.`}
                                onClick={() => removeDate(key)}
                            >
                                <span className="mtn-chip-short">{chipLabel(key)}</span>
                                <span className="mtn-date-chip-x" aria-hidden="true">×</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="mtn-section-note mtn-custom-note">
                        No single dates are closed. Only the weekly closure applies.
                    </p>
                )}

                {past.length > 0 && (
                    <p className="mtn-section-note mtn-custom-note">
                        {past.length} date{past.length === 1 ? ' has' : 's have'} already
                        passed and {past.length === 1 ? 'is' : 'are'} no longer stopping
                        anything.{' '}
                        <button type="button" className="mtn-linkbtn" onClick={clearPast}>
                            Remove {past.length === 1 ? 'it' : 'them'}
                        </button>
                    </p>
                )}
            </section>

            <section className="mtn-section">
                <h4 className="mtn-section-title">The calendar</h4>

                <div className="mtn-mode" role="group" aria-label="What clicking a date does">
                    <button
                        type="button"
                        className={`mtn-mode-btn${mode === WEEKLY ? ' is-on' : ''}`}
                        aria-pressed={mode === WEEKLY}
                        onClick={() => setMode(WEEKLY)}
                    >
                        Close every week
                    </button>
                    <button
                        type="button"
                        className={`mtn-mode-btn${mode === SINGLE ? ' is-on' : ''}`}
                        aria-pressed={mode === SINGLE}
                        disabled={!supportsDates}
                        onClick={() => setMode(SINGLE)}
                    >
                        Close single dates
                    </button>
                </div>

                <p className="mtn-section-note">
                    {!loaded
                        ? 'Loading the maintenance days…'
                        : mode === WEEKLY
                            ? 'Click any date — or a column heading — to close that WEEKDAY. '
                              + 'Because this closure is weekly, clicking one Wednesday closes '
                              + 'every Wednesday, and the whole column shades at once.'
                            : 'Click a date to close THAT DATE only — August 8, then 9, then '
                              + '10. Nothing else in the month changes. Click it again to '
                              + 'reopen it.'}
                    {' '}Shaded dates are what the booking calendar greys out. Guests can still
                    stay through a closed day; they just cannot arrive or leave on one.
                </p>

                <MonthCalendar
                    days={days}
                    dates={dates}
                    mode={mode}
                    onToggleDow={toggle}
                    onToggleDate={toggleDate}
                    atCap={days.length >= MAX_MAINTENANCE_DAYS}
                    canPickDates={supportsDates}
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
