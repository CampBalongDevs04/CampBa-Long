import { useEffect, useMemo, useState } from 'react'
import '../components/css/payment.css'
import { useMyBookingPage, resolveQrImage } from '../../data/myBookingPage.js'

// The QR codes and the receipt picker. This used to be step 4 of the booking
// form; it now lives inside the My Bookings payment panel
// (components/bookingPayment.jsx), because paying happens after the unit is
// held rather than before it exists. The markup and payment.css are unchanged —
// only who renders it moved.
//
// The cards themselves used to be a `paymentOptions` array right here, with the
// GCash QR imported from src/assets — so changing the resort's number, or
// adding a second way to pay, was a code change. They are rows now
// (public.payment_methods, edited in CMS → My Booking → Payment & QR); the
// array that shipped with the site survives as the fallback in
// data/myBookingPage.js, which is what renders until the database answers.

const ACCEPTED_TYPES = ['image/jpeg', 'image/png']
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png)$/i

/* Some Android WebViews report an empty file.type, so fall back
   to checking the file extension before rejecting. */
function isAcceptedFile(file){
    if (file.type) return ACCEPTED_TYPES.includes(file.type)
    return ACCEPTED_EXTENSIONS.test(file.name)
}

function formatSize(bytes){
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default function Payment({ receipt, onReceiptChange, note, disabled = false, inputId = 'receipt-upload' }){
    const [error, setError] = useState(null)
    const { activeMethods, page: { uploadWarning } } = useMyBookingPage()

    // Derived from the file rather than held alongside it, so the preview cannot
    // outlive what it previews: the parent clears `receipt` once the payment is
    // recorded, and the thumbnail of an already-sent receipt goes with it.
    const previewUrl = useMemo(
        () => (receipt ? URL.createObjectURL(receipt) : null),
        [receipt],
    )
    useEffect(() => {
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
    }, [previewUrl])

    const handleFile = (e) => {
        const file = e.target.files?.[0]
        // Emptied either way, so picking the SAME file again still fires a
        // change event. The chosen file lives in the parent's state from here.
        e.target.value = ''
        if (!file) return

        if (!isAcceptedFile(file)){
            setError('Only JPG or PNG images are accepted.')
            return
        }

        setError(null)
        onReceiptChange?.(file)
    }

    const removeReceipt = () => {
        setError(null)
        onReceiptChange?.(null)
    }

    return(
        <div className="payment">
            {/* Every card is hidden, or there are none. Guests still have a
                booking to settle, so they are pointed at a person rather than
                left with a gap where the QR codes were — an empty grid reads as
                a page that failed to load, and a guest who concludes that will
                either wait for it to come back or pay nobody. Only staff can
                cause this, by hiding or deleting the last method. */}
            {activeMethods.length === 0 ? (
                <p className="payment-none" role="status">
                    Our payment details are being updated. Message the resort and we
                    will send you where to pay — your unit stays held in the meantime.
                </p>
            ) : (
            <div className="payment-grid">
                {activeMethods.map((option) => {
                    // A row can carry a QR two ways — the one bundled with the
                    // build, or one staff uploaded over it. Neither is required:
                    // the bank transfer card has never had one, and its empty
                    // frame says so rather than leaving a hole in the grid.
                    const qr = resolveQrImage(option.qrKey, option.qrUrl)
                    return (
                        <div className="payment-card" key={option.id}>
                            <p className="payment-method">{option.method}</p>

                            {qr ? (
                                <img
                                    className="payment-qr"
                                    src={qr}
                                    alt={`${option.method} QR code`}
                                />
                            ) : (
                                <div className="payment-qr payment-qr-placeholder">
                                    <span>QR code coming soon</span>
                                </div>
                            )}

                            <p className="payment-account-name">{option.accountName}</p>
                            {option.accountNumber && (
                                <p className="payment-account-number">{option.accountNumber}</p>
                            )}
                        </div>
                    )
                })}
            </div>
            )}

            <div className="payment-note" role="note">
                <span className="payment-note-dot"></span>
                <p className="payment-note-body">
                    {note ?? (
                        <>
                            <strong className="payment-note-heading">Down payment.</strong>{' '}
                            Scan the QR of your preferred method to settle the down payment,
                            then upload a screenshot of the receipt as proof of payment.
                        </>
                    )}
                </p>
            </div>

            <div className="payment-upload">
                {/* Above the button rather than under it, so it is read with a
                    thumb on the way to the file picker rather than after the
                    wrong file has already been chosen. It stays put once a
                    receipt is picked — the preview replaces the button, and a
                    guest who realises they grabbed the wrong screenshot can
                    still remove it. */}
                {uploadWarning && (
                    <p className="payment-upload-warning" role="note">
                        <span className="payment-upload-warning-icon" aria-hidden="true">!</span>
                        {uploadWarning}
                    </p>
                )}

                {/* MIME-only accept: iOS auto-converts HEIC photos to JPEG,
                    and Android pickers can choke on extension entries. */}
                <input
                    className="payment-upload-input"
                    type="file"
                    id={inputId}
                    accept="image/jpeg,image/png"
                    disabled={disabled}
                    onChange={handleFile}
                />

                {receipt ? (
                    <div className="payment-receipt">
                        {previewUrl && (
                            <img
                                className="payment-receipt-thumb"
                                src={previewUrl}
                                alt="Receipt preview"
                            />
                        )}
                        <div className="payment-receipt-info">
                            <p className="payment-receipt-name">{receipt.name}</p>
                            <p className="payment-receipt-size">{formatSize(receipt.size)}</p>
                        </div>
                        <button
                            type="button"
                            className="payment-receipt-remove"
                            aria-label="Remove receipt"
                            disabled={disabled}
                            onClick={removeReceipt}
                        >
                            &times;
                        </button>
                    </div>
                ) : (
                    /* A real <label> opens the picker natively on every
                       mobile browser — no JS click() needed. */
                    <label className="payment-upload-btn" htmlFor={inputId}>
                        Upload Receipt
                        <span className="payment-upload-hint">JPG or PNG</span>
                    </label>
                )}

                {error && (
                    <p className="payment-upload-error" role="alert">{error}</p>
                )}
            </div>
        </div>
    )
}
