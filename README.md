# Camp Ba-long — booking site

React + Vite front end for the Camp Ba-long resort, backed by Supabase
(Postgres + Auth + Storage).

---

## Setup for a fresh clone

```bash
npm install
```

**Then create your `.env` — the app cannot talk to the database without it.**

```bash
cp .env.example .env
```

Open `.env` and fill in both values:

| Variable | Where it comes from |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | same page → the **publishable** (`sb_publishable_…`) key |

`.env` is gitignored on purpose, so **cloning the repo does not give you the
keys**. Ask a teammate for them, or copy them from the Supabase dashboard if
you have access to the project. Never put the `service_role` key here — it
bypasses every security policy and would be shipped inside the browser bundle.

```bash
npm run dev
```

If the keys are missing, `npm run dev` prints a yellow warning in the terminal
and every page shows a red "Not connected to the database" banner. `npm run
build` refuses to run at all — see [Why the build fails](#why-the-build-fails-instead-of-warning).

---

## Troubleshooting

### "Could not upload your receipt" / the receipt image won't load

This is almost always a **missing `.env`**, and it is confusing because the
site looks completely healthy until you hit it:

- The accommodation list and the food/spa menus have built-in fallback values, so
  every card still renders.
- The whole booking form still works — dates, units, guest details.
- Nothing fails visibly until the guest submits a payment in My Bookings, where
  the upload dies with a bare `Failed to fetch` that reads like a broken storage
  bucket.

**Check, in order:**

1. Does `.env` exist in the project root (not in `src/`)? Does it have both
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`?
2. **Restart the dev server.** Vite only reads `.env` at startup — editing it
   while the server is running changes nothing.
3. Look at the terminal where `npm run dev` is running. A yellow
   `[Camp Ba-long] Supabase is not configured` warning means the file is still
   not being picked up.
4. Look at the top of any page. A red banner means the same thing.

If the banner is **absent** and uploads still fail, it is a real backend
problem — read the error text, it now comes straight from Supabase.

### The receipt viewer says "Object not found" in the admin dashboard

Receipts live in a **private** bucket that only staff can read, by design. This
message means the signed-in account is not on the staff roster. Add it:

```sql
insert into public.staff (user_id, full_name)
select id, 'Their Name' from auth.users where email = 'them@example.com';
```

(Signing in is deliberately not the same as being staff — see
`supabase/migrations/*_staff_only_booking_access.sql`.)

### "This account is not authorised for the dashboard."

Same cause as above: a valid login that is not on the staff roster.

---

## How payment works

Paying happens **after** the booking, not during it. The booking form ends at
"Reserve & Proceed to Payment", which holds a unit and drops the guest into My
Bookings with the payment panel open.

That ordering is the point. When payment came first, nothing was reserved while
the guest was away in their banking app — the last unit could be taken from
under them after the money had already been sent. It also made it impossible for
food and spa to be part of the down payment, because add-ons attach to a booking
that did not exist yet.

**The down payment is 50% of the whole stay:**

```
50% × (unit rate + entrance fees + food orders + spa services)
```

`bookings.downpayment` is a **generated column** computing exactly that, so the
amount the guest is asked for and the amount staff verify cannot drift apart —
and ordering a meal after the booking moves the figure on its own. Entrance fees
are therefore **half prepaid**; only the remaining half is settled on-site.

## How receipts work

1. The guest picks a screenshot in the My Bookings payment panel.
2. `uploadReceipt()` puts it in the private `receipts` bucket under a **random**
   folder and returns the path. This runs *before* the row is touched, so a
   failed upload is never recorded as a payment received.
3. `pay_my_booking()` stores the path in `receipt_url` and appends an entry to
   `receipt_uploads` stamped with the amount that was due at that moment.
4. Staff open the receipt viewer, which mints a **signed URL valid for 5
   minutes** — the image is never public.

Add-ons ordered *after* a payment raise the total, so a guest can submit more
than one receipt. Each is kept in `receipt_uploads` with its own amount — the
second screenshot never overwrites the proof of the first — and the panel asks
only for the difference. The viewer shows the latest image and says how many
there are.

Anonymous guests may upload but may **not** read, list, overwrite or delete.
That is why the guest side cannot fetch back the image it just uploaded; it is
the intended behaviour, not a bug. See
`supabase/migrations/20260727090829_receipt_storage.sql`.

More detail on the data layer: [`src/data/README-accommodation.md`](src/data/README-accommodation.md).

---

## Deploying

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in your hosting
provider's environment-variable settings, then redeploy.

Set `VITE_SITE_ORIGIN` to the real domain at the same time. Until it is set,
every canonical link, the sitemap and the Facebook share image point at a
placeholder domain — `npm run build` prints a yellow warning while that is
still the case.

**[`docs/deployment.md`](docs/deployment.md) is the full guide**: which of
`vercel.json` / `netlify.toml` / the nginx snippet to keep, the one routing
setting that silently breaks link previews if it is wrong, and how to check a
deploy actually worked.

### Why the build fails instead of warning

Vite inlines `VITE_*` variables into the JavaScript bundle at **build** time,
not run time. A build produced without them is permanently broken — the values
are baked in, and setting them on the server afterwards fixes nothing. So
`npm run build` fails fast rather than shipping a dead bundle. `npm run dev`
only warns, so the front end can still be worked on offline.

---

## Database

Migrations live in `supabase/migrations/` and are applied with the Supabase
CLI:

```bash
npx supabase db push
```

The publishable key is safe in the browser because every table is protected by
Row Level Security: guests reach their own data through `SECURITY DEFINER`
RPCs, and staff-only tables are gated on `public.is_staff()`.

---

## Editing what the resort sells

Prices, dishes, treatments and accommodations are edited **in the dashboard**,
not in the code. Each amenity is managed in its own section:

| Section | Tab | What can be added, edited and removed |
| --- | --- | --- |
| Food Menu | Foods · Combo Meal · Pre-Order · Beverages | Dishes and combos, and each coffee flavour at each cup size (tap a price in the table to edit that cup) |
| Spa | Services | Treatments: price, duration, photo |
| Units | Manage Accommodations | Accommodations, how many of each exist, and the price + capacity under each stay schedule |

Every one of those screens writes to the same rows the guest pages read, so a
saved price is live on the guest side immediately — the catalogs are on the
realtime publication, so even a guest already sitting on the menu page follows
the edit without reloading.

Five things are worth knowing before editing:

- **Photos are uploaded, not linked.** Every form with a photo has an **Upload
  image** button: pick a file and it goes straight into the project's
  `catalog-images` storage bucket, with the row keeping its URL — so the photo
  lives with the resort's own data instead of on somebody else's server. Rows
  that shipped with the site show their built-in photo until one is uploaded
  over it; the button then reads **Replace image**. Uploading needs the
  `catalog-images` migration applied and a signed-in staff account, and the
  limit is 5 MB per photo (JPG, PNG, WebP, AVIF or GIF).
- **An accommodation has a gallery, not just a photo.** Under the main photo,
  **Gallery** takes as many as twelve more — the inside of the unit, the
  bedding, the view — picked several at a time and reordered with the arrows on
  each thumbnail. They become the slides of the home page "view more" carousel,
  after the main photo, in exactly the order shown in the dashboard.
- **An item can be hidden instead of deleted.** Unticking "show this on the
  guest menu" takes it off the guest page and leaves it in the dashboard to be
  switched back on. Deleting is permanent — but it never rewrites a bill:
  orders already placed keep the name and price they were charged.
- **Unit counts create real units.** Raising an accommodation's "how many
  exist" generates the missing unit rows (`TPE-03`), because availability is
  counted per physical unit. Lowering it retires the spares; one with a booking
  on it is kept and simply stops being offered. The unit prefix is fixed after
  creation — bookings point at ids built from it.
- **A rate is per stay schedule.** A new accommodation is not offered anywhere
  on the guest site until it has a price under at least one schedule group —
  the dashboard says so on the accommodation itself — and removing a rate is
  how a unit stops being sold under that schedule. That is what makes the
  Cottage day-only and the tents overnight-only.

Once it has a price, a new accommodation gets a home page card and a "view
more" window like every other unit, built from its own row: its name, uploaded
photo, gallery, description and "What's Included" list. The units that shipped with the
site show their bundled photo until one is uploaded over it; a new one shows the
camp's green with a shelter outline until it is given a photo.

---

## Editing what the site says

The **CMS** section holds the site's own copy — the words and pictures on the
public pages, as opposed to what the resort sells. Every block of the home page
is in here, and so is the footer that ends every other page: there is no copy
left hardcoded in the front end.

| Tab | What can be edited |
| --- | --- |
| Hero Banner | The top of the home page: headline, description, both buttons and where they go, the circular photo, the background image, the background video, and the feature tiles along the bottom |
| Welcome Section | The block under it: the welcome heading and its paragraphs, the photo collage with its numbered list, and the four tiles of the green panel |
| What We Offer | The amenity cards — photo, icon, heading, line — the photos and captions inside each card's "Discover More" window, and the chip row under them |
| Accommodations | The section's heading and the line under it — **and nothing else**, see below |
| Testimonials | The section's heading and line, and the guest reviews themselves: name, stars, what they wrote, and an optional line about their stay |
| Location | The heading, the contact card beside the map — address, phone, email, hours — the "Get Directions" button, and the tiles under the map. **Not the map itself**, see below |
| FAQ | The intro beside the accordion and its "Reach out" button, and every question and answer in it |
| Contact | The heading, the column beside the enquiry form — paragraph, phone/email/hours rows, Admin Hours panel and its note — and what the form itself **says**, see below |
| Footer | The bottom of **every** page: the resort blurb, both link lists, the phone and email, the copyright line, and the Terms & Conditions and Copyright Policy behind it |

Each tab is one row of copy plus a table per list it contains — `home_hero` and
`home_hero_features`; `welcome_section`, `welcome_highlights` and
`welcome_tags`; `offer_section`, `offer_cards`, `offer_gallery_items` and
`offer_tags`; `accommodation_section`; `testimonial_section` and
`testimonials`; `location_section`, `location_details` and `location_features`;
`faq_section` and `faqs`; `contact_section` and `contact_details`;
`footer_section`, `footer_links` and `footer_socials`. Rewording the site is no
longer a code change and a redeploy. Saved changes are live immediately,
including for visitors already on the page.

Twelve things are worth knowing:

- **The headline is typed one line per line.** Where it breaks on screen is a
  layout choice, so the box takes the break exactly as typed. The gold closing
  word ("Getaway") is its own field beside it.
- **A button with no label is not on the page.** Clearing "Book Now" removes
  the button rather than leaving a blank one. A link starting with `/` is
  routed inside the app, one starting with `#` scrolls to that section, and a
  full `https://` address opens in a new tab.
- **The video has its own bucket.** Photos go to `catalog-images` like every
  other upload, but a background clip is neither an image nor under 5 MB, so it
  goes to `site-media` — up to 60 MB, MP4 or WebM. Re-export it at 720p before
  uploading: every visitor to the home page downloads it. It can also be
  switched off without being deleted, which leaves the background image on its
  own and keeps the clip for next time.
- **Icons are picked from a list, or uploaded.** Every tile has an icon menu of
  the artwork the site ships with. Uploading one overrides the menu — but both
  circles it can land in are dark and the page draws whatever is in them in
  cream, so line art on a transparent background works and a photograph comes
  out solid white. SVG is accepted here alongside JPG, PNG and WebP.
- **The collage holds three photos.** It is a triptych with three fixed
  positions, not a grid, so the first three *shown* highlights go in it. A
  fourth is still listed beside the collage and the dashboard labels it
  **List only**, so hiding one and watching another take its place is not a
  surprise. The numbers (01, 02, 03) follow the order on screen — there is no
  position field to keep in step, just the arrows.
- **"Discover More" opens a window that was never filled in.** Each offer card
  has three photo slots with a title, and every one of them shipped empty —
  which is why the window has only ever shown "Photo coming soon". They are now
  rows under their card in the **What We Offer** tab: upload the photo, and
  write the small line under the title that the front end previously had no
  field for at all. Those lines are blank until somebody writes them; a slot
  with no line shows its title alone. Deleting a card deletes its window's
  photos with it.
- **The accommodation cards are not CMS content.** The Accommodations tab edits
  the section's heading and one line, and stops there. Every card under it is
  the accommodation itself — name, photo, gallery, description, "What's
  Included", price and capacity — edited in **Units → Manage Accommodations**,
  with availability counted off real bookings. Putting any of that in the CMS
  as well would give one field two screens to be changed on and two answers
  when they disagreed. The tab says so on screen and links across to Units.
- **Reviews are transcribed, not collected.** The Testimonials tab is where a
  good review from Google or Facebook gets typed in; there is no form on the
  site for a guest to post one, and the table is deliberately not writable by
  the public. The rating takes halves — 4.5 draws four stars and a half. The
  small line under a guest's name has never been filled in on any of the seven
  reviews the site shipped with, so it is optional and blank leaves the name on
  its own. Hiding every review takes the whole section off the home page rather
  than leaving an empty band scrolling.
- **The map is not CMS content.** The Location tab edits the heading, the
  contact card, the "Get Directions" button and the tiles under the map, and
  stops there. The embedded map stays in the code because it is not wording: it
  is a URL carrying a place query, a latitude, a longitude and a zoom level, and
  one character wrong in any of them fails silently — the frame shows the wrong
  village, or nothing, and reads as a broken site rather than as a field
  somebody needs to correct. The button beside it *is* editable, so where guests
  are sent for directions can still be changed. The address on the card is typed
  one line per line, like the hero's headline.
- **The FAQ answers do not update themselves.** Several of them quote the
  entrance fee, the cottage fee, the group limit and the check-in windows —
  figures that are actually set in Units and the rate schedules. Nothing carries
  a price change across to the wording, and nothing sensibly could: an answer is
  a sentence somebody wrote, not a live figure. After changing a price, re-read
  the FAQ. The tab says so on screen. An answer that has gone out of date can be
  unticked rather than deleted, which takes it off the page and keeps the
  wording for whoever rewrites it. One answer is one paragraph: the accordion
  opens as a single collapsing block, so line breaks typed into an answer run
  together on the page.
- **The contact form's wording is editable; the form is not.** The four labels,
  their grey hints and the button are copy and are edited in the Contact tab
  (in their own form, so rewording the paragraph beside them cannot clear the
  label off the Email box). What the form *does* is not: the field names are
  what the email template reads, the input types are what open a phone keypad on
  a phone, and `required` is what stops an empty enquiry. Where a message is
  delivered is part of the email settings, not the wording. The phone number is
  also written down on the Location card and in the footer — changing it in
  Contact changes Contact only, which is deliberate, so update Location too if
  they should match. The tab says both of these on screen.
- **The footer is the one tab that is not just the home page.** It ends the
  booking flow, the menu and My Booking too, so a change there is visible
  everywhere at once. It also holds the two paragraphs on this site with legal
  weight — the **Terms & Conditions** a guest agrees to by booking, and the
  **Copyright Policy** — which are edited in their own form so that fixing a
  heading cannot reach them. Emptying either removes its button rather than
  opening a blank panel. The copyright line's year is read off the clock, not
  stored, so there is nothing to update each January.

The photos, icons, background and clip the site shipped with are bundled
assets. They stay in the build and are what the pages show until something is
uploaded over them — and what they fall back to if the database is unreachable,
so the front page is never blank.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build (fails without Supabase keys), then `scripts/seo-postbuild.mjs` |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | ESLint |

---

## Search engines

Page titles, descriptions and the resort's address and phone live in one file:
[`src/lib/seoConfig.js`](src/lib/seoConfig.js). Edit that, not `index.html`.

Three things read it, and they must never disagree:

| | |
| --- | --- |
| [`components/Seo.jsx`](src/components/Seo.jsx) | Rewrites the `<head>` as the guest navigates. Every public page mounts one. |
| [`scripts/seo-postbuild.mjs`](scripts/seo-postbuild.mjs) | After `vite build`: writes `robots.txt`, `sitemap.xml`, and a copy of the HTML per route with that route's tags already in it. |
| [`lib/structuredData.js`](src/lib/structuredData.js) | The JSON-LD that puts the resort in a local search result with a map pin and opening hours. |

Two things are worth knowing before changing any of it:

- **The per-route HTML is not an optimisation.** Facebook, Messenger and Viber
  read a link preview out of the raw HTML and never run JavaScript. Without
  those files every link shared anywhere shows the home page's title and photo.
- **What the schema claims, the page must show.** The phone number in
  `seoConfig.js` has to match the one in the contact card. Structured data that
  disagrees with the visible page is what Google drops a rich result for — so
  when staff change the number in the dashboard, change it here too.
