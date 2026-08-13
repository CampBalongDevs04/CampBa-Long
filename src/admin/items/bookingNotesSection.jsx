import { useEffect, useState } from 'react'
import '../css/bookingCms.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import { STAY_SCHEDULES } from '../../data/accommodationDB.js'
import {
    useBookingPage,
    loadBookingPage,
    saveBookingNotesCopy,
    saveScheduleNote,
    saveBookingInclusion,
    deleteBookingInclusion,
    moveBookingInclusion,
    inclusionsFor,
    scheduleNoteFor,
} from '../../data/bookingPage.js'

// CMS → Booking → Notes & Inclusions. The two notes under the stay-schedule
// cards on /booking: what the chosen schedule means for check-in, and what its
// rate includes.
//
// They are one screen because a guest reads them as one block, but they are
// stored apart, and the difference matters to whoever is editing:
//
//   • The schedule note belongs to the SCHEDULE (stay_schedules.note). There is
//     one per schedule, and rewording it is part of describing that schedule's
//     hours — which is why the three are listed by schedule below rather than
//     offered as a single "note".
//   • The inclusions belong to the RATE GROUP (booking_inclusions) — the same
//     grouping the prices use, so Day-and-Night and Night-and-Day share one
//     list because they share one rate.
//
// The schedules themselves — their hours, their entrance fee, which units they
// offer — are not editable here. They are what the booking engine holds units
// against, and they live in Units.

// The rate groups the stay schedules actually use, with the schedules that fall
// under each. Read from STAY_SCHEDULES rather than listed, so adding a fourth
// schedule later needs no change here — the same arrangement accommodationManage
// uses for the rate tables.
const RATE_GROUPS = [...new Set(STAY_SCHEDULES.map((schedule) => schedule.rateGroup))].map(
    (group) => ({
        id: group,
        label: group === 'day' ? 'Day Time' : group === 'overnight' ? 'Overnight' : group,
        schedules: STAY_SCHEDULES.filter((schedule) => schedule.rateGroup === group)
            .map((schedule) => schedule.time)
            .join(' · '),
    }),
)

const RATE_GROUP_OPTIONS = RATE_GROUPS.map((group) => ({
    value: group.id,
    label: `${group.label} — ${group.schedules}`,
}))

function labelsFields() {
    return [
        {
            name: 'scheduleTitle',
            label: 'Heading over the schedule cards',
            placeholder: 'Select Stay Schedule',
        },
        {
            name: 'scheduleNoteHeading',
            label: 'Label that starts the schedule note',
            placeholder: 'Schedule note.',
            help: 'Printed in bold before the sentence, full stop included. Leave blank to '
                + 'take it off.',
        },
        {
            name: 'scheduleNoteEmpty',
            label: 'Schedule note before a schedule is picked',
            type: 'textarea',
            rows: 2,
            placeholder: 'Select a stay schedule to see the check-in details.',
            help: 'What the note says while the guest has not chosen yet.',
        },
        {
            name: 'inclusionsHeading',
            label: 'Label that starts the inclusions note',
            placeholder: 'Inclusions.',
            help: 'Leave blank to take it off.',
        },
    ]
}

function scheduleNoteFields() {
    return [
        {
            name: 'note',
            label: 'Schedule note',
            type: 'textarea',
            rows: 3,
            placeholder: 'Check-in and check-out are set to 10:00 AM - 5:00 PM…',
            help: 'What a guest is told once they pick this schedule.',
        },
    ]
}

function inclusionFields() {
    return [
        {
            name: 'item',
            label: 'Inclusion',
            type: 'textarea',
            rows: 2,
            placeholder: 'Free use of charcoal griller',
        },
        {
            name: 'rateGroup',
            label: 'Applies to',
            type: 'select',
            options: RATE_GROUP_OPTIONS,
            help: 'Which schedules list it. Changing this moves the line to the other list.',
        },
        { name: 'isActive', label: 'Show this inclusion on the page', type: 'checkbox' },
    ]
}

