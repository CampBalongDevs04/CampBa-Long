-- ============================================================================
--  Camp Ba-long — the "view more" carousel gets real photos
-- ----------------------------------------------------------------------------
--  The home page's accommodation window has been a carousel from the start:
--  arrows, dots, wrap-around slides. It only ever had ONE slide, because the
--  extra angles were a hardcoded `images` array in
--  src/components/accommodations.jsx that nobody ever filled in — and could
--  not fill in without a developer and a redeploy.
--
--  This column is where those extra photos live now: the inside of the A-house,
--  the bedding, the view from the deck. Staff upload them in Units → Manage
--  Accommodations and the carousel builds itself.
--
--  ORDER IS THE ARRAY'S ORDER, AND IT IS THE POINT
--  -----------------------------------------------
--  text[] rather than a table of its own, for the same reason `features` is:
--  these are a short, ordered list belonging to exactly one accommodation,
--  never queried on their own, and staff reorder them by dragging the whole
--  list around in the dashboard. A join table would buy nothing and would need
--  a sort column to say what the array already says.
--
--  The unit's MAIN photo (image_url) is not in here. It stays the card's photo
--  and the carousel's first slide, so a gallery is always "and also these",
--  which is the only arrangement where deleting a gallery photo cannot
--  accidentally blank the card.
-- ============================================================================

alter table public.accommodation_types add column if not exists gallery text[];

comment on column public.accommodation_types.gallery is
    'Extra photos for the home page "view more" carousel, in the order they are '
    'shown. Public URLs in the "catalog-images" bucket. The unit''s image_url is '
    'the first slide and is deliberately not repeated here.';
