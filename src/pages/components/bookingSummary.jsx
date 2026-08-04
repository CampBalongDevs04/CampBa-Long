import '../components/css/bookingSummary.css'
import { getAccomodationOptions, isFreeEntranceEligible } from '../../data/accomodationOptions.js'
import { computeEntranceFee } from '../../data/entranceFee.js'
// Same rate the database applies to the booking row, so the figure quoted here
// is the one My Bookings will ask for on the next screen.
import { DOWNPAYMENT_RATE } from '../../data/accommodationDB.js'

const RATE_LABEL = `${DOWNPAYMENT_RATE * 100}%`

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

export default function BookingSummary({ checkIn, checkOut, schedule, selectedAccomodation, guest, pax, kids, seniors }){
    const unit = selectedAccomodation
        ? getAccomodationOptions(schedule?.rateGroup).find((item) => item.id === selectedAccomodation)
        : null

    const entrance = computeEntranceFee({
        perHead: schedule?.entranceFee ?? 0,
        pax: pax ?? 0,
        seniors: seniors ?? 0,
        kids: kids ?? 0,
        freeEntranceEligible: isFreeEntranceEligible(unit?.id),
    })

    // The down payment is half of the WHOLE stay, entrance fees included — not
    // half the unit rate. Food and spa go into it too, but they can only be
    // ordered once the booking exists, so at this point there are none: this
    // quote is the floor, and My Bookings shows the live figure.
    const stayTotal = unit?.price != null ? unit.price + entrance.total : null
    const downpayment = stayTotal != null ? stayTotal * DOWNPAYMENT_RATE : null
    const onSiteBalance = stayTotal != null ? stayTotal - downpayment : null

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
                    value={unit ? `${unit.name}${unit.pax ? ` (${unit.pax})` : ''}` : null}
                    placeholder="Select a unit"
                />
                <SummaryRow
                    label="Guests"
                    value={pax ? `${pax} pax` : null}
                    placeholder="Not set"
                />
                <SummaryRow
                    label="Kids (7 & below)"
                    value={kids > 0 ? `${kids} — no entrance fee` : null}
                    placeholder="None"
                />
                <SummaryRow
                    label="Senior citizens"
                    value={seniors > 0 ? `${seniors} — 10% off` : null}
                    placeholder="None"
                />
                {/* Under a promo the standing rate is struck through beside the
                    one being charged, and what it saves gets its own line in the
                    same column the entrance discounts use — a guest should be
                    able to see the discount in the total, not just on the card
                    they picked the unit from. */}
                <SummaryRow
                    label="Unit rate"
                    value={
                        unit?.price != null ? (
                            unit.originalPrice ? (
                                <>
                                    <s className="summary-row-was">{formatPeso(unit.originalPrice)}</s>{' '}
                                    {formatPeso(unit.price)}
                                </>
                            ) : (
                                formatPeso(unit.price)
                            )
                        ) : unit ? 'Price TBA' : null
                    }
                    placeholder="Select a unit"
                />
                {unit?.originalPrice != null && unit.price != null && (
                    <div className="summary-row summary-row-discount">
                        <span className="summary-row-label">Promo discount</span>
                        <span className="summary-row-value">
                            − {formatPeso(unit.originalPrice - unit.price)}
                        </span>
                    </div>
                )}
            </div>

            <div className="summary-section">
                <p className="summary-section-label">Entrance Fees</p>
                <SummaryRow
                    label="Rate per head"
                    value={schedule ? `${formatPeso(entrance.perHead)} (${schedule.description})` : null}
                    placeholder="Select a schedule"
                />
                {/* Every head at the full rate first, then what comes off it —
                    the column reads top-to-bottom as the subtotal's arithmetic. */}
                <SummaryRow
                    label={`Guests${entrance.paxCount ? ` (${entrance.paxCount})` : ''}`}
                    value={schedule && entrance.paxCount > 0 ? formatPeso(entrance.paxTotal) : null}
                    placeholder={schedule ? '—' : 'Set guests'}
                />
                {entrance.kidsCount > 0 && (
                    <div className="summary-row summary-row-discount">
                        <span className="summary-row-label">
                            Free entrance ({entrance.kidsCount} pax) — kids 7 &amp; below
                        </span>
                        <span className="summary-row-value">
                            {schedule ? `− ${formatPeso(entrance.kidsFree)}` : '—'}
                        </span>
                    </div>
                )}
                {entrance.perkApplied > 0 && (
                    <div className="summary-row summary-row-discount">
                        <span className="summary-row-label">
                            Free entrance ({entrance.perkApplied} pax) — resort inclusion
                        </span>
                        <span className="summary-row-value">
                            {schedule ? `− ${formatPeso(entrance.perkSavings)}` : '—'}
                        </span>
                    </div>
                )}
                {entrance.seniorCount > 0 && (
                    <div className="summary-row summary-row-discount">
                        <span className="summary-row-label">
                            Senior discount (10% × {entrance.seniorCount})
                        </span>
                        <span className="summary-row-value">
                            {schedule ? `− ${formatPeso(entrance.seniorDiscount)}` : '—'}
                        </span>
                    </div>
                )}
                <SummaryRow
                    label="Entrance subtotal"
                    value={schedule ? formatPeso(entrance.total) : null}
                    placeholder="Select a schedule"
                />
                <p className="summary-note-inline">
                    Entrance is charged for every guest in your group. Kids 7 &amp;
                    below get in free, and your stay includes free entrance for up
                    to 2 more pax (not applicable for Tent Pitching, Cottage or
                    Pavilion). Half of your entrance fees is included in the down
                    payment; the rest is settled on-site at check-in. Seniors must
                    present a Senior Citizen ID or other
                    valid ID for the discount.
                </p>
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
                <SummaryRow
                    label="Stay subtotal"
                    value={
                        stayTotal != null
                            ? `${formatPeso(unit.price)} + ${formatPeso(entrance.total)} = ${formatPeso(stayTotal)}`
                            : null
                    }
                    placeholder="Select a unit and schedule"
                />
                <SummaryRow
                    label={`Down payment (${RATE_LABEL})`}
                    value={
                        downpayment != null
                            ? `${formatPeso(stayTotal)} × ${RATE_LABEL} = ${formatPeso(downpayment)}`
                            : null
                    }
                    placeholder="—"
                />
                <SummaryRow
                    label="Balance on-site"
                    value={
                        onSiteBalance != null
                            ? `${formatPeso(stayTotal)} − ${formatPeso(downpayment)} = ${formatPeso(onSiteBalance)}`
                            : null
                    }
                    placeholder="—"
                />
                <p className="summary-note-inline">
                    Nothing is charged on this page. Reserve your unit first — we
                    hold it for you — then settle the down payment from My Bookings.
                </p>
            </div>

            <div className="summary-total">
                <span className="summary-total-label">Down Payment ({RATE_LABEL})</span>
                <span className="summary-total-value">
                    {downpayment != null
                        ? formatPeso(downpayment)
                        : unit ? 'Price TBA' : '—'}
                </span>
            </div>
            <p className="summary-total-hint">
                {RATE_LABEL} of the whole stay — unit rate and entrance fees — payable
                after you reserve. Order food or spa treatments before you pay and
                their {RATE_LABEL} joins this figure; order them after and it is asked
                for separately, at the same {RATE_LABEL}.
            </p>

            <div className="summary-secure">
                <svg
                    className="summary-secure-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M12 3 5 6v5c0 4.5 3 8.2 7 9.5 4-1.3 7-5 7-9.5V6l-7-3z" />
                    <path d="m9.5 12 2 2 3.5-3.5" />
                </svg>
                <p className="summary-secure-text">
                    Your details are used only for this reservation. Your unit is
                    held the moment you reserve; we review every receipt manually
                    and confirm by email or SMS.
                </p>
            </div>
        </aside>
    )
}
