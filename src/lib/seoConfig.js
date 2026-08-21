// ============================================================================
//  Camp Ba-long — one table of what every public page claims to be
// ----------------------------------------------------------------------------
//  The title, description and share image for each of the five guest routes,
//  plus the resort's name, address and phone. Read by three places that must
//  never disagree with each other:
//
//    components/Seo.jsx          the tags in the live page's <head>
//    scripts/seo-postbuild.mjs   robots.txt, sitemap.xml, and the per-route
//                                HTML a link-preview crawler is served
//
//  Two of those run in Node, before React exists, which is why this file
//  imports NOTHING. No React, no supabase, no browser globals. Adding an
//  import here breaks `npm run build`, not the site, so it fails loudly.
//
//  WHY THIS IS NOT IN THE CMS
//  --------------------------
//  Every other piece of copy on this site is a row in Postgres that staff edit
//  in the dashboard, and deliberately so. This is not, because a sitemap is
//  written at BUILD time and a database read happens at RUN time — a title
//  staff changed on Tuesday could not reach a file generated on Monday. The
//  page's <title> would update and the sitemap beside it would not, which is
//  worse than either being stale on its own. Search metadata changes about
//  once a year; the deploy that changes it can carry it.
// ============================================================================

// ----------------------------------------------------------------------------
//  The one place the site's public address is written down.
// ----------------------------------------------------------------------------
//  Canonical links, the sitemap and the og:image URL are all absolute, because
//  the specs require it: a crawler reads og:image out of context and has no
//  page to resolve a relative path against. Facebook, Messenger and Viber all
//  drop a share image they cannot fetch, so a wrong value here does not look
//  like an error — it looks like a link preview with no picture, and nothing on
//  the site itself gives any hint why.
//
//  THIS IS A CONSTANT, ON PURPOSE. It used to read VITE_SITE_ORIGIN first, and
//  twice in a row that indirection is what broke the share image: Vercel's
//  environment has VITE_SITE_ORIGIN set to `https://campba-long.vercel.app`,
//  while the deployment is actually served at `camp-ba-long.vercel.app`. One
//  hyphen apart, both entirely plausible, and the wrong one 404s every request.
//  Because the env var outranked the value written here, editing this file
//  changed the local build and nothing about the deployed one — the tags looked
//  correct in dist/ and shipped wrong.
//
//  An override that silently outranks the source of truth is worth less than
//  the bugs it causes. To change the domain — when a real one replaces the
//  vercel.app address — edit the line below. That is the whole procedure, and
//  it is a one-line diff in the file the sitemap and share tags already read.
//
//  Whatever it is set to, confirm the share image actually loads there before
//  trusting it. This is the check that would have caught both failures:
//
//      curl -I https://<host>/urlimage.jpg     # expect 200, image/jpeg
//
//  No trailing slash: every path below starts with one.
export const SITE_ORIGIN = 'https://camp-ba-long.vercel.app'

export const SITE_NAME = 'Camp Ba-long Nature Farm & Resort'
export const SITE_SHORT_NAME = 'Camp Ba-long'
export const DEFAULT_LOCALE = 'en_PH'

// The share image, as an absolute URL. Lives in public/ rather than in
// src/assets/ on purpose: Vite fingerprints anything under src/, so its URL
// changes on every build that touches it, and a link already shared on
// Facebook would point at a file that no longer exists. public/ is copied
// through untouched, so this URL is stable for the life of the domain.
//
// JPEG rather than PNG, and 1200px wide rather than the source's 1904px,
// because a share image is judged by whether it arrives at all. The same
// picture as a PNG is 1.25 MB; WhatsApp stops generating a thumbnail somewhere
// around 300 KB and shows a bare link instead. 1200x630 is the ratio every
// preview card is designed around — this is 1200x573, the source's own ratio,
// which Facebook crops by a few pixels top and bottom rather than letterboxing.
export const OG_IMAGE = {
    path: '/urlimage.jpg',
    type: 'image/jpeg',
    width: 1200,
    height: 573,
    alt: 'Camp Ba-long Nature Farm & Resort in Liliw, Laguna',
}

