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

- The accommodation list has built-in fallback values, so the cards still render.
- The whole booking form still works — dates, units, guest details.
- Nothing fails visibly until the very last step, where the upload dies with a
  bare `Failed to fetch` that reads like a broken storage bucket.

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

## How receipts work

1. The guest picks a screenshot on the booking form.
2. `uploadReceipt()` puts it in the private `receipts` bucket under a **random**
   folder and returns the path. This runs *before* the booking is created, so a
   failed upload never leaves a reservation behind.
3. The path is stored on the booking row in `receipt_url`.
4. Staff open the receipt viewer, which mints a **signed URL valid for 5
   minutes** — the image is never public.

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

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build (fails without Supabase keys) |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | ESLint |
