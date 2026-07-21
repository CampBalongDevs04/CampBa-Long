import { useCallback, useState } from 'react'
import './skeleton.css'

/* ============================================================
   Skeleton primitives
   ============================================================ */

/**
 * Base shimmer block. Sized via width/height props (number = px)
 * or an extra className from skeleton.css.
 */
export function Skeleton({
    className = '',
    width,
    height,
    circle = false,
    pill = false,
    text = false,
    onDark = false,
    photo = false,
    style,
    ...rest
}) {
    const classes = [
        'skel',
        circle && 'skel--circle',
        pill && 'skel--pill',
        text && 'skel--text',
        onDark && 'skel--on-dark',
        photo && 'skel--photo',
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <span
            className={classes}
            style={{ width, height, ...style }}
            aria-hidden="true"
            {...rest}
        />
    )
}

/** A stack of text lines; the last line is shorter, like real copy. */
export function SkeletonText({ lines = 3, gap = 8, onDark = false, lineHeight = '0.9rem', lastLineWidth = '60%' }) {
    return (
        <span aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap }}>
            {Array.from({ length: lines }, (_, i) => (
                <Skeleton
                    key={i}
                    text
                    onDark={onDark}
                    height={lineHeight}
                    width={i === lines - 1 ? lastLineWidth : '100%'}
                />
            ))}
        </span>
    )
}

/**
 * Accessible wrapper for a whole loading region: announces the
 * loading state to assistive tech while the visual skeletons
 * themselves stay aria-hidden.
 */
export function SkeletonStatus({ label = 'Loading content', children }) {
    return (
        <div className="skel-status" role="status" aria-busy="true" aria-live="polite">
            <span className="skel-sr-only">{label}…</span>
            {children}
        </div>
    )
}

/**
 * Drop-in <img> replacement: shows a shimmer cover over the image
 * area until the real file finishes downloading, then removes it.
 * The parent wrapper must be position: relative (skeleton.css
 * already handles the wrappers used across the site).
 */
export function SkeletonImage({ alt = '', onLoad, onError, ...imgProps }) {
    const [loaded, setLoaded] = useState(false)

    // Cached images can be complete before React attaches onLoad.
    const imgRef = useCallback((node) => {
        if (node && node.complete && node.naturalWidth > 0) setLoaded(true)
    }, [])

    return (
        <>
            <img
                ref={imgRef}
                alt={alt}
                onLoad={(event) => {
                    setLoaded(true)
                    onLoad?.(event)
                }}
                onError={(event) => {
                    setLoaded(true)
                    onError?.(event)
                }}
                {...imgProps}
            />
            {!loaded && <Skeleton photo className="skel-img-cover" />}
        </>
    )
}

/* ============================================================
   Reusable composite skeletons
   ============================================================ */

/** Content card: square image, title, two text lines, pill button. */
export function CardSkeleton({ withButton = true }) {
    return (
        <div className="skl-card">
            <Skeleton photo className="skl-card-image" />
            <Skeleton className="skl-card-line" width="70%" />
            <Skeleton className="skl-card-line" width="95%" height="0.75rem" />
            <Skeleton className="skl-card-line" width="40%" height="0.85rem" />
            {withButton && <Skeleton className="skl-card-btn" />}
        </div>
    )
}

/** Row of content cards (offers, testimonials, food carousel). */
export function CardRowSkeleton({ count = 3, withButton = true }) {
    return (
        <div className="skl-card-row">
            {Array.from({ length: count }, (_, i) => (
                <CardSkeleton key={i} withButton={withButton} />
            ))}
        </div>
    )
}

/** Admin-style data table inside a cream panel. */
export function TableSkeleton({ rows = 4, cols = 5 }) {
    return (
        <div className="skl-panel">
            {Array.from({ length: rows }, (_, i) => (
                <div className="skl-table-row" key={i} style={cols !== 5 ? { gridTemplateColumns: `repeat(${cols}, 1fr)` } : undefined}>
                    {Array.from({ length: cols }, (_, j) => (
                        <Skeleton key={j} width={j === 0 ? '80%' : '60%'} />
                    ))}
                </div>
            ))}
        </div>
    )
}

