import { useEffect, useRef, useState } from 'react'
import { readHoldConflict } from '../../data/bookingQueue.js'
import { serverNow, invalidateAvailability } from '../../data/accommodationDB.js'

// A fully-booked card's "why", for a guest who is only browsing — not the one
// who tried to book and got refused (that's holdQueueNotice.jsx). Is the
// blocker a live, unpaid ten-minute hold (worth a countdown, since it usually
// clears in minutes) or a real booking (worth nothing)? hold_conflict() is
// the exact same anon-safe, aggregate read the booking form already makes the
// moment book_accommodation() refuses a booking — see readHoldConflict() in
// bookingQueue.js. This hook just asks it proactively, on a card the guest
// hasn't tried to book yet, instead of only after a refusal.
//
// Two clocks, same split as useBookingQueue.js: a POLL that is the real
// conversation with the database, and a per-second TICK that only redraws the
// number between polls. Nothing here decides anything or holds a place in
// line — it is read-only the whole way down.
//
// Lives in its own module, not bundled into accomodationList.jsx, for the same
// reason usePaymentWindow.js and useBookingQueue.js do: a file exporting both
// a hook and a component opts out of Vite's fast refresh.

// How often to re-ask hold_conflict() for a card that's showing as fully
// booked. Matches AVAILABILITY_TTL_MS (accommodationDB.js) — the same
// "good enough, not real-time" freshness every other anonymous-guest number on
// this page already runs on; guests get polling instead of Realtime by design
// (see that file's header on why).
const POLL_MS = 30000
const TICK_MS = 1000

export function useHoldCountdown({ typeId, checkIn, checkOut = null, scheduleKey = null }) {
    const [conflict, setConflict] = useState(null)
    const [msLeft, setMsLeft] = useState(0)
    // Read by the tick effect below to fire one poll early, without the two
    // effects needing to share a single combined one.
    const checkRef = useRef(null)

    useEffect(() => {
        // Nothing to poll. The stale reading (if any) is left in state rather
        // than cleared — same call as usePaymentWindow.js's `!tracked` branch:
        // this hook is only ever mounted by FullyBookedLabel while the card is
        // actually fully booked, so typeId/checkIn going missing mid-life is a
        // defensive case, not the normal path, and nothing reads `conflict`
        // once the component holding it has unmounted anyway.
        if (!typeId || !checkIn) return

        let cancelled = false
        const check = async () => {
            const result = await readHoldConflict({ typeId, checkIn, checkOut, scheduleKey })
            if (cancelled) return
            setConflict(result)
            // A poll landing after the hold has already lapsed is the same
            // signal pollQueue() acts on: the count the carousel is showing
            // was taken before that happened.
            if (result?.freeUnits > 0) invalidateAvailability()
        }
        checkRef.current = check

        check()
        const timer = setInterval(check, POLL_MS)
        return () => {
            cancelled = true
            clearInterval(timer)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the values' identity below, not the Date objects' references
    }, [typeId, checkIn?.getTime?.(), checkOut?.getTime?.(), scheduleKey])

    const releasesAt = conflict?.isHeld ? conflict.releasesAt : null

    useEffect(() => {
        if (releasesAt == null) return

        // Fired once per releasesAt, not once per tick — a card left open past
        // the deadline must not hammer the database every second while it
        // waits for the next scheduled poll.
        let firedEarly = false
        const tick = () => {
            const left = Math.max(0, releasesAt - serverNow())
            setMsLeft(left)
            if (left > 0 || firedEarly) return
            firedEarly = true
            checkRef.current?.()
        }
        // Immediately as well as on the interval: the first tick is a second
        // away, and a card that just became held should not spend that second
        // showing zero.
        tick()
        const timer = setInterval(tick, TICK_MS)
        return () => clearInterval(timer)
    }, [releasesAt])

    return {
        isHeld: Boolean(conflict?.isHeld),
        // Zero while nothing is held (a real booking, or no answer yet) —
        // there is no deadline to count down to either way.
        msLeft: releasesAt == null ? 0 : msLeft,
    }
}
