import emailjs from '@emailjs/browser'
import { supabase, isSupabaseConfigured, SUPABASE_SETUP_MESSAGE } from './supabaseClient.js'

// Contact-form email, via EmailJS.
//
// Two messages go out per submission, in this order:
//   1. the enquiry itself, to the Camp Ba-long admin inbox;
//   2. an automatic "we got your message" acknowledgement, back to the guest.
//
// They are two separate EmailJS templates because they have two different
// recipients and two different tones, and EmailJS binds one recipient per
// template. See docs/emailjs/README.md for the dashboard setup and the two
// ready-made templates that pair with the parameter names used below.
//
// WHERE THE IDS COME FROM
// -----------------------
// public.email_settings in Supabase — a single row, read at run time. They
// used to be VITE_EMAILJS_* in .env, which Vite inlines at BUILD time: the
// values were baked into the JavaScript by whichever machine ran the build, so
// a deployed site only had them if that machine did, and correcting a wrong ID
// meant a rebuild and a redeploy. Reading the row instead means a fix lands on
// the next page load and a host needs nothing beyond the two Supabase
// variables it already has.
//
// This does NOT make the IDs secret, and it is not what gets the form off
// localhost. EmailJS's browser SDK runs in the visitor's browser, so the
// public key is visible in the network tab either way. Sending from a domain
// is authorised by EmailJS → Account → Security → Allowed origins; a missing
// domain there is still a 403, whatever the key's route to the browser.

const SETTINGS_ROW_ID = 'contact_form'

// Config problems and delivery problems both surface through the same modal,
// but they are fixed by different people in different places — one is the site
// owner in a dashboard, the other is usually the guest or the network. The
// class keeps them apart so describeEmailError() can pass a config message
// straight through instead of running it past the EmailJS status codes, which
// would never match anything.
export class EmailConfigError extends Error {
    constructor(message) {
        super(message)
        this.name = 'EmailConfigError'
    }
}

// Resolved once and reused. The row does not change between two submissions in
// the same session in any way worth a second round trip, and re-reading it on
// every attempt would put a Supabase call in front of every retry of a failed
// send. A failed LOAD is not cached — see below.
let configPromise = null

function missingFieldsMessage(missing) {
    return (
        'The contact form is not connected to its mail service yet. If you are ' +
        'the site owner: open the email_settings row in Supabase (Table editor ' +
        `→ email_settings) and fill in ${missing.join(', ')}, taking the values ` +
        'from the EmailJS dashboard. See docs/emailjs/README.md. No redeploy ' +
        'is needed — the form reads the row on the next attempt.'
    )
}

// Validate the row before EmailJS ever sees it.
//
// The IDs are opaque strings, so almost nothing can be checked — except the
// one mistake that actually happens. A service ID and a template ID look
// alike, sit next to each other in the dashboard, and are copied with the same
// button; paste the service_… ID into a template slot and EmailJS answers a
// bare 400 that reads like the message body was malformed. That sends people
// editing the form. Naming the field here costs one regex and saves that whole
// detour.
function validate(row) {
    const missing = []
    if (!row?.service_id) missing.push('service_id')
    if (!row?.public_key) missing.push('public_key')
    if (!row?.template_admin) missing.push('template_admin')
    if (!row?.template_autoreply) missing.push('template_autoreply')
    if (missing.length) throw new EmailConfigError(missingFieldsMessage(missing))

    const swapped = ['template_admin', 'template_autoreply'].filter((field) =>
        /^service_/i.test(row[field]),
    )
    if (swapped.length) {
        throw new EmailConfigError(
            'The mail service is not set up correctly, so nothing was sent. If ' +
            `you are the site owner: ${swapped.join(' and ')} in the ` +
            'email_settings row holds the service ID, not a template ID. Both ' +
            'template fields need a value starting with "template_" — copy ' +
            'them from EmailJS → Email Templates, one per template.',
        )
    }

    return {
        serviceId: row.service_id,
        publicKey: row.public_key,
        templateAdmin: row.template_admin,
        templateAutoreply: row.template_autoreply,
        // Only a default: the admin template can also address itself in the
        // dashboard, so an empty value here is not fatal.
        adminEmail: row.admin_email || '',
    }
}

