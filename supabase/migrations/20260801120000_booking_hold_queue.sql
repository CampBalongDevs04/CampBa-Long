-- ============================================================================
--  Camp Ba-long — "someone is holding it, get in line"
-- ----------------------------------------------------------------------------
--  THE SITUATION THIS HANDLES
--  --------------------------
--  One A-House Family. Two guests reach Review & Reserve within the same
--  minute. Guest 1 presses Reserve first and the unit is held for ten minutes
--  while they pay. Guest 2 presses Reserve a moment later.
--
--  What guest 2 was told before this migration:
--
--      "A-House Family is fully booked for that schedule.
--       Next free date: 2026-08-04"
--
--  Both halves of that are wrong. It is not booked — it is HELD, by someone who
--  has not paid a peso and may well not. And the next free date is very
--  probably nine minutes from now, not Tuesday. A guest reading it books
--  something else, or leaves; either way the resort loses a sale it had.
--
--  What guest 2 is told after this migration:
--
--      "A-House Family is held by another guest for the next 9 minutes.
--       We will hold your place in line and try again the moment it frees up."
--
--  THE QUEUE, AND WHY IT IS NOT JUST A RETRY
--  -----------------------------------------
--  Telling guest 2 to try again in ten minutes without recording that they
--  asked would hand the unit to whoever happens to press Reserve at the instant
--  it frees — which is guest 5, who wandered in at minute nine and never
--  waited. So waiting is a row: public.booking_queue, ordered by created_at,
--  one line per stay window.
--
--  When a unit comes free the front of the line is marked `ready` and gets a
--  short exclusive claim (queue_claim_minutes) to complete the booking.
--  book_stay() refuses everyone else for that window while that claim is live —
--  including a walk-up guest who never queued. That refusal is the entire point
--  of the table; without it the queue would be decoration.
--
--  book_stay() is a WRAPPER around the existing book_accommodation(), which
--  this migration deliberately does not touch. The reasoning is at the bottom
--  of this file, and it is not stylistic: the remote database carries a
--  migration this repository has never seen.
--
--  WHAT KEEPS A GHOST FROM BLOCKING THE LINE
--  -----------------------------------------
--  A queue entry is only as alive as the browser watching it. Two limits, both
--  enforced here rather than trusted to the client:
--
--    • last_seen_at — booking_queue_status() stamps it on every poll. An entry
--      nobody has polled for queue_heartbeat_seconds is a closed tab, and it is
--      expired. A guest who walks away cannot hold the line behind them.
--    • claim_until — a `ready` entry that does not book within its claim window
--      is expired and the next guest is promoted. Being first in line is a
--      chance to book, not a reservation of its own.
--
--  NO CRON, SAME AS THE PAYMENT WINDOW
--  -----------------------------------
--  There is no scheduler on this project, so promote_booking_queue() runs from
--  the two places that need it to have run: booking_queue_status(), which every
--  waiting browser polls, and book_stay() itself. A queue with nobody
--  watching it promotes nobody — and that is harmless, because an unwatched
--  entry is exactly the one that is about to be expired anyway.
--
--  WHAT GUEST 2 IS NEVER TOLD
--  --------------------------
--  Who guest 1 is. Not their name, not their initials, not their booking code.
--  Guests have no read access to public.bookings by design (see
--  *_guest_booking_ownership.sql) and this migration does not carve a hole in
--  that to make a nicer sentence: the hold is "another guest", and what guest 2
--  actually needs — when it frees, and their place in line — is not personal
--  data about anybody.
-- ============================================================================


-- ============================================================== the two knobs
-- Both live here for the same reason payment_window_minutes() does: the SQL
-- that enforces the rule and the sentence that explains it must not be able to
-- disagree.

-- How long the guest at the front of the line gets to complete their booking
-- once a unit frees. Long enough to press one button on a form that is already
-- filled in; short enough that a guest who has wandered off does not cost the
-- next in line their stay. This is NOT the payment window — the ten minutes to
-- pay start after this, when the booking exists.
create or replace function public.queue_claim_minutes()
returns integer
language sql
immutable
set search_path = public
as $$ select 2 $$;

grant execute on function public.queue_claim_minutes() to anon, authenticated;


