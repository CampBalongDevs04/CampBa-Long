-- ============================================================================
--  Camp Ba-long — food menu and spa service catalog
-- ----------------------------------------------------------------------------
--  Until now the menu and the spa price list were arrays literal in
--  src/pages/foodmenu.jsx and src/pages/spaService.jsx, and the admin
--  dashboard imported those arrays from the guest pages to show staff "what we
--  sell". That meant a price change was a code change and a redeploy, and the
--  orders sitting on booking rows referred to their items by display name
--  only — rename a dish and last month's orders stop matching anything.
--
--  These two tables are that catalog, in Postgres:
--
--    food_menu_items — one row per ORDERABLE LINE, not per dish. A coffee
--                      flavor at three cup sizes is three rows, because that
--                      is what a guest actually adds to their order and what
--                      an order line has to point back at.
--    spa_services    — one row per treatment.
--
--  Both are public-readable (the menu page is public) and staff-writable, the
--  same shape as accommodation_types: the catalog is not secret, the bookings
--  are.
--
--  WHY IMAGE **KEYS** AND NOT URLS
--  -------------------------------
--  The dish photos are bundled assets — Vite hashes them at build time and the
--  final URL is not knowable from SQL. So a row carries the asset's key
--  ('menu1', 'combo3', 'massage44') and src/data/menuDB.js maps that key to the
--  imported module. A row with an unknown or null key still renders; it just
--  has no photo. Nothing here breaks if the assets are reorganised.
--
--  ORDERS STILL LIVE ON THE BOOKING ROW
--  ------------------------------------
--  bookings.food_orders / spa_orders stay as they are (see
--  20260727063353_booking_addon_orders.sql) — they are always read with their
--  booking and never queried on their own. What changes is that each stored
--  order now also carries `itemId`, the catalog row it came from, so the admin
--  dashboard can group "what was ordered" by item instead of by string.
-- ============================================================================


-- ========================================================== food_menu_items

create table if not exists public.food_menu_items (
    id                text primary key,          -- 'sinigang-na-liempo', 'coffee-classic-hot-americano-1'
    category          text not null
        check (category in ('breakfast', 'combo', 'pre-order', 'coffee')),
    name              text not null,
    description       text,
    price             numeric(10,2) not null check (price >= 0),

    -- Bundled asset key, resolved in src/data/menuDB.js. Null for coffee,
    -- which is priced in tables and has no per-flavor photo.
    image_key         text,

    -- Coffee only: which price table the row belongs to and which column of it.
    group_key         text,
    group_title       text,
    size_label        text,

    -- Combo meals include a coffee the guest picks in the order modal; a
    -- flavored pick adds a fixed upcharge on top of this price.
    has_coffee_option boolean not null default false,

    sort_order        integer not null default 0,
    is_active         boolean not null default true
);

comment on table public.food_menu_items is
    'The food menu. One row per orderable line — each coffee size is its own row.';
comment on column public.food_menu_items.image_key is
    'Bundled asset key (menu1, combo3, …) resolved by src/data/menuDB.js, not a URL.';
comment on column public.food_menu_items.has_coffee_option is
    'Combo meal: the guest picks the included coffee, flavored picks cost extra.';

create index if not exists food_menu_items_category_idx
    on public.food_menu_items (category, sort_order) where is_active;


-- ============================================================= spa_services

create table if not exists public.spa_services (
    id              text primary key,            -- 'ventosa-cupping'
    name            text not null,
    description     text,
    duration_label  text,                        -- '1hr 30mins'
    price           numeric(10,2) not null check (price >= 0),
    image_key       text,
    sort_order      integer not null default 0,
    is_active       boolean not null default true
);

comment on table public.spa_services is
    'Hilot Wellness Spa treatments a guest can avail on top of a booking.';


-- ===================================================================== RLS
-- Same split as the accommodation catalog: anyone may read what is for sale,
-- only the staff roster may change it.

alter table public.food_menu_items enable row level security;
alter table public.spa_services    enable row level security;

drop policy if exists "menu is public" on public.food_menu_items;
create policy "menu is public" on public.food_menu_items
    for select to anon, authenticated using (true);

