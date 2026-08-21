# Automatic email (EmailJS)

This site sends **four** different messages, through **two** EmailJS templates,
on the **free plan**. One EmailJS account, one service, one public key.

**To the admin inbox** — its own template, because it is the only message that
goes anywhere other than the guest:

| Message | Template | Sent when |
|---------|----------|-----------|
| the enquiry itself | `admin-notification.html` | a visitor submits the contact form |

**To the guest** — all three through *one* template:

| Message | Sent when | Carries |
|---------|-----------|---------|
| "we received your message" | a visitor submits the contact form | their enquiry, quoted back |
| "your booking is verified" | staff **Approve** in the admin board | **the guest's receipt, in the body** |
| "rejected upon findings" | staff **Reject / Cancel** in the admin board | which booking, and what to do next |

> ### Why three messages share one template
>
> The free EmailJS plan allows **two templates**, and the admin notification
> spends one. That leaves exactly one for the guest — and there are three
> things to tell a guest.
>
> So the guest template holds no message of its own. It is a **shell**:
> a header, a slot, a footer. The site sends it the subject, the heading and
> the body, and picks which message to compose. A fourth guest message would
> need no dashboard change at all.
>
> That is the constraint turning into the better design. The wording now lives
> in [src/lib/guestEmails.js](../../src/lib/guestEmails.js), where it is
> version-controlled, diffable and reviewed — instead of in a textarea on a
> website, where a stray keystroke is invisible until a guest reads it.

Code involved:

- [src/lib/emailTheme.js](../../src/lib/emailTheme.js) — the shared bits every message body is built from
- [src/lib/guestEmails.js](../../src/lib/guestEmails.js) — **the wording of all three guest messages**
- [src/lib/receiptEmailBody.js](../../src/lib/receiptEmailBody.js) — renders the guest's receipt as email HTML
- [src/lib/emailClient.js](../../src/lib/emailClient.js) — reads the settings row, sends the two contact messages, translates failures into plain English
- [src/lib/bookingEmail.js](../../src/lib/bookingEmail.js) — the two booking-decision emails
- [src/components/contact.jsx](../../src/components/contact.jsx) — the form
- [src/admin/items/bookingsManage.jsx](../../src/admin/items/bookingsManage.jsx) — the Approve / Reject buttons
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

### 3. Create the guest template (the shell)

Create a **second** template and paste [`guest-shell.html`](guest-shell.html).

| Field | Value |
|-------|-------|
| To email | `{{email}}` ← **the guest, not the admin inbox** |
| From name | `Camp Ba-long` |
| Reply To | the Camp Ba-long admin address |
| Subject | `{{subject}}` ← yes, just the variable |

Save, then copy the **Template ID** → `template_autoreply`

This one template carries **all three** guest messages. That is why the Subject
box is only `{{subject}}`: each message supplies its own, so hard-coding one
would put "We received your message" on a booking confirmation.

> **`{{{body_html}}}` in the shell has THREE braces.** Not a typo. Two braces
> make EmailJS escape what it inserts, and the guest receives a wall of visible
> `<table>` tags instead of an email. Three braces insert it as markup.
> Everything inside was escaped when it was built (`esc()` in
> [emailTheme.js](../../src/lib/emailTheme.js)), so a guest name with an
> apostrophe or an angle bracket in it cannot break the layout.

> The mistake that trips everybody up: copying the admin template and forgetting
> to change **To email**. The guest's mail then lands in the admin inbox and the
> guest hears nothing.

#### Already have the auto-reply template? Then it is two steps, not five

The booking emails go out through the template you already have — **same
template, same ID, nothing to add in Supabase.** To turn it into the shell:

1. **Code (`</>`) view → replace everything** with
   [`guest-shell.html`](guest-shell.html).
2. **Subject → `{{subject}}`.**

**Leave "To email" as it is.** Whatever it holds — `{{from_email}}` from the
old auto-reply, or `{{email}}` — the site fills every one of those names with
the guest's address, so the mail arrives either way.

Step 2 is the one that cannot be skipped. Subject is a dashboard setting, not
something the message can carry: left on *"We received your message"*, that is
the line a confirmed booking arrives under, and for a lot of people the subject
is all they read.

Deploy the site first if you like — until you paste, the old template still
finds every field it was written against and the contact form keeps working
exactly as now. There is no window where anything is broken. What does *not*
work until you paste is the booking email: the old template has its message
hard-coded, so an approval would reach the guest wearing the wrong words.

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

