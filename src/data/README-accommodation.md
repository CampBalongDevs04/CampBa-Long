# Accommodation database

Backed by the Supabase project **campBalongWeb** (`gxjhrtejzbpjtjedbtxl`, ap-southeast-1).
The client booking flow and the admin dashboard read and write the same rows.

| | |
|---|---|
| **Data layer** | [`accommodationDB.js`](accommodationDB.js) — the only file that talks to Supabase |
| **Schema** | [`supabase/migrations/`](../../supabase/migrations/) — already applied to the project |
| **Client** | [`supabaseClient.js`](../lib/supabaseClient.js), configured from `.env` |

`accommodationInventory.js` is a re-export shim so older imports keep working.
New code should import from `accommodationDB.js`.

## The availability rule

A unit is unavailable when an existing booking's **occupancy window** overlaps
the one being asked about. The window is a timestamp range, not a date, because
the three stay schedules cover different hours:

| Schedule | Window | `rateGroup` |
|---|---|---|
| Day Time | 10:00 → 17:00 same day | `day` |
| Day and Night | 10:00 → 08:00 next morning | `overnight` |
| Night and Day | 20:00 → 18:00 next evening | `overnight` |

So a unit booked for **Day Time on Jul 28** is gone that afternoon but still
bookable for a **Night-and-Day** stay starting 20:00 the same evening. Ask
without a schedule and it falls back to whole calendar days, check-out day
exclusive — the conservative answer used before the guest picks a schedule.

Booked *and* pending bookings hold the unit. Only `cancelled` releases it.

**The rule is enforced by Postgres, not by the app.** `bookings` carries a GiST
exclusion constraint on `(unit_id, occupancy)`, so two overlapping bookings for
the same unit cannot both commit — even if the front end has a bug, even under
a race between two guests clicking Confirm at the same instant.

## Who can do what

| | Guest (anon key) | Staff (signed in + on the roster) |
|---|---|---|
| See availability counts | yes, via `accommodation_availability()` | yes |
| Create a booking | yes, via `book_accommodation()` | yes |
| Read guests' names / emails / receipts | **no** | yes |
| Approve, mark paid, cancel | **no** | yes |

Both guest-facing functions are `SECURITY DEFINER` and return counts or the
caller's own new row — never anyone else's data. The `bookings` table itself is
readable only when `is_staff()` passes, so being signed in is not by itself
enough.

### Authorising a staff account

1. Supabase dashboard → **Authentication → Users → Add user** (email + password).
2. Then run once, in the SQL editor:

```sql
insert into public.staff (user_id, full_name)
select id, 'Their Name' from auth.users where email = 'them@example.com';
```

They can now sign in at the dashboard URL — whichever path `VITE_ADMIN_PATH`
in `.env` is set to; it is deliberately not written down in the repo. An
account that signs in without a staff row is rejected with "This account is
not authorised for the dashboard."

## How the screens stay fresh

Components call `getAvailability()` straight from render, so the read API is
synchronous over a cache:

* a cache miss returns `null` — rendered as "Availability TBA" — and starts the
  fetch; the screen updates when it lands;
* cached counts older than 30s are shown immediately and revalidated in the
  background, so a number only repaints if it actually moved.

Staff sessions additionally get Postgres **Realtime** on `bookings`, so two
admins on two laptops stay in step. Realtime honours RLS, which is why guests
get revalidation instead of live events — an anonymous client must not be told
about rows it cannot read. A stale guest count is never dangerous: the booking
itself goes through `book_accommodation()`, so the worst case is a "just taken"
message rather than a double booking.

## Booking lifecycle

| Stage | Holds the unit? | Set by |
|---|---|---|
| `pending` — receipt uploaded, awaiting verification | yes | guest confirms |
| `upcoming` — verified, stay hasn't started | yes | admin **Approve** |
| `active` — between check-in and check-out | yes | derived from the clock |
| `completed` — checked out | yes (historical) | derived from the clock |
| `cancelled` | **no** | guest or admin **Cancel** |

`active` and `completed` are derived by `getBookingStage()`, not stored.

## When someone else is holding it

A `pending` booking with no receipt holds its unit for **10 minutes** while the
guest pays (`payment_window_minutes()`). During those minutes the unit is
neither available nor really booked, and the guest who arrives second used to be
told *"fully booked — next free date: Tuesday"*. Both halves were wrong: nobody
has paid for it, and it is usually free again in minutes.

