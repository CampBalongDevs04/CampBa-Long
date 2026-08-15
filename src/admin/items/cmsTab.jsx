import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import '../css/tab.css'
import { findCmsPage, firstSectionOf } from './cmsPages.js'

// CMS's bottom row: which section of the page picked above. The list comes
// from cmsPages.js, which is also what the picker (cmsPageTab.jsx) renders —
// see the header there for why CMS is two rows rather than one.
//
// The row used to be every editable thing on the site at once, home-page
// blocks and /menu and the footer in one line of ten. Splitting by page means
// the longest this ever gets is the home page's eight, and the other pages are
// three or one.
//
// Eight tabs still need about 1090px and the dashboard's content column does
// not always get that wide, so the row scrolls. It has always been able to —
// the bar is `overflow-x: auto` — but it hides its scrollbar, so the tabs past
// the right edge were indistinguishable from tabs that did not exist. These
// two arrows are that missing signal, and they keep the bar on one line.
//
// A "next" alone would strand a staff member at the end of the row with no way
// back, so it comes with its mirror image. Both are disabled at their end of
// the row rather than hidden, so the bar does not resize under the pointer
// mid-click.
export default function CmsTab({ page = 'home', active, onChange }) {
    const sections = findCmsPage(page).sections
    const [internalActive, setInternalActive] = useState(() => firstSectionOf(page))
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
    // the dashboard remembers which section was last open on each page, so
    // returning to the home page with "Contact" selected would otherwise show a
    // row scrolled to the start with no highlighted tab anywhere on it.
    useEffect(() => {
        barRef.current
            ?.querySelector('.tab-item.active')
            ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        measure()
    }, [current, page, measure])

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

    // A page with nothing to edit has no row at all. An empty bar would be a
    // gold pill of blank space above the panel that explains the emptiness.
    if (sections.length === 0) return null

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
                aria-label="Section to edit"
                ref={barRef}
                onScroll={measure}
            >
                {sections.map(({ id, label }) => (
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