drop policy if exists "staff manage the menu" on public.food_menu_items;
create policy "staff manage the menu" on public.food_menu_items
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "spa services are public" on public.spa_services;
create policy "spa services are public" on public.spa_services
    for select to anon, authenticated using (true);

drop policy if exists "staff manage spa services" on public.spa_services;
create policy "staff manage spa services" on public.spa_services
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ================================================================== seeding
--  The values below are exactly what the front end had hardcoded, so applying
--  this migration changes nothing a guest sees — it only moves where the menu
--  comes from. `on conflict do nothing` keeps a later price edit made in the
--  dashboard from being reverted by a re-run.

insert into public.food_menu_items
    (id, category, name, description, price, image_key, sort_order)
values
    ('sinigang-na-liempo', 'breakfast', 'Sinigang na Liempo', 'Good for 4-5 pax', 700, 'menu1', 1),
    ('fried-chicken',      'breakfast', 'Fried Chicken',      'Good for 3-4 pax', 350, 'menu2', 2),
    ('tinola',             'breakfast', 'Tinola',             'Good for 4-6 pax', 600, 'menu3', 3),
    ('inihaw-na-liempo',   'breakfast', 'Inihaw na Liempo',   'Good for 3-4 pax', 500, 'menu4', 4),
    ('inihaw-na-tilapia',  'breakfast', 'Inihaw na Tilapia',  'Good for 3-4 pax', 400, 'menu5', 5),
    ('pork-sisig',         'breakfast', 'Pork Sisig',         'Good for 3-4 pax', 400, 'menu6', 6),
    ('pork-adobo',         'breakfast', 'Pork Adobo',         'Good for 3-4 pax', 500, 'menu7', 7)
on conflict (id) do nothing;

insert into public.food_menu_items
    (id, category, name, description, price, image_key, has_coffee_option, sort_order)
values
    ('longsilog',     'combo', 'Longsilog',     'Longganisa, Sinangag at Itlog with Classic Hot Coffee', 230, 'combo1', true, 1),
    ('hotsilog',      'combo', 'Hotsilog',      'Hotdog, Sinangag at Itlog with Classic Hot Coffee',     230, 'combo2', true, 2),
    ('tapsilog',      'combo', 'Tapsilog',      'Tapa, Sinangag at Itlog with Classic Hot Coffee',       260, 'combo3', true, 3),
    ('tocilog',       'combo', 'Tocilog',       'Tocino, Sinangag at Itlog with Classic Hot Coffee',     260, 'combo4', true, 4),
    ('chicksilog',    'combo', 'Chicksilog',    'Chicken, Sinangag at Itlog with Classic Hot Coffee',    310, 'combo5', true, 5),
    ('shanghaisilog', 'combo', 'Shanghaisilog', 'Shanghai, Sinangag at Itlog with Classic Hot Coffee',   230, 'combo6', true, 6),
    ('liemposilog',   'combo', 'Liemposilog',   'Liempo, Sinangag at Itlog with Classic Hot Coffee',     310, 'combo7', true, 7)
on conflict (id) do nothing;

-- Pre-Order repeats one dish name at three sizes, which is exactly why an
-- order line needs an id rather than a name to point at.
insert into public.food_menu_items
    (id, category, name, description, price, image_key, sort_order)
values
    ('pre-order-pancit-tray',   'pre-order', 'Pancit Bihon / Canton', 'Good for 6-7 pax',  400, 'pre1', 1),
    ('pre-order-pancit-large',  'pre-order', 'Pancit Bihon / Canton', 'Large Bilao',      1500, 'pre2', 2),
    ('pre-order-pancit-medium', 'pre-order', 'Pancit Bihon / Canton', 'Medium Bilao',      800, 'pre3', 3),
    ('pre-order-tofu-sisig',    'pre-order', 'Tofu Sisig',            'Good for 3-4 pax',  250, 'pre4', 4)
on conflict (id) do nothing;

