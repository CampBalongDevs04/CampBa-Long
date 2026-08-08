import { useEffect, useState } from 'react'
import '../css/spaCms.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import { useSpaHero, loadSpaHero, saveSpaHero, saveSpaHeroMedia } from '../../data/spaHero.js'

// CMS → Spa Service → Banner. The top of /spa: the headline, the line under
// it, the button and the blurred backdrop (data/spaHero.js).
//
// It used to be written into src/pages/spaService.jsx, so rewording it was a
// code change and a redeploy.
//
// Words and photo are edited separately, the same reasoning as every other
// banner in this CMS: fixing a typo in a headline should not put a staff
// member one stray click away from clearing a photo.
//
// THE BACKDROP PREVIEW
// --------------------
// Unlike the menu banner, the photo the site ships with is painted by
// spaService.css rather than imported into JS, so the dashboard cannot show it
// — there is no URL to point an <img> at. Until staff upload one the stage
// below is a flat tint and says so. Once they do, it shows the real thing,
// which is the case where being able to see it actually matters.

function contentFields() {
    return [
        {
            name: 'titleLines',
            label: 'Headline',
            type: 'textarea',
            rows: 3,
            placeholder: 'Reserve Your Moment of\nRelaxation.',
            help: 'One line per line, exactly as it should break on screen.',
        },
        {
            name: 'subtitle',
            label: 'Description',
            type: 'textarea',
            rows: 3,
            placeholder: 'Book your next spa session and indulge in a world of tranquility and rejuvenation.',
            help: 'The paragraph under the headline.',
        },
        [
            {
                name: 'buttonLabel',
                label: 'Button',
                placeholder: 'Book Now',
                help: 'Leave blank to take the button off the page.',
            },
            {
                name: 'buttonHref',
                label: 'Button goes to',
                placeholder: '#how-to-reserve',
                help: '#how-to-reserve scrolls down to "How to book Spa Service" on this page. '
                    + '/booking opens the booking page. A full https:// address opens in a new tab.',
            },
        ],
    ]
}

function mediaFields() {
    return [
        {
            name: 'backgroundUrl',
            label: 'Background image',
            type: 'image',
            folder: 'spa',
            help: 'The blurred backdrop behind the whole banner. Use a wide photo. '
                + 'Removing it puts the photo the site shipped with back. '
                + 'JPG, PNG or WebP, up to 5 MB.',
        },
    ]
}

export default function SpaHeroBanner() {
    const { hero, loaded, error } = useSpaHero()

    const [editingContent, setEditingContent] = useState(null)
    const [editingMedia, setEditingMedia] = useState(null)

    useEffect(() => {
        loadSpaHero()
    }, [])

    return (
        <div className="spa-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Spa Banner</h3>
                    <p className="crud-bar-note">
                        The top of the spa page. Saved changes are live straight away —
                        there is no draft and no publish step.
                    </p>
                </div>
                <div className="crud-row-actions">
                    <button
                        type="button"
                        className="crud-btn"
                        onClick={() => setEditingMedia({ backgroundUrl: hero.backgroundUrl ?? '' })}
                    >
                        Photo
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

            {/* What /spa is showing right now, laid out the way it is laid out
                there. Staff should not have to open the site in another tab to
                check what they just changed. */}
            <div
                className={`spa-cms-stage${hero.backgroundUrl ? '' : ' is-shipped-bg'}`}
                style={hero.backgroundUrl ? { backgroundImage: `url(${hero.backgroundUrl})` } : undefined}
            >
                <div className="spa-cms-stage-copy">
                    <h4 className="spa-cms-title">
                        {hero.titleLines.map((line, index) => (
                            <span key={`${line}-${index}`}>{line}<br /></span>
                        ))}
                    </h4>
                    {hero.subtitle && <p className="spa-cms-subtitle">{hero.subtitle}</p>}
                    {hero.buttonLabel && (
                        // The button and where it goes, in one chip: a label
                        // with no working link is a failure staff cannot see on
                        // the site itself.
                        <span className="spa-cms-button">
                            {hero.buttonLabel}
                            <em>{hero.buttonHref || 'no link'}</em>
                        </span>
                    )}
                </div>
            </div>

            {!hero.backgroundUrl && (
                <p className="crud-bar-note spa-cms-bg-note">
                    The backdrop is the photo the site shipped with. Upload one to see it here.
                </p>
            )}

            {!loaded && <p className="crud-empty">Loading the spa banner…</p>}

            {editingContent && (
                <CrudModal
                    title="Spa banner wording"
                    subtitle="The first thing a visitor reads on the spa page. This is live the moment it saves."
                    fields={contentFields}
                    initial={editingContent}
                    submitLabel="Save wording"
                    onSubmit={saveSpaHero}
                    onClose={() => setEditingContent(null)}
                />
            )}

            {editingMedia && (
                <CrudModal
                    title="Spa banner photo"
                    subtitle="Uploads go straight into the resort's own storage, so they survive a redeploy. Removing one puts the photo the site shipped with back."
                    fields={mediaFields}
                    initial={editingMedia}
                    submitLabel="Save photo"
                    onSubmit={saveSpaHeroMedia}
                    onClose={() => setEditingMedia(null)}
                />
            )}
        </div>
    )
}
