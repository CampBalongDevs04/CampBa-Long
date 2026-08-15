-- ============================================================================
--  Camp Ba-long — item_orders was missing from what guests can read back
-- ----------------------------------------------------------------------------
--  20260814120000_resort_addon_items.sql added bookings.item_orders /
--  booking_groups.item_orders and wired add_booking_addon()/add_group_addon()
--  to write to them — confirmed working, an order really does land on the
--  row. But my_bookings() and my_booking_groups() list their output columns
--  explicitly (rather than `select *`), and neither was updated to include
--  the new one. Writing an order worked exactly as intended; a guest reading
--  their own booking back on My Bookings just never saw it, because the RPC
--  they read through was still the old shape — "Add-ons: none" even with a
--  towel actually sitting in the row.
--
--  The staff/admin path was never affected: loadStaffBookings() in
--  accommodationDB.js reads straight off the tables with `select *`, which
--  picks up any column that exists without needing a matching edit here.
--
--  Both functions are DROPPED and recreated, not CREATE OR REPLACE: adding an
--  output column changes the return type, which Postgres refuses to patch in
--  place — same reason 20260730200000_payment_window_expires.sql and
--  20260806140000_pwd_count.sql had to do it for these same two functions.
--  Bodies are otherwise byte-for-byte their current definitions, with
--  `item_orders` inserted right after `spa_orders` throughout — the same
--  position it lives in on both tables.
-- ============================================================================

drop function if exists public.my_bookings(text);

create function public.my_bookings(p_owner_token text)
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
    item_orders     jsonb,
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
           b.food_orders, b.spa_orders, b.item_orders, b.created_at,
           b.cancel_reason,
           public.payment_due_at(b.created_at),
           now()
    from public.bookings b
    where b.owner_hash is not null
      and b.owner_hash = public.booking_owner_hash(p_owner_token)
      and not b.guest_hidden
      -- A group's member unit is represented to the guest by
      -- my_booking_groups() instead, not as a bookings row of its own.
      and b.group_id is null
    order by b.created_at desc;
$$;

grant execute on function public.my_bookings(text) to anon, authenticated;


drop function if exists public.my_booking_groups(text);

create function public.my_booking_groups(p_owner_token text)
returns table (
    id              uuid,
    code            text,
    status          public.booking_status,
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
    pwd             integer,
    unit_subtotal   numeric,
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
    item_orders     jsonb,
    units           jsonb,
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
    select g.id, g.code, g.status, g.schedule_key,
           g.check_in_date, g.check_out_date, g.starts_at, g.ends_at,
           g.guest_name, g.guest_email, g.guest_mobile,
           g.pax, g.kids, g.seniors, g.pwd,
           g.unit_subtotal, g.downpayment,
           g.entrance_total, g.entrance_per_head, g.entrance_senior_discount,
           g.entrance_free_applied, g.entrance_free_savings,
           g.payment,
           case when g.receipt_url is null then null else 'pending-upload' end,
           public.masked_receipt_uploads(g.receipt_uploads),
           g.food_orders, g.spa_orders, g.item_orders,
           coalesce(
               jsonb_agg(
                   jsonb_build_object('unitId', b.unit_id, 'typeId', b.type_id, 'price', b.price)
                   order by b.created_at
               ) filter (where b.id is not null),
               '[]'::jsonb
           ),
           g.created_at, g.cancel_reason,
           public.payment_due_at(g.created_at),
           now()
    from public.booking_groups g
    left join public.bookings b on b.group_id = g.id
    where g.owner_hash is not null
      and g.owner_hash = public.booking_owner_hash(p_owner_token)
      and not g.guest_hidden
    group by g.id
    order by g.created_at desc;
$$;

grant execute on function public.my_booking_groups(text) to anon, authenticated;

notify pgrst, 'reload schema';
