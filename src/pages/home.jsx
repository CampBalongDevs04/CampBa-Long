import { Link } from 'react-router'
import '../components/css/Header.css'
import Offers from '../components/offers.jsx'
import Accommodations from '../components/accommodations.jsx'
import PromoMarquee from '../components/promoMarquee.jsx'
import Testimonials from '../components/testimonials.jsx'
import Location from '../components/location.jsx'
// Lower-case 'usage.tsx' — the file is committed under that name, and Netlify
// and Vercel build on Linux, where the spelling has to match exactly.
import { FAQDemo } from '../components/usage.tsx'
import Contact from '../components/contact.jsx'
import Footer from '../components/footer.jsx'
import Seo from '../components/Seo.jsx'
import { SkeletonImage } from '../components/skeletons/Skeleton.jsx'
import { useFaqSection } from '../data/faqSection.js'
import { buildFaqSchema } from '../lib/structuredData.js'
import {
    useHomeHero,
    resolveHeroImage,
    resolveHeroBackground,
    resolveHeroVideo,
    resolveHeroIcon,
} from '../data/homeHero.js'

// The hero's words, photo, background and clip come from one row in Postgres,
// written in the dashboard's CMS → Hero Banner — see data/homeHero.js. Until
// that row lands (and on a database that predates it) the store answers with
// the copy the site shipped with, so the top of the front page is never blank
// and never half-built.

// Where a button goes decides what it is. A path is routed inside the app, so
// it must be a <Link> — an <a href="/booking"> would work, but as a full page
// load that throws away everything already fetched. An anchor scrolls to a
// section on this page. Anything else is somewhere off the site.
function HeroButton({ href, label, className, children }) {
    if (!label) return null
    const target = href || '#'

    if (target.startsWith('/')) {
        return (
            <Link className={className} to={target}>
                {children}
                {label}
            </Link>
        )
    }

    const external = /^https?:\/\//i.test(target)
    return (
        <a
            className={className}
            href={target}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
            {children}
            {label}
        </a>
    )
}

function Home() {
    const { hero, activeFeatures } = useHomeHero()

    // The same store the accordion further down the page renders from, so the
    // FAQPage schema describes the questions actually on screen — including any
    // staff added this morning — rather than a copy that drifts from them.
    // Subscribing twice costs nothing: it is one useSyncExternalStore over a
    // module-level cache, not a second fetch.
    const { activeFaqs } = useFaqSection()
    const faqSchema = buildFaqSchema(activeFaqs)

    const videoSrc = resolveHeroVideo(hero.videoUrl)
    // Only set when staff have uploaded one: the stylesheet already paints the
    // background the site shipped with, and an inline style that repeated it
    // would make the CSS look dead the next time somebody reads it.
    const backgroundStyle = hero.backgroundUrl
        ? { backgroundImage: `url(${resolveHeroBackground(hero.backgroundUrl)})` }
        : undefined

    return (
        <>
            <Seo path="/" extraSchema={faqSchema ? [faqSchema] : []} />
            <div className="hero-banner" id="home" style={backgroundStyle}>
                {hero.showVideo && (
                    <video
                        className="hero-video"
                        // Keyed on the source so swapping the clip in the
                        // dashboard remounts the element — React reuses a
                        // <video> across a src change and keeps playing the old
                        // one until something else forces a load.
                        key={videoSrc}
                        src={videoSrc}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                        aria-hidden="true"
                        onCanPlay={(e) => e.currentTarget.classList.add('is-ready')}
                    />
                )}
                <div className="hero-main">
                <div className="hero-content">
                    <h1 className="hero-title">
                        {hero.titleLines.map((line, index) => (
                            <span key={`${line}-${index}`}>
                                {line}<br />
                            </span>
                        ))}
                        {hero.accentLine && <span className="hero-accent">{hero.accentLine}</span>}
                    </h1>
                    {hero.subtitle && <p className="hero-subtitle">{hero.subtitle}</p>}
                    <div className="hero-buttons">
                        <HeroButton className="hero-button" href={hero.primaryHref} label={hero.primaryLabel}>
                            <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                                <rect x="3" y="5" width="18" height="16" rx="2"/>
                                <path d="M3 10h18M8 3v4M16 3v4"/>
                            </svg>
                        </HeroButton>
                        <HeroButton
                            className="hero-button hero-button-outline"
                            href={hero.secondaryHref}
                            label={hero.secondaryLabel}
                        >
                            <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                                <path d="M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9M10 12v.01"/>
                                <path d="M13 4.56v16.16a1 1 0 0 1-1.24.97L5 20V5.56a2 2 0 0 1 1.51-1.94l4-1A2 2 0 0 1 13 4.56Z"/>
                            </svg>
                        </HeroButton>
                    </div>
                </div>

                <div className="hero-image-circle">
                    {/* The largest thing above the fold, so it is what Google
                        measures LCP against. Explicitly eager and high
                        priority: the browser's own guess is made before the
                        stylesheet says how big this is, and it guesses low for
                        an image this far down the markup. Never lazy — a lazy
                        LCP image is a direct Core Web Vitals penalty. */}
                    <SkeletonImage
                        src={resolveHeroImage(hero.imageUrl)}
                        alt="Camp Ba-long resort"
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                    />
                </div>
                </div>

                {/* Gone entirely rather than left as an empty bar, for the same
                    reason the promo ticker is: staff who removed every tile
                    removed the strip. */}
                {activeFeatures.length > 0 && (
                    <div className="hero-features">
                        {activeFeatures.map((feature) => {
                            const icon = resolveHeroIcon(feature.iconKey, feature.iconUrl)
                            return (
                                <div className="hero-feature" key={feature.id}>
                                    {icon && (
                                        <img
                                            src={icon}
                                            alt=""
                                            aria-hidden="true"
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    )}
                                    <div>
                                        <h3>{feature.title}</h3>
                                        {feature.description && <p>{feature.description}</p>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <Offers />
            {/* Renders nothing unless staff have switched a promo on, so the
                page is byte-for-byte what it was the rest of the year. */}
            <PromoMarquee />
            <Accommodations />
            <Testimonials />
            <Location />
            <FAQDemo />
            <Contact />
            <Footer />
        </>
    )
}

export default Home
