// ============================================================================
//  Camp Ba-long — the JSON-LD a search engine reads instead of the page
// ----------------------------------------------------------------------------
//  Builders that turn the facts in seoConfig.js into schema.org objects. The
//  <Seo> component serialises whatever these return into one
//  <script type="application/ld+json"> in the head.
//
//  WHAT THIS BUYS
//  --------------
//  The address, phone and hours below are what a search engine needs to show
//  the resort as a local result — the panel with the map pin, the opening
//  hours and the "Directions" button — instead of one more blue link. For a
//  business whose guests search "camp site near Liliw" rather than by name,
//  that panel is most of the traffic.
//
//  ONE RULE, AND IT IS NOT A STYLE PREFERENCE
//  ------------------------------------------
//  Everything asserted here must also be visible on the page a guest opens.
//  Structured data that claims a phone number the page does not show is
//  precisely what Google's spam policy calls out, and the penalty is losing
//  the rich result entirely. So these builders read the same values the
//  contact card renders. When staff change the phone number in the dashboard,
//  BUSINESS.telephone in seoConfig.js has to change with it.
//
//  @type IS Campground, NOT Hotel
//  ------------------------------
//  Their own FAQ says it: "We are a camp site so we don't have rooms but we do
//  have teepees, A-houses and tents." Hotel implies rooms and invites the
//  room-level fields Google then expects to find. Campground is a
//  LodgingBusiness the same way Hotel is, so it earns the same local panel
//  while describing what is actually there.
// ============================================================================

import { BUSINESS, SITE_NAME, absoluteUrl, OG_IMAGE } from './seoConfig.js'

// A stable identifier for the business node, so the graph can point at it from
// more than one place without repeating the whole object. The trailing #hash
// makes it a fragment of the site rather than a second page.
const BUSINESS_ID = () => absoluteUrl('/#business')

export function buildBusinessSchema() {
    return {
        '@type': 'Campground',
        '@id': BUSINESS_ID(),
        name: SITE_NAME,
        legalName: BUSINESS.legalName,
        description: BUSINESS.description,
        url: absoluteUrl('/'),
        telephone: BUSINESS.telephone,
        email: BUSINESS.email,
        image: absoluteUrl(OG_IMAGE.path),
        priceRange: BUSINESS.priceRange,
        address: {
            '@type': 'PostalAddress',
            streetAddress: BUSINESS.address.street,
            addressLocality: BUSINESS.address.locality,
            addressRegion: BUSINESS.address.region,
            addressCountry: BUSINESS.address.country,
        },
        geo: {
            '@type': 'GeoCoordinates',
            latitude: BUSINESS.geo.latitude,
            longitude: BUSINESS.geo.longitude,
        },
        hasMap: BUSINESS.mapUrl,
        // Spelled out day by day rather than as a range: Google's parser accepts
        // an array of days on one specification, and every day is the same here.
        openingHoursSpecification: [{
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: [
                'Monday', 'Tuesday', 'Wednesday', 'Thursday',
                'Friday', 'Saturday', 'Sunday',
            ],
            opens: BUSINESS.openingHours.opens,
            closes: BUSINESS.openingHours.closes,
        }],
        sameAs: BUSINESS.social,
    }
}

export function buildWebSiteSchema() {
    return {
        '@type': 'WebSite',
        '@id': absoluteUrl('/#website'),
        name: SITE_NAME,
        url: absoluteUrl('/'),
        publisher: { '@id': BUSINESS_ID() },
        inLanguage: 'en-PH',
    }
}

// Only ever called for a page that is not the home page: a breadcrumb trail
// whose only entry is the page you are already on tells a crawler nothing and
// renders as a stray "Home >" in the result.
export function buildBreadcrumbSchema(route) {
    if (!route || route.path === '/') return null

    return {
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: absoluteUrl('/'),
            },
            {
                '@type': 'ListItem',
                position: 2,
                // The tab title, not the SEO title: a breadcrumb reading
                // "Food Menu | Camp Ba-long Nature Farm & Resort" is absurd.
                name: route.breadcrumb || route.title.split('|')[0].trim(),
                item: absoluteUrl(route.path),
            },
        ],
    }
}

// Built from the questions actually on screen, which is why it takes them as an
// argument instead of importing the store: this module is also loaded by the
// build scripts, where there is no Supabase connection and no React to hold a
// subscription. The home page passes in whatever useFaqSection() resolved to,
// so an FAQ staff added this morning is described correctly this afternoon.
//
// Returns null below three questions. An FAQPage carrying one entry is
// technically valid and never earns the expanded result, so it is noise.
export function buildFaqSchema(faqs) {
    if (!Array.isArray(faqs) || faqs.length < 3) return null

    return {
        '@type': 'FAQPage',
        mainEntity: faqs
            .filter((faq) => faq?.question && faq?.answer)
            .map((faq) => ({
                '@type': 'Question',
                name: faq.question,
                acceptedAnswer: { '@type': 'Answer', text: faq.answer },
            })),
    }
}

/**
 * Assemble the page's nodes into one @graph.
 *
 * One script holding a graph rather than three separate scripts, so the nodes
 * can reference each other by @id — that is how the WebSite says who publishes
 * it without describing the business a second time. Falsy entries are dropped,
 * which is what lets the callers above return null for "not applicable".
 */
export function buildGraph(nodes) {
    const graph = nodes.filter(Boolean)
    if (graph.length === 0) return null
    return { '@context': 'https://schema.org', '@graph': graph }
}
