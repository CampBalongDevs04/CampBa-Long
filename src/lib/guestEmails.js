// The three messages this site sends to a guest, composed in code.
//
// All three go out through ONE EmailJS template — the shell in
// docs/emailjs/guest-shell.html — because the free plan allows two templates
// in total and the other one is the enquiry that goes to the admin inbox. The
// shell contributes a header, a slot and a footer; everything below fills the
// slot. See the header of emailTheme.js for why that turned out to be the
// better arrangement rather than a workaround.
//
// Each builder returns the same four fields, which are exactly the variables
// the shell reads:
//
//     { subject, heading, html, text, footerNote }
//
// Adding a fourth message means adding a function here and nothing at all in
// the EmailJS dashboard.

import {
    INK,
    LEAF,
    paragraph,
    callout,
    quoted,
    detailBox,
    signOff,
    adminHoursNote,
    esc,
} from './emailTheme.js'
import { renderReceiptForEmail } from './receiptEmailBody.js'
import { groupUnitsLabel } from '../data/accommodationDB.js'

const FOOTER_CONTACT =
    'You are receiving this because this address was used to contact ' +
    'Camp Ba-long Nature Farm & Resort.'
const FOOTER_BOOKING =
    'This message was sent automatically when your reservation was reviewed by ' +
    'our staff. You are receiving it because this address was used to book with ' +
    'Camp Ba-long Nature Farm & Resort.'

