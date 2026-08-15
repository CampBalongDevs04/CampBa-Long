import { useEffect, useState } from 'react'
import '../css/heroBanner.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    HERO_ICON_OPTIONS,
    useHomeHero,
    loadHomeHero,
    saveHomeHero,
    saveHomeHeroMedia,
    saveHeroFeature,
    deleteHeroFeature,
    moveHeroFeature,
    resolveHeroImage,
    resolveHeroBackground,
    resolveHeroVideo,
    resolveHeroIcon,
} from '../../data/homeHero.js'

// CMS → Hero Banner. The top of the front page: the headline, the paragraph
// under it, the two buttons, the circular photo, the background and the strip
// of feature tiles along the bottom.
//
// All of it used to be written into src/pages/home.jsx, so rewording the first
// sentence a visitor reads was a code change and a redeploy. It is now one row
// and a small table — see data/homeHero.js — and everything saved here reaches
// the home page immediately, including for the visitors already on it.
//
// THREE FORMS, NOT ONE
// --------------------
// Words, media and tiles are edited separately because they are separate jobs
// with separate risks. Fixing a typo in the headline should not put a staff
// member one stray click away from clearing the background video, and the
// media form's uploads take long enough that holding the copy hostage to them
// would be its own annoyance.

function contentFields() {
    return [
        {
            name: 'titleLines',
            label: 'Headline',
            type: 'textarea',
            rows: 3,
            placeholder: 'Book Your\nPerfect Resort',
            help: 'One line per line, exactly as it should break on screen. The gold last '
                + 'line is the field below.',
        },
        {
            name: 'accentLine',
            label: 'Last line (gold)',
            placeholder: 'Getaway',
            help: 'The closing word of the headline, printed in gold.',
        },
        {
            name: 'subtitle',
            label: 'Description',
            type: 'textarea',
            rows: 4,
            placeholder: 'Escape the everyday with comfortable accommodations…',
            help: 'The paragraph under the headline.',
        },
        [
            {
                name: 'primaryLabel',
                label: 'Main button',
                placeholder: 'Book Now',
                help: 'Leave blank to take the button off the page.',
            },
            {
                name: 'primaryHref',
                label: 'Main button goes to',
                placeholder: '/booking',
                help: '/booking opens the booking page. #accommodations scrolls down to the rooms.',
            },
        ],
        [
            {
                name: 'secondaryLabel',
                label: 'Second button',
                placeholder: 'Explore Rooms',
                help: 'Leave blank to take the button off the page.',
            },
            {
                name: 'secondaryHref',
                label: 'Second button goes to',
                placeholder: '#accommodations',
                help: 'A full https:// address opens in a new tab.',
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
            folder: 'hero',
            preview: resolveHeroImage(values.imageUrl),
            help: 'The round photo beside the headline. A square image crops best. '
                + 'JPG, PNG or WebP, up to 5 MB.',
        },
        {
            name: 'backgroundUrl',
            label: 'Background image',
            type: 'image',
            folder: 'hero',
            preview: resolveHeroBackground(values.backgroundUrl),
            help: 'Behind everything. It is what a visitor sees while the video loads, '
                + 'and all they see if the video is switched off. Use a wide photo.',
        },
        {
            name: 'videoUrl',
            label: 'Background video',
            type: 'video',
            folder: 'hero',
            preview: resolveHeroVideo(values.videoUrl),
            help: 'Plays silently on a loop over the background image. Keep it short and '
                + 're-export it at 720p — every visitor downloads this. MP4 or WebM, up to 60 MB.',
        },
        {
            name: 'showVideo',
            label: 'Play the video on the home page',
            type: 'checkbox',
        },
    ]
}

function featureFields(values) {
    return [
        {
            name: 'title',
            label: 'Heading',
            placeholder: 'Comfortable Stays',
        },
        {
            name: 'description',
            label: 'Description',
            type: 'textarea',
            rows: 2,
            placeholder: 'Well-appointed rooms for a relaxing stay',
            help: 'One short line — the tiles sit side by side and a long one pushes the '
                + 'strip out of shape.',
        },
        {
            name: 'iconKey',
            label: 'Icon',
            type: 'select',
            options: [{ value: '', label: 'No icon' }, ...HERO_ICON_OPTIONS],
            help: values.iconUrl
                ? 'Ignored while an uploaded icon is set below. Remove that to use one of these.'
                : 'One of the icons the site ships with.',
        },
        {
            name: 'iconUrl',
            label: 'Or upload an icon',
            type: 'image',
            folder: 'hero',
            preview: resolveHeroIcon(values.iconKey, values.iconUrl),
            help: 'Overrides the choice above. A small square PNG or SVG on a transparent '
                + 'background sits best in the circle.',
        },
        { name: 'isActive', label: 'Show this on the home page', type: 'checkbox' },
    ]
}

const BLANK_FEATURE = {
    id: null,
    title: '',
    description: '',
    iconKey: '',
    iconUrl: '',
    sortOrder: 0,
    isActive: true,
}

function featureToDraft(feature) {
    return {
        id: feature.id,
        title: feature.title,
        description: feature.description ?? '',
        iconKey: feature.iconKey ?? '',
        iconUrl: feature.iconUrl ?? '',
        sortOrder: feature.sortOrder ?? 0,
        isActive: feature.isActive,
    }
}

export default function HeroBanner() {
    const { hero, features, loaded, error } = useHomeHero()
    const [editingContent, setEditingContent] = useState(null)
    const [editingMedia, setEditingMedia] = useState(null)
    const [editingFeature, setEditingFeature] = useState(null)
    // Reordering writes straight to the database with no form in between, so
    // its refusals have nowhere else to be shown.
    const [moveError, setMoveError] = useState('')

    useEffect(() => {
        loadHomeHero()
    }, [])

    const ordered = [...features].sort((a, b) => a.sortOrder - b.sortOrder)

    const handleMove = async (id, direction) => {
        setMoveError('')
        const result = await moveHeroFeature(id, direction)
        if (!result.ok) setMoveError(result.message)
    }

    return (
        <div className="hero-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Hero Banner</h3>
                    <p className="crud-bar-note">
                        The top of the home page. Saved changes are live straight away — there
                        is no draft and no publish step.
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
                                videoUrl: hero.videoUrl ?? '',
                                showVideo: hero.showVideo,
                            })
                        }
                    >
                        Photos &amp; video
                    </button>
                    <button
                        type="button"
                        className="crud-btn is-primary"
                        onClick={() =>
                            setEditingContent({
                                titleLines: hero.titleLines.join('\n'),
                                accentLine: hero.accentLine ?? '',
                                subtitle: hero.subtitle ?? '',
                                primaryLabel: hero.primaryLabel ?? '',
                                primaryHref: hero.primaryHref ?? '',
                                secondaryLabel: hero.secondaryLabel ?? '',
                                secondaryHref: hero.secondaryHref ?? '',
                            })
                        }
                    >
                        Edit the wording
                    </button>
                </div>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}

            {/* What the front page is showing right now, laid out the way it is
                laid out there. Staff should not have to open the site in
                another tab to check what they just changed. */}
            <div className="hero-cms-preview">
                <div
                    className="hero-cms-stage"
                    style={{ backgroundImage: `url(${resolveHeroBackground(hero.backgroundUrl)})` }}
                >
                    <div className="hero-cms-stage-copy">
                        <h4 className="hero-cms-title">
                            {hero.titleLines.map((line, index) => (
                                <span key={`${line}-${index}`}>{line}<br /></span>
                            ))}
                            {hero.accentLine && (
                                <span className="hero-cms-accent">{hero.accentLine}</span>
                            )}
                        </h4>
                        {hero.subtitle && <p className="hero-cms-subtitle">{hero.subtitle}</p>}
                        <div className="hero-cms-buttons">
                            {hero.primaryLabel && (
                                <span className="hero-cms-button">
                                    {hero.primaryLabel}
                                    <em>{hero.primaryHref || 'no link'}</em>
                                </span>
                            )}
                            {hero.secondaryLabel && (
                                <span className="hero-cms-button is-outline">
                                    {hero.secondaryLabel}
                                    <em>{hero.secondaryHref || 'no link'}</em>
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="hero-cms-circle">
                        <img src={resolveHeroImage(hero.imageUrl)} alt="" />
                    </div>
                </div>

                <p className="hero-cms-media-note">
                    {hero.showVideo
                        ? hero.videoUrl
                            ? 'Background video: your uploaded clip is playing over the image above.'
                            : 'Background video: the clip the site shipped with is playing over the image above.'
                        : 'Background video is switched off — visitors see the image above on its own.'}
                </p>
            </div>

            <div className="crud-bar hero-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Feature strip</h3>
                    <p className="crud-bar-note">
                        The tiles across the bottom of the banner. Four fit the row neatly;
                        more than that will wrap.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary is-small"
                    onClick={() =>
                        // Added at the end of the strip rather than the front.
                        setEditingFeature({
                            ...BLANK_FEATURE,
                            sortOrder: (ordered.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add a feature
                </button>
            </div>

            {moveError && <p className="crud-message is-error">{moveError}</p>}

            {ordered.length === 0 ? (
                <p className="crud-empty">
                    {loaded
                        ? 'No features on the banner. Add one above, or leave it — the strip '
                          + 'disappears when it is empty.'
                        : 'Loading the hero banner…'}
                </p>
            ) : (
                <div className="hero-cms-features">
                    {ordered.map((feature, index) => {
                        const icon = resolveHeroIcon(feature.iconKey, feature.iconUrl)
                        return (
                            <article
                                key={feature.id}
                                className={`hero-cms-feature ${feature.isActive ? '' : 'crud-is-hidden'}`}
                            >
                                <div className="hero-cms-feature-icon">
                                    {icon ? <img src={icon} alt="" /> : <span>—</span>}
                                </div>
                                <div className="hero-cms-feature-copy">
                                    <h4>
                                        {feature.title}
                                        {!feature.isActive && (
                                            <span className="crud-hidden-tag">Hidden</span>
                                        )}
                                    </h4>
                                    <p>{feature.description || 'No description'}</p>
                                </div>
                                <div className="crud-row-actions">
                                    <button
                                        type="button"
                                        className="crud-btn is-small"
                                        aria-label={`Move ${feature.title} earlier`}
                                        disabled={index === 0}
                                        onClick={() => handleMove(feature.id, 'up')}
                                    >
                                        ‹
                                    </button>
                                    <button
                                        type="button"
                                        className="crud-btn is-small"
                                        aria-label={`Move ${feature.title} later`}
                                        disabled={index === ordered.length - 1}
                                        onClick={() => handleMove(feature.id, 'down')}
                                    >
                                        ›
                                    </button>
                                    <button
                                        type="button"
                                        className="crud-btn is-small"
                                        onClick={() => setEditingFeature(featureToDraft(feature))}
                                    >
                                        Edit
                                    </button>
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}

            {editingContent && (
                <CrudModal
                    title="Hero wording"
                    subtitle="The first thing a visitor reads. This is live on the home page the moment it saves."
                    fields={contentFields}
                    initial={editingContent}
                    submitLabel="Save wording"
                    onSubmit={saveHomeHero}
                    onClose={() => setEditingContent(null)}
                />
            )}

            {editingMedia && (
                <CrudModal
                    title="Hero photos & video"
                    subtitle="Uploads go straight into the resort's own storage, so they survive a redeploy. Removing one puts the photo the site shipped with back."
                    fields={mediaFields}
                    initial={editingMedia}
                    submitLabel="Save media"
                    onSubmit={saveHomeHeroMedia}
                    onClose={() => setEditingMedia(null)}
                />
            )}

            {editingFeature && (
                <CrudModal
                    title={editingFeature.id ? 'Edit feature' : 'New feature'}
                    subtitle={
                        editingFeature.id
                            ? 'Unticking the box takes the tile off the home page and keeps its wording.'
                            : 'It joins the end of the strip. Reorder it with the arrows after saving.'
                    }
                    fields={featureFields}
                    initial={editingFeature}
                    submitLabel={editingFeature.id ? 'Save changes' : 'Add feature'}
                    onSubmit={saveHeroFeature}
                    onDelete={editingFeature.id ? () => deleteHeroFeature(editingFeature.id) : null}
                    deleteLabel="Delete feature"
                    onClose={() => setEditingFeature(null)}
                />
            )}
        </div>
    )
}
