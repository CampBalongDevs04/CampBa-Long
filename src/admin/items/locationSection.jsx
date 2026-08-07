import { useEffect, useState } from 'react'
import '../css/locationSection.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import CmsIcon from '../../components/CmsIcon.jsx'
import { CMS_ICON_OPTIONS, hasCmsIcon } from '../../data/cmsIcons.js'
import {
    useLocationSection,
    loadLocationSection,
    saveLocationSection,
    saveLocationDetail,
    deleteLocationDetail,
    moveLocationDetail,
    saveLocationFeature,
    deleteLocationFeature,
    moveLocationFeature,
} from '../../data/locationSection.js'

// CMS → Location. The heading, the contact card beside the map, and the tiles
// under it.
//
// THE MAP IS NOT EDITED HERE
// --------------------------
// The embed is a URL carrying coordinates rather than copy, and one wrong
// character in it shows the wrong village silently. It stays in the component,
// and the panel says so on screen rather than leaving a staff member hunting
// for the field. The "Get Directions" button beside it IS editable — a label
// and a link, like the hero's two buttons.

function sectionFields() {
    return [
        {
            name: 'eyebrow',
            label: 'Small line above the heading',
            placeholder: 'Our Location',
            help: 'Printed in gold, in caps.',
        },
        {
            name: 'title',
            label: 'Heading',
            placeholder: 'We’d Love to See You',
        },
        {
            name: 'subtitle',
            label: 'Line under it',
            type: 'textarea',
            rows: 2,
            placeholder: 'Visit us at Camp Ba-long. We’re always happy to welcome you!',
        },
        [
            {
                name: 'directionsLabel',
                label: 'Button',
                placeholder: 'Get Directions',
                help: 'Clearing this removes the button.',
            },
            {
                name: 'directionsHref',
                label: 'Where it goes',
                type: 'url',
                placeholder: 'https://maps.app.goo.gl/…',
                help: 'Opens in a new tab.',
            },
        ],
    ]
}

function detailFields(values) {
    return [
        {
            name: 'label',
            label: 'Label',
            placeholder: 'Address',
            help: 'The heading of this row — "Address", "Phone", "Admin Hours".',
        },
        {
            name: 'lines',
            label: 'What goes under it',
            type: 'textarea',
            rows: 4,
            placeholder: 'Brgy. Laguan\nLiliw, Laguna\nPhilippines',
            help: 'One line per line, exactly as it should break on the card. A phone '
                + 'number is one line; an address is usually three.',
        },
        {
            name: 'iconKey',
            label: 'Icon',
            type: 'select',
            options: [{ value: '', label: 'No icon' }, ...CMS_ICON_OPTIONS],
            help: values.iconUrl
                ? 'Ignored while an uploaded icon is set below. Remove that to use one of these.'
                : 'Shown in the small circle to the left of the label.',
        },
        {
            name: 'iconUrl',
            label: 'Or upload an icon',
            type: 'image',
            folder: 'location',
            help: 'Overrides the choice above. This circle sits on cream and the icon keeps '
                + 'its own colour, so anything legible on a light background works. SVG or '
                + 'PNG, up to 5 MB.',
        },
        { name: 'isActive', label: 'Show this row on the card', type: 'checkbox' },
    ]
}

function featureFields(values) {
    return [
        {
            name: 'title',
            label: 'Heading',
            placeholder: 'Parking Available',
            help: 'A few words, in caps on the page.',
        },
        {
            name: 'description',
            label: 'Line under it',
            type: 'textarea',
            rows: 2,
            placeholder: 'Free parking available for all guests.',
        },
        {
            name: 'iconKey',
            label: 'Icon',
            type: 'select',
            options: [{ value: '', label: 'No icon' }, ...CMS_ICON_OPTIONS],
            help: values.iconUrl
                ? 'Ignored while an uploaded icon is set below. Remove that to use one of these.'
                : 'Shown in the circle above the heading.',
        },
        {
            name: 'iconUrl',
            label: 'Or upload an icon',
            type: 'image',
            folder: 'location',
            help: 'Overrides the choice above. These tiles sit on the dark green band, so '
                + 'pale line art reads best. SVG or PNG, up to 5 MB.',
        },
        { name: 'isActive', label: 'Show this tile on the home page', type: 'checkbox' },
    ]
}

const BLANK_DETAIL = {
    id: null,
    label: '',
    lines: '',
    iconKey: '',
    iconUrl: '',
    sortOrder: 0,
    isActive: true,
}

