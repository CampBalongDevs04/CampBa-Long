import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import './components/css/booking.css'
import BookingCalendar from './components/BookingCalendar'
import StayLength from './components/stayLength'
import TimeSelector from './components/timeSelector'
import ScheduleNote from './components/scheduleNote'
import AccomodationList from './components/accomodationList'
import { getAccomodationOptions, isFreeEntranceEligible } from '../data/accomodationOptions.js'
import PaxInput from './components/paxInput'
import KidsCount from './components/kidscount'
import SeniorCount from './components/seniorCount'
import { computeStayQuote } from '../data/extendedStay.js'
import Terms from './components/terms'
import BookingSummary from './components/bookingSummary'
import HoldQueueNotice from './components/holdQueueNotice'
import { useBookingQueue } from './components/useBookingQueue.js'
import Footer from '../components/footer'
import { createBooking, createGroupBooking, STAY_SCHEDULES as timeOptions } from '../data/accommodationDB.js'

// Paying is deliberately NOT one of these steps any more. It happens from My
// Bookings, after the unit is held — see the comment on handleConfirm.
const steps = [
    {
        id: 'step-schedule',
        title: 'Dates & Schedule',
        sub: 'Pick your check-in date and stay schedule, then set how many nights'
            + ' you are staying. Every night is charged at the same rate.',
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
        id: 'step-confirm',
        title: 'Review & Reserve',
        sub: 'Read our resort policy, then reserve your unit. You will have 10 minutes'
            + ' to upload your down-payment receipt before the hold is released.',
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
    // A cart, not a single pick: { [accommodationId]: quantity }, one entry
    // per type with quantity > 0. A guest arriving from "Book Now!" or "Book
    // Again" still lands with exactly one unit pre-added.
    const [cart, setCart] = useState(() =>
        location.state?.accomodationId ? { [location.state.accomodationId]: 1 } : {}
    )
    const [droppedUnitNote, setDroppedUnitNote] = useState(null)
    const [pax, setPax] = useState(null)
    const [kids, setKids] = useState(0)
    const [seniors, setSeniors] = useState(0)
    const [guest, setGuest] = useState({ fullName: '', mobile: '', email: '' })
    const [agreed, setAgreed] = useState(false)
    const [attemptedConfirm, setAttemptedConfirm] = useState(false)
    // Set when the database refuses the reservation — e.g. the last unit of
    // that type was taken while this form was being filled in.
    const [bookingError, setBookingError] = useState(null)
    // Blocks a second Confirm while the reservation round-trip is in flight.
    const [submitting, setSubmitting] = useState(false)
    // Non-null while this guest is waiting in line for a unit somebody else is
    // holding. The object identity is the hook's dependency — replacing it
    // rejoins the queue at the BACK, so it is only ever set from null.
    const [queueRequest, setQueueRequest] = useState(null)

    const schedule = selectedTime !== null ? timeOptions[selectedTime] : null
    const sameDayCheckout = schedule?.sameDay === true
    const rateGroup = schedule?.rateGroup ?? null
    const scheduleKey = schedule?.key ?? null
    const effectiveCheckOut = sameDayCheckout ? dates.checkIn : dates.checkOut

    // The cart, resolved against this schedule's prices/capacity. A stale id
    // (dropped by a schedule switch, or never valid) simply has no option and
    // is filtered out — see handleSelectTime, which is what actually removes
    // it from `cart` itself.
    const accommodationOptions = getAccomodationOptions(rateGroup)
    const cartLines = Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({ id, qty, option: accommodationOptions.find((item) => item.id === id) ?? null }))
        .filter((line) => line.option != null)
    const cartUnitCount = cartLines.reduce((sum, line) => sum + line.qty, 0)
    const cartUnlimited = cartLines.some((line) => line.option.maxPax == null)
    const cartCapacity = cartUnlimited
        ? null
        : cartLines.reduce((sum, line) => sum + line.option.maxPax * line.qty, 0)
    const cartFreeEntranceEligible =
        cartLines.length > 0 && cartLines.every((line) => isFreeEntranceEligible(line.id))

    // The whole stay's arithmetic, in one place: how many nights the dates
    // come to, the unit rates multiplied across them, the entrance fees
    // multiplied the same way, and what that makes the down payment. The
    // summary renders this object and reserve() stores it, so a guest cannot
    // be quoted one figure on this page and charged another on the next.
    const quote = computeStayQuote({
        schedule,
        checkIn: dates.checkIn,
        checkOut: effectiveCheckOut,
        cartLines,
        pax: pax ?? 0,
        kids,
        seniors,
        freeEntranceEligible: cartFreeEntranceEligible,
    })

    // Switching schedules can change which units are even offered (e.g.
    // Cottage is day-only, tents are overnight-only) — drop whatever in the
    // cart is no longer valid for the newly chosen schedule. Units can also
    // arrive pre-added from the home page "Book Now!", so say what was
    // dropped instead of just clearing the cards.
    function handleSelectTime(index){
        setSelectedTime(index)

        // Coming FROM Day Time, check-out is sitting on the check-in date —
        // that is what same-day means, and it is not a stay length an
        // overnight schedule can be booked for. Drop it so the nights stepper
        // asks the question rather than silently booking a zero-night stay.
        if (timeOptions[index]?.sameDay !== true) {
            setDates((current) => (
                current.checkIn && current.checkOut
                    && current.checkOut.getTime() <= current.checkIn.getTime()
                    ? { ...current, checkOut: null }
                    : current
            ))
        }

        const nextRateGroup = timeOptions[index]?.rateGroup ?? null
        const cartIds = Object.keys(cart).filter((id) => cart[id] > 0)
        if (cartIds.length === 0) return

        const stillOffered = new Set(getAccomodationOptions(nextRateGroup).map((item) => item.id))
        const droppedIds = cartIds.filter((id) => !stillOffered.has(id))
        if (droppedIds.length === 0) {
            setDroppedUnitNote(null)
            return
        }

        // No rate group here: look the names up across every unit, since the
        // dropped ones are by definition missing from the new group's list.
        const allOptions = getAccomodationOptions(null)
        const droppedNames = droppedIds
            .map((id) => allOptions.find((item) => item.id === id)?.name)
            .filter(Boolean)

        setCart((current) => {
            const next = { ...current }
            for (const id of droppedIds) delete next[id]
            return next
        })

        // `checkIn` carries the schedule's name ('Day Time: '), trailing
        // separator included — strip it for use mid-sentence. Names that
        // failed to resolve get no note; there is nothing to explain.
        const scheduleName = timeOptions[index].checkIn.replace(/[:\s]+$/, '')
        setDroppedUnitNote(
            droppedNames.length > 0
                ? `${droppedNames.join(', ')} ${droppedNames.length > 1 ? "aren't" : "isn't"} offered on`
                    + ` the ${scheduleName} schedule and ${droppedNames.length > 1 ? 'were' : 'was'} removed from your selection.`
                : null
        )
    }

    function handleCartQtyChange(id, qty){
        setCart((current) => {
            const next = { ...current }
            if (qty <= 0) delete next[id]
            else next[id] = qty
            return next
        })
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

    // A Sunday check-in used to force Day Time, because the only overnight
    // stay it could make ended on maintenance Monday. That is no longer the
    // only one it can make: a stay may run straight through a Monday now, so a
    // Sunday arrival is fine as long as it stays two nights and checks out on
    // the Tuesday. The calendar refuses a Monday check-out on its own, so
    // there is nothing left for this to override.
    function handleDatesChange(nextDates){
        setDates(nextDates)
    }

    // An overnight schedule needs a check-out STRICTLY after the check-in —
    // one night at the very least. Same-day (Day Time) checks out on the
    // check-in date by definition and has no length to set.
    const stayLengthSet = sameDayCheckout
        || (dates.checkIn != null && dates.checkOut != null
            && dates.checkOut.getTime() > dates.checkIn.getTime())

    // One entry per step above — a step counts as done only once every
    // field it collects is filled in, so Reserve can be blocked until
    // all three are complete.
    const missingSteps = [
        !(dates.checkIn && stayLengthSet && selectedTime !== null)
            && 'Dates & Schedule',
        cartUnitCount === 0 && 'Accommodation',
        !(pax && guest.fullName.trim() && guest.mobile.trim() && guest.email.trim())
            && 'Guest Information',
    ].filter(Boolean)

    // A group larger than the cart's COMBINED capacity is the one pax rule
    // that blocks the booking — that's how many people the selected units
    // physically hold, together. Under capacity is deliberately allowed (the
    // rate is per unit, not per head); PaxInput just notes it. Not a "missing
    // step": every field is filled, the numbers simply don't work together.
    const capacityIssue = pax != null && cartUnitCount > 0 && !cartUnlimited && pax > cartCapacity
        ? `Your selected accommodation${cartUnitCount > 1 ? 's hold' : ' holds'} up to ${cartCapacity} pax combined.`
            + ` Lower your guest count or add another unit for your group of ${pax}.`
        : null

    // One reservation attempt. Split out of handleConfirm because it is made
    // twice in the queue case: once when the guest presses Reserve and is told
    // the unit is held, and again — by itself, with nobody watching — the
    // moment that hold lapses and the queue says the unit is theirs.
    //
    // Returns false when it declined to run because one is already in flight.
    // The queue needs that answer: it treats a turn as spent once it hands it
    // over, and a guest who happened to press Reserve in the same second would
    // otherwise burn their claim on an attempt that never happened.
    async function reserve(){
        if (submitting) return false

        setSubmitting(true)

        const checkOut = effectiveCheckOut
        // WHOLE-STAY figures, not one night's. `quote.entrance` is the party's
        // nightly entrance multiplied across the nights, and `perHead` on it is
        // therefore what one full-fare head owes for the stay — which is what
        // keeps the stored breakdown internally consistent, since every screen
        // that reads it back multiplies the head COUNTS by that per-head figure
        // to recover the discounts (see splitFreeEntrance in entranceFee.js).
        const entranceBreakdown = {
            perHead: quote.entrance.perHead,
            seniorDiscount: quote.entrance.seniorDiscount,
            freeApplied: quote.entrance.freeApplied,
            freeSavings: quote.entrance.freeSavings,
            total: quote.entrance.total,
        }

        // No payment happens here any more, and that is the point: the units
        // are held FIRST. Paying used to come before the reservation existed,
        // which meant nothing was reserved while the guest was away in their
        // banking app — the last unit could be taken from under them, and by
        // the time they found out the money had already been sent. It also
        // made it impossible for food and spa to be part of the down payment,
        // since add-ons attach to a booking that did not yet exist.
        //
        // The guest is handed to My Bookings to settle 50% of the whole stay.

        // A cart of exactly one unit still goes through the plain single-unit
        // path (createBooking → book_stay) rather than the group path below —
        // that's the ONLY path with a hold-queue, so a guest waiting on the
        // last A-House still gets offered a place in line. A combined
        // reservation (2+ units) has no queue in this version: it either
        // reserves every unit at once or refuses outright naming which one
        // ran out — see the migration header for why that's still safe.
        if (cartUnitCount === 1) {
            const unit = cartLines[0].option

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
                entrance: entranceBreakdown,
                // The rate for the WHOLE stay — the card's nightly rate times
                // the nights being booked. `bookings.price` has always been
                // "what this unit costs for this booking", and a three-night
                // stay costs three nights of it.
                price: quote.lines[0]?.total ?? null,
            })

            setSubmitting(false)

            if (!result.ok) {
                setBookingError(result.message)

                // "Someone is holding it" and "someone ahead of you in line is
                // taking it" are both answered by waiting, not by sending the
                // guest back to the carousel. The cart stays exactly as it is
                // — the queue is going to replay this same booking for them.
                if (result.canWait) {
                    setQueueRequest((current) => current ?? {
                        typeId: unit?.id ?? null,
                        scheduleKey,
                        checkIn: dates.checkIn,
                        checkOut,
                        guestName: guest.fullName || null,
                    })
                    return
                }

                setQueueRequest(null)
                // Only an "unavailable" answer means the unit is gone for good;
                // a network or server error should leave the cart intact.
                if (result.reason === 'unavailable') {
                    setCart({})
                    document.getElementById('step-accommodation')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                return
            }

            setBookingError(null)
            // Unmounts the queue panel, which releases the place in line on its
            // way out — the unit is booked, so holding it would only delay
            // whoever is behind. Cleared before navigating, while this
            // component still exists.
            setQueueRequest(null)
            navigate('/my-booking', {
                state: { justBooked: result.booking.code, payNow: true },
            })
            return
        }

        // 2+ units: one combined reservation. The database holds every unit
        // in one transaction and rolls the whole thing back the instant one
        // of them fails — see book_stay_group() — so there is nothing partial
        // to reconcile here, only a plain success or refusal.
        // One entry per physical unit, each priced for the whole stay
        // (`perUnit` = the card's nightly rate × nights). book_stay_group()
        // sums them into the group's unit_subtotal, so the group total picks
        // up the extra nights without the SQL needing to know about them.
        const items = quote.lines.flatMap((line) =>
            Array.from({ length: line.qty }, () => ({ typeId: line.id, price: line.perUnit }))
        )

        const result = await createGroupBooking({
            items,
            scheduleKey,
            checkIn: dates.checkIn,
            checkOut,
            guest,
            pax,
            kids,
            seniors,
            entrance: entranceBreakdown,
        })

        setSubmitting(false)

        if (!result.ok) {
            setBookingError(result.message)
            setQueueRequest(null)
            // The cart is left as-is rather than cleared: only one line was
            // the problem, and clearing all of it would throw away choices
            // that were fine. The message names which one ran out.
            if (result.reason === 'unavailable') {
                document.getElementById('step-accommodation')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            return
        }

        setBookingError(null)
        setQueueRequest(null)
        navigate('/my-booking', {
            state: { justBooked: result.group.code, payNow: true },
        })
    }

    function handleConfirm(){
        setAttemptedConfirm(true)
        if (missingSteps.length > 0 || capacityIssue || submitting) return
        return reserve()
    }

    // Their turn came up: book it, without the guest having to be at the desk.
    // The hook holds this in a ref, so the stale-closure risk of passing a
    // freshly-created function every render does not apply.
    const queue = useBookingQueue(queueRequest, { onReady: reserve })

    // Give up on the queue and go back to choosing. The place in line is
    // released by the hook's cleanup when queueRequest goes null.
    function handleLeaveQueue(){
        setQueueRequest(null)
        setBookingError(null)
        setCart({})
        document.getElementById('step-accommodation')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    // Lost the place to the heartbeat (a slept phone, a backgrounded tab).
    // Dropping the request first means the retry below joins fresh rather than
    // polling an entry the server has already written off.
    function handleRejoinQueue(){
        setQueueRequest(null)
        reserve()
    }

    return(
        <main className="page booking-page">
            <div className="booking-shell">
                <header className="booking-hero">
                    <p className="booking-eyebrow">Camp Ba-long Reservations</p>
                    <h1 className="book-title">Complete Your Booking</h1>
                    <p className="booking-tagline">
                        Reserve your stay in four simple steps — your unit is held
                        first, then you settle the down payment from My Bookings
                        within 10 minutes. We confirm once the receipt is verified.
                    </p>

                    <ul className="booking-trust" aria-label="Booking assurances">
                        <li className="booking-trust-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="4" y="10" width="16" height="10" rx="2.5" />
                                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                            </svg>
                            Your unit is reserved before you pay a peso — for 10 minutes
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
                                    checkIn={dates.checkIn}
                                    checkOut={dates.checkOut}
                                    sameDayCheckout={sameDayCheckout}
                                    onChange={handleDatesChange}
                                />

                                <TimeSelector
                                    selectedTime={selectedTime}
                                    onSelectTime={handleSelectTime}
                                    checkIn={dates.checkIn}
                                />

                                {/* Only an overnight schedule can run long, and
                                    only once one is picked do we know what a
                                    night costs — so this appears under the
                                    schedule cards rather than beside the
                                    calendar. It writes a check-out date, which
                                    is the same fact the calendar collects. */}
                                {schedule && !sameDayCheckout && (
                                    <StayLength
                                        checkIn={dates.checkIn}
                                        checkOut={dates.checkOut}
                                        schedule={schedule}
                                        onChange={(checkOut) => handleDatesChange({ ...dates, checkOut })}
                                    />
                                )}

                                <ScheduleNote
                                    selectedOption={schedule}
                                    rateGroup={rateGroup}
                                />
                            </div>
                        </section>

                        <section className="booking-step" aria-labelledby="step-accommodation">
                            <StepHeader index={1} />
                            <div className="booking-step-body">
                                <AccomodationList
                                    cart={cart}
                                    onQtyChange={handleCartQtyChange}
                                    checkIn={dates.checkIn}
                                    checkOut={effectiveCheckOut}
                                    nights={quote.nights}
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
                                    cartLines={cartLines}
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

                        <section className="booking-step" aria-labelledby="step-confirm">
                            <StepHeader index={3} />
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
                                {/* While the guest is in line the queue panel
                                    IS the message — the red alert underneath
                                    would be the same refusal said twice, and
                                    said as a dead end rather than a wait. */}
                                {bookingError && !queueRequest && (
                                    <p className="booking-confirm-alert" role="alert">
                                        {bookingError}
                                    </p>
                                )}
                                {queueRequest && (
                                    <HoldQueueNotice
                                        typeName={cartLines[0]?.option?.name ?? 'That unit'}
                                        entry={queue.entry}
                                        msLeft={queue.msLeft}
                                        ready={queue.ready}
                                        expired={queue.expired}
                                        error={queue.error}
                                        retrying={submitting}
                                        onLeave={handleLeaveQueue}
                                        onRejoin={handleRejoinQueue}
                                    />
                                )}
                                <Terms
                                    agreed={agreed}
                                    onAgreeChange={setAgreed}
                                    onConfirm={handleConfirm}
                                    submitting={submitting}
                                    confirmLabel="Reserve & Proceed to Payment"
                                />
                            </div>
                        </section>
                    </div>

                    <BookingSummary
                        checkIn={dates.checkIn}
                        checkOut={effectiveCheckOut}
                        schedule={schedule}
                        quote={quote}
                        guest={guest}
                        pax={pax}
                        kids={kids}
                        seniors={seniors}
                    />
                </div>
            </div>
            <Footer />

        </main>
    )
}