That is the whole configuration — **four IDs, the same four as before the
booking emails existed**. There is nothing to add for them: they go out through
`template_autoreply`, the guest shell.

`admin_email` is the inbox that receives enquiries — it fills the
`{{to_email}}` placeholder in the admin template.

#### The two columns you can ignore

[`20260820120000_booking_status_emails.sql`](../../supabase/migrations/20260820120000_booking_status_emails.sql)
adds `template_booking_confirmed` and `template_booking_rejected`. **On the free
plan you never fill these in, and you do not need to run that migration at
all** — the booking emails work without it.

They are *overrides*, for later. Put a template ID in one and that message gets
its own EmailJS template instead of the shared shell — worth having if you move
to a paid plan and want the confirmation designed separately, or edited by
somebody who does not touch this repo. Blank is the normal state, so a blank
one is silent rather than a warning.

If the migration has not been run, the site notices and carries on: it asks for
the columns, Postgres says they are not there, and it re-reads the row without
them. One line in the browser console, nothing else.

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
| `422` | recipient empty | the template's **To email** box is blank, or names a variable nothing sends — see [The To box](#the-to-box-is-the-one-that-fails-hard) |
| `429` | rate limited | the free plan's monthly/burst limit |

Two failures happen *before* EmailJS is contacted at all, and the pop-up names
the field rather than reporting a status:

- a blank column in `email_settings` — the message says which one is empty and
  where to fill it;
- a `service_…` value sitting in `template_admin` or `template_autoreply` —
  caught by a check in `emailClient.js` because EmailJS would otherwise answer
  a bare `400` that reads like the message body was malformed.

### The free plan's other limit: the monthly quota

Templates are not the only thing the free plan caps — sends are too. That
allowance now covers booking decisions as well as contact enquiries, so the
arithmetic changed:

- a contact submission spends **two** (the enquiry, and the acknowledgement);
- an approved or rejected booking spends **one**.

Status `429` in the table above is what running out looks like. The booking is
still saved and the admin board still reports what happened — the guest simply
does not get told, and staff see the amber line saying so. Check the quota in
EmailJS → Account if approvals suddenly stop mailing near the end of a month.

If the enquiry sends but the auto-reply fails, that is **not** treated as a
failed submission. The guest sees a success message with the confirmation
sentence removed, and the reason is logged to the console. Telling them
"sending failed" when the admin already has the enquiry would only make them
submit it twice.

---

## Template variables

### The guest shell (template 2) — six variables, and that is all

The shell never changes, whichever of the three messages is going out. It reads
these and nothing else:

| Variable | What it holds |
|----------|---------------|
| `{{subject}}` | the subject line — put this in the **Subject** box |
| `{{heading}}` | the banner headline, e.g. "Your Booking Is Verified" |
| `{{{body_html}}}` | **the whole message, as markup — THREE braces** |
| `{{body_text}}` | the same message as plain text — sent, but the shell does not render it; there if you ever add a text part |
| `{{footer_note}}` | the small print under the rule |
| `{{email}}` | the guest's address — put this in the **To email** box |

The address is also sent as `{{to_email}}`, `{{user_email}}`, `{{from_email}}`
and `{{recipient}}`, all holding the same value, so a **To email** box left on
any of those still reaches the guest. `{{email}}` is the one to use; the spares
exist because a To box that resolves to nothing fails *silently* — see below.

`{{{body_html}}}` takes three braces. Two braces escape it and the guest gets
visible `<table>` tags where the message should be. It is safe to insert
unescaped because every value inside was escaped leaf-by-leaf when it was built
— see `esc()` in [emailTheme.js](../../src/lib/emailTheme.js).

**To add or change wording, edit
[guestEmails.js](../../src/lib/guestEmails.js), not the template.** The three
builders there each return `{ subject, heading, html, text, footerNote }`, which
is exactly the list above. Adding a fourth guest message means adding a function
— the dashboard is not involved.

### The admin template (template 1)

Built by `buildParams()` in [emailClient.js](../../src/lib/emailClient.js).

**Every value is sent under two names**, and the two are interchangeable. Pick
either column; mixing them within one template is fine.

