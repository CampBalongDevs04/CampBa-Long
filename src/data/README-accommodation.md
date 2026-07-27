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

They can now sign in at `/admindash2345`. An account that signs in without a
staff row is rejected with "This account is not authorised for the dashboard."

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

## Function map

| JS (`accommodationDB.js`) | Postgres |
|---|---|
| `getAvailability()` | `accommodation_availability(check_in, check_out, schedule_key)` |
| `getNextAvailableDate()` | `next_available_date(type_id, from, schedule_key, max_days)` |
| `createBooking()` | `book_accommodation(...)` |
| `addFoodOrder()` / `addSpaOrder()` | `add_booking_addon(booking_id, kind, order)` |
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
