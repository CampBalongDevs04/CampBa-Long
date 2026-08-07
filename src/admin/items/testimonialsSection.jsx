import { useEffect, useState } from 'react'
import '../css/testimonialsSection.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useTestimonials,
    loadTestimonials,
    saveTestimonialSection,
    saveTestimonial,
    deleteTestimonial,
    moveTestimonial,
} from '../../data/testimonialsSection.js'

// CMS → Testimonials. The heading above the marquee, and the guest reviews
// scrolling past under it.
//
// This is the CMS list staff will add to most often — a good review turns up
// on Google, somebody types it in here. So "Add a review" is the primary
// button on the panel rather than a small one at the end of a sub-bar, and the
// form asks for the four things a card shows and nothing else.

function sectionFields() {
    return [
        {
            name: 'title',
            label: 'Heading',
            placeholder: 'Testimonials',
            help: 'The heading above the reviews.',
        },
        {
            name: 'subtitle',
            label: 'Line under it',
            placeholder: '• What our guests say about Camp Ba-long •',
            help: 'The bullets are part of what you type — leave them in to keep the look.',
        },
    ]
}

function testimonialFields() {
    return [
        [
            {
                name: 'name',
                label: 'Guest name',
                placeholder: 'Jimmy Ong',
                help: 'The circle beside it shows their initials.',
            },
            {
                name: 'rating',
                label: 'Stars',
                type: 'number',
                placeholder: '5',
                help: '0 to 5. Halves like 4.5 draw half a star.',
            },
        ],
        {
            name: 'comment',
            label: 'What they wrote',
            type: 'textarea',
            rows: 5,
            placeholder: 'Very accommodating staff, and the water is freezing cold…',
            help: 'Copy it across as they wrote it. Emoji are fine — the cards already '
                + 'carry them.',
        },
        {
            name: 'stay',
            label: 'Small line under the name',
            placeholder: 'Stayed in the Teepee · March 2026',
            help: 'Optional, and empty on every review the site shipped with. Leave it '
                + 'blank and the name stands on its own.',
        },
        { name: 'isActive', label: 'Show this review on the home page', type: 'checkbox' },
    ]
}

const BLANK_TESTIMONIAL = {
    id: null,
    name: '',
    rating: 5,
    comment: '',
    stay: '',
    sortOrder: 0,
    isActive: true,
}

function toDraft(row) {
    return Object.fromEntries(
        Object.keys(BLANK_TESTIMONIAL).map((key) => [key, row[key] ?? BLANK_TESTIMONIAL[key]]),
    )
}

// The same five stars the card draws, at the size a list row can carry. Halves
// are shown as halves: a 4.5 that rounded to 5 here would have staff correcting
// a rating that was already right.
function Stars({ rating }) {
    return (
        <span className="tst-cms-stars" aria-label={`${rating} out of 5 stars`}>
            {[0, 1, 2, 3, 4].map((i) => {
                const fill = Math.max(0, Math.min(1, rating - i))
                return (
                    <span className="tst-cms-star" key={i} aria-hidden="true">
                        <span className="tst-cms-star-fill" style={{ width: `${fill * 100}%` }}>
                            ★
                        </span>
                        ★
                    </span>
                )
            })}
        </span>
    )
}

function initialsOf(name) {
    return String(name ?? '')
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
}