-- How long an entry survives without its browser checking in. The waiting
-- panel polls every few seconds, so this is generous by a wide margin — it is
-- sized to survive a phone that slept in a tunnel, not to be a tight leash.
create or replace function public.queue_heartbeat_seconds()
returns integer
language sql
immutable
set search_path = public
as $$ select 90 $$;

grant execute on function public.queue_heartbeat_seconds() to anon, authenticated;


-- ======================================================== held vs. fully booked
-- The distinction this whole migration turns on, answered for one type and one
-- stay window.
--
--   free      — nothing blocks it
--   held      — blocked, and every blocker is a live unpaid hold. This unit is
--               coming back, and `releases_at` says when.
--   booked    — blocked by something firmer: a receipt is in, or staff have
--               confirmed it, or the stay has happened. Waiting achieves
--               nothing here.
--
-- A unit with both kinds of blocker counts as booked, which is the conservative
-- direction: it does not become free when the hold lapses, so promising a guest
-- it will would be a lie with a timestamp on it.
--
-- SECURITY DEFINER for the same reason accommodation_availability() is —
-- answering "how many, and when" requires reading bookings, and the caller is
-- an anonymous guest who must never be handed the rows themselves.
create or replace function public.hold_conflict(
    p_type_id      text,
    p_check_in     date,
    p_check_out    date default null,
    p_schedule_key text default null
)
returns table (
    total_units  integer,
    free_units   integer,
    held_units   integer,
    booked_units integer,
    releases_at  timestamptz,
    server_now   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
    with w as (
        select * from public.occupancy_window(p_check_in, p_check_out, p_schedule_key)
    ),
    units as (
        select u.id
        from public.accommodation_units u
        where u.type_id = p_type_id and u.is_active
    ),
    -- Every booking that still blocks a unit for these hours. A hold whose ten
    -- minutes are up is not one of them — available_units() stopped counting it
    -- the moment it lapsed, and so does this.
    live as (
        select u.id as unit_id,
               (b.status = 'pending' and b.receipt_url is null) as is_hold,
               public.payment_due_at(b.created_at) as frees_at
        from units u
        cross join w
        join public.bookings b
          on b.unit_id = u.id
         and b.status <> 'cancelled'
         and not public.booking_hold_expired(b.status, b.receipt_url, b.created_at)
         and b.occupancy && tstzrange(w.starts_at, w.ends_at, '[)')
    ),
    per_unit as (
        select u.id,
               count(l.unit_id)                                as blockers,
               count(l.unit_id) filter (where l.is_hold)        as holds,
               -- The unit is free when its LAST hold lapses, not its first.
               max(l.frees_at) filter (where l.is_hold)         as frees_at
        from units u
        left join live l on l.unit_id = u.id
        group by u.id
    )
    select
        count(*)::integer,
        count(*) filter (where blockers = 0)::integer,
        count(*) filter (where blockers > 0 and blockers = holds)::integer,
        count(*) filter (where blockers > holds)::integer,
        min(frees_at) filter (where blockers > 0 and blockers = holds),
        now()
    from per_unit;
$$;

grant execute on function public.hold_conflict(text, date, date, text) to anon, authenticated;


-- ================================================================ the queue

create table if not exists public.booking_queue (
    id              uuid primary key default gen_random_uuid(),

    -- --- what is being waited for ---
    type_id         text not null references public.accommodation_types (id) on delete cascade,
    schedule_key    text not null references public.stay_schedules (key),
    check_in_date   date not null,
    check_out_date  date not null,
    -- Filled by the trigger below from the same occupancy_window() the bookings
    -- table uses, so "overlaps" means exactly what it means over there.
    starts_at       timestamptz not null,
    ends_at         timestamptz not null,
    occupancy       tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,

    -- --- who is waiting ---
    -- Same bearer-capability model as bookings.owner_hash: the SHA-256 of the
    -- device's token, never the token. A queue entry is worth stealing (it is a
    -- place in line for the last unit), so it is protected the same way.
    owner_hash      text not null,
    guest_name      text,

    -- --- where in the line ---
    --   waiting — no unit yet
    --   ready   — a unit is free and this entry has it until claim_until
    --   booked  — took it
    --   left    — gave up
    --   expired — stopped polling, or let the claim lapse
    status          text not null default 'waiting'
                    check (status in ('waiting', 'ready', 'booked', 'left', 'expired')),
    ready_at        timestamptz,
    claim_until     timestamptz,
    last_seen_at    timestamptz not null default now(),

    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),

    constraint booking_queue_dates_ordered check (check_out_date >= check_in_date)
);

