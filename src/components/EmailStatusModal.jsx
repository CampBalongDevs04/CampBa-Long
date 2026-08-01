import { useEffect, useRef } from 'react'
import './css/email-status-modal.css'

// The dialog the contact form raises after a send attempt.
//
// It exists mainly for the failure case. A form that just goes quiet is the
// worst outcome here: the guest assumes the enquiry is on its way, the admin
// inbox never receives it, and nobody finds out until the guest gives up
// waiting for a reply. So a failure has to interrupt — hence a modal rather
// than an inline line of red text under the button, which people scrolling
// away from a long form genuinely do not see.
//
// The success case reuses the same shell so both outcomes land in the same
// place on screen and the form is never ambiguous about what happened.
export default function EmailStatusModal({ status, message, onClose }) {
    const closeRef = useRef(null)

    // Move focus into the dialog when it opens, and let Escape dismiss it.
    // Without this the keyboard stays behind the overlay on the form fields,
    // which is both a trap for screen-reader users and an easy way to submit
    // the form a second time while the first result is still on screen.
    useEffect(() => {
        if (!status) return
        closeRef.current?.focus()

        function onKeyDown(event) {
            if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [status, onClose])

    if (!status) return null

    const isError = status === 'error'

    return (
        <div
            className="email-modal-overlay"
            // A click on the backdrop dismisses, but only when the backdrop
            // itself was the target — otherwise a drag that starts inside the
            // card and ends outside it closes the dialog by accident.
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div
                className={`email-modal ${isError ? 'is-error' : 'is-success'}`}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="email-modal-title"
                aria-describedby="email-modal-body"
            >
                <div className="email-modal-icon" aria-hidden="true">
                    {isError ? '!' : '✓'}
                </div>

                <h2 className="email-modal-title" id="email-modal-title">
                    {isError ? 'Message not sent' : 'Message sent'}
                </h2>

                <p className="email-modal-body" id="email-modal-body">
                    {message}
                </p>

                {isError && (
                    <p className="email-modal-fallback">
                        You can also reach us directly at{' '}
                        <a href="mailto:campBalongExample@gmail.com">
                            campBalongExample@gmail.com
                        </a>
                        .
                    </p>
                )}

                <button
                    type="button"
                    className="email-modal-btn"
                    onClick={onClose}
                    ref={closeRef}
                >
                    {isError ? 'Close' : 'Done'}
                </button>
            </div>
        </div>
    )
}
