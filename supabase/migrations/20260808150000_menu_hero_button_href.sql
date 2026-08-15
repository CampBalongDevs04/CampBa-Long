-- ============================================================================
--  Camp Ba-long — a destination for the menu banner's button
-- ----------------------------------------------------------------------------
--  The Order Now button only ever scrolled to the "How to Order" panel
--  further down /menu — src/pages/foodmenu.jsx called scrollIntoView() on a
--  ref, and menu_hero.button_label (see 20260808140000_menu_hero_cms.sql) had
--  no href to go with it, unlike home_hero's buttons.
--
--  This gives it one, the same shape as home_hero.primary_href: a path
--  starting with "/" is routed inside the app, "#how-to-order" scrolls to
--  that panel (now a real anchor id, not just a ref), and anything else opens
--  as a link. Seeded to "#how-to-order" so applying this changes nothing a
--  visitor sees — the button still does exactly what it did before, just
--  configurably now.
-- ============================================================================

alter table public.menu_hero
    add column if not exists button_href text;

comment on column public.menu_hero.button_href is
    'Where the Order Now button goes. "/x" routes inside the app, "#x" '
    'scrolls to that anchor on the page, anything else opens as a link.';

update public.menu_hero
set button_href = '#how-to-order'
where button_href is null;