/** List rows with a thumbnail (admin food list style). */
export function ListSkeleton({ rows = 5 }) {
    return (
        <div className="skl-panel">
            {Array.from({ length: rows }, (_, i) => (
                <div className="skl-list-row" key={i}>
                    <Skeleton photo className="skl-list-row-thumb" />
                    <span className="skl-list-row-text">
                        <Skeleton text width="40%" />
                        <Skeleton text width="65%" height="0.7rem" />
                    </span>
                    <Skeleton width={70} height={16} />
                </div>
            ))}
        </div>
    )
}

/** Labeled form fields plus a submit button. */
export function FormSkeleton({ fields = 3, withButton = true }) {
    return (
        <div className="skl-form">
            {Array.from({ length: fields }, (_, i) => (
                <div className="skl-field" key={i}>
                    <Skeleton className="skl-field-label" />
                    <Skeleton className="skl-field-input" />
                </div>
            ))}
            {withButton && <Skeleton className="skl-form-btn" />}
        </div>
    )
}

/** Month calendar: nav row + weekday header + 5 weeks of days. */
export function CalendarSkeleton() {
    return (
        <div className="skl-calendar">
            <div className="skl-calendar-nav">
                <Skeleton width={36} height={36} circle />
                <Skeleton width={160} height={22} />
                <Skeleton width={36} height={36} circle />
            </div>
            <div className="skl-calendar-grid">
                {Array.from({ length: 7 }, (_, i) => (
                    <Skeleton key={`h${i}`} height={14} width="60%" style={{ margin: '0 auto' }} />
                ))}
                {Array.from({ length: 35 }, (_, i) => (
                    <Skeleton key={i} className="skl-calendar-cell" />
                ))}
            </div>
        </div>
    )
}

/** Horizontal accommodation picker cards (booking step 2). */
export function AccommodationListSkeleton({ count = 4 }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Skeleton text width="55%" />
            <div className="skl-accom-row">
                <Skeleton width={30} height={30} circle />
                {Array.from({ length: count }, (_, i) => (
                    <div className="skl-accom-card" key={i}>
                        <Skeleton photo className="skl-accom-card-image" />
                        <span className="skl-accom-card-info">
                            <Skeleton text width="70%" />
                            <Skeleton text width="50%" height="0.7rem" />
                            <Skeleton text width="45%" />
                            <Skeleton text width="80%" height="0.7rem" />
                        </span>
                    </div>
                ))}
                <Skeleton width={30} height={30} circle />
            </div>
        </div>
    )
}

/** Spa-style editorial mosaic gallery (first tile spans 2x2). */
export function GallerySkeleton({ items = 6 }) {
    return (
        <div className="skl-gallery">
            {Array.from({ length: items }, (_, i) => (
                <Skeleton photo key={i} className={i === 0 ? 'skl-gallery-item-hero' : undefined} />
            ))}
        </div>
    )
}

