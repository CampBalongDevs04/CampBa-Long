import '../components/css/noteSched.css'
import { useBookingPage, inclusionsFor, scheduleNoteFor } from '../../data/bookingPage.js'

// The two notes under the schedule cards on /booking: what the chosen schedule
// means for check-in, and what its rate includes.
//
// Both are editable in the dashboard's CMS → Booking → Notes & Inclusions, but
// they come from different places, because they answer to different things. The
// schedule's sentence belongs to the SCHEDULE (stay_schedules.note) — rewording
// it is part of changing that schedule's hours. The inclusions belong to the
// RATE GROUP (booking_inclusions), which is the same grouping the prices use.
// data/bookingPage.js loads both, so this component asks one module.
//
// `selectedOption` is a row of STAY_SCHEDULES — the hardcoded mirror in
// accommodationDB.js — so its own note is the fallback while the database is
// still answering.
export default function ScheduleNote({ selectedOption, rateGroup }){
    const { page } = useBookingPage()
    const inclusions = inclusionsFor(rateGroup)

    return(
        <>
            <div className="note" role="note">
                <span className="note-dot"></span>
                <p className="note-text">
                    {page.scheduleNoteHeading && (
                        <>
                            <strong className="note-heading">{page.scheduleNoteHeading}</strong>{' '}
                        </>
                    )}
                    {selectedOption
                        ? scheduleNoteFor(selectedOption.key, selectedOption.note)
                        : page.scheduleNoteEmpty}
                </p>
            </div>

            {inclusions.length > 0 && (
                <div className="note note-inclusions" role="note">
                    <span className="note-dot"></span>
                    <div className="note-text">
                        {page.inclusionsHeading && (
                            <strong className="note-heading">{page.inclusionsHeading}</strong>
                        )}
                        <ul className="note-inclusions-list">
                            {inclusions.map((item) => (
                                <li key={item.id}>{item.item}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </>
    )
}
