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
import Footer from '../components/footer'

const steps = [
    {
        id: 'step-schedule',
        title: 'Dates & Schedule',
        sub: 'Pick your check-in and check-out dates, then choose a stay schedule.',
    },
    {
        id: 'step-accommodation',
        title: 'Accommodation',
        sub: 'Select the unit that suits your group.',
    },
    {
        id: 'step-guest',
        title: 'Guest Information',
        sub: 'Tell us who is booking so we can confirm your reservation.',
    },
    {
        id: 'step-payment',
        title: 'Payment',
        sub: 'Settle the 50% down payment and upload your receipt as proof.',
    },
    {
        id: 'step-confirm',
        title: 'Review & Confirm',
        sub: 'Read our resort policy, then confirm your booking.',
    },
]

function StepHeader({ index }){
    const step = steps[index]
    return(
        <header className="booking-step-header">
            <span className="booking-step-num" aria-hidden="true">{index + 1}</span>
            <div className="booking-step-heading">
                <h2 className="booking-step-title" id={step.id}>{step.title}</h2>
                <p className="booking-step-sub">{step.sub}</p>
            </div>
        </header>
    )
}

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
            <div className="booking-shell">
                <header className="booking-hero">
                    <p className="booking-eyebrow">Camp Ba-long Reservations</p>
                    <h1 className="book-title">Complete Your Booking</h1>
                    <p className="booking-tagline">
                        Reserve your stay in five simple steps. Your booking is
                        confirmed once we verify your down-payment receipt.
                    </p>

                    <ul className="booking-trust" aria-label="Booking assurances">
                        <li className="booking-trust-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="4" y="10" width="16" height="10" rx="2.5" />
                                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                            </svg>
                            Secure down payment via GCash or bank transfer
                        </li>
                        <li className="booking-trust-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M20 6 9 17l-5-5" />
                            </svg>
                            Every receipt is personally verified
                        </li>
                        <li className="booking-trust-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M12 7v5l3 3" />
                            </svg>
                            Confirmation sent within 24 hours
                        </li>
                    </ul>
                </header>

                <div className="booking-layout">
                    <div className="booking-steps">
                        <section className="booking-step" aria-labelledby="step-schedule">
                            <StepHeader index={0} />
                            <div className="booking-step-body">
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
                            </div>
                        </section>

                        <section className="booking-step" aria-labelledby="step-accommodation">
                            <StepHeader index={1} />
                            <div className="booking-step-body">
                                <AccomodationList
                                    selectedAccomodation={selectedAccomodation}
                                    onSelectAccomodation={setSelectedAccomodation}
                                />
                            </div>
                        </section>

                        <section className="booking-step" aria-labelledby="step-guest">
                            <StepHeader index={2} />
                            <div className="booking-step-body">
                                <PaxInput
                                    pax={pax}
                                    onPaxChange={setPax}
                                    selectedAccomodation={selectedAccomodation}
                                    guest={guest}
                                    onGuestChange={setGuest}
                                />
                            </div>
                        </section>

                        <section className="booking-step" aria-labelledby="step-payment">
                            <StepHeader index={3} />
                            <div className="booking-step-body">
                                <Payment
                                    receipt={receipt}
                                    onReceiptChange={setReceipt}
                                />
                            </div>
                        </section>

                        <section className="booking-step" aria-labelledby="step-confirm">
                            <StepHeader index={4} />
                            <div className="booking-step-body">
                                <Terms
                                    agreed={agreed}
                                    onAgreeChange={setAgreed}
                                />
                            </div>
                        </section>
                    </div>

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
            <Footer />

        </main>
    )
}
