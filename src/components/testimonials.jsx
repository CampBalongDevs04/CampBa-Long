import './css/testimonials.css'
import LotusDividerIcon from './LotusDividerIcon'
import { useTestimonials } from '../data/testimonialsSection.js'

// The heading and the reviews come from two rows' worth of Postgres, written in
// the dashboard's CMS → Testimonials — see data/testimonialsSection.js. This
// file used to hold the reviews as an array with a comment telling whoever
// found it to edit them here, which made adding one a commit and a redeploy.
// Until that table lands (and on a database that predates it) the store answers
// with the seven reviews the site shipped with, so this block is never blank.

function Star({ fill, id }) {
    // fill: 1 = full, 0.5 = half, 0 = empty
    return (
        <svg className="star" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <defs>
                <linearGradient id={id}>
                    <stop offset={`${fill * 100}%`} stopColor="var(--gold)" />
                    <stop offset={`${fill * 100}%`} stopColor="transparent" />
                </linearGradient>
            </defs>
            <path
                d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.58L12 17.58l-5.9 3.1 1.13-6.58L2.45 9.44l6.6-.96L12 2.5z"
                fill={`url(#${id})`}
                stroke="var(--gold)"
                strokeWidth="1.3"
                strokeLinejoin="round"
            />
        </svg>
    )
}

function StarRating({ rating, cardIndex }) {
    return (
        <div className="star-rating" role="img" aria-label={`${rating} out of 5 stars`}>
            {[0, 1, 2, 3, 4].map((i) => (
                <Star
                    key={i}
                    id={`star-fill-${cardIndex}-${i}`}
                    fill={Math.max(0, Math.min(1, rating - i))}
                />
            ))}
        </div>
    )
}

// The avatar is the guest's initials, not a photo — so a name typed with a
// stray double space must not put `undefined` in the circle.
function initialsOf(name) {
    return String(name ?? '')
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
}

export default function Testimonials() {
    const { section, activeTestimonials } = useTestimonials()

    // Gone entirely rather than left as an empty band, for the same reason the
    // promo ticker is: staff who hid every review hid the section.
    if (activeTestimonials.length === 0) return null

    return (
        <section className="testimonials-section" id="testimonials">
            <div className="testimonials-header">
                <LotusDividerIcon />
                {section.title && <h2 className="testimonials-title">{section.title}</h2>}
                {section.subtitle && <p className="testimonials-sub">{section.subtitle}</p>}
            </div>

            <div className="testimonials-marquee">
                <div
                    className="testimonials-track"
                    style={{ '--marquee-duration': `${activeTestimonials.length * 9}s` }}
                >
                    {/* The list is rendered twice so the loop is seamless; the
                        second copy is hidden from screen readers. */}
                    {[0, 1].map((copy) => (
                        <div
                            className="testimonials-track-group"
                            key={copy}
                            aria-hidden={copy === 1 || undefined}
                        >
                            {activeTestimonials.map((t, index) => (
                                <article className="testimonial-card" key={t.id}>
                                    <span className="testimonial-quote-mark" aria-hidden="true">&ldquo;</span>
                                    <StarRating rating={t.rating} cardIndex={`${copy}-${index}`} />
                                    <p className="testimonial-comment">{t.comment}</p>
                                    <div className="testimonial-footer">
                                        <div className="testimonial-avatar">{initialsOf(t.name)}</div>
                                        <div className="testimonial-person">
                                            <span className="testimonial-name">{t.name}</span>
                                            {t.stay && <span className="testimonial-stay">{t.stay}</span>}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