comment on table public.booking_queue is
    'Guests waiting for a unit that is currently under an unpaid 10-minute hold. '
    'Order is created_at: first to ask is first served when the hold lapses.';
comment on column public.booking_queue.claim_until is
    'While this is in the future and status is ''ready'', book_stay() refuses '
    'the window to everyone else. That refusal is what makes it a queue.';
comment on column public.booking_queue.last_seen_at is
    'Stamped by booking_queue_status(). An entry nobody polls is a closed tab.';

-- The line itself: FIFO within a type. Partial, because expired and booked
-- entries are history and never scanned.
create index if not exists booking_queue_line_idx
    on public.booking_queue (type_id, created_at)
    where status in ('waiting', 'ready');

create index if not exists booking_queue_owner_idx
    on public.booking_queue (owner_hash);

create index if not exists booking_queue_occupancy_idx
    on public.booking_queue using gist (occupancy);


-- Same treatment bookings get: the window is derived from the dates and the
-- schedule on every write, never accepted from the caller.
create or replace function public.booking_queue_set_occupancy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    w record;
    s public.stay_schedules%rowtype;
begin
    select * into s from public.stay_schedules where key = new.schedule_key;
    if not found then
        raise exception 'Unknown stay schedule: %', new.schedule_key;
    end if;

    if s.same_day then
        new.check_out_date := new.check_in_date;
    else
        new.check_out_date := coalesce(new.check_out_date, new.check_in_date);
    end if;

    select * into w from public.occupancy_window(new.check_in_date, new.check_out_date, new.schedule_key);
    new.starts_at := w.starts_at;
    new.ends_at := w.ends_at;
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists booking_queue_set_occupancy_trg on public.booking_queue;
create trigger booking_queue_set_occupancy_trg
    before insert or update of check_in_date, check_out_date, schedule_key
    on public.booking_queue
    for each row execute function public.booking_queue_set_occupancy();


-- ------------------------------------------------------------ shut the door
-- Identical posture to public.bookings. A queue entry names a guest and a stay;
-- anon reaches it only through the SECURITY DEFINER functions below, each of
-- which requires the owner token.
alter table public.booking_queue enable row level security;
revoke all on public.booking_queue from anon;

drop policy if exists "guests use rpcs only" on public.booking_queue;
create policy "guests use rpcs only" on public.booking_queue
    for select to anon using (false);

drop policy if exists "staff manage the queue" on public.booking_queue;
create policy "staff manage the queue" on public.booking_queue
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ======================================================== move the line along
-- Three jobs, in the order they have to happen:
--
--   1. Expire the abandoned — nobody has polled them.
--   2. Expire lapsed claims — they were offered a unit and did not take it.
--   3. Promote whoever is now at the front of a line with a free unit in it.
--
-- Doing (1) and (2) first is what makes (3) correct: a promotion decided
-- against a line still padded with closed tabs would skip the guest who is
-- actually sitting there waiting.
--
-- Idempotent and safe for anyone to call. Every branch is measured against the
-- server's own now(), so calling it early promotes nobody and expires nobody.
create or replace function public.promote_booking_queue()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_entry     public.booking_queue%rowtype;
    v_free      integer;
    v_claimed   integer;
    v_promoted  integer := 0;
