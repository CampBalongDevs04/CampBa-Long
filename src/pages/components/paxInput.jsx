import '../components/css/paxInput.css'
import { accomodationOptions } from './accomodationList'

const MIN_PAX = 1
const MAX_PAX = 20

function getFitNote(pax, selectedAccomodation){
    if (!pax) return null

    const fitting = accomodationOptions.filter(
        (item) => pax >= item.minPax && pax <= item.maxPax
    )

    const selected = selectedAccomodation
        ? accomodationOptions.find((item) => item.id === selectedAccomodation)
        : null

    if (selected){
        const fits = pax >= selected.minPax && pax <= selected.maxPax
        if (fits){
            return {
                tone: 'fit',
                title: 'Good fit',
                text: `${selected.name} (${selected.pax}) is fit for your group of ${pax}.`,
            }
        }
        const suggestions = fitting.map((item) => item.name).join(', ')
        return {
            tone: 'unfit',
            title: 'Not a fit',
            text: `${selected.name} (${selected.pax}) is not fit for your group of ${pax}.`
                + (suggestions ? ` Consider: ${suggestions}.` : ''),
        }
    }

    if (fitting.length === 0){
        return {
            tone: 'unfit',
            title: 'Group booking',
            text: `No single accomodation fits ${pax} pax — contact us for group arrangements.`,
        }
    }

    return {
        tone: 'info',
        title: 'Suggested for you',
        text: `For ${pax} pax: ${fitting.map((item) => item.name).join(', ')}.`,
    }
}

export default function PaxInput({ pax, onPaxChange, selectedAccomodation, guest, onGuestChange }){
    const note = getFitNote(pax, selectedAccomodation)

    const clamp = (value) => Math.min(MAX_PAX, Math.max(MIN_PAX, value))
    const step = (delta) => onPaxChange?.(clamp((pax ?? 0) + delta))
    const setField = (field) => (e) => onGuestChange?.({ ...guest, [field]: e.target.value })

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
                            className="pax-count"
                            type="number"
                            id="pax"
                            min={MIN_PAX}
                            max={MAX_PAX}
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
                            disabled={pax >= MAX_PAX}
                        >
                            +
                        </button>

                        <span className="pax-counter-hint">pax</span>
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
