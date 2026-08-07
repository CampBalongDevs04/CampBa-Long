-- ============================================================================
--  Camp Ba-long — the Testimonials section, moved into the database
-- ----------------------------------------------------------------------------
--  The fifth block of the home page: the "Testimonials" heading, the line under
--  it, and the guest reviews that scroll past in the marquee. All of it was
--  written into src/components/testimonials.jsx — the file even opens with a
--  comment telling whoever finds it to edit the array, which meant a new review
--  was a code change, a commit and a redeploy.
--
--  It follows the four sections before it (20260807120000 … 20260807180000): a
--  singleton row for the copy that exists once, and a table for the list.
--
--  WHY THE REVIEWS ARE A TABLE AND NOT A JSON COLUMN
--  -------------------------------------------------
--  Adding a review is the thing staff will do most in this section, and it is
--  the only CMS list that grows without limit. A row per review means one
--  insert to add one, one delete to remove one, and no way for a half-saved
--  edit to take the other six with it.
--
--  RATING
--  ------
--  Stored as a number rather than a count of filled stars, because the front
--  end already draws half a star: StarRating fills each of the five by
--  `rating - index` clamped to 0..1, so 4.5 renders four gold stars and a half.
--  Constrained to 0..5 so a typo cannot render a sixth star's worth of gold
--  into empty space.
--
--  THE "STAY" LINE HAS NEVER BEEN FILLED IN
--  ----------------------------------------
--  The card renders `t.stay` under the guest's name, and not one of the seven
--  hardcoded reviews had it — so that line has always been empty on the page.
--  It is a real column here, seeded NULL rather than invented: what a guest
--  booked and when is the resort's to write, not this migration's. Empty, the
--  card looks exactly as it does today.
--
--  Seeded word for word with the reviews the front end shipped with, so
--  applying this changes nothing a visitor reads.
-- ============================================================================


-- ======================================================== testimonial_section

create table if not exists public.testimonial_section (
    id         text primary key default 'home'
        check (id = 'home'),

    title      text,   -- "Testimonials"
    subtitle   text,   -- "• What our guests say about Camp Ba-long •"

    updated_at timestamptz not null default now()
);

comment on table public.testimonial_section is
    'Singleton row holding the home page testimonials heading. '
    'Public-readable, staff-writable.';
comment on column public.testimonial_section.subtitle is
    'Stored with its bullets, because they are part of the wording staff type '
    'rather than a border CSS draws.';

create or replace function public.testimonial_section_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists testimonial_section_touch_trg on public.testimonial_section;
create trigger testimonial_section_touch_trg
    before update on public.testimonial_section
    for each row execute function public.testimonial_section_touch();


-- =============================================================== testimonials

create table if not exists public.testimonials (
    id          text primary key,               -- 'jimmy-ong'

    name        text not null,

    -- 0 to 5, halves allowed. See the note at the top: the front end fills
    -- each star by `rating - index`, so this is a measurement and not a count.
    rating      numeric(2,1) not null default 5
        check (rating >= 0 and rating <= 5),

    comment     text not null,

    -- The small line under the name — "Stayed in the Teepee, March 2026".
    -- Optional, and empty on every review the site shipped with.
    stay        text,

    sort_order  integer not null default 0,
    is_active   boolean not null default true
);

comment on table public.testimonials is
    'Guest reviews in the home page testimonials marquee. Written by staff in '
    'the dashboard — these are transcribed from real reviews, not collected '
    'from a form on the site.';
comment on column public.testimonials.rating is
    'Stars out of 5, halves allowed (4.5 renders four stars and a half).';
comment on column public.testimonials.stay is
    'Optional line under the guest name. Null renders nothing, which is what '
    'every seeded review does.';
comment on column public.testimonials.is_active is
    'False keeps the review and its wording but takes it out of the marquee.';

create index if not exists testimonials_order_idx
    on public.testimonials (sort_order);


-- =================================================================== seeding
--  Word for word what src/components/testimonials.jsx had hardcoded, in the
--  order it had them.

insert into public.testimonial_section (id, title, subtitle)
values ('home', 'Testimonials', '• What our guests say about Camp Ba-long •')
on conflict (id) do nothing;

insert into public.testimonials (id, name, rating, comment, sort_order)
values
    (
        'jimmy-ong',
        'Jimmy Ong',
        4,
        'Escape the heat from the city and back to mother nature.🌿✨ Tucked away in the cool highlands of Liliw, it’s the perfect spot to reconnect with nature and recharge. Great and affordable for a quick getaway trip.',
        1
    ),
    (
        'hercel-iguid',
        'Hercel Iguid',
        5,
        'Very accomodating, friendly, helpful staff and owner. Ambience is 100%, you can relax and i appreciate the no smoking policy''s And it''s pet friendly, they are allowed to swim in the ilog.',
        2
    ),
    (
        'dona-joy-stefanie-terbio-sacay',
        'Dona Joy Stefanie Terbio-Sacay',
        5,
        'Are we going back? Definitely YES!✅ We like the rules they implement to prevent damages, control too much crowd, maintaining the cleanliness and peace of the resort. KUDOS TO THE OWNER AND STAFF 🫶',
        3
    ),
    (
        'rigor-badiola',
        'Rigor Badiola',
        5,
        'The place is peaceful. Water doesn''t smell chlorine. I like this place. I think it would be great if we stayed overnight.',
        4
    ),
    (
        'mhelber-paredes',
        'Mhelber Paredes',
        5,
        'Very accommodating ang personnel. Super dali lapitan at mura ng foods. Highly recommended for those who wants to destress themselves from the noises of the city. Truly a gem',
        5
    ),
    (
        'evangeline-jocsing',
        'Evangeline Jocsing',
        5,
        'I really enjoyed our bonding moments with friends in Camp Ba-long Nature farm.',
        6
    ),
    (
        'jason-dela-luna',
        'Jason Dela Luna',
        5,
        'This place is a sanctuary. Smoking, vaping and playing loud music is not allowed. Afternoon and the temperature is not even 20 degrees, at night the temperature is somewhere 14 to 17 degrees celcious and morning is much colder 10 to 14 degrees perhaps. Water is freezing cold.',
        7
    )
on conflict (id) do nothing;


-- ======================================================================= RLS

alter table public.testimonial_section enable row level security;
alter table public.testimonials enable row level security;

drop policy if exists "testimonial section is public" on public.testimonial_section;
create policy "testimonial section is public" on public.testimonial_section
    for select to anon, authenticated using (true);

drop policy if exists "staff manage testimonial section" on public.testimonial_section;
create policy "staff manage testimonial section" on public.testimonial_section
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

-- Readable by everyone, writable by staff alone. Deliberately NOT insertable by
-- guests: these are reviews staff transcribe from Google and Facebook, and a
-- public insert policy would turn the marquee on the front page into an
-- unmoderated comment box.
drop policy if exists "testimonials are public" on public.testimonials;
create policy "testimonials are public" on public.testimonials
    for select to anon, authenticated using (true);

drop policy if exists "staff manage testimonials" on public.testimonials;
create policy "staff manage testimonials" on public.testimonials
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ================================================================== realtime

do $$
begin
    alter publication supabase_realtime add table public.testimonial_section;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.testimonials;
exception when duplicate_object then null;
end $$;
