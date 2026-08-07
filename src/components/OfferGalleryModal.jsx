import { useEffect } from 'react';
import CmsIcon from './CmsIcon.jsx';

// The window a card's "Discover More" opens: the card's own heading and line,
// then its photos.
//
// The photos used to be three hardcoded lists in this file, matched to a card
// by its TITLE — so renaming "Foods" silently emptied its window. They are now
// rows in offer_gallery_items, already nested onto the card by
// data/offersSection.js, so the offer that was clicked carries its own gallery
// and nothing here has to look anything up.
//
// A slot with no photo yet keeps the "Photo coming soon" placeholder it has
// always shown — every one of them was in that state before staff had any way
// to upload one.
export default function OfferGalleryModal({ offer, onClose }) {
    useEffect(() => {
        const handleKey = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKey);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    const gallery = offer.gallery ?? [];

    return (
        <div className="gallery-overlay" onClick={onClose}>
            <div
                className="gallery-card"
                role="dialog"
                aria-modal="true"
                aria-label={`${offer.title} gallery`}
                onClick={(event) => event.stopPropagation()}
            >
                <button className="gallery-close" onClick={onClose} aria-label="Close gallery">
                    &times;
                </button>
                <header className="gallery-header">
                    <span className="gallery-icon">
                        <CmsIcon iconKey={offer.iconKey} iconUrl={offer.iconUrl} />
                    </span>
                    <h3>{offer.title}</h3>
                    <p>{offer.description}</p>
                </header>
                <div className="gallery-grid">
                    {gallery.map(({ id, imageUrl, imageAlt, title, description }) => (
                        <figure className="gallery-item" key={id}>
                            {imageUrl ? (
                                <img src={imageUrl} alt={imageAlt} />
                            ) : (
                                <div className="gallery-placeholder">
                                    <span>Photo coming soon</span>
                                </div>
                            )}
                            {/* The line under the title lives inside the
                                figcaption: a <figure> may only have its caption
                                as the first or last child, so a paragraph after
                                it would be invalid. */}
                            <figcaption>
                                {title}
                                {description && (
                                    <span className="gallery-item-note">{description}</span>
                                )}
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </div>
        </div>
    );
}
