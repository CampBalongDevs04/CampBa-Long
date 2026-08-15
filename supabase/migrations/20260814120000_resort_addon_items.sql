-- ============================================================================
--  Camp Ba-long — a third add-on kind: physical items (towel, pillow, …)
-- ----------------------------------------------------------------------------
--  Food and spa orders were already ONE mechanism with a 'food' | 'spa'
--  discriminator (add_booking_addon() / add_group_addon(), both SECURITY
--  DEFINER, both validating itemId against a catalog table for the kind).
--  This migration is the same shape a third time: 'item', validated against
--  a new resort_addon_items catalog, for things a guest can request that
--  aren't food or a treatment — starting with the four the booking page's
--  post-reservation upsell offers.
--
--  NOTHING ABOUT THE HOLD-WINDOW RULE CHANGES HERE
--  -------------------------------------------------
--  It was tempting to assume add_booking_addon() required a receipt before
--  ordering (that WAS true in 20260730120000_food_and_spa_catalog.sql), but
--  20260730200000_payment_window_expires.sql already replaced that check
--  with booking_hold_expired() — ordering is refused only once the booking
--  is cancelled or its 10-minute hold has lapsed, receipt or not. That is
--  exactly what a pre-payment upsell popup needs, and it already existed.
--  This migration copies the CURRENT bodies of both functions (from that
--  migration and 20260804170000_group_addon_orders.sql) verbatim, widening
--  only the kind check and the catalog-validation branch.
-- ============================================================================


-- ===================================================== resort_addon_items
-- Same shape as food_menu_items / spa_services: public-readable (the popup
-- is public), staff-writable. Seeded with the four items the popup offers;
-- editable directly in Postgres if a price changes — no dashboard CRUD for
-- this catalog yet, same as tent-pitching's rate was seeded by hand before
-- it got one.

create table if not exists public.resort_addon_items (
    id          text primary key,       -- 'towel', 'extra-bedding'
    name        text not null,
    description text,
    price       numeric(10,2) not null check (price >= 0),
    sort_order  integer not null default 0,
    is_active   boolean not null default true
);

comment on table public.resort_addon_items is
    'Physical add-ons a guest can request against a booking (towel, pillow, '
    'extra bedding, electric fan, …) — the third add-on kind alongside food '
    'and spa. Same order-line shape, see bookings.item_orders.';

alter table public.resort_addon_items enable row level security;

drop policy if exists "addon items are public" on public.resort_addon_items;
create policy "addon items are public" on public.resort_addon_items
    for select to anon, authenticated using (true);

drop policy if exists "staff manage addon items" on public.resort_addon_items;
create policy "staff manage addon items" on public.resort_addon_items
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

insert into public.resort_addon_items (id, name, description, price, sort_order)
values
    ('towel',         'Towel',          'One bath towel.',                    100, 1),
    ('pillow',        'Pillow',         'One extra pillow.',                   50, 2),
    ('extra-bedding', 'Extra Bedding',  'One extra set of bedding.',          500, 3),
    ('electric-fan',  'Electric Fan',   'One standing electric fan.',         200, 4)
on conflict (id) do nothing;


-- ============================================================ item_orders
-- Same shape as food_orders/spa_orders: [{ itemId, name, unitPrice,
-- quantity, total, orderedAt }].

alter table public.bookings
    add column if not exists item_orders jsonb not null default '[]'::jsonb;

comment on column public.bookings.item_orders is
    'Array of { itemId, name, unitPrice, quantity, total, orderedAt } — '
    'itemId → resort_addon_items.id. Third add-on kind alongside food_orders '
    '/ spa_orders.';

alter table public.booking_groups
    add column if not exists item_orders jsonb not null default '[]'::jsonb;

comment on column public.booking_groups.item_orders is
    'Same as bookings.item_orders, for a combined reservation.';


-- ============================================== downpayment, regenerated
-- Same pattern as 20260730160000_payment_after_booking.sql:85-96 — drop and
-- re-add, since a generated expression cannot be altered in place. Both
-- tables' formulas gain + addon_total(item_orders); nothing else changes.

alter table public.bookings drop column if exists downpayment;

