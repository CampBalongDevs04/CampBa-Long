-- ============================================================================
--  Camp Ba-long — the FAQ section, moved into the database
-- ----------------------------------------------------------------------------
--  The seventh block of the home page: the intro beside the accordion — eyebrow,
--  heading, paragraph and the "Reach out" button — and the fourteen questions
--  themselves. All of it was written into src/components/faq.jsx.
--
--  It follows the six sections before it (20260807120000 … 20260807220000): a
--  singleton row for the copy that exists once, and a table for the list.
--
--  THIS IS THE SECTION THAT GOES STALE FASTEST
--  -------------------------------------------
--  Half of these answers are prices and policies — the entrance fee, the
--  cottage fee, the stove and utensil rental, the maximum group size, the
--  check-in windows. Those change, and until now changing one meant editing a
--  React component and redeploying the site, which is why an FAQ quoting a
--  superseded rate is the most likely thing on the page to be wrong. Two of
--  them (the entrance fee and the check-in windows) also state numbers the
--  booking flow computes from `entrance_fee` and the rate schedules, so they
--  are worth re-reading whenever those change: nothing keeps them in step
--  automatically, and nothing sensibly could — one is a sentence a person
--  wrote, the other is a column.
--
--  ONE ANSWER IS ONE PARAGRAPH
--  ---------------------------
--  `answer` is plain text, not an array of lines, because the accordion opens
--  by animating a single collapsed grid row: a second paragraph would sit in an
--  implicit row that the animation does not close, and would stay on screen
--  with the question shut. So the answer is one block of prose, which is what
--  all fourteen already are.
--
--  Seeded word for word with what the front end had hardcoded, so applying this
--  changes nothing a visitor reads.
-- ============================================================================


-- ================================================================ faq_section

create table if not exists public.faq_section (
    id            text primary key default 'home'
        check (id = 'home'),

    eyebrow       text,   -- "FAQ"
    title         text,   -- "Frequently Asked Questions"
    description   text,   -- the paragraph under it

    -- The button under the paragraph. Empty label = no button, the same rule
    -- the hero's two buttons and the location card's follow.
    contact_label text,
    contact_href  text,

    updated_at    timestamptz not null default now()
);

comment on table public.faq_section is
    'Singleton row holding the home page FAQ intro — the words beside the '
    'accordion. Public-readable, staff-writable.';
comment on column public.faq_section.contact_href is
    'A "#contact" style anchor scrolls to that section of the page; a full '
    'https:// address opens in a new tab.';

create or replace function public.faq_section_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists faq_section_touch_trg on public.faq_section;
create trigger faq_section_touch_trg
    before update on public.faq_section
    for each row execute function public.faq_section_touch();


-- ======================================================================= faqs

create table if not exists public.faqs (
    id         text primary key,               -- 'entrance-fee'

    question   text not null,
    answer     text not null,

    sort_order integer not null default 0,
    is_active  boolean not null default true
);

comment on table public.faqs is
    'The questions in the home page FAQ accordion, in the order they are '
    'listed.';
comment on column public.faqs.answer is
    'One paragraph. The accordion animates a single collapsed row, so a second '
    'paragraph would not close with the question — see the migration header.';
comment on column public.faqs.is_active is
    'False keeps the question and its answer but takes it off the page — for '
    'an answer that has stopped being true and has not been rewritten yet.';

create index if not exists faqs_order_idx on public.faqs (sort_order);


-- =================================================================== seeding
--  Word for word what src/components/faq.jsx had hardcoded, in its order.
--  The ids are shortened by hand: slugifying a whole question gives an
--  eighty-character primary key that nobody can read in a table view.

insert into public.faq_section
    (id, eyebrow, title, description, contact_label, contact_href)
values (
    'home',
    'FAQ',
    'Frequently Asked Questions',
    'Planning your getaway? Here are the answers to the questions our guests ask '
        || 'most, from booking and check-in to amenities and dining. Can''t find what '
        || 'you''re looking for? We''re happy to help.',
    'Any questions? Reach out',
    '#contact'
)
on conflict (id) do nothing;

insert into public.faqs (id, question, answer, sort_order)
values
    (
        'location',
        'Location?',
        'We are located at Brgy. Laguan Liliw, Laguna',
        1
    ),
    (
        'tent-pitching',
        'Is tent pitching allowed?',
        'Yes, tent pitching is allowed.',
        2
    ),
    (
        'walk-ins',
        'Are walk-ins allowed?',
        'We allow walk-ins if we''re not fully booked but it is better if you make reservations.',
        3
    ),
    (
        'rooms',
        'Do you have rooms?',
        'We are a camp site so we don''t have rooms but we do have teepees, A-houses and tents, where you can stay and sleep.',
        4
    ),
    (
        'entrance-fee',
        'How much is the entrance fee?',
        '150/ pax for day time, (10am-5pm) and 350/pax for 22 hours/ day and night (10am-8am) night and day (7pm-5am).',
        5
    ),
    (
        'entrance-fee-children',
        'How much is the entrance fee for children?',
        'No entrance fee for children 7 years old and below.',
        6
    ),
    (
        'cottage-fee',
        'How much is the cottage fee?',
        'Cottage fee is 2000, for day time (good for 8-10pax).',
        7
    ),
    (
        'parking-distance',
        'Is the parking lot far from the site?',
        'No, the distance between the parking lot to the gate was more or less 100 meters.',
        8
    ),
    (
        'check-in-time',
        'Can we check in and check out at our preferred time?',
        'No, checking in and out depends on your booked time, day time (10am-5pm) and night and day (7pm-5am).',
        9
    ),
    (
        'parking',
        'Do you have parking?',
        'Yes, we have parking space.',
        10
    ),
    (
        'private-resort',
        'Is Camp Ba-long Nature Resort a private resort?',
        'Our Place is a semi exclusive, we make sure that you enjoy yourselves without crowding. You may also rent the whole place for your group.',
        11
    ),
    (
        'max-pax',
        'Is there a maximum number of persons allowed when you book the place exclusively for our group?',
        'We only allow a maximum of 60 pax for day time and 50 for Day and Night',
        12
    ),
    (
        'cooking',
        'Is cooking allowed?',
        'Yes, you may also rent a gas stove for 400 pesos and utensils for 200 pesos.',
        13
    ),
    (
        'food-orders',
        'Can we order foods?',
        'Yes, you can order foods. Please message us for the menu and availability.',
        14
    )
on conflict (id) do nothing;


-- ======================================================================= RLS

alter table public.faq_section enable row level security;
alter table public.faqs enable row level security;

drop policy if exists "faq section is public" on public.faq_section;
create policy "faq section is public" on public.faq_section
    for select to anon, authenticated using (true);

drop policy if exists "staff manage faq section" on public.faq_section;
create policy "staff manage faq section" on public.faq_section
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "faqs are public" on public.faqs;
create policy "faqs are public" on public.faqs
    for select to anon, authenticated using (true);

drop policy if exists "staff manage faqs" on public.faqs;
create policy "staff manage faqs" on public.faqs
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ================================================================== realtime

do $$
begin
    alter publication supabase_realtime add table public.faq_section;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.faqs;
exception when duplicate_object then null;
end $$;
