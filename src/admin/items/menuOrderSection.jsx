import { useEffect, useState } from 'react'
import '../css/menuBanner.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useMenuOrder,
    loadMenuOrder,
    saveMenuOrder,
    saveMenuOrderMedia,
    saveMenuOrderStep,
    deleteMenuOrderStep,
    moveMenuOrderStep,
    resolveMenuOrderImage,
} from '../../data/menuOrder.js'

// CMS → Food Menu → How to Order. The panel further down /menu that walks a
// guest through ordering: a heading, a photo, a bold note, and the numbered
// steps under it (data/menuOrder.js).
//
// The panel and its steps stay on one screen even though the tabs beside this
// one split /menu up, because they are not two things — the steps ARE the
// panel, and editing the heading without seeing the list it introduces is how
// you end up with a heading that no longer describes it.
//
// Wording and photo are edited separately, the same reasoning as the Banner
// tab: fixing a typo should not put a staff member one stray click away from
// clearing a photo.

function orderFields() {
    return [
        {
            name: 'heading',
            label: 'Heading',
            placeholder: 'How to Order Food',
        },
        [
            {
                name: 'noteLabel',
                label: 'Note — the bold word it opens with',
                placeholder: 'Note:',
                help: 'Printed in bold at the start of the sentence below.',
            },
            {
                name: 'noteText',
                label: 'Note — the rest',
                placeholder: 'Food orders are subject to availability and may be modified before the preparation cutoff time.',
            },
        ],
    ]
}

function orderMediaFields(values) {
    return [
        {
            name: 'imageUrl',
            label: 'Photo',
            type: 'image',
            folder: 'menu',
            preview: resolveMenuOrderImage(values.imageUrl),
            help: 'The photo beside the numbered steps.',
        },
    ]
}

function stepFields() {
    return [
        {
            name: 'step',
            label: 'Step',
            type: 'textarea',
            rows: 2,
            placeholder: 'Reserve your stay first — you can order before paying.',
        },
        { name: 'isActive', label: 'Show this step on the page', type: 'checkbox' },
    ]
}

const BLANK_STEP = { id: null, step: '', sortOrder: 0, isActive: true }

function stepToDraft(step) {
    return { id: step.id, step: step.step, sortOrder: step.sortOrder, isActive: step.isActive }
}

