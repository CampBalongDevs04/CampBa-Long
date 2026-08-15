import { useEffect, useState } from 'react'
import '../css/welcomeSection.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import CmsIcon from '../../components/CmsIcon.jsx'
import { CMS_ICON_OPTIONS, hasCmsIcon } from '../../data/cmsIcons.js'
import {
    COLLAGE_PHOTO_COUNT,
    useWelcomeSection,
    loadWelcomeSection,
    saveWelcomeSection,
    saveWelcomeHighlight,
    deleteWelcomeHighlight,
    moveWelcomeHighlight,
    saveWelcomeTag,
    deleteWelcomeTag,
    moveWelcomeTag,
    resolveHighlightImage,
} from '../../data/welcomeSection.js'

// CMS → Welcome Section. The block under the hero: the welcome heading, the
// gold "A HIDDEN PARADISE IN NATURE" line, the photo collage with its numbered
// list, and the green four-tile panel below it.
//
// Same arrangement as the hero banner next door — one form per thing being
// edited, a live preview of what the page is showing now, and arrows rather
// than a position number, because the order on this screen IS the order on the
// page. See data/welcomeSection.js.

// The tiles staff can add are all icon + heading + line, and the icon is picked
// the same way in each. Built as a function so both forms stay in step when
// one of them gains a field.
function iconFields(values, { help }) {
    return [
        {
            name: 'iconKey',
            label: 'Icon',
            type: 'select',
            options: [{ value: '', label: 'No icon' }, ...CMS_ICON_OPTIONS],
            help: values.iconUrl
                ? 'Ignored while an uploaded icon is set below. Remove that to use one of these.'
                : help,
        },
        {
            name: 'iconUrl',
            label: 'Or upload an icon',
            type: 'image',
            folder: 'welcome',
            // No preview to compute: half the bundled icons are React
            // components rather than files, so there is no URL an <img> could
            // show for the choice made in the select above. The frame stands
            // empty until something is actually uploaded, which is the truth.
            help: 'Overrides the choice above. It sits in a dark circle and the page draws it '
                + 'in cream, so line art on a transparent background works and a photograph '
                + 'comes out solid white. SVG or PNG, up to 5 MB.',
        },
    ]
}

function sectionFields() {
    return [
        {
            name: 'title',
            label: 'Heading',
            placeholder: 'Welcome to Camp Ba-long',
            help: 'The large heading at the top of the section.',
        },
        {
            name: 'tagline',
            label: 'Line under the heading',
            placeholder: 'Where you can connect with your inner peace!',
        },
        {
            name: 'message',
            label: 'Gold line',
            placeholder: '• A HIDDEN PARADISE IN NATURE •',
            help: 'Under the lotus divider, in gold. The bullets are part of what you type — '
                + 'leave them in to keep the look.',
        },
        {
            name: 'description',
            label: 'Description',
            type: 'textarea',
            rows: 4,
            placeholder: 'Immerse yourself in the healing waters…',
            help: 'The paragraph under the gold line.',
        },
    ]
}

function highlightFields(values) {
    return [
        {
            name: 'title',
            label: 'Heading',
            placeholder: 'Refreshing Pool',
        },
        {
            name: 'description',
            label: 'Description',
            type: 'textarea',
            rows: 3,
            placeholder: 'Enjoy the cool, crystal-clear waters and peaceful atmosphere…',
        },
        {
            name: 'imageUrl',
            label: 'Collage photo',
            type: 'image',
            folder: 'welcome',
            preview: resolveHighlightImage(values.id, values.imageUrl),
            help: 'One of the overlapping photos beside the list. A landscape photo crops '
                + 'best. JPG, PNG or WebP, up to 5 MB.',
        },
        {
            name: 'imageAlt',
            label: 'Photo description',
            placeholder: 'Refreshing pool at Camp Ba-long',
            help: 'Read aloud in place of the photo by a screen reader, and shown if the '
                + 'photo fails to load.',
        },
        ...iconFields(values, {
            help: 'Shown in the green circle beside the number.',
        }),
        { name: 'isActive', label: 'Show this on the home page', type: 'checkbox' },
    ]
}

function tagFields(values) {
    return [
        {
            name: 'title',
            label: 'Heading',
            placeholder: 'Nature-Inspired Escape',
        },
        {
            name: 'description',
            label: 'Line under it',
            placeholder: 'Relax and reconnect',
            help: 'Two or three words — the tiles sit four across and a sentence pushes the '
                + 'panel out of shape.',
        },
        ...iconFields(values, {
            help: 'Shown in the medallion above the heading.',
        }),
        { name: 'isActive', label: 'Show this on the home page', type: 'checkbox' },
    ]
}

const BLANK_HIGHLIGHT = {
    id: null,
    title: '',
    description: '',
    imageUrl: '',
    imageAlt: '',
    iconKey: '',
    iconUrl: '',
    sortOrder: 0,
    isActive: true,
}

