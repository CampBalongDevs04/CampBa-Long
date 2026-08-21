import emailjs from '@emailjs/browser'
import { loadEmailConfig, describeEmailError, EmailConfigError } from './emailClient.js'
import { bookingVerified, bookingRejected, shellParams } from './guestEmails.js'

// The two mails a guest gets when staff act on their reservation.
//
// Both are sent from the ADMIN board, right after the status write that
// triggers them (see src/admin/items/bookingsManage.jsx). Until now a guest
// who uploaded a down-payment receipt heard nothing once it was reviewed —
// the row flipped in the dashboard and they only found out by opening My
// Bookings again.
//
//   sendBookingVerifiedEmail()  the receipt checked out. Carries the guest's
//                               full receipt in the body, because "verified"
//                               is precisely when they need something to
//                               present at the gate.
//   sendBookingRejectedEmail()  it did not. Says the hold is released and
//                               invites them to book again.
//
// NO NEW EMAILJS TEMPLATE IS NEEDED
// ---------------------------------
// The free plan allows two templates, and both were already in use: the
// enquiry to the admin inbox, and the guest-facing one. So these two messages
// reuse the GUEST-FACING template, which became a content-agnostic shell — a
// header, a slot, a footer — that this code fills. See guestEmails.js.
//
// template_booking_confirmed / template_booking_rejected in email_settings
// therefore start empty and stay empty on the free plan: blank means "use the
// guest template", which is the normal case and not a misconfiguration. They
// exist as OVERRIDES for a paid plan, where somebody may want the confirmation
// to be its own template with its own design. That is why a blank one is
// silent rather than a warning — warning about the ordinary setup is how a
// dashboard trains people to ignore it.
//
// WHY THIS NEVER THROWS AT THE CALLER
// -----------------------------------
// Every function here resolves with { ok, skipped?, message? } and rejects for
// nothing. The mail is a courtesy on top of an action that has ALREADY
// happened and cannot be unwound by a failed send: by the time this runs the
// booking is confirmed or cancelled in Postgres, the unit is held or released,
// and the guest can see it in My Bookings. A throw here would put a red error
// in front of staff for work that succeeded, and — worse — invite them to
// click Approve a second time. So the outcome is returned, the admin board
// shows it as a note beside the row, and the decision stands either way.
//
// The same reasoning runs the other direction: the send is fired AFTER the
// status write and never before it, so a mail service that is down,
// unconfigured, or blocked by an ad blocker cannot stop staff verifying a
// receipt.

// EmailJS rejects a send whose template variables exceed 50kb in total. The
// only thing here that can approach that is the receipt on the confirmation,
// which grows with every charge line a booking carries — a big group with a
// long food order is the realistic worst case. A loaded single booking sits
// around 14kb, so this is headroom rather than a live constraint, but the
// failure it prevents is bad enough to be worth the few lines: the guest
// silently never gets the confirmation they are told to present at the gate.
//
// The budget is deliberately under the real ceiling. The measurement below is
// of the JSON body, and EmailJS adds its own envelope around it.
const PARAM_BUDGET_BYTES = 44_000

const paramBytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length

// Pick the richest version of a message that fits, giving up detail rather
// than giving up the email.
//
// `variants` arrive richest first and are tried in order:
//
//   1. the full message, receipt itemised and a plain-text copy alongside;
//   2. the same, minus the plain-text copy — a real courtesy to a client set
//      to text-only, but the one field whose loss still leaves the email
//      working, so it is the first thing spent;
//   3. the compact message: no itemised receipt, the booking named instead,
//      and the guest pointed at My Bookings for the full sheet.
//
// Measured against a REAL booking, tier 1 is about 15kb and the ceiling is
// only reached somewhere past fifty add-on lines, so tiers 2 and 3 are
// insurance rather than a routine path. But the failure they prevent is the
// bad one — a guest silently never receiving the confirmation they were told
// to present at the gate — and the fix costs a comparison.
//
// Nothing is ever truncated to fit. Half a receipt is worse than no receipt,
// because it still looks complete and is wrong about money.
function fitToBudget(variants) {
    for (const params of variants) {
        if (paramBytes(params) <= PARAM_BUDGET_BYTES) return params
    }
    return null
}

function formatMobileFallback(booking) {
    return booking.guest?.mobile || 'the mobile number on the booking'
}

// The two optional per-message template overrides. Blank is the ordinary
// state — see the header — and means the shared guest template is used.
const OVERRIDE_KEY = {
    confirmed: 'templateBookingConfirmed',
    rejected: 'templateBookingRejected',
}