`hold_conflict()` draws the distinction, per type and stay window:

| | Meaning | Worth waiting for? |
|---|---|---|
| `free_units` | nothing blocks it | — |
| `held_units` | every blocker is a live unpaid hold; `releases_at` says when it lapses | **yes** |
| `booked_units` | a receipt is in, or staff confirmed it, or the stay happened | no |

`book_stay()` uses it to classify refusals, and the `hint` it raises with is
what the front end branches on:

| `hint` | `createBooking()` reason | What the form does |
|---|---|---|
| `held` | `held` | offers a place in line, counts down to `releases_at` |
| `queued` | `queued` | same — a guest ahead has the claim |
| `unavailable` | `unavailable` | clears the selection; waiting achieves nothing |

### The queue

Waiting is a row in `booking_queue`, ordered by `created_at`, so the unit goes
to whoever asked first rather than to whoever happens to be clicking when it
frees. When a unit comes free the front of the line is marked `ready` and gets
an exclusive claim for `queue_claim_minutes()` (2) — and
**`book_accommodation()` refuses that window to everyone else while the claim is
live**, including a walk-up guest who never queued. That refusal is the whole
mechanism; without it the table would be decoration.

Two limits stop a ghost entry blocking the line, both server-side:

* `last_seen_at` — stamped on every `booking_queue_status()` poll. Nothing for
  `queue_heartbeat_seconds()` (90) means a closed tab, and the entry expires.
* `claim_until` — a `ready` entry that does not book in time expires and the
  next guest is promoted. Being first in line is a chance, not a reservation.

There is **no cron on this project**, so `promote_booking_queue()` runs from the
two places that need it to have run: `booking_queue_status()`, which every
waiting browser polls every 5s, and `book_accommodation()` itself. This is the
same design as `expire_stale_bookings()` — the guests watching are the clock.

Guest 2 is never told *who* guest 1 is. Guests have no read access to `bookings`
by design, and the queue does not carve a hole in that to make a nicer sentence:
the hold is "another guest", and what guest 2 needs — when it frees, and their
place in line — is not personal data about anybody.

## Function map

| JS (`accommodationDB.js`) | Postgres |
|---|---|
| `getAvailability()` | `accommodation_availability(check_in, check_out, schedule_key)` |
| `getNextAvailableDate()` | `next_available_date(type_id, from, schedule_key, max_days)` |
| `createBooking()` | `book_stay(...)` — the queue-aware wrapper around `book_accommodation(...)` |
| `addFoodOrder()` / `addSpaOrder()` | `add_booking_addon(booking_id, kind, order)` |
| `readHoldConflict()` (`bookingQueue.js`) | `hold_conflict(type_id, check_in, check_out, schedule_key)` |
| `joinQueue()` (`bookingQueue.js`) | `join_booking_queue(...)` |
| `pollQueue()` (`bookingQueue.js`) | `booking_queue_status(entry_id, owner_token)` |
| `leaveQueue()` (`bookingQueue.js`) | `leave_booking_queue(entry_id, owner_token)` |
| `confirmBooking()` / `cancelBooking()` | `update bookings set …` (staff only) |
| `getUnitDayDetail()` | computed locally from staff rows; `unit_day_detail(date)` is the SQL equivalent |

## Receipt images

The guest's proof-of-payment screenshot goes into the private `receipts`
storage bucket, and `bookings.receipt_url` holds its **path** inside that
bucket — not a public URL.

* `uploadReceipt(file)` runs *before* `createBooking()`, so an upload that fails
  never leaves a reservation waiting on a review that cannot happen. The folder
  name is random, because the path is what a signed URL is minted from.
* Anyone may upload (a guest is anonymous at that point) but only a staff
  session may read, via `getReceiptUrl(path)` → a signed URL valid for five
  minutes. The admin `ReceiptViewer` shows it next to the expected down payment,
  and for a pending booking Approve/Reject live inside that viewer.
* Bookings taken before the bucket existed still carry the old
  `'pending-upload'` marker. Those have `receiptPath === null`, and the viewer
  says so instead of showing a broken image.

## Still to do
* **`book_accommodation()` is callable by anyone with the public key.** That is
  required for guests to book, but it means the endpoint is open to spam. Add
  rate limiting or a CAPTCHA before launch.
* **Guests can't retrieve past bookings after a refresh.** They only hold what
  they created this session, since RLS hides the table. Add a lookup by booking
  code + email if guests need to return to a reservation later.
