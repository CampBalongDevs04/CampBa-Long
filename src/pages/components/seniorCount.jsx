import { useState } from 'react'
import './css/seniorCount.css'

const MIN_SENIORS = 0
const MAX_SENIORS = 20

// Senior citizens get 10% off the per-head entrance fee. This only tracks a
// headcount; the discount is applied where the entrance fee is totalled.
// Button-only stepper (no typing) to keep the value clean.
//
// Seniors are a subset of the total guests, so callers pass:
//   • disabled — true until at least one guest (pax) is set; grays the stepper.
//   • max      — the most seniors allowed (remaining pax after kids).
export default function SeniorCount({ seniors, onSeniorsChange, disabled = false, max = MAX_SENIORS }){
    const [internalSeniors, setInternalSeniors] = useState(0)
    const current = seniors ?? internalSeniors
    const ceiling = Math.min(MAX_SENIORS, max)

    const clamp = (value) => Math.min(ceiling, Math.max(MIN_SENIORS, value))

    const step = (delta) => {
        if (disabled) return
        const next = clamp(current + delta)
        setInternalSeniors(next)
        onSeniorsChange?.(next)
    }

    return (
        <div className={`senior-field${disabled ? ' senior-field-disabled' : ''}`}>
            <label className="senior-field-label" id="senior-count-label">
                Senior Citizens
            </label>

            <div className="senior-counter" role="group" aria-labelledby="senior-count-label">
                <button
                    type="button"
                    className="senior-step"
                    aria-label="Remove one senior citizen"
                    onClick={() => step(-1)}
                    disabled={disabled || current <= MIN_SENIORS}
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
                    disabled={disabled || current >= ceiling}
                >
                    +
                </button>

                <span className="senior-counter-hint">seniors</span>
            </div>

            <p className="senior-note" role="note">
                <span className="senior-note-dot" aria-hidden="true"></span>
                {disabled ? (
                    <>Set the <strong>number of guests</strong> first — seniors are counted within your guest total.</>
                ) : (
                    <>Senior citizens get <strong>10% off</strong> the entrance fee. Please
                    present a <strong>Senior Citizen ID</strong> or other valid ID upon
                    check-in for validation.</>
                )}
            </p>
        </div>
    )
}
