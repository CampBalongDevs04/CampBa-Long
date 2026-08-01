# Contact form email (EmailJS)

The contact form on the home page sends **two** emails per submission:

| # | Template | Goes to | Purpose |
|---|----------|---------|---------|
| 1 | `admin-notification.html` | the Camp Ba-long inbox | the enquiry itself |
| 2 | `auto-reply.html` | the guest | "we received your message" |

Code involved:

- [src/lib/emailClient.js](../../src/lib/emailClient.js) — reads the settings row, sends both messages, translates failures into plain English
- [src/components/EmailStatusModal.jsx](../../src/components/EmailStatusModal.jsx) — the warning pop-up
- [src/components/contact.jsx](../../src/components/contact.jsx) — the form
- [supabase/migrations/20260801000000_email_settings.sql](../../supabase/migrations/20260801000000_email_settings.sql) — the table the IDs live in

> **The IDs are not in `.env`.** They live in the `email_settings` row in
> Supabase and are read at run time. `VITE_EMAILJS_*` no longer exists — if you
> are following an older note that tells you to set those, ignore it.

---

## Setup, once

Everything below happens at <https://dashboard.emailjs.com>. Nothing here needs
a code change — you are collecting five values and then pasting them into one
database row.

### 1. Connect the mailbox

**Email Services → Add New Service.** Pick Gmail (or whatever the camp uses),
sign in to the Camp Ba-long mailbox, and allow access.

Copy the **Service ID** → `service_id`

### 2. Create the admin template

**Email Templates → Create New Template.** Open the **Code** / `</>` view and
paste the whole of [`admin-notification.html`](admin-notification.html) (the
HTML comment at the top can stay, it does not render).

In the settings beside the editor:

| Field | Value |
|-------|-------|
| To email | `{{to_email}}` |
| From name | `Camp Ba-long Website` |
| Reply To | `{{reply_to}}` |
| Subject | `New enquiry from {{from_name}} — Camp Ba-long` |

Save, then copy the **Template ID** → `template_admin`

> Copy it from the **template**, not from the service. Both IDs are one click
> apart in the dashboard and a template ID always starts with `template_` — a
> `service_…` value in this field is the most common way to break the form.

### 3. Create the auto-reply template

Create a **second** template and paste [`auto-reply.html`](auto-reply.html).

| Field | Value |
|-------|-------|
| To email | `{{from_email}}` ← **the guest, not the admin inbox** |
| From name | `Camp Ba-long` |
| Reply To | the Camp Ba-long admin address |
| Subject | `We received your message — Camp Ba-long` |

Save, then copy the **Template ID** → `template_autoreply`

> The one mistake that trips everybody up: copying the admin template and
> forgetting to change **To email**. The guest's thank-you then lands in the
> admin inbox and the guest hears nothing back.

### 4. Copy the public key

**Account → General → Public Key** → `public_key`

### 5. Fill in the settings row

Supabase → **Table editor → `email_settings`**. There is exactly one row, with
`id = 'contact_form'`; a check constraint keeps it that way, so edit it rather
than adding another. Or, from the SQL editor:

```sql
update public.email_settings set
    service_id         = 'service_xxxxxxx',
    public_key         = 'xxxxxxxxxxxxxxxxx',
    template_admin     = 'template_xxxxxxx',
    template_autoreply = 'template_xxxxxxx',
    admin_email        = 'campbalongnaturefarm@gmail.com'
where id = 'contact_form';
```

`admin_email` is the inbox that receives enquiries — it fills the
`{{to_email}}` placeholder in template 1.

**No restart, no rebuild.** The form reads this row on the next attempt, which
is the whole reason the values are here and not in `.env`.

Only staff can write to the row — the policy is `public.is_staff()`, the same
one that guards bookings — so you need to be signed in as staff if you are
editing it through the app's own Supabase session rather than the dashboard.

---

## Making it work off localhost

This is the part that is easy to get wrong, so it gets its own section.

A deployed site needs **one** thing beyond a filled-in settings row:

### The domain on the allow-list

**Account → Security → Allowed origins.** Add your production domain, e.g.
`https://campbalong.com`. Leave `http://localhost:5173` there too so local
development keeps working.

Miss this and every send from the live site fails with status `403`. The
pop-up says so in as many words — *"The mail service refused this website…"* —
rather than showing a bare "forbidden".

That's it. There is nothing to configure on the host: the IDs come from the
database at run time, and the only build-time variables left are the two
`VITE_SUPABASE_*` ones the rest of the site already needs.

