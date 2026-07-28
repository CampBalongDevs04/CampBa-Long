import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import './css/accommodations.css';
import LotusDividerIcon from './LotusDividerIcon';
import LeafDeco from './LeafDeco';
import { getAvailability, getNextAvailableDate, formatShortDate, useAccommodationDB } from '../data/accommodationDB.js';
import { getAccomodationOptions } from '../data/accomodationOptions.js';


//---ACCOMMODATIONS---//
import smallHouse from '../assets/temp/A-House-Small.png';
import mediumHouse from '../assets/temp/A-House-Medium.png';
import largeHouse from '../assets/temp/A-House-Family.png';
import teepeeImage from '../assets/images/acc1.png';
import cottageImage from '../assets/images/acc2.png';
import pavilionImage from '../assets/images/acc3.png';
import tentSmallImage from '../assets/images/acc4.png';
import tentLargeImage from '../assets/images/acc5.png';


function UnitIcon({ paths }) {
    return (
        <svg
            viewBox="0 0 48 48"
            fill="none"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {paths}
        </svg>
    );
}

// NOTE: These SVG icons are only PLACEHOLDERS shown while a card has no
// `image` yet. Once you add `image:` to every accommodation below, this
// whole ICONS block (and the UnitIcon component above) can be deleted.
const ICONS = {
    teepee: (
        <>
            <path d="M11 38 L24 8 L37 38 Z" />
            <line x1="20" y1="11" x2="16" y2="5" />
            <line x1="28" y1="11" x2="32" y2="5" />
            <path d="M20 38 L24 23 L28 38" />
        </>
    ),
    tent: (
        <>
            <path d="M8 36 L24 12 L40 36 Z" />
            <line x1="24" y1="12" x2="24" y2="36" />
            <path d="M19 36 L24 24 L29 36" />
        </>
    ),
    tentLarge: (
        <>
            <path d="M4 38 L24 10 L44 38 Z" />
            <line x1="24" y1="10" x2="24" y2="38" />
            <path d="M15 38 L24 21 L33 38" />
        </>
    ),
    cottage: (
        <>
            <path d="M6 36 L24 12 L42 36 Z" />
            <rect x="14" y="24" width="20" height="12" rx="1.5" />
            <rect x="21" y="28" width="6" height="8" />
        </>
    ),
    small: (
        <>
            <path d="M10 24 L24 10 L38 24" />
            <rect x="14" y="24" width="20" height="14" rx="1.5" />
            <rect x="21" y="29" width="6" height="9" />
        </>
    ),
    medium: (
        <>
            <path d="M6 22 L24 8 L42 22" />
            <rect x="10" y="22" width="28" height="16" rx="1.5" />
            <rect x="13" y="26" width="6" height="6" />
            <rect x="20" y="29" width="8" height="9" />
        </>
    ),
    family: (
        <>
            <path d="M4 20 L24 6 L44 20" />
            <rect x="8" y="20" width="32" height="18" rx="1.5" />
            <rect x="11" y="25" width="6" height="6" />
            <rect x="31" y="25" width="6" height="6" />
            <rect x="20" y="29" width="8" height="9" />
        </>
    ),
    pavilion: (
        <>
            <path d="M4 18 L24 6 L44 18" />
            <line x1="24" y1="6" x2="24" y2="14" />
            <line x1="10" y1="18" x2="10" y2="40" />
            <line x1="24" y1="18" x2="24" y2="40" />
            <line x1="38" y1="18" x2="38" y2="40" />
            <line x1="6" y1="40" x2="42" y2="40" />
        </>
    ),
};

