-- Food and spa add-ons attach to an existing booking. They are small,
-- always read with their booking, and never queried on their own, so they
-- live as JSONB on the row rather than in two extra tables.
alter table public.bookings
    add column if not exists food_orders jsonb not null default '[]'::jsonb,
    add column if not exists spa_orders  jsonb not null default '[]'::jsonb;

comment on column public.bookings.food_orders is
    'Array of { name, quantity, total } — see foodmenu.jsx';
comment on column public.bookings.spa_orders is
    'Array of { name, quantity, total } — see spaService.jsx';

-- Guests add these from the menu/spa pages without a staff session, so the
-- write goes through a SECURITY DEFINER RPC scoped to appending one order.
--
-- NOTE: superseded by 20260727091500_guest_booking_ownership.sql. This version
-- takes any booking id from anyone, which is exactly the hole that migration
-- closes — it is kept here only because it is what the database actually ran.
create or replace function public.add_booking_addon(
    p_booking_id uuid,
    p_kind       text,          -- 'food' | 'spa'
    p_order      jsonb
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.bookings;
begin
    if p_kind not in ('food', 'spa') then
        raise exception 'Unknown add-on kind: %', p_kind;
    end if;

    update public.bookings
       set food_orders = case when p_kind = 'food'
                              then food_orders || jsonb_build_array(p_order)
                              else food_orders end,
           spa_orders  = case when p_kind = 'spa'
                              then spa_orders || jsonb_build_array(p_order)
                              else spa_orders end,
           updated_at = now()
     where id = p_booking_id
       and status <> 'cancelled'
    returning * into v_row;

    if not found then
        raise exception 'Booking not found or already cancelled';
    end if;

    return v_row;
end;
$$;

grant execute on function public.add_booking_addon(uuid, text, jsonb) to anon, authenticated;
