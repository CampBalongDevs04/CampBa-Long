import { useEffect, useState } from 'react'
import '../css/faqSection.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useFaqSection,
    loadFaqSection,
    saveFaqSection,
    saveFaq,
    deleteFaq,
    moveFaq,
} from '../../data/faqSection.js'

// CMS → FAQ. The intro beside the accordion, and the questions in it.
//
// The rows show the answer in full rather than truncated. Half of these are
// prices and policies, and the job staff come here to do is read one and decide
// whether it is still true — which a first line ending in an ellipsis does not
// let them do.

function sectionFields() {
    return [
        {
            name: 'eyebrow',
            label: 'Small line above the heading',
            placeholder: 'FAQ',
            help: 'Printed in gold, in caps.',
        },
        {
            name: 'title',
            label: 'Heading',
            placeholder: 'Frequently Asked Questions',
        },
        {
            name: 'description',
            label: 'Paragraph under it',
            type: 'textarea',
            rows: 5,
            placeholder: 'Planning your getaway? Here are the answers to the questions our '
                + 'guests ask most…',
        },
        [
            {
                name: 'contactLabel',
                label: 'Button',
                placeholder: 'Any questions? Reach out',
                help: 'Clearing this removes the button.',
            },
            {
                name: 'contactHref',
                label: 'Where it goes',
                placeholder: '#contact',
                help: 'A link starting with # scrolls to that section of the page.',
            },
        ],
    ]
}

function faqFields() {
    return [
        {
            name: 'question',
            label: 'Question',
            placeholder: 'How much is the entrance fee?',
            help: 'The line a guest taps. Write it the way a guest would ask it.',
        },
        {
            name: 'answer',
            label: 'Answer',
            type: 'textarea',
            rows: 5,
            placeholder: '150/ pax for day time (10am-5pm)…',
            help: 'One paragraph. The panel opens as a single block, so line breaks typed '
                + 'here run together on the page.',
        },
        { name: 'isActive', label: 'Show this question on the home page', type: 'checkbox' },
    ]
}

const BLANK_FAQ = {
    id: null,
    question: '',
    answer: '',
    sortOrder: 0,
    isActive: true,
}

function toDraft(row) {
    return Object.fromEntries(
        Object.keys(BLANK_FAQ).map((key) => [key, row[key] ?? BLANK_FAQ[key]]),
    )
}

export default function FaqSection() {
    const { section, faqs, loaded, error } = useFaqSection()
    const [editingSection, setEditingSection] = useState(null)
    const [editing, setEditing] = useState(null)
    // Reordering writes straight to the database with no form in between, so
    // its refusals have nowhere else to be shown.
    const [moveError, setMoveError] = useState('')

    useEffect(() => {
        loadFaqSection()
    }, [])

    const ordered = [...faqs].sort((a, b) => a.sortOrder - b.sortOrder)
    const shown = ordered.filter((faq) => faq.isActive).length

    const handleMove = async (run) => {
        setMoveError('')
        const result = await run()
        if (!result.ok) setMoveError(result.message)
    }

    return (
        <div className="faq-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">FAQ</h3>
                    <p className="crud-bar-note">
                        The questions on the home page and the words beside them. Saved changes
                        are live straight away — there is no draft and no publish step.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary"
                    onClick={() =>
                        setEditing({
                            ...BLANK_FAQ,
                            sortOrder: (ordered.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add a question
                </button>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}
            {moveError && <p className="crud-message is-error">{moveError}</p>}

            <div className="faq-cms-preview">
                {section.eyebrow && <p className="faq-cms-eyebrow">{section.eyebrow}</p>}
                {section.title && <h4 className="faq-cms-title">{section.title}</h4>}
                {section.description && <p className="faq-cms-text">{section.description}</p>}
                <div className="faq-cms-preview-foot">
                    {section.contactLabel && (
                        <span className="faq-cms-btn-preview">
                            {section.contactLabel}
                            <small>{section.contactHref || 'no link'}</small>
                        </span>
                    )}
                    <button
                        type="button"
                        className="crud-btn is-small"
                        onClick={() =>
                            setEditingSection({
                                eyebrow: section.eyebrow ?? '',
                                title: section.title ?? '',
                                description: section.description ?? '',
                                contactLabel: section.contactLabel ?? '',
                                contactHref: section.contactHref ?? '',
                            })
                        }
                    >
                        Edit the wording
                    </button>
                </div>
            </div>

            {/* Not a warning — nothing is broken. It is the one thing about this
                section a staff member cannot see by reading it: these answers
                quote prices that live somewhere else, and nothing moves them. */}
            <div className="faq-cms-note">
                <h4>These answers do not update themselves</h4>
                <p>
                    Several of them quote the entrance fee, the cottage fee and the check-in
                    windows. Those are set in <strong>Units</strong> and the rate schedules, and
                    nothing carries a change across to the wording here — an answer is a
                    sentence somebody wrote, not a live figure. After changing a price, come
                    back and re-read these.
                </p>
            </div>

            <div className="crud-bar faq-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Questions</h3>
                    <p className="crud-bar-note">
                        {shown === 0
                            ? 'None are showing, so the accordion beside the intro is empty.'
                            : `${shown} of ${ordered.length} showing, in this order.`}
                    </p>
                </div>
            </div>

            {ordered.length === 0 ? (
                <p className="crud-empty">
                    {loaded
                        ? 'No questions yet. Add the first one above.'
                        : 'Loading the FAQ…'}
                </p>
            ) : (
                <div className="faq-cms-list">
                    {ordered.map((faq, index) => (
                        <article
                            key={faq.id}
                            className={`faq-cms-row ${faq.isActive ? '' : 'crud-is-hidden'}`}
                        >
                            <span className="faq-cms-number" aria-hidden="true">
                                {index + 1}
                            </span>
                            <div className="faq-cms-copy">
                                <h4>
                                    {faq.question}
                                    {!faq.isActive && <span className="crud-hidden-tag">Hidden</span>}
                                </h4>
                                <p>{faq.answer}</p>
                            </div>
                            <div className="crud-row-actions">
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    aria-label="Move earlier"
                                    disabled={index === 0}
                                    onClick={() => handleMove(() => moveFaq(faq.id, 'up'))}
                                >
                                    ‹
                                </button>
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    aria-label="Move later"
                                    disabled={index === ordered.length - 1}
                                    onClick={() => handleMove(() => moveFaq(faq.id, 'down'))}
                                >
                                    ›
                                </button>
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    onClick={() => setEditing(toDraft(faq))}
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
                    title="FAQ intro"
                    subtitle="The words beside the questions. Live on the home page the moment it saves."
                    fields={sectionFields}
                    initial={editingSection}
                    submitLabel="Save wording"
                    onSubmit={saveFaqSection}
                    onClose={() => setEditingSection(null)}
                />
            )}

            {editing && (
                <CrudModal
                    title={editing.id ? 'Edit question' : 'New question'}
                    subtitle={
                        editing.id
                            ? 'Unticking the box takes it off the page and keeps the wording — '
                              + 'useful for an answer that has stopped being true and has not '
                              + 'been rewritten yet.'
                            : 'It joins the end of the list.'
                    }
                    fields={faqFields}
                    initial={editing}
                    submitLabel={editing.id ? 'Save changes' : 'Add question'}
                    onSubmit={saveFaq}
                    onDelete={editing.id ? () => deleteFaq(editing.id) : null}
                    deleteLabel="Delete question"
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    )
}
