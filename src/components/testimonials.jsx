import './css/testimonials.css'
import LotusDividerIcon from './LotusDividerIcon'

// Edit the real reviews here: change `star` (0-5, halves like 4.5 work too),
// `comment`, `name`, and `stay`. Add or remove entries freely.
const testimonials = [
    {
        name: "Jimmy Ong",
        star: 4,
        comment: "Escape the heat from the city and back to mother nature.🌿✨ Tucked away in the cool highlands of Liliw, it’s the perfect spot to reconnect with nature and recharge. Great and affordable for a quick getaway trip.",
    },
    {
        name: "Hercel Iguid",
        star: 5,
        comment: "Very accomodating, friendly, helpful staff and owner. Ambience is 100%, you can relax and i appreciate the no smoking policy's And it's pet friendly, they are allowed to swim in the ilog.",
    },
    {
        name: "Dona Joy Stefanie Terbio-Sacay",
        star: 5,
        comment: "Are we going back? Definitely YES!✅ We like the rules they implement to prevent damages, control too much crowd, maintaining the cleanliness and peace of the resort. KUDOS TO THE OWNER AND STAFF 🫶",
    },
    {
        name: "Rigor Badiola",
        star: 5,
        comment: "The place is peaceful. Water doesn't smell chlorine. I like this place. I think it would be great if we stayed overnight."
    },
    {
        name: "Mhelber Paredes",
        star: 5,
        comment: "Very accommodating ang personnel. Super dali lapitan at mura ng foods. Highly recommended for those who wants to destress themselves from the noises of the city. Truly a gem",
    },
    {
        name: "Evangeline Jocsing",
        star: 5,
        comment: "I really enjoyed our bonding moments with friends in Camp Ba-long Nature farm.",
    },
    {
        name: "Jason Dela Luna",
        star: 5,
        comment: "This place is a sanctuary. Smoking, vaping and playing loud music is not allowed. Afternoon and the temperature is not even 20 degrees, at night the temperature is somewhere 14 to 17 degrees celcious and morning is much colder 10 to 14 degrees perhaps. Water is freezing cold."
    }
    
]

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

function initialsOf(name) {
    return name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
}

export default function Testimonials() {
    return (
        <section className="testimonials-section" id="testimonials">
            <div className="testimonials-header">
                <LotusDividerIcon />
                <h1 className="testimonials-title">Testimonials</h1>
                <p className="testimonials-sub">• What our guests say about Camp Ba-long •</p>
            </div>

            <div className="testimonials-marquee">
                <div
                    className="testimonials-track"
                    style={{ '--marquee-duration': `${testimonials.length * 9}s` }}
                >
                    {/* The list is rendered twice so the loop is seamless; the
                        second copy is hidden from screen readers. */}
                    {[0, 1].map((copy) => (
                        <div
                            className="testimonials-track-group"
                            key={copy}
                            aria-hidden={copy === 1 || undefined}
                        >
                            {testimonials.map((t, index) => (
                                <article className="testimonial-card" key={t.name}>
                                    <span className="testimonial-quote-mark" aria-hidden="true">&ldquo;</span>
                                    <StarRating rating={t.star} cardIndex={`${copy}-${index}`} />
                                    <p className="testimonial-comment">{t.comment}</p>
                                    <div className="testimonial-footer">
                                        <div className="testimonial-avatar">{initialsOf(t.name)}</div>
                                        <div className="testimonial-person">
                                            <span className="testimonial-name">{t.name}</span>
                                            <span className="testimonial-stay">{t.stay}</span>
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
