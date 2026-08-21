import { useState } from 'react'
import '../components/css/paxInput.css'

// Who the booking is for. The headcounts that used to sit under these fields
// (adults/kids/seniors/PWD) are one row of their own now — see guestCounts.jsx.
export default function PaxInput({ guest, onGuestChange, fieldErrors, showErrors }){
    const errors = fieldErrors ?? {}

    // Booking.jsx knows WHAT is wrong with a field (guestFieldErrors); this
    // component decides WHEN to say so — once the guest has left the field
    // (blurred it), or once they've pressed Confirm and every unresolved
    // field needs to speak up (showErrors).
    const [touched, setTouched] = useState({ fullName: false, mobile: false, email: false })
    const markTouched = (field) => () => setTouched((current) => ({ ...current, [field]: true }))
    const errorFor = (field) => (touched[field] || showErrors) ? errors[field] : null

    const fullNameError = errorFor('fullName')
    const mobileError = errorFor('mobile')
    const emailError = errorFor('email')

    const setField = (field) => (e) => onGuestChange?.({ ...guest, [field]: e.target.value })

    return(
        <div className="guest-info">
            <div className="pax-form">
                <div className="pax-field pax-field-full">
                    <label className="pax-field-label" htmlFor="guest-fullname">Full Name</label>
                    <input
                        className={`pax-field-input${fullNameError ? ' pax-field-input-error' : ''}`}
                        type="text"
                        id="guest-fullname"
                        placeholder="e.g. Juan Dela Cruz"
                        autoComplete="name"
                        aria-invalid={fullNameError ? true : undefined}
                        value={guest?.fullName ?? ''}
                        onChange={setField('fullName')}
                        onBlur={markTouched('fullName')}
                    />
                    {fullNameError && <p className="pax-field-error" role="alert">{fullNameError}</p>}
                </div>

                <div className="pax-field">
                    <label className="pax-field-label" htmlFor="guest-mobile">Mobile Number</label>
                    <input
                        className={`pax-field-input${mobileError ? ' pax-field-input-error' : ''}`}
                        type="tel"
                        id="guest-mobile"
                        placeholder="e.g. 0917 123 4567"
                        autoComplete="tel"
                        inputMode="tel"
                        aria-invalid={mobileError ? true : undefined}
                        value={guest?.mobile ?? ''}
                        onChange={setField('mobile')}
                        onBlur={markTouched('mobile')}
                    />
                    {mobileError && <p className="pax-field-error" role="alert">{mobileError}</p>}
                </div>

                <div className="pax-field">
                    <label className="pax-field-label" htmlFor="guest-email">Email</label>
                    <input
                        className={`pax-field-input${emailError ? ' pax-field-input-error' : ''}`}
                        type="email"
                        id="guest-email"
                        placeholder="e.g. juan@email.com"
                        autoComplete="email"
                        aria-invalid={emailError ? true : undefined}
                        value={guest?.email ?? ''}
                        onChange={setField('email')}
                        onBlur={markTouched('email')}
                    />
                    {emailError && <p className="pax-field-error" role="alert">{emailError}</p>}
                </div>
            </div>
        </div>
    )
}
