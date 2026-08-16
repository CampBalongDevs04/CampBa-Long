import { useState } from 'react'
import './css/kidsCount.css'

const MIN_KIDS = 0
const MAX_KIDS = 20

// Kids aged 7 and below have no entrance fee, so this only tracks a headcount —
// it never feeds into the price. The stepper is button-only (no typing) to keep
// the value clean. Works controlled (kids/onKidsChange) or standalone.
//
// Kids are a subset of the total guests, so callers pass:
//   • disabled — true until at least one guest (pax) is set; grays the stepper.
//   • max      — the most kids allowed (remaining pax after seniors).
export default function KidsCount({ kids, onKidsChange, disabled = false, max = MAX_KIDS }){
    const [internalKids, setInternalKids] = useState(0)
    const current = kids ?? internalKids
    const ceiling = Math.min(MAX_KIDS, max)
    const inactive = disabled

    const clamp = (value) => Math.min(ceiling, Math.max(MIN_KIDS, value))

    const step = (delta) => {
        if (inactive) return
        const next = clamp(current + delta)
        setInternalKids(next)
        onKidsChange?.(next)
    }

    return (
        <div className={`kids-field${inactive ? ' kids-field-disabled' : ''}`}>
            <label className="kids-field-label" id="kids-count-label">
                Number of Kids
            </label>

            <div className="kids-counter" role="group" aria-labelledby="kids-count-label">
                <button
                    type="button"
                    className="kids-step"
                    aria-label="Remove one kid"
                    onClick={() => step(-1)}
                    disabled={inactive || current <= MIN_KIDS}
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
                    disabled={inactive || current >= ceiling}
                >
                    +
                </button>

                <span className="kids-counter-hint">kids</span>
            </div>

            <p className="kids-note" role="note">
                <span className="kids-note-dot" aria-hidden="true"></span>
                <span className="kids-note-body">
                    {disabled ? (
                        <>Set the <strong>number of guests</strong> first — kids are counted within your guest total.</>
                    ) : (
                        <>Only <strong>7 years old and below</strong></>
                    )}
                </span>
            </p>
        </div>
    )
}
