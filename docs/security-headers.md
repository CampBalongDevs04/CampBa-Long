# Security headers

Set identically in [`vercel.json`](../vercel.json) (the live target) and
[`netlify.toml`](../netlify.toml). Two hosts answering the same site with
different security postures is worse than either one alone, so change both or
neither.

Before this, both files set cache headers only. The staff login was framable —
clickjackable — and with no CSP, any injected script had free rein over the
owner token in `localStorage` and a staff Supabase session.

## What is enforced today

| Header | Value | What it stops |
|---|---|---|
| `X-Frame-Options` | `DENY` | Framing the staff login and clickjacking it. Enforced immediately — unlike CSP's `frame-ancestors`, it is not weakened by the policy being Report-Only. |
| `X-Content-Type-Options` | `nosniff` | A browser deciding an uploaded file is really a script. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Leaking booking-page URLs to third parties. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Downgrade and cookie-stripping attacks. |
| `Permissions-Policy` | camera/mic/geo/payment/usb all `()` | Nothing here needs those; an injected script can't ask either. |
| `Cross-Origin-Opener-Policy` | `same-origin` | Cross-window references from anything we open. |

`preload` is deliberately **not** on the HSTS header. It is a one-way door: it
needs a submission at [hstspreload.org](https://hstspreload.org) and commits
every present and future subdomain to HTTPS more or less permanently. Add it as
its own decision.

## The CSP is Report-Only on purpose

Crisp's `l.js` bootstraps hosts that appear nowhere in this repository, and the
CMS lets staff point `image_url` and the GCash `qrUrl` at any host they like. A
policy written blind would have taken the live chat or the booking page's images
down. Report-Only reports violations and blocks nothing.

Two directives do nothing while the header is Report-Only, both deliberately:

* `frame-ancestors` — which is exactly why `X-Frame-Options: DENY` is set
  separately and is doing the real work today.
* `upgrade-insecure-requests` — the console will say it is *ignored* in
  Report-Only. That message is expected. It is not a violation to chase.

### Two loose directives, on purpose

* **`style-src 'unsafe-inline'`** — 30 React `style={{…}}` props render as inline
  `style` attributes, and Crisp injects its own `<style>` for the launcher.
  Tightening this is a refactor of those 30 usages, not a config change.
* **`img-src https:`** — `image_url` and `qrUrl` are staff-entered free text. A
  host allowlist would silently blank out CMS photos the day someone uses a new
  host, and an `<img>` tag is not a script.

`script-src` is kept tight (`'self'` plus `https://client.crisp.chat` only) —
that is the directive that actually matters, and Report-Only will tell us if
Crisp needs more rather than us guessing wide.

## Checklist before flipping to enforcing

Open DevTools → Console on a **deployed preview** (not `npm run dev` — Vite's
dev server does not serve these headers) and walk each of these, watching for
`[Report Only]` violations. Note the blocked URI and the directive for each.

1. **`/`** — let the Crisp launcher load and open the chat. `l.js` pulls from
   hosts it does not declare; the policy allows `*.crisp.chat` for `connect-src`
   and `frame-src`, but if a violation names a Crisp host under **`script-src`**,
   add that exact host — do not widen `script-src` to `*.crisp.chat`.
2. **`/booking`** — pick dates, pick a unit, fill in guest details, press
   Reserve. Watch `connect-src` for the Supabase REST call and the `wss://`
   Realtime subscriptions.
3. **`/my-booking`** — upload a receipt and confirm the `blob:` preview renders
   (`img-src blob:`) and the Storage `POST` is not reported.
4. **Contact form** — submit it. `api.emailjs.com` under `connect-src`.
5. **Location section** — the `maps.google.com` iframe, which Google redirects to
   `www.google.com/maps/embed`. Both are allowed; confirm neither is reported.
6. **Staff dashboard** (the path in `VITE_ADMIN_PATH`) — log in, open the receipt
   viewer (signed URLs from the Supabase origin), run the XLSX export (`blob:`),
   and upload a CMS image.
7. **View source on a prerendered route** (e.g. `/menu`) — the
   `application/ld+json` block injected by `scripts/seo-postbuild.mjs` should
   draw no `script-src` report. It is a data block, not executable JS, but it is
   worth confirming per-browser.

When a full pass is clean, rename the header in **both** files:

```
Content-Security-Policy-Report-Only  →  Content-Security-Policy
```

The value does not change. If something breaks after the flip, renaming it back
is a one-line revert.

## If the Supabase project ever moves

The origin is hardcoded in both files
(`https://gxjhrtejzbpjtjedbtxl.supabase.co`, plus the `wss://` form for
Realtime) because a static header cannot read `VITE_SUPABASE_URL`. Change the
project ref and the site loses every API call with a `connect-src` violation —
update both files in the same commit as the env var.
