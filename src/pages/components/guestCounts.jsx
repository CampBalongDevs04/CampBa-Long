import { useState } from 'react'
import './css/guestCounts.css'
import {
    KIDS_DISCOUNT_IN_SYSTEM, KIDS_DISCOUNT_LABEL,
    SENIOR_DISCOUNT_IN_SYSTEM, SENIOR_DISCOUNT_LABEL,
    PWD_DISCOUNT_IN_SYSTEM, PWD_DISCOUNT_LABEL,
} from '../../data/entranceFee.js'

// The four headcounts on one line. They used to be four stacked blocks, each
// carrying its own paragraph of discount small print — four labels, four
// steppers and four notes to read before reaching Total Guests. They are the
// same shape of input asking the same question, so they read better as one row
// of cells with the small print gathered underneath and said once.
//
// Adults floors at 1 and has NO ceiling: a unit's own minPax/maxPax shapes the
// fit note in booking.jsx (getFitNote) rather than the counter, so the guest is
// always allowed to enter the real size of their group and be told how it sits
// against the unit(s) they picked. The other three are optional (floor 0) and
// capped, and are button-only — no typing — to keep the values clean.
//
// All four are independent counts, not subsets of each other: booking.jsx's
// totalGuests is adults + kids + seniors + pwd added together.
const MIN_PAX = 1
const MAX_OTHERS = 20

// "kids, senior and PWD" — the small print names whichever categories are
// actually in that world, so it stays a sentence when there is only one.
const joinList = (items) => items.length < 3
    ? items.join(' and ')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

function CounterCell({ id, label, unit, value, min, max, onStep, minusLabel, plusLabel, plusTitle, error, children }){
    return (
        <div className={`gc-cell${error ? ' gc-cell-error' : ''}`}>
            <span className="gc-cell-label" id={`${id}-label`}>{label}</span>

            <div className="gc-stepper" role="group" aria-labelledby={`${id}-label`}>
                <button
                    type="button"
                    className="gc-step"
                    aria-label={minusLabel}
                    onClick={() => onStep(-1)}
                    disabled={value <= min}
                >
                    &minus;
                </button>

                {children}

                <button
                    type="button"
                    className="gc-step"
                    aria-label={plusLabel}
                    onClick={() => onStep(1)}
                    disabled={max != null && value >= max}
                    title={plusTitle}
                >
                    +
                </button>
            </div>

            <span className="gc-cell-unit">{unit}</span>
        </div>
    )
}

