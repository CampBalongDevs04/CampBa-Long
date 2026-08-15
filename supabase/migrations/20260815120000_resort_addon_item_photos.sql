-- ============================================================================
--  Camp Ba-long — photos for resort_addon_items, so the dashboard can manage
--  the catalog the same way it already manages food and spa items
-- ----------------------------------------------------------------------------
--  resort_addon_items (20260814120000_resort_addon_items.sql) shipped with no
--  image column and no dashboard editor — "editable directly in Postgres if a
--  price changes". Staff now want to edit name, photo and whether an item is
--  offered from the Units → Manage Add-ons tab, same as spa_services already
--  gets. Only a photo column is missing; name/description/price/sort_order/
--  is_active already exist and RLS already restricts writes to staff.
-- ============================================================================

alter table public.resort_addon_items
    add column if not exists image_url text;

comment on column public.resort_addon_items.image_url is
    'Staff-uploaded photo in the catalog-images bucket ("addons" folder), '
    'same convention as food_menu_items.image_url / spa_services.image_url. '
    'Null shows as "No photo" — these items shipped with none.';

notify pgrst, 'reload schema';
