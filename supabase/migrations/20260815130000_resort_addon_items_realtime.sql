do $$
begin
    alter publication supabase_realtime add table public.resort_addon_items;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
