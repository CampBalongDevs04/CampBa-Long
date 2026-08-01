-- ============================================================================
--  Camp Ba-long — EmailJS settings, in the database instead of the bundle
-- ----------------------------------------------------------------------------
--  The contact form used to read its EmailJS IDs from VITE_EMAILJS_* in .env.
--  Vite inlines import.meta.env.VITE_* at BUILD time, so those values were
--  frozen into the JavaScript by whichever machine ran `npm run build`. In
--  practice that meant:
--
--    * the form worked on the laptop that had a .env and nowhere else;
--    * fixing a wrong template ID needed a rebuild and a redeploy;
--    * every host (Vercel, Netlify, Pages, the CI job) needed the same five
--      variables re-entered by hand before a deploy would produce a working
--      contact form.
--
--  This table moves them to run time. The browser reads the row on submit, so
--  a deployed build picks up a corrected ID on the next page load and a host
--  needs nothing configured beyond the two Supabase variables it already has.
--
--  WHAT THIS DOES *NOT* DO
--  -----------------------
--  It does not make the IDs secret, and it is not what lets the form send from
--  a domain other than localhost. EmailJS's browser SDK runs in the visitor's
--  browser, so the public key has to reach the browser either way — out of the
--  bundle before, out of this table now, visible in the network tab in both
--  cases. What authorises a domain is the allow-list at
--  EmailJS → Account → Security → Allowed origins. A production domain missing
--  from that list fails with status 403 no matter where the key came from.
--
--  So: read-only to everyone, exactly like the menu and the room catalog. Not
--  because the values are unimportant, but because they are already public by
--  design and pretending otherwise would buy a false sense of safety. The
--  private key — the one that WOULD need protecting — is never used here; that
--  belongs to the REST API and would have to live in an edge function.
-- ============================================================================


-- ============================================================ email_settings

-- Singleton. The primary key is a fixed literal rather than a uuid or a serial
-- so there is exactly one row and the client can fetch it without knowing an
-- id, ordering, or "which one is current". The check constraint is what makes
-- that true — without it a second row inserted by mistake would silently
-- shadow the first depending on row order.
create table if not exists public.email_settings (
    id                  text primary key default 'contact_form'
        check (id = 'contact_form'),

    -- Email Services → your service → Service ID. Looks like 'service_xxxxxxx'.
    service_id          text,

    -- Account → General → Public Key. Not a secret; see the header.
    public_key          text,

    -- Email Templates → Template ID, one per template. BOTH look like
    -- 'template_xxxxxxx'. Pasting the service_… ID into one of these is the
    -- single most common way to break this form — EmailJS answers 400 and the
    -- client checks for it by name so the message says which field is wrong.
    template_admin      text,   -- the enquiry → the Camp Ba-long inbox
    template_autoreply  text,   -- the acknowledgement → the guest

    -- Fills {{to_email}} in the admin template, so the inbox that receives
    -- enquiries can change without touching EmailJS or the code.
    admin_email         text,

    updated_at          timestamptz not null default now()
);

comment on table public.email_settings is
    'Singleton row holding the contact form''s EmailJS IDs. Public-readable — '
    'these values reach the visitor''s browser either way. Staff-writable.';
comment on column public.email_settings.template_admin is
    'template_… ID for the enquiry sent to the camp. NOT the service_… ID.';
comment on column public.email_settings.template_autoreply is
    'template_… ID for the acknowledgement sent to the guest.';


-- Staff edit this from the dashboard (or from the SQL editor), and the whole
-- point of the table is that the last edit wins without a redeploy — so it is
-- worth being able to see when that edit happened.
create or replace function public.email_settings_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists email_settings_touch_trg on public.email_settings;
create trigger email_settings_touch_trg
    before update on public.email_settings
    for each row execute function public.email_settings_touch();


-- The row itself, empty. The values are deliberately NOT seeded here: this
-- file is committed, and putting the IDs back in the repo would undo the move
-- off .env. Fill it once, from the Supabase SQL editor or Table editor:
--
--   update public.email_settings set
--       service_id         = 'service_xxxxxxx',
--       public_key         = 'xxxxxxxxxxxxxxxxx',
--       template_admin     = 'template_xxxxxxx',
--       template_autoreply = 'template_xxxxxxx',
--       admin_email        = 'campbalongnaturefarm@gmail.com'
--   where id = 'contact_form';
--
-- Until every field is filled the contact form refuses to send and says which
-- one is missing, rather than failing at EmailJS with a 400.
insert into public.email_settings (id) values ('contact_form')
on conflict (id) do nothing;


-- ======================================================================= RLS

alter table public.email_settings enable row level security;

-- Anyone can read: the contact form is on the public home page and the guest
-- filling it in is, by definition, not signed in.
drop policy if exists "email settings are public" on public.email_settings;
create policy "email settings are public" on public.email_settings
    for select to anon, authenticated using (true);

-- Only staff can write. Policies are OR'd, so the read policy above still
-- applies to a signed-in non-staff user; this one adds nothing for them.
drop policy if exists "staff manage email settings" on public.email_settings;
create policy "staff manage email settings" on public.email_settings
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());
