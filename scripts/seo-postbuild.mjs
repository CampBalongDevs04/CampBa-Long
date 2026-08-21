// ============================================================================
//  Everything a crawler needs that Vite does not produce on its own.
// ----------------------------------------------------------------------------
//  Runs after `vite build`, over dist/. Three jobs, one script, because all
//  three read the same route table and all three are meaningless without a
//  finished bundle to sit beside:
//
//    1. dist/robots.txt    who may crawl, and where the sitemap is
//    2. dist/sitemap.xml   the five public URLs
//    3. dist/<route>/index.html
//                          the same shell Vite emitted, with THAT route's
//                          title, description and Open Graph tags baked in
//
//  WHY (3) EXISTS AT ALL
//  ---------------------
//  This is a single-page app: the server sends one HTML file with an empty
//  <div id="root"> and JavaScript fills it in. Googlebot renders JavaScript and
//  copes. The crawlers behind a link preview — Facebook, Messenger, Viber,
//  Twitter — do not, and never have. They fetch the URL, parse the raw HTML,
//  read og:title and og:image, and give up. For a resort that gets shared in
//  Messenger threads more than it gets searched for, a link preview showing a
//  bare URL is the difference between a booking and a scroll past.
//
//  So every route gets a real file on disk with its own tags already in it.
//  The client-side <Seo> component then owns the head from the first
//  navigation onward — see the note at the top of components/Seo.jsx for why
//  it replaces these tags rather than adding to them.
//
//  WHY NOT A HEADLESS BROWSER
//  --------------------------
//  Prerendering the BODY too — running the app in Playwright and saving the
//  resulting DOM — would be the fuller answer, and playwright-core is on hand
//  as a devDependency. It is not what this does, deliberately: every page reads
//  live availability, prices and menus out of Supabase, so a snapshotted body
//  is a price list frozen at build time, served to guests until the next
//  deploy. Stale prices are a worse problem than slow indexing. The head is
//  safe to freeze because it is the one part that does not come from the
//  database (see the note in lib/seoConfig.js).
// ============================================================================

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ROUTES, SITE_ORIGIN, absoluteUrl, OG_IMAGE } from '../src/lib/seoConfig.js'
import {
    buildBusinessSchema,
    buildWebSiteSchema,
    buildBreadcrumbSchema,
    buildGraph,
} from '../src/lib/structuredData.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')

// ----------------------------------------------------------------------------
//  Guards — fail loudly rather than emitting a subtly wrong site.
// ----------------------------------------------------------------------------

if (!existsSync(join(DIST, 'index.html'))) {
    console.error('\n[seo] dist/index.html is missing. Run `vite build` first.\n')
    process.exit(1)
}

// The origin in seoConfig.js is what every canonical link, every sitemap <loc>
// and the og:image URL are built from, and getting it wrong leaves no trace in
// dist/: the tags are all present and well-formed, they just name the wrong
// site. A wrong canonical is worse than a missing one — it tells Google the
// real page is a copy of somebody else's.
//
// Warnings rather than errors, because building against a domain that is not
// live yet has to stay possible. They are loud enough to notice.

if (SITE_ORIGIN.includes('example')) {
    console.warn(
        `\n\x1b[33m[seo] Building with the placeholder domain ${SITE_ORIGIN}.\x1b[0m\n` +
        `Canonical links, the sitemap and the share image all point there.\n` +
        `Set the real domain by editing SITE_ORIGIN in src/lib/seoConfig.js.\n`,
    )
}

// The trap below is the one that has already cost this site its share image
// twice. SITE_ORIGIN used to fall back to VITE_SITE_ORIGIN; that indirection
// shipped the wrong host, so the fallback was removed — but a stale
// VITE_SITE_ORIGIN can still be sitting in Vercel's project settings, and
// anyone moving the site to a new domain will very reasonably set it there,
// deploy, and get a sitemap full of the OLD address with nothing complaining.
//
// So if the environment names a different origin than the file does, say
// plainly which one won.
const envOrigin = process.env.VITE_SITE_ORIGIN?.replace(/\/$/, '')
if (envOrigin && envOrigin !== SITE_ORIGIN) {
    console.warn(
        `\n\x1b[33m[seo] VITE_SITE_ORIGIN is set to ${envOrigin} — and is being ignored.\x1b[0m\n` +
        `Nothing reads that variable any more. This build is for ${SITE_ORIGIN},\n` +
        `taken from SITE_ORIGIN in src/lib/seoConfig.js. Edit that one line to\n` +
        `change the domain, then delete the variable so the two cannot disagree.\n`,
    )
}

