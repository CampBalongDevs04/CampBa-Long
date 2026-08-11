// ============================================================================
//  Booking report — the resort's own Check-in-out sheet, generated
// ----------------------------------------------------------------------------
//  The resort already keeps its bookings in an Excel workbook whose
//  "Check-in-out" sheet has nine columns (Booking.xlsx). This module writes
//  that same sheet from the live database so nobody has to retype it.
//
//  The column list, widths, the mm/dd/yyyy dates and the PAID / WITH BALANCE
//  colouring below are copied from that file deliberately — a report staff
//  can drop straight into the workbook they already use is worth far more
//  than a prettier one they have to reformat. What is added on top is a
//  header block naming the period, and a totals band at the bottom.
//
//  WHICH RESERVATIONS APPEAR
//  A combined reservation is ONE row, listed under its rollup label
//  ("Teepee x2, A-House Small") — the same way bookingsManage.jsx shows it.
//  Its member unit rows carry a groupId and are skipped, or the same
//  reservation would be counted once per unit it holds.
// ============================================================================

import {
    buildWorkbook,
    saveBlob,
    text,
    number,
    date as dateCell,
    blank,
    S,
    DXF,
} from '../../lib/xlsx.js'
import { getBookingStage, groupUnitsLabel } from '../../data/accommodationDB.js'
import { formatRangeLabel } from './calendarRange.js'

// --------------------------------------------------------------- the columns
// Header text and widths as they are in the resort's workbook. `style` is what
// every body cell in that column gets.
const COLUMNS = [
    { header: 'Name', width: 25.8, style: S.TEXT_LEFT },
    { header: 'Date (Month/Date/Year)', width: 22.1, style: S.DATE },
    { header: 'Accomodation', width: 24, style: S.TEXT_LEFT },
    { header: 'Time', width: 18.5, style: S.TEXT },
    { header: 'Downpayment', width: 20.8, style: S.MONEY },
    { header: 'Payment', width: 15.8, style: S.MONEY },
    { header: 'Total Payment', width: 16.5, style: S.MONEY },
    { header: 'Status/Discount', width: 14.6, style: S.TEXT },
    { header: 'Contact No. ', width: 15, style: S.TEXT },
]

const STATUS_COLUMN = 'H'
const SHEET_NAME = 'Check-in-out'

// The three words that land in the Status column. The workbook's own
// conditional formatting keys off the first two by exact text, so these
// strings are load-bearing — changing one silently drops its colour.
const STATUS_PAID = 'PAID'
const STATUS_BALANCE = 'WITH BALANCE'
const STATUS_CANCELLED = 'CANCELLED'

// ------------------------------------------------------------- date helpers

function startOfDay(value) {
    const day = new Date(value)
    day.setHours(0, 0, 0, 0)
    return day
}

function endOfDay(value) {
    const day = new Date(value)
    day.setHours(23, 59, 59, 999)
    return day
}

function stamp(value) {
    const day = startOfDay(value)
    const month = String(day.getMonth() + 1).padStart(2, '0')
    return `${day.getFullYear()}-${month}-${String(day.getDate()).padStart(2, '0')}`
}

function longDate(value) {
    return new Date(value).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    })
}

// ------------------------------------------------------------------- ranges
// Whole periods, not period-to-date: "this month" means the whole month,
// including check-ins still ahead of today. Staff export a month to see the
// month, and a report that quietly stopped at today would be wrong in a way
// nothing on the page admits to.

export const RANGE_PRESETS = [
    { id: 'day', label: 'Day', hint: 'Today' },
    { id: 'week', label: 'Week', hint: 'Sun — Sat' },
    { id: 'month', label: 'Month', hint: 'Whole month' },
    { id: 'year', label: 'Year', hint: 'Jan — Dec' },
]

export function resolveRange(preset, now = new Date()) {
    const today = startOfDay(now)

    if (preset === 'week') {
        const start = startOfDay(today)
        start.setDate(start.getDate() - start.getDay())
        const end = startOfDay(start)
        end.setDate(end.getDate() + 6)
        return {
            start,
            end: endOfDay(end),
            label: `Week of ${longDate(start)}`,
            tag: `week-${stamp(start)}`,
        }
    }

    if (preset === 'month') {
        const start = new Date(today.getFullYear(), today.getMonth(), 1)
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        return {
            start,
            end: endOfDay(end),
            label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            tag: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
        }
    }

    if (preset === 'year') {
        const start = new Date(today.getFullYear(), 0, 1)
        const end = new Date(today.getFullYear(), 11, 31)
        return {
            start,
            end: endOfDay(end),
            label: `Year ${start.getFullYear()}`,
            tag: String(start.getFullYear()),
        }
    }

    return { start: today, end: endOfDay(today), label: longDate(today), tag: stamp(today) }
}