async function fetchConfig() {
    if (!isSupabaseConfigured) {
        // The mail settings live in the database now, so no database means no
        // mail settings. Saying "check .env for the EmailJS keys" here would
        // send someone looking for variables that no longer exist.
        throw new EmailConfigError(
            'The contact form cannot reach its settings, because this copy of ' +
            'the site is not connected to its database. ' + SUPABASE_SETUP_MESSAGE,
        )
    }

    const { data, error } = await supabase
        .from('email_settings')
        .select('service_id, public_key, template_admin, template_autoreply, admin_email')
        .eq('id', SETTINGS_ROW_ID)
        .maybeSingle()

    if (error) {
        throw new EmailConfigError(
            'Could not load the mail settings, so the message was not sent. ' +
            'Please try again in a moment. If you are the site owner: ' +
            error.message,
        )
    }
    // maybeSingle() returns null rather than throwing when the row is absent,
    // which is what a database restored without the migration looks like.
    if (!data) {
        throw new EmailConfigError(missingFieldsMessage(['the whole email_settings row']))
    }

    return validate(data)
}

// Load the settings, reusing the in-flight or completed request.
//
// A rejected load clears the cache so the next attempt retries. Caching the
// failure would mean a guest who submits during a two-second network blip is
// told the form is broken for the rest of their visit, with a reload as the
// only way out.
export function loadEmailConfig() {
    if (!configPromise) {
        configPromise = fetchConfig().catch((error) => {
            configPromise = null
            throw error
        })
    }
    return configPromise
}

// Warm the cache without caring about the outcome.
//
// Called when the contact form mounts, so the Supabase round trip overlaps
// with the guest typing instead of being added to the wait after they press
// Send. Failures are swallowed here on purpose: nothing has been submitted
// yet, so there is nothing to report, and loadEmailConfig() will retry at
// submit time and raise it then, where it belongs.
export function prefetchEmailConfig() {
    loadEmailConfig().catch(() => {})
}

// Turn an EmailJS rejection into a sentence the person at the keyboard can do
// something about.
//
// EmailJS rejects with { status, text } rather than an Error, and the raw text
// ("The Public Key is invalid", "API calls are disabled for non-browser
// applications") sends people editing the wrong thing. The status codes worth
// separating out:
//
//   0   — the request never left the browser: offline, or an ad blocker /
//         privacy extension eating requests to api.emailjs.com.
//   403 — the calling domain is not on the allow-list. This is THE failure you
//         hit the first time the site runs somewhere other than localhost, so
//         it names the fix instead of saying "forbidden".
//   422 — a template placeholder had nothing to fill it, usually the
//         recipient field, which means the template and the parameter names
//         below have drifted apart.
export function describeEmailError(error) {
    // Already a full explanation, written above with the fix in it.
    if (error instanceof EmailConfigError) return error.message

    const status = error?.status
    const text = error?.text ?? error?.message ?? String(error ?? 'Unknown error')

    if (status === 0 || /failed to fetch|networkerror|load failed/i.test(text)) {
        return 'Could not reach the mail service. Check your internet connection ' +
            'and try again — an ad blocker or privacy extension can also block it.'
    }
    // 400 covers two very different things. EmailJS returns it both for a
    // malformed payload and for an ID that does not name a real service or
    // template — and the second is overwhelmingly the one you hit, because
    // pasting a service ID into a template slot is an easy mistake and the two
    // look alike. Sending "please check the form" for that would send the
    // guest editing text that was never the problem, so the ID case is split
    // out and addressed to whoever can actually fix it.
    if (status === 400) {
        if (/service|template|public key/i.test(text)) {
            return 'The mail service is not set up correctly, so the message was ' +
                'not sent. If you are the site owner: ' + text + ' — check the ' +
                'email_settings row in Supabase, where template_admin and ' +
                'template_autoreply must each hold a template_… ID, not the ' +
                'service_… ID.'
        }
        return 'The mail service rejected the message details. Please check the ' +
            'form and try again.'
    }
    if (status === 401 || status === 403) {
        return 'The mail service refused this website. If you are the site owner: ' +
            'add this domain under EmailJS → Account → Security → Allowed ' +
            'origins, and confirm the public key in email_settings is the one ' +
            'for this project.'
    }
    if (status === 412) {
        return 'The mail service could not reach the Camp Ba-long inbox. If you ' +
            'are the site owner: reconnect the email service in the EmailJS ' +
            'dashboard — its access to the mailbox has expired.'
    }
    if (status === 422) {
        return 'The mail template is missing a recipient. If you are the site ' +
            'owner: the To field of the EmailJS template has to hold a ' +
            'placeholder the form actually sends — {{email}} for the guest ' +
            'auto-reply, {{to_email}} for the admin copy. Anything else ' +
            'resolves to empty and the message has nowhere to go.'
    }
    if (status === 429) {
        return 'Too many messages have been sent from here in a short time. ' +
            'Please wait a minute and try again.'
    }
    return text
}

