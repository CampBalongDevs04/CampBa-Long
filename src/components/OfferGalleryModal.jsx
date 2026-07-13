import { useEffect } from 'react';

// import the gallery photos here, then replace the null values below
// e.g. import PoolImage from '../assets/images/pool.png';

const imagePoolandRiver = [
    {
        image: null,
        alt: 'pool',
        label: 'Pool'
    },
    {
        image: null,
        alt: 'river',
        label: 'River'
    },
    {
        image: null,
        alt: 'running water',
        label: 'Running Water'
    }
]

const imageFoodMenu = [
    {
        image: null,
        alt: 'local dishes',
        label: 'Local Dishes'
    },
    {
        image: null,
        alt: 'fresh ingredients',
        label: 'Fresh Ingredients'
    },
    {
        image: null,
        alt: 'refreshments',
        label: 'Refreshments'
    }
]

const imageSpaService = [
    {
        image: null,
        alt: 'massage',
        label: 'Massage'
    },
    {
        image: null,
        alt: 'hot stone',
        label: 'Hot Stone'
    },
    {
        image: null,
        alt: 'relaxation area',
        label: 'Relaxation Area'
    }
]

// maps each offer title to its gallery images
const galleryByOffer = {
    'Pool & Running Water': imagePoolandRiver,
    'Foods': imageFoodMenu,
    'Spa': imageSpaService,
}


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

    const Icon = offer.icon;
    const gallery = galleryByOffer[offer.title] ?? [];

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
                    <span className="gallery-icon"><Icon /></span>
                    <h3>{offer.title}</h3>
                    <p>{offer.description}</p>
                </header>
                <div className="gallery-grid">
                    {gallery.map(({ image, alt, label }) => (
                        <figure className="gallery-item" key={label}>
                            {image ? (
                                <img src={image} alt={alt} />
                            ) : (
                                <div className="gallery-placeholder">
                                    <span>Photo coming soon</span>
                                </div>
                            )}
                            <figcaption>{label}</figcaption>
                        </figure>
                    ))}
                </div>
            </div>
        </div>
    );
}