// Shared front half of both mails: no guest address is not a failure, and
// neither is a settings row that will not load. Both resolve as `skipped` with
// the reason, because the booking decision behind them has already gone
// through.
async function prepare(booking, kind) {
    if (!booking) return { skipped: 'There is no booking to email about.' }

    if (!booking.guest?.email) {
        return {
            skipped:
                'No email was sent: this booking has no guest email address on ' +
                'file. Contact the guest on ' + formatMobileFallback(booking) + '.',
        }
    }

    let config
    try {
        config = await loadEmailConfig()
    } catch (error) {
        // EmailConfigError already carries a full explanation with the fix in
        // it (a missing settings row, an unreachable database). Anything else
        // is unexpected and is reported as-is rather than dressed up.
        return {
            skipped:
                error instanceof EmailConfigError
                    ? 'The booking is saved, but no email was sent. ' + error.message
                    : 'The booking is saved, but no email was sent: ' +
                      String(error?.message ?? error),
        }
    }

    // The override if one is set, the shared guest template otherwise. The
    // fallback is the whole reason this works on the free plan.
    const templateId = config[OVERRIDE_KEY[kind]] || config.templateAutoreply

    // Only reachable if the guest template is ALSO unset, which is the
    // contact form's own broken state and already reported by validate() in
    // emailClient.js — but prepare() must not hand emailjs.send() an empty
    // template ID, which fails as an opaque 400.
    if (!templateId) {
        return {
            skipped:
                'The booking is saved, but no email was sent: no guest email ' +
                'template is configured. If you are the site owner: fill in ' +
                'template_autoreply in the email_settings row in Supabase. See ' +
                'docs/emailjs/README.md.',
        }
    }

    return { config, templateId }
}

// Send one message through the shell and turn any failure into a sentence
// staff can act on. Shared by both mails so the two cannot report the same
// problem two different ways.
//
// `builders` are FUNCTIONS returning the message at descending levels of
// detail — see fitToBudget(). Most callers pass one; the confirmation passes
// two, because it is the only one carrying a receipt that can grow without
// bound.
//
// They are thunks rather than ready-made content for two reasons. The cheap
// one: the compact version is only built if the full one does not fit, which
// is almost never. The important one is below.
async function send(booking, ready, builders) {
    const recipient = {
        name: booking.guest?.fullName || 'Guest',
        email: booking.guest.email,
    }

    // COMPOSING THE MESSAGE IS INSIDE THE GUARD, not before it.
    //
    // The confirmation renders the guest's whole receipt, which means it runs
    // buildReceipt() over a live booking row — dozens of fields, some optional,
    // written by three different code paths (single, group, guest-cancelled).
    // A row shaped in a way that function does not expect throws, and when
    // that throw happened out here, ahead of the try, it escaped as a rejected
    // promise: the admin board's `await mail(booking)` blew up, its note was
    // never set, and staff saw a button that did NOTHING — no email, no error,
    // no clue. Silence is the one outcome this module promises never to
    // produce, since the whole point is that staff learn what the guest was
    // told.
    let variants
    try {
        variants = builders.flatMap((build) => {
            const full = shellParams(build(), recipient)
            return [full, { ...full, body_text: '' }]
        })
    } catch (error) {
        console.error('[Camp Ba-long] Could not compose the booking email:', error)
        return {
            ok: false,
            skipped: true,
            message:
                'The booking is saved, but the email could not be built from it — ' +
                'so nothing was sent and the guest has not been told. Please ' +
                'contact them directly. If you are the site owner: the details ' +
                'are in the browser console (' + String(error?.message ?? error) + ').',
        }
    }

    const params = fitToBudget(variants)
    if (!params) {
        return {
            ok: false,
            skipped: true,
            message:
                'The booking is saved, but the email was not sent: this reservation ' +
                'is too large for the mail service to carry (the limit is 50kb per ' +
                'message). Tell the guest their booking is confirmed and to open My ' +
                'Bookings for their receipt.',
        }
    }

    try {
        await emailjs.send(ready.config.serviceId, ready.templateId, params, {
            publicKey: ready.config.publicKey,
        })
        return { ok: true }
    } catch (error) {
        // The console keeps the raw status and text alongside the explanation:
        // "422 recipient address is empty" is what identifies the template's To
        // box as the thing to open, and the admin board only shows the sentence.
        console.warn('[Camp Ba-long] Booking email failed:', describeEmailError(error), {
            status: error?.status,
            text: error?.text,
            serviceId: ready.config.serviceId,
            templateId: ready.templateId,
            recipient: recipient.email,
        })
        return {
            ok: false,
            message: describeEmailError(error),
            // Which template was actually used. "No email arrives" looks the
            // same whether the template is wrong or the settings row points at
            // a different template than the one that was just edited — and the
            // second is only visible by comparing these two IDs against the
            // EmailJS dashboard, so they travel with the failure.
            detail: { serviceId: ready.config.serviceId, templateId: ready.templateId },
        }
    }
}

// Staff verified the down-payment receipt: the hold is now a confirmed stay.
export async function sendBookingVerifiedEmail(booking) {
    const ready = await prepare(booking, 'confirmed')
    if (ready.skipped) return { ok: false, skipped: true, message: ready.skipped }

    // Richest first: the full itemised receipt, then a compact version that
    // names the booking and points at My Bookings. fitToBudget() picks.
    return send(booking, ready, [
        () => bookingVerified(booking),
        () => bookingVerified(booking, { compact: true }),
    ])
}

// Staff rejected the booking: the hold is released and the unit's dates are
// back in availability.
export async function sendBookingRejectedEmail(booking, { reason = '' } = {}) {
    const ready = await prepare(booking, 'rejected')
    if (ready.skipped) return { ok: false, skipped: true, message: ready.skipped }

    // One variant only: a rejection carries no receipt, so there is nothing
    // on it that can grow past the limit.
    return send(booking, ready, [() => bookingRejected(booking, { reason })])
}
