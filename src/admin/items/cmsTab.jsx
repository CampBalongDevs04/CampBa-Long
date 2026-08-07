import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import '../css/tab.css'

// CMS is the section for the site's own copy — the words and pictures on the
// public pages, as opposed to what the resort sells and who has booked it.
// One tab per block of the home page, in the order a visitor scrolls past
// them, so finding the right tab is the same as remembering where on the page
// the thing sits.
const cmsTabs = [
    { id: 'hero', label: 'Hero Banner' },
    { id: 'welcome', label: 'Welcome Section' },
    { id: 'offers', label: 'What We Offer' },
    // Heading only — the cards come from the accommodation catalog, which is
    // edited in Units. The tab says so on screen.
    { id: 'accommodations', label: 'Accommodations' },
    { id: 'testimonials', label: 'Testimonials' },
    // Heading, contact card and the tiles under the map — not the map itself,
    // which is coordinates rather than copy. The tab says so on screen.
    { id: 'location', label: 'Location' },
    { id: 'faq', label: 'FAQ' },
    // The words on the enquiry form, not what it does with them — the tab says
    // so on screen.
    { id: 'contact', label: 'Contact' },
    // Last, because it is last on the page — and the only tab here that is not
    // confined to the home page.
    { id: 'footer', label: 'Footer' },
]

// Nine tabs need about 1290px and the dashboard's content column never gets
// that wide, so the row scrolls. It has always been able to — the bar is
// `overflow-x: auto` — but it hides its scrollbar, so the tabs past the right
// edge were indistinguishable from tabs that did not exist. These two arrows
// are that missing signal, and they keep the bar on one line.
//
// A "next" alone would strand a staff member at the end of the row with no way
// back, so it comes with its mirror image. Both are disabled at their end of
// the row rather than hidden, so the bar does not resize under the pointer
// mid-click.
export default function CmsTab({ active, onChange }) {
    const [internalActive, setInternalActive] = useState('hero')
    const current = active ?? internalActive
    const barRef = useRef(null)
    const [reach, setReach] = useState({ prev: false, next: false })

    const handleSelect = (id) => {
        setInternalActive(id)
        if (onChange) onChange(id)
    }

    // How much of the row is still off each edge. The 1px slack absorbs the
    // fractional scrollWidth a browser reports at some zoom levels, which would
    // otherwise leave "next" enabled forever at the end of the row.
    const measure = useCallback(() => {
        const bar = barRef.current
        if (!bar) return
        const max = bar.scrollWidth - bar.clientWidth
        setReach({ prev: bar.scrollLeft > 1, next: bar.scrollLeft < max - 1 })
    }, [])

    // Measured before paint, so the arrows are never briefly wrong on the first
    // frame — and re-measured when the sidebar expands or the window changes,
    // either of which resizes the bar without scrolling it.
    useLayoutEffect(() => {
        measure()
        const bar = barRef.current
        if (!bar) return undefined

        const observer = new ResizeObserver(measure)
        observer.observe(bar)
        window.addEventListener('resize', measure)
        return () => {
            observer.disconnect()
            window.removeEventListener('resize', measure)
        }
    }, [measure])

    // Whichever tab is open is brought into view. It matters on the way back:
    // the dashboard remembers which CMS tab was last open, so returning to CMS
    // with "Footer" selected would otherwise show a row scrolled to the start
    // with no highlighted tab anywhere on it.
    useEffect(() => {
        barRef.current
            ?.querySelector('.tab-item.active')
            ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        measure()
    }, [current, measure])

    // Most of a screenful, so a press always leaves one familiar tab in view to
    // read the new position against.
    //
    // The position is computed and assigned rather than handed to
    // `behavior: 'smooth'`. Smooth scrolling is driven by the browser's
    // animation frames, and where those are not running — a tab that is not
    // compositing, or a machine honouring "reduce motion" — the press does
    // nothing at all and looks like a dead button. A row of tabs stepping
    // across is not an animation worth that.
    const scrollByPage = (direction) => {
        const bar = barRef.current
        if (!bar) return

        const max = bar.scrollWidth - bar.clientWidth
        const target = bar.scrollLeft + direction * bar.clientWidth * 0.8
        bar.scrollLeft = Math.max(0, Math.min(max, target))
        measure()
    }

    return (
        <div className="tab-scroller">
            <button
                type="button"
                className="tab-nav"
                aria-label="Show earlier tabs"
                disabled={!reach.prev}
                onClick={() => scrollByPage(-1)}
            >
                ‹
            </button>

            <div
                className="tab-bar"
                role="tablist"
                aria-label="CMS view"
                ref={barRef}
                onScroll={measure}
            >
                {cmsTabs.map(({ id, label }) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={current === id}
                        className={current === id ? 'tab-item active' : 'tab-item'}
                        onClick={() => handleSelect(id)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <button
                type="button"
                className="tab-nav"
                aria-label="Show more tabs"
                disabled={!reach.next}
                onClick={() => scrollByPage(1)}
            >
                ›
            </button>
        </div>
    )
}
