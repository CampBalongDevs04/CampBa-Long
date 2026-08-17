import { useState } from 'react'
import './css/kidsCount.css'
import { KIDS_DISCOUNT_IN_SYSTEM, KIDS_DISCOUNT_LABEL } from '../../data/entranceFee.js'

const MIN_KIDS = 0
const MAX_KIDS = 20

// A headcount, and — while the discount is given at the resort rather than by
// this system — ONLY a headcount. The front desk applies the discount against
// this number, so a guest who does not declare their kids here has nothing
// for staff to work from. The note below says which of the two worlds we are
// in by reading the constant, so the promise made to the guest always
// matches what the totals actually do (see KIDS_DISCOUNT_RATE).
// Button-only stepper (no typing) to keep the value clean.
//
// An independent count, not a subset of Number of Adults — the party's total
// (booking.jsx's totalGuests) is adults + kids + seniors + pwd added together.
export default function KidsCount({ kids, onKidsChange }){
    const [internalKids, setInternalKids] = useState(0)
    const current = kids ?? internalKids

    const clamp = (value) => Math.min(MAX_KIDS, Math.max(MIN_KIDS, value))

    const step = (delta) => {
        const next = clamp(current + delta)
        setInternalKids(next)
        onKidsChange?.(next)
    }

    return (
        <div className="kids-field">
            <label className="kids-field-label" id="kids-count-label">
                Number of Kids
            </label>

            <div className="kids-counter" role="group" aria-labelledby="kids-count-label">
                <button
                    type="button"
                    className="kids-step"
                    aria-label="Remove one kid"
                    onClick={() => step(-1)}
                    disabled={current <= MIN_KIDS}
                >
                    &minus;
                </button>

                <span className="kids-count" aria-live="polite" aria-atomic="true">
                    {current}
                </span>

                <button
                    type="button"
                    className="kids-step"
                    aria-label="Add one kid"
                    onClick={() => step(1)}
                    disabled={current >= MAX_KIDS}
                >
                    +
                </button>

                <span className="kids-counter-hint">kids</span>
            </div>

            <p className="kids-note" role="note">
                <span className="kids-note-dot" aria-hidden="true"></span>
                <span className="kids-note-body">
                    Only <strong>7 years old and below</strong>.{' '}
                    {KIDS_DISCOUNT_IN_SYSTEM ? (
                        <>Kids get <strong>{KIDS_DISCOUNT_LABEL} off</strong> the entrance fee. Please
                        present ID for validation upon check-in.</>
                    ) : (
                        <>The kids' discount is <strong>given at the resort</strong>, so the total
                        you see here is at the full rate. Tell us how many kids are coming —
                        it comes off the balance you settle on-site.</>
                    )}
                </span>
            </p>
        </div>
    )
}
