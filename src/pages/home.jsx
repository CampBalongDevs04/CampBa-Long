import { Link } from 'react-router'
import '../components/css/Header.css'
import Offers from '../components/offers.jsx'
import Accommodations from '../components/accommodations.jsx'
import PromoMarquee from '../components/promoMarquee.jsx'
import Testimonials from '../components/testimonials.jsx'
import Location from '../components/location.jsx'
import { FAQDemo } from '../components/Usage.tsx'
import Contact from '../components/contact.jsx'
import Footer from '../components/footer.jsx'
import { SkeletonImage } from '../components/skeletons/Skeleton.jsx'
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

    const videoSrc = resolveHeroVideo(hero.videoUrl)
    // Only set when staff have uploaded one: the stylesheet already paints the
    // background the site shipped with, and an inline style that repeated it
    // would make the CSS look dead the next time somebody reads it.
    const backgroundStyle = hero.backgroundUrl
        ? { backgroundImage: `url(${resolveHeroBackground(hero.backgroundUrl)})` }
        : undefined

    return (
        <>
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
                    <SkeletonImage src={resolveHeroImage(hero.imageUrl)} alt="Camp Ba-long resort" />
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
                                    {icon && <img src={icon} alt="" aria-hidden="true" />}
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