// The sitemap can only be as complete as the table it is generated from, and
// that failure is silent in the worst way: add a public route to App.jsx,
// forget seoConfig.js, and the page is live, linked, and invisible to every
// crawler forever. Nothing about dist/ looks wrong — the sitemap is valid, it
// is just short by one URL.
//
// App.jsx keeps its own PUBLIC_PATHS set (it needs one before seoConfig.js is
// in the bundle graph), which makes the two lists the thing to compare.
//
// Parsed with a regex over source, which is only defensible because the target
// is one literal line in one file in this repo. If it stops matching that is
// reported as a SKIPPED check rather than a passed one — a guard that quietly
// stops guarding is worse than no guard at all.
function assertRoutesMatchApp() {
    const source = readFileSync(join(ROOT, 'src', 'App.jsx'), 'utf8')
    const literal = source.match(/const PUBLIC_PATHS = new Set\(\[([^\]]*)\]\)/)

    if (!literal) {
        console.warn(
            `\n\x1b[33m[seo] Could not find PUBLIC_PATHS in src/App.jsx.\x1b[0m\n` +
            `The sitemap was NOT checked against the app's routes. Either the set\n` +
            `was renamed or it is no longer written on one line — fix the regex in\n` +
            `scripts/seo-postbuild.mjs so this check does its job again.\n`,
        )
        return
    }

    const appPaths = [...literal[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    const routePaths = ROUTES.map((route) => route.path)

    const missing = appPaths.filter((path) => !routePaths.includes(path))
    const stale = routePaths.filter((path) => !appPaths.includes(path))

    if (missing.length || stale.length) {
        throw new Error([
            'src/App.jsx and the ROUTES table in src/lib/seoConfig.js disagree.',
            '',
            ...missing.map((p) => `  ${p} is a public route with no entry in ROUTES — it would be missing from the sitemap and served the home page's tags.`),
            ...stale.map((p) => `  ${p} is in ROUTES but is not a route in App.jsx — the sitemap would advertise a URL that 404s.`),
            '',
            'Add the missing entry (title, description, priority, changefreq), or remove the stale one.',
        ].join('\n'))
    }
}

// ----------------------------------------------------------------------------
//  1. robots.txt
// ----------------------------------------------------------------------------
//  The dashboard is deliberately NOT listed here. robots.txt is public, so a
//  Disallow line naming the admin URL would publish the one thing that URL's
//  security depends on staying unguessable. It is kept out of the index by a
//  noindex tag the page adds to itself instead — see App.jsx.

async function writeRobots() {
    const body = [
        '# Camp Ba-long Nature Farm & Resort',
        '# Generated by scripts/seo-postbuild.mjs — edit that, not this file.',
        '',
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
        '',
    ].join('\n')

    await writeFile(join(DIST, 'robots.txt'), body, 'utf8')
    return 'robots.txt'
}

// ----------------------------------------------------------------------------
//  2. sitemap.xml
// ----------------------------------------------------------------------------

// lastmod is the build date, which is a claim this script cannot actually
// verify — the copy on /spa may not have changed in a year. Search engines
// treat lastmod as a hint and discount it when it looks like every URL changed
// at once, so this is honest enough to be useful and not relied on.
const BUILD_DATE = new Date().toISOString().slice(0, 10)

async function writeSitemap() {
    const urls = ROUTES.map((route) => [
        '    <url>',
        `        <loc>${absoluteUrl(route.path)}</loc>`,
        `        <lastmod>${BUILD_DATE}</lastmod>`,
        `        <changefreq>${route.changefreq}</changefreq>`,
        `        <priority>${route.priority}</priority>`,
        '    </url>',
    ].join('\n')).join('\n')

    const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        urls,
        '</urlset>',
        '',
    ].join('\n')

    await writeFile(join(DIST, 'sitemap.xml'), xml, 'utf8')
    return 'sitemap.xml'
}

// ----------------------------------------------------------------------------
//  3. Per-route HTML
// ----------------------------------------------------------------------------