| Value | Short name | `from_` name |
|-------|-----------|--------------|
| guest's name | `{{name}}` | `{{from_name}}` |
| guest's email | `{{email}}` | `{{from_email}}` |
| guest's phone, or `Not provided` | `{{phone}}` | `{{from_phone}}` |
| timestamp, in Philippine time | `{{submission_date}}` | `{{submitted_at}}` |
| the message body | `{{message}}` | — |
| `email_settings.admin_email` | `{{admin_email}}` | `{{to_email}}` |
| guest's email, for the **Reply To** box | — | `{{reply_to}}` |

Why two: a template is edited in the EmailJS dashboard, not in this repo, so its
placeholder names and the parameter names in `buildParams()` can drift apart
with nothing to catch it — no build error, no type check, no test. An unmatched
`{{placeholder}}` renders as an empty string rather than failing, so the drift
reaches the guest as `Dear ,` in a mail already delivered. Sending both
spellings costs one extra key in a JSON body. **Keep both when you add a
field.**

The contact form also sends all of these to the *guest* template, on top of the
shell's own five. That is deliberate and it is what makes the shell safe to
paste in at any time: until you do, the old auto-reply template still finds
every field it was written against.

### The To box is the one that fails hard

A placeholder that goes missing from a template's **body** produces an ugly
mail. A placeholder that goes missing from its **To email** box produces *no
mail*: the recipient is empty, EmailJS answers `422`, and for the guest copy
that failure is deliberately not shown to the guest — it only reaches the
browser console. So:

- guest shell → **To email** = `{{email}}`
- admin template → **To email** = `{{to_email}}` (or `{{admin_email}}`)

**The guest address is sent under five names at once** — `{{email}}`,
`{{to_email}}`, `{{user_email}}`, `{{from_email}}`, `{{recipient}}` — by
`shellParams()` in [guestEmails.js](../../src/lib/guestEmails.js). Any of them
in the To box delivers to the guest, so pasting the shell over a template whose
To box you forget to change still works.

That breadth is not decoration. It closed a real failure: the shell's To box is
`{{email}}`, the auto-reply it replaced used `{{from_email}}`, and only the
contact form ever sent `{{from_email}}` — so a half-finished swap left
enquiries arriving normally while every booking confirmation died as a `422`
nobody saw. Two symptoms that look unrelated, one missing variable. Keep all
five when you add a message.

Anything *outside* that list, including a name that merely looks right, still
sends nothing.

### Where the emailed receipt comes from

It is not the PNG the guest downloads from My Bookings, and it is not an
attachment. EmailJS caps all template variables at **50kb combined**, so a
base64 image of the canvas sheet would be rejected outright — and an emailed
`<img>` fetched from a server is blocked by default in most clients anyway. So
the receipt is rendered into the body as HTML: visible the moment the mail
opens, printable from the client, and intact when forwarded.

What it is *not* is a second implementation. `buildReceipt()` in
[receiptImage.js](../../src/pages/components/receiptImage.js) was already the
one place that works out what a receipt says — every section, every charge line,
every figure. The PNG draws that model onto a canvas;
[receiptEmailBody.js](../../src/lib/receiptEmailBody.js) writes the same model
out as table markup. **Add a charge line in `buildReceipt()` and it appears in
both**, which is the point: an emailed receipt that quietly disagreed with the
downloaded one is a dispute at the gate.

#### The 50kb ceiling, and what happens at it

A normal confirmation is about 15kb, so this is headroom rather than a live
limit — but a reservation with dozens of add-on lines can grow past it, and the
failure would be the bad kind: the guest silently never receives the
confirmation they were told to present at the gate.

So the send steps down instead of failing. It tries, in order:

1. the full itemised receipt, with a plain-text copy alongside;
2. the same without the plain-text copy;
3. a **compact** message — no itemisation, the booking named instead, and the
   guest pointed at My Bookings for the full receipt.

Tier 3 is flat at about 4kb regardless of how large the booking is, so there is
no reservation this cannot email. Nothing is ever truncated to fit: half a
receipt is worse than none, because it still looks complete and is wrong about
money.

### What staff see

The admin board reports the outcome as a line above the table: green when the
guest was emailed, amber with the reason when they were not — no address on
file, EmailJS refused the domain, settings unreachable.

The mail is always sent **after** the status write, and only if that write
succeeded. A booking that failed to save must never produce a "your reservation
is verified" email, because that guest arrives at a gate with no reservation
behind them. The reverse — saved, but the mail failed — is recoverable with a
phone call, which is why the mail is the half allowed to fail and why a failure
never blocks staff from verifying a receipt.