export function customRange(start, end) {
    if (!start || !end) return null
    return {
        start: startOfDay(start),
        end: endOfDay(end),
        label: formatRangeLabel(start, end),
        tag: `${stamp(start)}-to-${stamp(end)}`,
    }
}

// ------------------------------------------------------------- row selection

// One reservation per row: single bookings that are not part of a group, plus
// each group once. Same merge bookingsManage.jsx does for its table.
export function mergeReservations(bookings = [], groups = []) {
    return [...bookings.filter((booking) => booking.groupId == null), ...groups]
}

// The reservation's check-in day is what puts it in a period — a stay is
// reported under the day the guest arrives.
function checkInDay(entry) {
    const value = entry.startsAt ?? entry.checkIn
    if (value == null) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function selectReservations(entries, start, end) {
    if (!start || !end) return []
    const from = start.getTime()
    const to = end.getTime()

    return entries
        .filter((entry) => {
            const day = checkInDay(entry)
            return day != null && day.getTime() >= from && day.getTime() <= to
        })
        .sort((a, b) => {
            const byDate = (checkInDay(a)?.getTime() ?? 0) - (checkInDay(b)?.getTime() ?? 0)
            if (byDate !== 0) return byDate
            return (a.guest?.fullName ?? '').localeCompare(b.guest?.fullName ?? '')
        })
}

// ---------------------------------------------------------------- row values

// 'A-House Small - AHS-02', or a group's 'Teepee x2, A-House Small'. Tent
// pitching has no unit to assign, so it falls back to the type name alone.
function accommodationLabel(entry) {
    if (entry.isGroup) return groupUnitsLabel(entry.units) || 'Combined reservation'
    if (!entry.unitId) return entry.accomodationName ?? '—'
    return `${entry.accomodationName} · ${entry.unitId}`
}

// What the guest owes for the whole stay: unit rate + entrance + any food or
// spa ordered against it. Both booking shapes carry this already.
function totalDue(entry) {
    return Number(entry.stayTotal ?? entry.total ?? 0)
}

// What has actually been collected. Derived from the payment state rather than
// the receipt amounts, because bookings taken before receipts were itemised
// carry no amounts at all and would read as unpaid.
function collected(entry) {
    if (entry.payment === 'paid-full') return totalDue(entry)
    if (entry.payment === 'down-payment') return Number(entry.downpayment ?? 0)
    return 0
}

function statusOf(entry) {
    if (getBookingStage(entry) === 'cancelled') return STATUS_CANCELLED
    return entry.payment === 'paid-full' ? STATUS_PAID : STATUS_BALANCE
}

// One reservation → the nine cells of a Check-in-out row.
function reservationRow(entry) {
    const day = checkInDay(entry)
    return [
        text(entry.guest?.fullName || '—', S.TEXT_LEFT),
        // Midnight, not the 10:00 AM the occupancy window starts at: the check-in
        // hour is the Time column's job, and a date cell carrying a time behaves
        // like a date in Excel only until someone compares or groups by it.
        day ? dateCell(startOfDay(day)) : text('—'),
        text(accommodationLabel(entry), S.TEXT_LEFT),
        text(entry.schedule?.time ?? '—'),
        number(entry.downpayment ?? 0),
        number(collected(entry)),
        number(totalDue(entry)),
        text(statusOf(entry)),
        text(entry.guest?.mobile || '—'),
    ]
}

// --------------------------------------------------------------- the summary
// Cancelled reservations are listed — staff want to see them — but they are
// money that never arrived, so they are kept out of every total below.

function summarise(rows) {
    return rows.reduce(
        (totals, entry) => {
            if (getBookingStage(entry) === 'cancelled') {
                totals.cancelled += 1
                return totals
            }
            totals.count += 1
            totals.due += totalDue(entry)
            totals.collected += collected(entry)
            totals.discounts +=
                Number(entry.entrance?.seniorDiscount ?? 0) +
                Number(entry.entrance?.freeSavings ?? 0)
            return totals
        },
        { count: 0, cancelled: 0, due: 0, collected: 0, discounts: 0 },
    )
}

// ------------------------------------------------------------- sheet assembly

const COLUMN_COUNT = COLUMNS.length
const LAST_COLUMN = 'I'

// A row of `count` cells, the first holding `cell` — merged title rows still
// need the cells underneath them styled, or the fill stops at column A.
function bandRow(cells) {
    const row = [...cells]
    while (row.length < COLUMN_COUNT) row.push(blank(S.BAND))
    return row
}

function summaryRow(label, valueCell) {
    const row = []
    for (let index = 0; index < COLUMN_COUNT; index++) row.push(blank(S.SUM_LABEL))
    // Label in G, figure in H — right above the Status column, where the eye
    // already is after reading down the PAID/WITH BALANCE stripe.
    row[6] = text(label, S.SUM_LABEL)
    row[7] = valueCell
    return row
}

export function buildReportSheet({ range, reservations, generatedAt = new Date() }) {
    const totals = summarise(reservations)

    const rows = [
        bandRow([text('CAMP BA-LONG', S.EYEBROW)]),
        bandRow([text('Booking Report — Check-in / Check-out', S.TITLE)]),
        bandRow([
            text('Period:', S.META_LABEL),
            text(range.label, S.META_VALUE),
            blank(S.BAND),
            text('Covering:', S.META_LABEL),
            text(`${longDate(range.start)} — ${longDate(range.end)}`, S.META_VALUE),
        ]),
        bandRow([
            text('Generated:', S.META_LABEL),
            text(generatedAt.toLocaleString('en-US'), S.META_VALUE),
            blank(S.BAND),
            text('Reservations:', S.META_LABEL),
            text(String(reservations.length), S.META_VALUE),
        ]),
        bandRow([]),
        COLUMNS.map((column) => text(column.header, S.HEADER)),
    ]

    const headerRow = rows.length
    for (const entry of reservations) rows.push(reservationRow(entry))

    // With nothing in range, say so in the sheet rather than shipping a grid
    // of headers over empty space that reads like a failed export.
    if (reservations.length === 0) {
        const empty = Array.from({ length: COLUMN_COUNT }, () => blank(S.TEXT))
        empty[0] = text('No reservations checked in during this period.', S.TEXT_LEFT)
        rows.push(empty)
    }

    const firstDataRow = headerRow + 1
    const lastDataRow = headerRow + Math.max(reservations.length, 1)

    rows.push(Array.from({ length: COLUMN_COUNT }, () => null))
    rows.push(summaryRow('Total Reservations', number(totals.count, S.SUM_COUNT)))
    rows.push(summaryRow('Cancelled', number(totals.cancelled, S.SUM_COUNT)))
    rows.push(summaryRow('Total Payment Due', number(totals.due, S.SUM_MONEY)))
    rows.push(summaryRow('Total Collected', number(totals.collected, S.SUM_MONEY)))
    rows.push(summaryRow('Outstanding Balance', number(totals.due - totals.collected, S.SUM_MONEY)))
    rows.push(summaryRow('Discounts Given', number(totals.discounts, S.SUM_MONEY)))

    return {
        sheetName: SHEET_NAME,
        columns: COLUMNS.map(({ width }) => ({ width })),
        rows,
        merges: [
            `A1:${LAST_COLUMN}1`,
            `A2:${LAST_COLUMN}2`,
            `B3:C3`,
            `E3:${LAST_COLUMN}3`,
            `B4:C4`,
            `E4:${LAST_COLUMN}4`,
        ],
        rowHeights: { 1: 18, 2: 26, 5: 8, [headerRow]: 30 },
        freezeRow: headerRow,
        autoFilterRef: `A${headerRow}:${LAST_COLUMN}${headerRow}`,
        // Live rules, not baked-in fills: edit a status by hand in Excel and
        // the colour follows, exactly as it does in the resort's own sheet.
        conditionalFormats: [
            {
                ref: `${STATUS_COLUMN}${firstDataRow}:${STATUS_COLUMN}${lastDataRow}`,
                rules: [
                    { equals: STATUS_PAID, dxfId: DXF.PAID },
                    { equals: STATUS_BALANCE, dxfId: DXF.BALANCE },
                    { equals: STATUS_CANCELLED, dxfId: DXF.CANCELLED },
                ],
            },
        ],
    }
}

// --------------------------------------------------------------------- export

export function reportFilename(range) {
    return `campbalong-bookings-${range.tag}.xlsx`
}

// Build the workbook and hand it to the browser. Async because compressing the
// parts goes through CompressionStream.
export async function exportBookingReport({ range, reservations }) {
    const blob = await buildWorkbook(buildReportSheet({ range, reservations }))
    saveBlob(blob, reportFilename(range))
}

// What the export buttons show before anything is downloaded, so an empty
// period is visible on the page rather than discovered in Excel.
export function previewTotals(reservations) {
    const totals = summarise(reservations)
    return { ...totals, listed: reservations.length }
}
