// ============================================================================
//  CMS — what the dashboard can edit, arranged the way the site is arranged
// ----------------------------------------------------------------------------
//  CMS used to be one flat row of tabs, and every tab on it was a block of the
//  home page — until it wasn't. Food Menu went on the end because /menu needed
//  editing too, and Footer went after that because it is on every page. Both
//  read as home-page sections sitting in a row of home-page sections, and the
//  row was already too wide for the dashboard's content column.
//
//  So the row is now two rows: pick the PAGE, then pick the SECTION on it.
//  That is the question staff actually arrive with — "the wording on the spa
//  page is wrong" — and it is the one thing the old row could not answer.
//
//  This file is the single source of truth for both rows. cmsPageTab.jsx
//  renders the top one, cmsTab.jsx renders the bottom one for whichever page
//  is open, and dashboard.jsx switches panels on `${page}:${section}`. Adding a
//  section is a line here plus a case in the dashboard's switch — nothing else.
//
//  PAGES WITH NO SECTIONS YET
//  --------------------------
//  My Booking is listed with an empty `sections` array. Its copy is still
//  written into src/pages/mybooking.jsx, so there is genuinely nothing to edit
//  here yet — and it is listed anyway, because a page missing from the picker
//  looks like a page that cannot be edited by anybody, which is a different
//  and wronger answer. cmsEmpty.jsx is what it shows instead of a panel.
// ============================================================================

export const CMS_PAGES = [
    {
        id: 'home',
        label: 'Homepage',
        // Shown under the picker so staff can check they are on the page they
        // think they are on.
        path: '/',
        // In the order a visitor scrolls past them: finding the right tab is
        // the same as remembering where on the page the thing sits.
        sections: [
            { id: 'hero', label: 'Hero Banner' },
            { id: 'welcome', label: 'Welcome Section' },
            { id: 'offers', label: 'What We Offer' },
            // Heading only — the cards come from the accommodation catalog,
            // which is edited in Units. The panel says so on screen.
            { id: 'accommodations', label: 'Accommodations' },
            { id: 'testimonials', label: 'Testimonials' },
            // Heading, contact card and the tiles under the map — not the map
            // itself, which is coordinates rather than copy.
            { id: 'location', label: 'Location' },
            { id: 'faq', label: 'FAQ' },
            // The words on the enquiry form, not what it does with them.
            { id: 'contact', label: 'Contact' },
        ],
    },
    {
        id: 'menu',
        label: 'Food Menu',
        path: '/menu',
        // These three were one panel you scrolled through. They are backed by
        // three separate tables and they are three separate blocks of /menu, so
        // now that there is a row to put them in, they get one tab each.
        //
        // The food items themselves are catalog data, not copy — they stay in
        // the dashboard's Food Menu SECTION in the sidebar, not here. Same
        // split as Accommodations above.
        sections: [
            { id: 'banner', label: 'Banner' },
            { id: 'how-to-order', label: 'How to Order' },
            { id: 'section-titles', label: 'Section Titles' },
        ],
    },
    {
        id: 'spa',
        label: 'Spa Service',
        path: '/spa',
        // In the order a visitor scrolls past them, same as the home page.
        //
        // The treatment cards are NOT here: they are catalog data — name,
        // price, duration, photo — in spa_services, edited in the dashboard's
        // Spa SECTION in the sidebar. Hilot Section owns the words above them
        // and the inclusions list below them, and says so on screen. Same
        // split as Accommodations.
        sections: [
            { id: 'banner', label: 'Banner' },
            { id: 'how-to-reserve', label: 'How to Reserve' },
            // The decorative photo strip, not the treatment cards.
            { id: 'gallery', label: 'Gallery' },
            { id: 'hilot', label: 'Hilot Section' },
        ],
    },
    {
        id: 'mybooking',
        label: 'My Booking',
        path: '/my-booking',
        sections: [],
    },
    {
        id: 'site',
        label: 'Site-wide',
        // Not a page. The footer is on all of them, and putting it under
        // "Homepage" would say it was only on that one.
        path: 'Every page',
        sections: [{ id: 'footer', label: 'Footer' }],
    },
]

export const DEFAULT_CMS_PAGE = 'home'

export function findCmsPage(id) {
    return CMS_PAGES.find((page) => page.id === id) ?? CMS_PAGES[0]
}

// Which section a page opens on. Pages with nothing to edit answer null, and
// the dashboard shows cmsEmpty.jsx rather than looking for a panel.
export function firstSectionOf(pageId) {
    return findCmsPage(pageId).sections[0]?.id ?? null
}