export default function BookingNotesSection() {
    const { page, loaded, error } = useBookingPage()

    const [editingLabels, setEditingLabels] = useState(null)
    const [editingNote, setEditingNote] = useState(null)
    const [editingInclusion, setEditingInclusion] = useState(null)
    const [moveError, setMoveError] = useState('')

    useEffect(() => {
        loadBookingPage()
    }, [])

    const handleMoveInclusion = async (id, direction) => {
        setMoveError('')
        const result = await moveBookingInclusion(id, direction)
        if (!result.ok) setMoveError(result.message)
    }

    return (
        <div className="booking-cms-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Notes &amp; Inclusions</h3>
                    <p className="crud-bar-note">
                        The two notes under the stay-schedule cards. Saved changes are live
                        straight away.
                    </p>
                </div>
                <button
                    type="button"
                    className="crud-btn is-primary"
                    onClick={() =>
                        setEditingLabels({
                            scheduleTitle: page.scheduleTitle ?? '',
                            scheduleNoteHeading: page.scheduleNoteHeading ?? '',
                            scheduleNoteEmpty: page.scheduleNoteEmpty ?? '',
                            inclusionsHeading: page.inclusionsHeading ?? '',
                        })
                    }
                >
                    Edit the labels
                </button>
            </div>

            {error && <p className="crud-message is-error">{error}</p>}

            <div className="booking-cms-preview">
                <p className="booking-cms-eyebrow">{page.scheduleTitle}</p>
                <p className="booking-cms-tagline">
                    The heading over the three schedule cards. Under them, a guest who has not
                    picked one yet reads:
                </p>
                <div className="booking-cms-note">
                    <span className="booking-cms-note-dot" />
                    <div className="booking-cms-note-body">
                        <p>
                            {page.scheduleNoteHeading && (
                                <strong className="booking-cms-note-heading">
                                    {page.scheduleNoteHeading}{' '}
                                </strong>
                            )}
                            {page.scheduleNoteEmpty}
                        </p>
                    </div>
                </div>
            </div>

            <div className="crud-bar booking-cms-subbar">
                <div>
                    <h3 className="crud-bar-title">Schedule notes</h3>
                    <p className="crud-bar-note">
                        One per stay schedule — what a guest is told once they pick it. The
                        schedules and their hours are edited in Units.
                    </p>
                </div>
            </div>

            <div className="booking-cms-rows">
                {STAY_SCHEDULES.map((schedule) => (
                    <div className="booking-cms-note-row" key={schedule.key}>
                        <div className="booking-cms-note">
                            <span className="booking-cms-note-dot" />
                            <div className="booking-cms-note-body">
                                <span className="booking-cms-schedule-name">
                                    {schedule.checkIn.replace(/[:\s]+$/, '')} · {schedule.time}
                                </span>
                                <p>
                                    {page.scheduleNoteHeading && (
                                        <strong className="booking-cms-note-heading">
                                            {page.scheduleNoteHeading}{' '}
                                        </strong>
                                    )}
                                    {scheduleNoteFor(schedule.key, schedule.note)}
                                </p>
                            </div>
                        </div>
                        <div className="crud-row-actions">
                            <button
                                type="button"
                                className="crud-btn is-small"
                                onClick={() =>
                                    setEditingNote({
                                        key: schedule.key,
                                        label: schedule.checkIn.replace(/[:\s]+$/, ''),
                                        note: scheduleNoteFor(schedule.key, schedule.note),
                                    })
                                }
                            >
                                Edit
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {moveError && <p className="crud-message is-error">{moveError}</p>}

            {/* One list per rate group, because that is how the page shows them:
                a guest only ever sees the one their schedule falls under. */}
            {RATE_GROUPS.map((group) => {
                const items = inclusionsFor(group.id)
                return (
                    <div key={group.id}>
                        <div className="booking-cms-group-bar">
                            <div>
                                <h3 className="booking-cms-group-title">
                                    {group.label} inclusions
                                </h3>
                                <p className="booking-cms-group-note">{group.schedules}</p>
                            </div>
                            <button
                                type="button"
                                className="crud-btn is-primary is-small"
                                onClick={() =>
                                    setEditingInclusion({
                                        id: null,
                                        rateGroup: group.id,
                                        item: '',
                                        sortOrder: (items.at(-1)?.sortOrder ?? 0) + 1,
                                        isActive: true,
                                    })
                                }
                            >
                                + Add an inclusion
                            </button>
                        </div>

                        {items.length === 0 ? (
                            <p className="crud-empty">
                                {loaded
                                    ? 'Nothing listed. Add the first one above, or leave it — the '
                                      + 'inclusions note disappears when it is empty.'
                                    : 'Loading the inclusions…'}
                            </p>
                        ) : (
                            <div className="booking-cms-rows">
                                {items.map((item, index) => (
                                    <article className="booking-cms-row" key={item.id}>
                                        <span className="booking-cms-row-index">{index + 1}</span>
                                        <p className="booking-cms-row-text">{item.item}</p>
                                        <div className="crud-row-actions">
                                            <button
                                                type="button"
                                                className="crud-btn is-small"
                                                aria-label="Move earlier"
                                                disabled={index === 0}
                                                onClick={() => handleMoveInclusion(item.id, 'up')}
                                            >
                                                ‹
                                            </button>
                                            <button
                                                type="button"
                                                className="crud-btn is-small"
                                                aria-label="Move later"
                                                disabled={index === items.length - 1}
                                                onClick={() => handleMoveInclusion(item.id, 'down')}
                                            >
                                                ›
                                            </button>
                                            <button
                                                type="button"
                                                className="crud-btn is-small"
                                                onClick={() =>
                                                    setEditingInclusion({
                                                        id: item.id,
                                                        rateGroup: item.rateGroup,
                                                        item: item.item,
                                                        sortOrder: item.sortOrder,
                                                        isActive: item.isActive,
                                                    })
                                                }
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}

            {/* Hidden inclusions are not in the lists above — those show what a
                guest is shown, per group. This is where they come back. */}
            <HiddenInclusions onEdit={setEditingInclusion} />

            {editingLabels && (
                <CrudModal
                    title="Schedule and inclusion labels"
                    subtitle="The wording around the two notes. The notes themselves are edited row by row."
                    fields={labelsFields}
                    initial={editingLabels}
                    submitLabel="Save labels"
                    onSubmit={saveBookingNotesCopy}
                    onClose={() => setEditingLabels(null)}
                />
            )}

            {editingNote && (
                <CrudModal
                    title={`${editingNote.label} note`}
                    subtitle="Shown under the schedule cards once a guest picks this schedule."
                    fields={scheduleNoteFields}
                    initial={editingNote}
                    submitLabel="Save note"
                    onSubmit={saveScheduleNote}
                    onClose={() => setEditingNote(null)}
                />
            )}

            {editingInclusion && (
                <CrudModal
                    title={editingInclusion.id ? 'Edit inclusion' : 'New inclusion'}
                    subtitle={
                        editingInclusion.id
                            ? 'Unticking the box takes it off the page and keeps its wording.'
                            : 'It joins the end of that list. Reorder it with the arrows after saving.'
                    }
                    fields={inclusionFields}
                    initial={editingInclusion}
                    submitLabel={editingInclusion.id ? 'Save changes' : 'Add inclusion'}
                    onSubmit={saveBookingInclusion}
                    onDelete={
                        editingInclusion.id
                            ? () => deleteBookingInclusion(editingInclusion.id)
                            : null
                    }
                    deleteLabel="Delete inclusion"
                    onClose={() => setEditingInclusion(null)}
                />
            )}
        </div>
    )
}

// The inclusions staff have taken off the page. Split out of the two lists
// above rather than greyed out inside them, because those lists are ordered by
// what a guest reads and a hidden row has no place in that order — it would sit
// in the numbering claiming a position it does not have.
function HiddenInclusions({ onEdit }) {
    const { inclusions } = useBookingPage()
    const hidden = inclusions
        .filter((row) => !row.isActive)
        .sort((a, b) => a.rateGroup.localeCompare(b.rateGroup) || a.sortOrder - b.sortOrder)

    if (hidden.length === 0) return null

    return (
        <>
            <div className="booking-cms-group-bar">
                <div>
                    <h3 className="booking-cms-group-title">Hidden inclusions</h3>
                    <p className="booking-cms-group-note">
                        Kept, but not listed on the page. Tick "Show this inclusion" to put one
                        back.
                    </p>
                </div>
            </div>

            <div className="booking-cms-rows">
                {hidden.map((item) => (
                    <article className="booking-cms-row crud-is-hidden" key={item.id}>
                        <p className="booking-cms-row-text">
                            {item.item}
                            <span className="crud-hidden-tag">
                                {item.rateGroup === 'day' ? 'Day Time' : 'Overnight'}
                            </span>
                        </p>
                        <div className="crud-row-actions">
                            <button
                                type="button"
                                className="crud-btn is-small"
                                onClick={() =>
                                    onEdit({
                                        id: item.id,
                                        rateGroup: item.rateGroup,
                                        item: item.item,
                                        sortOrder: item.sortOrder,
                                        isActive: item.isActive,
                                    })
                                }
                            >
                                Edit
                            </button>
                        </div>
                    </article>
                ))}
            </div>
        </>
    )
}
