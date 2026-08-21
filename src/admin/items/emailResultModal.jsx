import { useEffect } from 'react'
import '../css/receipt-viewer.css'
import '../css/email-result.css'

// What the guest was told, as a modal staff have to dismiss.
//
// This replaced a one-line note in the toolbar. The line was accurate and
// nobody read it: staff click Approve and move to the next row, and a decision
// they have already made does not send their eye back to a strip of text above
// the table. When the email then failed, the first anyone knew was a guest
// arriving with no confirmation — the exact failure the emails exist to stop.
//
// So the outcome interrupts. It costs one dismissal per approval, which is the
// right price: "did that guest get their email" is the only question staff
// have afterwards, and this is the answer, in front of them, before they carry
// on.
//
// It is deliberately NOT a confirmation dialog. The booking is already saved
// and the guest is already told (or not) by the time this appears; there is
// nothing here to accept or cancel. Both buttons close it.
export default function EmailResultModal({ result, onClose }) {
    // BOTH EFFECTS ARE GUARDED ON `open`, and that guard is the whole point.
    //
    // Hooks cannot sit below the `if (!result) return null` further down —
    // React requires the same hooks on every render — so they run even when
    // this component is rendering nothing. Unguarded, mounting it with no
    // result to show still set document.body.style.overflow = 'hidden', and
    // since the admin board renders it for the life of the screen rather than
    // only while it is open, that locked the ENTIRE dashboard: no scrolling on
    // the bookings table or any overview tab, with no dialog on screen to
    // explain why. Rendering null is not the same as being unmounted.
    //
    // Every other modal here (receiptViewer, settlePaymentModal) escapes this
    // by being mounted only while open — `{reviewing && <ReceiptViewer …>}` —
    // so their effects never run early. This one is safe either way now.
    const open = Boolean(result)

    useEffect(() => {
        if (!open) return undefined
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [open])

    useEffect(() => {
        if (!open) return undefined
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose?.()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [open, onClose])

    if (!result) return null

    const { ok, guestName, guestEmail, action, message, detail } = result

    return (
        <div
            className="receipt-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-result-title"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.()
            }}
        >
            <div className={`email-result-modal${ok ? ' is-ok' : ' is-warn'}`}>
                <div className="email-result-mark" aria-hidden="true">
                    {ok ? '✓' : '!'}
                </div>

                <h2 className="email-result-title" id="email-result-title">
                    {ok ? 'Email sent' : 'Email was not sent'}
                </h2>

                <p className="email-result-lead">
                    {ok ? (
                        <>
                            {guestName} has been emailed that their booking was{' '}
                            {action}.
                        </>
                    ) : (
                        <>
                            The booking was {action} and saved, but {guestName} has{' '}
                            <strong>not</strong> been told.
                        </>
                    )}
                </p>

                {guestEmail ? (
                    <p className="email-result-address">{guestEmail}</p>
                ) : null}

                {/* On success this is absent — there is nothing to explain. On
                    failure it is the whole point of the modal: the sentence
                    naming what to fix, straight from describeEmailError(). */}
                {!ok && message ? (
                    <p className="email-result-reason">{message}</p>
                ) : null}

                {/* The service and template actually used. Only on failure, and
                    only because the commonest cause of "no email arrives" is a
                    template_autoreply in Supabase pointing at a DIFFERENT
                    template from the one that was just edited in the EmailJS
                    dashboard — which looks identical to every other failure
                    until you compare the two IDs side by side. */}
                {!ok && detail ? (
                    <p className="email-result-detail">
                        Tried template <code>{detail.templateId}</code> on service{' '}
                        <code>{detail.serviceId}</code>. Check this is the template you
                        edited in EmailJS.
                    </p>
                ) : null}

                {!ok ? (
                    <p className="email-result-followup">
                        Please contact the guest directly.
                    </p>
                ) : null}

                <button
                    type="button"
                    className="email-result-close"
                    onClick={onClose}
                    autoFocus
                >
                    Done
                </button>
            </div>
        </div>
    )
}
