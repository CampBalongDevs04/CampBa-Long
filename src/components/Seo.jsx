// ============================================================================
//  Camp Ba-long — the <head> of whichever page the guest is looking at
// ----------------------------------------------------------------------------
//  Renders nothing. Each public page mounts one of these and it writes that
//  page's title, description, canonical link, social tags and JSON-LD into the
//  document head, then rewrites them when the guest navigates somewhere else.
//
//  WHY IT WRITES TAGS INSTEAD OF RENDERING THEM
//  --------------------------------------------
//  React 19 can hoist a <title> or <meta> rendered anywhere in the tree up into
//  the head, and that is the obvious way to write this component. It is the
//  wrong one here, because hoisting APPENDS. scripts/prerender.mjs bakes this
//  same set of tags into the HTML the server sends — it has to, since the
//  crawlers that matter for a link preview never run JavaScript — so hoisting
//  would leave every page carrying two <title> elements and two descriptions,
//  and a page with two descriptions is a page whose description Google picks
//  for itself.
//
//  Upserting by selector has exactly one outcome instead: the tag the
//  prerender wrote is found and its content replaced. One of each, always,
//  whether or not the prerender ran.
//
//  WHAT IT DOES NOT DO
//  -------------------
//  It does not remove its tags on unmount. There is no moment when the site
//  wants a head with no title, and every route mounts a <Seo> that overwrites
//  all of them — so a teardown would only open a window where the head is
//  briefly empty. The one exception is JSON-LD, which is per-page and IS
//  cleared, because a stale FAQPage on the spa page describes the wrong page.
// ============================================================================

import { useEffect } from 'react'
import {
    ROUTES_BY_PATH,
    SITE_NAME,
    DEFAULT_LOCALE,
    OG_IMAGE,
    absoluteUrl,
} from '../lib/seoConfig.js'
import {
    buildBusinessSchema,
    buildWebSiteSchema,
    buildBreadcrumbSchema,
    buildGraph,
} from '../lib/structuredData.js'

// Marks every element this component owns. Nothing reads it at runtime — it is
// there so that whoever opens devtools on a head with twenty tags in it can see
// which four came from the CMS-driven page and which came from index.html.
const OWNED = 'data-seo'
const JSON_LD_ID = 'seo-structured-data'

// Find the tag or make it. `key` is the value of name= or property=, and
// `attr` says which of the two, because Open Graph uses property= and
// everything else uses name= — mixing them up is the usual reason a share
// preview comes back blank.
function upsertMeta(attr, key, content) {
    if (content == null || content === '') return
    const selector = `meta[${attr}="${key}"]`
    let tag = document.head.querySelector(selector)
    if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute(attr, key)
        tag.setAttribute(OWNED, '')
        document.head.appendChild(tag)
    }
    tag.setAttribute('content', String(content))
}

function upsertLink(rel, href) {
    if (!href) return
    let tag = document.head.querySelector(`link[rel="${rel}"]`)
    if (!tag) {
        tag = document.createElement('link')
        tag.setAttribute('rel', rel)
        tag.setAttribute(OWNED, '')
        document.head.appendChild(tag)
    }
    tag.setAttribute('href', href)
}

function writeJsonLd(graph) {
    const existing = document.getElementById(JSON_LD_ID)
    if (!graph) {
        existing?.remove()
        return
    }
    const tag = existing || document.createElement('script')
    if (!existing) {
        tag.id = JSON_LD_ID
        tag.type = 'application/ld+json'
        document.head.appendChild(tag)
    }
    // textContent, never innerHTML: the values come from the CMS, and a
    // question mark somebody typed as "<3" would otherwise be parsed as markup
    // and silently truncate the whole block.
    tag.textContent = JSON.stringify(graph)
}

/**
 * @param {string}   path        The route's pathname — must match a ROUTES entry.
 * @param {boolean}  noindex     Keep this page out of the index entirely.
 * @param {object[]} extraSchema Extra JSON-LD nodes (the home page's FAQPage).
 * @param {string}   title       Override, for a page whose title is not static.
 * @param {string}   description Override, same reason.
 */
function Seo({ path, noindex = false, extraSchema = [], title, description }) {
    const route = ROUTES_BY_PATH[path]

    // Serialised so the effect re-runs when the FAQ store resolves and the
    // schema's contents actually change, rather than on every render because a
    // fresh array literal is never === the last one.
    const extraKey = JSON.stringify(extraSchema)

    useEffect(() => {
        // A page can be described either by its entry in the route table or by
        // props — the 404 has no entry, because a route table is a list of
        // pages that exist. With neither, this is a bug in the caller and not a
        // reason to write a half-built head: say so where a developer will see
        // it and leave whatever the prerender wrote in place.
        const pageTitle = title || route?.title
        const pageDescription = description || route?.description
        if (!pageTitle) {
            console.warn(`[Seo] No metadata for "${path}". Add it to lib/seoConfig.js.`)
            return
        }

        const image = absoluteUrl(OG_IMAGE.path)

        document.title = pageTitle
        upsertMeta('name', 'description', pageDescription)
        upsertMeta('name', 'robots', noindex
            ? 'noindex, nofollow'
            // max-image-preview:large is what allows a photo beside the result
            // instead of a thumbnail, and it is the whole reason to spell this
            // out rather than leave the default.
            : 'index, follow, max-image-preview:large, max-snippet:-1')

        // Only a real page gets a canonical URL. Pointing the 404 at itself
        // would invite the very indexing its noindex is there to prevent, and
        // pointing it at the home page would tell Google the two are the same
        // page — which is how a mistyped URL ends up ranking as the home page.
        const canonical = route ? absoluteUrl(route.path) : null
        if (canonical) {
            upsertLink('canonical', canonical)
        } else {
            document.head.querySelector('link[rel="canonical"]')?.remove()
        }

        upsertMeta('property', 'og:type', route?.path === '/' ? 'website' : 'article')
        upsertMeta('property', 'og:site_name', SITE_NAME)
        upsertMeta('property', 'og:title', pageTitle)
        upsertMeta('property', 'og:description', pageDescription)
        upsertMeta('property', 'og:url', canonical || absoluteUrl(path || '/'))
        upsertMeta('property', 'og:locale', DEFAULT_LOCALE)
        upsertMeta('property', 'og:image', image)
        upsertMeta('property', 'og:image:secure_url', image)
        upsertMeta('property', 'og:image:type', OG_IMAGE.type)
        upsertMeta('property', 'og:image:width', OG_IMAGE.width)
        upsertMeta('property', 'og:image:height', OG_IMAGE.height)
        upsertMeta('property', 'og:image:alt', OG_IMAGE.alt)

        upsertMeta('name', 'twitter:card', 'summary_large_image')
        upsertMeta('name', 'twitter:title', pageTitle)
        upsertMeta('name', 'twitter:description', pageDescription)
        upsertMeta('name', 'twitter:image', image)
        upsertMeta('name', 'twitter:image:alt', OG_IMAGE.alt)

        // A page nobody should index is a page nobody should read the schema of
        // either — describing it only invites it into a knowledge panel.
        writeJsonLd(noindex ? null : buildGraph([
            buildBusinessSchema(),
            buildWebSiteSchema(),
            buildBreadcrumbSchema(route),
            ...JSON.parse(extraKey),
        ]))
    }, [route, path, noindex, title, description, extraKey])

    return null
}

export default Seo
