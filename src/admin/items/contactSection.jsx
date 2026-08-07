import { useEffect, useState } from 'react'
import '../css/contactSection.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import CmsIcon from '../../components/CmsIcon.jsx'
import { CMS_ICON_OPTIONS, hasCmsIcon } from '../../data/cmsIcons.js'
import {
    useContactSection,
    loadContactSection,
    saveContactSection,
    saveContactForm,
    saveContactDetail,
    deleteContactDetail,
    moveContactDetail,
} from '../../data/contactSection.js'

// CMS → Contact. The heading, the column beside the enquiry form, and what the
// form itself says.
//
// THE WORDING AND THE FORM ARE EDITED SEPARATELY
// ----------------------------------------------
// Same reasoning as the hero's two forms: rewording the paragraph beside the
// form should not put a staff member one stray click away from clearing the
// label off the Email box. They are also different jobs — one is prose, the
// other is four labels and a button — and one form holding both would be
// twenty fields long.
//
// What the form DOES is not here at all: the field names are what the email
// template reads, and the panel says so on screen.

function sectionFields() {
    return [
        {
            name: 'eyebrow',
            label: 'Small line above the heading',
            placeholder: 'Contact us',
            help: 'Printed in gold, in caps.',
        },
        {
            name: 'title',
            label: 'Heading',
            placeholder: 'Got question in your mind?',
        },
        {
            name: 'infoTitle',
            label: 'Heading beside the form',
            placeholder: 'We’d love to hear from you',
        },
        {
            name: 'infoText',
            label: 'Paragraph under it',
            type: 'textarea',
            rows: 4,
            placeholder: 'Planning a stay, booking an event, or just curious about Camp Ba-long?…',
        },
        [
            {
                name: 'adminTitle',
                label: 'Panel heading',
                placeholder: 'Admin Hours',
                help: 'The cream panel at the bottom of that column.',
            },
            {
                name: 'adminText',
                label: 'The hours',
                placeholder: 'Monday - Sunday 8AM - 5PM',
            },
        ],
        {
            name: 'noteLabel',
            label: 'Note — the bold word it opens with',
            placeholder: 'Note:',
            help: 'Printed in bold at the start of the sentence below.',
        },
        {
            name: 'noteText',
            label: 'Note — up to the times',
            type: 'textarea',
            rows: 2,
            placeholder: 'Booking confirmations and other administrative requests are processed '
                + 'only during',
            help: 'The sentence runs straight into the bold times below, so it ends without '
                + 'a full stop.',
        },
        {
            name: 'noteHighlight',
            label: 'Note — the bold times',
            placeholder: '8:00 AM – 5:00 PM.',
            help: 'Printed in bold in the middle of the sentence. The spaces either side are '
                + 'added for you.',
        },
        {
            name: 'noteAfter',
            label: 'Note — the rest',
            type: 'textarea',
            rows: 2,
            placeholder: 'Requests made outside these hours will be handled on the next '
                + 'business day.',
        },
    ]
}

function formFields() {
    return [
        [
            { name: 'formNameLabel', label: 'Name field' },
            { name: 'formNamePlaceholder', label: 'Its grey hint', placeholder: 'Enter your name' },
        ],
        [
            { name: 'formEmailLabel', label: 'Email field' },
            { name: 'formEmailPlaceholder', label: 'Its grey hint', placeholder: 'Enter your email' },
        ],
        [
            { name: 'formPhoneLabel', label: 'Phone field' },
            { name: 'formPhonePlaceholder', label: 'Its grey hint', placeholder: 'Enter your phone number' },
        ],
        [
            { name: 'formMessageLabel', label: 'Message field' },
            { name: 'formMessagePlaceholder', label: 'Its grey hint', placeholder: 'Enter your message' },
        ],
        [
            {
                name: 'formSubmitLabel',
                label: 'Button',
                placeholder: 'Send Message',
            },
            {
                name: 'formSendingLabel',
                label: 'While it sends',
                placeholder: 'Sending…',
                help: 'Leave it blank and the button keeps its own wording while sending.',
            },
        ],
    ]
}

function detailFields(values) {
    return [
        [
            {
                name: 'label',
                label: 'Label',
                placeholder: 'Phone',
                help: 'In gold caps above the line.',
            },
            {
                name: 'info',
                label: 'What it says',
                placeholder: '+63 9622331708',
            },
        ],
        {
            name: 'iconKey',
            label: 'Icon',
            type: 'select',
            options: [{ value: '', label: 'No icon' }, ...CMS_ICON_OPTIONS],
            help: values.iconUrl
                ? 'Ignored while an uploaded icon is set below. Remove that to use one of these.'
                : 'Shown in the circle to the left.',
        },
        {
            name: 'iconUrl',
            label: 'Or upload an icon',
            type: 'image',
            folder: 'contact',
            help: 'Overrides the choice above. SVG or PNG, up to 5 MB.',
        },
        { name: 'isActive', label: 'Show this row on the page', type: 'checkbox' },
    ]
}

