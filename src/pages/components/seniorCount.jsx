import { useState } from 'react'
import './css/seniorCount.css'
import { SENIOR_DISCOUNT_IN_SYSTEM, SENIOR_DISCOUNT_LABEL } from '../../data/entranceFee.js'

const MIN_SENIORS = 0
const MAX_SENIORS = 20

// A headcount, and — while the discount is given at the resort rather than by
// this system — ONLY a headcount. It still matters just as much: the front desk
// applies the discount against this number, so a guest who does not declare
// their seniors here has nothing for staff to work from. The note below says
// which of the two worlds we are in by reading the constant, so the promise
// made to the guest always matches what the totals actually do.
// Button-only stepper (no typing) to keep the value clean.
//
// An independent count, not a subset of Number of Adults — the party's total
// (booking.jsx's totalGuests) is adults + kids + seniors + pwd added together.
export default function SeniorCount({ seniors, onSeniorsChange }){
    const [internalSeniors, setInternalSeniors] = useState(0)
    const current = seniors ?? internalSeniors

    const clamp = (value) => Math.min(MAX_SENIORS, Math.max(MIN_SENIORS, value))

    const step = (delta) => {
        const next = clamp(current + delta)
        setInternalSeniors(next)
        onSeniorsChange?.(next)
    }

    return (
        <div className="senior-field">
            <label className="senior-field-label" id="senior-count-label">
                Senior Citizens
            </label>

            <div className="senior-counter" role="group" aria-labelledby="senior-count-label">
                <button
                    type="button"
                    className="senior-step"
                    aria-label="Remove one senior citizen"
                    onClick={() => step(-1)}
                    disabled={current <= MIN_SENIORS}
                >
                    &minus;
                </button>

                <span className="senior-count" aria-live="polite" aria-atomic="true">
                    {current}
                </span>

                <button
                    type="button"
                    className="senior-step"
                    aria-label="Add one senior citizen"
                    onClick={() => step(1)}
                    disabled={current >= MAX_SENIORS}
                >
                    +
                </button>

                <span className="senior-counter-hint">seniors</span>
            </div>

            <p className="senior-note" role="note">
                <span className="senior-note-dot" aria-hidden="true"></span>
                <span className="senior-note-body">
                    {SENIOR_DISCOUNT_IN_SYSTEM ? (
                        <>Senior citizens get <strong>{SENIOR_DISCOUNT_LABEL} off</strong> the entrance fee. Please
                        present a <strong>Senior Citizen ID</strong> or other valid ID upon
                        check-in for validation.</>
                    ) : (
                        <>The senior discount is <strong>given at the resort</strong>, so the total
                        you see here is at the full rate. Tell us how many seniors are coming
                        and present a <strong>Senior Citizen ID</strong> at check-in — it comes
                        off the balance you settle on-site.</>
                    )}
                </span>
            </p>
        </div>
    )
}
