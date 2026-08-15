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

// CMS → Food Menu → Banner. The top of /menu: the headline, the paragraph
// under it, the button, the round photo and the blurred backdrop
// (data/menuHero.js).
//
// It used to be written into src/pages/foodmenu.jsx, so rewording it was a
// code change and a redeploy. It is now one row, and everything saved here
// reaches the menu page immediately, including for visitors already on it.
//
// The rest of /menu is edited in the tabs beside this one: How to Order
// (menuOrderSection.jsx) and Section Titles (menuSectionTitles.jsx). All three
// were one long panel until CMS grew a page picker and each block could have a
// tab of its own — they are three separate blocks of the page backed by three
// separate tables, so nothing about them wanted to be one screen.
//
// The food items themselves are catalog data, not copy, so they stay in the
// dashboard's Food Menu SECTION in the sidebar, not here — same split as
// Accommodations, whose cards are catalog data edited in Units even though its
// heading is edited in CMS.
//
// WORDS AND PHOTOS ARE EDITED SEPARATELY
// --------------------------------------
// The same reasoning as Hero Banner: fixing a typo in a heading should not put
// a staff member one stray click away from clearing a photo.

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

export default function MenuBanner() {
    const { hero, loaded, error } = useMenuHero()

    const [editingContent, setEditingContent] = useState(null)
    const [editingMedia, setEditingMedia] = useState(null)

    useEffect(() => {
        loadMenuHero()
    }, [])

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
        </div>
    )
}