// Presentation only — `id` and `title` must match ACCOMMODATION_TYPES in
// data/accommodationDB.js so a card resolves to the same unit the admin board
// and the booking page use. Order follows that table too.
//
// To show a real photo on a card, uncomment its `image:` line below and
// make sure the matching import at the top of this file is uncommented too.
// `photoBg` stays as the fallback background while the photo loads.
const ACCOMMODATION_CARDS = [
    {
        id: 'teepee', title: 'Teepee',
        icon: ICONS.teepee, photoBg: 'linear-gradient(135deg,#5d7a5a,#24422f)',
        image: teepeeImage,
        features: ['Canvas teepee', 'Bed mattress', 'Pillows & blankets', 'Garden view', 'Fire pit access'],
    },
    {
        id: 'small', title: 'A-House Small',
        icon: ICONS.small, photoBg: 'linear-gradient(135deg,#C6A15B,#8a6b34)',
        image: smallHouse,
        features: ['Bed mattress', '2 Pillows', 'Electric fan', 'River view', 'Table'],
    },
    {
        id: 'medium', title: 'A-House Medium',
        icon: ICONS.medium, photoBg: 'linear-gradient(135deg,#D9BD84,#96733a)',
        image: mediumHouse,
        features: ['Bed mattress', '5 Pillows', '3 Blankets', 'Electric fan', 'Tent', 'Table & Chair'],
        featured: true,
    },
    {
        id: 'family', title: 'A-House Family',
        icon: ICONS.family, photoBg: 'linear-gradient(135deg,#C6A15B,#7a5c2a)',
        image: largeHouse,
        features: ['Bed mattress', '6 Pillows', '4 Blankets', 'Electric fan', 'Tent', 'Table & Chairs'],
    },
    {
        id: 'tent-small', title: 'Small Tent',
        icon: ICONS.tent, photoBg: 'linear-gradient(135deg,#5d7a5a,#24422f)',
        image: tentSmallImage,
        features: ['Dome tent setup', 'Sleeping mats x2', 'Flashlight', 'Forest view', 'Fire pit access'],
    },
    {
        id: 'tent-large', title: 'Big Tent',
        icon: ICONS.tentLarge, photoBg: 'linear-gradient(135deg,#4C6B4F,#1E3A2B)',
        image: tentLargeImage,
        features: ['Family-size dome tent', 'Sleeping mats x4', 'Flashlight', 'Forest view', 'Fire pit access'],
    },
    {
        id: 'cottage', title: 'Cottage',
        icon: ICONS.cottage, photoBg: 'linear-gradient(135deg,#C6A15B,#8a6b34)',
        image: cottageImage,
        features: ['Roofed cottage', 'Table & chairs', 'Electric fan', 'Power outlets', 'Garden view'],
    },
    {
        id: 'pavilion', title: 'Pavillion',
        icon: ICONS.pavilion, photoBg: 'linear-gradient(135deg,#4C6B4F,#16291E)',
        image: pavilionImage,
        features: ['Long table seating', 'Roofed shelter', 'Ceiling fans', 'Power outlets', 'Group capacity'],
    },
];

// Pax range is READ from the booking rate table rather than repeated here, so
// a card can never advertise a capacity the booking page won't honour. A unit
// sold under both schedules (Teepee, the A-Houses) spans both pax ranges.
//
// Rates are deliberately NOT pulled in: the same unit costs different amounts
// under Day Time vs the overnight schedules, so there is no one number to show
// this early. The booking page quotes the price once a schedule is chosen.
const PAX_BY_ID = new Map();
for (const group of ['day', 'overnight']) {
    for (const option of getAccomodationOptions(group)) {
        const prev = PAX_BY_ID.get(option.id);
        PAX_BY_ID.set(option.id, {
            paxMin: Math.min(prev?.paxMin ?? Infinity, option.minPax ?? Infinity),
            paxMax: Math.max(prev?.paxMax ?? 0, option.maxPax ?? 0),
        });
    }
}

// A card with no rate entry can't be booked, so it isn't offered at all —
// better a missing card than one that dead-ends on the booking page.
const accommodations = ACCOMMODATION_CARDS
    .filter((card) => PAX_BY_ID.has(card.id))
    .map((card) => ({ ...card, ...PAX_BY_ID.get(card.id) }));

