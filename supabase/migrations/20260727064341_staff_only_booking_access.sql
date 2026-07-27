-- Pin the search_path so the function can't be influenced by a caller's.
create or replace function public.resort_timezone()
returns text language sql immutable
set search_path = public
as $$ select 'Asia/Manila'::text $$;

-- ---------------------------------------------------------------------------
-- Who counts as staff.
--
-- The previous policy let ANY authenticated user read every booking. That is
-- fine while the only accounts are ones an admin created by hand, but it turns
-- into a guest-data leak the moment public sign-ups or guest accounts are
-- added. An explicit allow-list removes that trapdoor: being signed in is not
-- the same as being staff.
--
-- To authorise someone, create the user in Authentication → Users, then:
--   insert into public.staff (user_id, full_name)
--   select id, 'Their Name' from auth.users where email = 'them@example.com';
-- ---------------------------------------------------------------------------
create table if not exists public.staff (
    user_id     uuid primary key references auth.users (id) on delete cascade,
    full_name   text,
    added_at    timestamptz not null default now()
);

alter table public.staff enable row level security;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.staff where user_id = auth.uid());
$$;

grant execute on function public.is_staff() to anon, authenticated;

-- Staff can see the roster (so the dashboard can tell "signed in" from
-- "signed in AND authorised"); nobody can edit it from the client.
drop policy if exists "staff read roster" on public.staff;
create policy "staff read roster" on public.staff
    for select to authenticated using (public.is_staff());

drop policy if exists "staff manage bookings" on public.bookings;
create policy "staff manage bookings" on public.bookings
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());
