# Deploying Camp Ba-long

The build produces a folder of static files. There is no server-side code, so
any static host will serve it — but two settings decide whether the site is
indexable, and both are easy to get wrong in a way nothing visibly complains
about.

## Moving the site to a new domain

Every canonical link, every `<loc>` in `sitemap.xml`, the `Sitemap:` line in
`robots.txt` and the Facebook share image are absolute URLs built from one
constant. Changing the domain means changing that constant:

```js
// src/lib/seoConfig.js
export const SITE_ORIGIN = 'https://your-real-domain.com'   // no trailing slash
```

That is the whole procedure. Commit it and redeploy — `npm run build`
regenerates `dist/robots.txt`, `dist/sitemap.xml` and all five pages' tags
against the new address. Upload `dist/` and the two files are already correct;
they are build output, so there is nothing to hand-edit and nothing to keep in
sync afterwards.

**`VITE_SITE_ORIGIN` is not read by anything.** It used to override the
constant, and twice that indirection is what shipped a broken share image — the
Vercel project has it set to `campba-long.vercel.app` while the site is served
from `camp-ba-long.vercel.app`, one hyphen apart, and the env var won. The
override was removed. If the variable is still set in the hosting provider's
settings at build time the script now prints a yellow warning saying it is being
ignored; delete it so the two cannot disagree again.

### Check it actually took

After the deploy, against the new domain:

```bash
curl -s https://your-real-domain.com/robots.txt
curl -s https://your-real-domain.com/sitemap.xml
curl -I https://your-real-domain.com/urlimage.jpg
```

The first two must name the new domain, not the old one. The third is the share
image and must return `200` with `image/jpeg` — a 404 there is why a Messenger
link preview arrives with no picture, and nothing on the site itself hints at
why.

Then submit `https://your-real-domain.com/sitemap.xml` in Google Search Console.
Leave the old address serving until the new one is indexed: its canonical tags
now point at the new domain, which is what moves the ranking across rather than
splitting it.

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
