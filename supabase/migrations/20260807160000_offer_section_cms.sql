-- ============================================================================
--  Camp Ba-long — the "What We Offer" section, moved into the database
-- ----------------------------------------------------------------------------
--  The third block of the home page: the heading, the three amenity cards, the
--  window each card's "Discover More" opens, and the small Nature · Relaxation
--  · Wellness row under them. All of it was written into
--  src/components/offers.jsx and src/components/OfferGalleryModal.jsx.
--
--  It follows the hero and the welcome block exactly
--  (20260807120000, 20260807140000): a singleton row for the copy that exists
--  once, and a table per list.
--
--  THE GALLERY WAS NEVER FINISHED
--  ------------------------------
--  OfferGalleryModal.jsx already had three slots per card, but every one of
--  them held `image: null` and a label — so pressing "Discover More" opened a
--  window of "Photo coming soon" placeholders, and there was no way to change
--  that without editing the file. The nine rows seeded below are those exact
--  slots. What they gain here is somewhere for the photo to come FROM, and a
--  line of description under the title that the front end had no field for at
--  all.
--
--  Their descriptions are seeded NULL rather than invented. A caption that
--  claims something about the resort is the resort's to write, and an empty one
--  renders as a title on its own — which is what the window shows today.
--
--  WHY THE GALLERY IS ITS OWN TABLE
--  --------------------------------
--  A card's three photos are a list that belongs to it, so `card_id` carries a
--  real foreign key with ON DELETE CASCADE: deleting the Spa card takes its
--  window with it, and there is no way to end up with photos belonging to a
--  card that no longer exists. Three columns of photo_1/photo_2/photo_3 on the
--  card would have made "add a fourth" a migration.
--
--  IMAGES
--  ------
--  Two of the three cards point at stock photos on someone else's server
--  today — the Foods and Spa cards are Unsplash URLs typed into the source.
--  Those URLs are seeded as they are, so applying this changes nothing on
--  screen, but they are exactly what this is meant to fix: staff can now
--  upload the resort's own photographs over them, into the resort's own
--  storage. The pool card's photo is bundled with the front end and stays
--  keyed by id in src/data/offersSection.js, like every other shipped asset.
-- ============================================================================


-- ============================================================= offer_section

create table if not exists public.offer_section (
    id                 text primary key default 'home'
        check (id = 'home'),

    title              text,   -- "What We Offer"

    -- The line under it reads "• Unwind. Indulge. Reconnect. All in one place •",
    -- and the last few words are gold. That is two fields rather than one
    -- because the emphasis is part of the design, not something staff should
    -- have to express in markup.
    subtitle           text,
    subtitle_highlight text,

    updated_at         timestamptz not null default now()
);

comment on table public.offer_section is
    'Singleton row holding the home page "What We Offer" heading. '
    'Public-readable, staff-writable.';
comment on column public.offer_section.subtitle_highlight is
    'The closing words of the subtitle, printed in gold.';

create or replace function public.offer_section_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists offer_section_touch_trg on public.offer_section;
create trigger offer_section_touch_trg
    before update on public.offer_section
    for each row execute function public.offer_section_touch();


-- =============================================================== offer_cards

create table if not exists public.offer_cards (
    id          text primary key,               -- 'pool-running-water'

    title       text not null,
    description text,

    -- Public URL of the card photo. Null falls back to the one bundled with
    -- the front end, keyed by id in src/data/offersSection.js.
    image_url   text,
    image_alt   text,

    icon_key    text,
    icon_url    text,

    sort_order  integer not null default 0,
    is_active   boolean not null default true
);

comment on table public.offer_cards is
    'The amenity cards in the home page "What We Offer" grid.';


-- ======================================================= offer_gallery_items
--  What one card's "Discover More" window shows: photo, title, and the small
--  line under it.

create table if not exists public.offer_gallery_items (
    id          text primary key,               -- 'pool-running-water-pool'

    card_id     text not null
        references public.offer_cards (id) on delete cascade,

    title       text not null,
    description text,

    image_url   text,
    image_alt   text,

    sort_order  integer not null default 0,
    is_active   boolean not null default true
);

comment on table public.offer_gallery_items is
    'The photos inside a card''s "Discover More" window. Cascades with its card.';
comment on column public.offer_gallery_items.image_url is
    'Public URL in the "catalog-images" bucket. Null renders the "Photo coming '
    'soon" placeholder the window has always shown.';

