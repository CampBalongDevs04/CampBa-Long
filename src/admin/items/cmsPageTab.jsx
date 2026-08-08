import { useState } from 'react'
import '../css/cmsPage.css'
import { CMS_PAGES, DEFAULT_CMS_PAGE } from './cmsPages.js'

// CMS's top row: which page of the site am I editing. The section tabs under
// it (cmsTab.jsx) change to match. See cmsPages.js for why the one flat row
// became two.
//
// Deliberately NOT the pill bar the section tabs use. The two rows sit one
// above the other and do different jobs, and two identical bars stacked would
// read as one bar that wrapped — a staff member would have no way to tell that
// clicking the top row changes the bottom one. So these are cards: bigger,
// with an icon and the page's own address under the name, which is also the
// fastest way to confirm you are about to edit the page you meant.

function HomeIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11l9-8 9 8" />
            <path d="M5 9.5V21h14V9.5" />
            <path d="M10 21v-6h4v6" />
        </svg>
    )
}

function MenuIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 3v7a2 2 0 0 0 2 2v9" />
            <path d="M5 3v4M9 3v4" />
            <path d="M17 3c-1.7 0-3 2-3 5s1.3 5 3 5v8" />
        </svg>
    )
}

function SpaIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21c-4 0-8-3-9-8 3 0 5 1 6.5 2.5C10 12 10.5 7 12 4c1.5 3 2 8 2.5 11.5C16 14 18 13 21 13c-1 5-5 8-9 8z" />
        </svg>
    )
}

function BookingIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <path d="M8 14l2.5 2.5L16 12" />
        </svg>
    )
}

function SiteIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
        </svg>
    )
}

const PAGE_ICONS = {
    home: <HomeIcon />,
    menu: <MenuIcon />,
    spa: <SpaIcon />,
    mybooking: <BookingIcon />,
    site: <SiteIcon />,
}

export default function CmsPageTab({ active, onChange }) {
    const [internalActive, setInternalActive] = useState(DEFAULT_CMS_PAGE)
    const current = active ?? internalActive

    const handleSelect = (id) => {
        setInternalActive(id)
        if (onChange) onChange(id)
    }

    return (
        <div className="cms-page-picker" role="tablist" aria-label="Page to edit">
            {CMS_PAGES.map(({ id, label, path, sections }) => {
                const isActive = current === id
                return (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={isActive ? 'cms-page-card active' : 'cms-page-card'}
                        onClick={() => handleSelect(id)}
                    >
                        <span className="cms-page-icon">{PAGE_ICONS[id]}</span>
                        <span className="cms-page-copy">
                            <span className="cms-page-label">{label}</span>
                            <span className="cms-page-path">{path}</span>
                        </span>
                        {/* A page with nothing to edit says so before it is
                            opened, rather than after — otherwise the only way
                            to find out is to click it and read an empty panel. */}
                        {sections.length === 0 && (
                            <span className="cms-page-badge">Not set up</span>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
