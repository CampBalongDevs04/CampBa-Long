import { useEffect, useState } from 'react'
import '../css/menuBanner.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useMenuSections,
    loadMenuSections,
    saveMenuSections,
    saveMenuSectionsMedia,
    resolveMenuSectionImage,
} from '../../data/menuSections.js'

// CMS → Food Menu → Section Titles. The heading and toggle button each catalog
// section prints above its own items on /menu — MENU, Combo Meal, Pre-Order and
// Coffee (data/menuSections.js).
//
// The items under those headings are catalog data, not copy: they are edited in
// the dashboard's Food Menu SECTION in the sidebar, not here. This tab owns the
// four headings and the one banner photo, and nothing else.

function sectionsFields() {
    return [
        [
            { name: 'menuTitle', label: 'MENU section heading', placeholder: 'MENU' },
            { name: 'menuToggleLabel', label: 'Its toggle button', placeholder: 'Foods' },
        ],
        [
            { name: 'comboTitle', label: 'Combo Meal section heading', placeholder: 'COMBO MEAL' },
            { name: 'comboToggleLabel', label: 'Its toggle button', placeholder: 'Meals' },
        ],
        [
            { name: 'preorderTitle', label: 'Pre-Order section heading', placeholder: 'PRE-ORDER' },
            { name: 'preorderToggleLabel', label: 'Its toggle button', placeholder: 'Foods' },
        ],
        {
            name: 'coffeeEyebrow',
            label: 'Coffee — small line above its heading',
            placeholder: 'Bukal Cafe by Camp Ba-Long Nature Farm',
        },
        [
            { name: 'coffeeTitle', label: 'Coffee section heading', placeholder: 'COFFEE' },
            { name: 'coffeeToggleLabel', label: 'Its toggle button', placeholder: 'Coffee Menu' },
        ],
    ]
}

function sectionsMediaFields(values) {
    return [
        {
            name: 'menuImageUrl',
            label: 'MENU section banner photo',
            type: 'image',
            folder: 'menu',
            preview: resolveMenuSectionImage(values.menuImageUrl),
            help: 'The blurred backdrop behind the MENU heading. Combo Meal, Pre-Order and '
                + 'Coffee don\'t have one of their own.',
        },
    ]
}

export default function MenuSectionTitles() {
    const { sections, loaded: sectionsLoaded, error: sectionsError } = useMenuSections()

    const [editingSections, setEditingSections] = useState(null)
    const [editingSectionsMedia, setEditingSectionsMedia] = useState(null)

    useEffect(() => {
        loadMenuSections()
    }, [])

    return (
        <div className="menu-hero-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Section titles</h3>
                    <p className="crud-bar-note">
                        The heading and toggle button each catalog section prints above its own
                        items. The items themselves are edited in the Food Menu tabs, not here.
                    </p>
                </div>
                <div className="crud-row-actions">
                    <button
                        type="button"
                        className="crud-btn"
                        onClick={() => setEditingSectionsMedia({ menuImageUrl: sections.menuImageUrl ?? '' })}
                    >
                        MENU photo
                    </button>
                    <button
                        type="button"
                        className="crud-btn is-primary"
                        onClick={() =>
                            setEditingSections({
                                menuTitle: sections.menuTitle ?? '',
                                menuToggleLabel: sections.menuToggleLabel ?? '',
                                comboTitle: sections.comboTitle ?? '',
                                comboToggleLabel: sections.comboToggleLabel ?? '',
                                preorderTitle: sections.preorderTitle ?? '',
                                preorderToggleLabel: sections.preorderToggleLabel ?? '',
                                coffeeEyebrow: sections.coffeeEyebrow ?? '',
                                coffeeTitle: sections.coffeeTitle ?? '',
                                coffeeToggleLabel: sections.coffeeToggleLabel ?? '',
                            })
                        }
                    >
                        Edit titles
                    </button>
                </div>
            </div>

            {sectionsError && <p className="crud-message is-error">{sectionsError}</p>}
            {!sectionsLoaded && <p className="crud-empty">Loading the section titles…</p>}

            <div className="menu-hero-cms-titles-preview">
                <span className="menu-hero-cms-title-chip">
                    {sections.menuTitle}
                    <em>{sections.menuToggleLabel}</em>
                </span>
                <span className="menu-hero-cms-title-chip">
                    {sections.comboTitle}
                    <em>{sections.comboToggleLabel}</em>
                </span>
                <span className="menu-hero-cms-title-chip">
                    {sections.preorderTitle}
                    <em>{sections.preorderToggleLabel}</em>
                </span>
                <span className="menu-hero-cms-title-chip">
                    {sections.coffeeEyebrow && <em>{sections.coffeeEyebrow}</em>}
                    {sections.coffeeTitle}
                    <em>{sections.coffeeToggleLabel}</em>
                </span>
                <span className="menu-hero-cms-title-chip menu-hero-cms-title-chip-photo">
                    <img src={resolveMenuSectionImage(sections.menuImageUrl)} alt="" />
                    MENU photo
                </span>
            </div>

            {editingSections && (
                <CrudModal
                    title="Section titles"
                    subtitle="The heading and toggle button each catalog section prints above its own items."
                    fields={sectionsFields}
                    initial={editingSections}
                    submitLabel="Save titles"
                    onSubmit={saveMenuSections}
                    onClose={() => setEditingSections(null)}
                />
            )}

            {editingSectionsMedia && (
                <CrudModal
                    title="MENU section photo"
                    subtitle="Uploads go straight into the resort's own storage, so they survive a redeploy. Removing one puts the photo the site shipped with back."
                    fields={sectionsMediaFields}
                    initial={editingSectionsMedia}
                    submitLabel="Save photo"
                    onSubmit={saveMenuSectionsMedia}
                    onClose={() => setEditingSectionsMedia(null)}
                />
            )}
        </div>
    )
}
