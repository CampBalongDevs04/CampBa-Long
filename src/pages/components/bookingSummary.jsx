import '../components/css/bookingSummary.css'
// Same rate the database applies to the booking row, so the figure quoted here
// is the one My Bookings will ask for on the next screen.
import { DOWNPAYMENT_RATE } from '../../data/accommodationDB.js'
import { ENTRANCE_PER_NIGHT } from '../../data/extendedStay.js'
import {
    KIDS_DISCOUNT_IN_SYSTEM, KIDS_DISCOUNT_LABEL,
    PWD_DISCOUNT_IN_SYSTEM, PWD_DISCOUNT_LABEL,
    SENIOR_DISCOUNT_IN_SYSTEM, SENIOR_DISCOUNT_LABEL,
} from '../../data/entranceFee.js'

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

// Pesos, to the centavo — same rounding extendedStay.js and bookingPayment.jsx
// use, so a figure built from add-ons here never lands a centavo off theirs.
function round2(amount){
    return Math.round(amount * 100) / 100
}

// Stands in for the entrance breakdown when this renders without a quote, so
// the panel shows its placeholders instead of throwing on the first read.
const NO_ENTRANCE = {
    perHead: 0, paxCount: 0, paxTotal: 0, kidsCount: 0, kidsFree: 0,
    perkApplied: 0, perkSavings: 0, seniorCount: 0, seniorDiscount: 0, total: 0,
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

// `quote` is computeStayQuote() from data/extendedStay.js, built once on the
// booking page and handed down here — the same object reserve() stores, so
// what this panel adds up and what the guest is charged cannot disagree.
//
// Every money figure on it is for the WHOLE stay: the unit rates and the
// entrance fees are both multiplied by the number of nights. Where that
// multiplication matters to a guest reading the column — a three-night stay
// showing ₱6,750 against a ₱2,250 card — the row shows the arithmetic rather
// than just the product.
export default function BookingSummary({
    checkIn, checkOut, schedule, quote, guest, pax, kids, seniors, pwd, totalGuests = 0, rentAllMode = false,
    freeEntranceQuota = 2, addonLines = [], addonsPreviewTotal = 0,
}){
    const {
        nights = 1,
        lengthSet = false,
        isExtended = false,
        lines = [],
        unitNightly = null,
        unitTotal = null,
        promoSavings: promoSavingsTotal = 0,
        entranceNightly = NO_ENTRANCE,
        entrance = NO_ENTRANCE,
        entranceNights = 1,
        stayTotal = null,
    } = quote ?? {}

    // Reads as "× 3 nights" only when there is more than one — a one-night
    // stay is the plain single figure it has always been.
    const nightsSuffix = isExtended ? ` × ${nights} nights` : ''
    // Day Time has no nights to charge per: it is a single 7-hour block, and
    // calling its ₱150 a nightly rate would be wrong on the face of it.
    const perNight = schedule != null && schedule.sameDay !== true

    // Built as one string rather than inline in the JSX below: the dynamic
    // half of the sentence (Rent All's bigger quota vs. the standing 2-pax
    // unit inclusion) needs to sit next to real text on both sides, and
    // splicing conditionals across JSX line breaks is exactly the kind of
    // thing that silently swallows or duplicates a space.
    const freeEntranceNote = rentAllMode
        ? `renting the whole resort includes free entrance for up to ${freeEntranceQuota} pax`
            + (ENTRANCE_PER_NIGHT && perNight ? ' each night' : '')
        : `your stay includes free entrance for up to ${freeEntranceQuota} more pax`
            + (ENTRANCE_PER_NIGHT && perNight ? ' each night' : '')
            + ' (not applicable for Tent Pitching, Cottage or Pavilion)'

    // Towel/pillow/etc. picked in AddonPicker aren't part of `quote` (that's
    // unit + entrance only) — folded in here so the figure quoted on this
    // page is the same one the booking is actually created with, once
    // reserve() submits these same lines right after. Not read off
    // `quote.downpayment`/`quote.balance` below for that reason.
    const combinedStayTotal = stayTotal != null ? round2(stayTotal + addonsPreviewTotal) : null
    const combinedDownpayment = combinedStayTotal != null ? round2(combinedStayTotal * DOWNPAYMENT_RATE) : null
    const onSiteBalance = combinedStayTotal != null && combinedDownpayment != null
        ? round2(combinedStayTotal - combinedDownpayment)
        : null

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
                {/* The multiplier for everything below it, so it is stated
                    before the first figure it multiplies rather than left for
                    the guest to infer from the two dates. */}
                {/* `nights` is clamped to 1 so no figure below it is ever zero,
                    which means it cannot be trusted as the answer to "has the
                    guest chosen yet" — `lengthSet` is. Without that, a stay
                    with no check-out yet would read "1 night" as though it had
                    been picked. */}
                <SummaryRow
                    label="Length of stay"
                    value={
                        schedule && lengthSet
                            ? schedule.sameDay
                                ? 'Same day (1 stay)'
                                : `${nights} ${nights === 1 ? 'night' : 'nights'}`
                            : null
                    }
                    placeholder={schedule ? 'Set how many nights' : 'Select a schedule'}
                />
            </div>

            <div className="summary-section">
                <p className="summary-section-label">Accommodation</p>
                {lines.length === 0 ? (
                    <SummaryRow label="Units" value={null} placeholder="Select at least one unit" />
                ) : (
                    lines.map((line) => (
                        <SummaryRow
                            key={line.id}
                            label={`${line.name}${line.qty > 1 ? ` ×${line.qty}` : ''}${isExtended ? ` × ${nights} nights` : ''}`}
                            value={line.total != null ? (
                                line.wasTotal ? (
                                    <>
                                        <s className="summary-row-was">
                                            {formatPeso(line.wasTotal)}
                                        </s>{' '}
                                        {formatPeso(line.total)}
                                    </>
                                ) : (
                                    formatPeso(line.total)
                                )
                            ) : 'Price TBA'}
                            placeholder="Price TBA"
                        />
                    ))
                )}
                <SummaryRow
                    label="Adults"
                    value={pax ? `${pax} pax` : null}
                    placeholder="Not set"
                />
                <SummaryRow
                    label="Kids (7 & below)"
                    value={
                        kids > 0
                            ? KIDS_DISCOUNT_IN_SYSTEM
                                ? `${kids} — ${KIDS_DISCOUNT_LABEL} off`
                                : `${kids} — discount claimed at the resort`
                            : null
                    }
                    placeholder="None"
                />
                <SummaryRow
                    label="Senior citizens"
                    value={
                        seniors > 0
                            ? SENIOR_DISCOUNT_IN_SYSTEM
                                ? `${seniors} — ${SENIOR_DISCOUNT_LABEL} off`
                                : `${seniors} — discount claimed at the resort`
                            : null
                    }
                    placeholder="None"
                />
                {/* PWD sits beside seniors because it is the same kind of fact:
                    a declared count the front desk needs, not a number this
                    page subtracts anything for. */}
                <SummaryRow
                    label="Persons with disability"
                    value={
                        pwd > 0
                            ? PWD_DISCOUNT_IN_SYSTEM
                                ? `${pwd} — ${PWD_DISCOUNT_LABEL} off`
                                : `${pwd} — discount claimed at the resort`
                            : null
                    }
                    placeholder="None"
                />
                {/* Adults + kids + seniors + PWD added together — the whole
                    party, same figure the pricing and unit-capacity checks
                    both use (booking.jsx's totalGuests). */}
                <SummaryRow
                    label="Total Guests"
                    value={totalGuests > 0 ? `${totalGuests}` : null}
                    placeholder="Not set"
                />
                {/* Under a promo the standing rate is struck through beside the
                    one being charged, and what it saves gets its own line in the
                    same column the entrance discounts use — a guest should be
                    able to see the discount in the total, not just on the card
                    they picked the unit from. */}
                {/* On an extended stay the nightly subtotal earns its own row,
                    because it is the number on the cards the guest just picked
                    from — the row under it is that number times the nights. */}
                {isExtended && (
                    <SummaryRow
                        label="Unit rate per night"
                        value={unitNightly != null ? formatPeso(unitNightly) : lines.length > 0 ? 'Price TBA' : null}
                        placeholder="Select at least one unit"
                    />
                )}
                <SummaryRow
                    label={`Unit rate total${nightsSuffix}`}
                    value={
                        unitTotal != null
                            ? isExtended
                                ? `${formatPeso(unitNightly)} × ${nights} = ${formatPeso(unitTotal)}`
                                : formatPeso(unitTotal)
                            : lines.length > 0 ? 'Price TBA' : null
                    }
                    placeholder="Select at least one unit"
                />
                {promoSavingsTotal > 0 && (
                    <div className="summary-row summary-row-discount">
                        <span className="summary-row-label">Promo discount</span>
                        <span className="summary-row-value">
                            − {formatPeso(promoSavingsTotal)}
                        </span>
                    </div>
                )}
            </div>

            {/* AddonPicker's picks (see booking.jsx) — these aren't ordered
                yet, only queued to be, the instant reserve() succeeds. */}
            {addonLines.length > 0 && (
                <div className="summary-section">
                    <p className="summary-section-label">Add-ons</p>
                    {addonLines.map((line) => (
                        <SummaryRow
                            key={line.itemId}
                            label={`${line.name}${line.quantity > 1 ? ` ×${line.quantity}` : ''}`}
                            value={formatPeso(line.total)}
                            placeholder=""
                        />
                    ))}
                    <SummaryRow
                        label="Add-ons subtotal"
                        value={formatPeso(addonsPreviewTotal)}
                        placeholder=""
                    />
                </div>
            )}

            <div className="summary-section">
                <p className="summary-section-label">Entrance Fees</p>
                <SummaryRow
                    label={perNight ? 'Rate per head, per night' : 'Rate per head'}
                    value={schedule ? `${formatPeso(entranceNightly.perHead)} (${schedule.description})` : null}
                    placeholder="Select a schedule"
                />
                {/* Entrance is charged for every night of the stay, the same
                    way the unit is — so on an extended stay the per-head
                    figure the discounts below are worked out from is the
                    nightly rate times the nights, and it is worth showing as
                    that multiplication rather than as a number out of nowhere. */}
                {isExtended && entranceNights > 1 && (
                    <SummaryRow
                        label={`Rate per head${nightsSuffix}`}
                        value={
                            schedule
                                ? `${formatPeso(entranceNightly.perHead)} × ${entranceNights} = ${formatPeso(entrance.perHead)}`
                                : null
                        }
                        placeholder="Select a schedule"
                    />
                )}
                {/* Every head at the full rate first, then what comes off it —
                    the column reads top-to-bottom as the subtotal's arithmetic. */}
                <SummaryRow
                    label={`Guests${entrance.paxCount ? ` (${entrance.paxCount})` : ''}`}
                    value={schedule && entrance.paxCount > 0 ? formatPeso(entrance.paxTotal) : null}
                    placeholder={schedule ? '—' : 'Set guests'}
                />
                {entrance.perkApplied > 0 && (
                    <div className="summary-row summary-row-discount">
                        <span className="summary-row-label">
                            {/* Names the cap (freeEntranceQuota), not just how many pax
                                happened to use it this time — Rent All's cap (20) is easy
                                to mistake for "free for everyone" without it spelled out
                                right on the discount line, not just in the small print
                                below (see freeEntranceNote). */}
                            Free entrance ({entrance.perkApplied} of first {freeEntranceQuota} pax) — resort inclusion
                        </span>
                        <span className="summary-row-value">
                            {schedule ? `− ${formatPeso(entrance.perkSavings)}` : '—'}
                        </span>
                    </div>
                )}
                {/* Keyed off the AMOUNT, not the head count. With the discount
                    moved to the front desk there is nothing to subtract here,
                    and a row reading "− ₱0.00" would look like the guest had
                    been given something and then charged for it anyway. */}
                {entrance.kidsDiscount > 0 && (
                    <div className="summary-row summary-row-discount">
                        <span className="summary-row-label">
                            Kids discount ({KIDS_DISCOUNT_LABEL} × {entrance.kidsCount})
                        </span>
                        <span className="summary-row-value">
                            {schedule ? `− ${formatPeso(entrance.kidsDiscount)}` : '—'}
                        </span>
                    </div>
                )}
                {entrance.seniorDiscount > 0 && (
                    <div className="summary-row summary-row-discount">
                        <span className="summary-row-label">
                            Senior discount ({SENIOR_DISCOUNT_LABEL} × {entrance.seniorCount})
                        </span>
                        <span className="summary-row-value">
                            {schedule ? `− ${formatPeso(entrance.seniorDiscount)}` : '—'}
                        </span>
                    </div>
                )}
                <SummaryRow
                    label={`Entrance subtotal${ENTRANCE_PER_NIGHT ? nightsSuffix : ''}`}
                    value={
                        schedule
                            ? isExtended && entranceNights > 1
                                ? `${formatPeso(entranceNightly.total)} × ${entranceNights} = ${formatPeso(entrance.total)}`
                                : formatPeso(entrance.total)
                            : null
                    }
                    placeholder="Select a schedule"
                />
                <p className="summary-note-inline">
                    Entrance is charged for every guest in your group
                    {ENTRANCE_PER_NIGHT && perNight ? ', for every night of your stay' : ''}, and {freeEntranceNote}
                    {' '}— anyone past that still pays the rate above. Half of your entrance
                    fees is included in the down payment; the rest is settled on-site at
                    check-in.
                    {KIDS_DISCOUNT_IN_SYSTEM ? (
                        <> Kids 7 &amp; below get <strong>{KIDS_DISCOUNT_LABEL} off</strong> the
                        entrance fee.</>
                    ) : (
                        <> The <strong>kids' discount is given at the resort</strong>, not on
                        this page — the totals above are at the full rate for kids too. It
                        comes off the balance you settle on-site.</>
                    )}
                    {SENIOR_DISCOUNT_IN_SYSTEM ? (
                        <> Seniors must present a Senior Citizen ID or other valid ID
                        for the discount.</>
                    ) : (
                        <> The <strong>senior citizen discount is given at the resort</strong>,
                        not on this page — the totals above are at the full rate. Present a
                        Senior Citizen ID at check-in and it comes off the balance you settle
                        on-site.</>
                    )}
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
                    label={`Stay subtotal${isExtended ? ` (${nights} nights)` : ''}`}
                    value={
                        combinedStayTotal != null
                            ? addonsPreviewTotal > 0
                                ? `${formatPeso(unitTotal)} + ${formatPeso(entrance.total)} + ${formatPeso(addonsPreviewTotal)} = ${formatPeso(combinedStayTotal)}`
                                : `${formatPeso(unitTotal)} + ${formatPeso(entrance.total)} = ${formatPeso(combinedStayTotal)}`
                            : null
                    }
                    placeholder="Select at least one unit and a schedule"
                />
                <SummaryRow
                    label={`Down payment (${RATE_LABEL})`}
                    value={
                        combinedDownpayment != null
                            ? `${formatPeso(combinedStayTotal)} × ${RATE_LABEL} = ${formatPeso(combinedDownpayment)}`
                            : null
                    }
                    placeholder="—"
                />
                <SummaryRow
                    label="Balance on-site"
                    value={
                        onSiteBalance != null
                            ? `${formatPeso(combinedStayTotal)} − ${formatPeso(combinedDownpayment)} = ${formatPeso(onSiteBalance)}`
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
                    {combinedDownpayment != null
                        ? formatPeso(combinedDownpayment)
                        : lines.length > 0 ? 'Price TBA' : '—'}
                </span>
            </div>
            <p className="summary-total-hint">
                {RATE_LABEL} of the whole stay — unit rate, entrance fees, and any
                add-ons picked above — payable after you reserve. Order food or spa
                treatments separately from /menu or /spa and their {RATE_LABEL} joins
                this figure the same way.
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
