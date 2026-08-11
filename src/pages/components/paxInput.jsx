import { useState } from 'react'
import '../components/css/paxInput.css'
import { getAccomodationOptions, getPaxFit } from '../../data/accomodationOptions.js'

// Site-wide range for the counter. A unit's own minPax/maxPax shapes the note
// below rather than the counter: the guest is allowed to type the real size of
// their group and be told how it sits against the unit they picked.
const MIN_PAX = 1
const MAX_PAX = 20

// `cartLines` is one entry per selected accommodation type — { id, qty,
// option } — since a guest can now put more than one type (and more than one
// of a type) in the cart. Capacity is judged on the COMBINED total, not any
// one line.
function getFitNote(pax, cartLines, options){
    if (!pax) return null

    // Units that hold this group comfortably, and — as a fallback — the ones
    // that hold them at all, even if the group is under the usual size.
    // Tent Pitching is excluded from suggestions: it has no capacity ceiling,
    // so it always "fits" and isn't a meaningful size-based recommendation.
    const suggestable = options.filter((item) => item.id !== 'tent-pitching')
    const fitting = suggestable.filter((item) => getPaxFit(pax, item) === 'fit')
    const roomy = suggestable.filter((item) => getPaxFit(pax, item) !== 'over')

    if (cartLines.length > 0){
        const unlimited = cartLines.some((line) => line.option.maxPax == null)
        const capacity = unlimited
            ? null
            : cartLines.reduce((sum, line) => sum + line.option.maxPax * line.qty, 0)
        const names = cartLines
            .map((line) => `${line.option.name}${line.qty > 1 ? ` ×${line.qty}` : ''}`)
            .join(', ')
        const plural = cartLines.length > 1 || cartLines[0].qty > 1

        // Over capacity — the units cannot physically take them, so this is a
        // blocking warning, not a hint. Confirm is held until it's resolved
        // (booking.jsx's capacityIssue).
        if (!unlimited && pax > capacity){
            const alternatives = (fitting.length > 0 ? fitting : roomy)
                .map((item) => item.name)
                .join(', ')
            return {
                tone: 'unfit',
                title: 'A bigger selection would suit you better',
                text: `${names} ${plural ? 'hold' : 'holds'} up to ${capacity} pax combined`
                    + `, which is a little snug for your group of ${pax}.`
                    + (alternatives ? ` You might add: ${alternatives}.` : ' Message us and we’ll help you find the right fit.'),
            }
        }

        // Under the usual group size — allowed, the rate is per unit. Only
        // spelled out for a single type: once the cart mixes different units,
        // "usually set up for" stops being one meaningful number.
        if (!unlimited && cartLines.length === 1 && cartLines[0].option.minPax != null){
            const [line] = cartLines
            if (pax < line.option.minPax * line.qty){
                return {
                    tone: 'warn',
                    title: 'Smaller group? No problem',
                    text: `${names} ${plural ? 'are' : 'is'} usually set up for ${line.option.pax}${line.qty > 1 ? ' each' : ''},`
                        + ` but you're welcome to book for ${pax}`
                        + ` — just note the rate is per unit, so the full price still applies.`,
                }
            }
        }

        return {
            tone: 'fit',
            title: 'Good fit',
            text: `${names} ${plural ? 'are' : 'is'} fit for your group of ${pax}.`,
        }
    }

    if (roomy.length === 0){
        return {
            tone: 'unfit',
            title: 'Let’s find you a fit',
            text: `We don't have a single accomodation that fits ${pax} pax — message us and we'll help arrange something for your group.`,
        }
    }

    return {
        tone: 'info',
        title: 'Suggested for you',
        text: `For ${pax} pax: ${(fitting.length > 0 ? fitting : roomy).map((item) => item.name).join(', ')}.`,
    }
}

export default function PaxInput({ pax, onPaxChange, cartLines, guest, onGuestChange, rateGroup, fieldErrors, showErrors }){
    const options = getAccomodationOptions(rateGroup)
    const lines = cartLines ?? []
    const note = getFitNote(pax, lines, options)
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

    const clamp = (value) => Math.min(MAX_PAX, Math.max(MIN_PAX, value))
    const step = (delta) => onPaxChange?.(clamp((pax ?? 0) + delta))
    const setField = (field) => (e) => onGuestChange?.({ ...guest, [field]: e.target.value })

    const overCapacity = limited && pax != null && pax > capacity
    const capacityTitle = limited
        ? `Your selected accommodation${lines.length > 1 ? 's take' : ' takes'} up to ${capacity}.`
        : undefined
    const rangeLabel = limited ? `${capacity}` : null

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
                    <label className="pax-field-label" htmlFor="pax">Number of Guests</label>
                    <div className="pax-counter">
                        <button
                            type="button"
                            className="pax-step"
                            aria-label="Remove one guest"
                            onClick={() => step(-1)}
                            disabled={!pax || pax <= MIN_PAX}
                        >
                            &minus;
                        </button>

                        <input
                            className={`pax-count${overCapacity || paxRequiredError ? ' pax-count-over' : ''}`}
                            type="number"
                            id="pax"
                            min={MIN_PAX}
                            max={MAX_PAX}
                            aria-invalid={(overCapacity || paxRequiredError) || undefined}
                            placeholder="0"
                            aria-label="Number of guests"
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
                            aria-label="Add one guest"
                            onClick={() => step(1)}
                            disabled={pax != null && pax >= MAX_PAX}
                            title={capacityTitle}
                        >
                            +
                        </button>

                        <span
                            className={`pax-counter-hint${overCapacity ? ' pax-counter-hint-over' : ''}`}
                            title={capacityTitle}
                        >
                            {limited ? `pax · fits ${rangeLabel}` : 'pax'}
                        </span>
                    </div>
                    {paxRequiredError && <p className="pax-field-error" role="alert">{paxRequiredError}</p>}
                </div>
            </div>

            {note && (
                <div className={`pax-note pax-note-${note.tone}`} role="status">
                    <span className="pax-note-dot"></span>
                    <p className="pax-note-body">
                        <strong className="pax-note-heading">{note.title}.</strong>{' '}
                        {note.text}
                    </p>
                </div>
            )}
        </div>
    )
}
