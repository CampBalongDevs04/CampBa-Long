import { formatCountdown } from './usePaymentWindow.js'

// The clock on an unpaid booking. Purely a display of usePaymentWindow — it
// holds no state and decides nothing, so the same numbers drive the panel's
// behaviour and the bar the guest is watching.

// Under two minutes the styling changes: this is the point where "I will do it
// in a moment" stops being true, and the guest needs to know that before the
// timer runs out rather than after.
const URGENT_MS = 2 * 60 * 1000

export default function PaymentCountdown({ msLeft, totalMs, windowMinutes }) {
    const urgent = msLeft <= URGENT_MS
    // Drains left to right as the time goes. Clamped, because a clock skew
    // correction landing mid-tick can briefly put msLeft above the full window.
    const remaining = Math.min(100, Math.max(0, (msLeft / totalMs) * 100))

    return (
        <div className={`pay-clock${urgent ? ' is-urgent' : ''}`}>
            <div className="pay-clock-top">
                <span className="pay-clock-label">
                    {urgent ? 'Time is almost up' : 'Time left to pay'}
                </span>
                {/* Announced on the minute rather than every second: a screen
                    reader reciting a ticking clock makes the page unusable,
                    while silence would hide the deadline entirely. */}
                <span
                    className="pay-clock-time"
                    role="timer"
                    aria-live={msLeft % 60000 < 1000 ? 'polite' : 'off'}
                >
                    {formatCountdown(msLeft)}
                </span>
            </div>

            <div
                className="pay-clock-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={totalMs}
                aria-valuenow={msLeft}
                aria-label="Time left to send your down payment"
            >
                <span className="pay-clock-fill" style={{ width: `${remaining}%` }} />
            </div>

            <p className="pay-clock-note">
                Your unit is held for {windowMinutes} minutes. Upload your payment
                receipt before the timer ends — if you don&apos;t, this booking is
                cancelled automatically and the unit goes back to other guests.
            </p>
        </div>
    )
}
