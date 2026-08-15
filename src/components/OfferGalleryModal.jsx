import { useCallback, useEffect, useRef, useState } from 'react';
import CmsIcon from './CmsIcon.jsx';
import LotusDividerIcon from './LotusDividerIcon.jsx';

// The window a card's "Discover More" opens: the card's own heading and line,
// then its photos — one at a time, on a stage big enough to actually look at.
//
// It was a grid of small tiles, which read as a contact sheet rather than as a
// look around the resort. One photo at a time, with arrows, keys, swipe and a
// thumbnail strip, is the same content shown at a size worth having.
//
// The photos are rows in offer_gallery_items, already nested onto the card by
// data/offersSection.js, so the offer that was clicked carries its own gallery
// and nothing here has to look anything up. A slot with no photo yet keeps the
// "Photo coming soon" placeholder it has always shown.
export default function OfferGalleryModal({ offer, onClose }) {
    const gallery = offer.gallery ?? [];
    const count = gallery.length;

    const [index, setIndex] = useState(0);
    // Which way the last move went, so the incoming photo slides in from the
    // side it was reached from rather than always from the right.
    const [direction, setDirection] = useState(1);
    const touchStartX = useRef(null);

    const go = useCallback((step) => {
        if (count < 2) return;
        setDirection(step);
        setIndex((current) => (current + step + count) % count);
    }, [count]);

    const jumpTo = (next) => {
        setDirection(next < index ? -1 : 1);
        setIndex(next);
    };

    useEffect(() => {
        const handleKey = (event) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowRight') go(1);
            if (event.key === 'ArrowLeft') go(-1);
        };
        document.addEventListener('keydown', handleKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKey);
            document.body.style.overflow = '';
        };
    }, [onClose, go]);

    // A flick across the stage moves one photo. The threshold keeps a tap or a
    // slightly wobbly scroll from counting as one.
    const handleTouchEnd = (event) => {
        if (touchStartX.current == null) return;
        const travelled = event.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(travelled) > 45) go(travelled < 0 ? 1 : -1);
    };

    const active = gallery[index];

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
                    <p className="gallery-eyebrow">
                        Gallery
                        {count > 0 && (
                            <>
                                <span aria-hidden="true">•</span>
                                {count} photo{count === 1 ? '' : 's'}
                            </>
                        )}
                    </p>
                    <h3>{offer.title}</h3>
                    <LotusDividerIcon />
                    {offer.description && <p className="gallery-lede">{offer.description}</p>}
                </header>

                {count === 0 ? (
                    <p className="gallery-empty">Photos of this are on their way.</p>
                ) : (
                    <div className="gallery-carousel">
                        <div
                            className="gallery-stage"
                            data-direction={direction > 0 ? 'next' : 'prev'}
                            onTouchStart={(event) => {
                                touchStartX.current = event.touches[0].clientX;
                            }}
                            onTouchEnd={handleTouchEnd}
                        >
                            <span className="gallery-corner is-tl" aria-hidden="true" />
                            <span className="gallery-corner is-tr" aria-hidden="true" />
                            <span className="gallery-corner is-bl" aria-hidden="true" />
                            <span className="gallery-corner is-br" aria-hidden="true" />

                            <figure className="gallery-slide" key={active.id}>
                                {active.imageUrl ? (
                                    <img src={active.imageUrl} alt={active.imageAlt} />
                                ) : (
                                    <div className="gallery-placeholder">
                                        <span>Photo coming soon</span>
                                    </div>
                                )}
                            </figure>

                            <span className="gallery-count">
                                {String(index + 1).padStart(2, '0')}
                                <i aria-hidden="true">/</i>
                                {String(count).padStart(2, '0')}
                            </span>

                            {count > 1 && (
                                <>
                                    <button
                                        type="button"
                                        className="gallery-nav is-prev"
                                        onClick={() => go(-1)}
                                        aria-label="Previous photo"
                                    >
                                        &#8249;
                                    </button>
                                    <button
                                        type="button"
                                        className="gallery-nav is-next"
                                        onClick={() => go(1)}
                                        aria-label="Next photo"
                                    >
                                        &#8250;
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="gallery-caption" key={`caption-${active.id}`} aria-live="polite">
                            <h4>{active.title}</h4>
                            {active.description && <p>{active.description}</p>}
                        </div>

                        {count > 1 && (
                            <div className="gallery-thumbs" role="group" aria-label="Choose a photo">
                                {gallery.map((item, position) => (
                                    <button
                                        type="button"
                                        key={item.id}
                                        className={`gallery-thumb${position === index ? ' is-active' : ''}`}
                                        aria-current={position === index}
                                        aria-label={item.title}
                                        onClick={() => jumpTo(position)}
                                    >
                                        <span className="gallery-thumb-frame">
                                            {item.imageUrl ? (
                                                <img src={item.imageUrl} alt="" loading="lazy" />
                                            ) : (
                                                <span className="gallery-thumb-empty" aria-hidden="true">
                                                    {String(position + 1).padStart(2, '0')}
                                                </span>
                                            )}
                                        </span>
                                        <span className="gallery-thumb-label">{item.title}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
