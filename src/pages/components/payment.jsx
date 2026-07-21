import { useRef, useState } from 'react'
import '../components/css/payment.css'
import IreneQR from '../../assets/images/IreneGcash.jpg'

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

export default function Payment({ receipt, onReceiptChange }){
    const inputRef = useRef(null)
    const [previewUrl, setPreviewUrl] = useState(null)
    const [error, setError] = useState(null)

    const handleFile = (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!isAcceptedFile(file)){
            setError('Only JPG or PNG images are accepted.')
            e.target.value = ''
            return
        }

        setError(null)
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(URL.createObjectURL(file))
        onReceiptChange?.(file)
    }

    const removeReceipt = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
        setError(null)
        onReceiptChange?.(null)
        if (inputRef.current) inputRef.current.value = ''
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
                    <strong className="payment-note-heading">Down payment.</strong>{' '}
                    Scan the QR of your preferred method to settle the down payment,
                    then upload a screenshot of the receipt as proof of payment.
                </p>
            </div>

            <div className="payment-upload">
                {/* MIME-only accept: iOS auto-converts HEIC photos to JPEG,
                    and Android pickers can choke on extension entries. */}
                <input
                    ref={inputRef}
                    className="payment-upload-input"
                    type="file"
                    id="receipt-upload"
                    accept="image/jpeg,image/png"
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
                            onClick={removeReceipt}
                        >
                            &times;
                        </button>
                    </div>
                ) : (
                    /* A real <label> opens the picker natively on every
                       mobile browser — no JS click() needed. */
                    <label className="payment-upload-btn" htmlFor="receipt-upload">
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
