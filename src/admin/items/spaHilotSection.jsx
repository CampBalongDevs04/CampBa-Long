import { useEffect, useState } from 'react'
import '../css/spaCms.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useSpaHilot,
    loadSpaHilot,
    saveSpaHilot,
    saveSpaHilotInclusion,
    deleteSpaHilotInclusion,
    moveSpaHilotInclusion,
} from '../../data/spaHilot.js'

// CMS → Spa Service → Hilot Section. The words introducing the treatment grid
// at the bottom of /spa, and the "Free Exclusive Inclusions" list under it
// (data/spaHilot.js).
//
// THE HEADING, NOT THE TREATMENTS. The cards between the two are catalog data
// — name, price, duration, photo — in public.spa_services, edited in the
// dashboard's Spa SECTION in the sidebar. This tab cannot reach them, which is
// the point: a staff member fixing a typo in the section's wording should not
// be one stray click from a price. Same split as Accommodations, whose cards
// are edited in Units even though its heading is edited in CMS.

function contentFields() {
    return [
        {
            name: 'eyebrow',
            label: 'Small line above the heading',
            placeholder: 'Our Services',
            help: 'Leave blank to take it off the page.',
        },
        {
            name: 'title',
            label: 'Heading',
            placeholder: 'Hilot Wellness Spa',
        },
        {
            name: 'subtitle',
            label: 'Description',
            type: 'textarea',
            rows: 3,
            placeholder: 'Time-honored Filipino healing rituals paired with modern comfort.',
            help: 'The paragraph under the heading.',
        },
        {
            name: 'inclusionsLabel',
            label: 'Label over the inclusions list',
            placeholder: 'Free Exclusive Inclusions',
        },
    ]
}

function inclusionFields() {
    return [
        {
            name: 'item',
            label: 'Inclusion',
            placeholder: 'Blue Salabat Tea',
        },
        { name: 'isActive', label: 'Show this on the page', type: 'checkbox' },
    ]
}

const BLANK_INCLUSION = { id: null, item: '', sortOrder: 0, isActive: true }

function inclusionToDraft(row) {
    return { id: row.id, item: row.item, sortOrder: row.sortOrder, isActive: row.isActive }
}

export default function SpaHilotSection({ onGoToSpa }) {
    const { hilot, inclusions, loaded, error } = useSpaHilot()

    const [editingContent, setEditingContent] = useState(null)
    const [editingInclusion, setEditingInclusion] = useState(null)
    // Reordering writes straight to the database with no form in between, so
    // its refusals have nowhere else to be shown.
    const [moveError, setMoveError] = useState('')

    useEffect(() => {
        loadSpaHilot()
    }, [])

    const ordered = [...inclusions].sort((a, b) => a.sortOrder - b.sortOrder)

    const handleMove = async (id, direction) => {
        setMoveError('')
        const result = await moveSpaHilotInclusion(id, direction)
        if (!result.ok) setMoveError(result.message)
    }

    return (
        <div className="spa-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Hilot Section</h3>
                    <p className="crud-bar-note">
                        The words over the treatment grid at the bottom of /spa. The treatments
                        themselves — name, price, duration, photo — are edited in the Spa
                        section in the sidebar, not here.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary"
                    onClick={() =>
                        setEditingContent({
                            eyebrow: hilot.eyebrow ?? '',
                            title: hilot.title ?? '',
                            subtitle: hilot.subtitle ?? '',
                            inclusionsLabel: hilot.inclusionsLabel ?? '',
                        })
                    }
                >
                    Edit the wording
                </button>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}

            <div className="spa-cms-hilot-preview">
                {hilot.eyebrow && <span className="spa-cms-hilot-eyebrow">{hilot.eyebrow}</span>}
                <h4 className="spa-cms-hilot-title">{hilot.title}</h4>
                {hilot.subtitle && <p className="spa-cms-hilot-sub">{hilot.subtitle}</p>}
                {/* Standing in for the grid this heading introduces, so the
                    preview reads as a section rather than a floating title —
                    and so the tab says once more where the cards are edited.
                    The tab that does not edit them offers a way to get there,
                    the same as the Accommodations tab does for Units. */}
                <div className="spa-cms-hilot-cards-note">
                    <p>The treatment cards sit here — name, price, duration and photo.</p>
                    {onGoToSpa ? (
                        <button type="button" className="crud-btn is-small" onClick={onGoToSpa}>
                            Open Spa → Services
                        </button>
                    ) : (
                        <p><strong>Spa → Services</strong></p>
                    )}
                </div>
            </div>

            {!loaded && <p className="crud-empty">Loading the Hilot section…</p>}

            <div className="crud-bar spa-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">{hilot.inclusionsLabel || 'Inclusions'}</h3>
                    <p className="crud-bar-note">
                        The ticked list at the bottom of the section. What every treatment comes
                        with, whichever one a guest picks.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary is-small"
                    onClick={() =>
                        setEditingInclusion({
                            ...BLANK_INCLUSION,
                            sortOrder: (ordered.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add an inclusion
                </button>
            </div>

            {moveError && <p className="crud-message is-error">{moveError}</p>}

            {ordered.length === 0 ? (
                <p className="crud-empty">
                    {loaded
                        ? 'No inclusions. Add the first one above, or leave it — the list '
                          + 'disappears when it is empty.'
                        : 'Loading the inclusions…'}
                </p>
            ) : (
                <div className="spa-cms-rows">
                    {ordered.map((row, index) => (
                        <article
                            key={row.id}
                            className={`spa-cms-row ${row.isActive ? '' : 'crud-is-hidden'}`}
                        >
                            <span className="spa-cms-row-tick" aria-hidden="true">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 12l5 5L20 6" />
                                </svg>
                            </span>
                            <p className="spa-cms-row-text">
                                {row.item}
                                {!row.isActive && <span className="crud-hidden-tag">Hidden</span>}
                            </p>
                            <div className="crud-row-actions">
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    aria-label="Move earlier"
                                    disabled={index === 0}
                                    onClick={() => handleMove(row.id, 'up')}
                                >
                                    ‹
                                </button>
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    aria-label="Move later"
                                    disabled={index === ordered.length - 1}
                                    onClick={() => handleMove(row.id, 'down')}
                                >
                                    ›
                                </button>
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    onClick={() => setEditingInclusion(inclusionToDraft(row))}
                                >
                                    Edit
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {editingContent && (
                <CrudModal
                    title="Hilot section wording"
                    subtitle="The words over the treatment grid. The treatments themselves are edited in the Spa section."
                    fields={contentFields}
                    initial={editingContent}
                    submitLabel="Save wording"
                    onSubmit={saveSpaHilot}
                    onClose={() => setEditingContent(null)}
                />
            )}

            {editingInclusion && (
                <CrudModal
                    title={editingInclusion.id ? 'Edit inclusion' : 'New inclusion'}
                    subtitle={
                        editingInclusion.id
                            ? 'Unticking the box takes it off the page and keeps its wording.'
                            : 'It joins the end of the list. Reorder it with the arrows after saving.'
                    }
                    fields={inclusionFields}
                    initial={editingInclusion}
                    submitLabel={editingInclusion.id ? 'Save changes' : 'Add inclusion'}
                    onSubmit={saveSpaHilotInclusion}
                    onDelete={
                        editingInclusion.id ? () => deleteSpaHilotInclusion(editingInclusion.id) : null
                    }
                    deleteLabel="Delete inclusion"
                    onClose={() => setEditingInclusion(null)}
                />
            )}
        </div>
    )
}
