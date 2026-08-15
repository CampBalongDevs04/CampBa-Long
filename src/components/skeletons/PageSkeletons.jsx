import Header from '../Header.jsx'
import {
    Skeleton,
    SkeletonStatus,
    SkeletonText,
    CardRowSkeleton,
    FormSkeleton,
    CalendarSkeleton,
    AccommodationListSkeleton,
    GallerySkeleton,
    HeroSkeleton,
    BookingSkeleton,
    SummarySkeleton,
    StatBoardSkeleton,
    TabsSkeleton,
    PanelSkeleton,
} from './Skeleton.jsx'

/* ============================================================
   Route-level page skeletons — one per page, mirroring that
   page's real layout so content appears exactly where the
   placeholders were (no layout shift). Shown while the route's
   lazy chunk downloads; React swaps them out automatically.
   ============================================================ */

/** Section heading: lotus mark + title + subtitle, centered. */
function SectionHeadingSkeleton() {
    return (
        <>
            <Skeleton width={46} height={22} style={{ borderRadius: 11 }} />
            <Skeleton className="skl-section-title" />
            <Skeleton className="skl-section-sub" />
        </>
    )
}

export function HomeSkeleton() {
    return (
        <SkeletonStatus label="Loading home page">
            <main aria-hidden="true">
                <HeroSkeleton titleLines={3} withCircle withFeatures />
                {/* Offers section */}
                <section className="skl-section">
                    <SectionHeadingSkeleton />
                    <CardRowSkeleton count={3} />
                </section>
                {/* Accommodations section */}
                <section className="skl-section" style={{ paddingTop: 0 }}>
                    <SectionHeadingSkeleton />
                    <CardRowSkeleton count={3} />
                </section>
            </main>
        </SkeletonStatus>
    )
}

export function FoodMenuSkeleton() {
    return (
        <SkeletonStatus label="Loading food menu">
            <main aria-hidden="true">
                <HeroSkeleton titleLines={2} withCircle />
                {/* How to order panel */}
                <section className="skl-section">
                    <div className="skl-howto-panel">
                        <Skeleton photo className="skl-howto-image" />
                        <div className="skl-howto-content">
                            <Skeleton width="45%" height={26} />
                            <SkeletonText lines={5} gap={12} />
                        </div>
                    </div>
                </section>
                {/* First category: banner + toggle + card row */}
                <section className="skl-section" style={{ paddingTop: 0, gap: 18 }}>
                    <div className="skl-category-banner">
                        <Skeleton onDark />
                    </div>
                    <Skeleton width={120} height={20} />
                    <CardRowSkeleton count={3} />
                </section>
            </main>
        </SkeletonStatus>
    )
}

export function SpaServiceSkeleton() {
    return (
        <SkeletonStatus label="Loading spa services">
            <main aria-hidden="true">
                <HeroSkeleton titleLines={2} />
                {/* How to book panel */}
                <section className="skl-section">
                    <SectionHeadingSkeleton />
                    <div className="skl-howto-panel">
                        <Skeleton photo className="skl-howto-image" />
                        <div className="skl-howto-content">
                            <Skeleton width="45%" height={26} />
                            <SkeletonText lines={5} gap={12} />
                        </div>
                    </div>
                </section>
                {/* Services header + pax input + gallery mosaic */}
                <section className="skl-section" style={{ paddingTop: 0 }}>
                    <SectionHeadingSkeleton />
                    <div style={{ display: 'flex', gap: 12 }}>
                        <Skeleton width={220} height={48} style={{ borderRadius: 10 }} />
                        <Skeleton width={200} height={48} pill />
                    </div>
                    <GallerySkeleton items={6} />
                </section>
            </main>
        </SkeletonStatus>
    )
}

