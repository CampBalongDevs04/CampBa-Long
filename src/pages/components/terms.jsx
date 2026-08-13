import '../components/css/terms.css'
import { useBookingPage } from '../../data/bookingPage.js'

// The last panel on /booking: the resort policy a guest has to read, the tick
// box that says they did, and the button that reserves the unit.
//
// Every word here is editable in the dashboard's CMS → Booking → Reserve Policy
// (data/bookingPage.js) — including the button, which is why it is no longer a
// prop. This is the only place the component is used, and a caller passing a
// label would silently outrank what staff typed.
export default function Terms({
    agreed,
    onAgreeChange,
    onConfirm,
    submitting = false,
}){
    const { page, activePolicies } = useBookingPage()

    return(
        <div className="terms">
            {/* The card is the warning and the list it introduces. With no
                policies left and nothing to warn about, there is no card. */}
            {(page.policyWarning || activePolicies.length > 0) && (
                <div className="terms-card">
                    {page.policyWarning && (
                        <p className="terms-warning">{page.policyWarning}</p>
                    )}

                    {activePolicies.length > 0 && (
                        <ul className="terms-list">
                            {activePolicies.map((policy) => (
                                <li className="terms-item" key={policy.id}>{policy.policy}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <label className="terms-agree" htmlFor="terms-agree-check">
                <input
                    className="terms-agree-check"
                    type="checkbox"
                    id="terms-agree-check"
                    checked={agreed}
                    onChange={(e) => onAgreeChange?.(e.target.checked)}
                />
                <span className="terms-agree-text">
                    {page.agreeLabel}
                </span>
            </label>

            {/* Held open while the unit is being reserved, so an impatient
                second click can't create a second booking. */}
            <button
                type="button"
                className={`terms-confirm${agreed ? ' terms-confirm-ready' : ''}`}
                disabled={!agreed || submitting}
                onClick={onConfirm}
            >
                {submitting ? 'Reserving your unit…' : page.confirmLabel}
            </button>
        </div>
    )
}
