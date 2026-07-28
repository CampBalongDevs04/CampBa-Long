import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import './components/css/booking.css'
import BookingCalendar from './components/BookingCalendar'
import TimeSelector from './components/timeSelector'
import ScheduleNote from './components/scheduleNote'
import AccomodationList from './components/accomodationList'
import { getAccomodationOptions, getPaxFit, FREE_ENTRANCE_PAX } from '../data/accomodationOptions.js'
import PaxInput from './components/paxInput'
import KidsCount from './components/kidscount'
import SeniorCount from './components/seniorCount'
import Payment from './components/payment'
import { computeEntranceFee } from '../data/entranceFee.js'
import Terms from './components/terms'
import BookingSummary from './components/bookingSummary'
import Footer from '../components/footer'
import { createBooking, uploadReceipt, STAY_SCHEDULES as timeOptions } from '../data/accommodationDB.js'

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
    const navigate = useNavigate()
    const [selectedTime, setSelectedTime] = useState(null)
    const [dates, setDates] = useState({ checkIn: null, checkOut: null })
    const [selectedAccomodation, setSelectedAccomodation] = useState(
        location.state?.accomodationId ?? null
    )
    const [droppedUnitNote, setDroppedUnitNote] = useState(null)
    const [pax, setPax] = useState(null)
    const [kids, setKids] = useState(0)
    const [seniors, setSeniors] = useState(0)
    const [guest, setGuest] = useState({ fullName: '', mobile: '', email: '' })
    const [receipt, setReceipt] = useState(null)
    const [agreed, setAgreed] = useState(false)
    const [attemptedConfirm, setAttemptedConfirm] = useState(false)
    // Set when the database refuses the reservation — e.g. the last unit of
    // that type was taken while this form was being filled in.
    const [bookingError, setBookingError] = useState(null)
    // Blocks a second Confirm while the reservation round-trip is in flight.
    const [submitting, setSubmitting] = useState(false)

    const sameDayCheckout = selectedTime !== null && timeOptions[selectedTime].sameDay === true
    const rateGroup = selectedTime !== null ? timeOptions[selectedTime].rateGroup : null
    const scheduleKey = selectedTime !== null ? timeOptions[selectedTime].key : null

    // Switching schedules can change which units are even offered (e.g.
    // Cottage is day-only, tents are overnight-only) — drop a selection
    // that's no longer valid for the newly chosen schedule. The unit can
    // also arrive preselected from the home page "Book Now!", so say what
    // was dropped instead of just clearing the card.
    function handleSelectTime(index){
        setSelectedTime(index)
        const nextRateGroup = timeOptions[index]?.rateGroup ?? null
        if (!selectedAccomodation) return
        const stillOffered = getAccomodationOptions(nextRateGroup).some(
            (item) => item.id === selectedAccomodation
        )
        if (stillOffered) {
            setDroppedUnitNote(null)
            return
        }
        // No rate group here: look the name up across every unit, since the
        // dropped one is by definition missing from the new group's list.
        const dropped = getAccomodationOptions(null).find(
            (item) => item.id === selectedAccomodation
        )
        setSelectedAccomodation(null)
        // `checkIn` carries the schedule's name ('Day Time: '), trailing
        // separator included — strip it for use mid-sentence. An id that
        // matches no unit at all gets no note; there is nothing to explain.
        const scheduleName = timeOptions[index].checkIn.replace(/[:\s]+$/, '')
        setDroppedUnitNote(
            dropped
                ? `${dropped.name} isn't offered on the ${scheduleName} schedule — pick another unit below.`
                : null
        )
    }

    function handleSelectAccomodation(id){
        setSelectedAccomodation(id)
        setDroppedUnitNote(null)
        setBookingError(null)
    }

    // Seniors and kids are a subset of the total guests (pax). If the guest
    // count drops below the specials already picked, trim them to fit —
    // seniors are kept first, then kids fill whatever room is left.
    function handlePaxChange(nextPax){
        setPax(nextPax)
        const cap = nextPax ?? 0
        const nextSeniors = Math.min(seniors, cap)
        const nextKids = Math.min(kids, cap - nextSeniors)
        if (nextSeniors !== seniors) setSeniors(nextSeniors)
        if (nextKids !== kids) setKids(nextKids)
    }

    function handleDatesChange(nextDates){
        setDates(nextDates)
        // A Sunday check-in only allows the same-day Day Time schedule
        // (Monday is maintenance day), so drop any overnight selection.
        if (
            nextDates.checkIn && nextDates.checkIn.getDay() === 0 &&
            selectedTime !== null && timeOptions[selectedTime].sameDay !== true
        ) {
            setSelectedTime(null)
        }
    }

    // One entry per step above — a step counts as done only once every
    // field it collects is filled in, so Confirm can be blocked until
    // all five are complete.
    const missingSteps = [
        !(dates.checkIn && (sameDayCheckout || dates.checkOut) && selectedTime !== null)
            && 'Dates & Schedule',
        !selectedAccomodation && 'Accommodation',
        !(pax && guest.fullName.trim() && guest.mobile.trim() && guest.email.trim())
            && 'Guest Information',
        !receipt && 'Payment',
    ].filter(Boolean)

    // A group larger than the unit's maxPax is the one pax rule that blocks
    // the booking — that's how many people it physically holds. Under minPax
    // is deliberately allowed (the rate is per unit, not per head); PaxInput
    // just notes it. Not a "missing step": every field is filled, the numbers
    // simply don't work together, so it gets its own message.
    const selectedUnit = selectedAccomodation
        ? getAccomodationOptions(rateGroup).find((item) => item.id === selectedAccomodation) ?? null
        : null
    const capacityIssue = getPaxFit(pax, selectedUnit) === 'over'
        ? `${selectedUnit.name} holds up to ${selectedUnit.maxPax} pax.`
            + ` Lower your guest count or pick a bigger accommodation for your group of ${pax}.`
        : null

    async function handleConfirm(){
        setAttemptedConfirm(true)
        if (missingSteps.length > 0 || capacityIssue || submitting) return
        setSubmitting(true)

        const schedule = selectedTime !== null ? timeOptions[selectedTime] : null
        const unit = selectedAccomodation
            ? getAccomodationOptions(schedule?.rateGroup).find((item) => item.id === selectedAccomodation)
            : null
        const checkOut = sameDayCheckout ? dates.checkIn : dates.checkOut
        const entrance = computeEntranceFee({
            perHead: schedule?.entranceFee ?? 0,
            pax: pax ?? 0,
            seniors,
            kids,
            freeEntrance: unit && !unit.freeEntranceExempt ? FREE_ENTRANCE_PAX : 0,
        })

        // Store the screenshot first. Staff have to see it to verify the down
        // payment before approving, so a booking must never be created with a
        // receipt that failed to upload — the guest would be told they're
        // waiting on a review that can't happen.
        const upload = await uploadReceipt(receipt)
        if (!upload.ok) {
            setSubmitting(false)
            setBookingError(upload.message)
            document.getElementById('step-payment')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            return
        }

        // The database picks and holds a free unit for exactly these hours.
        // If someone else took the last one while this form was open, it says
        // so instead of creating an overlapping reservation.
        const result = await createBooking({
            typeId: unit?.id ?? null,
            typeName: unit?.name ?? 'Accommodation',
            typePax: unit?.pax ?? null,
            scheduleKey,
            checkIn: dates.checkIn,
            checkOut,
            guest,
            pax,
            kids,
            seniors,
            entrance: {
                perHead: entrance.perHead,
                seniorDiscount: entrance.seniorDiscount,
                freeApplied: entrance.freeApplied,
                freeSavings: entrance.freeSavings,
                total: entrance.total,
            },
            price: unit?.price ?? null,
            hasReceipt: !!receipt,
            receiptPath: upload.path,
        })

        setSubmitting(false)

        if (!result.ok) {
            setBookingError(result.message)
            // Only an "unavailable" answer means the unit is gone; a network or
            // server error should leave the guest's selection intact to retry.
            if (result.reason === 'unavailable') {
                setSelectedAccomodation(null)
                document.getElementById('step-accommodation')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            return
        }

        setBookingError(null)
        // The code travels with the navigation so My Bookings can greet the
        // guest with this reservation and offer to save its receipt, rather
        // than dropping them into an undifferentiated list.
        navigate('/my-booking', { state: { justBooked: result.booking.code } })
    }

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
                                    onChange={handleDatesChange}
                                />

                                <TimeSelector
                                    selectedTime={selectedTime}
                                    onSelectTime={handleSelectTime}
                                    checkIn={dates.checkIn}
                                />

                                <ScheduleNote
                                    selectedOption={selectedTime !== null ? timeOptions[selectedTime] : null}
                                    rateGroup={rateGroup}
                                />
                            </div>
                        </section>

                        <section className="booking-step" aria-labelledby="step-accommodation">
                            <StepHeader index={1} />
                            <div className="booking-step-body">
                                <AccomodationList
                                    selectedAccomodation={selectedAccomodation}
                                    onSelectAccomodation={handleSelectAccomodation}
                                    checkIn={dates.checkIn}
                                    checkOut={sameDayCheckout ? dates.checkIn : dates.checkOut}
                                    rateGroup={rateGroup}
                                    scheduleKey={scheduleKey}
                                    droppedUnitNote={droppedUnitNote}
                                />
                            </div>
                        </section>

                        <section className="booking-step" aria-labelledby="step-guest">
                            <StepHeader index={2} />
                            <div className="booking-step-body">
                                <PaxInput
                                    pax={pax}
                                    onPaxChange={handlePaxChange}
                                    selectedAccomodation={selectedAccomodation}
                                    guest={guest}
                                    onGuestChange={setGuest}
                                    rateGroup={rateGroup}
                                />

                                <KidsCount
                                    kids={kids}
                                    onKidsChange={setKids}
                                    disabled={!pax}
                                    max={(pax ?? 0) - seniors}
                                />

                                <SeniorCount
                                    seniors={seniors}
                                    onSeniorsChange={setSeniors}
                                    disabled={!pax}
                                    max={(pax ?? 0) - kids}
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
                                {attemptedConfirm && missingSteps.length > 0 && (
                                    <p className="booking-confirm-alert" role="alert">
                                        Please complete the following before confirming: {missingSteps.join(', ')}.
                                    </p>
                                )}
                                {attemptedConfirm && capacityIssue && (
                                    <p className="booking-confirm-alert" role="alert">
                                        {capacityIssue}
                                    </p>
                                )}
                                {bookingError && (
                                    <p className="booking-confirm-alert" role="alert">
                                        {bookingError}
                                    </p>
                                )}
                                <Terms
                                    agreed={agreed}
                                    onAgreeChange={setAgreed}
                                    onConfirm={handleConfirm}
                                    submitting={submitting}
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
                        kids={kids}
                        seniors={seniors}
                        receipt={receipt}
                    />
                </div>
            </div>
            <Footer />

        </main>
    )
}
