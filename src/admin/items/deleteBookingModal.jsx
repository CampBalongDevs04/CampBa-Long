import { useEffect, useState } from 'react'
import '../css/receipt-viewer.css'
import '../css/email-result.css'
import '../css/delete-booking.css'
import { deleteBooking, deleteBookingGroup } from '../../data/accommodationDB.js'

// "Delete this booking for good?" — the one destructive action on the Bookings
// tab that cannot be walked back, so unlike Cancel and Undo it asks first.
//
// Mounted only while open, like receiptViewer and settlePaymentModal, so the
// scroll lock below never runs with nothing on screen.
export default function DeleteBookingModal({ booking, stayLabel, onClose }) {
    const [deleting, setDeleting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [])

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape' && !deleting) onClose()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [deleting, onClose])

    const confirm = async () => {
        setDeleting(true)
        setError('')
        const result = booking.isGroup
            ? await deleteBookingGroup(booking.id, { asStaff: true })
            : await deleteBooking(booking.id, { asStaff: true })
        if (result.ok) {
            onClose()
            return
        }
        setDeleting(false)
        setError(result.message || 'The booking could not be deleted.')
    }

    const hasReceipt = Boolean(booking.receiptPath) || (booking.receipts?.length ?? 0) > 0

    return (
        <div
            className="receipt-overlay"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-booking-title"
            aria-describedby="delete-booking-lead"
            onClick={(e) => {
                if (e.target === e.currentTarget && !deleting) onClose()
            }}
        >
            <div className="email-result-modal delete-booking-modal">
                <div className="email-result-mark" aria-hidden="true">!</div>

                <h2 className="email-result-title" id="delete-booking-title">
                    Delete this booking?
                </h2>

                <p className="email-result-lead" id="delete-booking-lead">
                    <strong>{booking.code ?? booking.id}</strong>
                    {' · '}
                    {booking.guest?.fullName || 'Unnamed guest'}
                </p>
                <p className="email-result-address">{stayLabel}</p>

                <p className="email-result-reason">
                    This permanently removes the booking from the dashboard, the Units
                    board and the guest&rsquo;s My Booking page
                    {hasReceipt ? ', together with its receipt images' : ''}. It
                    cannot be undone.
                </p>

                {error && <p className="delete-booking-error" role="alert">{error}</p>}

                <div className="delete-booking-actions">
                    <button
                        type="button"
                        className="delete-booking-keep"
                        onClick={onClose}
                        disabled={deleting}
                        autoFocus
                    >
                        Keep it
                    </button>
                    <button
                        type="button"
                        className="delete-booking-confirm"
                        onClick={confirm}
                        disabled={deleting}
                    >
                        {deleting ? 'Deleting…' : 'Delete permanently'}
                    </button>
                </div>
            </div>
        </div>
    )
}
