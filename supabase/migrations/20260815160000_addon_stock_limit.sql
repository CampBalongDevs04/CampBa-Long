-- ============================================================================
--  Camp Ba-long — a shared stock ceiling for physical add-ons
-- ----------------------------------------------------------------------------
--  THE GAP
--  --------
--  Towel, Pillow, Extra Bedding and Electric Fan (resort_addon_items) have no
--  ceiling at all — a guest could request 500 towels, and there is nothing
--  stopping a dozen different guests staying the same weekend from
--  collectively claiming far more fans than the resort actually owns.
--
--  WHY THIS ISN'T BUILT LIKE accommodation_types
--  ------------------------------------------------
--  accommodation_types.total is "how many discrete named units exist"
--  (AHS-01, AHS-02, …) — a booking claims exactly ONE of them, and the
--  bookings_no_double_booking GiST exclusion constraint (unit_id with =,
--  occupancy with &&) is what makes that race-proof.
--
--  An add-on request is a QUANTITY, not a pick-one — a guest wants 3 towels,
--  not "give me towel #4". There is no equivalent exclusion constraint for
--  "sum of quantities across overlapping rows must not exceed N": exclusion
--  constraints compare pairs of rows, they have no notion of a running total.
--  So this is enforced procedurally instead, inside the same functions that
--  already write item_orders, guarded by an advisory lock in lieu of the
--  constraint units get for free.
--
--  WHERE THE OVERLAP CHECK READS FROM
--  -------------------------------------
--  item_orders has never been its own table — it is a jsonb array column
--  sitting directly on `bookings` and `booking_groups` (this migration adds
--  no new table or column to store an order line, and needs none: both of
--  those tables already carry `occupancy` and `status`, the exact two things
--  available_units()/hold_conflict() already filter overlapping bookings by).
--  addon_stock_status() below sums the `quantity` out of every order line
--  across BOTH tables whose `occupancy` overlaps the window asked about —
--  the same `occupancy && tstzrange(...)` test used everywhere else in this
--  project, just aggregated with sum() instead of count(*).
--
--  add_booking_addon() / add_group_addon() keep their EXACT signatures —
--  only their bodies change (the 'item' branch gains a stock check right
--  before the row is written), so this is CREATE OR REPLACE, not a drop.
--  Bodies below are the current ones from 20260814120000_resort_addon_items.sql
--  reproduced in full (confirmed the latest — no migration since has touched
--  either function), widened only where noted.
-- ============================================================================


-- ============================================================ stock column

alter table public.resort_addon_items
    add column if not exists stock_total integer
        check (stock_total is null or stock_total >= 0);

comment on column public.resort_addon_items.stock_total is
    'How many of this physical item the resort owns — the ceiling on requests '
    'whose stay windows overlap. Same relationship accommodation_types.total '
    'has to its units, except this is a shared QUANTITY split across however '
    'many bookings ask for it, not discrete named units one booking claims '
    'outright. Null means unlimited — every add-on stays unlimited until '
    'staff set a number.';


-- ===================================================== addon_stock_status
-- The party's total claim on one item across every booking or group whose
-- stay overlaps the window asked about, plus what that leaves free. Read by
-- the booking page to show "2 left" and cap the stepper, and by the write
-- path below to refuse a request that would go over.

create or replace function public.addon_stock_status(
    p_item_id      text,
    p_check_in     date,
    p_check_out    date,
    p_schedule_key text
)
returns table (
    stock_total integer,
    claimed     integer,
    available   integer   -- null when the item has no limit
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_window record;
    v_total  integer;
begin
    select * into v_window from public.occupancy_window(p_check_in, p_check_out, p_schedule_key);

    select r.stock_total into v_total
    from public.resort_addon_items r
    where r.id = p_item_id;

    if v_total is null then
        return query select null::integer, 0, null::integer;
        return;
    end if;

    return query
    with sums as (
        select coalesce(sum((line.value ->> 'quantity')::integer), 0)::integer as claimed
        from (
            select item_orders, occupancy from public.bookings where status <> 'cancelled'
            union all
            select item_orders, occupancy from public.booking_groups where status <> 'cancelled'
        ) rows
        cross join lateral jsonb_array_elements(rows.item_orders) as line
        where line.value ->> 'itemId' = p_item_id
          and rows.occupancy && tstzrange(v_window.starts_at, v_window.ends_at, '[)')
    )
    select v_total, sums.claimed, greatest(v_total - sums.claimed, 0)
    from sums;
end;
$$;

grant execute on function public.addon_stock_status(text, date, date, text) to anon, authenticated;


-- ===================================================== add_booking_addon
-- Signature unchanged from 20260814120000_resort_addon_items.sql. Only new
-- code: right before the 'item' order is written, a limited item's stock is
-- re-checked under an advisory lock scoped to that item id — transaction-
-- scoped (released automatically at commit or rollback), so it serializes
-- concurrent claims on the SAME item without blocking claims on a different
-- one. This is what an exclusion constraint gives units for free; a sum has
-- no such constraint to lean on, so the lock is what closes the race instead.

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
    v_stock     record;
    v_name_for_msg text;
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

    -- Stock check — only for a still-recognised 'item' order, only when the
    -- item actually has a limit set. Locked on the item id so two guests
    -- racing for the last few units of the SAME item are serialized against
    -- each other; a different item is untouched.
    if p_kind = 'item' and v_item_id is not null then
        perform pg_advisory_xact_lock(hashtext('resort-addon-stock:' || v_item_id));

        select * into v_stock from public.addon_stock_status(
            v_item_id, v_row.check_in_date, v_row.check_out_date, v_row.schedule_key);

        if v_stock.stock_total is not null and v_stock.claimed + least(v_quantity, 999) > v_stock.stock_total then
            select name into v_name_for_msg from public.resort_addon_items where id = v_item_id;
            raise exception using
                errcode = 'P0001',
                message = format('%s: only %s left for those dates.', coalesce(v_name_for_msg, 'That add-on'), v_stock.available),
                hint    = 'unavailable';
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
-- Same addition, same signature, for a combined reservation.

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
    v_stock     record;
    v_name_for_msg text;
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

    if p_kind = 'item' and v_item_id is not null then
        perform pg_advisory_xact_lock(hashtext('resort-addon-stock:' || v_item_id));

        select * into v_stock from public.addon_stock_status(
            v_item_id, v_row.check_in_date, v_row.check_out_date, v_row.schedule_key);

        if v_stock.stock_total is not null and v_stock.claimed + least(v_quantity, 999) > v_stock.stock_total then
            select name into v_name_for_msg from public.resort_addon_items where id = v_item_id;
            raise exception using
                errcode = 'P0001',
                message = format('%s: only %s left for those dates.', coalesce(v_name_for_msg, 'That add-on'), v_stock.available),
                hint    = 'unavailable';
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
