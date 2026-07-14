import { useState } from 'react'
import '../css/export.css'
import Calendar, { formatRangeLabel } from './calendar.jsx'

const documentExport = [
    {
        title: "Export Booking History",
        description: "Download Excel-compatible reports for today, this week, this, month, or this year.",
        day: "Day",
        week: "Week",
        month: "Month",
        year: "Year"
    }
]

const RANGE_KEYS = ['day', 'week', 'month', 'year']

function getRangeStart(range) {
    const now = new Date()
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)

    if (range === 'week') {
        start.setDate(start.getDate() - start.getDay())
    } else if (range === 'month') {
        start.setDate(1)
    } else if (range === 'year') {
        start.setMonth(0, 1)
    }
    return start
}

function endOfDay(date) {
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)
    return end
}

function escapeCsv(value) {
    const text = String(value ?? '')
    if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`
    }
    return text
}

function buildCsv(periodLabel, start, end, bookings) {
    const rows = bookings.filter((booking) => {
        const date = new Date(booking.date ?? booking.checkIn)
        return !Number.isNaN(date.getTime()) && date >= start && date <= end
    })

    const totalRevenue = rows.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)

    const lines = [
        ['Camp Ba-long — Booking History Report'],
        ['Period', periodLabel],
        ['From', start.toLocaleDateString()],
        ['To', end.toLocaleDateString()],
        ['Generated', new Date().toLocaleString()],
        [],
        ['Guest', 'Unit', 'Check-in', 'Check-out', 'Status', 'Amount'],
        ...rows.map((b) => [b.guest, b.unit, b.checkIn, b.checkOut, b.status, b.amount]),
        [],
        ['Total Bookings', rows.length],
        ['Total Revenue', totalRevenue],
    ]

    return lines.map((line) => line.map(escapeCsv).join(',')).join('\r\n')
}

function downloadCsv(periodLabel, start, end, bookings, fileTag) {
    const csv = buildCsv(periodLabel, start, end, bookings)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `campbalong-report-${fileTag}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

function exportPreset(range, bookings) {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`This ${range}`, getRangeStart(range), new Date(), bookings, `${range}-${stamp}`)
}

function dateTag(date) {
    return date.toISOString().slice(0, 10)
}

export default function Export({ bookings = [] }) {
    const [range, setRange] = useState({ start: null, end: null })

    const exportCustomRange = () => {
        if (!range.start || !range.end) return
        downloadCsv(
            formatRangeLabel(range.start, range.end),
            range.start,
            endOfDay(range.end),
            bookings,
            `${dateTag(range.start)}-to-${dateTag(range.end)}`
        )
    }

    return (
        <>
            {documentExport.map((doc) => (
                <div className="export-card" key={doc.title}>
                    <div className="export-card-copy">
                        <h3 className="export-card-title">{doc.title}</h3>
                        <p className="export-card-description">{doc.description}</p>
                    </div>
                    <div className="export-card-buttons">
                        {RANGE_KEYS.map((rangeKey) => (
                            <button
                                key={rangeKey}
                                type="button"
                                className="export-btn"
                                onClick={() => exportPreset(rangeKey, bookings)}
                            >
                                {doc[rangeKey]}
                            </button>
                        ))}
                    </div>
                </div>
            ))}

            <div className="export-card export-card-calendar">
                <div className="export-card-copy">
                    <h3 className="export-card-title">Export Custom Range</h3>
                    <p className="export-card-description">
                        Pick a start and end date on the calendar, then download the report for that exact range.
                    </p>
                    <button
                        type="button"
                        className="export-btn export-range-btn"
                        disabled={!range.start || !range.end}
                        onClick={exportCustomRange}
                    >
                        Export Range
                    </button>
                </div>
                <Calendar
                    startDate={range.start}
                    endDate={range.end}
                    onRangeChange={({ start, end }) => setRange({ start, end })}
                />
            </div>
        </>
    )
}
