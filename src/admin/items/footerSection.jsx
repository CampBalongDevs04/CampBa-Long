import { useEffect, useState } from 'react'
import '../css/footerSection.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useFooter,
    loadFooter,
    saveFooterSection,
    saveFooterLegal,
    saveFooterLink,
    deleteFooterLink,
    moveFooterLink,
    saveFooterSocial,
    deleteFooterSocial,
    moveFooterSocial,
} from '../../data/footerSection.js'

// CMS → Footer. The three columns at the bottom of every page, and the two
// legal panels the bottom bar opens.
//
// THE WORDING AND THE LEGAL TEXT ARE EDITED SEPARATELY
// ---------------------------------------------------
// Same reasoning as the hero's two forms and the contact tab's: they are
// different jobs done at different moments by, quite often, different people.
// Fixing "be Updated" should not put a staff member one stray click away from
// clearing the Terms & Conditions.

function sectionFields() {
    return [
        {
            name: 'resortName',
            label: 'Resort name',
            placeholder: 'Camp Ba-long',
            help: 'Heads the first column and signs the copyright line.',
        },
        {
            name: 'aboutText',
            label: 'Blurb under it',
            type: 'textarea',
            rows: 4,
            placeholder: 'Where you can connect with your inner peace!…',
        },
        [
            {
                name: 'updatesTitle',
                label: 'Second heading',
                placeholder: 'be Updated',
                help: 'The small gold line in the first column.',
            },
            {
                name: 'linksTitle',
                label: 'Middle column heading',
                placeholder: 'Discover Camp Ba-long',
            },
        ],
        {
            name: 'updatesText',
            label: 'Paragraph under the second heading',
            type: 'textarea',
            rows: 4,
            placeholder: 'Camp Ba-Long Nature Farm: A Refreshing Nature Escape…',
        },
        {
            name: 'touchTitle',
            label: 'Third column heading',
            placeholder: 'Get in Touch',
        },
        [
            {
                name: 'phone',
                label: 'Phone',
                placeholder: '09622331708',
                help: 'Tapped on a phone this dials exactly what you type.',
            },
            {
                name: 'email',
                label: 'Email',
                placeholder: 'campbalongnaturefarm@gmail.com',
            },
        ],
        {
            name: 'copyrightSuffix',
            label: 'After the copyright line',
            placeholder: 'All rights reserved.',
            help: 'The line reads "© <this year> <resort name>." and then this. The year '
                + 'comes from the clock, so there is nothing to update each January.',
        },
    ]
}

function legalFields() {
    return [
        {
            name: 'termsLabel',
            label: 'First button',
            placeholder: 'Terms & Conditions',
            help: 'Also the heading of the panel it opens.',
        },
        {
            name: 'termsText',
            label: 'What the panel says',
            type: 'textarea',
            rows: 8,
            placeholder: 'By booking or staying at Camp Ba-long, you agree to…',
            help: 'This is what a guest has agreed to by booking. Emptying it removes the '
                + 'button rather than opening a blank panel.',
        },
        {
            name: 'policyLabel',
            label: 'Second button',
            placeholder: 'Copyright Policy',
            help: 'Also the heading of the panel it opens.',
        },
        {
            name: 'policyText',
            label: 'What that panel says',
            type: 'textarea',
            rows: 6,
            placeholder: 'All content on this site, including photos, text…',
        },
    ]
}

function linkFields() {
    return [
        {
            name: 'label',
            label: 'Words',
            placeholder: 'Accommodations',
        },
        {
            name: 'href',
            label: 'Where it goes',
            placeholder: '/#accommodations',
            help: '"/" is the home page, "/#contact" opens it and scrolls to that section, '
                + 'and a full https:// address opens in a new tab.',
        },
        { name: 'isActive', label: 'Show this in the footer', type: 'checkbox' },
    ]
}

function socialFields() {
    return [
        {
            name: 'label',
            label: 'Words',
            placeholder: 'Facebook',
            help: 'These are printed as words, not logos.',
        },
        {
            name: 'href',
            label: 'Where it goes',
            type: 'url',
            placeholder: 'https://facebook.com/campbalong',
            help: 'Always opens in a new tab.',
        },
        { name: 'isActive', label: 'Show this in the footer', type: 'checkbox' },
    ]
}

const BLANK_LINK = { id: null, label: '', href: '', sortOrder: 0, isActive: true }

function toDraft(row) {
    return Object.fromEntries(
        Object.keys(BLANK_LINK).map((key) => [key, row[key] ?? BLANK_LINK[key]]),
    )
}