### What moving the IDs to Supabase did and did not fix

Worth being exact, because the two get conflated.

**It fixed the build-time problem.** Vite inlines `import.meta.env.VITE_*` at
**build** time, so the old `VITE_EMAILJS_*` values were frozen into the
JavaScript by whichever machine ran `npm run build`. A `.env` on the server did
nothing; every host needed the same five variables re-entered before a deploy
produced a working form; and correcting a typo in a template ID meant a rebuild
and a redeploy. Reading the row instead means a fix lands on the next page
load, and a fresh clone with the two Supabase variables has a working contact
form immediately.

**It did not make the IDs secret, and it is not what authorises the live
domain.** EmailJS's browser SDK runs in the visitor's browser, so the public
key reaches the browser either way — bundled before, fetched now, visible in
the network tab in both cases. The allow-list above is the actual control.

**If you want the key off the browser entirely,** that is a different change:
move the send into a **Supabase Edge Function** and call the EmailJS REST API
server-side with the **private** key. Then nothing sensitive is in the browser
and the allow-list stops mattering. It costs a deployed function, a CORS setup
and its own error path — worth it if you later want server-side rate limiting
or spam filtering, not needed just to deploy.

---

## When it fails

The form raises a pop-up rather than failing silently — a quiet failure means
the guest thinks they have written to you and you never find out. Each EmailJS
status maps to a specific sentence in `describeEmailError()`:

| Status | What actually happened | Fix |
|--------|------------------------|-----|
| `0` | request never left the browser | offline, or an ad blocker is eating `api.emailjs.com` |
| `400` | bad request payload | a template placeholder does not match the parameter names |
| `401` / `403` | key or origin rejected | add the domain to Allowed origins; check the public key |
| `412` | EmailJS cannot reach the mailbox | reconnect the email service — its OAuth access expired |
| `422` | recipient empty | the template's **To email** field is blank or misspelled |
| `429` | rate limited | the free plan's monthly/burst limit |

Two failures happen *before* EmailJS is contacted at all, and the pop-up names
the field rather than reporting a status:

- a blank column in `email_settings` — the message says which one is empty and
  where to fill it;
- a `service_…` value sitting in `template_admin` or `template_autoreply` —
  caught by a check in `emailClient.js` because EmailJS would otherwise answer
  a bare `400` that reads like the message body was malformed.

If the enquiry sends but the auto-reply fails, that is **not** treated as a
failed submission. The guest sees a success message with the confirmation
sentence removed, and the reason is logged to the console. Telling them
"sending failed" when the admin already has the enquiry would only make them
submit it twice.

---

## Template variables

Both templates can use any of these. They are built in one place —
`buildParams()` in `src/lib/emailClient.js` — so the two copies can never
disagree about what was submitted.

**Every value is sent under two names**, and the two are interchangeable. Pick
either column; mixing them within one template is fine too.

| Value | Short name | `from_` name |
|-------|-----------|--------------|
| guest's name | `{{name}}` | `{{from_name}}` |
| guest's email | `{{email}}` | `{{from_email}}` |
| guest's phone, or `Not provided` | `{{phone}}` | `{{from_phone}}` |
| timestamp, in Philippine time | `{{submission_date}}` | `{{submitted_at}}` |
| the message body | `{{message}}` | — |
| `email_settings.admin_email` | `{{admin_email}}` | `{{to_email}}` |
| guest's email, for the **Reply To** box | — | `{{reply_to}}` |

Why two: a template is edited in the EmailJS dashboard, not in this repo, so
its placeholder names and the parameter names in `buildParams()` can drift
apart with nothing to catch it — no build error, no type check, no test. An
unmatched `{{placeholder}}` renders as an empty string rather than failing, so
the drift reaches the guest as `Dear ,` in a mail already delivered. Sending
both spellings costs one extra key in a JSON body. **Keep both when you add a
field**, or the next template written to the other convention breaks the same
way.

### The To box is the one that fails hard

A placeholder that goes missing from a template's **body** produces an ugly
mail. A placeholder that goes missing from its **To email** box produces *no
mail*: the recipient is empty, EmailJS answers `422`, and for the auto-reply
that failure is deliberately not shown to the guest — it only reaches the
browser console. So:

- auto-reply template → **To email** = `{{email}}` (or `{{from_email}}`)
- admin template → **To email** = `{{to_email}}` (or `{{admin_email}}`)

Anything else there, including a name that merely looks right, sends nothing.
