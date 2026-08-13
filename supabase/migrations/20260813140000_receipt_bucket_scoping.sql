-- ============================================================================
--  Camp Ba-long — an upload has to belong to a booking that is waiting for one
-- ----------------------------------------------------------------------------
--  THE HOLE THIS CLOSES
--  --------------------
--  20260727090829_receipt_storage.sql opened the bucket to anonymous inserts,
--  which it has to be — a guest has no session at upload time:
--
--      for insert to anon, authenticated with check (bucket_id = 'receipts')
--
--  No path scoping, no ceiling on how many objects one caller could write, and
--  nothing that ever cleaned up after an abandoned booking. Not a leak: reads
--  are staff-only and the paths are random. It is a bill. 10 MB × unlimited,
--  payable by the resort, reachable by anybody who reads the publishable key
--  out of the bundle.
--
--  THE FIX
--  -------
--  The prefix that 20260813130000_verify_receipt_objects.sql already requires
--  on the way IN is now also required on the way UP: the first path segment has
--  to be the id of a real booking or reservation that is actually waiting for a
--  receipt. Unlimited becomes "at most 10 files per live, unexpired booking",
--  and an attacker has to create a real booking — which lapses in ten minutes
--  and holds a unit while it does — for every 10 files they want to store.
--
--  The bucket's own file_size_limit drops from 10 MB to 5 MB. That, and not a
--  check in the policy, is where the size cap belongs: for a standard upload
--  the object row's metadata is not populated at the moment WITH CHECK runs, so
--  a metadata->>'size' test would be reading null and passing everything.
--
--  ORPHANS ARE REPORTED, NOT DELETED
--  ---------------------------------
--  An upload that succeeded before an RPC failed leaves a file nothing
--  references. A nightly pg_cron job counts them into receipt_orphan_scans and
--  staff can list them with orphaned_receipts(). NOTHING IS DELETED
--  AUTOMATICALLY, by choice — see the caveat below, and because a sweep that
--  misjudged one row would destroy a guest's only proof of payment.
--
--  CAVEAT WHOEVER ACTS ON THE REPORT MUST KNOW
--  -------------------------------------------
--  Deleting a row from storage.objects does NOT delete the file's bytes. Only
--  the Storage API does. Clear orphans from the dashboard (Storage → receipts)
--  or through the Storage REST API — never with a DELETE in SQL, which would
--  strand the bytes with no row left to find them by.
--
--  To drop:
--      do $$ begin perform cron.unschedule('receipt-orphan-scan'); exception when others then end $$;
--      drop function if exists public.scan_receipt_orphans();
--      drop function if exists public.orphaned_receipts();
--      drop function if exists public.receipt_orphan_rows();
--      drop table if exists public.receipt_orphan_scans;
--      drop function if exists public.receipt_upload_allowed(text);
--      (then restore the open insert policy from *_receipt_storage.sql)
-- ============================================================================


-- ================================================================ size cap
-- 5 MB is a generous phone screenshot. The mime allowlist is unchanged.
update storage.buckets
   set file_size_limit = 5 * 1024 * 1024
 where id = 'receipts';


-- =================================================== receipt_upload_allowed
-- Is this object name one that a guest is currently entitled to write?
--
-- SECURITY DEFINER because the policy runs as `anon`, which has no select on
-- public.bookings (revoked in *_guest_booking_ownership.sql) and must not be
-- given one — this function answers a single yes/no question and leaks nothing
-- else about the row.
--
-- Deliberately NOT an ownership check. The guest has no session and the owner
-- token never travels with a storage upload, so the strongest available test is
-- "names a booking that is real, live and still expecting a receipt". That is
-- enough for what this defends against: the cost of storage. Crediting the
-- receipt to the booking is a separate decision, made by pay_my_booking(),
-- which does verify ownership.

