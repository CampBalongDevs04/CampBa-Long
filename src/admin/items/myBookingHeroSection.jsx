import { useEffect, useState } from 'react'
import '../css/bookingCms.css'
import '../css/myBookingCms.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import { PAYMENT_WINDOW_MINUTES } from '../../data/accommodationDB.js'
import {
    useMyBookingPage,
    loadMyBookingPage,
    saveMyBookingHero,
    saveMyBookingReceiptNote,
    fillTokens,
    unitTokens,
} from '../../data/myBookingPage.js'

// CMS → My Booking → Hero & Notes. The words above a guest's list of bookings,
// and the green panel that appears over it after they reserve
// (data/myBookingPage.js).
//
// The hero and that panel are on one screen because a guest reads them one
// after the other, seconds apart: the panel lands on top of the page the hero
// titles. Editing either without the other in view is how they stop agreeing.
//
// WHY THE PREVIEW IS FILLED WITH A MADE-UP BOOKING
// -----------------------------------------------
// Every string here is printed around figures the browser works out per
// booking — the code, the down payment, the minutes left on the hold. Showing
// the raw '{amount}' would be showing something no guest ever sees, and it is
// the placeholders that most need checking: one typed as {amout} is invisible
// in the form and obvious in the preview.

// What the preview stands in for. Deliberately unmistakable as an example —
// a real-looking code in a dashboard preview is a support call waiting to
// happen ("I searched for CBL-2K4M and it doesn't exist").
const SAMPLE = {
    code: 'CBL-EXAMPLE',
    amount: '₱1,500',
    minutes: PAYMENT_WINDOW_MINUTES,
    ...unitTokens(false),
}

function heroFields() {
    return [
        {
            name: 'eyebrow',
            label: 'Small line above the title',
            placeholder: 'Camp Ba-long Reservations',
            help: 'Leave blank to take it off.',
        },
        {
            name: 'title',
            label: 'Page title',
            placeholder: 'My Bookings',
        },
        {
            name: 'tagline',
            label: 'Description',
            type: 'textarea',
            rows: 2,
            placeholder: 'Review your reservation history and manage upcoming stays.',
            help: 'The line under the title. Leave blank to take it off.',
        },
        {
            name: 'privacyNote',
            label: 'Privacy note',
            type: 'textarea',
            rows: 3,
            placeholder: 'Only the bookings made on this device appear here…',
            help: 'Explains why a guest sees only this device’s bookings. Leave blank to '
                + 'take it off — but it is the answer to "where did my booking go" on a '
                + 'second phone.',
        },
    ]
}

function receiptNoteFields() {
    return [
        {
            name: 'savedTitle',
            label: 'Heading — booking already paid for',
            placeholder: 'Booking {code} received',
        },
        {
            name: 'savedText',
            label: 'Wording — booking already paid for',
            type: 'textarea',
            rows: 3,
            placeholder: 'Save a copy for check-in…',
        },
        {
            name: 'holdTitle',
            label: 'Heading — unit held, payment due',
            placeholder: '{Unit} held for booking {code}',
        },
        {
            name: 'holdText',
            label: 'Wording — unit held, payment due',
            type: 'textarea',
            rows: 5,
            placeholder: 'Your {unit-is} reserved for the next {minutes} minutes…',
            help: 'This is the version with a clock running on it, so it has to say what '
                + 'happens when the clock stops.',
        },
        {
            name: 'saveReceiptLabel',
            label: 'Button label',
            placeholder: 'Save Receipt',
            help: 'The button inside the panel — and the one on every booking card, which '
                + 'downloads the same image.',
        },
    ]
}

