import { useEffect, useState } from 'react'
import '../css/bookingCms.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useBookingPage,
    loadBookingPage,
    saveBookingPolicyCopy,
    saveBookingPolicy,
    deleteBookingPolicy,
    moveBookingPolicy,
} from '../../data/bookingPage.js'

// CMS → Booking → Reserve Policy. The last thing a guest reads before the unit
// is held: the "Please read first before reserving" warning, the resort policy
// under it, the sentence they tick to agree, and the button itself
// (data/bookingPage.js).
//
// All four on one screen because they are one panel on the page, and because
// the tick box says a guest agrees to the list — a policy added without the
// wording beside it being checked is how the box ends up promising something
// the list no longer says.
//
// A word of care worth knowing before editing: what a guest agreed to is not
// recorded against their booking. These strings are the live version only, so a
// policy reworded today reads as though it always said that. Corrections are
// what this tab is for; a change of terms is a conversation with guests who
// have already booked.

function copyFields() {
    return [
        {
            name: 'policyWarning',
            label: 'Warning over the policy list',
            placeholder: 'Please read first before reserving',
            help: 'Leave blank to take it off — the list stays.',
        },
        {
            name: 'agreeLabel',
            label: 'Sentence beside the tick box',
            type: 'textarea',
            rows: 2,
            placeholder: 'I have read and agree to the terms and resort policy.',
        },
        {
            name: 'confirmLabel',
            label: 'Reserve button',
            placeholder: 'Reserve & Proceed to Payment',
            help: 'What the button says. While a unit is being held it says "Reserving your '
                + 'unit…" instead, which is not editable.',
        },
    ]
}

function policyFields() {
    return [
        {
            name: 'policy',
            label: 'Policy',
            type: 'textarea',
            rows: 3,
            placeholder: 'Cancellation is no longer allowed once the down payment has been made.',
        },
        { name: 'isActive', label: 'Show this policy on the page', type: 'checkbox' },
    ]
}

const BLANK_POLICY = { id: null, policy: '', sortOrder: 0, isActive: true }

export default function BookingPolicySection() {
    const { page, policies, activePolicies, loaded, error } = useBookingPage()

    const [editingCopy, setEditingCopy] = useState(null)
    const [editingPolicy, setEditingPolicy] = useState(null)
    const [moveError, setMoveError] = useState('')

    useEffect(() => {
        loadBookingPage()
    }, [])

    const orderedPolicies = [...policies].sort((a, b) => a.sortOrder - b.sortOrder)

    const handleMovePolicy = async (id, direction) => {
        setMoveError('')
        const result = await moveBookingPolicy(id, direction)
        if (!result.ok) setMoveError(result.message)
    }

    return (
        <div className="booking-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Reserve Policy</h3>
                    <p className="crud-bar-note">
                        The panel above the Reserve button — the last thing a guest reads
                        before their unit is held. Saved changes are live straight away.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary"
                    onClick={() =>
                        setEditingCopy({
                            policyWarning: page.policyWarning ?? '',
                            agreeLabel: page.agreeLabel ?? '',
                            confirmLabel: page.confirmLabel ?? '',
                        })
                    }
                >
                    Edit the wording
                </button>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}

            {/* The panel as /booking lays it out: warning, list, tick box,
                button. The whole point of this tab is whether those four read
                as one thing, which a list of fields cannot show. */}
            <div className="booking-cms-preview">
                {page.policyWarning && (
                    <p className="booking-cms-warning">{page.policyWarning}</p>
                )}

                {activePolicies.length > 0 && (
                    <ul className="booking-cms-policy-list">
                        {activePolicies.map((policy) => (
                            <li key={policy.id}>{policy.policy}</li>
                        ))}
                    </ul>
                )}

                <p className="booking-cms-agree">{page.agreeLabel}</p>
                <span className="booking-cms-confirm">{page.confirmLabel}</span>
            </div>

            <div className="crud-bar booking-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Policies</h3>
                    <p className="crud-bar-note">The list inside the panel.</p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary is-small"
                    onClick={() =>
                        setEditingPolicy({
                            ...BLANK_POLICY,
                            sortOrder: (orderedPolicies.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add a policy
                </button>
            </div>

            {moveError && <p className="crud-message is-error">{moveError}</p>}

            {orderedPolicies.length === 0 ? (
                <p className="crud-empty">
                    {loaded
                        ? 'No policies. Add the first one above — with none, the panel above the '
                          + 'Reserve button is just the tick box.'
                        : 'Loading the policies…'}
                </p>
            ) : (
                <div className="booking-cms-rows">
                    {orderedPolicies.map((policy, index) => (
                        <article
                            key={policy.id}
                            className={`booking-cms-row ${policy.isActive ? '' : 'crud-is-hidden'}`}
                        >
                            <span className="booking-cms-row-index">{index + 1}</span>
                            <p className="booking-cms-row-text">
                                {policy.policy}
                                {!policy.isActive && <span className="crud-hidden-tag">Hidden</span>}
                            </p>
                            <div className="crud-row-actions">
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    aria-label="Move earlier"
                                    disabled={index === 0}
                                    onClick={() => handleMovePolicy(policy.id, 'up')}
                                >
                                    ‹
                                </button>
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    aria-label="Move later"
                                    disabled={index === orderedPolicies.length - 1}
                                    onClick={() => handleMovePolicy(policy.id, 'down')}
                                >
                                    ›
                                </button>
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    onClick={() =>
                                        setEditingPolicy({
                                            id: policy.id,
                                            policy: policy.policy,
                                            sortOrder: policy.sortOrder,
                                            isActive: policy.isActive,
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

            {editingCopy && (
                <CrudModal
                    title="Reserve panel wording"
                    subtitle="The warning, the tick box and the button. The policy list is edited row by row."
                    fields={copyFields}
                    initial={editingCopy}
                    submitLabel="Save wording"
                    onSubmit={saveBookingPolicyCopy}
                    onClose={() => setEditingCopy(null)}
                />
            )}

            {editingPolicy && (
                <CrudModal
                    title={editingPolicy.id ? 'Edit policy' : 'New policy'}
                    subtitle={
                        editingPolicy.id
                            ? 'Unticking the box takes it off the page and keeps its wording.'
                            : 'It joins the end of the list. Reorder it with the arrows after saving.'
                    }
                    fields={policyFields}
                    initial={editingPolicy}
                    submitLabel={editingPolicy.id ? 'Save changes' : 'Add policy'}
                    onSubmit={saveBookingPolicy}
                    onDelete={editingPolicy.id ? () => deleteBookingPolicy(editingPolicy.id) : null}
                    deleteLabel="Delete policy"
                    onClose={() => setEditingPolicy(null)}
                />
            )}
        </div>
    )
}
