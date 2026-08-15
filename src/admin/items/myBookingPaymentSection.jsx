import { useEffect, useState } from 'react'
import '../css/bookingCms.css'
import '../css/myBookingCms.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useMyBookingPage,
    loadMyBookingPage,
    saveMyBookingPayNote,
    savePaymentMethod,
    deletePaymentMethod,
    movePaymentMethod,
    resolveQrImage,
    fillTokens,
} from '../../data/myBookingPage.js'

// CMS → My Booking → Payment & QR. The cards a guest scans to pay, and the gold
// note above them (data/myBookingPage.js).
//
// This is the one CMS panel that moves money. Until now the GCash QR was a .jpg
// imported into src/pages/components/payment.jsx and the number under it was a
// string literal beside it — so a resort that changed its GCash account could
// not tell guests without a developer and a redeploy, and every peso sent in
// between went to the old number. That is the whole reason this tab exists.
//
// WHY THE NOTE AND THE CARDS ARE ON ONE SCREEN
// -------------------------------------------
// The note says how much to send and the cards say where. A guest reads them as
// one instruction, and the commonest mistake — a note naming a method that is
// no longer on the page — is only visible with both in view.

const BLANK_METHOD = {
    id: null,
    method: '',
    accountName: '',
    accountNumber: '',
    qrKey: '',
    qrUrl: '',
    sortOrder: 0,
    isActive: true,
}

// Stands in for what one guest owes, so the note reads as a guest reads it.
const SAMPLE_AMOUNT = '₱1,500.00'

function payNoteFields() {
    return [
        {
            name: 'payNoteHeading',
            label: 'Bold opening',
            placeholder: 'Send {amount}.',
            help: 'Printed in bold at the start of the note. Leave blank for a note with no '
                + 'bold opening.',
        },
        {
            name: 'payNoteText',
            label: 'The rest of the note',
            type: 'textarea',
            rows: 3,
            placeholder: 'Scan the QR of your preferred method, then upload the screenshot…',
        },
        {
            name: 'uploadWarning',
            label: 'Warning by the upload button',
            type: 'textarea',
            rows: 3,
            placeholder: 'Please upload only your own proof of payment…',
            help: 'Printed in red against the button a guest picks their screenshot with. '
                + 'Leave blank to take it off — but it is the only place the site says a '
                + 'wrong upload has a consequence.',
        },
    ]
}

// `preview` resolves the same way the guest page does, so the frame shows the
// QR that is actually being served — including the one bundled with the build,
// which has no URL to put in the field. `clears` drops that bundled key the
// moment something is uploaded over it, so the upload wins.
function methodFields(values) {
    return [
        {
            name: 'method',
            label: 'Payment method',
            placeholder: 'GCash',
            help: 'The heading on the card — GCash, Maya, Bank Transfer.',
        },
        [
            {
                name: 'accountName',
                label: 'Account name',
                placeholder: 'IR**E B.',
                help: 'Who the money reaches, as guests should see it.',
            },
            {
                name: 'accountNumber',
                label: 'Number',
                placeholder: '0919 033 ....',
                help: 'The mobile or account number under the name. Leave blank if there '
                    + 'is none to show.',
            },
        ],
        {
            name: 'qrUrl',
            label: 'QR code image',
            type: 'image',
            folder: 'payments',
            preview: resolveQrImage(values.qrKey, values.qrUrl),
            clears: ['qrKey'],
            help: 'What guests scan. Screenshot it from your banking app. Leave it empty and '
                + 'the card reads “QR code coming soon”.',
        },
        { name: 'isActive', label: 'Show this method on the page', type: 'checkbox' },
    ]
}

