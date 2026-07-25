import '../components/css/noteSched.css'
import { INCLUSIONS } from '../../data/accomodationOptions.js'

export default function ScheduleNote({ selectedOption, rateGroup }){
    const inclusions = rateGroup ? INCLUSIONS[rateGroup] : null

    return(
        <>
            <div className="note" role="note">
                <span className="note-dot"></span>
                <p className="note-text">
                    <strong className="note-heading">Schedule note.</strong>{' '}
                    {selectedOption
                        ? selectedOption.note
                        : 'Select a stay schedule to see the check-in details.'}
                </p>
            </div>

            {inclusions && (
                <div className="note note-inclusions" role="note">
                    <span className="note-dot"></span>
                    <div className="note-text">
                        <strong className="note-heading">Inclusions.</strong>
                        <ul className="note-inclusions-list">
                            {inclusions.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </>
    )
}