alter table public.bookings
    add column downpayment numeric(10,2)
    generated always as (
        round((
            coalesce(price, 0)
            + coalesce(entrance_total, 0)
            + public.addon_total(food_orders)
            + public.addon_total(spa_orders)
            + public.addon_total(item_orders)
        ) * 0.5, 2)
    ) stored;

comment on column public.bookings.downpayment is
    '50% of the whole stay — unit rate + entrance + food + spa + item '
    'add-ons. Generated: it moves on its own as add-ons are ordered, and '
    'cannot be written directly.';

alter table public.booking_groups drop column if exists downpayment;

alter table public.booking_groups
    add column downpayment numeric(10,2)
    generated always as (
        round((
            coalesce(unit_subtotal, 0)
            + coalesce(entrance_total, 0)
            + public.addon_total(food_orders)
            + public.addon_total(spa_orders)
            + public.addon_total(item_orders)
        ) * 0.5, 2)
    ) stored;

comment on column public.booking_groups.downpayment is
    'Same formula as bookings.downpayment, against unit_subtotal instead of '
    'a single price.';


-- ===================================================== add_booking_addon
-- Current definition (20260730200000_payment_window_expires.sql) reproduced
-- verbatim, widened to a third kind. The hold-window / cancellation checks
-- are byte-for-byte what they already were — see the header above.

