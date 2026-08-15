# Deploying Camp Ba-long

The build produces a folder of static files. There is no server-side code, so
any static host will serve it — but two settings decide whether the site is
indexable, and both are easy to get wrong in a way nothing visibly complains
about.

## Before the first production deploy

Set the real domain. Until this is done, every canonical link, the sitemap and
the Facebook share image all point at `https://www.example-campbalong.com`,
which nobody owns. `npm run build` prints a yellow warning whenever it is still
the placeholder.

Either set an environment variable in the hosting provider:

```bash
VITE_SITE_ORIGIN=https://your-real-domain.com
```

…or edit `SITE_ORIGIN` in [`src/lib/seoConfig.js`](../src/lib/seoConfig.js).

Vite inlines environment variables at **build** time. Setting this after a build
has already run changes nothing until the next one.

The Supabase and admin-path variables in `.env.example` are required too — the
build refuses to run without them. See the header of `vite.config.js`.

## Pick one config file and delete the other two

This repo ships config for three hosts so that whichever one is chosen works
without research. Keep the one you use and delete the rest — three configs that
disagree is worse than none.

| Host | File | Notes |
|---|---|---|
| Vercel | `vercel.json` | `cleanUrls` serves `/menu` from `dist/menu/index.html`. |
| Netlify | `netlify.toml` | Build command and publish directory are in the file. |
| nginx / Apache / cPanel | neither — see below | Copy `dist/` to the web root. |

### nginx

```nginx
server {
    root /var/www/campbalong/dist;

    # $uri/ is the important part: it finds dist/menu/index.html for a request
    # to /menu, so the crawler gets the menu page's own tags rather than the
    # home page's. Without it every route falls through to the SPA shell.
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

## The two settings that matter

**1. The SPA fallback.** A request for `/booking` has to be answered with HTML
rather than a 404, because there is no `booking` file in the traditional sense.
Every config above does this.

**2. Real files must win over the fallback.** `npm run build` writes
`dist/menu/index.html`, `dist/spa/index.html` and so on — each carrying that
page's own `<title>` and `og:image`. This exists because Facebook, Messenger and
Viber read link previews out of the raw HTML and never run JavaScript, so a
blanket "serve index.html for everything" rule gives every shared link the home
page's title and picture.

All three configs are written so the static file is preferred. The specific
trap is Netlify's force flag: `/* /index.html 200!` with an exclamation mark
overrides real files and would quietly undo this.

### Vercel: the fallback destination is `/`, not `/index.html`

`vercel.json` sets `cleanUrls: true`, which makes `.html` URLs non-canonical —
a request for `/index.html` answers `308 Permanent Redirect` to `/`. A rewrite
pointing at `/index.html` therefore resolves to nothing, and every route
without a prerendered file — the staff dashboard among them — returns Vercel's
`NOT_FOUND` page. The home page and `/menu` keep working the whole time,
because those are real files, so the site looks deployed.

`vercel.json` is strict JSON and cannot hold a comment saying so, which is why
this paragraph exists. Netlify is unaffected: it has no `cleanUrls` equivalent,
so `netlify.toml` correctly keeps `to = "/index.html"`.

## Verifying a deploy

```bash
curl -s https://your-domain.com/menu | grep -E "<title>|og:title"
```

That should print the **menu** page's title. If it prints the home page's, real
files are not winning over the fallback — re-read the section above.

Then:

- `https://your-domain.com/robots.txt` — should list the sitemap URL
- `https://your-domain.com/sitemap.xml` — should list five URLs on the real domain
- Paste a URL into the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
  and the [Rich Results Test](https://search.google.com/test/rich-results)

Finally, submit the sitemap once in Google Search Console. Nothing in the build
does that, and without it a brand-new domain can wait weeks to be crawled.
