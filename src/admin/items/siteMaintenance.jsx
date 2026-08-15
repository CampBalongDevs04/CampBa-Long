import { useEffect, useState } from 'react'
import '../css/crud.css'
import '../css/siteMaintenance.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useSiteMaintenance,
    loadSiteMaintenance,
    saveSiteMaintenance,
} from '../../data/siteMaintenance.js'

// Maintenance → Website Blocker. One switch that takes the guest site down to a
// single page, and the wording that page shows.

function wordingFields() {
    return [
        { name: 'heading', label: 'Heading', placeholder: 'Website on Maintenance' },
        {
            name: 'message',
            label: 'Message',
            type: 'textarea',
            placeholder: 'Feel free to message us.',
        },
        {
            name: 'facebookUrl',
            label: 'Facebook page',
            type: 'url',
            placeholder: 'https://facebook.com/campbalong',
            help: 'Where the "Message us on Facebook" button goes. Leave it empty to hide '
                + 'the button.',
        },
    ]
}

export default function SiteMaintenance() {
    const { isOn, heading, message, facebookUrl, loaded, error } = useSiteMaintenance()
    const [editing, setEditing] = useState(null)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState('')

    useEffect(() => {
        loadSiteMaintenance()
    }, [])

    const toggle = async () => {
        if (saving) return
        setSaving(true)
        setSaveError('')
        const result = await saveSiteMaintenance({ isOn: !isOn })
        setSaving(false)
        if (!result.ok) setSaveError(result.message)
    }

    return (
        <div className="site-mtn-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Website Blocker</h3>
                    <p className="crud-bar-note">
                        Turns the whole guest website — home, booking, menu, spa and My Booking
                        — into a single maintenance page. This dashboard stays reachable, so the
                        switch can always be turned back off.
                    </p>
                </div>
                <div className="crud-row-actions">
                    <button
                        type="button"
                        className="crud-btn"
                        onClick={() => setEditing({ heading, message, facebookUrl })}
                    >
                        Edit wording
                    </button>
                </div>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}
            {saveError && <p className="crud-message is-error">{saveError}</p>}

            <div className={`site-mtn-switch-row${isOn ? ' is-on' : ''}`}>
                <label className="site-mtn-switch">
                    <input
                        type="checkbox"
                        role="switch"
                        checked={isOn}
                        disabled={!loaded || saving}
                        onChange={toggle}
                    />
                    <span className="site-mtn-slider" aria-hidden="true" />
                    <span className="site-mtn-switch-label">
                        {isOn ? 'Maintenance page is ON' : 'Maintenance page is OFF'}
                    </span>
                </label>
                <p className="site-mtn-switch-note">
                    {!loaded
                        ? 'Loading the setting…'
                        : saving
                            ? 'Saving…'
                            : isOn
                                ? 'Visitors see the page below instead of the website. Anyone with a '
                                  + 'page already open is switched over without reloading.'
                                : 'The website is live. Bookings, the menu and the spa page all work '
                                  + 'as normal.'}
                </p>
            </div>

            <section className="site-mtn-preview" aria-label="What visitors see">
                <p className="site-mtn-preview-tag">What visitors see</p>
                <div className="site-mtn-preview-card">
                    <h4 className="site-mtn-preview-title">{heading}</h4>
                    <p className="site-mtn-preview-text">{message}</p>
                    {facebookUrl ? (
                        <span className="site-mtn-preview-btn">Message us on Facebook</span>
                    ) : (
                        <span className="site-mtn-preview-empty">
                            No Facebook page set, so no button is shown.
                        </span>
                    )}
                </div>
            </section>

            {editing && (
                <CrudModal
                    title="Maintenance page wording"
                    subtitle="What the page says while the blocker is on. Saving this does not turn the blocker on or off."
                    fields={wordingFields}
                    initial={editing}
                    submitLabel="Save wording"
                    onSubmit={saveSiteMaintenance}
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    )
}
