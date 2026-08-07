import { SkeletonImage } from './skeletons/Skeleton.jsx'
import CmsIcon from './CmsIcon.jsx'

// One card in the home page's "What We Offer" grid. Its photo, icon, heading
// and line are a row in offer_cards, written in the dashboard's CMS — see
// data/offersSection.js. The icon arrives as the NAME of one the site ships
// with (or the URL of one staff uploaded), which is why it goes through
// CmsIcon rather than being handed in as a component.
export default function OfferCard({
    imageUrl,
    altText,
    iconKey,
    iconUrl,
    title,
    description,
    link = '#',
    onDiscoverClick,
}) {
    return (
        <article className="offer-card">
            <div className="card-media">
                <SkeletonImage src={imageUrl} alt={altText} />
            </div>
            <div className="card-body">
                <div className="card-icon">
                    <CmsIcon iconKey={iconKey} iconUrl={iconUrl} />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                <a
                    href={link}
                    className="discover-btn"
                    onClick={(event) => {
                        if (onDiscoverClick) {
                            event.preventDefault()
                            onDiscoverClick()
                        }
                    }}
                >
                    Discover More
                </a>
            </div>
        </article>
    );
}
