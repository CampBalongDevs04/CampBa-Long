-- ============================================================================
--  Camp Ba-long — staff upload the catalog photos
-- ----------------------------------------------------------------------------
--  Until now a photo could only be one of two things, and staff could pick
--  neither freely:
--
--    • a BUNDLED asset named by key ('menu1', 'massage44'), which only exists
--      because a developer imported the file — so a new dish could never have
--      one; or
--    • a URL typed into the form, which means the photo lives on somebody
--      else's server and disappears the day that link rots.
--
--  Both are now backed by a real upload. This bucket is where the file goes,
--  and the row's `image_url` holds its public URL — so a photo added from the
--  dashboard is stored with the resort's own data and survives a redeploy.
--
--  WHY THIS BUCKET IS PUBLIC AND `receipts` IS NOT
--  -----------------------------------------------
--  A receipt is evidence: it carries a guest's name, amount and account number,
--  so it is private and staff read it through a short-lived signed URL. A dish
--  photo is the opposite — it is published on the guest menu, and every visitor
--  is anonymous. A signed URL there would expire mid-scroll and cost a round
--  trip per card, so the object is served directly instead.
--
--  WHO CAN DO WHAT
--  ---------------
--    read    — anyone, including anonymous guests. That is the point.
--    write   — the staff roster only, same boundary as the catalog tables
--              themselves (20260803140000_catalog_crud.sql). A guest who
--              called upload would be refused by Postgres, not by the form.
--
--  Deletes are allowed for staff so a wrong photo can be cleared out, but the
--  dashboard deliberately does not delete on replace: the old URL may still be
--  on the row a staff member is about to cancel out of.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'catalog-images',
    'catalog-images',
    true,                                       -- served straight to guests
    5 * 1024 * 1024,                            -- 5 MB: these are menu cards
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update
    set public = true,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;


drop policy if exists "anyone reads catalog images" on storage.objects;
create policy "anyone reads catalog images" on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'catalog-images');

drop policy if exists "staff upload catalog images" on storage.objects;
create policy "staff upload catalog images" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'catalog-images' and public.is_staff());

drop policy if exists "staff replace catalog images" on storage.objects;
create policy "staff replace catalog images" on storage.objects
    for update to authenticated
    using (bucket_id = 'catalog-images' and public.is_staff())
    with check (bucket_id = 'catalog-images' and public.is_staff());

drop policy if exists "staff delete catalog images" on storage.objects;
create policy "staff delete catalog images" on storage.objects
    for delete to authenticated
    using (bucket_id = 'catalog-images' and public.is_staff());


-- The columns did not change shape, but what they hold did: a URL here is now
-- normally one this project issued, not one somebody pasted in.
comment on column public.food_menu_items.image_url is
    'Public URL of the photo in the "catalog-images" bucket, uploaded from the '
    'dashboard. Rows that shipped with the site still name a bundled asset in '
    'image_key instead; an upload clears the key so the uploaded photo wins.';

comment on column public.spa_services.image_url is
    'Public URL of the photo in the "catalog-images" bucket, uploaded from the '
    'dashboard. Rows that shipped with the site still name a bundled asset in '
    'image_key instead; an upload clears the key so the uploaded photo wins.';

comment on column public.accommodation_types.image_url is
    'Public URL of the photo in the "catalog-images" bucket, uploaded from the '
    'dashboard. Overrides the bundled photo the unit shipped with.';