const BLANK_DETAIL = {
    id: null,
    label: '',
    info: '',
    iconKey: '',
    iconUrl: '',
    sortOrder: 0,
    isActive: true,
}

function toDraft(row) {
    return Object.fromEntries(
        Object.keys(BLANK_DETAIL).map((key) => [key, row[key] ?? BLANK_DETAIL[key]]),
    )
}

export default function ContactSection() {
    const { section, details, loaded, error } = useContactSection()
    const [editingSection, setEditingSection] = useState(null)
    const [editingForm, setEditingForm] = useState(null)
    const [editingDetail, setEditingDetail] = useState(null)
    // Reordering writes straight to the database with no form in between, so
    // its refusals have nowhere else to be shown.
    const [moveError, setMoveError] = useState('')

    useEffect(() => {
        loadContactSection()
    }, [])

    const ordered = [...details].sort((a, b) => a.sortOrder - b.sortOrder)

    const handleMove = async (run) => {
        setMoveError('')
        const result = await run()
        if (!result.ok) setMoveError(result.message)
    }

    return (
        <div className="con-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Contact</h3>
                    <p className="crud-bar-note">
                        The words beside the enquiry form and on the form itself. Saved changes
                        are live straight away — there is no draft and no publish step.
                    </p>
                </div>
                <div className="crud-row-actions">
                    <button
                        type="button"
                        className="crud-btn"
                        onClick={() =>
                            setEditingForm({
                                formNameLabel: section.formNameLabel ?? '',
                                formNamePlaceholder: section.formNamePlaceholder ?? '',
                                formEmailLabel: section.formEmailLabel ?? '',
                                formEmailPlaceholder: section.formEmailPlaceholder ?? '',
                                formPhoneLabel: section.formPhoneLabel ?? '',
                                formPhonePlaceholder: section.formPhonePlaceholder ?? '',
                                formMessageLabel: section.formMessageLabel ?? '',
                                formMessagePlaceholder: section.formMessagePlaceholder ?? '',
                                formSubmitLabel: section.formSubmitLabel ?? '',
                                formSendingLabel: section.formSendingLabel ?? '',
                            })
                        }
                    >
                        Form wording
                    </button>
                    <button
                        type="button"
                        className="crud-btn is-primary"
                        onClick={() =>
                            setEditingSection({
                                eyebrow: section.eyebrow ?? '',
                                title: section.title ?? '',
                                infoTitle: section.infoTitle ?? '',
                                infoText: section.infoText ?? '',
                                adminTitle: section.adminTitle ?? '',
                                adminText: section.adminText ?? '',
                                noteLabel: section.noteLabel ?? '',
                                noteText: section.noteText ?? '',
                                noteHighlight: section.noteHighlight ?? '',
                                noteAfter: section.noteAfter ?? '',
                            })
                        }
                    >
                        Edit the wording
                    </button>
                </div>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}
            {moveError && <p className="crud-message is-error">{moveError}</p>}

            {/* What the page is showing right now, laid out the way it is laid
                out there. Staff should not have to open the site in another tab
                to check what they just changed. */}
            <div className="con-cms-preview">
                <div className="con-cms-head">
                    {section.eyebrow && <p className="con-cms-eyebrow">{section.eyebrow}</p>}
                    {section.title && <h4 className="con-cms-title">{section.title}</h4>}
                </div>

                <div className="con-cms-columns">
                    <div className="con-cms-info">
                        {section.infoTitle && <h5>{section.infoTitle}</h5>}
                        {section.infoText && <p className="con-cms-info-text">{section.infoText}</p>}
                        {(section.adminTitle || section.adminText || section.noteText) && (
                            <div className="con-cms-admin">
                                {section.adminTitle && <strong>{section.adminTitle}</strong>}
                                {section.adminText && <p>{section.adminText}</p>}
                                <p className="con-cms-note">
                                    {section.noteLabel && <b>{section.noteLabel} </b>}
                                    {section.noteText}
                                    {section.noteHighlight && <b> {section.noteHighlight} </b>}
                                    {section.noteAfter}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* The form as a guest reads it — labels, hints, button.
                        It is not typeable here: this is a picture of the
                        wording, and the fields are edited in "Form wording". */}
                    <div className="con-cms-form">
                        {[
                            [section.formNameLabel, section.formNamePlaceholder],
                            [section.formEmailLabel, section.formEmailPlaceholder],
                            [section.formPhoneLabel, section.formPhonePlaceholder],
                            [section.formMessageLabel, section.formMessagePlaceholder],
                        ].map(([label, placeholder]) => (
                            <div className="con-cms-field" key={label}>
                                <span className="con-cms-field-label">{label}</span>
                                <span className="con-cms-field-box">
                                    {placeholder || <em>no hint</em>}
                                </span>
                            </div>
                        ))}
                        <span className="con-cms-submit">{section.formSubmitLabel}</span>
                        <p className="con-cms-sending">
                            While sending: “{section.formSendingLabel}”
                        </p>
                    </div>
                </div>
            </div>

            <div className="crud-bar con-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Phone, email and hours</h3>
                    <p className="crud-bar-note">
                        The rows between the paragraph and the Admin Hours panel.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary is-small"
                    onClick={() =>
                        setEditingDetail({
                            ...BLANK_DETAIL,
                            sortOrder: (ordered.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add a row
                </button>
            </div>

            {ordered.length === 0 ? (
                <p className="crud-empty">
                    {loaded
                        ? 'No rows. Add the first one above.'
                        : 'Loading the contact section…'}
                </p>
            ) : (
                <div className="con-cms-list">
                    {ordered.map((detail, index) => (
                        <article
                            key={detail.id}
                            className={`con-cms-row ${detail.isActive ? '' : 'crud-is-hidden'}`}
                        >
                            <span className="con-cms-row-icon">
                                <CmsIcon iconKey={detail.iconKey} iconUrl={detail.iconUrl} />
                            </span>
                            <div className="con-cms-copy">
                                <h4>
                                    {detail.label}
                                    {!detail.isActive && <span className="crud-hidden-tag">Hidden</span>}
                                </h4>
                                <p>{detail.info}</p>
                                {!hasCmsIcon(detail.iconKey, detail.iconUrl) && (
                                    <p className="con-cms-warning">
                                        No icon — the circle beside this row is empty.
                                    </p>
                                )}
                            </div>
                            <div className="crud-row-actions">
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    aria-label="Move earlier"
                                    disabled={index === 0}
                                    onClick={() => handleMove(() => moveContactDetail(detail.id, 'up'))}
                                >
                                    ‹
                                </button>
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    aria-label="Move later"
                                    disabled={index === ordered.length - 1}
                                    onClick={() => handleMove(() => moveContactDetail(detail.id, 'down'))}
                                >
                                    ›
                                </button>
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    onClick={() => setEditingDetail(toDraft(detail))}
                                >
                                    Edit
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {/* Not warnings — nothing is broken. Both are things a staff member
                cannot find out by reading this screen. */}
            <div className="con-cms-note-box">
                <h4>Two things this page does not control</h4>
                <p>
                    <strong>The number is written down more than once.</strong> It is also on the
                    Location card and in the footer. Changing it here changes this section only,
                    which is deliberate — an office landline and a booking mobile are a normal
                    pair — so update the Location tab too if they should match.
                </p>
                <p>
                    <strong>Where the enquiry goes is set elsewhere.</strong> This tab changes
                    what the form says. The address a message is delivered to, and the
                    confirmation the guest receives, are part of the email settings, not the
                    wording.
                </p>
            </div>

            {editingSection && (
                <CrudModal
                    title="Contact wording"
                    subtitle="The heading, the column beside the form, and the Admin Hours panel. Live on the home page the moment it saves."
                    fields={sectionFields}
                    initial={editingSection}
                    submitLabel="Save wording"
                    onSubmit={saveContactSection}
                    onClose={() => setEditingSection(null)}
                />
            )}

            {editingForm && (
                <CrudModal
                    title="Form wording"
                    subtitle="What the enquiry form says. What it does — which fields it has and where a message goes — is not changed here."
                    fields={formFields}
                    initial={editingForm}
                    submitLabel="Save form wording"
                    onSubmit={saveContactForm}
                    onClose={() => setEditingForm(null)}
                />
            )}

            {editingDetail && (
                <CrudModal
                    title={editingDetail.id ? 'Edit row' : 'New row'}
                    subtitle={
                        editingDetail.id
                            ? 'Unticking the box takes it off the page and keeps its wording.'
                            : 'It joins the bottom of the list, above the Admin Hours panel.'
                    }
                    fields={detailFields}
                    initial={editingDetail}
                    submitLabel={editingDetail.id ? 'Save changes' : 'Add row'}
                    onSubmit={saveContactDetail}
                    onDelete={
                        editingDetail.id ? () => deleteContactDetail(editingDetail.id) : null
                    }
                    deleteLabel="Delete row"
                    onClose={() => setEditingDetail(null)}
                />
            )}
        </div>
    )
}
