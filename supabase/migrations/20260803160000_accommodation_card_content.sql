-- ============================================================================
--  Camp Ba-long — what an accommodation's card SAYS
-- ----------------------------------------------------------------------------
--  Adding an accommodation in the dashboard gave it a price, a photo and a
--  count of units — everything the booking page needs. The home page needs two
--  more things, and until now both were hardcoded in
--  src/components/accommodations.jsx: the paragraph in the "view more" modal,
--  and the "What's Included" list on the card. A new accommodation therefore
--  had no card at all, because there was nothing in the front end to describe
--  it with.
--
--  These two columns are that copy, moved to where the rest of the
--  accommodation already lives. Staff write them in Units → Manage
--  Accommodations, and the card builds itself.
--
--  The seed below is exactly the text the front end had hardcoded, so applying
--  this changes nothing a guest reads — it only moves where it comes from. The
--  front end keeps its copy as the fallback for a row that has none, the same
--  arrangement the food menu uses.
-- ============================================================================

alter table public.accommodation_types add column if not exists description text;
alter table public.accommodation_types add column if not exists features text[];

comment on column public.accommodation_types.description is
    'The paragraph in the home page "view more" modal.';
comment on column public.accommodation_types.features is
    'The "What''s Included" list on the card, one entry per line.';


-- =================================================================== seeding
--  `where description is null` rather than a plain update: a re-run must not
--  overwrite copy someone has since rewritten in the dashboard.

update public.accommodation_types set
    description = 'A canvas teepee tucked into the camp gardens, with a real mattress and bedding inside. All the romance of sleeping under canvas without giving up a good night of rest.',
    features    = array['Canvas teepee', 'Bed mattress', 'Pillows & blankets', 'Garden view', 'Fire pit access']
where id = 'teepee' and description is null;

update public.accommodation_types set
    description = 'A cozy A-frame hideaway built for one or two. Wake up to a river view, unwind at your own table, and enjoy a comfortable mattress after a day of exploring the camp.',
    features    = array['Bed mattress', '2 Pillows', 'Electric fan', 'River view', 'Table']
where id = 'small' and description is null;

update public.accommodation_types set
    description = 'Our most popular unit. This mid-size A-frame comfortably fits small groups and barkadas, with bedding for five, an extra tent, and its own table and chair set for shared meals.',
    features    = array['Bed mattress', '5 Pillows', '3 Blankets', 'Electric fan', 'Tent', 'Table & Chair']
where id = 'medium' and description is null;

update public.accommodation_types set
    description = 'The family favorite. A spacious A-frame that sleeps up to ten, with full bedding, an extra tent for the kids, and a table and chairs set — ideal for reunions and weekend getaways.',
    features    = array['Bed mattress', '6 Pillows', '4 Blankets', 'Electric fan', 'Tent', 'Table & Chairs']
where id = 'family' and description is null;

update public.accommodation_types set
    description = 'The classic Camp Ba-long experience. Sleep under the trees in a pre-pitched dome tent with sleeping mats provided — just bring your sense of adventure. Fire pit access included for evening bonfires.',
    features    = array['Dome tent setup', 'Sleeping mats x2', 'Flashlight', 'Forest view', 'Fire pit access']
where id = 'tent-small' and description is null;

update public.accommodation_types set
    description = 'A roomier pre-pitched dome tent for barkadas and small families, with sleeping mats for four. Same easy camping setup as the Small Tent, with space to spare for your gear.',
    features    = array['Family-size dome tent', 'Sleeping mats x4', 'Flashlight', 'Forest view', 'Fire pit access']
where id = 'tent-large' and description is null;

update public.accommodation_types set
    description = 'Bring your own tent and pitch it on the same camping ground, at a flat per-tent rate. Everything the camp offers is yours to use — you just supply the shelter.',
    features    = array['Your own tent', 'Camping ground slot', 'Forest view', 'Fire pit access', 'Bathrooms and showers']
where id = 'tent-pitching' and description is null;

update public.accommodation_types set
    description = 'A charming cottage perfect for couples or small families. Enjoy the comfort of a private space with modern amenities, while still being close to the natural beauty of the camp.',
    features    = array['Roofed cottage', 'Table & chairs', 'Electric fan', 'Power outlets', 'Garden view']
where id = 'cottage' and description is null;

update public.accommodation_types set
    description = 'A roofed open-air pavilion made for big celebrations. Long table seating, ceiling fans, and power outlets make it the go-to spot for birthdays, team buildings, and family events.',
    features    = array['Long table seating', 'Roofed shelter', 'Ceiling fans', 'Power outlets', 'Group capacity']
where id = 'pavilion' and description is null;
