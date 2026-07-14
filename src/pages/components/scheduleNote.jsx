import '../components/css/noteSched.css'

export default function ScheduleNote({ selectedOption }){
    return(
        <div className="note">
            <h1 className="Note-title">Note:</h1>
            <p className="note-text">
                {selectedOption
                    ? selectedOption.note
                    : 'Select a stay schedule to see the check-in details.'}
            </p>
        </div>
    )
}