export default function GuestCounts({
    pax, onPaxChange,
    kids, onKidsChange,
    seniors, onSeniorsChange,
    pwd, onPwdChange,
    cartLines, paxError, showErrors,
}){
    const lines = cartLines ?? []

    // Booking.jsx knows WHAT is wrong with the adults field; this component
    // decides WHEN to say so — once the guest has left it, or once they've
    // pressed Confirm and every unresolved field needs to speak up.
    const [touched, setTouched] = useState(false)
    const adultsError = (touched || showErrors) ? paxError : null

    // The whole party's capacity (kids/seniors/PWD included), kept as a hover
    // tooltip on the + button rather than printed beside a count that only
    // holds adults, where it could be misread as "N adults fit".
    const cartUnlimited = lines.some((line) => line.option.maxPax == null)
    const capacity = lines.length > 0 && !cartUnlimited
        ? lines.reduce((sum, line) => sum + line.option.maxPax * line.qty, 0)
        : null
    const capacityTitle = capacity != null
        ? `Your selected accommodation${lines.length > 1 ? 's take' : ' takes'} up to ${capacity}.`
        : undefined

    const stepPax = (delta) => onPaxChange?.(Math.max(MIN_PAX, (pax ?? 0) + delta))
    const clampOther = (value) => Math.min(MAX_OTHERS, Math.max(0, value))

    const resortSide = []
    if (!KIDS_DISCOUNT_IN_SYSTEM) resortSide.push('kids')
    if (!SENIOR_DISCOUNT_IN_SYSTEM) resortSide.push('senior')
    if (!PWD_DISCOUNT_IN_SYSTEM) resortSide.push('PWD')

    const inSystem = []
    if (KIDS_DISCOUNT_IN_SYSTEM) inSystem.push(`kids ${KIDS_DISCOUNT_LABEL}`)
    if (SENIOR_DISCOUNT_IN_SYSTEM) inSystem.push(`seniors ${SENIOR_DISCOUNT_LABEL}`)
    if (PWD_DISCOUNT_IN_SYSTEM) inSystem.push(`PWD ${PWD_DISCOUNT_LABEL}`)

    return (
        <div className="guest-counts">
            <div className="gc-row">
                <CounterCell
                    id="gc-adults"
                    label="Adults"
                    unit="adults"
                    value={pax ?? 0}
                    min={MIN_PAX}
                    max={null}
                    onStep={stepPax}
                    minusLabel="Remove one adult"
                    plusLabel="Add one adult"
                    plusTitle={capacityTitle}
                    error={adultsError}
                >
                    {/* The only typable one: parties big enough to make
                        stepping tedious enter the number directly. */}
                    <input
                        className="gc-value gc-value-input"
                        type="number"
                        id="gc-adults"
                        min={MIN_PAX}
                        placeholder="0"
                        aria-label="Number of adults"
                        aria-invalid={adultsError ? true : undefined}
                        value={pax ?? ''}
                        onChange={(e) => {
                            const value = e.target.value
                            onPaxChange?.(value === '' ? null : Math.max(MIN_PAX, Number(value)))
                        }}
                        onBlur={() => setTouched(true)}
                    />
                </CounterCell>

                <CounterCell
                    id="gc-kids"
                    label="Kids"
                    unit="7 & below"
                    value={kids ?? 0}
                    min={0}
                    max={MAX_OTHERS}
                    onStep={(delta) => onKidsChange?.(clampOther((kids ?? 0) + delta))}
                    minusLabel="Remove one kid"
                    plusLabel="Add one kid"
                >
                    <span className="gc-value" aria-live="polite" aria-atomic="true">{kids ?? 0}</span>
                </CounterCell>

                <CounterCell
                    id="gc-seniors"
                    label="Seniors"
                    unit="with ID"
                    value={seniors ?? 0}
                    min={0}
                    max={MAX_OTHERS}
                    onStep={(delta) => onSeniorsChange?.(clampOther((seniors ?? 0) + delta))}
                    minusLabel="Remove one senior citizen"
                    plusLabel="Add one senior citizen"
                >
                    <span className="gc-value" aria-live="polite" aria-atomic="true">{seniors ?? 0}</span>
                </CounterCell>

                <CounterCell
                    id="gc-pwd"
                    label="PWD"
                    unit="with ID"
                    value={pwd ?? 0}
                    min={0}
                    max={MAX_OTHERS}
                    onStep={(delta) => onPwdChange?.(clampOther((pwd ?? 0) + delta))}
                    minusLabel="Remove one person with disability"
                    plusLabel="Add one person with disability"
                >
                    <span className="gc-value" aria-live="polite" aria-atomic="true">{pwd ?? 0}</span>
                </CounterCell>
            </div>

            {adultsError && <p className="gc-error" role="alert">{adultsError}</p>}

            <ul className="gc-notes">
                <li>
                    Kids are <strong>7 years old and below</strong>. Count a guest{' '}
                    <strong>once</strong> — as a senior or as a PWD, not both.
                </li>
                {resortSide.length > 0 && (
                    <li>
                        The {joinList(resortSide)} discount is <strong>given at the resort</strong>,
                        so the total here is at the full rate. Declare the counts and present a
                        valid <strong>ID</strong> at check-in — it comes off the balance you settle
                        on-site.
                    </li>
                )}
                {inSystem.length > 0 && (
                    <li>
                        Discounts already applied to your total: {joinList(inSystem)} off the
                        entrance fee. Present a valid <strong>ID</strong> at check-in for validation.
                    </li>
                )}
            </ul>
        </div>
    )
}
