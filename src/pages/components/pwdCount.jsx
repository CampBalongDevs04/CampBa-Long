import { useState } from 'react'
import './css/pwdCount.css'
import { PWD_DISCOUNT_IN_SYSTEM, PWD_DISCOUNT_LABEL } from '../../data/entranceFee.js'

const MIN_PWD = 0
const MAX_PWD = 20

// Persons with disability, counted exactly the way senior citizens are: a
// headcount that travels with the booking, not a discount this system applies.
// The resort gives the PWD discount at the front desk against the PWD ID the
// guest presents, so what has to reach staff is the NUMBER — a guest who does
// not declare it here leaves the desk with nothing to work from.
//
// Button-only stepper (no typing) to keep the value clean.
//
// An independent count, not a subset of Number of Adults — the party's total
// (booking.jsx's totalGuests) is adults + kids + seniors + pwd added together.
//
// A guest who is both a senior and a PWD is counted once, under whichever
// discount they intend to claim — the two IDs cannot be used together on the
// same head, and the note below says so rather than leaving staff to discover
// a party whose declared counts add up to more than the people who arrive.
export default function PwdCount({ pwd, onPwdChange }){
    const [internalPwd, setInternalPwd] = useState(0)
    const current = pwd ?? internalPwd

    const clamp = (value) => Math.min(MAX_PWD, Math.max(MIN_PWD, value))

    const step = (delta) => {
        const next = clamp(current + delta)
        setInternalPwd(next)
        onPwdChange?.(next)
    }

    return (
        <div className="pwd-field">
            <label className="pwd-field-label" id="pwd-count-label">
                Persons with Disability
            </label>

            <div className="pwd-counter" role="group" aria-labelledby="pwd-count-label">
                <button
                    type="button"
                    className="pwd-step"
                    aria-label="Remove one person with disability"
                    onClick={() => step(-1)}
                    disabled={current <= MIN_PWD}
                >
                    &minus;
                </button>

                <span className="pwd-count" aria-live="polite" aria-atomic="true">
                    {current}
                </span>

                <button
                    type="button"
                    className="pwd-step"
                    aria-label="Add one person with disability"
                    onClick={() => step(1)}
                    disabled={current >= MAX_PWD}
                >
                    +
                </button>

                <span className="pwd-counter-hint">PWD</span>
            </div>

            <p className="pwd-note" role="note">
                <span className="pwd-note-dot" aria-hidden="true"></span>
                <span className="pwd-note-body">
                    {PWD_DISCOUNT_IN_SYSTEM ? (
                        <>Persons with disability get <strong>{PWD_DISCOUNT_LABEL} off</strong> the
                        entrance fee. Please present a <strong>PWD ID</strong> upon check-in for
                        validation.</>
                    ) : (
                        <>The PWD discount is <strong>given at the resort</strong>, so the total you
                        see here is at the full rate. Tell us how many PWD guests are coming and
                        present a <strong>PWD ID</strong> at check-in — it comes off the balance you
                        settle on-site. Count a guest <strong>once</strong>: as a senior or as a PWD,
                        not both.</>
                    )}
                </span>
            </p>
        </div>
    )
}
