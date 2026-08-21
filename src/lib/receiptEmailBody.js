// The booking receipt, rendered for an email body instead of a canvas.
//
// The guest's saved receipt is a PNG drawn by hand in
// src/pages/components/receiptImage.js. That file cannot be reused wholesale
// here — it needs a <canvas>, and its output is a binary blob EmailJS has
// nowhere to put: template variables are strings capped at 50kb in total, and
// a base64 PNG of a 900px sheet runs to several times that on its own. So the
// IMAGE is not what travels; the CONTENT is.
//
// What is shared is buildReceipt(), which was already the one place that works
// out what a receipt says — every section, every charge line, every figure,
// pre-formatted. This module takes that model and writes it out twice: once as
// table-based HTML for the mail body, once as plain text for clients that
// strip it. A charge line added in receiptImage.js therefore appears in the
// email with nothing to change here, which is the whole reason the model is
// shared rather than the numbers being worked out a second time.

import { buildReceipt } from '../pages/components/receiptImage.js'
import { INK, FOREST, LEAF, GOLD, SAND, RULE, CREDIT, SANS, SERIF, esc } from './emailTheme.js'

// One charge or detail line: label (with an optional smaller note under it) on
// the left, value hard right. `tone: 'credit'` is what receiptImage.js marks a
// payment already received with, and it stays green here for the same reason
// it is green there — it is the only line on the sheet that subtracts.
function row({ label, sub, value, tone }) {
    const valueColor = tone === 'credit' ? CREDIT : INK
    return `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid ${RULE};font-family:${SANS};font-size:14px;line-height:1.5;color:${INK};">
          ${esc(label)}
          ${sub ? `<div style="margin-top:2px;font-size:12px;line-height:1.5;color:${LEAF};">${esc(sub)}</div>` : ''}
        </td>
        <td align="right" valign="top" style="padding:9px 0 9px 16px;border-bottom:1px solid ${RULE};font-family:${SANS};font-size:14px;font-weight:600;line-height:1.5;color:${valueColor};white-space:nowrap;">
          ${esc(value)}
        </td>
      </tr>`
}

function section({ title, rows }) {
    return `
    <tr>
      <td style="padding:20px 0 0;">
        <p style="margin:0 0 4px;font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${LEAF};">
          ${esc(title)}
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${rows.map(row).join('')}
        </table>
      </td>
    </tr>`
}

// The sheet itself. Deliberately NOT a full HTML document: it is dropped into
// the middle of an EmailJS template that already has its own table shell,
// header and footer.
function toHtml(model) {
    const unitLine = model.unitId
        ? ` &middot; Unit <strong style="color:${INK};">${esc(model.unitId)}</strong>`
        : ''

    const totalNote = model.totalNote
        ? `
        <tr>
          <td colspan="2" style="padding:0 16px 14px;font-family:${SANS};font-size:12px;line-height:1.6;color:${LEAF};">
            ${esc(model.totalNote)}
          </td>
        </tr>`
        : ''

    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;border-collapse:collapse;background-color:#ffffff;border:1px solid ${RULE};border-top:3px solid ${GOLD};border-radius:10px;">
  <tr>
    <td style="padding:22px 24px 24px;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="font-family:${SERIF};font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${FOREST};">
            Booking Receipt
          </td>
          <td align="right" style="font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${GOLD};">
            ${esc(model.statusLabel)}
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:4px;font-family:${SANS};font-size:13px;color:${LEAF};">
            Reference <strong style="color:${INK};letter-spacing:1px;">${esc(model.code)}</strong>${unitLine}
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${model.sections.map(section).join('')}
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:18px;background-color:${SAND};border-radius:8px;">
        <tr>
          <td style="padding:14px 16px;font-family:${SANS};font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${FOREST};">
            Due on arrival
          </td>
          <td align="right" style="padding:14px 16px;font-family:${SERIF};font-size:22px;font-weight:700;color:${FOREST};white-space:nowrap;">
            ${esc(model.total)}
          </td>
        </tr>${totalNote}
      </table>

      ${model.notes.map((note) => `
      <p style="margin:14px 0 0;font-family:${SANS};font-size:12px;line-height:1.65;color:${LEAF};">
        ${esc(note)}
      </p>`).join('')}

      <p style="margin:16px 0 0;padding-top:12px;border-top:1px solid ${RULE};font-family:${SANS};font-size:11px;color:${LEAF};">
        ${esc(model.footer)}
      </p>

    </td>
  </tr>
</table>`.trim()
}

// The same receipt as plain text.
//
// Worth the twenty lines: a client set to plain text, a phone's notification
// preview and a screen reader all render this and not the table above, and the
// alternative — raw markup, or nothing — is exactly the guest left with no
// record of their booking.
function toText(model) {
    const lines = [
        'BOOKING RECEIPT',
        `Reference: ${model.code}${model.unitId ? `  -  Unit: ${model.unitId}` : ''}`,
        `Status: ${model.statusLabel}`,
    ]

    for (const { title, rows } of model.sections) {
        lines.push('', title.toUpperCase(), '-'.repeat(title.length))
        for (const entry of rows) {
            lines.push(`${entry.label}: ${entry.value}${entry.sub ? ` (${entry.sub})` : ''}`)
        }
    }

    lines.push('', `DUE ON ARRIVAL: ${model.total}`)
    if (model.totalNote) lines.push(model.totalNote)
    if (model.notes.length) lines.push('', ...model.notes)
    lines.push('', model.footer)

    return lines.join('\n')
}

// Build both renderings of one booking's receipt.
//
// `statusLabel` is the badge printed on the sheet — 'Confirmed' from the
// verification email. It is passed in rather than read off booking.status
// because the mail goes out immediately after the status write and the local
// copy of the row may not have caught up; the caller knows what it just
// approved.
export function renderReceiptForEmail(booking, statusLabel) {
    const model = buildReceipt(booking, statusLabel, Date.now())
    return { html: toHtml(model), text: toText(model) }
}