create or replace function public.add_booking_addon(
    p_booking_id  uuid,
    p_kind        text,          -- 'food' | 'spa' | 'item'
    p_order       jsonb,
    p_owner_token text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row       public.bookings := public.owned_booking(p_booking_id, p_owner_token);
    v_name      text    := nullif(btrim(p_order ->> 'name'), '');
    v_quantity  integer := floor(coalesce((p_order ->> 'quantity')::numeric, 0));
    v_total     numeric := round(coalesce((p_order ->> 'total')::numeric, 0), 2);
    v_unit_cost numeric := round(coalesce((p_order ->> 'unitPrice')::numeric, 0), 2);
    v_item_id   text    := nullif(btrim(p_order ->> 'itemId'), '');
    v_clean     jsonb;
begin
    if p_kind not in ('food', 'spa', 'item') then
        raise exception 'Unknown add-on kind: %', p_kind using errcode = 'P0001';
    end if;

    if v_name is null or v_quantity < 1 or v_total < 0 or v_unit_cost < 0 then
        raise exception 'That order is not valid.' using errcode = 'P0001';
    end if;

    if v_row.status = 'cancelled' then
        if v_row.cancel_reason = 'payment-timeout' then
            raise exception
                'Your % minute payment window closed, so this booking was cancelled. Please try to book again.',
                public.payment_window_minutes()
                using errcode = 'P0001', hint = 'payment-timeout';
        end if;
        raise exception 'That booking is cancelled.' using errcode = 'P0001';
    end if;

    if public.booking_hold_expired(v_row.status, v_row.receipt_url, v_row.created_at) then
        perform public.expire_stale_bookings();
        raise exception
            'Your % minute payment window closed, so this booking was cancelled. Please try to book again.',
            public.payment_window_minutes()
            using errcode = 'P0001', hint = 'payment-timeout';
    end if;

    -- An id that isn't in the catalog is dropped rather than refused: the order
    -- itself is legitimate (staff can still read the name and price off it), so
    -- a stale menu in a long-open browser tab must not cost the guest a meal.
    if v_item_id is not null then
        if p_kind = 'food' then
            if not exists (select 1 from public.food_menu_items where id = v_item_id) then
                v_item_id := null;
            end if;
        elsif p_kind = 'spa' then
            if not exists (select 1 from public.spa_services where id = v_item_id) then
                v_item_id := null;
            end if;
        else
            if not exists (select 1 from public.resort_addon_items where id = v_item_id) then
                v_item_id := null;
            end if;
        end if;
    end if;

    v_clean := jsonb_build_object(
        'itemId', v_item_id,
        'name', left(v_name, 120),
        'unitPrice', v_unit_cost,
        'quantity', least(v_quantity, 999),
        'total', v_total,
        'orderedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    );

    update public.bookings
       set food_orders = case when p_kind = 'food'
                              then food_orders || jsonb_build_array(v_clean)
                              else food_orders end,
           spa_orders  = case when p_kind = 'spa'
                              then spa_orders  || jsonb_build_array(v_clean)
                              else spa_orders  end,
           item_orders = case when p_kind = 'item'
                              then item_orders || jsonb_build_array(v_clean)
                              else item_orders end,
           updated_at = now()
     where id = p_booking_id
    returning * into v_row;

    v_row.owner_hash      := null;
    v_row.receipt_url     := case when v_row.receipt_url is null then null else 'pending-upload' end;
    v_row.receipt_uploads := public.masked_receipt_uploads(v_row.receipt_uploads);
    return v_row;
end;
$$;

grant execute on function public.add_booking_addon(uuid, text, jsonb, text) to anon, authenticated;


-- ======================================================= add_group_addon
-- Current definition (20260804170000_group_addon_orders.sql) reproduced
-- verbatim, widened the same way.

create or replace function public.add_group_addon(
    p_group_id    uuid,
    p_kind        text,          -- 'food' | 'spa' | 'item'
    p_order       jsonb,
    p_owner_token text
)
returns public.booking_groups
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row       public.booking_groups := public.owned_booking_group(p_group_id, p_owner_token);
    v_name      text    := nullif(btrim(p_order ->> 'name'), '');
    v_quantity  integer := floor(coalesce((p_order ->> 'quantity')::numeric, 0));
    v_total     numeric := round(coalesce((p_order ->> 'total')::numeric, 0), 2);
    v_unit_cost numeric := round(coalesce((p_order ->> 'unitPrice')::numeric, 0), 2);
    v_item_id   text    := nullif(btrim(p_order ->> 'itemId'), '');
    v_clean     jsonb;
begin
    if p_kind not in ('food', 'spa', 'item') then
        raise exception 'Unknown add-on kind: %', p_kind using errcode = 'P0001';
    end if;

    if v_name is null or v_quantity < 1 or v_total < 0 or v_unit_cost < 0 then
        raise exception 'That order is not valid.' using errcode = 'P0001';
    end if;

    if v_row.status = 'cancelled' then
        if v_row.cancel_reason = 'payment-timeout' then
            raise exception
                'Your % minute payment window closed, so this reservation was cancelled. Please try to book again.',
                public.payment_window_minutes()
                using errcode = 'P0001', hint = 'payment-timeout';
        end if;
        raise exception 'That reservation is cancelled.' using errcode = 'P0001';
    end if;

    if public.booking_hold_expired(v_row.status, v_row.receipt_url, v_row.created_at) then
        perform public.expire_stale_booking_groups();
        raise exception
            'Your % minute payment window closed, so this reservation was cancelled. Please try to book again.',
            public.payment_window_minutes()
            using errcode = 'P0001', hint = 'payment-timeout';
    end if;

    if v_item_id is not null then
        if p_kind = 'food' then
            if not exists (select 1 from public.food_menu_items where id = v_item_id) then
                v_item_id := null;
            end if;
        elsif p_kind = 'spa' then
            if not exists (select 1 from public.spa_services where id = v_item_id) then
                v_item_id := null;
            end if;
        else
            if not exists (select 1 from public.resort_addon_items where id = v_item_id) then
                v_item_id := null;
            end if;
        end if;
    end if;

    v_clean := jsonb_build_object(
        'itemId', v_item_id,
        'name', left(v_name, 120),
        'unitPrice', v_unit_cost,
        'quantity', least(v_quantity, 999),
        'total', v_total,
        'orderedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    );

    update public.booking_groups
       set food_orders = case when p_kind = 'food'
                              then food_orders || jsonb_build_array(v_clean)
                              else food_orders end,
           spa_orders  = case when p_kind = 'spa'
                              then spa_orders  || jsonb_build_array(v_clean)
                              else spa_orders  end,
           item_orders = case when p_kind = 'item'
                              then item_orders || jsonb_build_array(v_clean)
                              else item_orders end,
           updated_at = now()
     where id = p_group_id
    returning * into v_row;

    v_row.owner_hash      := null;
    v_row.receipt_url     := case when v_row.receipt_url is null then null else 'pending-upload' end;
    v_row.receipt_uploads := public.masked_receipt_uploads(v_row.receipt_uploads);
    return v_row;
end;
$$;

grant execute on function public.add_group_addon(uuid, text, jsonb, text) to anon, authenticated;

notify pgrst, 'reload schema';
