import { useEffect, useState } from 'react'
import '../css/menuBanner.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useMenuHero,
    loadMenuHero,
    saveMenuHero,
    saveMenuHeroMedia,
    resolveMenuHeroImage,
    resolveMenuHeroBackground,
} from '../../data/menuHero.js'
import {
    useMenuOrder,
    loadMenuOrder,
    saveMenuOrder,
    saveMenuOrderMedia,
    saveMenuOrderStep,
    deleteMenuOrderStep,
    moveMenuOrderStep,
    resolveMenuOrderImage,
} from '../../data/menuOrder.js'
import {
    useMenuSections,
    loadMenuSections,
    saveMenuSections,
    saveMenuSectionsMedia,
    resolveMenuSectionImage,
} from '../../data/menuSections.js'

// CMS → Food Menu. Everything on /menu that is words and pictures rather than
// food: the banner at the top (data/menuHero.js), the "How to Order Food"
// panel with its numbered steps (data/menuOrder.js), and the heading each
// catalog section prints above its own items (data/menuSections.js). The food
// items themselves are catalog data, not copy, so they stay in the
// dashboard's Food Menu SECTION, not here — same split as Accommodations,
// whose cards are catalog data edited in Units even though its heading is
// edited here.
//
// All of it used to be written into src/pages/foodmenu.jsx, so rewording it
// was a code change and a redeploy. It is now a handful of rows, and
// everything saved here reaches the menu page immediately, including for
// visitors already on it.
//
// THREE PANELS, EACH SPLIT INTO ITS OWN FORMS
// --------------------------------------------
// Banner, How to Order and Section titles are visually separate blocks of the
// page and are backed by separate tables (see the headers of
// supabase/migrations/20260808140000_menu_hero_cms.sql,
// 20260808160000_menu_order_cms.sql and 20260808170000_menu_sections_cms.sql
// for why). Within each, words and photos are still edited separately, the
// same reasoning as Hero Banner: fixing a typo in a heading should not put a
// staff member one stray click away from clearing a photo.

function contentFields() {
    return [
        {
            name: 'titleLines',
            label: 'Headline',
            type: 'textarea',
            rows: 3,
            placeholder: "Hungry? We've Got\nYou Covered.",
            help: 'One line per line, exactly as it should break on screen.',
        },
        {
            name: 'subtitle',
            label: 'Description',
            type: 'textarea',
            rows: 3,
            placeholder: "Explore our menu and discover dishes you'll keep coming back for.",
            help: 'The paragraph under the headline.',
        },
        [
            {
                name: 'buttonLabel',
                label: 'Button',
                placeholder: 'Order Now',
                help: 'Leave blank to take the button off the page.',
            },
            {
                name: 'buttonHref',
                label: 'Button goes to',
                placeholder: '#how-to-order',
                help: '#how-to-order scrolls down to "How to Order" on this page. /booking opens the booking page. A full https:// address opens in a new tab.',
            },
        ],
    ]
}

function mediaFields(values) {
    return [
        {
            name: 'imageUrl',
            label: 'Circle photo',
            type: 'image',
            folder: 'menu',
            preview: resolveMenuHeroImage(values.imageUrl),
            help: 'The round photo beside the headline. A square image crops best. '
                + 'JPG, PNG or WebP, up to 5 MB.',
        },
        {
            name: 'backgroundUrl',
            label: 'Background image',
            type: 'image',
            folder: 'menu',
            preview: resolveMenuHeroBackground(values.backgroundUrl),
            help: 'The blurred backdrop behind the whole banner. Use a wide photo.',
        },
    ]
}

function orderFields() {
    return [
        {
            name: 'heading',
            label: 'Heading',
            placeholder: 'How to Order Food',
        },
        [
            {
                name: 'noteLabel',
                label: 'Note — the bold word it opens with',
                placeholder: 'Note:',
                help: 'Printed in bold at the start of the sentence below.',
            },
            {
                name: 'noteText',
                label: 'Note — the rest',
                placeholder: 'Food orders are subject to availability and may be modified before the preparation cutoff time.',
            },
        ],
    ]
}

function orderMediaFields(values) {
    return [
        {
            name: 'imageUrl',
            label: 'Photo',
            type: 'image',
            folder: 'menu',
            preview: resolveMenuOrderImage(values.imageUrl),
            help: 'The photo beside the numbered steps.',
        },
    ]
}

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

function stepFields() {
    return [
        {
            name: 'step',
            label: 'Step',
            type: 'textarea',
            rows: 2,
            placeholder: 'Reserve your stay first — you can order before paying.',
        },
        { name: 'isActive', label: 'Show this step on the page', type: 'checkbox' },
    ]
}

