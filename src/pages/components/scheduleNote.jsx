import '../components/css/noteSched.css'

export default function ScheduleNote({ selectedOption }){
    return(
        <div className="note" role="note">
            <span className="note-dot"></span>
            <p className="note-text">
                <strong className="note-heading">Schedule note.</strong>{' '}
                {selectedOption
                    ? selectedOption.note
                    : 'Select a stay schedule to see the check-in details.'}
            </p>
        </div>
    )
}
