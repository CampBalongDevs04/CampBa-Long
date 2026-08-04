-- ============================================================================
--  Camp Ba-long — a group's member units are not bookings of their own
-- ----------------------------------------------------------------------------
--  THE BUG
--  -------
--  book_stay_group() (20260804150000_accommodation_booking_groups.sql) creates
--  one `bookings` row per unit, exactly like a single-unit reservation, and
--  stamps each with `group_id` so the group's own screens can find them. But
--  my_bookings() — unchanged since before groups existed — has no idea that
--  column exists, so it hands every member row back to the guest ALONGSIDE the
--  group's own row from my_booking_groups(). One 2-Teepee reservation showed up
--  as three cards: the real combined one, plus each Teepee again on its own,
--  each with a "Down Payment" panel and an Approve button of its own on the
--  admin side too (loadStaffBookings() has the same gap — fixed in
--  src/data/accommodationDB.js alongside this migration).
--
--  THE FIX
--  -------
--  One clause: a member row (group_id is not null) is no longer a `bookings`
--  row a GUEST is shown — it stays exactly as visible as before to
--  availability, admin, and the group RPCs that already key off group_id
--  directly, all of which read the table straight rather than through this
--  function. Nothing about how a unit is held or released changes; this is
--  display-only, which is why it is safe to apply to a database that already
--  has real reservations in it.
-- ============================================================================

create or replace function public.my_bookings(p_owner_token text)
returns table (
    id              uuid,
    code            text,
    status          public.booking_status,
    type_id         text,
    unit_id         text,
    schedule_key    text,
    check_in_date   date,
    check_out_date  date,
    starts_at       timestamptz,
    ends_at         timestamptz,
    guest_name      text,
    guest_email     text,
    guest_mobile    text,
    pax             integer,
    kids            integer,
    seniors         integer,
    price           numeric,
    downpayment     numeric,
    entrance_total  numeric,
    entrance_per_head        numeric,
    entrance_senior_discount numeric,
    entrance_free_applied    integer,
    entrance_free_savings    numeric,
    payment         public.payment_status,
    receipt_url     text,
    receipt_uploads jsonb,
    food_orders     jsonb,
    spa_orders      jsonb,
    created_at      timestamptz,
    cancel_reason   text,
    payment_due_at  timestamptz,
    server_now      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
    select b.id, b.code, b.status, b.type_id, b.unit_id, b.schedule_key,
           b.check_in_date, b.check_out_date, b.starts_at, b.ends_at,
           b.guest_name, b.guest_email, b.guest_mobile,
           b.pax, b.kids, b.seniors,
           b.price, b.downpayment,
           b.entrance_total, b.entrance_per_head, b.entrance_senior_discount,
           b.entrance_free_applied, b.entrance_free_savings,
           b.payment,
           -- "a receipt is on file, but here is no path to it".
           case when b.receipt_url is null then null else 'pending-upload' end,
           public.masked_receipt_uploads(b.receipt_uploads),
           b.food_orders, b.spa_orders, b.created_at,
           b.cancel_reason,
           public.payment_due_at(b.created_at),
           now()
    from public.bookings b
    where b.owner_hash is not null
      and b.owner_hash = public.booking_owner_hash(p_owner_token)
      and not b.guest_hidden
      -- The one addition: a group's member unit is represented to the guest
      -- by my_booking_groups() instead, not as a bookings row of its own.
      and b.group_id is null
    order by b.created_at desc;
$$;

grant execute on function public.my_bookings(text) to anon, authenticated;

notify pgrst, 'reload schema';
