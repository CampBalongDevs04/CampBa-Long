import { useEffect, useState } from 'react'
import '../css/spaCms.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useSpaGallery,
    loadSpaGallery,
    saveSpaGallery,
    saveSpaGalleryPhotos,
    resolveSpaGalleryPhotos,
} from '../../data/spaGallery.js'

// CMS → Spa Service → Gallery. The "Relax. Refresh. Rejuvenate." heading on
// /spa, the paragraph under it, and the strip of decorative photos below that
// (data/spaGallery.js).
//
// THESE ARE NOT THE TREATMENT CARDS. The cards further down /spa are catalog
// data — name, price, duration, photo — edited in the dashboard's Spa SECTION
// in the sidebar. The panel says so on screen, because "spa photos" is exactly
// the phrase that would send somebody to the wrong one of the two.
//
// The photos are one control rather than a row each: a gallery photo carries
// no wording, no price and no "hide this one" — only a position, and the
// position is the order they sit in. GalleryField already does that job for
// the accommodation carousels.

function contentFields() {
    return [
        {
            name: 'heading',
            label: 'Heading',
            placeholder: 'Relax. Refresh. Rejuvenate.',
        },
        {
            name: 'subtitle',
            label: 'Description',
            type: 'textarea',
            rows: 3,
            placeholder: 'Indulge in luxurious spa treatments designed to restore your body, calm your mind, and renew your spirit.',
            help: 'The paragraph under the heading.',
        },
    ]
}

function photoFields() {
    return [
        {
            name: 'photos',
            label: 'Gallery photos',
            type: 'gallery',
            folder: 'spa',
            max: 12,
            help: 'The decorative strip under the heading — not the treatment cards, which are '
                + 'edited in the Spa section. Uploading replaces the whole strip; removing them '
                + 'all puts the six the site shipped with back.',
        },
    ]
}

export default function SpaGallerySection() {
    const { gallery, loaded, error } = useSpaGallery()

    const [editingContent, setEditingContent] = useState(null)
    const [editingPhotos, setEditingPhotos] = useState(null)

    useEffect(() => {
        loadSpaGallery()
    }, [])

    const shownPhotos = resolveSpaGalleryPhotos(gallery.photos)
    const usingShipped = gallery.photos.length === 0

    return (
        <div className="spa-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Gallery</h3>
                    <p className="crud-bar-note">
                        The heading and the decorative photo strip halfway down /spa. The
                        treatment cards below it are edited in the Spa section, not here.
                    </p>
                </div>
                <div className="crud-row-actions">
                    <button
                        type="button"
                        className="crud-btn"
                        onClick={() => setEditingPhotos({ photos: [...gallery.photos] })}
                    >
                        Photos
                    </button>
                    <button
                        type="button"
                        className="crud-btn is-primary"
                        onClick={() =>
                            setEditingContent({
                                heading: gallery.heading ?? '',
                                subtitle: gallery.subtitle ?? '',
                            })
                        }
                    >
                        Edit the wording
                    </button>
                </div>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}

            <div className="spa-cms-gallery-preview">
                <h4 className="spa-cms-gallery-title">{gallery.heading}</h4>
                {gallery.subtitle && <p className="spa-cms-gallery-sub">{gallery.subtitle}</p>}
                <div className="spa-cms-gallery-strip">
                    {shownPhotos.map((photo, index) => (
                        <img src={photo} alt="" key={`${photo}-${index}`} />
                    ))}
                </div>
                <p className="crud-bar-note">
                    {usingShipped
                        ? `The ${shownPhotos.length} photos the site shipped with. Uploading replaces all of them.`
                        : `${shownPhotos.length} uploaded ${shownPhotos.length === 1 ? 'photo' : 'photos'}. `
                          + 'Removing them all puts the shipped set back.'}
                </p>
            </div>

            {!loaded && <p className="crud-empty">Loading the gallery…</p>}

            {editingContent && (
                <CrudModal
                    title="Gallery wording"
                    subtitle="The heading and paragraph over the photo strip. This is live the moment it saves."
                    fields={contentFields}
                    initial={editingContent}
                    submitLabel="Save wording"
                    onSubmit={saveSpaGallery}
                    onClose={() => setEditingContent(null)}
                />
            )}

            {editingPhotos && (
                <CrudModal
                    title="Gallery photos"
                    subtitle="Pick several at once, then drag the order with the arrows. Uploads go straight into the resort's own storage, so they survive a redeploy."
                    fields={photoFields}
                    initial={editingPhotos}
                    submitLabel="Save photos"
                    onSubmit={saveSpaGalleryPhotos}
                    onClose={() => setEditingPhotos(null)}
                />
            )}
        </div>
    )
}
