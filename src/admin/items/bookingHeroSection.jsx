import { useEffect, useState } from 'react'
import '../css/bookingCms.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import BookingTrustIcon from '../../components/BookingTrustIcon.jsx'
import {
    useBookingPage,
    loadBookingPage,
    saveBookingHero,
    saveBookingStep,
    saveBookingTrustPoint,
    deleteBookingTrustPoint,
    moveBookingTrustPoint,
    bookingStep,
    BOOKING_STEP_IDS,
    BOOKING_TRUST_ICONS,
} from '../../data/bookingPage.js'

// CMS → Booking → Hero & Steps. What a guest reads before the reservation form
// starts — the title and its tagline, the assurances under them — and the
// heading over each of the four steps (data/bookingPage.js).
//
// The hero and the steps stay on one screen because they are read as one: the
// tagline promises "four simple steps", and the four headings are what that
// promise turns out to mean. Editing either without the other in view is how
// they stop agreeing.
//
// WHY THE STEPS HAVE NO ADD OR DELETE
// -----------------------------------
// Each row captions a block of the form React renders. There is nothing for a
// fifth to caption, and deleting the third would leave the guest-details fields
// under a blank heading. Their wording is editable; their number is structure.

function heroFields() {
    return [
        {
            name: 'eyebrow',
            label: 'Small line above the title',
            placeholder: 'Camp Ba-long Reservations',
            help: 'Leave blank to take it off.',
        },
        {
            name: 'title',
            label: 'Page title',
            placeholder: 'Complete Your Booking',
        },
        {
            name: 'tagline',
            label: 'Tagline',
            type: 'textarea',
            rows: 3,
            placeholder: 'Reserve your stay in four simple steps — your unit is held first…',
            help: 'The paragraph under the title. Leave blank to take it off.',
        },
    ]
}

function trustFields() {
    return [
        {
            name: 'text',
            label: 'Assurance',
            type: 'textarea',
            rows: 2,
            placeholder: 'Every receipt is personally verified',
        },
        {
            name: 'icon',
            label: 'Icon',
            type: 'select',
            options: BOOKING_TRUST_ICONS,
            help: 'The small drawing before the words.',
        },
        { name: 'isActive', label: 'Show this assurance on the page', type: 'checkbox' },
    ]
}

function stepFields() {
    return [
        {
            name: 'title',
            label: 'Step heading',
            placeholder: 'Dates & Schedule',
        },
        {
            name: 'subtitle',
            label: 'One-line description',
            type: 'textarea',
            rows: 3,
            placeholder: 'Pick your check-in date and stay schedule…',
            help: 'Sits under the heading. Leave blank to take it off.',
        },
    ]
}

const BLANK_TRUST = { id: null, text: '', icon: 'check', sortOrder: 0, isActive: true }

const KNOWN_ICONS = new Set(BOOKING_TRUST_ICONS.map((option) => option.value))