const BLANK_TAG = {
    id: null,
    title: '',
    description: '',
    iconKey: '',
    iconUrl: '',
    sortOrder: 0,
    isActive: true,
}

function toDraft(row, blank) {
    return Object.fromEntries(
        Object.keys(blank).map((key) => [key, row[key] ?? blank[key]]),
    )
}

export default function WelcomeSection() {
    const { welcome, highlights, tags, loaded, error } = useWelcomeSection()
    const [editingSection, setEditingSection] = useState(null)
    const [editingHighlight, setEditingHighlight] = useState(null)
    const [editingTag, setEditingTag] = useState(null)
    // Reordering writes straight to the database with no form in between, so
    // its refusals have nowhere else to be shown.
    const [moveError, setMoveError] = useState('')

    useEffect(() => {
        loadWelcomeSection()
    }, [])

    const orderedHighlights = [...highlights].sort((a, b) => a.sortOrder - b.sortOrder)
    const orderedTags = [...tags].sort((a, b) => a.sortOrder - b.sortOrder)
    const shownHighlights = orderedHighlights.filter((highlight) => highlight.isActive)

    const handleMove = async (move, id, direction) => {
        setMoveError('')
        const result = await move(id, direction)
        if (!result.ok) setMoveError(result.message)
    }

    // Arrows + Edit, identical for both lists.
    const rowActions = (list, move, id, index, onEdit) => (
        <div className="crud-row-actions">
            <button
                type="button"
                className="crud-btn is-small"
                aria-label="Move earlier"
                disabled={index === 0}
                onClick={() => handleMove(move, id, 'up')}
            >
                ‹
            </button>
            <button
                type="button"
                className="crud-btn is-small"
                aria-label="Move later"
                disabled={index === list.length - 1}
                onClick={() => handleMove(move, id, 'down')}
            >
                ›
            </button>
            <button type="button" className="crud-btn is-small" onClick={onEdit}>
                Edit
            </button>
        </div>
    )

    return (
        <div className="welcome-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Welcome Section</h3>
                    <p className="crud-bar-note">
                        The block under the hero on the home page. Saved changes are live
                        straight away — there is no draft and no publish step.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary"
                    onClick={() =>
                        setEditingSection({
                            title: welcome.title ?? '',
                            tagline: welcome.tagline ?? '',
                            message: welcome.message ?? '',
                            description: welcome.description ?? '',
                        })
                    }
                >
                    Edit the wording
                </button>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}
            {moveError && <p className="crud-message is-error">{moveError}</p>}

            {/* What the front page is showing right now. Staff should not have
                to open the site in another tab to check what they changed. */}
            <div className="welcome-cms-preview">
                {welcome.title && <h4 className="welcome-cms-title">{welcome.title}</h4>}
                {welcome.tagline && <p className="welcome-cms-tagline">{welcome.tagline}</p>}
                {welcome.message && <p className="welcome-cms-message">{welcome.message}</p>}
                {welcome.description && (
                    <p className="welcome-cms-description">{welcome.description}</p>
                )}
            </div>

            <div className="crud-bar welcome-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Photo collage</h3>
                    <p className="crud-bar-note">
                        The overlapping photos and the numbered list beside them. The collage
                        holds {COLLAGE_PHOTO_COUNT} — the first {COLLAGE_PHOTO_COUNT} shown
                        below. The numbers (01, 02, 03) follow the order here.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary is-small"
                    onClick={() =>
                        setEditingHighlight({
                            ...BLANK_HIGHLIGHT,
                            sortOrder: (orderedHighlights.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add a photo
                </button>
            </div>

            {orderedHighlights.length === 0 ? (
                <p className="crud-empty">
                    {loaded
                        ? 'Nothing in the collage. Add the first photo above.'
                        : 'Loading the welcome section…'}
                </p>
            ) : (
                <div className="welcome-cms-list">
                    {orderedHighlights.map((highlight, index) => {
                        // Which of these are actually in the collage, counted
                        // over the VISIBLE ones — the same three the page
                        // takes. Hiding the second photo promotes the fourth,
                        // and this says so rather than leaving staff to guess.
                        const shownIndex = shownHighlights.indexOf(highlight)
                        const inCollage = shownIndex > -1 && shownIndex < COLLAGE_PHOTO_COUNT
                        return (
                            <article
                                key={highlight.id}
                                className={`welcome-cms-row ${highlight.isActive ? '' : 'crud-is-hidden'}`}
                            >
                                <div className="welcome-cms-photo">
                                    {resolveHighlightImage(highlight.id, highlight.imageUrl) ? (
                                        <img
                                            src={resolveHighlightImage(highlight.id, highlight.imageUrl)}
                                            alt=""
                                        />
                                    ) : (
                                        <span>No photo</span>
                                    )}
                                </div>
                                <div className="welcome-cms-icon">
                                    <CmsIcon iconKey={highlight.iconKey} iconUrl={highlight.iconUrl} />
                                </div>
                                <div className="welcome-cms-copy">
                                    <h4>
                                        {highlight.title}
                                        {!highlight.isActive && (
                                            <span className="crud-hidden-tag">Hidden</span>
                                        )}
                                        {highlight.isActive && !inCollage && (
                                            <span className="welcome-cms-tag">List only</span>
                                        )}
                                    </h4>
                                    <p>{highlight.description || 'No description'}</p>
                                    {!hasCmsIcon(highlight.iconKey, highlight.iconUrl) && (
                                        <p className="welcome-cms-warning">
                                            No icon — the circle beside the number is empty.
                                        </p>
                                    )}
                                </div>
                                {rowActions(
                                    orderedHighlights,
                                    moveWelcomeHighlight,
                                    highlight.id,
                                    index,
                                    () => setEditingHighlight(toDraft(highlight, BLANK_HIGHLIGHT)),
                                )}
                            </article>
                        )
                    })}
                </div>
            )}

            <div className="crud-bar welcome-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Green panel</h3>
                    <p className="crud-bar-note">
                        The four tiles under the collage. Four fit the row neatly; more than
                        that will wrap.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary is-small"
                    onClick={() =>
                        setEditingTag({
                            ...BLANK_TAG,
                            sortOrder: (orderedTags.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add a tile
                </button>
            </div>

            {orderedTags.length === 0 ? (
                <p className="crud-empty">
                    {loaded
                        ? 'No tiles on the panel. Add one above, or leave it — the panel '
                          + 'disappears when it is empty.'
                        : 'Loading the welcome section…'}
                </p>
            ) : (
                <div className="welcome-cms-list">
                    {orderedTags.map((tag, index) => (
                        <article
                            key={tag.id}
                            className={`welcome-cms-row ${tag.isActive ? '' : 'crud-is-hidden'}`}
                        >
                            <div className="welcome-cms-icon">
                                <CmsIcon iconKey={tag.iconKey} iconUrl={tag.iconUrl} />
                            </div>
                            <div className="welcome-cms-copy">
                                <h4>
                                    {tag.title}
                                    {!tag.isActive && <span className="crud-hidden-tag">Hidden</span>}
                                </h4>
                                <p>{tag.description || 'No description'}</p>
                                {!hasCmsIcon(tag.iconKey, tag.iconUrl) && (
                                    <p className="welcome-cms-warning">
                                        No icon — the medallion above the heading is empty.
                                    </p>
                                )}
                            </div>
                            {rowActions(orderedTags, moveWelcomeTag, tag.id, index, () =>
                                setEditingTag(toDraft(tag, BLANK_TAG)),
                            )}
                        </article>
                    ))}
                </div>
            )}

            {editingSection && (
                <CrudModal
                    title="Welcome wording"
                    subtitle="The headings and paragraphs at the top of the section. Live on the home page the moment it saves."
                    fields={sectionFields}
                    initial={editingSection}
                    submitLabel="Save wording"
                    onSubmit={saveWelcomeSection}
                    onClose={() => setEditingSection(null)}
                />
            )}

            {editingHighlight && (
                <CrudModal
                    title={editingHighlight.id ? 'Edit collage photo' : 'New collage photo'}
                    subtitle={
                        editingHighlight.id
                            ? 'Unticking the box takes it off the home page and keeps its wording.'
                            : `It joins the end of the list. Only the first ${COLLAGE_PHOTO_COUNT} `
                              + 'appear in the collage — reorder with the arrows after saving.'
                    }
                    fields={highlightFields}
                    initial={editingHighlight}
                    submitLabel={editingHighlight.id ? 'Save changes' : 'Add photo'}
                    onSubmit={saveWelcomeHighlight}
                    onDelete={
                        editingHighlight.id
                            ? () => deleteWelcomeHighlight(editingHighlight.id)
                            : null
                    }
                    deleteLabel="Delete photo"
                    onClose={() => setEditingHighlight(null)}
                />
            )}

            {editingTag && (
                <CrudModal
                    title={editingTag.id ? 'Edit tile' : 'New tile'}
                    subtitle={
                        editingTag.id
                            ? 'Unticking the box takes it off the home page and keeps its wording.'
                            : 'It joins the end of the panel. Reorder it with the arrows after saving.'
                    }
                    fields={tagFields}
                    initial={editingTag}
                    submitLabel={editingTag.id ? 'Save changes' : 'Add tile'}
                    onSubmit={saveWelcomeTag}
                    onDelete={editingTag.id ? () => deleteWelcomeTag(editingTag.id) : null}
                    deleteLabel="Delete tile"
                    onClose={() => setEditingTag(null)}
                />
            )}
        </div>
    )
}
