import { useEffect, useRef } from 'react'
import '../components/css/accomodationList.css'
import { SkeletonImage } from '../../components/skeletons/Skeleton.jsx'
import {
    getAvailability,
    getNextAvailableDate,
    formatShortDate,
    useAccommodationDB,
    getSchedule,
    findAccommodationType,
} from '../../data/accommodationDB.js'
import { getAccomodationOptions, findRentAllOption, isRentAllOption } from '../../data/accomodationOptions.js'
import { useHoldCountdown } from './useHoldCountdown.js'
import { formatCountdown } from './usePaymentWindow.js'

// What a fully-booked card says instead of a flat "Fully booked · free <date>"
// when the blocker turns out to be another guest's unpaid ten-minute hold
// rather than a real booking — see useHoldCountdown.js. Its own component
// (not inlined in the card loop below) so its hook only runs for cards that
// are actually fully booked: React mounts/unmounts it as `isFullyBooked`
// flips, which starts and stops the polling for free instead of needing an
// `enabled` flag threaded through the hook.
function FullyBookedLabel({ typeId, checkIn, checkOut, scheduleKey, fallback }){
    const { isHeld, msLeft } = useHoldCountdown({ typeId, checkIn, checkOut, scheduleKey })
    if (!isHeld) return fallback
    return (
        <span className="accomodation-card-held">
            Held by another guest · frees in{' '}
            {/* Announced on the minute only — a screen reader reciting a
                ticking clock makes the rest of the carousel unusable. */}
            <span role="timer" aria-live={msLeft % 60000 < 1000 ? 'polite' : 'off'}>
                {formatCountdown(msLeft)}
            </span>
        </span>
    )
}