create index if not exists offer_gallery_items_card_idx
    on public.offer_gallery_items (card_id, sort_order);


-- ================================================================ offer_tags
--  The small Nature · Relaxation · Wellness row under the cards. A label and an
--  icon — no photo, no description.

create table if not exists public.offer_tags (
    id         text primary key,

    label      text not null,
    icon_key   text,
    icon_url   text,

    sort_order integer not null default 0,
    is_active  boolean not null default true
);

comment on table public.offer_tags is
    'The small icon-and-label row under the home page offer cards.';


-- =================================================================== seeding
--  Word for word what the front end had hardcoded.

insert into public.offer_section (id, title, subtitle, subtitle_highlight)
values ('home', 'What We Offer', '• Unwind. Indulge. Reconnect.', 'All in one place')
on conflict (id) do nothing;

insert into public.offer_cards (id, title, description, image_url, image_alt, icon_key, sort_order)
values
    (
        'pool-running-water',
        'Pool & Running Water',
        'Enjoy nature theme pools',
        null,                                   -- bundled with the front end
        'Natural theme pool surrounded by greenery',
        'pool',
        1
    ),
    (
        'foods',
        'Foods',
        'Savor local flavors and fresh ingredients',
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80&auto=format&fit=crop',
        'Local foods spread with fresh ingredients',
        'food',
        2
    ),
    (
        'spa',
        'Spa',
        'Relax, rejuvenate and refresh your senses',
        'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80&auto=format&fit=crop',
        'Hot stone spa treatment',
        'spa',
        3
    )
on conflict (id) do nothing;

insert into public.offer_gallery_items (id, card_id, title, image_alt, sort_order)
values
    ('pool-running-water-pool',        'pool-running-water', 'Pool',             'pool',              1),
    ('pool-running-water-river',       'pool-running-water', 'River',            'river',             2),
    ('pool-running-water-running',     'pool-running-water', 'Running Water',    'running water',     3),
    ('foods-local-dishes',             'foods',              'Local Dishes',     'local dishes',      1),
    ('foods-fresh-ingredients',        'foods',              'Fresh Ingredients','fresh ingredients', 2),
    ('foods-refreshments',             'foods',              'Refreshments',     'refreshments',      3),
    ('spa-massage',                    'spa',                'Massage',          'massage',           1),
    ('spa-hot-stone',                  'spa',                'Hot Stone',        'hot stone',         2),
    ('spa-relaxation-area',            'spa',                'Relaxation Area',  'relaxation area',   3)
on conflict (id) do nothing;

insert into public.offer_tags (id, label, icon_key, sort_order)
values
    ('nature',     'Nature',     'nature',     1),
    ('relaxation', 'Relaxation', 'relaxation', 2),
    ('wellness',   'Wellness',   'wellness',   3)
on conflict (id) do nothing;


-- ======================================================================= RLS

alter table public.offer_section enable row level security;
alter table public.offer_cards enable row level security;
alter table public.offer_gallery_items enable row level security;
alter table public.offer_tags enable row level security;

drop policy if exists "offer section is public" on public.offer_section;
create policy "offer section is public" on public.offer_section
    for select to anon, authenticated using (true);

drop policy if exists "staff manage offer section" on public.offer_section;
create policy "staff manage offer section" on public.offer_section
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "offer cards are public" on public.offer_cards;
create policy "offer cards are public" on public.offer_cards
    for select to anon, authenticated using (true);

drop policy if exists "staff manage offer cards" on public.offer_cards;
create policy "staff manage offer cards" on public.offer_cards
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "offer gallery is public" on public.offer_gallery_items;
create policy "offer gallery is public" on public.offer_gallery_items
    for select to anon, authenticated using (true);

drop policy if exists "staff manage offer gallery" on public.offer_gallery_items;
create policy "staff manage offer gallery" on public.offer_gallery_items
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "offer tags are public" on public.offer_tags;
create policy "offer tags are public" on public.offer_tags
    for select to anon, authenticated using (true);

drop policy if exists "staff manage offer tags" on public.offer_tags;
create policy "staff manage offer tags" on public.offer_tags
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ================================================================== realtime

do $$
begin
    alter publication supabase_realtime add table public.offer_section;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.offer_cards;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.offer_gallery_items;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.offer_tags;
exception when duplicate_object then null;
end $$;
