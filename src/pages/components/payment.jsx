import { useEffect, useMemo, useState } from 'react'
import '../components/css/payment.css'
import IreneQR from '../../assets/images/IreneGcash.jpg'

// The QR codes and the receipt picker. This used to be step 4 of the booking
// form; it now lives inside the My Bookings payment panel
// (components/bookingPayment.jsx), because paying happens after the unit is
// held rather than before it exists. The markup and payment.css are unchanged —
// only who renders it moved.

const paymentOptions = [
    {
        id: 'gcash',
        method: 'GCash',
        name: 'IR**E B.',
        number: '0919 033 ....',
        imageQR: IreneQR,
    },
    {
        id: 'bank-transfer',
        method: 'Bank Transfer',
        name: 'Gabriel Aramullo',
        number: null,
        imageQR: null,
    },
]

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
            <div className="payment-grid">
                {paymentOptions.map((option) => (
                    <div className="payment-card" key={option.id}>
                        <p className="payment-method">{option.method}</p>

                        {option.imageQR ? (
                            <img
                                className="payment-qr"
                                src={option.imageQR}
                                alt={`${option.method} QR code`}
                            />
                        ) : (
                            <div className="payment-qr payment-qr-placeholder">
                                <span>QR code coming soon</span>
                            </div>
                        )}

                        <p className="payment-account-name">{option.name}</p>
                        {option.number && (
                            <p className="payment-account-number">{option.number}</p>
                        )}
                    </div>
                ))}
            </div>

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