export default function MenuOrderSection() {
    const { panel: order, steps, loaded: orderLoaded, error: orderError } = useMenuOrder()

    const [editingOrder, setEditingOrder] = useState(null)
    const [editingOrderMedia, setEditingOrderMedia] = useState(null)
    const [editingStep, setEditingStep] = useState(null)
    // Reordering writes straight to the database with no form in between, so
    // its refusals have nowhere else to be shown.
    const [moveError, setMoveError] = useState('')

    useEffect(() => {
        loadMenuOrder()
    }, [])

    const orderedSteps = [...steps].sort((a, b) => a.sortOrder - b.sortOrder)

    const handleMoveStep = async (id, direction) => {
        setMoveError('')
        const result = await moveMenuOrderStep(id, direction)
        if (!result.ok) setMoveError(result.message)
    }

    return (
        <div className="menu-hero-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">How to Order</h3>
                    <p className="crud-bar-note">
                        The panel further down /menu that walks a guest through ordering.
                        Saved changes are live straight away.
                    </p>
                </div>
                <div className="crud-row-actions">
                    <button
                        type="button"
                        className="crud-btn"
                        onClick={() => setEditingOrderMedia({ imageUrl: order.imageUrl ?? '' })}
                    >
                        Photo
                    </button>
                    <button
                        type="button"
                        className="crud-btn is-primary"
                        onClick={() =>
                            setEditingOrder({
                                heading: order.heading ?? '',
                                noteLabel: order.noteLabel ?? '',
                                noteText: order.noteText ?? '',
                            })
                        }
                    >
                        Edit the wording
                    </button>
                </div>
            </div>

            {orderError && <p className="crud-message is-error">{orderError}</p>}

            <div className="menu-hero-cms-howto-preview">
                <div className="menu-hero-cms-howto-photo">
                    <img src={resolveMenuOrderImage(order.imageUrl)} alt="" />
                </div>
                <div className="menu-hero-cms-howto-copy">
                    <h4>{order.heading}</h4>
                    {(order.noteLabel || order.noteText) && (
                        <p className="menu-hero-cms-howto-note">
                            {order.noteLabel && <b>{order.noteLabel} </b>}
                            {order.noteText}
                        </p>
                    )}
                </div>
            </div>

            <div className="crud-bar menu-hero-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Steps</h3>
                    <p className="crud-bar-note">The numbered list inside the How to Order panel.</p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary is-small"
                    onClick={() =>
                        setEditingStep({
                            ...BLANK_STEP,
                            sortOrder: (orderedSteps.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add a step
                </button>
            </div>

            {moveError && <p className="crud-message is-error">{moveError}</p>}

            {orderedSteps.length === 0 ? (
                <p className="crud-empty">
                    {orderLoaded
                        ? 'No steps. Add the first one above, or leave it — the numbered list '
                          + 'disappears when it is empty.'
                        : 'Loading the steps…'}
                </p>
            ) : (
                <div className="menu-hero-cms-steps">
                    {orderedSteps.map((step, index) => (
                        <article
                            key={step.id}
                            className={`menu-hero-cms-step ${step.isActive ? '' : 'crud-is-hidden'}`}
                        >
                            <span className="menu-hero-cms-step-index">{index + 1}</span>
                            <p className="menu-hero-cms-step-text">
                                {step.step}
                                {!step.isActive && <span className="crud-hidden-tag">Hidden</span>}
                            </p>
                            <div className="crud-row-actions">
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    aria-label="Move earlier"
                                    disabled={index === 0}
                                    onClick={() => handleMoveStep(step.id, 'up')}
                                >
                                    ‹
                                </button>
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    aria-label="Move later"
                                    disabled={index === orderedSteps.length - 1}
                                    onClick={() => handleMoveStep(step.id, 'down')}
                                >
                                    ›
                                </button>
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    onClick={() => setEditingStep(stepToDraft(step))}
                                >
                                    Edit
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {editingOrder && (
                <CrudModal
                    title="How to Order wording"
                    subtitle="The heading and note on the How to Order panel. The steps below are edited separately."
                    fields={orderFields}
                    initial={editingOrder}
                    submitLabel="Save wording"
                    onSubmit={saveMenuOrder}
                    onClose={() => setEditingOrder(null)}
                />
            )}

            {editingOrderMedia && (
                <CrudModal
                    title="How to Order photo"
                    subtitle="Uploads go straight into the resort's own storage, so they survive a redeploy. Removing one puts the photo the site shipped with back."
                    fields={orderMediaFields}
                    initial={editingOrderMedia}
                    submitLabel="Save photo"
                    onSubmit={saveMenuOrderMedia}
                    onClose={() => setEditingOrderMedia(null)}
                />
            )}

            {editingStep && (
                <CrudModal
                    title={editingStep.id ? 'Edit step' : 'New step'}
                    subtitle={
                        editingStep.id
                            ? 'Unticking the box takes it off the page and keeps its wording.'
                            : 'It joins the end of the list. Reorder it with the arrows after saving.'
                    }
                    fields={stepFields}
                    initial={editingStep}
                    submitLabel={editingStep.id ? 'Save changes' : 'Add step'}
                    onSubmit={saveMenuOrderStep}
                    onDelete={editingStep.id ? () => deleteMenuOrderStep(editingStep.id) : null}
                    deleteLabel="Delete step"
                    onClose={() => setEditingStep(null)}
                />
            )}
        </div>
    )
}
