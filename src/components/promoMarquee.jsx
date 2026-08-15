import { useLayoutEffect, useRef, useState } from 'react'
import { usePromoMarquee } from '../data/promoMarquee.js'
import './css/promoMarquee.css'

// The scrolling promo bar above the accommodations. Its copy is written in
// Units → Manage Accommodations and lives in one row in Postgres, so a sale can
// be announced (and called off) without a redeploy — see data/promoMarquee.js.
//
// THE RIBBON: SALE ✦ SALE ✦ SALE ✦
// --------------------------------
// The promo repeats across the whole bar, the way a sale ribbon does, rather
// than one sentence travelling across an otherwise empty strip. So the message
// list is repeated as many times as it takes to fill the bar — measured at run
// time, because how many "SALE"s fit depends on the word, the font and the
// screen, none of which CSS can count.
//
// That filled run is the SEQUENCE. The track holds two of them and slides by
// exactly -50%: at the end of the animation the second sequence sits precisely
// where the first began, so the frame it restarts on is identical to the one it
// ended on and the repeat has no seam or stutter.
//
// The pace is a constant speed rather than a fixed lap time, so a short promo
// and a long one scroll past at the same reading speed.
const PIXELS_PER_SECOND = 60

export default function PromoMarquee() {
    const { messages, isActive, loaded } = usePromoMarquee()
    const barRef = useRef(null)
    const passRef = useRef(null)
    const [{ repeats, seconds }, setLayout] = useState({ repeats: 1, seconds: 24 })

    const showing = loaded && isActive && messages.length > 0

    useLayoutEffect(() => {
        if (!showing) return
        const bar = barRef.current
        const pass = passRef.current
        if (!bar || !pass) return

        const measure = () => {
            const barWidth = bar.clientWidth
            // ONE run through the messages. Measured off a single pass, not off
            // the filled sequence, so recomputing cannot feed back on itself.
            const passWidth = pass.getBoundingClientRect().width
            if (barWidth === 0 || passWidth === 0) return

            // Enough passes to cover the bar. Without this the bar is wider than
            // the content and the second sequence shows up alongside the first,
            // which reads as the same sentence printed twice rather than as a
            // ribbon.
            const nextRepeats = Math.max(1, Math.ceil(barWidth / passWidth))
            const nextSeconds = Math.max(
                10,
                Math.round((passWidth * nextRepeats) / PIXELS_PER_SECOND),
            )

            setLayout((current) =>
                current.repeats === nextRepeats && current.seconds === nextSeconds
                    ? current
                    : { repeats: nextRepeats, seconds: nextSeconds },
            )
        }

        measure()
        // Rotating a phone changes the bar width, and a late web font changes
        // the text width. Either one changes how many passes fit.
        const observer = new ResizeObserver(measure)
        observer.observe(bar)
        observer.observe(pass)
        return () => observer.disconnect()
    }, [showing, messages])

    // Nothing at all until the row has landed AND says there is something to
    // say: an empty bar appearing for one frame on every page load would be
    // worse than the banner arriving a moment late.
    if (!showing) return null

    // The two sequences, written out rather than built by a pair of helpers
    // that took `passRef` as an argument. A ref handed to a plain function
    // during render is indistinguishable, to React's lint rule and to a reader,
    // from one whose .current is about to be read — which is genuinely not
    // allowed here, because a value read during render is not tracked and the
    // component would not re-render when it changed. Attached inline it is
    // plainly just a ref attribute on an element, which is always fine.
    return (
        // role="region" with a name, not an aria-live: this is standing copy a
        // guest can read at their own pace, not an update to announce. The
        // label is what lets a screen reader user skip past it.
        <section
            className="promo-marquee"
            role="region"
            aria-label="Current promos"
            ref={barRef}
        >
            <div
                className="promo-marquee-track"
                style={{ '--promo-marquee-seconds': `${seconds}s` }}
            >
                {[false, true].map((duplicate) => (
                    <div
                        className="promo-marquee-sequence"
                        key={duplicate ? 'dup' : 'main'}
                        aria-hidden={duplicate || undefined}
                    >
                        {Array.from({ length: repeats }, (_, index) => (
                            // Everything after the first pass is the SAME
                            // announcement over again, so only that one is left
                            // readable — a screen reader gets the promos once
                            // instead of once per repeat.
                            <ul
                                className="promo-marquee-pass"
                                key={`${duplicate ? 'dup' : 'main'}-${index}`}
                                // The measured pass is the first one of the
                                // real sequence.
                                ref={!duplicate && index === 0 ? passRef : null}
                                aria-hidden={duplicate || index > 0 || undefined}
                            >
                                {messages.map((message, messageIndex) => (
                                    <li
                                        className="promo-marquee-item"
                                        key={`${message}-${messageIndex}`}
                                    >
                                        {message}
                                        <span className="promo-marquee-star" aria-hidden="true">✦</span>
                                    </li>
                                ))}
                            </ul>
                        ))}
                    </div>
                ))}
            </div>
        </section>
    )
}