export default function FooterSection() {
    const { section, links, socials, loaded, error } = useFooter()
    const [editingSection, setEditingSection] = useState(null)
    const [editingLegal, setEditingLegal] = useState(null)
    const [editingLink, setEditingLink] = useState(null)
    const [editingSocial, setEditingSocial] = useState(null)
    // Reordering writes straight to the database with no form in between, so
    // its refusals have nowhere else to be shown.
    const [moveError, setMoveError] = useState('')

    useEffect(() => {
        loadFooter()
    }, [])

    const orderedLinks = [...links].sort((a, b) => a.sortOrder - b.sortOrder)
    const orderedSocials = [...socials].sort((a, b) => a.sortOrder - b.sortOrder)
    const year = new Date().getFullYear()

    const handleMove = async (run) => {
        setMoveError('')
        const result = await run()
        if (!result.ok) setMoveError(result.message)
    }

    // Both lists are the same shape and get the same row, so it is written
    // once — which is also why they cannot drift apart on screen.
    const linkList = (rows, { onEdit, onMove, empty }) =>
        rows.length === 0 ? (
            <p className="crud-empty">{loaded ? empty : 'Loading the footer…'}</p>
        ) : (
            <div className="ftr-cms-list">
                {rows.map((row, index) => (
                    <article
                        key={row.id}
                        className={`ftr-cms-row ${row.isActive ? '' : 'crud-is-hidden'}`}
                    >
                        <div className="ftr-cms-copy">
                            <h4>
                                {row.label}
                                {!row.isActive && <span className="crud-hidden-tag">Hidden</span>}
                            </h4>
                            <p>{row.href}</p>
                        </div>
                        <div className="crud-row-actions">
                            <button
                                type="button"
                                className="crud-btn is-small"
                                aria-label="Move earlier"
                                disabled={index === 0}
                                onClick={() => handleMove(() => onMove(row.id, 'up'))}
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                className="crud-btn is-small"
                                aria-label="Move later"
                                disabled={index === rows.length - 1}
                                onClick={() => handleMove(() => onMove(row.id, 'down'))}
                            >
                                ›
                            </button>
                            <button
                                type="button"
                                className="crud-btn is-small"
                                onClick={() => onEdit(toDraft(row))}
                            >
                                Edit
                            </button>
                        </div>
                    </article>
                ))}
            </div>
        )

    return (
        <div className="ftr-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Footer</h3>
                    <p className="crud-bar-note">
                        The bottom of <strong>every</strong> page, not just the home page. Saved
                        changes are live straight away — there is no draft and no publish step.
                    </p>
                </div>
                <div className="crud-row-actions">
                    <button
                        type="button"
                        className="crud-btn"
                        onClick={() =>
                            setEditingLegal({
                                termsLabel: section.termsLabel ?? '',
                                termsText: section.termsText ?? '',
                                policyLabel: section.policyLabel ?? '',
                                policyText: section.policyText ?? '',
                            })
                        }
                    >
                        Terms &amp; policy
                    </button>
                    <button
                        type="button"
                        className="crud-btn is-primary"
                        onClick={() =>
                            setEditingSection({
                                resortName: section.resortName ?? '',
                                aboutText: section.aboutText ?? '',
                                updatesTitle: section.updatesTitle ?? '',
                                updatesText: section.updatesText ?? '',
                                linksTitle: section.linksTitle ?? '',
                                touchTitle: section.touchTitle ?? '',
                                phone: section.phone ?? '',
                                email: section.email ?? '',
                                copyrightSuffix: section.copyrightSuffix ?? '',
                            })
                        }
                    >
                        Edit the wording
                    </button>
                </div>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}
            {moveError && <p className="crud-message is-error">{moveError}</p>}

            {/* The footer as it is printed — dark, three columns, bottom bar.
                Staff should not have to scroll to the end of the site in
                another tab to check what they just changed. */}
            <div className="ftr-cms-preview">
                <div className="ftr-cms-columns">
                    <div>
                        <h4 className="ftr-cms-name">{section.resortName}</h4>
                        {section.aboutText && <p>{section.aboutText}</p>}
                        {section.updatesTitle && (
                            <p className="ftr-cms-eyebrow">{section.updatesTitle}</p>
                        )}
                        {section.updatesText && <p>{section.updatesText}</p>}
                    </div>
                    <div>
                        {section.linksTitle && <h5>{section.linksTitle}</h5>}
                        <ul>
                            {orderedLinks
                                .filter((link) => link.isActive)
                                .map((link) => (
                                    <li key={link.id}>{link.label}</li>
                                ))}
                        </ul>
                    </div>
                    <div>
                        {section.touchTitle && <h5>{section.touchTitle}</h5>}
                        <ul>
                            {section.phone && <li>{section.phone}</li>}
                            {section.email && <li>{section.email}</li>}
                        </ul>
                        <p className="ftr-cms-socials">
                            {orderedSocials
                                .filter((social) => social.isActive)
                                .map((social) => (
                                    <span key={social.id}>{social.label}</span>
                                ))}
                        </p>
                    </div>
                </div>
                <div className="ftr-cms-bottom">
                    <span>
                        © {year} {section.resortName}. {section.copyrightSuffix}
                    </span>
                    <span className="ftr-cms-legal">
                        {section.termsText && <span>{section.termsLabel}</span>}
                        {section.policyText && <span>{section.policyLabel}</span>}
                    </span>
                </div>
            </div>

            <div className="crud-bar ftr-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Menu links</h3>
                    <p className="crud-bar-note">The middle column, in this order.</p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary is-small"
                    onClick={() =>
                        setEditingLink({
                            ...BLANK_LINK,
                            sortOrder: (orderedLinks.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add a link
                </button>
            </div>

            {linkList(orderedLinks, {
                onEdit: setEditingLink,
                onMove: moveFooterLink,
                empty: 'No links. Add the first one above, or leave it — the column keeps its '
                    + 'heading and nothing under it.',
            })}

            <div className="crud-bar ftr-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Social links</h3>
                    <p className="crud-bar-note">
                        Under the phone and email. Printed as words, not logos, and always
                        opened in a new tab.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary is-small"
                    onClick={() =>
                        setEditingSocial({
                            ...BLANK_LINK,
                            sortOrder: (orderedSocials.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add a social link
                </button>
            </div>

            {linkList(orderedSocials, {
                onEdit: setEditingSocial,
                onMove: moveFooterSocial,
                empty: 'No social links. The row disappears when it is empty.',
            })}

            {/* Not a warning — nothing is broken. Both are things a staff member
                cannot find out by reading this screen. */}
            <div className="ftr-cms-note">
                <h4>Two things worth knowing</h4>
                <p>
                    <strong>This is on every page.</strong> The booking flow, the menu and My
                    Booking all end with it, so a change here is not confined to the home page
                    the way the other CMS tabs are.
                </p>
                <p>
                    <strong>The number is written down more than once.</strong> It is also in
                    the Contact section and on the Location card. Changing it here changes the
                    footer only, which is deliberate — an office landline and a booking mobile
                    are a normal pair — so update those tabs too if they should match.
                </p>
            </div>

            {editingSection && (
                <CrudModal
                    title="Footer wording"
                    subtitle="The three columns and the copyright line. Live on every page the moment it saves."
                    fields={sectionFields}
                    initial={editingSection}
                    submitLabel="Save wording"
                    onSubmit={saveFooterSection}
                    onClose={() => setEditingSection(null)}
                />
            )}

            {editingLegal && (
                <CrudModal
                    title="Terms & policy"
                    subtitle="The two panels the bottom bar opens. This is what a guest has agreed to by booking, so read it through before saving."
                    fields={legalFields}
                    initial={editingLegal}
                    submitLabel="Save legal text"
                    onSubmit={saveFooterLegal}
                    onClose={() => setEditingLegal(null)}
                />
            )}

            {editingLink && (
                <CrudModal
                    title={editingLink.id ? 'Edit link' : 'New link'}
                    subtitle={
                        editingLink.id
                            ? 'Unticking the box takes it out of the footer and keeps its wording.'
                            : 'It joins the end of the middle column.'
                    }
                    fields={linkFields}
                    initial={editingLink}
                    submitLabel={editingLink.id ? 'Save changes' : 'Add link'}
                    onSubmit={saveFooterLink}
                    onDelete={editingLink.id ? () => deleteFooterLink(editingLink.id) : null}
                    deleteLabel="Delete link"
                    onClose={() => setEditingLink(null)}
                />
            )}

            {editingSocial && (
                <CrudModal
                    title={editingSocial.id ? 'Edit social link' : 'New social link'}
                    subtitle={
                        editingSocial.id
                            ? 'Unticking the box takes it out of the footer and keeps its wording.'
                            : 'It joins the end of the row.'
                    }
                    fields={socialFields}
                    initial={editingSocial}
                    submitLabel={editingSocial.id ? 'Save changes' : 'Add social link'}
                    onSubmit={saveFooterSocial}
                    onDelete={editingSocial.id ? () => deleteFooterSocial(editingSocial.id) : null}
                    deleteLabel="Delete social link"
                    onClose={() => setEditingSocial(null)}
                />
            )}
        </div>
    )
}
