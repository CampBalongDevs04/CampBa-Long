import { useMemo, useState } from 'react'
import '../css/export.css'
import Calendar from './calendar.jsx'
import { useAccommodationDB, useBookingGroups } from '../../data/accommodationDB.js'
import {
    RANGE_PRESETS,
    resolveRange,
    customRange,
    mergeReservations,
    selectReservations,
    previewTotals,
    exportBookingReport,
    reportFilename,
} from './bookingReport.js'

// The Export section writes the resort's own Check-in-out spreadsheet from the
// live database — see bookingReport.js for the column layout it reproduces.
//
// Every button here says how many reservations it is about to write before it
// writes them. An export is one of the few actions on this dashboard with no
// visible result inside the app: the file lands in Downloads and is opened
// somewhere else, so "0 rows" has to be answerable on this page, not in Excel.

function peso(amount) {
    return `₱${Number(amount || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`
}

function countLabel(count) {
    if (count === 0) return 'No bookings'
    return `${count} booking${count === 1 ? '' : 's'}`
}

export default function Export() {
    const bookings = useAccommodationDB()
    const groups = useBookingGroups()
    const [range, setRange] = useState({ start: null, end: null })
    // Which button is mid-download, so it can say so and not be pressed twice.
    const [busy, setBusy] = useState(null)
    const [failed, setFailed] = useState('')

    const reservations = useMemo(() => mergeReservations(bookings, groups), [bookings, groups])

    // Resolved once per render pass rather than per button, so all four tiles
    // and the download they trigger agree on where "today" is.
    const presets = useMemo(() => {
        const now = new Date()
        return RANGE_PRESETS.map((preset) => {
            const resolved = resolveRange(preset.id, now)
            const rows = selectReservations(reservations, resolved.start, resolved.end)
            return { ...preset, range: resolved, rows, totals: previewTotals(rows) }
        })
    }, [reservations])

    const picked = useMemo(() => {
        const resolved = customRange(range.start, range.end)
        if (!resolved) return null
        const rows = selectReservations(reservations, resolved.start, resolved.end)
        return { range: resolved, rows, totals: previewTotals(rows) }
    }, [range, reservations])

    const download = async (key, target) => {
        if (busy) return
        setBusy(key)
        setFailed('')
        try {
            await exportBookingReport({ range: target.range, reservations: target.rows })
        } catch (error) {
            // A failed export is silent otherwise — no file appears and the
            // page looks unchanged, which reads as a dead button.
            console.error('Booking report export failed', error)
            setFailed('The report could not be generated. Please try again.')
        } finally {
            setBusy(null)
        }
    }

    return (
        <>
            <div className="export-card">
                <div className="export-card-copy">
                    <h3 className="export-card-title">Export Booking History</h3>
                    <p className="export-card-description">
                        Downloads the Check-in-out sheet as an Excel workbook — guest, date,
                        accommodation, time, payments and status — for a whole day, week, month or
                        year.
                    </p>
                </div>
                <div className="export-preset-grid">
                    {presets.map((preset) => (
                        <button
                            key={preset.id}
                            type="button"
                            className={
                                preset.rows.length === 0
                                    ? 'export-preset is-empty'
                                    : 'export-preset'
                            }
                            disabled={busy != null}
                            onClick={() => download(preset.id, preset)}
                        >
                            <span className="export-preset-label">{preset.label}</span>
                            <span className="export-preset-period">{preset.range.label}</span>
                            <span className="export-preset-count">
                                {busy === preset.id ? 'Preparing…' : countLabel(preset.rows.length)}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="export-card export-card-calendar">
                <div className="export-card-copy">
                    <h3 className="export-card-title">Export Custom Range</h3>
                    <p className="export-card-description">
                        Pick a start and end date on the calendar, then download the same sheet for
                        that exact range.
                    </p>

                    {picked && (
                        <dl className="export-summary">
                            <div className="export-summary-item">
                                <dt>Bookings</dt>
                                <dd>{picked.rows.length}</dd>
                            </div>
                            <div className="export-summary-item">
                                <dt>Collected</dt>
                                <dd>{peso(picked.totals.collected)}</dd>
                            </div>
                            <div className="export-summary-item">
                                <dt>Outstanding</dt>
                                <dd>{peso(picked.totals.due - picked.totals.collected)}</dd>
                            </div>
                        </dl>
                    )}

                    <button
                        type="button"
                        className="export-btn export-range-btn"
                        disabled={!picked || busy != null}
                        onClick={() => download('custom', picked)}
                    >
                        {busy === 'custom' ? 'Preparing…' : 'Export Range'}
                    </button>

                    {picked && (
                        <p className="export-filename">
                            Saves as <code>{reportFilename(picked.range)}</code>
                        </p>
                    )}
                </div>
                <Calendar
                    startDate={range.start}
                    endDate={range.end}
                    onRangeChange={({ start, end }) => setRange({ start, end })}
                />
            </div>

            {failed && (
                <p className="export-error" role="alert">
                    {failed}
                </p>
            )}
        </>
    )
}
