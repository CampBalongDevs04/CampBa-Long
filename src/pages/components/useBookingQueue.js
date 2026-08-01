import { useCallback, useEffect, useRef, useState } from 'react'
import { QUEUE_POLL_MS, joinQueue, leaveQueue, pollQueue } from '../../data/bookingQueue.js'
import { serverNow } from '../../data/accommodationDB.js'

// The waiting half of the booking form: hold a place in line for a unit that is
// currently under somebody else's ten-minute hold, and reserve it automatically
// the moment that hold lapses.
//
// Two clocks, deliberately separate:
//
//   • the POLL, every few seconds, which is the real conversation with the
//     database — it reports the guest's place, proves this tab is still open,
//     and moves the whole line along for everybody;
//   • the TICK, every second, which only redraws a countdown between polls so
//     the number moves like a clock instead of jumping in five-second steps.
//
// Nothing here decides anything. Being `ready` is Postgres's judgement, and the
// retry it triggers goes through book_accommodation() like any other booking —
// a guest who fakes `ready` in devtools gets the same refusal they had before.
//
// Lives in its own module because a file exporting both a hook and a component
// opts out of Vite's fast refresh.

const TICK_MS = 1000

export function useBookingQueue(request, { onReady } = {}) {
    // The answer is stored WITH the request it answers, so a guest who leaves
    // one line and joins another never sees the old line's place number in the
    // render between the two. Clearing it from an effect would be a cascading
    // render for a value that can simply be derived.
    const [line, setLine] = useState({ request: null, entry: null, error: null })
    const [msLeft, setMsLeft] = useState(0)

    // Kept in a ref so a new callback identity on every render of the booking
    // page does not tear down and rebuild the poll — which would drop the
    // guest's place in line and put them at the back of it. Assigned from an
    // effect rather than during render: refs are not render-time state.
    const onReadyRef = useRef(onReady)
    useEffect(() => {
        onReadyRef.current = onReady
    })

    // The entry id, for the leave-on-unmount below. State would be a render
    // behind at exactly the moment the cleanup needs it.
    const entryIdRef = useRef(null)

    // ------------------------------------------------------------ the poll
    useEffect(() => {
        if (!request) return

        let cancelled = false
        let timer = null
        // The retry fires once per promotion, not once per poll: a guest whose
        // turn came up while the booking round-trip is still in flight must not
        // have a second one started underneath it.
        let claimed = false

        const check = async () => {
            const result = entryIdRef.current
                ? await pollQueue(entryIdRef.current)
                : await joinQueue(request)

            if (cancelled) return

            if (!result.ok) {
                // A failed poll is not a failed queue — the entry survives on
                // the server for ninety seconds without one. Say so and keep
                // trying rather than throwing the guest out over one timeout.
                setLine((current) => ({ ...current, request, error: result.message }))
                return
            }

            entryIdRef.current = result.entry?.id ?? entryIdRef.current
            setLine({ request, entry: result.entry, error: null })

            if (result.entry?.ready && !claimed) {
                // Marked spent only if the attempt actually started. A caller
                // that was already booking says so by returning false, and the
                // next poll offers the turn again rather than leaving the guest
                // `ready` with nothing running until their claim lapses.
                claimed = (await onReadyRef.current?.()) !== false
            }
            // Lost the claim without booking (the tab was asleep through it).
            // Re-arm, because the entry can be promoted a second time.
            if (!result.entry?.ready) claimed = false
        }

        check()
        timer = setInterval(check, QUEUE_POLL_MS)

        return () => {
            cancelled = true
            clearInterval(timer)
            // Leaving on unmount is a courtesy to whoever is behind: it moves
            // them up now instead of when the heartbeat runs out. Harmless if
            // the entry was already booked — the server only touches a place
            // that is still waiting.
            if (entryIdRef.current) {
                leaveQueue(entryIdRef.current)
                entryIdRef.current = null
            }
        }
    }, [request])

    // Only ever this request's own answer. A stale entry from a line the guest
    // has already left is dropped here rather than cleared from an effect.
    const entry = line.request === request ? line.entry : null
    const error = line.request === request ? line.error : null

    // ------------------------------------------------------------ the tick
    const retryAt = entry?.retryAt ?? null

    useEffect(() => {
        if (retryAt == null) return
        const tick = () => setMsLeft(Math.max(0, retryAt - serverNow()))
        // Immediately as well as on the interval: the first tick is a second
        // away, and a panel that has just mounted should not spend that second
        // showing a countdown left over from the last one.
        tick()
        const timer = setInterval(tick, TICK_MS)
        return () => clearInterval(timer)
    }, [retryAt])

    // Give up on purpose, as opposed to closing the tab.
    const leave = useCallback(async () => {
        const id = entryIdRef.current
        entryIdRef.current = null
        if (id) await leaveQueue(id)
    }, [])

    return {
        entry,
        error,
        // Counting down to the moment we try again. Zero while ready, and zero
        // when there is no release time to count to (nothing is held — the
        // units are genuinely booked, and the poll is just watching for a
        // cancellation).
        msLeft: retryAt == null ? 0 : msLeft,
        waiting: entry?.status === 'waiting',
        ready: Boolean(entry?.ready),
        // Stopped polling for too long, or let the exclusive claim lapse. The
        // place is gone; the guest can take a new one at the back.
        expired: entry?.status === 'expired',
        leave,
    }
}
