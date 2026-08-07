import { useState } from 'react';
import './css/offers.css';
import OfferCard from './OfferCard';
import OfferGalleryModal from './OfferGalleryModal';
import TagItem from './TagItem';
import LeafDeco from './LeafDeco';
import LotusDividerIcon from './LotusDividerIcon';
import CmsIcon from './CmsIcon.jsx';
import {
    COLLAGE_PHOTO_COUNT,
    useWelcomeSection,
    resolveHighlightImage,
} from '../data/welcomeSection.js';
import { useOffersSection, resolveOfferImage } from '../data/offersSection.js';

// Both blocks in this file — the welcome section and "What We Offer" — now
// read their copy, photos and icons from Postgres, written in the dashboard's
// CMS. Until those rows land (and on a database that predates the tables) each
// store answers with the copy the site shipped with, so neither block is ever
// blank or half-built. See data/welcomeSection.js and data/offersSection.js.

export default function Offers() {
    const [selectedOffer, setSelectedOffer] = useState(null);
    const { welcome, activeHighlights, activeTags } = useWelcomeSection();
    const { section, activeCards, activeTags: offerTags } = useOffersSection();

    return(
        <>
            <section className="offer-section">

                <div className="Welcome-header">
                    {welcome.title && <h1 className="Welcome-title">{welcome.title}</h1>}
                    {welcome.tagline && <p className="Welcome-description">{welcome.tagline}</p>}
                    <LotusDividerIcon />
                    {welcome.message && <h1 className="Welcome-message">{welcome.message}</h1>}
                    {welcome.description && <p className="Welcome-description">{welcome.description}</p>}
                </div>

                <div className="story-showcase">
                    <div className="story-collage">
                        {/* The collage is a triptych with three fixed
                            positions, so it takes the first three highlights.
                            A fourth is still listed beside it — see
                            COLLAGE_PHOTO_COUNT in data/welcomeSection.js. */}
                        {activeHighlights.slice(0, COLLAGE_PHOTO_COUNT).map(({ id, imageUrl, imageAlt }, index) => {
                            const photo = resolveHighlightImage(id, imageUrl)
                            return photo ? (
                                <div className={`collage-photo photo-${index + 1}`} key={id}>
                                    <img src={photo} alt={imageAlt} />
                                </div>
                            ) : null
                        })}
                    </div>
                    <ul className="story-list">
                        {activeHighlights.map(({ id, iconKey, iconUrl, title, description }, index) => (
                            <li className="story-list-item" key={id}>
                                <span className="story-list-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                                <span className="story-list-icon" aria-hidden="true">
                                    <CmsIcon iconKey={iconKey} iconUrl={iconUrl} />
                                </span>
                                <h3>{title}</h3>
                                <p>{description}</p>
                            </li>
                        ))}
                    </ul>
                </div>

                {activeTags.length > 0 && (
                    <div className="tag-card">
                        {activeTags.map(({ id, iconKey, iconUrl, title, description }) => (
                            <div className="tag-item" key={id}>
                                <span className="tag-icon">
                                    <CmsIcon iconKey={iconKey} iconUrl={iconUrl} />
                                </span>
                                <h3>{title}</h3>
                                <p>{description}</p>
                            </div>
                        ))}
                    </div>
                )}


                <LeafDeco className="tl" />
                <LeafDeco className="tr" />
                <LeafDeco className="bl" />
                <LeafDeco className="br" />
    
                <header className="offer-header">
                    <LotusDividerIcon />
                    {section.title && <h1 className="offer-title">{section.title}</h1>}
                    {(section.subtitle || section.subtitleHighlight) && (
                        <p className="offer-sub">
                            {section.subtitle}{' '}
                            <span className="highlight">{section.subtitleHighlight}</span> •
                        </p>
                    )}
                </header>

                <div className="cards-grid">
                    {activeCards.map((offer) => (
                        <OfferCard
                            key={offer.id}
                            imageUrl={resolveOfferImage(offer.id, offer.imageUrl)}
                            altText={offer.imageAlt}
                            iconKey={offer.iconKey}
                            iconUrl={offer.iconUrl}
                            title={offer.title}
                            description={offer.description}
                            // The card carries its own gallery, so the window
                            // it opens needs nothing looked up.
                            onDiscoverClick={() => setSelectedOffer(offer)}
                        />
                    ))}
                </div>

                {offerTags.length > 0 && (
                    <div className="tags-row">
                        {offerTags.map((tag) => (
                            <TagItem
                                key={tag.id}
                                iconKey={tag.iconKey}
                                iconUrl={tag.iconUrl}
                                label={tag.label}
                            />
                        ))}
                    </div>
                )}

                {selectedOffer && (
                    <OfferGalleryModal
                        offer={selectedOffer}
                        onClose={() => setSelectedOffer(null)}
                    />
                )}

                

            </section>
        </>
    )
}
