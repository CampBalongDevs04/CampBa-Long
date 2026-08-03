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

Four things are worth knowing before editing:

- **Photos are uploaded, not linked.** Every form with a photo has an **Upload
  image** button: pick a file and it goes straight into the project's
  `catalog-images` storage bucket, with the row keeping its URL — so the photo
  lives with the resort's own data instead of on somebody else's server. Rows
  that shipped with the site show their built-in photo until one is uploaded
  over it; the button then reads **Replace image**. Uploading needs the
  `catalog-images` migration applied and a signed-in staff account, and the
  limit is 5 MB per photo (JPG, PNG, WebP, AVIF or GIF).
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
photo, description and "What's Included" list. The units that shipped with the
site show their bundled photo until one is uploaded over it; a new one shows the
camp's green with a shelter outline until it is given a photo.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build (fails without Supabase keys) |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | ESLint |
