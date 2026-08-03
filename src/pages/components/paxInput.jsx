import '../components/css/paxInput.css'
import { getAccomodationOptions, getPaxFit } from '../../data/accomodationOptions.js'

// Site-wide range for the counter. A unit's own minPax/maxPax shapes the note
// below rather than the counter: the guest is allowed to type the real size of
// their group and be told how it sits against the unit they picked.
const MIN_PAX = 1
const MAX_PAX = 20

function getFitNote(pax, selected, options){
    if (!pax) return null

    // Units that hold this group comfortably, and — as a fallback — the ones
    // that hold them at all, even if the group is under the usual size.
    // Tent Pitching is excluded from suggestions: it has no capacity ceiling,
    // so it always "fits" and isn't a meaningful size-based recommendation.
    const suggestable = options.filter((item) => item.id !== 'tent-pitching')
    const fitting = suggestable.filter((item) => getPaxFit(pax, item) === 'fit')
    const roomy = suggestable.filter((item) => getPaxFit(pax, item) !== 'over')

    if (selected){
        const paxLabel = selected.pax ?? 'schedule not yet selected'
        const fit = getPaxFit(pax, selected)

        // Over capacity — the unit cannot physically take them, so this is a
        // blocking warning, not a hint. Confirm is held until it's resolved.
        if (fit === 'over'){
            const alternatives = (fitting.length > 0 ? fitting : roomy)
                .map((item) => item.name)
                .join(', ')
            return {
                tone: 'unfit',
                title: 'A bigger space would suit you better',
                text: `${selected.name} (${paxLabel}) comfortably holds up to ${selected.maxPax} pax`
                    + `, which is a little snug for your group of ${pax}.`
                    + (alternatives ? ` You might consider: ${alternatives}.` : ' Message us and we’ll help you find the right fit.'),
            }
        }

        // Under the usual group size — allowed. The rate is per unit, so a
        // smaller group just books the whole thing; say so and move on.
        if (fit === 'under'){
            return {
                tone: 'warn',
                title: 'Smaller group? No problem',
                text: `${selected.name} is usually set up for ${paxLabel}, but you're welcome to book it for ${pax}`
                    + ` — just note the rate is per unit, so the full price still applies.`,
            }
        }

        return {
            tone: 'fit',
            title: 'Good fit',
            text: `${selected.name} (${paxLabel}) is fit for your group of ${pax}.`,
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

export default function PaxInput({ pax, onPaxChange, selectedAccomodation, guest, onGuestChange, rateGroup }){
    const options = getAccomodationOptions(rateGroup)
    const selected = selectedAccomodation
        ? options.find((item) => item.id === selectedAccomodation) ?? null
        : null
    const note = getFitNote(pax, selected, options)

    // The counter is NOT capped at the unit's maxPax. Silently refusing the
    // 6th guest of a 5-pax cottage looks like a broken button; letting the
    // number through and answering with the warning above tells them what is
    // actually wrong, and Confirm is what holds the booking back (booking.jsx).
    // minPax is never enforced at all — the rate is per unit, not per head, so
    // a smaller group is free to book and only gets the yellow note.
    const capacity = selected?.maxPax ?? null
    const limited = capacity != null

    const clamp = (value) => Math.min(MAX_PAX, Math.max(MIN_PAX, value))
    const step = (delta) => onPaxChange?.(clamp((pax ?? 0) + delta))
    const setField = (field) => (e) => onGuestChange?.({ ...guest, [field]: e.target.value })

    const overCapacity = limited && pax != null && pax > capacity
    const capacityTitle = limited
        ? `${selected.name} takes ${selected.pax}.`
        : undefined
    // '2–3' for a unit with a minimum, plain '4' when it only has a ceiling.
    const rangeLabel = limited
        ? (selected.minPax != null && selected.minPax !== capacity
            ? `${selected.minPax}–${capacity}`
            : `${capacity}`)
        : null

    return(
        <div className="guest-info">
            <div className="pax-form">
                <div className="pax-field pax-field-full">
                    <label className="pax-field-label" htmlFor="guest-fullname">Full Name</label>
                    <input
                        className="pax-field-input"
                        type="text"
                        id="guest-fullname"
                        placeholder="e.g. Juan Dela Cruz"
                        autoComplete="name"
                        value={guest?.fullName ?? ''}
                        onChange={setField('fullName')}
                    />
                </div>

                <div className="pax-field">
                    <label className="pax-field-label" htmlFor="guest-mobile">Mobile Number</label>
                    <input
                        className="pax-field-input"
                        type="tel"
                        id="guest-mobile"
                        placeholder="e.g. 0917 123 4567"
                        autoComplete="tel"
                        inputMode="tel"
                        value={guest?.mobile ?? ''}
                        onChange={setField('mobile')}
                    />
                </div>

                <div className="pax-field">
                    <label className="pax-field-label" htmlFor="guest-email">Email</label>
                    <input
                        className="pax-field-input"
                        type="email"
                        id="guest-email"
                        placeholder="e.g. juan@email.com"
                        autoComplete="email"
                        value={guest?.email ?? ''}
                        onChange={setField('email')}
                    />
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
                            className={`pax-count${overCapacity ? ' pax-count-over' : ''}`}
                            type="number"
                            id="pax"
                            min={MIN_PAX}
                            max={MAX_PAX}
                            aria-invalid={overCapacity || undefined}
                            placeholder="0"
                            aria-label="Number of guests"
                            value={pax ?? ''}
                            onChange={(e) => {
                                const value = e.target.value
                                onPaxChange?.(value === '' ? null : clamp(Number(value)))
                            }}
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
