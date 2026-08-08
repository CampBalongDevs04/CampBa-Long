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
    importBundledSpaGallery,
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
                + 'edited in the Spa section. Reorder with the arrows; the order here is the '
                + 'order on the page. Removing them all puts the six the site shipped with back.',
        },
    ]
}

export default function SpaGallerySection() {
    const { gallery, loaded, error } = useSpaGallery()

    const [editingContent, setEditingContent] = useState(null)
    const [editingPhotos, setEditingPhotos] = useState(null)
    // The import writes straight to storage and the row with no form in
    // between, so its progress and its refusals have nowhere else to be shown.
    const [importing, setImporting] = useState(null)
    const [importError, setImportError] = useState('')

    useEffect(() => {
        loadSpaGallery()
    }, [])

    const shownPhotos = resolveSpaGalleryPhotos(gallery.photos)
    const usingShipped = gallery.photos.length === 0

    const handleImport = async () => {
        if (importing) return
        setImportError('')
        setImporting({ done: 0, total: shownPhotos.length })
        const result = await importBundledSpaGallery(setImporting)
        setImporting(null)
        if (!result.ok) setImportError(result.message)
    }

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

                {/* The six the site shipped with are files inside the build, not
                    entries — so there is nothing for Photos to list, reorder or
                    remove, and swapping one of them would mean re-uploading all
                    six by hand. Importing does that once, here, and afterwards
                    they behave like any other uploaded photo. */}
                {usingShipped ? (
                    <div className="spa-cms-import">
                        <p className="crud-bar-note">
                            These {shownPhotos.length} came with the site, so they are not stored
                            in the database yet — which is why Photos only offers an upload.
                            Import them and each one becomes editable on its own: reorder it,
                            remove it, or replace just the third and leave the rest.
                        </p>
                        <button
                            type="button"
                            className="crud-btn is-primary is-small"
                            disabled={Boolean(importing)}
                            onClick={handleImport}
                        >
                            {importing
                                ? `Importing ${Math.min(importing.done + 1, importing.total)} of ${importing.total}…`
                                : `Import these ${shownPhotos.length} photos`}
                        </button>
                    </div>
                ) : (
                    <p className="crud-bar-note">
                        {shownPhotos.length} {shownPhotos.length === 1 ? 'photo' : 'photos'}, stored
                        in the database. Edit them under Photos. Removing them all puts the
                        set the site shipped with back.
                    </p>
                )}

                {importError && <p className="crud-message is-error">{importError}</p>}
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
