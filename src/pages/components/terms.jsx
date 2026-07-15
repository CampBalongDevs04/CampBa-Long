import '../components/css/terms.css'

const policies = [
    'Guests must arrive on time; late check-in may shorten your reserved hours.',
    'No hidden charges for normal use, but damaged chairs, tables, linens, fixtures, or missing items will be charged after inspection.',
    'Cancellation is no longer allowed once the down payment has been made.',
]

export default function Terms({ agreed, onAgreeChange, onConfirm }){
    return(
        <div className="terms">
            <div className="terms-card">
                <p className="terms-warning">Please read first before paying</p>

                <ul className="terms-list">
                    {policies.map((policy) => (
                        <li className="terms-item" key={policy}>{policy}</li>
                    ))}
                </ul>
            </div>

            <label className="terms-agree" htmlFor="terms-agree-check">
                <input
                    className="terms-agree-check"
                    type="checkbox"
                    id="terms-agree-check"
                    checked={agreed}
                    onChange={(e) => onAgreeChange?.(e.target.checked)}
                />
                <span className="terms-agree-text">
                    I have read and agree to the terms and resort policy.
                </span>
            </label>

            <button
                type="button"
                className={`terms-confirm${agreed ? ' terms-confirm-ready' : ''}`}
                disabled={!agreed}
                onClick={onConfirm}
            >
                Confirm Booking
            </button>
        </div>
    )
}