// `nights` is how many nights the chosen dates come to (1 for Day Time and for
// a plain overnight stay). The cards keep quoting the RATE — that is what the
// rate card says and what a guest compares units on — and add what it comes to
// for the stay underneath, so an extended stay never looks cheaper on the card
// than it is in the summary.
export default function AccomodationList({ cart, onQtyChange, checkIn, checkOut, nights = 1, rateGroup, scheduleKey, droppedUnitNote, rentAllMode = false }){
    const trackRef = useRef(null)
    // Re-renders whenever anything is booked or cancelled — anywhere in the
    // app — so the counts below are never stale.
    useAccommodationDB()
    const hasDates = !!checkIn
    const stayStart = checkIn ?? new Date()
    const stayEnd = checkOut ?? null
    const list = getAccomodationOptions(rateGroup)
    // Rent Resort mode swaps the whole carousel for just the Rent All card —
    // nothing else can be added alongside a whole-resort rental. If the
    // schedule currently picked doesn't offer that card at all, `rentAllCard`
    // is null and the carousel renders empty (booking.jsx's droppedUnitNote
    // already explains why when a schedule SWITCH is what caused it).
    //
    // The card is also left OUT of the normal, non-Rent-All browsing list —
    // it's only ever meant to be picked through the dedicated toggle, not
    // added alongside (or instead of) individual units the way an ordinary
    // card can be.
    const rentAllCard = rentAllMode ? findRentAllOption(list) : null
    const visibleList = rentAllMode
        ? (rentAllCard ? [rentAllCard] : [])
        : list.filter((item) => !isRentAllOption(item))
    const schedule = getSchedule(scheduleKey)
    const stayNights = Math.max(1, Number(nights) || 1)
    const isExtended = stayNights > 1
    const cartCount = (id) => cart?.[id] ?? 0
    const hasSelection = Object.values(cart ?? {}).some((qty) => qty > 0)

    // Small Tent, Big Tent and Tent Pitching are three cards drawing on the
    // same 4 physical slots (see accommodationDB.js's `poolAvailable`). The
    // server doesn't know what's sitting unsubmitted in THIS cart, so a guest
    // could add 1 Big Tent and 1 Tent Pitching back to back — each card looks
    // fine on its own — and only find out the resort ran out of ground when
    // the booking is submitted and refused. Tallying what the cart already
    // holds per pool, up front, is what lets each card refuse the add itself.
    const poolCartTotals = list.reduce((totals, entry) => {
        const poolId = findAccommodationType(entry.id)?.poolId
        if (!poolId) return totals
        totals[poolId] = (totals[poolId] ?? 0) + cartCount(entry.id)
        return totals
    }, {})

    const scrollByCard = (direction) => {
        const track = trackRef.current
        if (!track) return
        const card = track.querySelector('.accomodation-card')
        const step = card ? card.offsetWidth + 12 : 180
        track.scrollBy({ left: direction * step, behavior: 'smooth' })
    }

    // Bring a preselected card (e.g. coming from the home page "Book Now!")
    // into view, and re-home the carousel every time the schedule switches OR
    // Rent Resort mode toggles.
    //
    // `list` is the same array length or not — Day Time and the overnight
    // schedules don't offer the same units, and Rent Resort mode swaps it
    // down to just one card — but it's still the SAME track DOM node
    // underneath, so the browser keeps whatever scrollLeft it had from
    // before instead of resetting it. Left alone, switching back to Day Time
    // after scrolling around under an overnight schedule (or turning Rent
    // Resort back off after scrolling to find it) would leave the track
    // exactly where that left it, showing some card other than the new
    // list's first — with no visual hint that there's anything to the left.
    //
    // ONLY on a schedule switch or a Rent Resort toggle, not on every +/-
    // click: `hasSelection` used to be a dependency too, so ticking a card's
    // qty up from 0 (or the last one back down to 0) re-ran this and yanked
    // the carousel to centre on it, or snapped it back to the first card,
    // while the guest was still clicking. Reading `hasSelection` inside
    // without listing it is deliberate — this render's value is what the
    // effect closure captures, which is what "at the moment rateGroup or
    // rentAllMode changes" means.
    //
    // The TRACK is scrolled, not the card — scrollIntoView() walks every
    // scrollable ancestor including the page itself, so centring a card that
    // sits below the fold would drag the whole booking page down to step 2 and
    // land the guest past the dates they still have to pick. Only this carousel
    // has anything to move here.
    useEffect(() => {
        const track = trackRef.current
        if (!track) return
        const card = hasSelection ? track.querySelector('.accomodation-card.selected') : null
        if (card) {
            // Measured as a DELTA between the two rectangles rather than from
            // card.offsetLeft: the track is position:static, so offsetLeft is
            // counted from the booking shell around it and centring on it lands
            // the card off to one side. The browser clamps the result at both
            // ends.
            const cardBox = card.getBoundingClientRect()
            const trackBox = track.getBoundingClientRect()
            track.scrollLeft +=
                (cardBox.left + cardBox.width / 2) - (trackBox.left + trackBox.width / 2)
        } else {
            // Nothing selected under this schedule — start from its first
            // card rather than wherever the previous schedule left the track.
            track.scrollLeft = 0
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- see the note above the effect
    }, [rateGroup, rentAllMode])

    return(
        <div className="accomodation-list">
            <p className="accomodation-availability-note">
                {hasDates
                    ? `Showing availability for ${formatShortDate(stayStart)}${stayEnd && formatShortDate(stayEnd) !== formatShortDate(stayStart) ? ` – ${formatShortDate(stayEnd)}` : ''}${schedule ? `, ${schedule.time}` : ''}${isExtended ? ` · ${stayNights} nights` : ''}`
                    : 'Showing availability for today — pick your dates in step 1 to check your stay.'}
            </p>
            {isExtended && (
                <p className="accomodation-schedule-note">
                    Prices below are <strong>per night</strong>. Your {stayNights}-night stay is
                    charged {stayNights}× the rate shown, and a unit only appears here if it is
                    free for every night of it.
                </p>
            )}
            {!rateGroup && (
                <p className="accomodation-schedule-note">
                    Select a stay schedule above to see pricing and the units available for it.
                </p>
            )}
            {rateGroup && rentAllMode && !rentAllCard && (
                <p className="accomodation-schedule-note">
                    Renting the whole resort isn't offered on this schedule — try Day Time or an
                    overnight schedule that has it, or turn Rent Resort off to pick units individually.
                </p>
            )}
            {droppedUnitNote && (
                <p className="accomodation-dropped-note" role="status">{droppedUnitNote}</p>
            )}
            <div className="accomodation-carousel">
                <button
                    type="button"
                    className="carousel-arrow"
                    aria-label="Previous accomodation"
                    onClick={() => scrollByCard(-1)}
                >
                    &#8249;
                </button>

                {/* One card in Rent Resort mode never fills the track's width —
                    centred instead of sitting flush left with empty space
                    trailing it, the way a full carousel reads. */}
                <div
                    className={`accomodation-track${visibleList.length === 1 ? ' accomodation-track-centered' : ''}`}
                    ref={trackRef}
                >
                    {visibleList.map((item) => {
                        const unlimited = item.unlimited === true
                        const availability = unlimited
                            ? null
                            : getAvailability(item.id, stayStart, stayEnd, scheduleKey)
                        const isFullyBooked = !unlimited && availability !== null && availability.available === 0
                        const nextAvailable = isFullyBooked
                            ? getNextAvailableDate(item.id, stayStart, 60, scheduleKey)
                            : null
                        // What the promo takes off, in pesos. `originalPrice` is
                        // only set while one is running, so this doubles as the
                        // test for whether to say anything at all.
                        const promoSaving =
                            item.originalPrice != null && item.price != null
                                ? item.originalPrice - item.price
                                : null

                        const qty = cartCount(item.id)
                        // Capped at what's actually free for the stay — a
                        // guest can put 2 Teepees in the cart when 2 are open,
                        // never 3. `.available` already accounts for what's
                        // taken elsewhere (1 of 2 available means only 1 can
                        // go in the cart, not 2) — `.total` is the physical
                        // count of the type and was the wrong field to cap
                        // against; that let a guest add a unit the resort
                        // didn't actually have free, caught only when
                        // reserve() hit the real availability check on the
                        // server. Unlimited (tent pitching) and "no schedule
                        // picked yet" (availability still null) both leave the
                        // + button enabled; there's simply no ceiling to check yet.
                        const ownRemaining = unlimited || availability == null ? null : availability.available - qty
                        const atOwnMax = ownRemaining != null && ownRemaining <= 0

                        // The pool-wide check on top of the per-card one above:
                        // how many of the shared slots are left once every pool
                        // member's cart quantity — not just this card's — is
                        // taken out of the raw pool count.
                        const poolId = unlimited ? null : findAccommodationType(item.id)?.poolId
                        const poolRemaining =
                            poolId && availability?.poolAvailable != null
                                ? availability.poolAvailable - (poolCartTotals[poolId] ?? 0)
                                : null
                        const atPoolMax = poolRemaining != null && poolRemaining <= 0
                        const canAdd = !isFullyBooked && !atOwnMax && !atPoolMax
                        // Nothing of THIS card is in the cart, but a sibling
                        // card (same pool) already claimed every slot left —
                        // greyed out so the guest doesn't try this one too and
                        // only find out it's gone at checkout.
                        const poolLocked = !isFullyBooked && qty === 0 && atPoolMax

                        return (
                            <div
                                className={`accomodation-card ${qty > 0 ? 'selected' : ''} ${isFullyBooked ? 'fully-booked' : ''} ${poolLocked ? 'pool-locked' : ''}`}
                                key={item.id}
                            >
                                {qty > 0 && (
                                    <span className="accomodation-card-circle" aria-hidden="true">{qty}</span>
                                )}
                                <div className="accomodation-card-image">
                                    {item.image
                                        ? <SkeletonImage src={item.image} alt={item.name} loading="lazy" decoding="async" />
                                        : <span className="accomodation-card-noimage">No image</span>}
                                    {/* On the photo rather than down in the
                                        price line, because the carousel is
                                        scrolled past sideways — a guest should
                                        be able to spot which units are on promo
                                        without stopping to read each card. */}
                                    {promoSaving != null && (
                                        <span className="accomodation-card-promo-flag">Promo</span>
                                    )}
                                </div>
                                <div className="accomodation-card-info">
                                    <span className="accomodation-card-name">{item.name}</span>
                                    <span className="accomodation-card-pax">{item.pax}</span>
                                    {/* With a promo on, the standing rate is
                                        shown struck through before the price
                                        being charged — the discount is only
                                        legible next to what it came down from.
                                        `item.price` is already the promo one;
                                        `originalPrice` is null the rest of the
                                        time, which is the plain single price. */}
                                    <span className="accomodation-card-price">
                                        {item.price ? (
                                            item.originalPrice ? (
                                                <>
                                                    <s className="accomodation-card-price-was">
                                                        ₱{item.originalPrice}
                                                    </s>
                                                    <span className="accomodation-card-price-now">
                                                        ₱{item.price}
                                                    </span>
                                                </>
                                            ) : (
                                                `₱${item.price}`
                                            )
                                        ) : (rateGroup ? 'Price TBA' : 'Choose schedule')}
                                    </span>
                                    {/* The strike-through says the price moved;
                                        this says by how much, which is the part
                                        a guest is actually deciding on. Only
                                        shown when there IS a saving, so it can
                                        never read "save ₱0". */}
                                    {promoSaving > 0 && (
                                        <span className="accomodation-card-promo-hint">
                                            Save ₱{(promoSaving * stayNights).toLocaleString('en-PH')} today
                                        </span>
                                    )}
                                    {/* The card price is per night. On a longer
                                        stay that is not the number the guest is
                                        deciding on, so the stay total goes right
                                        under it rather than only in the summary
                                        panel further down the page. */}
                                    {isExtended && item.price != null && (
                                        <span className="accomodation-card-nights">
                                            ×&nbsp;{stayNights} nights ={' '}
                                            <strong>₱{(item.price * stayNights).toLocaleString('en-PH')}</strong>
                                        </span>
                                    )}
                                    <span className={`accomodation-card-available ${unlimited || (availability && availability.available > 0 && !poolLocked) ? 'is-available' : ''}`}>
                                        {unlimited
                                            ? 'Available'
                                            : availability === null
                                                ? 'Availability TBA'
                                                : isFullyBooked
                                                    ? (
                                                        <FullyBookedLabel
                                                            typeId={item.id}
                                                            checkIn={stayStart}
                                                            checkOut={stayEnd}
                                                            scheduleKey={scheduleKey}
                                                            fallback={`Fully booked${nextAvailable ? ` · free ${formatShortDate(nextAvailable)}` : ''}`}
                                                        />
                                                    )
                                                    : poolLocked
                                                        ? 'Taken by your other pick'
                                                        : poolId
                                                            // The three tent cards share one physical pool, so
                                                            // "3 of 3 available" on this card alone doesn't say
                                                            // there's really only 1 patch of ground left once the
                                                            // other two tent cards are counted in — this is that
                                                            // shared number, the same across all three tent cards,
                                                            // and it drops as soon as any of them lands in the cart.
                                                            ? `${availability.available} of ${availability.total} available · ${Math.max(0, poolRemaining ?? availability.poolAvailable ?? 0)} slot${Math.max(0, poolRemaining ?? availability.poolAvailable ?? 0) === 1 ? '' : 's'} left`
                                                            : `${availability.available} of ${availability.total} available`}
                                    </span>
                                </div>
                                <div className="accomodation-card-qty">
                                    {rentAllMode ? (
                                        // No +/- here — renting the whole resort is a
                                        // single fixed pick, not a quantity a guest can
                                        // dial up or down. booking.jsx's effect is what
                                        // keeps this card at qty 1 in the cart.
                                        <span className="accomodation-card-qty-locked" aria-live="polite">
                                            {qty > 0 ? 'Selected — whole resort' : 'Selecting the whole resort…'}
                                        </span>
                                    ) : (
                                    <>
                                    <button
                                        type="button"
                                        className="accomodation-card-qty-step"
                                        aria-label={`Remove one ${item.name}`}
                                        onClick={() => onQtyChange?.(item.id, qty - 1)}
                                        disabled={qty <= 0}
                                    >
                                        &minus;
                                    </button>
                                    <span className="accomodation-card-qty-count" aria-live="polite">
                                        {qty} {qty === 1 ? 'unit' : 'units'}
                                    </span>
                                    <button
                                        type="button"
                                        className="accomodation-card-qty-step"
                                        aria-label={`Add one ${item.name}`}
                                        onClick={() => onQtyChange?.(item.id, qty + 1)}
                                        disabled={!canAdd}
                                    >
                                        +
                                    </button>
                                    </>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <button
                    type="button"
                    className="carousel-arrow"
                    aria-label="Next accomodation"
                    onClick={() => scrollByCard(1)}
                >
                    &#8250;
                </button>
            </div>
        </div>
    )
}