-- Bukal Cafe by Camp Ba-Long Nature Farm. Expanded from (flavor × size)
-- rather than written out 77 times, so a price stays next to the flavor it
-- belongs to and a mismatched row length is impossible to introduce by hand.
with groups (group_key, group_title, group_order, size_labels) as (
    values
        ('classic-hot',   'Classic Hot Coffee',        1, array['8oz.', '12oz.', '16oz.']),
        ('classic-iced',  'Classic Iced Coffee',       2, array['Tall 12oz.', 'Grande 16oz.']),
        ('flavored-hot',  'Flavored Hot Special',      3, array['8oz.', '12oz.', '16oz.']),
        ('flavored-iced', 'Flavored Iced Special',     4, array['Tall 12oz.', 'Grande 16oz.']),
        ('iced-fruit',    'Iced Fruit Soda and Latte', 5, array['Tall 12oz.', 'Grande 16oz.'])
),
flavors (group_key, name, flavor_order, prices) as (
    values
        ('classic-hot',   'Americano',                1, array[110, 125, 130]::numeric[]),
        ('classic-hot',   'Cafe Latte',               2, array[120, 125, 140]::numeric[]),
        ('classic-hot',   'Cappuccino',               3, array[125, 140, 145]::numeric[]),
        ('classic-hot',   'Cafe Mocha',               4, array[125, 140, 145]::numeric[]),
        ('classic-hot',   'White Mocha',              5, array[125, 140, 145]::numeric[]),
        ('classic-hot',   'Caramel Machiatto',        6, array[125, 140, 145]::numeric[]),
        ('classic-hot',   'Spanish Latte',            7, array[125, 140, 145]::numeric[]),

        ('classic-iced',  'Americano',                1, array[125, 130]::numeric[]),
        ('classic-iced',  'Cafe Latte',               2, array[125, 130]::numeric[]),
        ('classic-iced',  'Cappuccino',               3, array[140, 145]::numeric[]),
        ('classic-iced',  'Cafe Mocha',               4, array[140, 145]::numeric[]),
        ('classic-iced',  'Caramel Machiatto',        5, array[140, 145]::numeric[]),
        ('classic-iced',  'Spanish Latte',            6, array[140, 145]::numeric[]),

        ('flavored-hot',  'Vanilla Latte',            1, array[130, 145, 155]::numeric[]),
        ('flavored-hot',  'Hazelnut Latte',           2, array[130, 145, 155]::numeric[]),
        ('flavored-hot',  'Choco Hazelnut Latte',     3, array[130, 145, 155]::numeric[]),
        ('flavored-hot',  'Salted Caramel Latte',     4, array[130, 145, 155]::numeric[]),
        ('flavored-hot',  'Matcha Latte',             5, array[130, 145, 155]::numeric[]),
        ('flavored-hot',  'Strawberry Matcha Latte',  6, array[135, 160, 160]::numeric[]),

        ('flavored-iced', 'Vanilla Latte',            1, array[145, 155]::numeric[]),
        ('flavored-iced', 'Hazelnut Latte',           2, array[145, 155]::numeric[]),
        ('flavored-iced', 'Choco Hazelnut Latte',     3, array[145, 155]::numeric[]),
        ('flavored-iced', 'Salted Caramel Latte',     4, array[145, 155]::numeric[]),
        ('flavored-iced', 'Matcha Latte',             5, array[145, 155]::numeric[]),
        ('flavored-iced', 'Brown Sugar Latte',        6, array[145, 155]::numeric[]),
        ('flavored-iced', 'Cinnamon Latte',           7, array[145, 155]::numeric[]),
        ('flavored-iced', 'White Chocolate Mocha',    8, array[150, 160]::numeric[]),
        ('flavored-iced', 'Cookie Dough Latte',       9, array[150, 160]::numeric[]),
        ('flavored-iced', 'Strawberry Matcha Latte', 10, array[150, 160]::numeric[]),

        ('iced-fruit',    'Strawberry Soda/Latte',    1, array[100, 105]::numeric[]),
        ('iced-fruit',    'Blueberry Soda/Latte',     2, array[100, 105]::numeric[]),
        ('iced-fruit',    'Peach Soda/Latte',         3, array[100, 105]::numeric[])
)
insert into public.food_menu_items
    (id, category, name, description, price, group_key, group_title, size_label, sort_order)
