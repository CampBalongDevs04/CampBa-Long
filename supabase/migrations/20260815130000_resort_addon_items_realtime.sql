-- ============================================================================
--  Camp Ba-long — resort_addon_items missed the realtime publication
-- ----------------------------------------------------------------------------
--  food_menu_items and spa_services were added to supabase_realtime in
--  20260803140000_catalog_crud.sql, back when resort_addon_items didn't exist
--  yet. When it shipped a migration later (20260814120000), the same step was
--  never taken — it had no dashboard editor then, so nobody noticed the front
--  end's `.on('postgres_changes', ..., table: 'resort_addon_items', ...)`
--  subscription (menuDB.js's watchCatalogRealtime()) was subscribed to a table
--  that Postgres never actually publishes changes for.
--
--  The effect: a rename saved in the new Manage Add-ons panel updates that
--  browser tab immediately (saveResortAddonItem() reloads its own store
--  directly), but a booking page already open in another tab never hears
--  about it — the postgres_changes event simply never fires — until it's
--  manually refreshed. Same `do $$ ... exception when duplicate_object`
--  guard as the original migration, so re-running this is harmless.
-- ============================================================================

do $$
begin
    alter publication supabase_realtime add table public.resort_addon_items;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
