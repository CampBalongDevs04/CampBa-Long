import { formatCountdown } from './usePaymentWindow.js'
import './css/holdQueue.css'

// What guest 2 sees when guest 1 got there first.
//
// The message this replaces was "A-House Family is fully booked for that
// schedule. Next free date: Tuesday" — which was false twice over. The unit is
// not booked, it is HELD by someone who has not paid; and the next free moment
// is usually a few minutes away, not Tuesday. A guest who reads the old message
// leaves. A guest who reads this one waits, and usually gets the unit.
//
// Purely a display, like PaymentCountdown: every number comes from
// useBookingQueue, which gets them from Postgres. Nothing here decides who is
// next, and nothing here can make a booking — the retry it announces goes
// through book_accommodation() with the same checks as any other.

// 1st, 2nd, 3rd, 4th. Small enough that the Intl plural-rules machinery would
// be more code than the four cases it replaces.
function ordinal(n) {
    const rest = n % 100
    if (rest >= 11 && rest <= 13) return `${n}th`
    switch (n % 10) {
        case 1: return `${n}st`
        case 2: return `${n}nd`
        case 3: return `${n}rd`
        default: return `${n}th`
    }
}

export default function HoldQueueNotice({
    typeName = 'That unit',
    entry,
    msLeft = 0,
    ready = false,
    expired = false,
    error = null,
    // A booking attempt is in flight right now — either the automatic one when
    // the guest's turn came up, or their own retry.
    retrying = false,
    onLeave,
    onRejoin,
}) {
    // Before the first poll lands there is nothing to say but "asking".
    if (!entry && !expired) {
        return (
            <div className="hold-queue is-checking" role="status">
                <p className="hold-queue-title">Checking whether {typeName} is really gone…</p>
            </div>
        )
    }

    if (expired) {
        return (
            <div className="hold-queue is-expired" role="alert">
                <p className="hold-queue-title">You lost your place in line</p>
                <p className="hold-queue-note">
                    We stopped hearing from this page — a closed tab or a sleeping
                    phone will do it — so the place went to the next guest. You can
                    take a new one at the back of the line.
                </p>
                <div className="hold-queue-actions">
                    <button type="button" className="hold-queue-again" onClick={onRejoin}>
                        Get back in line
                    </button>
                    <button type="button" className="hold-queue-leave" onClick={onLeave}>
                        Pick a different unit
                    </button>
                </div>
            </div>
        )
    }

    // Promoted. The booking attempt is already on its way — this is a status
    // line, not an invitation to press anything.
    if (ready || retrying) {
        return (
            <div className="hold-queue is-ready" role="status" aria-live="polite">
                <p className="hold-queue-title">It&apos;s yours — reserving {typeName} now…</p>
                <p className="hold-queue-note">
                    The hold ahead of you lapsed and the unit is being held for you
                    while this goes through. Don&apos;t close this page.
                </p>
            </div>
        )
    }

    const { place, waiting, releasesAt, heldUnits } = entry
    // Held means it is coming back and we know when. Without a release time the
    // units are booked for real and the queue is only watching for a
    // cancellation — an honest but much weaker promise, said as one.
    const held = heldUnits > 0 && releasesAt != null

    return (
        <div className="hold-queue" role="status">
            <p className="hold-queue-title">
                {held
                    ? `${typeName} is held by another guest right now`
                    : `${typeName} is fully booked for those dates`}
            </p>

            {held && (
                <div className="hold-queue-clock">
                    <span className="hold-queue-clock-label">Their hold ends in</span>
                    {/* Announced on the minute only. A screen reader reciting a
                        ticking clock makes the rest of the form unusable. */}
                    <span
                        className="hold-queue-clock-time"
                        role="timer"
                        aria-live={msLeft % 60000 < 1000 ? 'polite' : 'off'}
                    >
                        {formatCountdown(msLeft)}
                    </span>
                </div>
            )}

            <p className="hold-queue-note">
                {held ? (
                    <>
                        They have 10 minutes to pay for it. If they don&apos;t, it goes
                        back on the market and we reserve it for you automatically —
                        you don&apos;t need to press anything or come back.
                    </>
                ) : (
                    <>
                        We&apos;ll keep watching these dates and reserve one for you the
                        moment a booking is cancelled or a hold lapses.
                    </>
                )}
            </p>

            <p className="hold-queue-place">
                You are <strong>{ordinal(place)}</strong> in line
                {waiting > 1 && <> of {waiting} guests waiting</>}.
                {place === 1 && held && ' It goes to you first.'}
            </p>

            {/* A poll that failed is not a place that was lost — the entry
                survives on the server without one for well over a minute. Said
                quietly, so a single dropped request does not read as a failure
                to hold the guest's place. */}
            {error && (
                <p className="hold-queue-hiccup">
                    Trouble reaching the resort — still holding your place, retrying…
                </p>
            )}

            <div className="hold-queue-actions">
                <button type="button" className="hold-queue-leave" onClick={onLeave}>
                    Don&apos;t wait — pick another unit
                </button>
            </div>
        </div>
    )
}
