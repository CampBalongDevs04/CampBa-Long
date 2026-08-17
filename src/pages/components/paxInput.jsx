import { useState } from 'react'
import '../components/css/paxInput.css'

// Floor for the counter. There is no ceiling: a unit's own minPax/maxPax
// shapes the fit note in booking.jsx (getFitNote, accomodationOptions.js)
// rather than the counter itself, so the guest is always allowed to type the
// real size of their group and be told how it sits against the unit(s) they
// picked.
const MIN_PAX = 1

export default function PaxInput({ pax, onPaxChange, cartLines, guest, onGuestChange, fieldErrors, showErrors }){
    const lines = cartLines ?? []
    const errors = fieldErrors ?? {}

    // Booking.jsx knows WHAT is wrong with a field (guestFieldErrors); this
    // component decides WHEN to say so — once the guest has left the field
    // (blurred it), or once they've pressed Confirm and every unresolved
    // field needs to speak up (showErrors).
    const [touched, setTouched] = useState({ fullName: false, mobile: false, email: false, pax: false })
    const markTouched = (field) => () => setTouched((current) => ({ ...current, [field]: true }))
    const errorFor = (field) => (touched[field] || showErrors) ? errors[field] : null

    const fullNameError = errorFor('fullName')
    const mobileError = errorFor('mobile')
    const emailError = errorFor('email')
    const paxRequiredError = errorFor('pax')

    // The counter is NOT capped at the cart's combined maxPax. Silently
    // refusing the 6th guest of a 5-pax cottage looks like a broken button;
    // letting the number through and answering with the warning above tells
    // them what is actually wrong, and Confirm is what holds the booking back
    // (booking.jsx). minPax is never enforced at all — the rate is per unit,
    // not per head, so a smaller group is free to book and only gets the note.
    const cartUnlimited = lines.some((line) => line.option.maxPax == null)
    const capacity = lines.length > 0 && !cartUnlimited
        ? lines.reduce((sum, line) => sum + line.option.maxPax * line.qty, 0)
        : null
    const limited = capacity != null

    const clamp = (value) => Math.max(MIN_PAX, value)
    const step = (delta) => onPaxChange?.(clamp((pax ?? 0) + delta))
    const setField = (field) => (e) => onGuestChange?.({ ...guest, [field]: e.target.value })

    const capacityTitle = limited
        ? `Your selected accommodation${lines.length > 1 ? 's take' : ' takes'} up to ${capacity}.`
        : undefined

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

                <div className="pax-field">
                    <label className="pax-field-label" htmlFor="pax">Number of Adults</label>
                    <div className="pax-counter">
                        <button
                            type="button"
                            className="pax-step"
                            aria-label="Remove one adult"
                            onClick={() => step(-1)}
                            disabled={!pax || pax <= MIN_PAX}
                        >
                            &minus;
                        </button>

                        <input
                            className={`pax-count${paxRequiredError ? ' pax-count-over' : ''}`}
                            type="number"
                            id="pax"
                            min={MIN_PAX}
                            aria-invalid={paxRequiredError || undefined}
                            placeholder="0"
                            aria-label="Number of adults"
                            value={pax ?? ''}
                            onChange={(e) => {
                                const value = e.target.value
                                onPaxChange?.(value === '' ? null : clamp(Number(value)))
                            }}
                            onBlur={markTouched('pax')}
                        />

                        <button
                            type="button"
                            className="pax-step"
                            aria-label="Add one adult"
                            onClick={() => step(1)}
                            title={capacityTitle}
                        >
                            +
                        </button>

                        {/* "fits N" is the WHOLE party's capacity (kids/seniors/
                            PWD included) — kept as a hover tooltip via
                            capacityTitle rather than crammed next to a count
                            that only shows adults, so it can't be misread as
                            "N adults fit" when N is really everyone's ceiling.
                            Not tinted red on its own either: whether the WHOLE
                            party fits is now the fit-note's job, shown once
                            above Total Guests in booking.jsx, not repeated
                            here against a field that only ever holds adults. */}
                        <span className="pax-counter-hint" title={capacityTitle}>
                            adults
                        </span>
                    </div>
                    {paxRequiredError && <p className="pax-field-error" role="alert">{paxRequiredError}</p>}
                </div>
            </div>
        </div>
    )
}
