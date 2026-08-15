import { useEffect, useState } from 'react'
import '../css/accommodationSection.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useAccommodationSection,
    loadAccommodationSection,
    saveAccommodationSection,
} from '../../data/accommodationSection.js'

// CMS → Accommodations. The heading above the carousel, and nothing else.
//
// The cards under it are not CMS copy. Every one of them is built from the
// accommodation catalog — name, photo, gallery, description, "What's Included",
// price and capacity — which is edited in Units → Manage Accommodations, with
// availability counted off real bookings. Editing a card here as well would
// give one field two screens to be changed on and two answers when they
// disagreed.
//
// That is worth saying on the screen rather than only in a commit message: a
// staff member who opens this tab looking for the Teepee's photo needs to be
// told where it actually is, not left to conclude the CMS is broken.

function sectionFields() {
    return [
        {
            name: 'title',
            label: 'Heading',
            placeholder: 'Accommodations',
            help: 'The heading above the carousel.',
        },
        {
            name: 'subtitle',
            label: 'Line under it',
            placeholder: '• Find the perfect spot for your stay •',
            help: 'The bullets are part of what you type — leave them in to keep the look.',
        },
    ]
}

export default function AccommodationSection({ onGoToUnits }) {
    const { section, error } = useAccommodationSection()
    const [editing, setEditing] = useState(null)

    useEffect(() => {
        loadAccommodationSection()
    }, [])

    return (
        <div className="acc-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Accommodations heading</h3>
                    <p className="crud-bar-note">
                        The title and line above the accommodations carousel on the home page.
                        Saved changes are live straight away.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary"
                    onClick={() =>
                        setEditing({
                            title: section.title ?? '',
                            subtitle: section.subtitle ?? '',
                        })
                    }
                >
                    Edit the wording
                </button>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}

            <div className="acc-cms-preview">
                {section.title && <h4 className="acc-cms-title">{section.title}</h4>}
                {section.subtitle && <p className="acc-cms-sub">{section.subtitle}</p>}
            </div>

            {/* Where the rest of this section actually comes from. */}
            <div className="acc-cms-note">
                <h4>The cards are not edited here</h4>
                <p>
                    Each accommodation's name, photo, gallery, description, "What's Included"
                    list, price and capacity live with the accommodation itself, and how many
                    are free on a given day is counted off real bookings. Editing them here as
                    well would mean two screens for the same field.
                </p>
                {onGoToUnits ? (
                    <button type="button" className="crud-btn is-small" onClick={onGoToUnits}>
                        Open Units → Manage Accommodations
                    </button>
                ) : (
                    <p className="acc-cms-note-path">
                        <strong>Units → Manage Accommodations</strong>
                    </p>
                )}
            </div>

            {editing && (
                <CrudModal
                    title="Accommodations heading"
                    subtitle="The heading above the carousel. Live on the home page the moment it saves."
                    fields={sectionFields}
                    initial={editing}
                    submitLabel="Save wording"
                    onSubmit={saveAccommodationSection}
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    )
}
