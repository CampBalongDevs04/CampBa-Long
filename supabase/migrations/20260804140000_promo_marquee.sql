-- ============================================================================
--  Camp Ba-long — the promo ticker above the accommodations
-- ----------------------------------------------------------------------------
--  A promo on a rate shows up on that unit's card, which only tells a guest who
--  is already reading that card. What was missing is the banner across the top
--  of the section — the one that says "SUMMER SALE · 20% OFF ALL A-HOUSES" to
--  someone still scrolling past.
--
--  That line is written by staff, not derived from the rates. A promo is a
--  message before it is arithmetic ("book 2 nights, get a free tent"), and the
--  wording is the part the resort wants control of. So this is one small table
--  the dashboard writes and the home page reads.
--
--  A SINGLETON, LIKE email_settings
--  --------------------------------
--  One banner exists — the one above the accommodations. The primary key is a
--  fixed literal so the client fetches it without knowing an id or which row is
--  current, and the check constraint is what keeps a second row from being
--  inserted by mistake and silently shadowing the first.
--
--  `messages` is a LIST rather than one string because a ticker with two or
--  three items reads as a ticker; one sentence chasing its own tail reads as a
--  bug. Staff type one per line, the same way the "What's Included" list on an
--  accommodation is typed.
--
--  Seeded INACTIVE with no messages: applying this must not put a banner on the
--  live home page. It appears the moment staff write one and tick the box.
-- ============================================================================

create table if not exists public.promo_marquee (
    id          text primary key default 'home'
        check (id = 'home'),

    -- One line per item in the ticker, in the order they scroll past.
    messages    text[] not null default '{}',

    -- Whether the banner is on the home page at all. Separate from `messages`
    -- so next month's promo can be written and left switched off, and so
    -- ending one does not mean deleting the wording that worked.
    is_active   boolean not null default false,

    updated_at  timestamptz not null default now()
);

comment on table public.promo_marquee is
    'Singleton row holding the scrolling promo banner above the home page '
    'accommodations. Public-readable, staff-writable.';
comment on column public.promo_marquee.messages is
    'The ticker items, one per array entry, in scroll order.';
comment on column public.promo_marquee.is_active is
    'Whether the banner shows. Off keeps the wording for next time.';

-- Worth knowing when the banner last changed — it is the one piece of copy on
-- the site that is meant to be wrong within a week of being right.
create or replace function public.promo_marquee_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists promo_marquee_touch_trg on public.promo_marquee;
create trigger promo_marquee_touch_trg
    before update on public.promo_marquee
    for each row execute function public.promo_marquee_touch();

insert into public.promo_marquee (id) values ('home')
on conflict (id) do nothing;


-- ======================================================================= RLS

alter table public.promo_marquee enable row level security;

-- The banner is on the public home page, read by visitors who are not signed
-- in — the same arrangement as the room catalog and the menu.
drop policy if exists "promo marquee is public" on public.promo_marquee;
create policy "promo marquee is public" on public.promo_marquee
    for select to anon, authenticated using (true);

drop policy if exists "staff manage promo marquee" on public.promo_marquee;
create policy "staff manage promo marquee" on public.promo_marquee
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ================================================================== realtime
--  So a banner switched on during a sale reaches the guests already sitting on
--  the home page, rather than waiting for each of them to reload.

do $$
begin
    alter publication supabase_realtime add table public.promo_marquee;
exception when duplicate_object then null;
end $$;