select
    -- 'coffee-flavored-iced-white-chocolate-mocha-2'
    'coffee-' || g.group_key || '-'
        || btrim(regexp_replace(lower(f.name), '[^a-z0-9]+', '-', 'g'), '-')
        || '-' || size.ord,
    'coffee',
    f.name,
    g.group_title,
    f.prices[size.ord],
    g.group_key,
    g.group_title,
    g.size_labels[size.ord],
    g.group_order * 1000 + f.flavor_order * 10 + size.ord
from groups g
join flavors f using (group_key)
cross join lateral generate_subscripts(f.prices, 1) as size(ord)
on conflict (id) do nothing;

insert into public.spa_services
    (id, name, description, duration_label, price, image_key, sort_order)
values
    ('ventosa-cupping',          'Ventosa Cupping',                'Suction cupping therapy that eases muscle tension and improves circulation.', '1hr 30mins', 850, 'massage11', 1),
    ('traditional-body-massage', 'Traditional Body Massage',       'Full-body Hilot massage rooted in Filipino healing traditions.',              '1hr',        650, 'massage22', 2),
    ('back-massage',             'Back Massage',                   'Targeted kneading to release tension across the back and shoulders.',         '30mins',     400, 'massage33', 3),
    ('facial-detox',             'Moisturizing Facial Detox',      'Deep-cleansing facial that hydrates and refreshes tired skin.',               '1hr',        500, 'massage44', 4),
    ('foot-spa-reflexology',     'Foot Spa with Reflexology',      'Soothing foot soak paired with pressure-point reflexology.',                  '1hr',        650, 'massage55', 5),
    ('hand-massage-manicure',    'Hand Massage with Manicure',     'Relaxing hand massage finished with a neat manicure.',                        '1hr',        450, 'massage66', 6),
    ('foot-spa-reflexology-pedi', 'Foot Spa Reflexology with Pedi', 'Reflexology foot spa complete with a polished pedicure.',                    '1hr 30mins', 550, 'massage77', 7),
    ('manicure-and-pedicure',    'Manicure and Pedicure',          'Classic hand and foot grooming for a clean, polished finish.',                '1hr',        300, 'massage88', 8)
on conflict (id) do nothing;


-- ================================================== order lines point at rows
--  Same function as 20260727091500_guest_booking_ownership.sql, plus `itemId`.
--  The id is checked against the catalog before it is stored, so an order line
--  either names a real menu row or names none at all — the admin dashboard's
--  grouping can never be pointed at something that does not exist. Everything
--  else about the stored shape is unchanged, and old orders simply have no
--  itemId, which the dashboard falls back to matching by name for.

create or replace function public.add_booking_addon(
    p_booking_id  uuid,
    p_kind        text,          -- 'food' | 'spa'
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
    if p_kind not in ('food', 'spa') then
        raise exception 'Unknown add-on kind: %', p_kind using errcode = 'P0001';
    end if;

    if v_name is null or v_quantity < 1 or v_total < 0 or v_unit_cost < 0 then
        raise exception 'That order is not valid.' using errcode = 'P0001';
    end if;

    -- Same rule the menu and spa pages apply, restated where it is enforceable:
    -- add-ons attach to a live stay with a down-payment receipt on file.
    if v_row.status = 'cancelled' then
        raise exception 'That booking is cancelled.' using errcode = 'P0001';
    end if;

    if v_row.receipt_url is null then
        raise exception 'Upload your down-payment receipt before ordering.'
            using errcode = 'P0001';
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

    -- Rebuilt field by field rather than stored as received: the shape is now
    -- fixed, and `orderedAt` is the server's clock instead of whatever time the
    -- caller claimed it was.
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
           updated_at = now()
     where id = p_booking_id
    returning * into v_row;

    -- The caller is a guest, so hand back exactly what my_bookings() would:
    -- no ownership key, and no path into the staff-only receipts bucket.
    v_row.owner_hash  := null;
    v_row.receipt_url := case when v_row.receipt_url is null then null else 'pending-upload' end;
    return v_row;
end;
$$;

grant execute on function public.add_booking_addon(uuid, text, jsonb, text) to anon, authenticated;

comment on column public.bookings.food_orders is
    'Array of { itemId, name, unitPrice, quantity, total, orderedAt } — itemId → food_menu_items.id';
comment on column public.bookings.spa_orders is
    'Array of { itemId, name, unitPrice, quantity, total, orderedAt } — itemId → spa_services.id';