export default function MyBookingHeroSection() {
    const { page, error } = useMyBookingPage()

    const [editingHero, setEditingHero] = useState(null)
    const [editingNote, setEditingNote] = useState(null)

    useEffect(() => {
        loadMyBookingPage()
    }, [])

    return (
        <div className="booking-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Hero</h3>
                    <p className="crud-bar-note">
                        The title, description and privacy note at the top of My Bookings.
                        Saved changes are live straight away.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary"
                    onClick={() =>
                        setEditingHero({
                            eyebrow: page.eyebrow ?? '',
                            title: page.title ?? '',
                            tagline: page.tagline ?? '',
                            privacyNote: page.privacyNote ?? '',
                        })
                    }
                >
                    Edit the wording
                </button>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}

            <div className="booking-cms-preview">
                {page.eyebrow && <p className="booking-cms-eyebrow">{page.eyebrow}</p>}
                <h4 className="booking-cms-title">{page.title}</h4>
                {page.tagline && <p className="booking-cms-tagline">{page.tagline}</p>}
                {page.privacyNote && (
                    <p className="booking-cms-tagline">{page.privacyNote}</p>
                )}
            </div>

            <div className="crud-bar booking-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Save receipt note</h3>
                    <p className="crud-bar-note">
                        The green panel a guest lands on straight after booking. It says one of
                        two things — both are below, and a guest only ever sees the one that
                        matches their booking.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary"
                    onClick={() =>
                        setEditingNote({
                            savedTitle: page.savedTitle ?? '',
                            savedText: page.savedText ?? '',
                            holdTitle: page.holdTitle ?? '',
                            holdText: page.holdText ?? '',
                            saveReceiptLabel: page.saveReceiptLabel ?? '',
                        })
                    }
                >
                    Edit the note
                </button>
            </div>

            <div className="booking-cms-preview">
                <div className="mybooking-cms-saved">
                    <span className="mybooking-cms-variant">Unit held · payment due</span>
                    <p className="mybooking-cms-saved-title">
                        {fillTokens(page.holdTitle, SAMPLE)}
                    </p>
                    {page.holdText && (
                        <p className="mybooking-cms-saved-text">
                            {fillTokens(page.holdText, SAMPLE)}
                        </p>
                    )}
                    <span className="mybooking-cms-saved-btn">{page.saveReceiptLabel}</span>
                </div>

                <div className="mybooking-cms-saved">
                    <span className="mybooking-cms-variant">Already paid for</span>
                    <p className="mybooking-cms-saved-title">
                        {fillTokens(page.savedTitle, SAMPLE)}
                    </p>
                    {page.savedText && (
                        <p className="mybooking-cms-saved-text">
                            {fillTokens(page.savedText, SAMPLE)}
                        </p>
                    )}
                    <span className="mybooking-cms-saved-btn">{page.saveReceiptLabel}</span>
                </div>

                <p className="mybooking-cms-tokens">
                    Both previews use an example booking. Type these where the real numbers
                    belong and each guest sees their own:{' '}
                    <code>{'{code}'}</code> the booking code,{' '}
                    <code>{'{amount}'}</code> their down payment,{' '}
                    <code>{'{minutes}'}</code> how long a unit is held,{' '}
                    <code>{'{unit}'}</code> / <code>{'{Unit}'}</code> “unit” or “units”, and{' '}
                    <code>{'{unit-is}'}</code> “unit is” or “units are” — the last three so one
                    sentence works for a single unit and for a combined reservation.
                </p>
            </div>

            {editingHero && (
                <CrudModal
                    title="My Bookings hero"
                    subtitle="What a guest reads above their list of bookings."
                    fields={heroFields}
                    initial={editingHero}
                    submitLabel="Save wording"
                    onSubmit={saveMyBookingHero}
                    onClose={() => setEditingHero(null)}
                />
            )}

            {editingNote && (
                <CrudModal
                    title="Save receipt note"
                    subtitle="Both versions of the green panel, plus the button inside it. Placeholders in curly braces are filled in per booking — the preview behind this form shows them filled."
                    fields={receiptNoteFields}
                    initial={editingNote}
                    submitLabel="Save note"
                    onSubmit={saveMyBookingReceiptNote}
                    onClose={() => setEditingNote(null)}
                />
            )}
        </div>
    )
}