export default function TestimonialsSection() {
    const { section, testimonials, loaded, error } = useTestimonials()
    const [editingSection, setEditingSection] = useState(null)
    const [editing, setEditing] = useState(null)
    // Reordering writes straight to the database with no form in between, so
    // its refusals have nowhere else to be shown.
    const [moveError, setMoveError] = useState('')

    useEffect(() => {
        loadTestimonials()
    }, [])

    const ordered = [...testimonials].sort((a, b) => a.sortOrder - b.sortOrder)
    const shown = ordered.filter((item) => item.isActive).length

    const handleMove = async (run) => {
        setMoveError('')
        const result = await run()
        if (!result.ok) setMoveError(result.message)
    }

    return (
        <div className="tst-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Testimonials</h3>
                    <p className="crud-bar-note">
                        The reviews scrolling past on the home page. Saved changes are live
                        straight away — there is no draft and no publish step.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary"
                    onClick={() =>
                        setEditing({
                            ...BLANK_TESTIMONIAL,
                            sortOrder: (ordered.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add a review
                </button>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}
            {moveError && <p className="crud-message is-error">{moveError}</p>}

            <div className="tst-cms-preview">
                {section.title && <h4 className="tst-cms-title">{section.title}</h4>}
                {section.subtitle && <p className="tst-cms-sub">{section.subtitle}</p>}
                <button
                    type="button"
                    className="crud-btn is-small"
                    onClick={() =>
                        setEditingSection({
                            title: section.title ?? '',
                            subtitle: section.subtitle ?? '',
                        })
                    }
                >
                    Edit the wording
                </button>
            </div>

            <div className="crud-bar tst-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Reviews</h3>
                    <p className="crud-bar-note">
                        {shown === 0
                            ? 'None are showing, so the whole section is off the home page.'
                            : `${shown} of ${ordered.length} showing, in this order. The marquee `
                              + 'loops, so the first follows the last.'}
                    </p>
                </div>
            </div>

            {ordered.length === 0 ? (
                <p className="crud-empty">
                    {loaded
                        ? 'No reviews yet. Add the first one above — the section stays off the '
                          + 'home page until there is one.'
                        : 'Loading the testimonials…'}
                </p>
            ) : (
                <div className="tst-cms-list">
                    {ordered.map((item, index) => (
                        <article
                            key={item.id}
                            className={`tst-cms-card ${item.isActive ? '' : 'crud-is-hidden'}`}
                        >
                            <div className="tst-cms-avatar" aria-hidden="true">
                                {initialsOf(item.name)}
                            </div>
                            <div className="tst-cms-copy">
                                <h4>
                                    {item.name}
                                    {!item.isActive && <span className="crud-hidden-tag">Hidden</span>}
                                </h4>
                                <Stars rating={item.rating} />
                                <p className="tst-cms-comment">{item.comment}</p>
                                {item.stay && <p className="tst-cms-stay">{item.stay}</p>}
                            </div>
                            <div className="crud-row-actions">
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    aria-label="Move earlier"
                                    disabled={index === 0}
                                    onClick={() => handleMove(() => moveTestimonial(item.id, 'up'))}
                                >
                                    ‹
                                </button>
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    aria-label="Move later"
                                    disabled={index === ordered.length - 1}
                                    onClick={() => handleMove(() => moveTestimonial(item.id, 'down'))}
                                >
                                    ›
                                </button>
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    onClick={() => setEditing(toDraft(item))}
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
                    title="Testimonials heading"
                    subtitle="The heading above the reviews. Live on the home page the moment it saves."
                    fields={sectionFields}
                    initial={editingSection}
                    submitLabel="Save wording"
                    onSubmit={saveTestimonialSection}
                    onClose={() => setEditingSection(null)}
                />
            )}

            {editing && (
                <CrudModal
                    title={editing.id ? 'Edit review' : 'New review'}
                    subtitle={
                        editing.id
                            ? 'Unticking the box takes it out of the marquee and keeps its '
                              + 'wording. Deleting cannot be undone.'
                            : 'It joins the end of the marquee. Reviews are transcribed by staff '
                              + '— guests cannot post one from the site.'
                    }
                    fields={testimonialFields}
                    initial={editing}
                    submitLabel={editing.id ? 'Save changes' : 'Add review'}
                    onSubmit={saveTestimonial}
                    onDelete={editing.id ? () => deleteTestimonial(editing.id) : null}
                    deleteLabel="Delete review"
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    )
}
