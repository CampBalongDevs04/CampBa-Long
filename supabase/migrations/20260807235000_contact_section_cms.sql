-- ============================================================================
--  Camp Ba-long — the Contact section, moved into the database
-- ----------------------------------------------------------------------------
--  The last block of the home page: the heading, the column beside the form —
--  its own heading, its paragraph, the phone/email/hours rows and the Admin
--  Hours panel — and the wording of the enquiry form itself. All of it was
--  written into src/components/contact.jsx.
--
--  It follows the seven sections before it (20260807120000 … 20260807230000):
--  a singleton row for the copy that exists once, and a table for the list.
--
--  WHAT IS NOT IN HERE: THE FORM'S BEHAVIOUR
--  -----------------------------------------
--  The four fields' LABELS and PLACEHOLDERS are copy and are stored below. The
--  fields themselves are not: their `name` attributes are what
--  sendContactMessage reads, their `type` is what makes a phone keypad open on
--  a phone, and `required` is what stops an empty enquiry. Renaming a field
--  from a text box would quietly break the email that the enquiry arrives in.
--  So this table can change what the form SAYS and never what it DOES.
--
--  Where the enquiry is delivered is not here either — the EmailJS ids live in
--  `email_settings` (20260801050155) and are a different kind of secret.
--
--  THE NOTE IS FOUR COLUMNS BECAUSE TWO PARTS OF IT ARE BOLD
--  --------------------------------------------------------
--  The sentence under Admin Hours reads "Note: Booking confirmations … only
--  during 8:00 AM – 5:00 PM. Requests made outside these hours …", with both
--  "Note:" and the times in bold. That is emphasis inside a sentence, and it is
--  part of the design rather than something staff should have to express in
--  markup — the same reason `offer_section` keeps its gold closing words in
--  their own column.
--
--  THE PHONE NUMBER IS WRITTEN DOWN IN MORE THAN ONE PLACE
--  -------------------------------------------------------
--  It also appears on the Location card (`location_details`) and in the footer,
--  which is still hardcoded. They are deliberately NOT joined into one row
--  here: a resort with a second line, or a landline for the office and a mobile
--  for bookings, is a normal thing and one shared field would make it
--  impossible. The dashboard says on screen that the other copies exist, so
--  changing one is a decision rather than an oversight.
--
--  Seeded word for word with what the front end had hardcoded, so applying this
--  changes nothing a visitor reads.
-- ============================================================================


-- ============================================================ contact_section

create table if not exists public.contact_section (
    id                       text primary key default 'home'
        check (id = 'home'),

    -- The heading over the whole section.
    eyebrow                  text,   -- "Contact us"
    title                    text,   -- "Got question in your mind?"

    -- The column beside the form.
    info_title               text,   -- "We’d love to hear from you"
    info_text                text,

    -- The cream panel at the bottom of that column.
    admin_title              text,   -- "Admin Hours"
    admin_text               text,   -- "Monday - Sunday 8AM - 5PM"

    -- Its note, in the four pieces the sentence is printed in. See the header.
    note_label               text,   -- "Note:"        (bold)
    note_text                text,   -- up to the times
    note_highlight           text,   -- "8:00 AM – 5:00 PM."  (bold)
    note_after               text,   -- the rest of the sentence

    -- What the form SAYS. What it does is in the component — see the header.
    form_name_label          text,
    form_name_placeholder    text,
    form_email_label         text,
    form_email_placeholder   text,
    form_phone_label         text,
    form_phone_placeholder   text,
    form_message_label       text,
    form_message_placeholder text,
    form_submit_label        text,   -- "Send Message"
    form_sending_label       text,   -- "Sending…", while it is in flight

    updated_at               timestamptz not null default now()
);

comment on table public.contact_section is
    'Singleton row holding the home page contact copy, including the enquiry '
    'form''s labels and placeholders. The form''s field names, types and '
    'validation stay in the component; where the enquiry is delivered is in '
    'email_settings.';
comment on column public.contact_section.note_highlight is
    'The bold times in the middle of the note sentence.';
comment on column public.contact_section.form_sending_label is
    'What the button reads while a message is being sent. Empty falls back to '
    'the submit label, so the button never goes blank mid-send.';

create or replace function public.contact_section_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists contact_section_touch_trg on public.contact_section;
create trigger contact_section_touch_trg
    before update on public.contact_section
    for each row execute function public.contact_section_touch();


-- ============================================================ contact_details
--  The phone / email / hours rows above the Admin Hours panel.

create table if not exists public.contact_details (
    id         text primary key,               -- 'phone'

    label      text not null,                  -- "Phone", in gold caps
    info       text not null,                  -- the number itself

    icon_key   text,
    icon_url   text,

    sort_order integer not null default 0,
    is_active  boolean not null default true
);

comment on table public.contact_details is
    'The phone / email / hours rows in the home page contact column. Separate '
    'from location_details on purpose — see the migration header.';
comment on column public.contact_details.info is
    'One line. Unlike the location card''s rows these are single values, which '
    'is why this is text and not text[].';
comment on column public.contact_details.icon_key is
    'Names an icon the site ships with — see src/data/cmsIcons.js.';


-- =================================================================== seeding
--  Word for word what src/components/contact.jsx had hardcoded.

insert into public.contact_section (
    id,
    eyebrow, title,
    info_title, info_text,
    admin_title, admin_text,
    note_label, note_text, note_highlight, note_after,
    form_name_label, form_name_placeholder,
    form_email_label, form_email_placeholder,
    form_phone_label, form_phone_placeholder,
    form_message_label, form_message_placeholder,
    form_submit_label, form_sending_label
)
values (
    'home',
    'Contact us',
    'Got question in your mind?',
    'We’d love to hear from you',
    'Planning a stay, booking an event, or just curious about Camp Ba-long? Send us '
        || 'a message and our team will get back to you within 24 hours.',
    'Admin Hours',
    'Monday - Sunday 8AM - 5PM',
    'Note:',
    'Booking confirmations and other administrative requests are processed only during',
    '8:00 AM – 5:00 PM.',
    'Requests made outside these hours will be handled on the next business day.',
    'Name',         'Enter your name',
    'Email',        'Enter your email',
    'Phone Number', 'Enter your phone number',
    'Message',      'Enter your message',
    'Send Message', 'Sending…'
)
on conflict (id) do nothing;

insert into public.contact_details (id, label, info, icon_key, sort_order)
values
    ('phone', 'Phone', '+63 9622331708',                 'phone', 1),
    ('email', 'Email', 'campbalongnaturefarm@gmail.com', 'email', 2),
    ('hours', 'Hours', 'Open daily, 8:00 AM – 8:00 PM',  'time',  3)
on conflict (id) do nothing;


-- ======================================================================= RLS

alter table public.contact_section enable row level security;
alter table public.contact_details enable row level security;

drop policy if exists "contact section is public" on public.contact_section;
create policy "contact section is public" on public.contact_section
    for select to anon, authenticated using (true);

drop policy if exists "staff manage contact section" on public.contact_section;
create policy "staff manage contact section" on public.contact_section
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());

drop policy if exists "contact details are public" on public.contact_details;
create policy "contact details are public" on public.contact_details
    for select to anon, authenticated using (true);

drop policy if exists "staff manage contact details" on public.contact_details;
create policy "staff manage contact details" on public.contact_details
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ================================================================== realtime

do $$
begin
    alter publication supabase_realtime add table public.contact_section;
exception when duplicate_object then null;
end $$;

do $$
begin
    alter publication supabase_realtime add table public.contact_details;
exception when duplicate_object then null;
end $$;
