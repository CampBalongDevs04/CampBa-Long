create table if not exists public.site_maintenance (
    id           text primary key default 'resort'
        check (id = 'resort'),
    is_on        boolean not null default false,
    heading      text not null default 'Website on Maintenance',
    message      text not null default 'Feel free to message us.',
    facebook_url text not null default 'https://facebook.com/campbalong',
    updated_at   timestamptz not null default now()
);

comment on table public.site_maintenance is
    'Singleton row behind the guest-facing maintenance page. With is_on true '
    'every public route answers with the maintenance page instead; the '
    'dashboard is reachable either way, so the switch can always be turned '
    'back off. Public-readable, staff-writable.';
comment on column public.site_maintenance.facebook_url is
    'The page the "Message us on Facebook" button opens. Empty hides the '
    'button.';


create or replace function public.site_maintenance_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists site_maintenance_touch_trg on public.site_maintenance;
create trigger site_maintenance_touch_trg
    before insert or update on public.site_maintenance
    for each row execute function public.site_maintenance_touch();


insert into public.site_maintenance (id)
values ('resort')
on conflict (id) do nothing;


alter table public.site_maintenance enable row level security;

drop policy if exists "site maintenance is public" on public.site_maintenance;
create policy "site maintenance is public" on public.site_maintenance
    for select to anon, authenticated using (true);

drop policy if exists "staff manage site maintenance" on public.site_maintenance;
create policy "staff manage site maintenance" on public.site_maintenance
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


do $$
begin
    alter publication supabase_realtime add table public.site_maintenance;
exception when duplicate_object then null;
end $$;


notify pgrst, 'reload schema';