create or replace function public.receipt_upload_allowed(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_prefix text;
    v_id     uuid;
    v_live   boolean := false;
    v_count  integer;
begin
    -- Exactly `<uuid>/<name>.<ext>`, one level deep. Also what keeps '..' and
    -- other path games out of the bucket.
    if p_name !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[A-Za-z0-9._-]{1,120}$' then
        return false;
    end if;

    v_prefix := split_part(p_name, '/', 1);

    begin
        v_id := v_prefix::uuid;
    exception when others then
        return false;
    end;

    -- Still expecting a receipt: not cancelled, and not a hold whose ten
    -- minutes ran out unpaid. A booking that has ALREADY paid stays allowed on
    -- purpose — an add-on ordered afterwards raises the total, and the guest
    -- submits a second screenshot for the difference (see receipt_uploads).
    select exists (
        select 1 from public.bookings b
         where b.id = v_id
           and b.status <> 'cancelled'::public.booking_status
           and not public.booking_hold_expired(b.status, b.receipt_url, b.created_at)
    ) or exists (
        select 1 from public.booking_groups g
         where g.id = v_id
           and g.status <> 'cancelled'::public.booking_status
           and not public.booking_hold_expired(g.status, g.receipt_url, g.created_at)
    ) into v_live;

    if not v_live then
        return false;
    end if;

    -- One booking is not a free storage tier. Ten is far more than the retry +
    -- top-up case needs and far less than a bill.
    select count(*) into v_count
      from storage.objects
     where bucket_id = 'receipts'
       and name like v_prefix || '/%';

    return v_count < 10;
end;
$$;

grant execute on function public.receipt_upload_allowed(text) to anon, authenticated;


-- ===================================================== the scoped insert policy
drop policy if exists "guests upload receipts" on storage.objects;
create policy "guests upload receipts" on storage.objects
    for insert to anon, authenticated
    with check (bucket_id = 'receipts' and public.receipt_upload_allowed(name));

-- The read and delete policies from *_receipt_storage.sql are untouched:
-- staff-only, and still the only way anything comes back out of this bucket.


-- ==================================================== orphan reporting
-- Objects nothing references. Split in three so the staff-facing view and the
-- cron job cannot drift: one query, two callers, different gates.

-- The output columns are named object_name/uploaded_at rather than the
-- storage.objects columns they come from: in a RETURNS TABLE function those
-- names are output parameters, and one that matches a column in the body is an
-- ambiguous reference.
create or replace function public.receipt_orphan_rows()
returns table (object_name text, uploaded_at timestamptz, size_bytes bigint)
language sql
stable
security definer
set search_path = public
as $$
    with referenced as (
        select receipt_url as path from public.bookings       where receipt_url is not null
        union
        select receipt_url             from public.booking_groups where receipt_url is not null
        union
        select u ->> 'path' from public.bookings b,
               lateral jsonb_array_elements(b.receipt_uploads) u
        union
        select u ->> 'path' from public.booking_groups g,
               lateral jsonb_array_elements(g.receipt_uploads) u
    )
    select o.name,
           o.created_at,
           nullif(o.metadata ->> 'size', '')::bigint
      from storage.objects o
     where o.bucket_id = 'receipts'
       -- A file uploaded seconds ago may simply be waiting for the RPC that is
       -- about to reference it. A day old and unreferenced is an orphan.
       and o.created_at < now() - interval '24 hours'
       and not exists (select 1 from referenced r where r.path = o.name)
     order by o.created_at;
$$;

-- Internal. Both callers below are the intended entry points.
revoke all on function public.receipt_orphan_rows() from public, anon, authenticated;


-- What staff call to see the list itself.
create or replace function public.orphaned_receipts()
returns table (object_name text, uploaded_at timestamptz, size_bytes bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if not public.is_staff() then
        raise exception 'Staff only.' using errcode = 'P0001';
    end if;
    return query select * from public.receipt_orphan_rows();
end;
$$;

grant execute on function public.orphaned_receipts() to authenticated;


create table if not exists public.receipt_orphan_scans (
    id           bigserial primary key,
    scanned_at   timestamptz not null default now(),
    orphan_count integer not null,
    total_bytes  bigint not null default 0,
    -- A sample rather than the whole list: this is a trend line staff glance
    -- at, and orphaned_receipts() is there when they want the full picture.
    sample_paths jsonb not null default '[]'::jsonb
);

comment on table public.receipt_orphan_scans is
    'One row per nightly sweep of the receipts bucket for objects no booking '
    'references. REPORT ONLY — nothing here deletes anything, and deleting a '
    'storage.objects row would not free the bytes anyway. Clear orphans through '
    'the Storage dashboard or API.';

alter table public.receipt_orphan_scans enable row level security;

drop policy if exists "staff read orphan scans" on public.receipt_orphan_scans;
create policy "staff read orphan scans" on public.receipt_orphan_scans
    for select to authenticated
    using (public.is_staff());


create or replace function public.scan_receipt_orphans()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_count integer;
    v_bytes bigint;
    v_paths jsonb;
begin
    select count(*)::integer,
           coalesce(sum(coalesce(s.size_bytes, 0)), 0),
           coalesce(jsonb_agg(s.object_name) filter (where s.rn <= 25), '[]'::jsonb)
      into v_count, v_bytes, v_paths
      from (select r.object_name, r.size_bytes,
                   row_number() over (order by r.uploaded_at) as rn
              from public.receipt_orphan_rows() r) s;

    insert into public.receipt_orphan_scans (orphan_count, total_bytes, sample_paths)
    values (v_count, v_bytes, v_paths);

    return v_count;
end;
$$;

-- Only the scheduler (which runs as the function owner) has any business
-- calling this. Guests and staff read the results, they do not trigger writes.
revoke all on function public.scan_receipt_orphans() from public, anon, authenticated;


-- ============================================================ the schedule
-- pg_cron is enabled per project, and a project where it has not been toggled
-- on must still be able to run this migration — the scoping above is the part
-- that closes the finding, and the report is an extra. Both statements say what
-- happened rather than failing.
do $$
begin
    create extension if not exists pg_cron;
exception when others then
    raise notice 'pg_cron not available (%). Enable it in the Supabase dashboard '
                 '(Database -> Extensions), then run the cron.schedule call at the '
                 'bottom of this migration by hand.', sqlerrm;
end;
$$;

do $$
begin
    -- Idempotent: re-running the migration replaces the job rather than
    -- stacking a second copy of it.
    begin
        perform cron.unschedule('receipt-orphan-scan');
    exception when others then
        null;                          -- not scheduled yet, which is the normal case
    end;

    perform cron.schedule(
        'receipt-orphan-scan',
        '0 3 * * *',                   -- 03:00 UTC = 11:00 in Manila, daily
        $job$ select public.scan_receipt_orphans(); $job$
    );
exception when others then
    raise notice 'Could not schedule receipt-orphan-scan (%). The bucket scoping '
                 'above is unaffected; schedule it once pg_cron is enabled.', sqlerrm;
end;
$$;
