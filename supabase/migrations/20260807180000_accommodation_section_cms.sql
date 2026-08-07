-- ============================================================================
--  Camp Ba-long — the Accommodations section's HEADING
-- ----------------------------------------------------------------------------
--  The fourth block of the home page, and the smallest thing in the CMS: the
--  "Accommodations" heading and the line under it, which were written into
--  src/components/accommodations.jsx.
--
--  WHY ONLY TWO COLUMNS
--  --------------------
--  Everything else in that section already has an owner. The cards are built
--  from `accommodation_types` and `accommodation_rates` — name, photo, gallery,
--  description, "What's Included", price and capacity are edited in Units →
--  Manage Accommodations, and the carousel's availability is counted off real
--  bookings. Putting any of that in the CMS as well would give the same field
--  two screens to be edited on and two answers when they disagreed.
--
--  So this table holds the part that belongs to nothing else: the section's own
--  title and its one line of copy. The CMS tab says as much on screen, and
--  points staff at Units for the cards.
--
--  Seeded with exactly the text the front end had hardcoded, so applying this
--  changes nothing a visitor reads.
-- ============================================================================

create table if not exists public.accommodation_section (
    id         text primary key default 'home'
        check (id = 'home'),

    title      text,   -- "Accommodations"
    subtitle   text,   -- "• Find the perfect spot for your stay •"

    updated_at timestamptz not null default now()
);

comment on table public.accommodation_section is
    'Singleton row holding the home page accommodations HEADING only. The '
    'cards themselves come from accommodation_types and accommodation_rates, '
    'edited in Units → Manage Accommodations.';
comment on column public.accommodation_section.subtitle is
    'Stored with its bullets, because they are part of the wording staff type '
    'rather than a border CSS draws.';

create or replace function public.accommodation_section_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists accommodation_section_touch_trg on public.accommodation_section;
create trigger accommodation_section_touch_trg
    before update on public.accommodation_section
    for each row execute function public.accommodation_section_touch();

insert into public.accommodation_section (id, title, subtitle)
values ('home', 'Accommodations', '• Find the perfect spot for your stay •')
on conflict (id) do nothing;


-- ======================================================================= RLS

alter table public.accommodation_section enable row level security;

drop policy if exists "accommodation section is public" on public.accommodation_section;
create policy "accommodation section is public" on public.accommodation_section
    for select to anon, authenticated using (true);

drop policy if exists "staff manage accommodation section" on public.accommodation_section;
create policy "staff manage accommodation section" on public.accommodation_section
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ================================================================== realtime

do $$
begin
    alter publication supabase_realtime add table public.accommodation_section;
exception when duplicate_object then null;
end $$;
