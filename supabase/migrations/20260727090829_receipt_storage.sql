-- ============================================================================
--  Receipt images — private storage bucket
-- ----------------------------------------------------------------------------
--  Until now bookings.receipt_url only ever held the marker 'pending-upload':
--  the guest picked a screenshot, the booking recorded that one existed, and
--  the image itself was dropped on the floor. Staff had nothing to verify
--  before approving, which is the whole point of collecting it.
--
--  So the image now goes into a storage bucket and receipt_url holds its PATH
--  (e.g. '9f3c…-a1/receipt.jpg'), not a public URL — the bucket is private and
--  the admin dashboard mints a short-lived signed URL to display it.
--
--  WHO CAN DO WHAT
--  ---------------
--    upload  — anyone, including anonymous guests. A guest uploads the
--              screenshot as part of booking, before any account exists.
--    read    — staff only. Receipts show names, amounts and account numbers,
--              so a guest must not be able to fetch anyone's image, including
--              their own by path guessing. Paths are random for that reason.
--    delete  — staff only, for clearing out a rejected or bogus upload.
--
--  Note there is deliberately no update policy: an uploaded receipt is
--  evidence, and overwriting it in place would erase what was approved.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'receipts',
    'receipts',
    false,                                      -- private: signed URLs only
    10 * 1024 * 1024,                           -- 10 MB is plenty for a screenshot
    array['image/jpeg', 'image/png']
)
on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;


-- A guest is anonymous at upload time, so insert has to be open to `anon`.
-- What keeps it safe is that nothing else is: they cannot list the bucket,
-- read an object, or overwrite one. The bucket's own mime/size limits above
-- reject anything that isn't a reasonably sized JPG or PNG.
drop policy if exists "guests upload receipts" on storage.objects;
create policy "guests upload receipts" on storage.objects
    for insert to anon, authenticated
    with check (bucket_id = 'receipts');

drop policy if exists "staff read receipts" on storage.objects;
create policy "staff read receipts" on storage.objects
    for select to authenticated
    using (bucket_id = 'receipts' and public.is_staff());

drop policy if exists "staff delete receipts" on storage.objects;
create policy "staff delete receipts" on storage.objects
    for delete to authenticated
    using (bucket_id = 'receipts' and public.is_staff());


comment on column public.bookings.receipt_url is
    'Path of the receipt image inside the private "receipts" storage bucket. '
    'Rows created before the bucket existed hold the marker ''pending-upload'', '
    'which means a receipt was submitted but no image was kept.';