// Attribute values go inside double quotes, so those must go — and & must go
// first or it would re-escape the ampersands the other replacements introduce.
// "Camp Ba-long Nature Farm & Resort" is the string that makes this necessary.
function escapeAttr(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

// Swap the content="" of one <meta>, matched on its name= or property=.
//
// Regex over HTML is usually a mistake. It is safe in this one case because the
// input is not arbitrary HTML — it is dist/index.html, generated by Vite from a
// template in this repo, where every one of these tags is written on a single
// line in a known shape. If a tag is missing the replacement is a no-op, which
// is why writeHtml() checks afterwards that the title actually changed.
function replaceMeta(html, attr, key, value) {
    const pattern = new RegExp(
        `(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`,
        'i',
    )
    return html.replace(pattern, `$1${escapeAttr(value)}$2`)
}

function replaceTitle(html, title) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(title)}</title>`)
}

function replaceCanonical(html, href) {
    return html.replace(
        /(<link\s+rel="canonical"\s+href=")[^"]*(")/i,
        `$1${escapeAttr(href)}$2`,
    )
}

// The same graph components/Seo.jsx builds, minus the FAQPage: the questions
// live in Supabase and this script has no connection to it. The client adds
// that node once the store resolves, and Googlebot runs the JavaScript that
// does so — it is the link-preview crawlers that cannot, and they read Open
// Graph, not JSON-LD. Nothing is lost by leaving it out here.
function jsonLdFor(route) {
    const graph = buildGraph([
        buildBusinessSchema(),
        buildWebSiteSchema(),
        buildBreadcrumbSchema(route),
    ])
    if (!graph) return ''
    // </script> inside a JSON string would close this tag early. It cannot
    // happen with today's values, but the values are editable.
    const json = JSON.stringify(graph).replace(/<\//g, '<\\/')
    return `    <script id="seo-structured-data" type="application/ld+json">${json}</script>\n`
}

async function writeHtml(template, route) {
    const canonical = absoluteUrl(route.path)
    const image = absoluteUrl(OG_IMAGE.path)

    let html = template
    html = replaceTitle(html, route.title)
    html = replaceCanonical(html, canonical)
    html = replaceMeta(html, 'name', 'description', route.description)
    html = replaceMeta(html, 'property', 'og:type', route.path === '/' ? 'website' : 'article')
    html = replaceMeta(html, 'property', 'og:title', route.title)
    html = replaceMeta(html, 'property', 'og:description', route.description)
    html = replaceMeta(html, 'property', 'og:url', canonical)
    html = replaceMeta(html, 'property', 'og:image', image)
    // Redundant for anything written this decade — og:image is already https —
    // but Viber's scraper is old and reads secure_url in preference. It costs a
    // line and it is the difference between a preview with a picture and one
    // without on the app this resort's guests actually share links in.
    html = replaceMeta(html, 'property', 'og:image:secure_url', image)
    html = replaceMeta(html, 'name', 'twitter:title', route.title)
    html = replaceMeta(html, 'name', 'twitter:description', route.description)
    html = replaceMeta(html, 'name', 'twitter:image', image)

    // Inserted rather than replaced: index.html carries no JSON-LD of its own,
    // because it would have to be the home page's and every other route would
    // then have to strip it back out.
    html = html.replace('</head>', `${jsonLdFor(route)}  </head>`)

    // A silent no-op is the failure mode these replacements have — someone
    // reformats index.html, a pattern stops matching, and every page ships with
    // the home page's title. Cheap to catch, so catch it.
    if (route.path !== '/' && !html.includes(`<title>${escapeAttr(route.title)}</title>`)) {
        throw new Error(
            `Could not write the title for "${route.path}". The <head> in index.html no ` +
            `longer matches what scripts/seo-postbuild.mjs expects — check that its ` +
            `<title>, canonical <link> and <meta> tags are each on one line.`,
        )
    }

    // "/" is dist/index.html; "/menu" is dist/menu/index.html.
    //
    // A directory with an index.html in it, rather than a flat dist/menu.html,
    // because that shape is what every static host resolves for a request to
    // "/menu" without any configuration — and, importantly, what it serves in
    // PREFERENCE to the SPA catch-all rewrite. A flat file would need
    // host-specific "clean URL" settings to be found at all.
    const outPath = route.path === '/'
        ? join(DIST, 'index.html')
        : join(DIST, route.path.replace(/^\//, ''), 'index.html')

    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath, html, 'utf8')
    return outPath.slice(DIST.length + 1).replace(/\\/g, '/')
}

// ----------------------------------------------------------------------------

async function main() {
    // Before anything is written: a sitemap missing a page is the one failure
    // here that leaves nothing behind in dist/ to notice it by.
    assertRoutesMatchApp()

    // Read once, before the first write — writeHtml() overwrites
    // dist/index.html, and every later route would otherwise be built from the
    // home page's already-substituted head instead of the pristine template.
    const template = await readFile(join(DIST, 'index.html'), 'utf8')

    const written = [
        await writeRobots(),
        await writeSitemap(),
    ]
    for (const route of ROUTES) {
        written.push(await writeHtml(template, route))
    }

    console.log(`\n[seo] ${SITE_ORIGIN}`)
    for (const file of written) console.log(`[seo]   dist/${file}`)
    console.log('')
}

main().catch((error) => {
    console.error(`\n[seo] Failed: ${error.message}\n`)
    process.exit(1)
})
