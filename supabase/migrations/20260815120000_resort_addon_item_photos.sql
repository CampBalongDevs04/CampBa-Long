alter table public.resort_addon_items
    add column if not exists image_url text;

comment on column public.resort_addon_items.image_url is
    'Staff-uploaded photo in the catalog-images bucket ("addons" folder), '
    'same convention as food_menu_items.image_url / spa_services.image_url. '
    'Null shows as "No photo" — these items shipped with none.';

notify pgrst, 'reload schema';
