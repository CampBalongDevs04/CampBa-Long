import { useState } from 'react'
import { useLocation } from 'react-router'
import './components/css/booking.css'
import BookingCalendar from './components/BookingCalendar'
import TimeSelector, { timeOptions } from './components/timeSelector'
import ScheduleNote from './components/scheduleNote'
import AccomodationList from './components/accomodationList'
import PaxInput from './components/paxInput'
import Payment from './components/payment'
import Terms from './components/terms'
import BookingSummary from './components/bookingSummary'

export default function Booking(){
    const location = useLocation()
    const [selectedTime, setSelectedTime] = useState(null)
    const [dates, setDates] = useState({ checkIn: null, checkOut: null })
    const [selectedAccomodation, setSelectedAccomodation] = useState(
        location.state?.accomodationId ?? null
    )
    const [pax, setPax] = useState(null)
    const [guest, setGuest] = useState({ fullName: '', mobile: '', email: '' })
    const [receipt, setReceipt] = useState(null)
    const [agreed, setAgreed] = useState(false)

    const sameDayCheckout = selectedTime !== null && timeOptions[selectedTime].sameDay === true

    return(
        <main className="page booking-page">
            <div className="booking-header">
                <h1 className="book-title">Booking</h1>

                <div className="booking-layout">
                <section className="booking-calendar-section">
                    <BookingCalendar
                        sameDayCheckout={sameDayCheckout}
                        onChange={setDates}
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

                    <Payment
                        receipt={receipt}
                        onReceiptChange={setReceipt}
                    />

                    <Terms
                        agreed={agreed}
                        onAgreeChange={setAgreed}
                    />

                </section>

                <BookingSummary
                    checkIn={dates.checkIn}
                    checkOut={sameDayCheckout ? dates.checkIn : dates.checkOut}
                    schedule={selectedTime !== null ? timeOptions[selectedTime] : null}
                    selectedAccomodation={selectedAccomodation}
                    guest={guest}
                    pax={pax}
                    receipt={receipt}
                />
                </div>
            </div>

        </main>
    )
}