export default function BookingHeroSection() {
    const { page, trust, loaded, error } = useBookingPage()

    const [editingHero, setEditingHero] = useState(null)
    const [editingTrust, setEditingTrust] = useState(null)
    const [editingStep, setEditingStep] = useState(null)
    // Reordering writes straight to the database with no form in between, so
    // its refusals have nowhere else to be shown.
    const [moveError, setMoveError] = useState('')

    useEffect(() => {
        loadBookingPage()
    }, [])

    const orderedTrust = [...trust].sort((a, b) => a.sortOrder - b.sortOrder)
    const steps = BOOKING_STEP_IDS.map((id) => bookingStep(id))

    const handleMoveTrust = async (id, direction) => {
        setMoveError('')
        const result = await moveBookingTrustPoint(id, direction)
        if (!result.ok) setMoveError(result.message)
    }

    return (
        <div className="booking-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Hero</h3>
                    <p className="crud-bar-note">
                        The title, tagline and assurances at the top of the booking page.
                        Saved changes are live straight away.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary"
                    onClick={() =>
                        setEditingHero({
                            eyebrow: page.eyebrow ?? '',
                            title: page.title ?? '',
                            tagline: page.tagline ?? '',
                        })
                    }
                >
                    Edit the wording
                </button>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}

            <div className="booking-cms-preview">
                {page.eyebrow && <p className="booking-cms-eyebrow">{page.eyebrow}</p>}
                <h4 className="booking-cms-title">{page.title}</h4>
                {page.tagline && <p className="booking-cms-tagline">{page.tagline}</p>}

                {orderedTrust.filter((point) => point.isActive).length > 0 && (
                    <ul className="booking-cms-trust">
                        {orderedTrust
                            .filter((point) => point.isActive)
                            .map((point) => (
                                <li
                                    className={`booking-cms-trust-item${KNOWN_ICONS.has(point.icon) ? '' : ' is-iconless'}`}
                                    key={point.id}
                                >
                                    <BookingTrustIcon icon={point.icon} />
                                    {point.text}
                                </li>
                            ))}
                    </ul>
                )}
            </div>

            <div className="crud-bar booking-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Assurances</h3>
                    <p className="crud-bar-note">
                        The short reassurances listed under the tagline.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary is-small"
                    onClick={() =>
                        setEditingTrust({
                            ...BLANK_TRUST,
                            sortOrder: (orderedTrust.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add an assurance
                </button>
            </div>

            {moveError && <p className="crud-message is-error">{moveError}</p>}

            {orderedTrust.length === 0 ? (
                <p className="crud-empty">
                    {loaded
                        ? 'No assurances. Add the first one above, or leave it — the list '
                          + 'disappears when it is empty.'
                        : 'Loading the assurances…'}
                </p>
            ) : (
                <div className="booking-cms-rows">
                    {orderedTrust.map((point, index) => (
                        <article
                            key={point.id}
                            className={`booking-cms-row ${point.isActive ? '' : 'crud-is-hidden'}`}
                        >
                            <span className="booking-cms-row-icon">
                                <BookingTrustIcon icon={point.icon} />
                            </span>
                            <p className="booking-cms-row-text">
                                {point.text}
                                {!KNOWN_ICONS.has(point.icon) && (
                                    <span className="crud-hidden-tag">No icon</span>
                                )}
                                {!point.isActive && <span className="crud-hidden-tag">Hidden</span>}
                            </p>
                            <div className="crud-row-actions">
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    aria-label="Move earlier"
                                    disabled={index === 0}
                                    onClick={() => handleMoveTrust(point.id, 'up')}
                                >
                                    ‹
                                </button>
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    aria-label="Move later"
                                    disabled={index === orderedTrust.length - 1}
                                    onClick={() => handleMoveTrust(point.id, 'down')}
                                >
                                    ›
                                </button>
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    onClick={() =>
                                        setEditingTrust({
                                            id: point.id,
                                            text: point.text,
                                            icon: point.icon,
                                            sortOrder: point.sortOrder,
                                            isActive: point.isActive,
                                        })
                                    }
                                >
                                    Edit
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <div className="crud-bar booking-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Steps</h3>
                    <p className="crud-bar-note">
                        The heading over each of the four steps of the form. There are always
                        four — each one titles a part of the booking form — so they can be
                        reworded but not added to or removed.
                    </p>
                </div>
            </div>

            <div className="booking-cms-steps">
                {steps.map((step, index) => (
                    <article className="booking-cms-step" key={step.id}>
                        <span className="booking-cms-row-index">{index + 1}</span>
                        <div className="booking-cms-step-copy">
                            <h4 className="booking-cms-step-title">{step.title}</h4>
                            {step.subtitle && (
                                <p className="booking-cms-step-sub">{step.subtitle}</p>
                            )}
                        </div>
                        <div className="crud-row-actions">
                            <button
                                type="button"
                                className="crud-btn is-small"
                                onClick={() =>
                                    setEditingStep({
                                        id: step.id,
                                        title: step.title,
                                        subtitle: step.subtitle,
                                    })
                                }
                            >
                                Edit
                            </button>
                        </div>
                    </article>
                ))}
            </div>

            {editingHero && (
                <CrudModal
                    title="Booking page hero"
                    subtitle="The title and tagline at the top of the page. The assurances under them are edited separately."
                    fields={heroFields}
                    initial={editingHero}
                    submitLabel="Save wording"
                    onSubmit={saveBookingHero}
                    onClose={() => setEditingHero(null)}
                />
            )}

            {editingTrust && (
                <CrudModal
                    title={editingTrust.id ? 'Edit assurance' : 'New assurance'}
                    subtitle={
                        editingTrust.id
                            ? 'Unticking the box takes it off the page and keeps its wording.'
                            : 'It joins the end of the list. Reorder it with the arrows after saving.'
                    }
                    fields={trustFields}
                    initial={editingTrust}
                    submitLabel={editingTrust.id ? 'Save changes' : 'Add assurance'}
                    onSubmit={saveBookingTrustPoint}
                    onDelete={
                        editingTrust.id ? () => deleteBookingTrustPoint(editingTrust.id) : null
                    }
                    deleteLabel="Delete assurance"
                    onClose={() => setEditingTrust(null)}
                />
            )}

            {editingStep && (
                <CrudModal
                    title="Edit step heading"
                    subtitle="The step keeps its number and its place — this is the wording over it."
                    fields={stepFields}
                    initial={editingStep}
                    submitLabel="Save heading"
                    onSubmit={saveBookingStep}
                    onClose={() => setEditingStep(null)}
                />
            )}
        </div>
    )
}
