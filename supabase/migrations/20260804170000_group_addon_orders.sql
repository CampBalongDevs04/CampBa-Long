-- ============================================================================
--  Camp Ba-long — food and spa orders against a combined reservation
-- ----------------------------------------------------------------------------
--  Combined reservations shipped without this (see the header of
--  20260804150000_accommodation_booking_groups.sql) — findOrderableBooking()
--  only ever looked at single-unit bookings, so a guest whose only reservation
--  was a group got "you need a booking before you can order" even though they
--  very much had one.
--
--  add_group_addon() is add_booking_addon() (payment_window_expires.sql)
--  mirrored onto booking_groups: same validation, same catalog-id check, same
--  hold-window refusal — just against the group's own row instead of one
--  unit's. The order goes on the GROUP, not any one member unit, which is the
--  right place for it: a food order is for the whole stay, not the Teepee in
--  particular. This is also why groups still have food_orders/spa_orders
--  columns even though the earlier migration's header called them unused —
--  this is that follow-up.
-- ============================================================================

create or replace function public.add_group_addon(
    p_group_id    uuid,
    p_kind        text,          -- 'food' | 'spa'
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
    if p_kind not in ('food', 'spa') then
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

    -- An id that isn't in the catalog is dropped rather than refused: the order
    -- itself is legitimate (staff can still read the name and price off it), so
    -- a stale menu in a long-open browser tab must not cost the guest a meal.
    if v_item_id is not null then
        if p_kind = 'food' then
            if not exists (select 1 from public.food_menu_items where id = v_item_id) then
                v_item_id := null;
            end if;
        else
            if not exists (select 1 from public.spa_services where id = v_item_id) then
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