// Extended info shown inside the "view more" modal, keyed by accommodation id.
// Every entry in `images` is a null placeholder for now — replace each null
// with an imported photo later (e.g. `images: [smallInterior, smallView]`).
const ACCOMMODATION_DETAILS = {
    teepee: {
        description:
            'A canvas teepee tucked into the camp gardens, with a real mattress and bedding inside. All the romance of sleeping under canvas without giving up a good night of rest.',
        images: [null, null, null],
    },
    small: {
        description:
            'A cozy A-frame hideaway built for one or two. Wake up to a river view, unwind at your own table, and enjoy a comfortable mattress after a day of exploring the camp.',
        images: [null, null, null],
    },
    medium: {
        description:
            'Our most popular unit. This mid-size A-frame comfortably fits small groups and barkadas, with bedding for five, an extra tent, and its own table and chair set for shared meals.',
        images: [null, null, null],
    },
    family: {
        description:
            'The family favorite. A spacious A-frame that sleeps up to ten, with full bedding, an extra tent for the kids, and a table and chairs set — ideal for reunions and weekend getaways.',
        images: [null, null, null],
    },
    'tent-small': {
        description:
            'The classic Camp Ba-long experience. Sleep under the trees in a pre-pitched dome tent with sleeping mats provided — just bring your sense of adventure. Fire pit access included for evening bonfires.',
        images: [null, null, null],
    },
    'tent-large': {
        description:
            'A roomier pre-pitched dome tent for barkadas and small families, with sleeping mats for four. Same easy camping setup as the Small Tent, with space to spare for your gear.',
        images: [null, null, null],
    },
    cottage: {
        description:
            'A charming cottage perfect for couples or small families. Enjoy the comfort of a private space with modern amenities, while still being close to the natural beauty of the camp.',
        images: [null, null, null],
    },
    pavilion: {
        description:
            'A roofed open-air pavilion made for big celebrations. Long table seating, ceiling fans, and power outlets make it the go-to spot for birthdays, team buildings, and family events.',
        images: [null, null, null],
    },
};

const defaultIndex = Math.max(0, accommodations.findIndex((a) => a.featured));

// Which stay schedules the booking page actually offers a unit under. Read
// from the same rate table the booking flow uses, so a card can't promise a
// stay the booking page won't sell (Cottage and Pavilion are day-only there,
// the tents are overnight-only). Ids with no rate entry get no note.
const DAY_UNIT_IDS = new Set(getAccomodationOptions('day').map((item) => item.id));
const OVERNIGHT_UNIT_IDS = new Set(getAccomodationOptions('overnight').map((item) => item.id));

function scheduleLimitLabel(id) {
    const day = DAY_UNIT_IDS.has(id);
    const overnight = OVERNIGHT_UNIT_IDS.has(id);
    if (day && !overnight) return 'Day Time schedule only';
    if (overnight && !day) return 'Overnight schedules only';
    return null;
}

function paxLabel({ paxMin, paxMax }) {
    return paxMin === paxMax ? `${paxMin} pax` : `${paxMin}-${paxMax} pax`;
}