export function BookingPageSkeleton() {
    return (
        <SkeletonStatus label="Loading booking page">
            <main className="skl-booking-shell" aria-hidden="true">
                <div className="skl-page-hero">
                    <Skeleton className="skl-eyebrow" />
                    <Skeleton className="skl-page-title" />
                    <Skeleton className="skl-page-tagline" />
                    <div className="skl-trust-row">
                        <Skeleton pill />
                        <Skeleton pill />
                        <Skeleton pill />
                    </div>
                </div>
                <div className="skl-booking-layout">
                    <div className="skl-booking-steps">
                        {/* Step 1: dates & schedule */}
                        <StepCardSkeleton>
                            <CalendarSkeleton />
                        </StepCardSkeleton>
                        {/* Step 2: accommodation */}
                        <StepCardSkeleton>
                            <AccommodationListSkeleton />
                        </StepCardSkeleton>
                        {/* Step 3: guest information */}
                        <StepCardSkeleton>
                            <FormSkeleton fields={3} withButton={false} />
                        </StepCardSkeleton>
                        {/* Step 4: payment */}
                        <StepCardSkeleton>
                            <FormSkeleton fields={1} withButton={false} />
                            <Skeleton width="100%" height={120} style={{ borderRadius: 12 }} />
                        </StepCardSkeleton>
                        {/* Step 5: review & confirm */}
                        <StepCardSkeleton>
                            <SkeletonText lines={4} gap={10} />
                            <Skeleton className="skl-form-btn" />
                        </StepCardSkeleton>
                    </div>
                    <SummarySkeleton />
                </div>
            </main>
        </SkeletonStatus>
    )
}

function StepCardSkeleton({ children }) {
    return (
        <section className="skl-step-card">
            <div className="skl-step-header">
                <Skeleton className="skl-step-num" circle />
                <span className="skl-step-heading">
                    <Skeleton width="35%" height={22} />
                    <Skeleton width="65%" height={13} />
                </span>
            </div>
            {children}
        </section>
    )
}

export function MyBookingSkeleton() {
    return (
        <SkeletonStatus label="Loading your bookings">
            <main className="skl-mybooking-shell" aria-hidden="true">
                <div className="skl-page-hero skl-page-hero--center">
                    <Skeleton className="skl-eyebrow" />
                    <Skeleton className="skl-page-title" />
                    <Skeleton className="skl-page-tagline" />
                </div>
                <BookingSkeleton count={2} />
            </main>
        </SkeletonStatus>
    )
}

/**
 * Fallback for the admin dashboard chunk. The first screen of that
 * route is the login gate, so this mirrors the login card.
 * The public Header is a real (eagerly loaded) component, exactly
 * like the login screen renders it — zero shift when it swaps in.
 */
export function AdminLoginSkeleton() {
    return (
        <SkeletonStatus label="Loading admin sign-in">
            <Header />
            <section className="skl-admin-login-section" aria-hidden="true">
                <div className="skl-admin-login-card">
                    <Skeleton photo width={72} height={72} circle />
                    <Skeleton width={110} height={12} />
                    <Skeleton width={190} height={30} />
                    <Skeleton width={240} height={13} />
                    <Skeleton width={46} height={22} style={{ borderRadius: 11 }} />
                    <FormSkeleton fields={2} />
                </div>
            </section>
        </SkeletonStatus>
    )
}

/**
 * Admin dashboard overview skeleton — heading, stat cards, booking
 * filter tabs, bookings panel, then the services block. Used while
 * the dashboard widgets' chunks load right after a successful login.
 */
export function DashboardSkeleton() {
    return (
        <SkeletonStatus label="Loading dashboard">
            <div className="skl-dash-content" aria-hidden="true">
                <div className="skl-dash-heading">
                    <Skeleton onDark width={110} height={12} />
                    <Skeleton onDark width={220} height={36} />
                    <Skeleton onDark width={180} height={14} />
                </div>
                <StatBoardSkeleton />
                <TabsSkeleton count={6} />
                <PanelSkeleton />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, marginTop: 12 }}>
                    <Skeleton onDark width={46} height={22} style={{ borderRadius: 11 }} />
                    <Skeleton onDark width={220} height={28} />
                    <TabsSkeleton count={3} />
                    <PanelSkeleton />
                </div>
            </div>
        </SkeletonStatus>
    )
}
