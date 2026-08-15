import { useEffect, useState } from 'react'
import '../css/spaCms.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useSpaReserve,
    loadSpaReserve,
    saveSpaReserve,
    saveSpaReserveMedia,
    saveSpaReserveStep,
    deleteSpaReserveStep,
    moveSpaReserveStep,
    resolveSpaReserveImage,
    importBundledSpaReserveImage,
} from '../../data/spaReserve.js'

// CMS → Spa Service → How to Reserve. The panel below the banner on /spa that
// walks a guest through booking a treatment: two headings, a photo, and the
// numbered steps (data/spaReserve.js).
//
// The panel and its steps stay on one screen because they are not two things —
// the steps ARE the panel, and editing the heading without seeing the list it
// introduces is how you end up with a heading that no longer describes it.
//
// Wording and photo are edited separately, the same reasoning as the Banner
// tab beside this one.

function panelFields() {
    return [
        {
            name: 'heading',
            label: 'Section heading',
            placeholder: 'How to book Spa Service',
            help: 'The big heading over the whole section.',
        },
        {
            name: 'stepsTitle',
            label: 'Heading on the card',
            placeholder: 'How to Order',
            help: 'The smaller heading above the numbered list. Leave blank to take it off.',
        },
    ]
}

function mediaFields(values) {
    return [
        {
            name: 'imageUrl',
            label: 'Photo',
            type: 'image',
            folder: 'spa',
            preview: resolveSpaReserveImage(values.imageUrl),
            help: 'The tall photo beside the numbered steps. Removing it puts the photo the '
                + 'site shipped with back. JPG, PNG or WebP, up to 5 MB.',
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
            placeholder: 'Reserve your stay first — you can book a treatment before paying.',
        },
        { name: 'isActive', label: 'Show this step on the page', type: 'checkbox' },
    ]
}

const BLANK_STEP = { id: null, step: '', sortOrder: 0, isActive: true }

function stepToDraft(step) {
    return { id: step.id, step: step.step, sortOrder: step.sortOrder, isActive: step.isActive }
}

export default function SpaReserveSection() {
    const { panel, steps, loaded, error } = useSpaReserve()

    const [editingPanel, setEditingPanel] = useState(null)
    const [editingMedia, setEditingMedia] = useState(null)
    const [editingStep, setEditingStep] = useState(null)
    // Reordering and importing both write straight to the database with no form
    // in between, so their refusals have nowhere else to be shown.
    const [moveError, setMoveError] = useState('')
    const [importing, setImporting] = useState(false)
    const [importError, setImportError] = useState('')

    useEffect(() => {
        loadSpaReserve()
    }, [])

    const orderedSteps = [...steps].sort((a, b) => a.sortOrder - b.sortOrder)
    const usingShipped = !panel.imageUrl

    const handleImport = async () => {
        if (importing) return
        setImportError('')
        setImporting(true)
        const result = await importBundledSpaReserveImage()
        setImporting(false)
        if (!result.ok) setImportError(result.message)
    }

    const handleMoveStep = async (id, direction) => {
        setMoveError('')
        const result = await moveSpaReserveStep(id, direction)
        if (!result.ok) setMoveError(result.message)
    }

    return (
        <div className="spa-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">How to Reserve</h3>
                    <p className="crud-bar-note">
                        The panel below the banner that walks a guest through booking a
                        treatment. Saved changes are live straight away.
                    </p>
                </div>
                <div className="crud-row-actions">
                    <button
                        type="button"
                        className="crud-btn"
                        onClick={() => setEditingMedia({ imageUrl: panel.imageUrl ?? '' })}
                    >
                        Photo
                    </button>
                    <button
                        type="button"
                        className="crud-btn is-primary"
                        onClick={() =>
                            setEditingPanel({
                                heading: panel.heading ?? '',
                                stepsTitle: panel.stepsTitle ?? '',
                            })
                        }
                    >
                        Edit the wording
                    </button>
                </div>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}

            <div className="spa-cms-howto-preview">
                <div className="spa-cms-howto-photo">
                    <img src={resolveSpaReserveImage(panel.imageUrl)} alt="" />
                </div>
                <div className="spa-cms-howto-copy">
                    <h4>{panel.heading}</h4>
                    {panel.stepsTitle && <p className="spa-cms-howto-sub">{panel.stepsTitle}</p>}
                </div>
            </div>

            {/* Came with the site, so it is a file in the build rather than a
                photo on the row — visible above, but with nothing stored there
                is nothing to replace or remove. */}
            {usingShipped ? (
                <div className="spa-cms-import">
                    <p className="crud-bar-note">
                        This photo came with the site, so it is not stored in the database yet.
                        Import it and it becomes an ordinary photo you can replace or remove.
                    </p>
                    <button
                        type="button"
                        className="crud-btn is-primary is-small"
                        disabled={importing}
                        onClick={handleImport}
                    >
                        {importing ? 'Importing…' : 'Import this photo'}
                    </button>
                </div>
            ) : (
                <p className="crud-bar-note spa-cms-bg-note">
                    Stored in the database. Replace or remove it under Photo — removing puts the
                    photo the site shipped with back.
                </p>
            )}

            {importError && <p className="crud-message is-error">{importError}</p>}

            <div className="crud-bar spa-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Steps</h3>
                    <p className="crud-bar-note">The numbered list inside the panel.</p>
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
                    {loaded
                        ? 'No steps. Add the first one above, or leave it — the numbered list '
                          + 'disappears when it is empty.'
                        : 'Loading the steps…'}
                </p>
            ) : (
                <div className="spa-cms-rows">
                    {orderedSteps.map((step, index) => (
                        <article
                            key={step.id}
                            className={`spa-cms-row ${step.isActive ? '' : 'crud-is-hidden'}`}
                        >
                            <span className="spa-cms-row-index">{index + 1}</span>
                            <p className="spa-cms-row-text">
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

            {editingPanel && (
                <CrudModal
                    title="How to Reserve wording"
                    subtitle="The two headings on the panel. The steps below are edited separately."
                    fields={panelFields}
                    initial={editingPanel}
                    submitLabel="Save wording"
                    onSubmit={saveSpaReserve}
                    onClose={() => setEditingPanel(null)}
                />
            )}

            {editingMedia && (
                <CrudModal
                    title="How to Reserve photo"
                    subtitle="Uploads go straight into the resort's own storage, so they survive a redeploy. Removing one puts the photo the site shipped with back."
                    fields={mediaFields}
                    initial={editingMedia}
                    submitLabel="Save photo"
                    onSubmit={saveSpaReserveMedia}
                    onClose={() => setEditingMedia(null)}
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
                    onSubmit={saveSpaReserveStep}
                    onDelete={editingStep.id ? () => deleteSpaReserveStep(editingStep.id) : null}
                    deleteLabel="Delete step"
                    onClose={() => setEditingStep(null)}
                />
            )}
        </div>
    )
}
