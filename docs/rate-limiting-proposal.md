# Rate limiting the anonymous RPCs — a proposal

**Status: not implemented.** This is the write-up of the options so the decision
has something to sit on. Nothing in the codebase does any of it yet.

From the security audit (Low): *"No rate limiting on the anon RPCs (`book_stay`,
`join_booking_queue`, contact form). Booking spam creates rows with guest-facing
consequences even though the sweep reclaims units."*

## Read this first: the limitation that shapes every option

**Postgres cannot see the client's IP address through PostgREST.** Requests
arrive at the database over a connection pool shared by every visitor; the
originating IP is not in the session, and `inet_client_addr()` returns the
PostgREST server's address, the same for everybody.

So anything implemented *inside* the database can only be keyed on something the
caller sends — in this app, the owner token from `localStorage`. An attacker
clears it, or sends a fresh one per request, and the limit is gone.

That does not make a SQL limiter worthless. It makes it a **different control**
than the audit finding implies, and it should be described honestly:

* it stops accidental abuse — a double-clicked Reserve button, a retry loop in a
  flaky-network client, a naive script that reuses one token;
* it does **not** stop anyone who is deliberately trying.

Real per-IP limiting has to happen in front of the database. See option B.

## One correction to the finding

The **contact form is not an anon RPC.** It calls EmailJS directly from the
browser (`src/lib/emailClient.js` → `emailjs.send()` → `api.emailjs.com`); no
Supabase function is involved. Nothing in Postgres can rate-limit it. Its
throttling lives in the EmailJS dashboard (per-account monthly quota and their
own abuse controls), and that is where to change it.

## What the app already does about spam

Worth counting before adding machinery, because these are real:

* An unpaid booking holds its unit for **10 minutes** and then
  `expire_stale_bookings()` cancels it and puts the unit back.
* `bookings_no_double_booking` (GiST exclusion) makes overlapping holds on one
  unit impossible regardless of request volume.
* As of `20260813140000_receipt_bucket_scoping.sql`, storage uploads require a
  live booking id and cap at 10 objects per booking, so spam no longer converts
  into unbounded storage.
* `book_stay` is no longer bypassable (`20260813150000_…`), so every booking goes
  through the queue gate.

What remains is the guest-facing residue: rows in the admin list, a unit that
looks unavailable for ten minutes at a time, and confirmation emails.

## Option A — counter table, keyed on the owner token

Cheap, entirely in SQL, no new infrastructure.

```sql
create table public.rate_limit_hits (
    bucket       text        not null,   -- 'book_stay', 'join_booking_queue'
    subject      text        not null,   -- booking_owner_hash(p_owner_token)
    window_start timestamptz not null,
    hits         integer     not null default 0,
    primary key (bucket, subject, window_start)
);

create or replace function public.rate_limit_check(
    p_bucket  text,
    p_subject text,
    p_limit   integer,
    p_window  interval default '1 minute'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_window timestamptz := date_bin(p_window, now(), timestamptz 'epoch');
    v_hits   integer;
begin
    if p_subject is null then return; end if;   -- see "unsolved" below

    insert into public.rate_limit_hits (bucket, subject, window_start, hits)
    values (p_bucket, p_subject, v_window, 1)
    on conflict (bucket, subject, window_start)
        do update set hits = public.rate_limit_hits.hits + 1
    returning hits into v_hits;

    if v_hits > p_limit then
        raise exception 'Too many attempts. Please wait a moment and try again.'
            using errcode = 'P0001', hint = 'rate-limited';
    end if;
end;
$$;
```

Called at the top of each wrapper, before any work:

```sql
perform public.rate_limit_check('book_stay', public.booking_owner_hash(p_owner_token), 5);
```

Suggested starting limits: `book_stay` 5/min, `book_stay_group` 5/min,
`join_booking_queue` 20/min (the queue heartbeat polls, so this one must be
generous or it will refuse legitimate waiting guests).

Housekeeping: one more `cron.schedule` deleting rows older than an hour, next to
the orphan scan in `20260813140000_receipt_bucket_scoping.sql`.

Frontend work: `createBooking()` and `joinQueue()` in `src/data/` would need to
recognise `hint === 'rate-limited'` and show the message as a plain "try again in
a moment" rather than the generic failure path.

### What Option A leaves unsolved

* **A null subject.** A caller who sends no `p_owner_token` gets no limit at all,
  because there is nothing to key on. Refusing token-less calls instead would be
  a behaviour change: `p_owner_token` currently defaults to null and a booking
  made without one is legal (it just cannot be re-opened from My Bookings).
* **A rotating subject.** One line of script generates a fresh token per request.
* **Write amplification.** The limiter itself writes a row per request, so a
  flood still costs writes — less than a booking, but not nothing.

## Option B — Vercel middleware, keyed on the real IP

The only way to limit by IP. A `middleware.ts` at the project root sees
`request.ip` / `x-forwarded-for` before anything reaches Supabase, and can
refuse a burst outright.

Cost: this project currently has **no serverless functions at all** — it is a
pure static SPA plus a Postgres database. Adding middleware means a runtime on
the critical path of every request, a store for the counters (Vercel KV or
Upstash, a new paid dependency), and a new failure mode: if the store is down,
either the site stops or the limit stops.

It also cannot see RPC calls made directly against
`https://<ref>.supabase.co/rest/v1/rpc/…` — which is exactly how the audit's
`curl` attacks arrive. Middleware only guards traffic through the site's own
domain, so on its own it protects the *site*, not the *database*.

## Option C — Supabase Edge Function proxy

Move `book_stay` and `join_booking_queue` behind an Edge Function that sees the
real IP, limits there, then calls the RPC with the service role. Closes the
`curl` path properly, since anon's execute could then be revoked from the RPCs
the same way it was for `book_accommodation`.

This is the only option that actually does what the finding asks. It is also the
biggest: a new deployment surface, the service-role key in function config, and
the queue's latency budget now including a function cold start.

## Recommendation

Option A, when it is worth doing at all — with the description above, not as
"rate limiting". It is a guard against accidental floods and it costs a table
and four lines in two functions.

Do not reach for B or C on the strength of this finding alone. The abuse it
describes is bounded by the ten-minute sweep and cannot cause a double booking
or a wrong price. If booking spam ever actually happens, Option C is the one to
build, and it should be scoped then against what the spam actually looks like.
