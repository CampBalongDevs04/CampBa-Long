import { useCallback, useEffect, useRef, useState } from 'react';
import './css/accommodations.css';
import LotusDividerIcon from './LotusDividerIcon';

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

const ICONS = {
    table: (
        <>
            <line x1="6" y1="20" x2="42" y2="20" />
            <line x1="11" y1="20" x2="7" y2="35" />
            <line x1="37" y1="20" x2="41" y2="35" />
            <line x1="5" y1="27" x2="18" y2="27" />
            <line x1="30" y1="27" x2="43" y2="27" />
        </>
    ),
    tent: (
        <>
            <path d="M8 36 L24 12 L40 36 Z" />
            <line x1="24" y1="12" x2="24" y2="36" />
            <path d="M19 36 L24 24 L29 36" />
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
    large: (
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

// Swap the icon/photoBg pairs for real <img> tags pointing at your
// Supabase Storage URLs when this is wired up to the live site.
const accommodations = [
    {
        id: 'table', title: 'Table', paxMin: 4, paxMax: 6, price: 250,
        icon: ICONS.table, photoBg: 'linear-gradient(135deg,#4C6B4F,#1E3A2B)',
        features: ['Picnic table', 'Bench seats x2', 'Shade umbrella', 'Garden view'],
    },
    {
        id: 'tent', title: 'Camping Tent', paxMin: 1, paxMax: 3, price: 350,
        icon: ICONS.tent, photoBg: 'linear-gradient(135deg,#5d7a5a,#24422f)',
        features: ['Dome tent setup', 'Sleeping mats x2', 'Flashlight', 'Forest view', 'Fire pit access'],
    },
    {
        id: 'small', title: 'A-House Small', paxMin: 1, paxMax: 2, price: 400,
        icon: ICONS.small, photoBg: 'linear-gradient(135deg,#C6A15B,#8a6b34)',
        features: ['Bed mattress', '2 Pillows', 'Electric fan', 'River view', 'Table'],
    },
    {
        id: 'medium', title: 'A-House Medium', paxMin: 3, paxMax: 5, price: 1300,
        icon: ICONS.medium, photoBg: 'linear-gradient(135deg,#D9BD84,#96733a)',
        features: ['Bed mattress', '5 Pillows', '3 Blankets', 'Electric fan', 'Tent', 'Table & Chair'],
        featured: true,
    },
    {
        id: 'large', title: 'A-House Large', paxMin: 6, paxMax: 8, price: 1800,
        icon: ICONS.large, photoBg: 'linear-gradient(135deg,#C6A15B,#7a5c2a)',
        features: ['Bed mattress', '6 Pillows', '4 Blankets', 'Electric fan', 'Tent', 'Table & Chairs'],
    },
    {
        id: 'pavilion', title: 'Pavilion', paxMin: 15, paxMax: 30, price: 2500,
        icon: ICONS.pavilion, photoBg: 'linear-gradient(135deg,#4C6B4F,#16291E)',
        features: ['Long table seating', 'Roofed shelter', 'Ceiling fans', 'Power outlets', 'Group capacity'],
    },
];

const defaultIndex = Math.max(0, accommodations.findIndex((a) => a.featured));

function paxLabel({ paxMin, paxMax }) {
    return paxMin === paxMax ? `${paxMin} pax` : `${paxMin}-${paxMax} pax`;
}

export default function Accommodations() {
    const [currentIndex, setCurrentIndex] = useState(defaultIndex);
    const [paxValue, setPaxValue] = useState('');
    const [toast, setToast] = useState({ message: '', visible: false });

    const viewportRef = useRef(null);
    const trackRef = useRef(null);
    const dragRef = useRef({ dragging: false, startX: 0 });
    const wheelLockRef = useRef(false);
    const currentIndexRef = useRef(defaultIndex);
    currentIndexRef.current = currentIndex;
    const toastTimerRef = useRef(null);

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
        dragRef.current = { dragging: true, startX: e.clientX };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerUp = (e) => {
        if (!dragRef.current.dragging) return;
        dragRef.current.dragging = false;
        const delta = e.clientX - dragRef.current.startX;
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
        showToast(`Selected "${acc.title}" — booking coming soon.`);
    };

    return (
        <section className="acc-section" id="accommodations">
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
                        onPointerUp={handlePointerUp}
                        onPointerCancel={() => { dragRef.current.dragging = false; }}
                    >
                        <div className="acc-track" ref={trackRef}>
                            {accommodations.map((acc, i) => (
                                <div
                                    key={acc.id}
                                    className={`acc-card${i === currentIndex ? ' active' : ''}`}
                                    style={{ '--dist': Math.abs(i - currentIndex) }}
                                    onClick={() => goTo(i)}
                                >
                                    <div className="acc-card-photo" style={{ background: acc.photoBg }}>
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
                                        <p className="acc-price">PHP {acc.price.toLocaleString()}</p>
                                    </div>
                                    <div className="acc-details">
                                        <h4>Details</h4>
                                        <div className="acc-details-content">
                                            <div className="acc-mini-photo" style={{ background: acc.photoBg }}>
                                                {acc.image ? (
                                                    <img src={acc.image} alt="" draggable="false" />
                                                ) : (
                                                    <UnitIcon paths={acc.icon} />
                                                )}
                                            </div>
                                            <ul>
                                                {acc.features.map((f) => <li key={f}>{f}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                    <button
                                        className="acc-book-btn"
                                        onClick={(e) => { e.stopPropagation(); handleBook(acc); }}
                                    >
                                        Book Now!
                                    </button>
                                </div>
                            ))}
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
            </div>

            <div className={`acc-toast${toast.visible ? ' show' : ''}`}>{toast.message}</div>
        </section>
    );
}
