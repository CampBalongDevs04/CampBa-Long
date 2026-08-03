-- ============================================================================
--  Shared tent pool
-- ----------------------------------------------------------------------------
--  Small Tent, Big Tent and Tent Pitching are three products sold over the
--  SAME patch of camping ground, not three separate inventories. A guest who
--  pitches their own tent is taking up the same physical spot a Small Tent or
--  Big Tent guest would — so booking any one of the three must draw down one
--  shared count, and all three must show the same "X of 4 available".
--
--  `pool_id` names which type's physical units a type actually books against.
--  Null (the default, and every existing type) means "its own units" — no
--  change in behaviour for anything but tents. Small Tent, Big Tent and Tent
--  Pitching all point at 'tent-small', which already owns the 4 physical
--  units seeded in 20260727062929 (TENTS-01..03, TENTL-01) — nothing new is
--  created, they are just shared.
--
--  Tent Pitching gets a real accommodation_types row for the first time. It
--  used to be deliberately absent (see the NOTE at the bottom of
--  20260727062929_accommodation_rls_and_seed.sql) because it had no unit
--  ceiling of its own. It still owns no units of its own — no rows are
--  inserted for it into accommodation_units — it borrows tent-small's four
--  through pool_id below, which is what makes book_accommodation() start
--  holding a real unit for it instead of booking unlimited.
-- ============================================================================

alter table public.accommodation_types
    add column if not exists pool_id text references public.accommodation_types (id);

insert into public.accommodation_types (id, name, prefix, total, sort_order, pool_id)
values ('tent-pitching', 'Tent Pitching', 'PITCH', 4, 6, 'tent-small')
on conflict (id) do update set
    name      = excluded.name,
    is_active = true;

update public.accommodation_types set total = 4, pool_id = 'tent-small' where id = 'tent-small';
update public.accommodation_types set total = 4, pool_id = 'tent-small' where id = 'tent-large';
update public.accommodation_types set total = 4, pool_id = 'tent-small' where id = 'tent-pitching';

insert into public.accommodation_rates (type_id, rate_group, price, pax_label, min_pax, max_pax)
values ('tent-pitching', 'overnight', 500, 'Any group size', null, null)
on conflict (type_id, rate_group) do nothing;


-- ================================================================== queries
-- Same signature as 20260727062903_accommodation_functions.sql — only the
-- body changes, so every caller (accommodation_availability,
-- next_available_date, book_accommodation) picks up pool-aware counting for
-- free.

create or replace function public.available_units(
    p_type_id      text,
    p_check_in     date,
    p_check_out    date default null,
    p_schedule_key text default null
)
returns table (unit_id text)
language sql
stable
set search_path = public
as $$
    with w as (
        select * from public.occupancy_window(p_check_in, p_check_out, p_schedule_key)
    ),
    pool as (
        select coalesce(
            (select t.pool_id from public.accommodation_types t where t.id = p_type_id),
            p_type_id
        ) as pool_id
    )
    select u.id
    from public.accommodation_units u, w, pool
    where u.type_id in (
              select t.id from public.accommodation_types t
              where coalesce(t.pool_id, t.id) = pool.pool_id
          )
      and u.is_active
      and not exists (
          select 1 from public.bookings b
          where b.unit_id = u.id
            and b.status <> 'cancelled'
            and b.occupancy && tstzrange(w.starts_at, w.ends_at, '[)')
      )
    order by u.unit_no;
$$;
