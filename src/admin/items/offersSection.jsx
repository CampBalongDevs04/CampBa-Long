import { useEffect, useState } from 'react'
import '../css/offersSection.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import CmsIcon from '../../components/CmsIcon.jsx'
import { CMS_ICON_OPTIONS, hasCmsIcon } from '../../data/cmsIcons.js'
import {
    useOffersSection,
    loadOffersSection,
    saveOfferSection,
    saveOfferCard,
    deleteOfferCard,
    moveOfferCard,
    saveOfferGalleryItem,
    deleteOfferGalleryItem,
    moveOfferGalleryItem,
    saveOfferTag,
    deleteOfferTag,
    moveOfferTag,
    resolveOfferImage,
} from '../../data/offersSection.js'

// CMS → What We Offer. The amenity cards on the home page, the window each
// card's "Discover More" opens, and the small chip row under them.
//
// TWO LEVELS, LIKE UNITS → MANAGE ACCOMMODATIONS
// ----------------------------------------------
// A card and one of its gallery photos are separate rows, so each card here
// has its own Edit and a strip of photo lines under it with their own. That is
// the same shape as an accommodation and its per-schedule rates, and for the
// same reason: they are edited at different moments and one of them is a list.

function sectionFields() {
    return [
        {
            name: 'title',
            label: 'Heading',
            placeholder: 'What We Offer',
        },
        {
            name: 'subtitle',
            label: 'Line under it',
            placeholder: '• Unwind. Indulge. Reconnect.',
            help: 'The bullet is part of what you type — leave it in to keep the look.',
        },
        {
            name: 'subtitleHighlight',
            label: 'Closing words (gold)',
            placeholder: 'All in one place',
            help: 'Printed in gold at the end of the line above, with a bullet after it.',
        },
    ]
}

function cardFields(values) {
    return [
        {
            name: 'title',
            label: 'Heading',
            placeholder: 'Pool & Running Water',
        },
        {
            name: 'description',
            label: 'Description',
            placeholder: 'Enjoy nature theme pools',
            help: 'One short line — it sits between the heading and the Discover More button.',
        },
        {
            name: 'imageUrl',
            label: 'Card photo',
            type: 'image',
            folder: 'offers',
            preview: resolveOfferImage(values.id, values.imageUrl),
            help: 'Fills the top of the card. A landscape photo crops best. JPG, PNG or '
                + 'WebP, up to 5 MB.',
        },
        {
            name: 'imageAlt',
            label: 'Photo description',
            placeholder: 'Natural theme pool surrounded by greenery',
            help: 'Read aloud in place of the photo by a screen reader, and shown if the '
                + 'photo fails to load.',
        },
        {
            name: 'iconKey',
            label: 'Icon',
            type: 'select',
            options: [{ value: '', label: 'No icon' }, ...CMS_ICON_OPTIONS],
            help: values.iconUrl
                ? 'Ignored while an uploaded icon is set below. Remove that to use one of these.'
                : 'Shown in the medallion straddling the photo, and again at the top of the '
                  + '"Discover More" window.',
        },
        {
            name: 'iconUrl',
            label: 'Or upload an icon',
            type: 'image',
            folder: 'offers',
            help: 'Overrides the choice above. It sits in a dark green medallion and the page '
                + 'draws it in pale gold, so line art on a transparent background works and a '
                + 'photograph comes out solid white. SVG or PNG, up to 5 MB.',
        },
        { name: 'isActive', label: 'Show this card on the home page', type: 'checkbox' },
    ]
}

function galleryFields() {
    return [
        {
            name: 'title',
            label: 'Title',
            placeholder: 'Running Water',
            help: 'The heading under the photo, in caps.',
        },
        {
            name: 'description',
            label: 'Small description',
            type: 'textarea',
            rows: 2,
            placeholder: 'Spring-fed and running all day, straight off the mountain.',
            help: 'One or two lines under the title. Leave it blank and the title stands '
                + 'on its own.',
        },
        {
            name: 'imageUrl',
            label: 'Photo',
            type: 'image',
            folder: 'offers',
            help: 'Until one is uploaded the window shows a "Photo coming soon" placeholder '
                + 'in this slot. JPG, PNG or WebP, up to 5 MB.',
        },
        {
            name: 'imageAlt',
            label: 'Photo description',
            placeholder: 'running water',
            help: 'Read aloud in place of the photo by a screen reader.',
        },
        { name: 'isActive', label: 'Show this in the window', type: 'checkbox' },
    ]
}

