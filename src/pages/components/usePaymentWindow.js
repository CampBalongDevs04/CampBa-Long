import { useEffect, useState } from 'react'
import {
    PAYMENT_WINDOW_MINUTES,
    expireStaleBookings,
    isPaymentWindowTracked,
    paymentMsRemaining,
    serverNow,
} from '../../data/accommodationDB.js'

// The countdown behind the payment panel: how long this booking has left to be
// paid for before the resort takes the unit back.
//
// It ticks a number and, once, tells the database the time is up. It does not
// decide anything — the deadline came from Postgres, the cancellation is
// Postgres's to make, and a browser that never runs this hook (tab closed,
// phone asleep) changes nothing about when the unit is released. That is why
// the sweep here is a nudge rather than a request: it makes the guest's own
// card go from "2:14 left" to "cancelled" while they are looking at it, instead
// of leaving them staring at a timer that reached zero and did nothing.
//
// Lives in its own module because a file that exports both a component and a
// hook opts out of Vite's fast refresh.

// Every deadline in the app is a moment, so the tick only has to be frequent
// enough to look like a clock. One second is that; anything faster is
// re-rendering a card sixty times to move a digit once.
const TICK_MS = 1000

export function usePaymentWindow(booking) {
    const tracked = isPaymentWindowTracked(booking)
    const dueAt = booking?.paymentDueAt ?? null

    // Seeded rather than started at zero: a card mounting on a booking made
    // eight minutes ago must show 2:00, not count down from ten.
    const [msLeft, setMsLeft] = useState(() => paymentMsRemaining(booking))

    useEffect(() => {
        // Nothing to count. The stale reading is left in state rather than
        // cleared, because every consumer reads it through `tracked` below and
        // resetting it here would be a render for a number nobody looks at.
        if (!tracked) return

        // The sweep is fired once per expiry, not once per tick. A tab left
        // open on a lapsed booking would otherwise call it every second
        // forever, and the answer would be the same every time.
        let swept = false
        let timer = null

        const tick = () => {
            const left = Math.max(0, dueAt - serverNow())
            setMsLeft(left)
            if (left > 0 || swept) return
            swept = true
            clearInterval(timer)
            expireStaleBookings()
        }

        // Immediately as well as on the interval: the first tick is a second
        // away, and a booking that expired while the tab was in the background
        // should not spend that second still offering to take a payment.
        tick()
        timer = setInterval(tick, TICK_MS)
        return () => clearInterval(timer)
    }, [tracked, dueAt])

    return {
        // Whether there is a clock on this booking at all. False once a receipt
        // is in — a top-up for later add-ons is never timed.
        tracked,
        msLeft: tracked ? msLeft : 0,
        // Ran out, but the cancellation has not come back from the database
        // yet. The panel stops taking payments here rather than waiting for the
        // row to change, so the last thing the guest can do is not upload a
        // receipt that will be refused.
        expired: tracked && msLeft <= 0,
        totalMs: PAYMENT_WINDOW_MINUTES * 60 * 1000,
        windowMinutes: PAYMENT_WINDOW_MINUTES,
    }
}

// 'm:ss', the shape a countdown is read in. Rounded UP, so the last second is
// shown as 0:01 for its whole length and the timer never sits on 0:00 while
// there is still time to pay.
export function formatCountdown(ms) {
    const totalSeconds = Math.ceil(Math.max(0, ms) / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
}