// ----------------------------------------------------------------------------
//  The resort itself — the facts Google shows in a local result.
// ----------------------------------------------------------------------------
//  These duplicate values that also live in the CMS fallbacks (see
//  data/contactSection.js and data/locationSection.js). That duplication is
//  intentional and worth stating: those files describe what the CONTACT
//  SECTION says, this describes what the BUSINESS is. They happen to agree
//  today. If staff ever change the phone number in the dashboard, change it
//  here too — a structured-data phone that disagrees with the visible page is
//  the specific thing Google penalises as inconsistent NAP.
export const BUSINESS = {
    legalName: 'Camp Ba-long Nature Farm & Resort',
    description:
        'A semi-exclusive nature farm and camp site in Liliw, Laguna. Stay overnight in '
        + 'teepees, A-houses or your own tent, book a day tour, and unwind with '
        + 'traditional hilot massage.',
    telephone: '+63 962 233 1708',
    email: 'campbalongnaturefarm@gmail.com',
    address: {
        street: 'Brgy. Laguan',
        locality: 'Liliw',
        region: 'Laguna',
        country: 'PH',
    },
    // From the map embed in components/location.jsx. Keep the two in step.
    geo: { latitude: 14.1263549, longitude: 121.4312552 },
    mapUrl: 'https://maps.app.goo.gl/69TemNpuTw41mkDo6',
    // Matches the Hours row of the contact card.
    openingHours: { opens: '08:00', closes: '20:00' },
    priceRange: '₱₱',
    social: [
        'https://facebook.com/campbalong',
        'https://instagram.com/campbalong',
    ],
}

// ----------------------------------------------------------------------------
//  The five public routes.
// ----------------------------------------------------------------------------
//  This list and the <Route> table in App.jsx describe the same set of pages.
//  App.jsx keeps its own PUBLIC_PATHS set because it needs one before this file
//  exists in the bundle graph; assertRoutesMatchApp() in
//  scripts/seo-postbuild.mjs compares the two on every build and fails it if
//  they disagree. That matters because the drift is otherwise silent: a public
//  route missing from this table is a page that is live, linked, and absent
//  from the sitemap forever.
//
//  Lengths are not arbitrary. Google truncates a title around 60 characters and
//  a description around 155, measured in pixels rather than characters, so
//  these are written short enough that the whole sentence survives — a
//  description cut mid-word reads as a broken site in the result list.
//
//  `priority` and `changefreq` feed the sitemap. They are hints, and modern
//  Google largely ignores them; they cost one line each and other crawlers
//  (Bing, and the AI crawlers that now matter for a resort) still read them.
export const ROUTES = [
    {
        path: '/',
        title: 'Camp Ba-long Nature Farm & Resort | Liliw, Laguna',
        description:
            'Semi-exclusive camp site in Liliw, Laguna. Stay in teepees, A-houses and '
            + 'tents, book a day tour or overnight stay, and unwind with hilot massage.',
        priority: '1.0',
        changefreq: 'weekly',
    },
    {
        path: '/menu',
        title: 'Food Menu | Camp Ba-long Nature Farm & Resort',
        description:
            'Browse the Camp Ba-long kitchen menu — grilled plates, rice meals and combo '
            + 'sets you can add to your booking before you arrive in Liliw, Laguna.',
        priority: '0.8',
        changefreq: 'weekly',
    },
    {
        path: '/spa',
        title: 'Hilot & Spa Services | Camp Ba-long, Liliw',
        description:
            'Traditional hilot, body scrub and massage treatments at Camp Ba-long in '
            + 'Liliw, Laguna. See the full service list and reserve a slot with your stay.',
        priority: '0.8',
        changefreq: 'monthly',
    },
    {
        path: '/booking',
        title: 'Book Your Stay | Camp Ba-long Nature Farm & Resort',
        description:
            'Check live availability and reserve your teepee, A-house, tent pitch or day '
            + 'tour at Camp Ba-long in Liliw, Laguna. Confirmation within 24 hours.',
        priority: '0.9',
        changefreq: 'daily',
    },
    {
        path: '/my-booking',
        title: 'View My Booking | Camp Ba-long Nature Farm & Resort',
        description:
            'Look up an existing Camp Ba-long reservation with your booking reference to '
            + 'check your dates, balance and payment status.',
        priority: '0.5',
        changefreq: 'monthly',
    },
]

// Small helper so callers never build a double slash or forget the origin.
export function absoluteUrl(path = '/') {
    return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}

// The route table as a lookup, for the component that needs one by pathname.
export const ROUTES_BY_PATH = Object.fromEntries(ROUTES.map((r) => [r.path, r]))