export default function MyBookingPaymentSection() {
    const { page, methods, loaded, error } = useMyBookingPage()

    const [editingNote, setEditingNote] = useState(null)
    const [editingMethod, setEditingMethod] = useState(null)
    // Reordering writes straight to the database with no form in between, so
    // its refusals have nowhere else to be shown.
    const [moveError, setMoveError] = useState('')

    useEffect(() => {
        loadMyBookingPage()
    }, [])

    const ordered = [...methods].sort((a, b) => a.sortOrder - b.sortOrder)

    const handleMove = async (id, direction) => {
        setMoveError('')
        const result = await movePaymentMethod(id, direction)
        if (!result.ok) setMoveError(result.message)
    }

    return (
        <div className="booking-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Payment notes</h3>
                    <p className="crud-bar-note">
                        The gold line over the QR cards, and the warning against the button a
                        guest uploads their receipt with.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary"
                    onClick={() =>
                        setEditingNote({
                            payNoteHeading: page.payNoteHeading ?? '',
                            payNoteText: page.payNoteText ?? '',
                            uploadWarning: page.uploadWarning ?? '',
                        })
                    }
                >
                    Edit the notes
                </button>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}

            <div className="booking-cms-preview">
                <div className="booking-cms-note">
                    <span className="booking-cms-note-dot" />
                    <div className="booking-cms-note-body">
                        <p>
                            {page.payNoteHeading && (
                                <>
                                    <strong className="booking-cms-note-heading">
                                        {fillTokens(page.payNoteHeading, { amount: SAMPLE_AMOUNT })}
                                    </strong>{' '}
                                </>
                            )}
                            {fillTokens(page.payNoteText, { amount: SAMPLE_AMOUNT })}
                        </p>
                    </div>
                </div>

                {page.uploadWarning && (
                    <p className="mybooking-cms-warning">
                        <span className="mybooking-cms-warning-icon" aria-hidden="true">!</span>
                        {page.uploadWarning}
                    </p>
                )}

                <p className="mybooking-cms-tokens">
                    <code>{'{amount}'}</code> is what that guest still owes on that booking,
                    filled in when the note is drawn — {SAMPLE_AMOUNT} is only this preview&apos;s
                    example. Type a figure yourself and every guest is asked for it, whatever
                    they actually booked.
                </p>
            </div>

            <div className="crud-bar booking-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Payment methods</h3>
                    <p className="crud-bar-note">
                        One card per way to pay, in the order guests see them. Check the number
                        and the QR against your own banking app before saving — this is where
                        guests send money.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary is-small"
                    onClick={() =>
                        setEditingMethod({
                            ...BLANK_METHOD,
                            sortOrder: (ordered.at(-1)?.sortOrder ?? 0) + 1,
                        })
                    }
                >
                    + Add a payment method
                </button>
            </div>

            {moveError && <p className="crud-message is-error">{moveError}</p>}

            {ordered.length === 0 ? (
                <p className="crud-empty">
                    {loaded
                        ? 'No payment methods. Guests have nowhere to send the down payment '
                          + 'until one is added.'
                        : 'Loading the payment methods…'}
                </p>
            ) : (
                <div className="mybooking-cms-qr-grid">
                    {ordered.map((method, index) => {
                        const qr = resolveQrImage(method.qrKey, method.qrUrl)
                        return (
                            <article
                                key={method.id}
                                className={`mybooking-cms-qr-card ${method.isActive ? '' : 'crud-is-hidden'}`}
                            >
                                <p className="mybooking-cms-qr-method">
                                    {method.method}
                                    {!method.isActive && (
                                        <span className="crud-hidden-tag">Hidden</span>
                                    )}
                                </p>

                                {qr ? (
                                    <img
                                        className="mybooking-cms-qr-image"
                                        src={qr}
                                        alt={`${method.method} QR code`}
                                    />
                                ) : (
                                    <span className="mybooking-cms-qr-none">
                                        QR code coming soon
                                    </span>
                                )}

                                <p className="mybooking-cms-qr-name">
                                    {method.accountName || (
                                        <span className="mybooking-cms-qr-missing">
                                            No account name
                                        </span>
                                    )}
                                </p>
                                {method.accountNumber && (
                                    <p className="mybooking-cms-qr-number">
                                        {method.accountNumber}
                                    </p>
                                )}

                                <div className="mybooking-cms-qr-actions">
                                    <button
                                        type="button"
                                        className="crud-btn is-small"
                                        aria-label="Move earlier"
                                        disabled={index === 0}
                                        onClick={() => handleMove(method.id, 'up')}
                                    >
                                        ‹
                                    </button>
                                    <button
                                        type="button"
                                        className="crud-btn is-small"
                                        aria-label="Move later"
                                        disabled={index === ordered.length - 1}
                                        onClick={() => handleMove(method.id, 'down')}
                                    >
                                        ›
                                    </button>
                                    <button
                                        type="button"
                                        className="crud-btn is-small"
                                        onClick={() =>
                                            setEditingMethod({
                                                id: method.id,
                                                method: method.method,
                                                accountName: method.accountName,
                                                accountNumber: method.accountNumber,
                                                qrKey: method.qrKey ?? '',
                                                qrUrl: method.qrUrl ?? '',
                                                sortOrder: method.sortOrder,
                                                isActive: method.isActive,
                                            })
                                        }
                                    >
                                        Edit
                                    </button>
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}

            {editingNote && (
                <CrudModal
                    title="Payment notes"
                    subtitle="What guests read while paying: the line above the QR codes — where the amount is asked for, so leave {amount} in it — and the warning against the upload button."
                    fields={payNoteFields}
                    initial={editingNote}
                    submitLabel="Save note"
                    onSubmit={saveMyBookingPayNote}
                    onClose={() => setEditingNote(null)}
                />
            )}

            {editingMethod && (
                <CrudModal
                    title={editingMethod.id ? 'Edit payment method' : 'New payment method'}
                    subtitle={
                        editingMethod.id
                            ? 'Guests see this the moment it is saved. Unticking the box takes the card off the page and keeps its details.'
                            : 'It joins the end of the row. Reorder it with the arrows after saving.'
                    }
                    fields={methodFields}
                    initial={editingMethod}
                    submitLabel={editingMethod.id ? 'Save changes' : 'Add method'}
                    onSubmit={savePaymentMethod}
                    onDelete={
                        editingMethod.id ? () => deletePaymentMethod(editingMethod.id) : null
                    }
                    deleteLabel="Delete method"
                    onClose={() => setEditingMethod(null)}
                />
            )}
        </div>
    )
}