const BLANK_FEATURE = {
    id: null,
    title: '',
    description: '',
    iconKey: '',
    iconUrl: '',
    sortOrder: 0,
    isActive: true,
}

function toDraft(row, blank) {
    return Object.fromEntries(Object.keys(blank).map((key) => [key, row[key] ?? blank[key]]))
}

export default function LocationSection() {
    const { section, details, features, loaded, error } = useLocationSection()
    const [editingSection, setEditingSection] = useState(null)
    const [editingDetail, setEditingDetail] = useState(null)
    const [editingFeature, setEditingFeature] = useState(null)
    // Reordering writes straight to the database with no form in between, so
    // its refusals have nowhere else to be shown.
    const [moveError, setMoveError] = useState('')

    useEffect(() => {
        loadLocationSection()
    }, [])

    const orderedDetails = [...details].sort((a, b) => a.sortOrder - b.sortOrder)
    const orderedFeatures = [...features].sort((a, b) => a.sortOrder - b.sortOrder)

    const handleMove = async (run) => {
        setMoveError('')
        const result = await run()
        if (!result.ok) setMoveError(result.message)
    }

    const arrows = (length, index, up, down) => (
        <>
            <button
                type="button"
                className="crud-btn is-small"
                aria-label="Move earlier"
                disabled={index === 0}
                onClick={() => handleMove(up)}
            >
                ‹
            </button>
            <button
                type="button"
                className="crud-btn is-small"
                aria-label="Move later"
                disabled={index === length - 1}
                onClick={() => handleMove(down)}
            >
                ›
            </button>
        </>
    )

    return (
        <div className="loc-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Location</h3>
                    <p className="crud-bar-note">
                        The heading, the contact card beside the map, and the tiles under it.
                        Saved changes are live straight away — there is no draft and no publish
                        step.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary"
                    onClick={() =>
                        setEditingSection({
                            eyebrow: section.eyebrow ?? '',
                            title: section.title ?? '',
                            subtitle: section.subtitle ?? '',
                            directionsLabel: section.directionsLabel ?? '',
                            directionsHref: section.directionsHref ?? '',
                        })
                    }
                >
                    Edit the wording
                </button>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}
            {moveError && <p className="crud-message is-error">{moveError}</p>}

            <div className="loc-cms-preview">
                {section.eyebrow && <p className="loc-cms-eyebrow">{section.eyebrow}</p>}
                {section.title && <h4 className="loc-cms-title">{section.title}</h4>}
                {section.subtitle && <p className="loc-cms-sub">{section.subtitle}</p>}
                {section.directionsLabel && (
                    <p className="loc-cms-btn-preview">
                        <span>{section.directionsLabel}</span>
                        <small>{section.directionsHref || 'No link — the button goes nowhere.'}</small>
                    </p>
                )}
            </div>

            <div className="crud-bar loc-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Contact card</h3>
                    <p className="crud-bar-note">
                        The rows beside the map, in this order.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary is-small"
                    onClick={() =>
                        setEditingDetail({
                            ...BLANK_DETAIL,
                            sortOrder: (orderedDetails.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add a row
                </button>
            </div>

            {orderedDetails.length === 0 ? (
                <p className="crud-empty">
                    {loaded
                        ? 'Nothing on the card. Add the first row above.'
                        : 'Loading the location section…'}
                </p>
            ) : (
                <div className="loc-cms-list">
                    {orderedDetails.map((detail, index) => (
                        <article
                            key={detail.id}
                            className={`loc-cms-row ${detail.isActive ? '' : 'crud-is-hidden'}`}
                        >
                            <span className="loc-cms-detail-icon">
                                <CmsIcon iconKey={detail.iconKey} iconUrl={detail.iconUrl} />
                            </span>
                            <div className="loc-cms-copy">
                                <h4>
                                    {detail.label}
                                    {!detail.isActive && <span className="crud-hidden-tag">Hidden</span>}
                                </h4>
                                {detail.lines.map((line, i) => (
                                    <p key={i}>{line}</p>
                                ))}
                                {!hasCmsIcon(detail.iconKey, detail.iconUrl) && (
                                    <p className="loc-cms-warning">
                                        No icon — the circle beside this row is empty.
                                    </p>
                                )}
                            </div>
                            <div className="crud-row-actions">
                                {arrows(
                                    orderedDetails.length,
                                    index,
                                    () => moveLocationDetail(detail.id, 'up'),
                                    () => moveLocationDetail(detail.id, 'down'),
                                )}
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    onClick={() =>
                                        setEditingDetail({
                                            ...toDraft(detail, BLANK_DETAIL),
                                            // The form edits the lines as text,
                                            // one per line, the way they are
                                            // typed and the way they read.
                                            lines: detail.lines.join('\n'),
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

            <div className="crud-bar loc-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Tiles under the map</h3>
                    <p className="crud-bar-note">
                        The strip is laid out four to a row, so a fifth tile starts a second row.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary is-small"
                    onClick={() =>
                        setEditingFeature({
                            ...BLANK_FEATURE,
                            sortOrder: (orderedFeatures.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add a tile
                </button>
            </div>

            {orderedFeatures.length === 0 ? (
                <p className="crud-empty">
                    {loaded
                        ? 'No tiles. Add one above, or leave it — the strip disappears when it '
                          + 'is empty.'
                        : 'Loading the location section…'}
                </p>
            ) : (
                <div className="loc-cms-list">
                    {orderedFeatures.map((feature, index) => (
                        <article
                            key={feature.id}
                            className={`loc-cms-row ${feature.isActive ? '' : 'crud-is-hidden'}`}
                        >
                            {/* On the dark band the page draws these on, so a
                                pale upload that will vanish there is obvious
                                here rather than after saving. */}
                            <span className="loc-cms-feature-icon">
                                <CmsIcon iconKey={feature.iconKey} iconUrl={feature.iconUrl} />
                            </span>
                            <div className="loc-cms-copy">
                                <h4>
                                    {feature.title}
                                    {!feature.isActive && <span className="crud-hidden-tag">Hidden</span>}
                                </h4>
                                <p>{feature.description || 'No description'}</p>
                                {!hasCmsIcon(feature.iconKey, feature.iconUrl) && (
                                    <p className="loc-cms-warning">
                                        No icon — the circle above this tile is empty.
                                    </p>
                                )}
                            </div>
                            <div className="crud-row-actions">
                                {arrows(
                                    orderedFeatures.length,
                                    index,
                                    () => moveLocationFeature(feature.id, 'up'),
                                    () => moveLocationFeature(feature.id, 'down'),
                                )}
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    onClick={() => setEditingFeature(toDraft(feature, BLANK_FEATURE))}
                                >
                                    Edit
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {/* Not a warning — nothing is wrong. This is the answer to "where is
                the map", for the staff member who opened this tab looking for
                it. */}
            <div className="loc-cms-note">
                <h4>The map itself is not edited here</h4>
                <p>
                    The embedded map is not wording — it is an address carrying the resort's
                    exact coordinates, and a character typed wrong in it shows the wrong place
                    with nothing on screen to say so. It stays with the page. The
                    <strong> Get Directions</strong> button above is editable, so the link
                    guests are sent to can still be changed.
                </p>
            </div>

            {editingSection && (
                <CrudModal
                    title="Location heading"
                    subtitle="The heading above the map and the button on the card. Live on the home page the moment it saves."
                    fields={sectionFields}
                    initial={editingSection}
                    submitLabel="Save wording"
                    onSubmit={saveLocationSection}
                    onClose={() => setEditingSection(null)}
                />
            )}

            {editingDetail && (
                <CrudModal
                    title={editingDetail.id ? 'Edit row' : 'New row'}
                    subtitle={
                        editingDetail.id
                            ? 'Unticking the box takes it off the card and keeps its wording.'
                            : 'It joins the bottom of the card, above the button.'
                    }
                    fields={detailFields}
                    initial={editingDetail}
                    submitLabel={editingDetail.id ? 'Save changes' : 'Add row'}
                    onSubmit={saveLocationDetail}
                    onDelete={editingDetail.id ? () => deleteLocationDetail(editingDetail.id) : null}
                    deleteLabel="Delete row"
                    onClose={() => setEditingDetail(null)}
                />
            )}

            {editingFeature && (
                <CrudModal
                    title={editingFeature.id ? 'Edit tile' : 'New tile'}
                    subtitle={
                        editingFeature.id
                            ? 'Unticking the box takes it off the home page and keeps its wording.'
                            : 'It joins the end of the strip.'
                    }
                    fields={featureFields}
                    initial={editingFeature}
                    submitLabel={editingFeature.id ? 'Save changes' : 'Add tile'}
                    onSubmit={saveLocationFeature}
                    onDelete={editingFeature.id ? () => deleteLocationFeature(editingFeature.id) : null}
                    deleteLabel="Delete tile"
                    onClose={() => setEditingFeature(null)}
                />
            )}
        </div>
    )
}