begin
    -- (1) Closed tabs.
    update public.booking_queue
       set status = 'expired', updated_at = now()
     where status in ('waiting', 'ready')
       and last_seen_at < now() - make_interval(secs => public.queue_heartbeat_seconds());

    -- (2) Had their turn, did not take it.
    update public.booking_queue
       set status = 'expired', updated_at = now()
     where status = 'ready'
       and claim_until is not null
       and claim_until <= now();

    -- (3) Oldest first, which is the whole promise of the queue.
    for v_entry in
        select * from public.booking_queue
         where status = 'waiting'
         order by created_at, id
    loop
        select free_units into v_free
        from public.hold_conflict(
            v_entry.type_id, v_entry.check_in_date,
            v_entry.check_out_date, v_entry.schedule_key);

        -- Units already spoken for by entries promoted ahead of this one —
        -- including ones promoted earlier in this very loop, which is why this
        -- is re-counted per iteration rather than hoisted out of it.
        select count(*)::integer into v_claimed
        from public.booking_queue q
        where q.status = 'ready'
          and q.claim_until > now()
          and q.type_id = v_entry.type_id
          and q.occupancy && v_entry.occupancy;

        if v_free > v_claimed then
            update public.booking_queue
               set status      = 'ready',
                   ready_at    = now(),
                   claim_until = now() + make_interval(mins => public.queue_claim_minutes()),
                   updated_at  = now()
             where id = v_entry.id;
            v_promoted := v_promoted + 1;
        end if;
    end loop;

    return v_promoted;
end;
$$;

grant execute on function public.promote_booking_queue() to anon, authenticated;


-- ============================================================ own your place
-- The queue's twin of owned_booking(). Same refusal either way — a caller with
-- someone else's entry id learns nothing from the message.
create or replace function public.owned_queue_entry(p_entry_id uuid, p_owner_token text)
returns public.booking_queue
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_hash text := public.booking_owner_hash(p_owner_token);
    v_row  public.booking_queue;
begin
    if v_hash is null then
        raise exception 'That place in line is not on this device.' using errcode = 'P0001';
    end if;

    select * into v_row
    from public.booking_queue
    where id = p_entry_id and owner_hash = v_hash;

    if not found then
        raise exception 'That place in line is not on this device.' using errcode = 'P0001';
    end if;

    return v_row;
end;
$$;

revoke all on function public.owned_queue_entry(uuid, text) from public, anon, authenticated;