const BLANK_STEP = { id: null, step: '', sortOrder: 0, isActive: true }

function stepToDraft(step) {
    return { id: step.id, step: step.step, sortOrder: step.sortOrder, isActive: step.isActive }
}

export default function MenuBanner() {
    const { hero, loaded, error } = useMenuHero()
    const { panel: order, steps, loaded: orderLoaded, error: orderError } = useMenuOrder()
    const { sections, loaded: sectionsLoaded, error: sectionsError } = useMenuSections()

    const [editingContent, setEditingContent] = useState(null)
    const [editingMedia, setEditingMedia] = useState(null)
    const [editingOrder, setEditingOrder] = useState(null)
    const [editingOrderMedia, setEditingOrderMedia] = useState(null)
    const [editingSections, setEditingSections] = useState(null)
    const [editingSectionsMedia, setEditingSectionsMedia] = useState(null)
    const [editingStep, setEditingStep] = useState(null)
    // Reordering writes straight to the database with no form in between, so
    // its refusals have nowhere else to be shown.
    const [moveError, setMoveError] = useState('')

    useEffect(() => {
        loadMenuHero()
        loadMenuOrder()
        loadMenuSections()
    }, [])

    const orderedSteps = [...steps].sort((a, b) => a.sortOrder - b.sortOrder)

    const handleMoveStep = async (id, direction) => {
        setMoveError('')
        const result = await moveMenuOrderStep(id, direction)
        if (!result.ok) setMoveError(result.message)
    }

    return (
        <div className="menu-hero-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Menu Banner</h3>
                    <p className="crud-bar-note">
                        The top of the food menu page. Saved changes are live straight away —
                        there is no draft and no publish step.
                    </p>
                </div>
                <div className="crud-row-actions">
                    <button
                        type="button"
                        className="crud-btn"
                        onClick={() =>
                            setEditingMedia({
                                imageUrl: hero.imageUrl ?? '',
                                backgroundUrl: hero.backgroundUrl ?? '',
                            })
                        }
                    >
                        Photos
                    </button>
                    <button
                        type="button"
                        className="crud-btn is-primary"
                        onClick={() =>
                            setEditingContent({
                                titleLines: hero.titleLines.join('\n'),
                                subtitle: hero.subtitle ?? '',
                                buttonLabel: hero.buttonLabel ?? '',
                                buttonHref: hero.buttonHref ?? '',
                            })
                        }
                    >
                        Edit the wording
                    </button>
                </div>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}

            {/* What /menu is showing right now, laid out the way it is laid out
                there. Staff should not have to open the site in another tab to
                check what they just changed. */}
            <div className="menu-hero-cms-preview">
                <div
                    className="menu-hero-cms-stage"
                    style={{ backgroundImage: `url(${resolveMenuHeroBackground(hero.backgroundUrl)})` }}
                >
                    <div className="menu-hero-cms-stage-copy">
                        <h4 className="menu-hero-cms-title">
                            {hero.titleLines.map((line, index) => (
                                <span key={`${line}-${index}`}>{line}<br /></span>
                            ))}
                        </h4>
                        {hero.subtitle && <p className="menu-hero-cms-subtitle">{hero.subtitle}</p>}
                        {hero.buttonLabel && (
                            <span className="menu-hero-cms-button">
                                {hero.buttonLabel}
                                <em>{hero.buttonHref || 'no link'}</em>
                            </span>
                        )}
                    </div>
                    <div className="menu-hero-cms-circle">
                        <img src={resolveMenuHeroImage(hero.imageUrl)} alt="" />
                    </div>
                </div>
            </div>

            {!loaded && <p className="crud-empty">Loading the menu banner…</p>}

            {/* ---------------------------------------------------------- How to Order */}

            <div className="crud-bar menu-hero-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">How to Order</h3>
                    <p className="crud-bar-note">
                        The panel further down /menu that walks a guest through ordering.
                    </p>
                </div>
                <div className="crud-row-actions">
                    <button
                        type="button"
                        className="crud-btn"
                        onClick={() => setEditingOrderMedia({ imageUrl: order.imageUrl ?? '' })}
                    >
                        Photo
                    </button>
                    <button
                        type="button"
                        className="crud-btn is-primary"
                        onClick={() =>
                            setEditingOrder({
                                heading: order.heading ?? '',
                                noteLabel: order.noteLabel ?? '',
                                noteText: order.noteText ?? '',
                            })
                        }
                    >
                        Edit the wording
                    </button>
                </div>
            </div>

            {orderError && <p className="crud-message is-error">{orderError}</p>}

            <div className="menu-hero-cms-howto-preview">
                <div className="menu-hero-cms-howto-photo">
                    <img src={resolveMenuOrderImage(order.imageUrl)} alt="" />
                </div>
                <div className="menu-hero-cms-howto-copy">
                    <h4>{order.heading}</h4>
                    {(order.noteLabel || order.noteText) && (
                        <p className="menu-hero-cms-howto-note">
                            {order.noteLabel && <b>{order.noteLabel} </b>}
                            {order.noteText}
                        </p>
                    )}
                </div>
            </div>

            <div className="crud-bar menu-hero-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Steps</h3>
                    <p className="crud-bar-note">The numbered list inside the How to Order panel.</p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary is-small"
                    onClick={() =>
                        setEditingStep({
                            ...BLANK_STEP,
                            sortOrder: (orderedSteps.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add a step
                </button>
            </div>

            {moveError && <p className="crud-message is-error">{moveError}</p>}

            {orderedSteps.length === 0 ? (
                <p className="crud-empty">
                    {orderLoaded
                        ? 'No steps. Add the first one above, or leave it — the numbered list '
                          + 'disappears when it is empty.'
                        : 'Loading the steps…'}
                </p>
            ) : (
                <div className="menu-hero-cms-steps">
                    {orderedSteps.map((step, index) => (
                        <article
                            key={step.id}
                            className={`menu-hero-cms-step ${step.isActive ? '' : 'crud-is-hidden'}`}
                        >
                            <span className="menu-hero-cms-step-index">{index + 1}</span>
                            <p className="menu-hero-cms-step-text">
                                {step.step}
                                {!step.isActive && <span className="crud-hidden-tag">Hidden</span>}
                            </p>
                            <div className="crud-row-actions">
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    aria-label="Move earlier"
                                    disabled={index === 0}
                                    onClick={() => handleMoveStep(step.id, 'up')}
                                >
                                    ‹
                                </button>
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    aria-label="Move later"
                                    disabled={index === orderedSteps.length - 1}
                                    onClick={() => handleMoveStep(step.id, 'down')}
                                >
                                    ›
                                </button>
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    onClick={() => setEditingStep(stepToDraft(step))}
                                >
                                    Edit
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {/* ---------------------------------------------------------- Section titles */}

            <div className="crud-bar menu-hero-cms-subbar">
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

            {editingContent && (
                <CrudModal
                    title="Menu banner wording"
                    subtitle="The first thing a visitor reads on the food menu page. This is live the moment it saves."
                    fields={contentFields}
                    initial={editingContent}
                    submitLabel="Save wording"
                    onSubmit={saveMenuHero}
                    onClose={() => setEditingContent(null)}
                />
            )}

            {editingMedia && (
                <CrudModal
                    title="Menu banner photos"
                    subtitle="Uploads go straight into the resort's own storage, so they survive a redeploy. Removing one puts the photo the site shipped with back."
                    fields={mediaFields}
                    initial={editingMedia}
                    submitLabel="Save photos"
                    onSubmit={saveMenuHeroMedia}
                    onClose={() => setEditingMedia(null)}
                />
            )}

            {editingOrder && (
                <CrudModal
                    title="How to Order wording"
                    subtitle="The heading and note on the How to Order panel. The steps below are edited separately."
                    fields={orderFields}
                    initial={editingOrder}
                    submitLabel="Save wording"
                    onSubmit={saveMenuOrder}
                    onClose={() => setEditingOrder(null)}
                />
            )}

            {editingOrderMedia && (
                <CrudModal
                    title="How to Order photo"
                    subtitle="Uploads go straight into the resort's own storage, so they survive a redeploy. Removing one puts the photo the site shipped with back."
                    fields={orderMediaFields}
                    initial={editingOrderMedia}
                    submitLabel="Save photo"
                    onSubmit={saveMenuOrderMedia}
                    onClose={() => setEditingOrderMedia(null)}
                />
            )}

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

            {editingStep && (
                <CrudModal
                    title={editingStep.id ? 'Edit step' : 'New step'}
                    subtitle={
                        editingStep.id
                            ? 'Unticking the box takes it off the page and keeps its wording.'
                            : 'It joins the end of the list. Reorder it with the arrows after saving.'
                    }
                    fields={stepFields}
                    initial={editingStep}
                    submitLabel={editingStep.id ? 'Save changes' : 'Add step'}
                    onSubmit={saveMenuOrderStep}
                    onDelete={editingStep.id ? () => deleteMenuOrderStep(editingStep.id) : null}
                    deleteLabel="Delete step"
                    onClose={() => setEditingStep(null)}
                />
            )}
        </div>
    )
}
