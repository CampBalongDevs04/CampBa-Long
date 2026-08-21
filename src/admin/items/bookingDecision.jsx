import { useState } from 'react'
import {
    confirmBooking,
    confirmBookingGroup,
    cancelBooking,
    cancelBookingGroup,
} from '../../data/accommodationDB.js'
import { sendBookingVerifiedEmail, sendBookingRejectedEmail } from '../../lib/bookingEmail.js'
import EmailResultModal from './emailResultModal'

// Approve and Reject, for every screen that offers them.
//
// This lived inside bookingsManage.jsx, which is the Bookings tab. But the
// same decision is taken from the OVERVIEW tabs as well — every card there
// with an uploaded receipt opens the same ReceiptViewer, with the same
// "Verified — Approve" button in its footer — and that copy called
// confirmBooking() directly. So an approval made from Overview flipped the row
// and told the guest NOTHING: no email, and no popup to say one had not been
// sent. Two buttons that look identical, sitting two tabs apart, quietly
// behaving differently.
//
// So the decision moved out of the screen and into here, and both screens call
// this instead. A third place that grows an Approve button gets the email and
// the popup by using the hook, rather than by remembering to.
//
// Returns { approve, reject, decisionModal }. Render `decisionModal` anywhere
// in the tree — it is null until a decision has been made.

export default function useBookingDecision() {
    // What the guest was (or was not) told about the last decision, shown as a
    // modal staff have to dismiss (see emailResultModal.jsx).
    //
    // This used to be a line in the toolbar. It was accurate and nobody read
    // it: staff click Approve and move to the next row, and a decision already
    // made does not send the eye back to a strip of text above the table. When
    // the mail then failed, the first anyone knew was a guest arriving with no
    // confirmation — the exact failure these emails exist to prevent. One
    // dismissal per approval is the right price for that not happening.
    const [mailResult, setMailResult] = useState(null)

    // ORDER MATTERS AND IS NOT NEGOTIABLE: the status write first, awaited,
    // and the mail only if it succeeded. A booking that failed to save must
    // never produce a "your reservation is verified" email — that guest turns
    // up at a gate with no reservation behind them. The reverse (saved, but
    // the mail failed) is recoverable by a phone call, which is why the mail
    // is the half allowed to fail.
    //
    // Both decisions live here rather than inside confirmBooking()/
    // cancelBooking() in accommodationDB.js because those are shared with the
    // GUEST's own paths. cancelBooking() in particular is what My Bookings
    // calls when a guest cancels their own stay; mailing them "your booking is
    // rejected upon findings" for a decision they made themselves would be
    // nonsense. The rejection notice belongs to the staff action, so it is
    // wired to the staff button.
    const runDecision = async (booking, write, mail, action) => {
        const who = booking.guest?.fullName ?? 'The guest'
        const result = await write(booking)
        // patchBooking() and friends resolve { ok, message } and report their
        // own failures to the console; nothing was written, so nothing is
        // announced to the guest.
        if (result && result.ok === false) {
            setMailResult({
                ok: false,
                guestName: who,
                guestEmail: booking.guest?.email,
                action,
                message: `The booking could not be saved, so no email was sent. ${result.message ?? ''}`.trim(),
            })
            return
        }

        // This popup is the ONLY way staff find out whether the guest was
        // told, so the one thing it must never do is fail to appear. The mail
        // helpers are written to resolve rather than throw for every failure
        // they anticipate — but "every failure they anticipate" is exactly the
        // assumption worth not betting a silent Approve button on. Anything
        // that escapes them still lands in the popup instead of becoming an
        // unhandled rejection and a button that looks broken.
        let sent
        try {
            sent = await mail(booking)
        } catch (error) {
            console.error('[Camp Ba-long] Booking email threw unexpectedly:', error)
            sent = {
                ok: false,
                message:
                    'The booking is saved, but the email failed unexpectedly and ' +
                    'the guest has not been told — please contact them directly. ' +
                    `Details in the browser console (${String(error?.message ?? error)}).`,
            }
        }

        setMailResult({
            ok: sent.ok,
            guestName: who,
            guestEmail: booking.guest?.email,
            action,
            message: sent.message,
            detail: sent.detail,
        })
    }

    const approve = (booking) =>
        runDecision(
            booking,
            (b) => (b.isGroup ? confirmBookingGroup(b.id) : confirmBooking(b.id)),
            sendBookingVerifiedEmail,
            'verified',
        )

    const reject = (booking) =>
        runDecision(
            booking,
            (b) =>
                b.isGroup
                    ? cancelBookingGroup(b.id, { asStaff: true })
                    : cancelBooking(b.id, { asStaff: true }),
            sendBookingRejectedEmail,
            'rejected',
        )

    // Mounted only while there is something to say, the way every other modal
    // on this board is used. The component guards its own effects now too, but
    // a dialog that exists on screen for the life of the tab is a trap either
    // way — it was one: its scroll lock ran at mount and froze the whole
    // dashboard with nothing visible to blame.
    const decisionModal = mailResult ? (
        <EmailResultModal result={mailResult} onClose={() => setMailResult(null)} />
    ) : null

    return { approve, reject, decisionModal }
}
