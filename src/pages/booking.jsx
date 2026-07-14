import { useState } from 'react'
import { useLocation } from 'react-router'
import './components/css/booking.css'
import BookingCalendar from './components/BookingCalendar'
import TimeSelector, { timeOptions } from './components/timeSelector'
import ScheduleNote from './components/scheduleNote'
import AccomodationList from './components/accomodationList'
import PaxInput from './components/paxInput'

export default function Booking(){
    const location = useLocation()
    const [selectedTime, setSelectedTime] = useState(null)
    const [selectedAccomodation, setSelectedAccomodation] = useState(
        location.state?.accomodationId ?? null
    )
    const [pax, setPax] = useState(null)
    const [guest, setGuest] = useState({ fullName: '', mobile: '', email: '' })

    return(
        <main className="page booking-page">
            <div className="booking-header">
                <h1 className="book-title">Booking</h1>

                <section className="booking-calendar-section">
                    <BookingCalendar
                        sameDayCheckout={selectedTime !== null && timeOptions[selectedTime].sameDay === true}
                    />

                    <TimeSelector
                        selectedTime={selectedTime}
                        onSelectTime={setSelectedTime}
                    />

                    <ScheduleNote
                        selectedOption={selectedTime !== null ? timeOptions[selectedTime] : null}
                    />

                    <AccomodationList
                        selectedAccomodation={selectedAccomodation}
                        onSelectAccomodation={setSelectedAccomodation}
                    />

                    <PaxInput
                        pax={pax}
                        onPaxChange={setPax}
                        selectedAccomodation={selectedAccomodation}
                        guest={guest}
                        onGuestChange={setGuest}
                    />


                </section>
            </div>

        </main>
    )
}