function tagFields(values) {
    return [
        {
            name: 'label',
            label: 'Word',
            placeholder: 'Nature',
            help: 'One word or two — these are small chips, not sentences.',
        },
        {
            name: 'iconKey',
            label: 'Icon',
            type: 'select',
            options: [{ value: '', label: 'No icon' }, ...CMS_ICON_OPTIONS],
            help: values.iconUrl
                ? 'Ignored while an uploaded icon is set below. Remove that to use one of these.'
                : 'Shown to the left of the word.',
        },
        {
            name: 'iconUrl',
            label: 'Or upload an icon',
            type: 'image',
            folder: 'offers',
            help: 'Overrides the choice above. These chips sit on cream and keep their own '
                + 'colour, so anything legible on a light background works. SVG or PNG, '
                + 'up to 5 MB.',
        },
        { name: 'isActive', label: 'Show this on the home page', type: 'checkbox' },
    ]
}

const BLANK_CARD = {
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

const BLANK_GALLERY_ITEM = {
    id: null,
    cardId: '',
    title: '',
    description: '',
    imageUrl: '',
    imageAlt: '',
    sortOrder: 0,
    isActive: true,
}

const BLANK_TAG = {
    id: null,
    label: '',
    iconKey: '',
    iconUrl: '',
    sortOrder: 0,
    isActive: true,
}

function toDraft(row, blank) {
    return Object.fromEntries(Object.keys(blank).map((key) => [key, row[key] ?? blank[key]]))
}

export default function OffersSection() {
    const { section, cards, tags, loaded, error } = useOffersSection()
    const [editingSection, setEditingSection] = useState(null)
    const [editingCard, setEditingCard] = useState(null)
    const [editingItem, setEditingItem] = useState(null)
    const [editingTag, setEditingTag] = useState(null)
    // Reordering writes straight to the database with no form in between, so
    // its refusals have nowhere else to be shown.
    const [moveError, setMoveError] = useState('')

    useEffect(() => {
        loadOffersSection()
    }, [])

    const orderedCards = [...cards].sort((a, b) => a.sortOrder - b.sortOrder)
    const orderedTags = [...tags].sort((a, b) => a.sortOrder - b.sortOrder)

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
        <div className="offers-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">What We Offer</h3>
                    <p className="crud-bar-note">
                        The amenity cards on the home page and the window each one opens. Saved
                        changes are live straight away — there is no draft and no publish step.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary"
                    onClick={() =>
                        setEditingSection({
                            title: section.title ?? '',
                            subtitle: section.subtitle ?? '',
                            subtitleHighlight: section.subtitleHighlight ?? '',
                        })
                    }
                >
                    Edit the wording
                </button>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}
            {moveError && <p className="crud-message is-error">{moveError}</p>}

            <div className="offers-cms-preview">
                {section.title && <h4 className="offers-cms-title">{section.title}</h4>}
                {(section.subtitle || section.subtitleHighlight) && (
                    <p className="offers-cms-sub">
                        {section.subtitle}{' '}
                        <span className="offers-cms-highlight">{section.subtitleHighlight}</span> •
                    </p>
                )}
            </div>

            <div className="crud-bar offers-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Cards</h3>
                    <p className="crud-bar-note">
                        Each card's photo, icon and wording — and under it, the photos its
                        "Discover More" window shows.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary is-small"
                    onClick={() =>
                        setEditingCard({
                            ...BLANK_CARD,
                            sortOrder: (orderedCards.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add a card
                </button>
            </div>

            {orderedCards.length === 0 ? (
                <p className="crud-empty">
                    {loaded
                        ? 'No cards in the grid. Add the first one above.'
                        : 'Loading the offers section…'}
                </p>
            ) : (
                <div className="offers-cms-list">
                    {orderedCards.map((card, cardIndex) => {
                        const gallery = [...card.gallery].sort((a, b) => a.sortOrder - b.sortOrder)
                        return (
                            <article
                                key={card.id}
                                className={`offers-cms-card ${card.isActive ? '' : 'crud-is-hidden'}`}
                            >
                                <div className="offers-cms-card-head">
                                    <div className="offers-cms-photo">
                                        {resolveOfferImage(card.id, card.imageUrl) ? (
                                            <img src={resolveOfferImage(card.id, card.imageUrl)} alt="" />
                                        ) : (
                                            <span>No photo</span>
                                        )}
                                    </div>
                                    <div className="offers-cms-icon">
                                        <CmsIcon iconKey={card.iconKey} iconUrl={card.iconUrl} />
                                    </div>
                                    <div className="offers-cms-copy">
                                        <h4>
                                            {card.title}
                                            {!card.isActive && (
                                                <span className="crud-hidden-tag">Hidden</span>
                                            )}
                                        </h4>
                                        <p>{card.description || 'No description'}</p>
                                        {!hasCmsIcon(card.iconKey, card.iconUrl) && (
                                            <p className="offers-cms-warning">
                                                No icon — the medallion on the card is empty.
                                            </p>
                                        )}
                                    </div>
                                    <div className="crud-row-actions">
                                        {arrows(
                                            orderedCards.length,
                                            cardIndex,
                                            () => moveOfferCard(card.id, 'up'),
                                            () => moveOfferCard(card.id, 'down'),
                                        )}
                                        <button
                                            type="button"
                                            className="crud-btn is-small"
                                            onClick={() => setEditingCard(toDraft(card, BLANK_CARD))}
                                        >
                                            Edit
                                        </button>
                                    </div>
                                </div>

                                <div className="offers-cms-gallery">
                                    <div className="offers-cms-gallery-head">
                                        <span className="offers-cms-gallery-title">
                                            “Discover More” window
                                        </span>
                                        <button
                                            type="button"
                                            className="crud-btn is-small"
                                            onClick={() =>
                                                setEditingItem({
                                                    ...BLANK_GALLERY_ITEM,
                                                    cardId: card.id,
                                                    cardTitle: card.title,
                                                    sortOrder: (gallery.at(-1)?.sortOrder ?? 0) + 1,
                                                })
                                            }
                                        >
                                            + Add a photo
                                        </button>
                                    </div>

                                    {gallery.length === 0 ? (
                                        <p className="offers-cms-gallery-empty">
                                            Nothing in the window yet — "Discover More" opens an
                                            empty panel until a photo is added.
                                        </p>
                                    ) : (
                                        gallery.map((item, itemIndex) => (
                                            <div
                                                className={`offers-cms-slot ${item.isActive ? '' : 'crud-is-hidden'}`}
                                                key={item.id}
                                            >
                                                <div className="offers-cms-slot-photo">
                                                    {item.imageUrl ? (
                                                        <img src={item.imageUrl} alt="" />
                                                    ) : (
                                                        <span>Coming soon</span>
                                                    )}
                                                </div>
                                                <div className="offers-cms-copy">
                                                    <h5>
                                                        {item.title}
                                                        {!item.isActive && (
                                                            <span className="crud-hidden-tag">Hidden</span>
                                                        )}
                                                    </h5>
                                                    <p>
                                                        {item.description || (
                                                            <em>No description yet</em>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="crud-row-actions">
                                                    {arrows(
                                                        gallery.length,
                                                        itemIndex,
                                                        () => moveOfferGalleryItem(card.id, item.id, 'up'),
                                                        () => moveOfferGalleryItem(card.id, item.id, 'down'),
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="crud-btn is-small"
                                                        onClick={() =>
                                                            setEditingItem({
                                                                ...toDraft(item, BLANK_GALLERY_ITEM),
                                                                cardId: card.id,
                                                                cardTitle: card.title,
                                                            })
                                                        }
                                                    >
                                                        Edit
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}

            <div className="crud-bar offers-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Chips</h3>
                    <p className="crud-bar-note">
                        The small icon-and-word row under the cards.
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
                    + Add a chip
                </button>
            </div>

            {orderedTags.length === 0 ? (
                <p className="crud-empty">
                    {loaded
                        ? 'No chips. Add one above, or leave it — the row disappears when it '
                          + 'is empty.'
                        : 'Loading the offers section…'}
                </p>
            ) : (
                <div className="offers-cms-list">
                    {orderedTags.map((tag, index) => (
                        <article
                            key={tag.id}
                            className={`offers-cms-chip ${tag.isActive ? '' : 'crud-is-hidden'}`}
                        >
                            <div className="offers-cms-chip-icon">
                                <CmsIcon iconKey={tag.iconKey} iconUrl={tag.iconUrl} />
                            </div>
                            <div className="offers-cms-copy">
                                <h4>
                                    {tag.label}
                                    {!tag.isActive && <span className="crud-hidden-tag">Hidden</span>}
                                </h4>
                                {!hasCmsIcon(tag.iconKey, tag.iconUrl) && (
                                    <p className="offers-cms-warning">
                                        No icon — the chip shows its word alone.
                                    </p>
                                )}
                            </div>
                            <div className="crud-row-actions">
                                {arrows(
                                    orderedTags.length,
                                    index,
                                    () => moveOfferTag(tag.id, 'up'),
                                    () => moveOfferTag(tag.id, 'down'),
                                )}
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    onClick={() => setEditingTag(toDraft(tag, BLANK_TAG))}
                                >
                                    Edit
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {editingSection && (
                <CrudModal
                    title="Offers heading"
                    subtitle="The heading above the cards. Live on the home page the moment it saves."
                    fields={sectionFields}
                    initial={editingSection}
                    submitLabel="Save wording"
                    onSubmit={saveOfferSection}
                    onClose={() => setEditingSection(null)}
                />
            )}

            {editingCard && (
                <CrudModal
                    title={editingCard.id ? 'Edit card' : 'New card'}
                    subtitle={
                        editingCard.id
                            ? 'Unticking the box takes it off the home page and keeps its wording. '
                              + 'Deleting takes its "Discover More" photos with it.'
                            : 'It joins the end of the grid. Add the photos for its "Discover More" '
                              + 'window after saving.'
                    }
                    fields={cardFields}
                    initial={editingCard}
                    submitLabel={editingCard.id ? 'Save changes' : 'Add card'}
                    onSubmit={saveOfferCard}
                    onDelete={editingCard.id ? () => deleteOfferCard(editingCard.id) : null}
                    deleteLabel="Delete card"
                    onClose={() => setEditingCard(null)}
                />
            )}

            {editingItem && (
                <CrudModal
                    title={editingItem.id ? 'Edit photo' : 'New photo'}
                    subtitle={`Shown inside the “Discover More” window of ${editingItem.cardTitle}.`}
                    fields={galleryFields}
                    initial={editingItem}
                    submitLabel={editingItem.id ? 'Save changes' : 'Add photo'}
                    onSubmit={saveOfferGalleryItem}
                    onDelete={editingItem.id ? () => deleteOfferGalleryItem(editingItem.id) : null}
                    deleteLabel="Delete photo"
                    onClose={() => setEditingItem(null)}
                />
            )}

            {editingTag && (
                <CrudModal
                    title={editingTag.id ? 'Edit chip' : 'New chip'}
                    subtitle={
                        editingTag.id
                            ? 'Unticking the box takes it off the home page and keeps its wording.'
                            : 'It joins the end of the row.'
                    }
                    fields={tagFields}
                    initial={editingTag}
                    submitLabel={editingTag.id ? 'Save changes' : 'Add chip'}
                    onSubmit={saveOfferTag}
                    onDelete={editingTag.id ? () => deleteOfferTag(editingTag.id) : null}
                    deleteLabel="Delete chip"
                    onClose={() => setEditingTag(null)}
                />
            )}
        </div>
    )
}