function AccommodationModal({ acc, onClose, onBook }) {
    const details = ACCOMMODATION_DETAILS[acc.id] ?? { description: '', images: [null] };
    const images = details.images.length ? details.images : [null];
    const [slide, setSlide] = useState(0);

    const availability = getAvailability(acc.id);
    const isFullyBooked = availability !== null && availability.available === 0;
    const nextAvailable = isFullyBooked ? getNextAvailableDate(acc.id) : null;
    const scheduleLimit = scheduleLimitLabel(acc.id);

    // Close on Escape and keep the page from scrolling behind the modal.
    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    const goSlide = (index) => {
        setSlide((index + images.length) % images.length);
    };

    return (
        <div className="acc-modal-overlay" onClick={onClose}>
            <div
                className="acc-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`${acc.title} details`}
                onClick={(e) => e.stopPropagation()}
            >
                <button className="acc-modal-close" onClick={onClose} aria-label="Close">
                    ×
                </button>

                <div className="acc-modal-carousel">
                    <div className="acc-modal-slide" style={{ background: acc.photoBg }}>
                        {images[slide] ? (
                            <img src={images[slide]} alt={`${acc.title} photo ${slide + 1}`} draggable="false" />
                        ) : (
                            <>
                                <UnitIcon paths={acc.icon} />
                                <span className="acc-photo-label">Photo coming soon</span>
                            </>
                        )}
                        {acc.featured && <span className="acc-badge">Most Popular</span>}
                    </div>
                    {images.length > 1 && (
                        <>
                            <button
                                className="acc-modal-arrow prev"
                                onClick={() => goSlide(slide - 1)}
                                aria-label="Previous photo"
                            >
                                ‹
                            </button>
                            <button
                                className="acc-modal-arrow next"
                                onClick={() => goSlide(slide + 1)}
                                aria-label="Next photo"
                            >
                                ›
                            </button>
                            <div className="acc-modal-dots">
                                {images.map((_, i) => (
                                    <button
                                        key={i}
                                        className={`acc-dot${i === slide ? ' on' : ''}`}
                                        onClick={() => goSlide(i)}
                                        aria-label={`Go to photo ${i + 1}`}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="acc-modal-info">
                    <h3>{acc.title}</h3>
                    {/* No rate shown here on purpose — a unit's price depends on
                        the stay schedule, so the booking page quotes it once the
                        guest has picked Day Time / Day-and-Night / Night-and-Day. */}
                    <p className="acc-modal-meta">{paxLabel(acc)}</p>
                    {scheduleLimit && <p className="acc-schedule-limit">{scheduleLimit}</p>}
                    {availability !== null && (
                        <p className={`acc-availability${isFullyBooked ? ' booked-out' : ''}`}>
                            {isFullyBooked
                                ? `Fully booked today${nextAvailable ? ` · free ${formatShortDate(nextAvailable)}` : ''}`
                                : `${availability.available} of ${availability.total} units available today`}
                        </p>
                    )}
                    <p className="acc-modal-desc">{details.description}</p>
                    <h4>What&apos;s Included</h4>
                    <ul className="acc-feature-list">
                        {acc.features.map((f) => (
                            <li key={f}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M20 6L9 17l-5-5" />
                                </svg>
                                {f}
                            </li>
                        ))}
                    </ul>
                    <button className="acc-book-btn" onClick={onBook}>
                        {isFullyBooked ? 'Book a Later Date' : 'Book Now!'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Accommodations() {
    const navigate = useNavigate();
    // Today's availability comes straight from the accommodation database, so
    // the carousel updates the moment a booking is made or cancelled.
    useAccommodationDB();
    const [currentIndex, setCurrentIndex] = useState(defaultIndex);
    const [paxValue, setPaxValue] = useState('');
    const [toast, setToast] = useState({ message: '', visible: false });
    const [modalAcc, setModalAcc] = useState(null);

    const viewportRef = useRef(null);
    const trackRef = useRef(null);
    const dragRef = useRef({ dragging: false, startX: 0 });
    const wheelLockRef = useRef(false);
    const currentIndexRef = useRef(defaultIndex);
    const toastTimerRef = useRef(null);

    // The wheel listener below is bound once, so it reads the active index
    // through this ref. Syncing happens in an effect — refs must not be
    // written during render.
    useEffect(() => {
        currentIndexRef.current = currentIndex;
    }, [currentIndex]);

    const goTo = useCallback((index) => {
        setCurrentIndex(Math.max(0, Math.min(accommodations.length - 1, index)));
    }, []);

    const showToast = useCallback((message) => {
        clearTimeout(toastTimerRef.current);
        setToast({ message, visible: true });
        toastTimerRef.current = setTimeout(
            () => setToast((t) => ({ ...t, visible: false })),
            2600,
        );
    }, []);

    // Center the active card inside the viewport.
    const updateOffset = useCallback(() => {
        const viewport = viewportRef.current;
        const track = trackRef.current;
        const activeCard = track?.children[currentIndex];
        if (!viewport || !track || !activeCard) return;
        const cardCenter = activeCard.offsetLeft + activeCard.offsetWidth / 2;
        track.style.transform = `translateX(${viewport.clientWidth / 2 - cardCenter}px)`;
    }, [currentIndex]);

    useEffect(() => {
        updateOffset();
        window.addEventListener('resize', updateOffset);
        return () => window.removeEventListener('resize', updateOffset);
    }, [updateOffset]);

    // Wheel needs a non-passive listener so preventDefault can stop page scroll.
    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        let accumulated = 0;
        const onWheel = (e) => {
            const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            const dir = delta > 0 ? 1 : -1;
            const index = currentIndexRef.current;
            const atEdge =
                (dir === -1 && index === 0) ||
                (dir === 1 && index === accommodations.length - 1);
            // At either end, let the gesture fall through so the page can
            // still scroll past the carousel.
            if (atEdge && !wheelLockRef.current) return;
            e.preventDefault();
            if (wheelLockRef.current) return;
            accumulated += delta;
            if (Math.abs(accumulated) < 10) return;
            accumulated = 0;
            setCurrentIndex((i) => Math.max(0, Math.min(accommodations.length - 1, i + dir)));
            wheelLockRef.current = true;
            setTimeout(() => { wheelLockRef.current = false; }, 350);
        };
        viewport.addEventListener('wheel', onWheel, { passive: false });
        return () => viewport.removeEventListener('wheel', onWheel);
    }, []);

    useEffect(() => () => clearTimeout(toastTimerRef.current), []);

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowRight') goTo(currentIndex + 1);
        if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
    };

    const handlePointerDown = (e) => {
        dragRef.current = { dragging: false, pressed: true, startX: e.clientX };
    };

    // Capturing the pointer on pointerdown retargets the eventual click to the
    // viewport, which swallows clicks on the cards and the "Book Now!" button.
    // Only capture once the pointer has actually moved (a real drag).
    const handlePointerMove = (e) => {
        const drag = dragRef.current;
        if (!drag.pressed || drag.dragging) return;
        if (Math.abs(e.clientX - drag.startX) > 8) {
            drag.dragging = true;
            e.currentTarget.setPointerCapture(e.pointerId);
        }
    };

    const handlePointerUp = (e) => {
        const drag = dragRef.current;
        dragRef.current = { ...drag, dragging: false, pressed: false };
        if (!drag.dragging) return;
        const delta = e.clientX - drag.startX;
        if (delta > 45) goTo(currentIndex - 1);
        else if (delta < -45) goTo(currentIndex + 1);
    };

    const handleRecommend = () => {
        const val = parseInt(paxValue, 10);
        if (!val || val < 1) {
            showToast('Enter how many pax first.');
            return;
        }

        // Exact fits first, preferring the tightest capacity range.
        const fits = accommodations
            .map((a, i) => ({ a, i }))
            .filter(({ a }) => val >= a.paxMin && val <= a.paxMax)
            .sort((x, y) => (x.a.paxMax - x.a.paxMin) - (y.a.paxMax - y.a.paxMin));

        let match = fits[0];
        if (!match) {
            // No exact fit: smallest unit that can still hold everyone.
            const bigEnough = accommodations
                .map((a, i) => ({ a, i }))
                .filter(({ a }) => a.paxMax >= val)
                .sort((x, y) => x.a.paxMax - y.a.paxMax);
            match = bigEnough[0]
                || { a: accommodations[accommodations.length - 1], i: accommodations.length - 1 };
        }

        goTo(match.i);
        showToast(`Recommended: ${match.a.title} for ${val} pax.`);
    };

    const handleBook = (acc) => {
        navigate('/booking', { state: { accomodationId: acc.id } });
    };

    return (
        <section className="acc-section" id="accommodations">
            {/* decorative corner leaves — same motif as the What We Offer section */}
            <LeafDeco className="tl" />
            <LeafDeco className="tr" />
            <LeafDeco className="bl" />
            <LeafDeco className="br" />

            <div className="acc-header">
                <LotusDividerIcon />
                <h1 className="acc-title">Accommodations</h1>
                <p className="acc-sub">• Find the perfect spot for your stay •</p>
            </div>

            <div className="acc-recommend-bar">
                <label className="acc-pax-input">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="7" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="number"
                        min="1"
                        placeholder="How many pax?"
                        value={paxValue}
                        onChange={(e) => setPaxValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRecommend()}
                    />
                </label>
                <button className="acc-recommend-btn" onClick={handleRecommend}>
                    Recommend
                </button>
            </div>

            <div className="acc-carousel">
                <p className="acc-scroll-hint">Drag, scroll, or use the arrows to browse available units</p>
                <div className="acc-carousel-wrap">
                    <button
                        className="acc-nav-btn"
                        onClick={() => goTo(currentIndex - 1)}
                        disabled={currentIndex === 0}
                        aria-label="Previous"
                    >
                        ‹
                    </button>

                    <div
                        className="acc-viewport"
                        ref={viewportRef}
                        tabIndex={0}
                        onKeyDown={handleKeyDown}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={() => { dragRef.current = { dragging: false, pressed: false, startX: 0 }; }}
                    >
                        <div className="acc-track" ref={trackRef}>
                            {accommodations.map((acc, i) => {
                                const availability = getAvailability(acc.id);
                                const isFullyBooked = availability !== null && availability.available === 0;
                                const nextAvailable = isFullyBooked ? getNextAvailableDate(acc.id) : null;

                                return (
                                <div
                                    key={acc.id}
                                    className={`acc-card${i === currentIndex ? ' active' : ''}`}
                                    style={{ '--dist': Math.abs(i - currentIndex) }}
                                    onClick={() => { goTo(i); setModalAcc(acc); }}
                                >
                                    <div className="acc-card-photo" style={{ background: acc.photoBg }}>
                                        {acc.featured && <span className="acc-badge">Most Popular</span>}
                                        {isFullyBooked && <span className="acc-badge acc-badge-booked">Fully Booked Today</span>}
                                        {acc.image ? (
                                            <img src={acc.image} alt={acc.title} draggable="false" />
                                        ) : (
                                            <>
                                                <UnitIcon paths={acc.icon} />
                                                <span className="acc-photo-label">Add photo</span>
                                            </>
                                        )}
                                    </div>
                                    <div className="acc-card-info">
                                        <h3>{acc.title}</h3>
                                        <p className="acc-pax">{paxLabel(acc)}</p>
                                        {scheduleLimitLabel(acc.id) && (
                                            <p className="acc-schedule-limit">{scheduleLimitLabel(acc.id)}</p>
                                        )}
                                        {availability !== null && (
                                            <p className={`acc-availability${isFullyBooked ? ' booked-out' : ''}`}>
                                                {isFullyBooked
                                                    ? `Fully booked today${nextAvailable ? ` · free ${formatShortDate(nextAvailable)}` : ''}`
                                                    : `${availability.available} of ${availability.total} units available today`}
                                            </p>
                                        )}
                                    </div>
                                    <div className="acc-details">
                                        <h4>What&apos;s Included</h4>
                                        <ul className="acc-feature-list">
                                            {acc.features.map((f) => (
                                                <li key={f}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                        <path d="M20 6L9 17l-5-5" />
                                                    </svg>
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <p className="acc-view-more">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <circle cx="12" cy="12" r="9" />
                                            <line x1="12" y1="8" x2="12" y2="12" />
                                            <line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                        Click to view more
                                    </p>
                                    <button
                                        className="acc-book-btn"
                                        onClick={(e) => { e.stopPropagation(); handleBook(acc); }}
                                    >
                                        {isFullyBooked ? 'Book a Later Date' : 'Book Now!'}
                                    </button>
                                </div>
                                );
                            })}
                        </div>
                    </div>

                    <button
                        className="acc-nav-btn"
                        onClick={() => goTo(currentIndex + 1)}
                        disabled={currentIndex === accommodations.length - 1}
                        aria-label="Next"
                    >
                        ›
                    </button>
                </div>

                {/* gold pagination dots */}
                <div className="acc-dots">
                    {accommodations.map((a, i) => (
                        <button
                            key={a.id}
                            className={`acc-dot${i === currentIndex ? ' on' : ''}`}
                            onClick={() => goTo(i)}
                            aria-label={`Go to ${a.title}`}
                        />
                    ))}
                </div>
            </div>

            <div className={`acc-toast${toast.visible ? ' show' : ''}`}>{toast.message}</div>

            {modalAcc && (
                <AccommodationModal
                    acc={modalAcc}
                    onClose={() => setModalAcc(null)}
                    onBook={() => { setModalAcc(null); handleBook(modalAcc); }}
                />
            )}
        </section>
    );
}