// Everything the two templates can interpolate, built once so the admin copy
// and the guest copy can never disagree about what was submitted.
//
// EVERY VALUE IS SENT UNDER TWO NAMES, on purpose.
//
// A template is edited in the EmailJS dashboard, not in this repo, so the
// placeholder names in it and the parameter names here can drift apart with
// nothing to catch it — no build error, no type check, no test. And the way it
// shows up is quietly: an unmatched {{placeholder}} renders as empty string
// rather than failing, so a mismatched {{name}} becomes "Dear ," in a mail the
// guest has already received. Worse, when the drifting field is the one in the
// template's To box, the recipient is empty, EmailJS answers 422, and the
// auto-reply silently never arrives.
//
// Both of those happened here: the templates were written against {{name}} /
// {{email}} / {{phone}} / {{submission_date}} while this function sent only
// from_name / from_email / from_phone / submitted_at.
//
// EmailJS ignores parameters a template does not reference, so sending each
// value under both spellings costs one extra key in a JSON body and makes the
// two conventions interchangeable. Keep both when adding a field.
function buildParams({ name, email, phone, message }, adminEmail) {
    const phoneOrDefault = phone || 'Not provided'

    // Generated here, in Philippine time, because EmailJS templates cannot
    // format dates and whoever reads the enquiry wants local time.
    const submittedAt = new Date().toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'long',
        timeStyle: 'short',
    })

    return {
        // Guest-supplied — the short spelling the live templates use.
        name,
        email,
        phone: phoneOrDefault,
        message,
        submission_date: submittedAt,

        // The same values under the from_* spelling, which is what the example
        // templates in docs/emailjs/ are written against.
        from_name: name,
        from_email: email,
        from_phone: phoneOrDefault,
        submitted_at: submittedAt,

        // Routing. reply_to is what makes "Reply" in the admin inbox go back
        // to the guest rather than to EmailJS. Both of these belong in a
        // template's To / Reply To boxes rather than in its body.
        to_email: adminEmail,
        admin_email: adminEmail,
        reply_to: email,
    }
}

// Send one enquiry.
//
// Resolves with { autoReplySent } and rejects only when the ADMIN copy failed.
// That split is deliberate: the acknowledgement is a courtesy, the enquiry is
// the thing the guest actually came to do. If the admin mail is delivered and
// only the auto-reply bounces, telling the guest "sending failed" would be a
// lie that makes them submit again and double-mail the admin. The caller gets
// the flag so it can soften the wording instead.
export async function sendContactMessage(fields) {
    const config = await loadEmailConfig()

    const params = buildParams(fields, config.adminEmail)
    const options = { publicKey: config.publicKey }

    await emailjs.send(config.serviceId, config.templateAdmin, params, options)

    let autoReplySent = true
    try {
        await emailjs.send(config.serviceId, config.templateAutoreply, params, options)
    } catch (error) {
        autoReplySent = false
        // The raw status and text go alongside the explanation: this branch is
        // invisible to the guest by design, so the console is the only trace
        // it leaves, and "422 recipient address is empty" is what identifies
        // the template's To box as the thing to open.
        console.warn(
            '[Camp Ba-long] The enquiry reached the admin inbox but the guest ' +
            'auto-reply failed:',
            describeEmailError(error),
            { status: error?.status, text: error?.text },
        )
    }

    return { autoReplySent }
}
