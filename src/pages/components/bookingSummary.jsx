import { useEffect, useMemo } from 'react'
import '../components/css/bookingSummary.css'
import { accomodationOptions } from './accomodationList'

const DOWNPAYMENT_RATE = 0.5

function formatDate(date){
    if (!date) return null
    return date.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    })
}

function formatPeso(amount){
    return `₱${amount.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`
}

function SummaryRow({ label, value, placeholder }){
    return(
        <div className="summary-row">
            <span className="summary-row-label">{label}</span>
            {value
                ? <span className="summary-row-value">{value}</span>
                : <span className="summary-row-value summary-row-empty">{placeholder}</span>}
        </div>
    )
}

export default function BookingSummary({ checkIn, checkOut, schedule, selectedAccomodation, guest, pax, receipt }){
    const unit = selectedAccomodation
        ? accomodationOptions.find((item) => item.id === selectedAccomodation)
        : null

    const downpayment = unit?.price != null ? unit.price * DOWNPAYMENT_RATE : null

    const receiptUrl = useMemo(
        () => (receipt ? URL.createObjectURL(receipt) : null),
        [receipt]
    )
    useEffect(() => {
        return () => { if (receiptUrl) URL.revokeObjectURL(receiptUrl) }
    }, [receiptUrl])

    return(
        <aside className="booking-summary" aria-label="Booking summary">
            <h3 className="summary-title">Booking Summary</h3>

            <div className="summary-section">
                <p className="summary-section-label">Schedule</p>
                <SummaryRow
                    label="Check-in"
                    value={formatDate(checkIn)}
                    placeholder="Select a date"
                />
                <SummaryRow
                    label="Check-out"
                    value={formatDate(checkOut)}
                    placeholder="Select a date"
                />
                <SummaryRow
                    label="Check-in time"
                    value={schedule ? `${schedule.time} (${schedule.description})` : null}
                    placeholder="Select a schedule"
                />
            </div>

            <div className="summary-section">
                <p className="summary-section-label">Accommodation</p>
                <SummaryRow
                    label="Unit"
                    value={unit ? `${unit.name} (${unit.pax})` : null}
                    placeholder="Select a unit"
                />
                <SummaryRow
                    label="Guests"
                    value={pax ? `${pax} pax` : null}
                    placeholder="Not set"
                />
                <SummaryRow
                    label="Downpayment"
                    value={
                        unit
                            ? (downpayment != null ? formatPeso(downpayment) : 'Price TBA')
                            : null
                    }
                    placeholder="Select a unit"
                />
            </div>

            <div className="summary-section">
                <p className="summary-section-label">Recipient</p>
                <SummaryRow
                    label="Name"
                    value={guest?.fullName?.trim() || null}
                    placeholder="Not provided"
                />
                <SummaryRow
                    label="Number"
                    value={guest?.mobile?.trim() || null}
                    placeholder="Not provided"
                />
                <SummaryRow
                    label="Email"
                    value={guest?.email?.trim() || null}
                    placeholder="Not provided"
                />
            </div>

            <div className="summary-section">
                <p className="summary-section-label">Payment</p>
                <div className="summary-row">
                    <span className="summary-row-label">Receipt</span>
                    {receipt ? (
                        <span className="summary-row-value summary-receipt-ok">
                            Uploaded
                            <a
                                className="summary-receipt-link"
                                href={receiptUrl}
                                target="_blank"
                                rel="noreferrer"
                            >
                                View
                            </a>
                        </span>
                    ) : (
                        <span className="summary-row-value summary-row-empty">
                            Not uploaded
                        </span>
                    )}
                </div>
            </div>

            <div className="summary-total">
                <span className="summary-total-label">Total Downpayment</span>
                <span className="summary-total-value">
                    {downpayment != null
                        ? formatPeso(downpayment)
                        : unit ? 'Price TBA' : '—'}
                </span>
            </div>
        </aside>
    )
}