function formatStayDate(value) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleDateString('en-PH', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

// A combined reservation has no single accommodation name — it has a units
// list, rolled up to 'Teepee ×2, A-House Small' by the same groupUnitsLabel()
// My Bookings, the admin table and the saved receipt all use.
function accommodationLabel(booking) {
    if (booking.accomodationName) return booking.accomodationName
    return groupUnitsLabel(booking.units) || 'Accommodation'
}

function guestName(booking) {
    return booking.guest?.fullName || 'Guest'
}

// The label/value block naming which reservation a message is about, shared by
// both booking mails. The guest may have more than one open.
function bookingDetails(booking) {
    return detailBox('The reservation', [
        ['Reference', booking.code ?? booking.id],
        ['Accommodation', accommodationLabel(booking)],
        ['Unit', booking.unitId],
        ['Check-in', formatStayDate(booking.checkIn)],
        ['Check-out', formatStayDate(booking.checkOut)],
        ['Guests', booking.pax ? `${booking.pax} pax` : ''],
    ])
}

// --------------------------------------------------- 1. contact form reply

// The acknowledgement a visitor gets for using the contact form.
//
// Its wording used to live in the EmailJS template and moved here when that
// template became the shared shell. Same message, same order — greeting, when
// it arrived, their own words read back, where we will reply — because it was
// already the right message; only the place it is written down changed.
//
// It quotes the enquiry back on purpose: it is the receipt for something they
// have no other record of, and it lets them catch a mistyped phone number
// before waiting a day for a reply that goes nowhere.
export function contactAcknowledgement({ name, email, phone, message, submittedAt }) {
    const html = [
        paragraph(`Hi ${esc(name)},`, { lead: true }),
        paragraph(
            'Thank you for getting in touch with Camp Ba-long. This is an automatic ' +
            `confirmation that your message reached us on <strong>${esc(submittedAt)}</strong>` +
            ' — no reply is needed to this email.',
        ),
        paragraph('A member of our team will respond within 24 hours during admin hours.'),
        `<p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${LEAF};">Your message</p>`,
        quoted(message),
        paragraph(
            `We will reply to <strong style="color:${INK};">${esc(email)}</strong>` +
            ` and may call <strong style="color:${INK};">${esc(phone)}</strong>.` +
            ' If either is wrong, just send us a new message with the correct details.',
        ),
        adminHoursNote('Need us sooner?'),
        signOff('Warm regards,'),
    ].join('\n')

    const text = [
        `Hi ${name},`,
        '',
        'Thank you for getting in touch with Camp Ba-long. This is an automatic ' +
            `confirmation that your message reached us on ${submittedAt} — no reply ` +
            'is needed to this email.',
        '',
        'A member of our team will respond within 24 hours during admin hours.',
        '',
        'YOUR MESSAGE',
        '------------',
        message,
        '',
        `We will reply to ${email} and may call ${phone}. If either is wrong, just ` +
            'send us a new message with the correct details.',
        '',
        'Admin hours are 8:00 AM to 5:00 PM, Monday to Sunday.',
        '',
        'Warm regards,',
        'The Camp Ba-long Team',
    ].join('\n')

    return {
        subject: 'We received your message — Camp Ba-long',
        heading: 'We Received Your Message',
        html,
        text,
        footerNote: FOOTER_CONTACT,
    }
}

// ------------------------------------------------------ 2. booking verified

// Staff verified the down-payment receipt: the hold is a confirmed stay.
//
// The receipt is rendered into the body rather than attached. EmailJS caps all
// template variables at 50kb combined, so a base64 PNG of the canvas sheet
// would be rejected outright — and an emailed <img> fetched from a server is
// blocked by default in most clients anyway. In the body it is visible the
// moment the mail opens, prints from the client, and survives forwarding.
// `compact` drops the itemised receipt and names the booking instead. Not a
// style choice — see fitToBudget() in bookingEmail.js. A reservation carrying
// dozens of add-on lines can push the receipt past EmailJS's 50kb ceiling for
// template variables, and a guest told their booking is confirmed and pointed
// at My Bookings for the itemisation is far better served than a guest who
// receives nothing at all because the send was refused.
export function bookingVerified(booking, { compact = false } = {}) {
    const receipt = compact ? null : renderReceiptForEmail(booking, 'Confirmed')
    const code = booking.code ?? booking.id ?? ''

    const html = [
        paragraph(`Hello dear ${esc(guestName(booking))},`, { lead: true }),
        paragraph(
            'Your booking reservation is <strong>verified</strong>. We have reviewed ' +
            'your down-payment receipt and your reservation is confirmed under ' +
            `reference <strong style="letter-spacing:1px;">${esc(code)}</strong>.`,
        ),
        compact
            ? paragraph(
                'This reservation has too many lines to itemise in an email. Open ' +
                '<strong>My Bookings</strong> on our website to view and save your ' +
                'full receipt, then present it at the resort. Thank you.',
            )
            : paragraph(
                'Please save this receipt of your booking as your reference and ' +
                'present it at the resort. Thank you.',
            ),
        compact ? bookingDetails(booking) : receipt.html,
        compact ? '' : '<div style="height:18px;"></div>',
        callout(
            'On the day',
            'Show this email — or a screenshot of the receipt above — at the gate. ' +
            'The balance shown as due on arrival is settled on-site. If you declared ' +
            'senior citizens or persons with disability on your booking, bring the ' +
            'IDs: that discount is applied at the desk, against the balance.',
        ),
        adminHoursNote('Need to change something? Reply to this email or call us.'),
        signOff('See you soon,'),
    ]
        .filter(Boolean)
        .join('\n')

    const text = [
        `Hello dear ${guestName(booking)},`,
        '',
        'Your booking reservation is verified. We have reviewed your down-payment ' +
            `receipt and your reservation is confirmed under reference ${code}.`,
        '',
        compact
            ? 'This reservation has too many lines to itemise in an email. Open My ' +
              'Bookings on our website to view and save your full receipt, then ' +
              'present it at the resort. Thank you.'
            : 'Please save this receipt of your booking as your reference and ' +
              'present it at the resort. Thank you.',
        '',
        compact ? `Reference: ${code}` : receipt.text,
        '',
        'ON THE DAY',
        '----------',
        'Show this email at the gate. The balance shown as due on arrival is ' +
            'settled on-site. If you declared senior citizens or persons with ' +
            'disability, bring the IDs — that discount is applied at the desk.',
        '',
        'Admin hours are 8:00 AM to 5:00 PM, Monday to Sunday.',
        '',
        'See you soon,',
        'The Camp Ba-long Team',
    ].join('\n')

    return {
        subject: `Your booking is verified — ${code}`,
        heading: 'Your Booking Is Verified',
        html,
        text,
        footerNote: FOOTER_BOOKING,
    }
}

// ------------------------------------------------------ 3. booking rejected

// Staff rejected the booking: the hold is released and the dates are back in
// availability.
//
// No receipt goes with this one, on purpose. There is nothing to present at a
// gate the guest is not coming through, and a sheet headed "Booking Receipt"
// attached to a rejection is the kind of mixed message that has people turning
// up anyway.
//
// The SUBJECT avoids the word "rejected" while the body says it plainly. A
// rejection shouting from the inbox list, read on a lock screen with none of
// the context underneath it, only produces the phone call this email exists to
// answer.
export function bookingRejected(booking, { reason = '' } = {}) {
    const code = booking.code ?? booking.id ?? ''

    const html = [
        paragraph(`Hello dear ${esc(guestName(booking))},`, { lead: true }),
        paragraph(
            'Your booking is <strong>rejected upon findings</strong>. We were unable ' +
            `to confirm reservation <strong style="letter-spacing:1px;">${esc(code)}</strong>` +
            ', and the dates it was holding have been released.',
        ),
        reason ? paragraph(esc(reason)) : '',
        paragraph('Please continue in the booking and try to book again. Thank you.'),
        bookingDetails(booking),
        callout(
            'If you already paid',
            'Reply to this email and we will sort it out with you directly — nothing ' +
            'is settled automatically on a rejected booking.',
        ),
        adminHoursNote('We are happy to help you rebook.'),
        signOff('Warm regards,'),
    ]
        .filter(Boolean)
        .join('\n')

    const text = [
        `Hello dear ${guestName(booking)},`,
        '',
        'Your booking is rejected upon findings. We were unable to confirm ' +
            `reservation ${code}, and the dates it was holding have been released.`,
        reason ? `\n${reason}` : '',
        '',
        'Please continue in the booking and try to book again. Thank you.',
        '',
        'THE RESERVATION',
        '---------------',
        `Reference: ${code}`,
        `Accommodation: ${accommodationLabel(booking)}`,
        `Check-in: ${formatStayDate(booking.checkIn) || 'Not set'}`,
        `Check-out: ${formatStayDate(booking.checkOut) || 'Not set'}`,
        booking.pax ? `Guests: ${booking.pax} pax` : '',
        '',
        'IF YOU ALREADY PAID',
        '-------------------',
        'Reply to this email and we will sort it out with you directly — nothing ' +
            'is settled automatically on a rejected booking.',
        '',
        'Admin hours are 8:00 AM to 5:00 PM, Monday to Sunday.',
        '',
        'Warm regards,',
        'The Camp Ba-long Team',
    ]
        .filter((line) => line !== '')
        .join('\n')

    return {
        subject: `About your booking — ${code}`,
        heading: 'About Your Booking',
        html,
        text,
        footerNote: FOOTER_BOOKING,
    }
}

// The shell's variables, from any of the three builders above. One place, so
// the three messages cannot end up sending three different sets of names to
// the same template.
//
// The values are also sent under a couple of older spellings the previous
// per-message templates used ({{name}}, {{message}}). That is what lets the
// EmailJS template be swapped for the shell AFTER this code is deployed
// rather than in the same breath: until the swap, the old template still finds
// what it is looking for, and the contact form never stops working.
export function shellParams(content, { name, email }) {
    return {
        subject: content.subject,
        heading: content.heading,
        body_html: content.html,
        body_text: content.text,
        footer_note: content.footerNote,

        // ROUTING — the guest's address, under every name a template's
        // "To email" box is likely to hold.
        //
        // This is the one field whose absence is fatal and silent: EmailJS
        // resolves an unmatched {{placeholder}} to an empty string, so a To
        // box naming a variable this object does not carry is not an error at
        // send time — it is a 422 "recipient address is empty" and a guest who
        // never hears anything.
        //
        // And it is genuinely easy to be holding a different name. The shell
        // in docs/emailjs/ says {{email}}; the auto-reply template it replaced
        // said {{from_email}}, which only the contact form ever sent — which
        // is exactly how you end up with enquiries working and booking
        // confirmations silently failing, the two hardest symptoms to connect.
        // EmailJS's own starter templates use {{user_email}}, and a template
        // copied from the admin one uses {{to_email}}.
        //
        // Sending all of them costs a few dozen bytes in a JSON body that has
        // a 50kb budget, and means the To box can say any of these and the
        // mail still reaches the guest — no dashboard edit, no redeploy.
        // Unmatched parameters are ignored by EmailJS, so the spares are free.
        email,
        to_email: email,
        user_email: email,
        from_email: email,
        recipient: email,
        reply_to: email,

        // The same courtesy for the guest's name, which templates greet with
        // in their subject lines as often as in their bodies.
        name,
        to_name: name,
        user_name: name,
        from_name: name,
    }
}
