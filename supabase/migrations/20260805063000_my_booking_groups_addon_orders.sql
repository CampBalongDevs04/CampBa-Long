-- ============================================================================
--  Camp Ba-long — my_booking_groups() was silently dropping food/spa orders
-- ----------------------------------------------------------------------------
--  THE BUG
--  -------
--  add_group_addon() (20260804170000_group_addon_orders.sql) writes food and
--  spa orders onto booking_groups.food_orders/spa_orders, and the group's
--  generated `downpayment` column already folds them in — so the amount due
--  shown on My Bookings was always right. But my_booking_groups() — the RPC
--  the guest-facing My Bookings page actually calls — never selected those
--  two columns, unlike my_bookings() (b.food_orders, b.spa_orders) for a
--  single-unit booking. fromGroupRow() in accommodationDB.js reads
--  row.food_orders ?? [] / row.spa_orders ?? [], so every combined
--  reservation looked like it had no add-ons at all: "Spa: none • Food: none"
--  in the summary line, and no "Food & spa" section in the payment
--  breakdown — even when the guest had ordered both and the admin dashboard
--  (which reads booking_groups.* directly) showed them plainly.
--
--  THE FIX
--  -------
--  Postgres won't let CREATE OR REPLACE change a function's output columns,
--  so this drops and recreates my_booking_groups() with food_orders and
--  spa_orders added — same two columns my_bookings() already returns.
-- ============================================================================

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
           g.pax, g.kids, g.seniors,
           g.unit_subtotal, g.downpayment,
           g.entrance_total, g.entrance_per_head, g.entrance_senior_discount,
           g.entrance_free_applied, g.entrance_free_savings,
           g.payment,
           case when g.receipt_url is null then null else 'pending-upload' end,
           public.masked_receipt_uploads(g.receipt_uploads),
           g.food_orders, g.spa_orders,
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