-- ============================================================ what a waiter sees
-- One shape, returned by all three of join / status / leave, so the client has
-- a single thing to render no matter which call produced it.
--
--   place        — 1 means "you are next". Counts only live entries ahead.
--                  Named `place` rather than `position` because POSITION is a
--                  SQL keyword and cannot be an OUT parameter name.
--   ahead        — the same number, minus one. Handed over rather than computed
--                  in JS so the sentence and the ordering cannot disagree.
--   ready        — a unit is yours right now; book before claim_until.
--   releases_at  — when the earliest hold lapses. Null once something is free.
--   retry_at     — the one timestamp the waiting panel actually counts down to:
--                  when this guest should try again. That is claim_until's
--                  start if they are ready, otherwise the release moment.
--   server_now   — the resort's clock, so a device four minutes fast counts
--                  down four minutes of real time and not of its own.
create or replace function public.queue_entry_view(p_entry public.booking_queue)
returns table (
    entry_id     uuid,
    status       text,
    place        integer,
    ahead        integer,
    waiting      integer,
    ready        boolean,
    free_units   integer,
    held_units   integer,
    booked_units integer,
    releases_at  timestamptz,
    claim_until  timestamptz,
    retry_at     timestamptz,
    server_now   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
    with c as (
        select * from public.hold_conflict(
            p_entry.type_id, p_entry.check_in_date,
            p_entry.check_out_date, p_entry.schedule_key)
    ),
    -- Ties on created_at are broken by id, so the line has one exact order and
    -- two entries can never both believe they are next.
    ahead_of_me as (
        select count(*)::integer as ahead
        from public.booking_queue q
        where q.status in ('waiting', 'ready')
          and q.type_id = p_entry.type_id
          and q.occupancy && p_entry.occupancy
          and (q.created_at, q.id) < (p_entry.created_at, p_entry.id)
    ),
    line_total as (
        select count(*)::integer as waiting
        from public.booking_queue q
        where q.status in ('waiting', 'ready')
          and q.type_id = p_entry.type_id
          and q.occupancy && p_entry.occupancy
    )
    select p_entry.id,
           p_entry.status,
           ahead_of_me.ahead + 1,
           ahead_of_me.ahead,
           line_total.waiting,
           p_entry.status = 'ready' and coalesce(p_entry.claim_until, now()) > now(),
           c.free_units, c.held_units, c.booked_units,
           c.releases_at,
           p_entry.claim_until,
           case when p_entry.status = 'ready' then now() else c.releases_at end,
           c.server_now
    from c, ahead_of_me, line_total;
$$;

revoke all on function public.queue_entry_view(public.booking_queue) from public, anon, authenticated;


-- ================================================================ get in line
-- Idempotent on purpose. The browser calls this the moment book_stay()
-- comes back 'held', and it may call it again after a refresh or a dropped
-- connection — a guest must not end up behind themselves in the line, and a
-- reload must not cost them the place they already had.
create or replace function public.join_booking_queue(
    p_type_id      text,
    p_schedule_key text,
    p_check_in     date,
    p_check_out    date default null,
    p_guest_name   text default null,
    p_owner_token  text default null
)
returns table (
    entry_id     uuid,
    status       text,
    place        integer,
    ahead        integer,
    waiting      integer,
    ready        boolean,
    free_units   integer,
    held_units   integer,
    booked_units integer,
    releases_at  timestamptz,
    claim_until  timestamptz,
    retry_at     timestamptz,
    server_now   timestamptz
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_hash  text := public.booking_owner_hash(p_owner_token);
    v_entry public.booking_queue%rowtype;
    v_id    uuid;
begin
    if v_hash is null then
        raise exception 'This device cannot hold a place in line.' using errcode = 'P0001';
    end if;

    if not exists (select 1 from public.accommodation_types
                    where id = p_type_id and is_active) then
        raise exception 'Unknown accommodation: %', p_type_id using errcode = 'P0001';
    end if;

    -- Hand back lapsed holds first, so a guest who queues a second after the
    -- ten minutes were up is told "it's yours" instead of being made to wait.
    perform public.expire_stale_bookings();

    -- Already in this line: keep the original place, and take the poll as proof
    -- the browser is still there.
    select * into v_entry
    from public.booking_queue q
    where q.owner_hash = v_hash
      and q.status in ('waiting', 'ready')
      and q.type_id = p_type_id
      and q.check_in_date = p_check_in
      and q.schedule_key = p_schedule_key
    order by q.created_at
    limit 1;

    if not found then
        insert into public.booking_queue (
            type_id, schedule_key, check_in_date, check_out_date,
            starts_at, ends_at,                   -- overwritten by the trigger
            owner_hash, guest_name
        ) values (
            p_type_id, p_schedule_key, p_check_in, coalesce(p_check_out, p_check_in),
            now(), now() + interval '1 hour',
            v_hash, nullif(btrim(p_guest_name), '')
        )
        returning * into v_entry;
    end if;

    -- After the insert, so a guest joining an empty line for a unit that is
    -- already free is promoted immediately rather than on their next poll.
    v_id := v_entry.id;
    perform public.promote_booking_queue();

    -- Re-read: the promotion above may have just made this entry `ready`, and
    -- the client should learn that from the same call it joined with.
    select * into v_entry from public.booking_queue q where q.id = v_id;
    return query select * from public.queue_entry_view(v_entry);
end;
$$;

grant execute on function public.join_booking_queue(text, text, date, date, text, text)
    to anon, authenticated;


-- ============================================================== where am I?
-- The call the waiting panel polls. It is deliberately the engine of the whole
-- mechanism rather than a read: every poll sweeps lapsed holds, expires dead
-- entries and promotes the front of the line. Guests watching the queue are the
-- only clock this project has, and this is where they wind it.
create or replace function public.booking_queue_status(
    p_entry_id    uuid,
    p_owner_token text
)
returns table (
    entry_id     uuid,
    status       text,
    place        integer,
    ahead        integer,
    waiting      integer,
    ready        boolean,
    free_units   integer,
    held_units   integer,
    booked_units integer,
    releases_at  timestamptz,
    claim_until  timestamptz,
    retry_at     timestamptz,
    server_now   timestamptz
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_entry public.booking_queue%rowtype := public.owned_queue_entry(p_entry_id, p_owner_token);
begin
    -- Checking in. Done before the sweep, so a poll that arrives in the same
    -- second as the heartbeat deadline keeps the entry rather than racing it.
    --
    -- Aliased because `status` is also one of this function's OUT columns, and
    -- an unqualified reference to it here is ambiguous to plpgsql.
    update public.booking_queue q
       set last_seen_at = now()
     where q.id = p_entry_id and q.status in ('waiting', 'ready');

    perform public.expire_stale_bookings();
    perform public.promote_booking_queue();

    select * into v_entry from public.booking_queue q where q.id = p_entry_id;
    return query select * from public.queue_entry_view(v_entry);
end;
$$;

grant execute on function public.booking_queue_status(uuid, text) to anon, authenticated;


-- ================================================================ give up
-- Closing the tab would do this eventually, via the heartbeat. Saying so
-- explicitly moves everyone behind up now instead of ninety seconds from now.
create or replace function public.leave_booking_queue(
    p_entry_id    uuid,
    p_owner_token text
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_entry public.booking_queue%rowtype := public.owned_queue_entry(p_entry_id, p_owner_token);
begin
    update public.booking_queue q
       set status = 'left', updated_at = now()
     where q.id = p_entry_id and q.status in ('waiting', 'ready');

    -- The place they vacated belongs to the next guest immediately.
    perform public.promote_booking_queue();
end;
$$;

grant execute on function public.leave_booking_queue(uuid, text) to anon, authenticated;


-- ============================================================== book a stay
-- WHY THIS WRAPS book_accommodation() INSTEAD OF REPLACING IT
-- ----------------------------------------------------------
-- Every previous migration in this folder changes book_accommodation() by
-- reproducing its entire body with `create or replace`. That is fine when the
-- migrations folder is the whole truth about the database. It is not, here:
-- the remote carries a migration (20260801050155) whose file exists nowhere in
-- this repository, on any branch. Reproducing a body assembled from
-- 20260730200000 would silently revert whatever that migration did to this
-- function, and nobody would find out until a guest hit the missing behaviour.
--
-- So this migration is strictly ADDITIVE. book_accommodation() is left exactly
-- as the database currently has it, and book_stay() is the entry point the
-- booking form calls instead:
--
--   1. before  — move the line along, and refuse the caller if guests ahead of
--                them hold live claims on every free unit ('queued');
--   2. during  — call book_accommodation() itself, whatever its body is today;
--   3. after   — reclassify its "fully booked" refusal into 'held' when the
--                units are merely under an unpaid hold, and close out the
--                caller's queue entry when the booking went through.
--
-- The cost is one indirection, and one caveat worth knowing: a client that
-- calls book_accommodation() directly still bypasses the queue. It cannot
-- double-book — the exclusion constraint is untouched and unbypassable — it can
-- only jump the line. Closing that means revoking anon's execute on
-- book_accommodation once its live signature is known; see the note at the
-- bottom of this file.
create or replace function public.book_stay(
    p_type_id      text,
    p_schedule_key text,
    p_check_in     date,
    p_check_out    date,
    p_guest_name   text,
    p_guest_email  text default null,
    p_guest_mobile text default null,
    p_pax          integer default null,
    p_kids         integer default 0,
    p_seniors      integer default 0,
    p_price        numeric default null,
    p_entrance_total numeric default null,
    p_receipt_url  text default null,
    p_entrance_per_head        numeric default 0,
    p_entrance_senior_discount numeric default 0,
    p_entrance_free_applied    integer default 0,
    p_entrance_free_savings    numeric default 0,
    p_owner_token  text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
    v_hash     text := public.booking_owner_hash(p_owner_token);
    v_row      public.bookings;
    v_conflict record;
    v_window   record;
    v_tracked  boolean;
    v_ahead    integer := 0;
    v_name     text;
    v_minutes  integer;
    v_hint     text;
begin
    -- Hand back every unit whose ten minutes ran out, then move the line along
    -- against what that freed.
    perform public.expire_stale_bookings();
    perform public.promote_booking_queue();

    select exists (select 1 from public.accommodation_types where id = p_type_id and is_active)
      into v_tracked;

    -- Types with a unit ceiling are the only ones with anything to queue for.
    -- Unlimited ones (guests pitching their own tent) go straight through.
    if v_tracked then
        v_name := coalesce((select name from public.accommodation_types where id = p_type_id), p_type_id);

        -- Taken BEFORE the booking attempt, so it is still the reason the
        -- attempt failed if it does. Microseconds old by the time it is read.
        select * into v_conflict
        from public.hold_conflict(p_type_id, p_check_in, p_check_out, p_schedule_key);

        select * into v_window
        from public.occupancy_window(p_check_in, p_check_out, p_schedule_key);

        -- Live claims held by everyone EXCEPT this caller. If they cover every
        -- free unit, the guests ahead get them — including when the caller
        -- never queued at all, which is the point of the whole table.
        select count(*)::integer into v_ahead
        from public.booking_queue q
        where q.status = 'ready'
          and q.claim_until > now()
          and q.type_id = p_type_id
          and q.occupancy && tstzrange(v_window.starts_at, v_window.ends_at, '[)')
          and (v_hash is null or q.owner_hash <> v_hash);

        if v_conflict.free_units > 0 and v_conflict.free_units <= v_ahead then
            raise exception using
                errcode = 'P0001',
                message = format(
                    'A guest ahead of you in line is booking the last %s right now.', v_name),
                detail  = 'Wait a moment and we will try again for you.',
                hint    = 'queued';
        end if;
    end if;

    -- ---------------------------------------------------------------------
    -- The real thing. Untouched by this migration, so whatever the database
    -- currently has — including changes this repository has never seen — is
    -- what runs.
    -- ---------------------------------------------------------------------
    begin
        v_row := public.book_accommodation(
            p_type_id, p_schedule_key, p_check_in, p_check_out,
            p_guest_name, p_guest_email, p_guest_mobile,
            p_pax, p_kids, p_seniors,
            p_price, p_entrance_total, p_receipt_url,
            p_entrance_per_head, p_entrance_senior_discount,
            p_entrance_free_applied, p_entrance_free_savings,
            p_owner_token);
    exception
        when others then
            get stacked diagnostics v_hint = pg_exception_hint;

            -- "Fully booked" is the wrong word when every blocker is an unpaid
            -- ten-minute hold. Same refusal, re-labelled with the one fact that
            -- changes what the guest should do about it: when it comes back.
            if v_hint = 'unavailable'
               and v_tracked
               and v_conflict.held_units > 0
               and v_conflict.releases_at is not null then
                v_minutes := greatest(1, ceil(extract(epoch from (v_conflict.releases_at - now())) / 60)::integer);
                raise exception using
                    errcode = 'P0001',
                    message = format(
                        '%s is being held by another guest who has %s minute%s left to pay for it.',
                        v_name, v_minutes, case when v_minutes = 1 then '' else 's' end),
                    detail  = 'It goes back on the market at '
                              || to_char(v_conflict.releases_at at time zone public.resort_timezone(), 'HH12:MI AM')
                              || ' if they do not.',
                    hint    = 'held';
            end if;

            -- Anything else is passed through exactly as it was raised. A
            -- wrapper that swallowed or reworded genuine failures would be
            -- worse than no wrapper at all.
            raise;
    end;

    -- They were waiting and they got it. Closing the entry here — rather than
    -- leaving the browser to do it — releases the claim immediately for
    -- everyone behind them.
    if v_hash is not null then
        update public.booking_queue q
           set status = 'booked', updated_at = now()
         where q.owner_hash = v_hash
           and q.status in ('waiting', 'ready')
           and q.type_id = p_type_id
           and q.occupancy && v_row.occupancy;

        perform public.promote_booking_queue();
    end if;

    return v_row;
end;
$$;

grant execute on function public.book_stay(text, text, date, date, text, text, text, integer, integer, integer, numeric, numeric, text, numeric, numeric, integer, numeric, text) to anon, authenticated;


-- ============================================================ AFTER THIS RUNS
-- Optional, and deliberately not done here because it needs a signature this
-- repository cannot see. Once you have confirmed the live argument list of
-- book_accommodation():
--
--   select oid::regprocedure from pg_proc
--    where proname = 'book_accommodation' and pronamespace = 'public'::regnamespace;
--
-- revoking anon's execute on it closes the last way to jump the queue:
--
--   revoke execute on function public.book_accommodation(<that signature>)
--     from anon, authenticated;
--
-- Safe to do: book_stay() is SECURITY DEFINER and calls it as the owner, and
-- nothing else in this project calls book_accommodation() directly any more.
-- Leaving it granted costs nothing but line-jumping; it can never cost a double
-- booking, because the exclusion constraint does not care who asked.

notify pgrst, 'reload schema';
