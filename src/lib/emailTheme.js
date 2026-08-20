// Shared building blocks for every email this site composes in code.
//
// WHY THE BODIES ARE BUILT HERE AND NOT IN THE EMAILJS DASHBOARD
// --------------------------------------------------------------
// EmailJS's free plan allows TWO templates, and both were already spoken for:
// the enquiry to the admin inbox, and the acknowledgement to the guest. The
// booking-decision emails would have been a third and a fourth, which is a
// paid plan.
//
// So the guest-facing template stopped being one message and became a SHELL —
// a header, a slot, a footer — and the app sends it the content:
//
//     subject       the subject line
//     heading       the banner headline
//     body_html     the message itself, as markup, read with THREE braces
//     body_text     the same message as plain text
//     footer_note   the small print under the rule
//
// One template now carries three different messages (contact acknowledgement,
// booking verified, booking rejected), and a fourth would need no dashboard
// edit at all. That is the constraint turning out to be the better design:
// the copy lives in this repo, where it is reviewed, versioned and diffable,
// instead of in a textarea on a website where a stray keystroke is invisible
// until a guest reads it.
//
// Everything below is what those bodies are made of, kept in one place so the
// three messages cannot drift into looking like three different resorts.
//
// WHY TABLES AND INLINE STYLES
// ----------------------------
// Gmail strips <style> blocks, Outlook renders through Word, and neither is
// reliable with flex or grid. A nested <table> with style="" on every cell is
// the only layout that survives all of them, so this reads like markup from
// 2004 on purpose.

// Palette, matching the site and the EmailJS shell in docs/emailjs/.
// Taken from the Camp Ba-long stationery design, so the message body and the
// EmailJS shell around it are the same document rather than two greens that
// nearly match. receiptEmailBody.js reads these too, which is the point of
// their being here: restyle once, and the shell, the three messages and the
// emailed receipt all move together.
export const INK = '#2a2a22'
export const FOREST = '#2f4d34'
export const LEAF = '#8a8370'
export const GOLD = '#c9a227'
export const SAND = '#f4eedb'
export const CREAM = '#efe7d4'
export const CARD = '#faf6ea'
export const RULE = '#ddd2b4'
export const CREDIT = '#2e7d46'

export const SANS = "'Jost',Helvetica,Arial,sans-serif"
export const SERIF = "'Cormorant Garamond',Georgia,serif"

// Every value that reaches these builders traces back to something a guest
// typed — their name, their email, a message they wrote — and all of it is
// about to be interpolated into HTML that EmailJS inserts WITHOUT escaping
// (the body is read with triple braces, or the markup would arrive as visible
// tags). So the escaping happens here, on every leaf, rather than being
// trusted to the mail service.
export function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

// A body paragraph. `lead: true` is the greeting line — one step larger, so
// the eye lands on the guest's own name first.
//
// PROSE IS SERIF, DATA IS SANS, and that split is deliberate. The stationery
// is Cormorant Garamond throughout and these paragraphs sit inside it, so
// setting them in a sans would read as a different letter pasted into the
// frame. The receipt is the exception: its rows are labels against peso
// figures, and a misread figure at the gate costs somebody real money, so
// receiptEmailBody.js keeps the tabular numbers in a sans where the digits
// are unambiguous. Display and prose serif, data sans.
export function paragraph(text, { lead = false } = {}) {
    const size = lead ? '19px' : '17px'
    return `<p style="margin:0 0 16px;font-family:${SERIF};font-size:${size};line-height:1.65;color:${FOREST};">${text}</p>`
}

// The tinted box a message uses for its one operative instruction — what to do
// at the gate, what happens to a payment. Deliberately limited to one or two
// per message: a mail where everything is in a box has nothing emphasised.
export function callout(title, body) {
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px;background-color:${SAND};border:2px solid ${GOLD};">
  <tr>
    <td style="padding:18px 22px;">
      <p style="margin:0 0 6px;font-family:${SERIF};font-size:15px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${FOREST};">${esc(title)}</p>
      <p style="margin:0;font-family:${SERIF};font-size:17px;line-height:1.6;color:${FOREST};">${body}</p>
    </td>
  </tr>
</table>`.trim()
}

// A quoted block — the guest's own message read back to them on the contact
// acknowledgement. white-space:pre-wrap keeps the line breaks they typed,
// which is the difference between a quoted message and a wall.
export function quoted(text) {
    return `
<div style="margin:0 0 18px;background-color:${SAND};border:2px solid ${GOLD};padding:16px 18px;font-family:${SERIF};font-size:18px;line-height:1.6;color:${FOREST};white-space:pre-wrap;">${esc(text)}</div>`.trim()
}

// A label/value list, for naming which booking a message is about. The guest
// may have more than one open, and "your booking" alone leaves them guessing.
export function detailBox(title, rows) {
    const lines = rows
        .filter(([, value]) => value)
        .map(([label, value]) => `${esc(label)}: <strong>${esc(value)}</strong>`)
        .join('<br />')

    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px;background-color:${SAND};border:2px solid ${GOLD};">
  <tr>
    <td style="padding:16px 18px;font-family:${SERIF};font-size:17px;line-height:1.8;color:${FOREST};">
      <strong style="display:block;font-family:${SERIF};font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${LEAF};margin-bottom:8px;">${esc(title)}</strong>
      ${lines}
    </td>
  </tr>
</table>`.trim()
}

// The sign-off. Part of the body rather than the shell because the wording
// differs by message — a verified booking ends "See you soon", a rejection
// does not.
export function signOff(closing) {
    return `<p style="margin:0;font-family:${SERIF};font-size:17px;line-height:1.65;color:${FOREST};">${esc(closing)}<br /><strong>The Camp Ba-long Team</strong></p>`
}

// Admin hours, in the small grey voice. Every guest message carries it: it is
// the answer to "can I sort this out now", and it is the same answer in all
// three.
export function adminHoursNote(lead) {
    return `<p style="margin:0 0 16px;font-family:${SERIF};font-size:15px;line-height:1.7;color:${LEAF};">${lead} Our admin hours are <strong style="color:${FOREST};">8:00 AM to 5:00 PM</strong>, Monday to Sunday, and requests are processed during those hours only.</p>`
}