/** Full-viewport dark hero with copy, CTA and optional circle/features. */
export function HeroSkeleton({ titleLines = 2, withCircle = false, withFeatures = false }) {
    return (
        <div className="skl-hero">
            <div className="skl-hero-main">
                <div className="skl-hero-copy">
                    {Array.from({ length: titleLines }, (_, i) => (
                        <Skeleton
                            key={i}
                            onDark
                            className="skl-hero-title-line"
                            width={i === titleLines - 1 ? '55%' : undefined}
                        />
                    ))}
                    <Skeleton onDark className="skl-hero-sub-line" style={{ marginTop: 8 }} />
                    <Skeleton onDark className="skl-hero-sub-line" width="65%" />
                    <Skeleton onDark className="skl-hero-btn" />
                </div>
                {withCircle && <Skeleton onDark className="skl-hero-circle" />}
            </div>
            {withFeatures && (
                <div className="skl-hero-features">
                    {Array.from({ length: 4 }, (_, i) => (
                        <div className="skl-hero-feature" key={i}>
                            <Skeleton onDark width={30} height={30} circle />
                            <span className="skl-hero-feature-text">
                                <Skeleton onDark text width="70%" />
                                <Skeleton onDark text width="90%" height="0.7rem" />
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

/** One "My Bookings" reservation card. */
export function BookingCardSkeleton() {
    return (
        <div className="skl-step-card">
            <div className="skl-bcard-header">
                <Skeleton className="skl-bcard-icon" />
                <span className="skl-bcard-heading">
                    <Skeleton width="45%" height={20} />
                    <Skeleton width="30%" height={12} />
                </span>
                <Skeleton className="skl-bcard-pill" />
            </div>
            <div className="skl-bcard-grid">
                {Array.from({ length: 4 }, (_, i) => (
                    <div className="skl-bcard-field" key={i}>
                        <Skeleton className="skl-bcard-field-icon" />
                        <span className="skl-bcard-field-text">
                            <Skeleton text width="60%" height="0.7rem" />
                            <Skeleton text width="85%" />
                        </span>
                    </div>
                ))}
            </div>
            <div className="skl-bcard-divider" />
            <div className="skl-bcard-grid skl-bcard-grid--secondary">
                {Array.from({ length: 2 }, (_, i) => (
                    <div className="skl-bcard-field" key={i}>
                        <span className="skl-bcard-field-text">
                            <Skeleton text width="50%" height="0.7rem" />
                            <Skeleton text width="90%" />
                            <Skeleton text width="70%" />
                        </span>
                    </div>
                ))}
            </div>
            <div className="skl-bcard-actions">
                <Skeleton />
                <Skeleton />
            </div>
        </div>
    )
}

/** List of reservation cards. */
export function BookingSkeleton({ count = 2 }) {
    return (
        <div className="skl-booking-list">
            {Array.from({ length: count }, (_, i) => (
                <BookingCardSkeleton key={i} />
            ))}
        </div>
    )
}

/** Booking summary sidebar (sticky, right column). */
export function SummarySkeleton() {
    return (
        <div className="skl-summary">
            <Skeleton width="60%" height={24} />
            {Array.from({ length: 6 }, (_, i) => (
                <div className="skl-summary-row" key={i}>
                    <Skeleton width="40%" />
                    <Skeleton width="30%" />
                </div>
            ))}
            <div className="skl-bcard-divider" />
            <div className="skl-summary-row">
                <Skeleton width="35%" height={18} />
                <Skeleton width="25%" height={18} />
            </div>
        </div>
    )
}

/** Admin stat cards row (Units / accommodation counts). */
export function StatCardsSkeleton({ count = 5 }) {
    return (
        <div className="skl-stat-grid">
            {Array.from({ length: count }, (_, i) => (
                <div className="skl-stat-card" key={i}>
                    <Skeleton width="50%" height={26} />
                    <Skeleton width="75%" height={12} />
                </div>
            ))}
        </div>
    )
}

/** Pill tab bar (admin filters). */
export function TabsSkeleton({ count = 6 }) {
    return (
        <div className="skl-tab-bar">
            {Array.from({ length: count }, (_, i) => (
                <Skeleton key={i} pill />
            ))}
        </div>
    )
}

/** Cream panel with centered placeholder content (empty-state shape). */
export function PanelSkeleton() {
    return (
        <div className="skl-panel" style={{ alignItems: 'center', padding: '56px 20px', gap: 10 }}>
            <Skeleton width={44} height={44} circle />
            <Skeleton width={180} height={16} />
            <Skeleton width={260} height={12} />
        </div>
    )
}
