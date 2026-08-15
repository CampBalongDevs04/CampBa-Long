import { useEffect, useState } from 'react'
import { getAddonStockStatus } from '../../data/menuDB.js'

// Live remaining stock for ONE add-on item, for the guest's currently
// selected stay window. Only meaningful for an item with a stock ceiling —
// AddonPicker mounts this hook (via a small subcomponent, same reason
// FullyBookedLabel is its own component in accomodationList.jsx) only for
// items that actually have one, so an unlimited add-on costs nothing extra.
//
// Polls rather than subscribes, same reason every other guest-facing
// availability number in this app does (see accommodationDB.js's header):
// an anonymous guest gets no Realtime on `bookings`/`booking_groups`, since
// that would mean telling them about other guests' reservations.
//
// Lives in its own module, not addonPicker.jsx, for the same Fast Refresh
// reason usePaymentWindow.js/useBookingQueue.js do: a file exporting both a
// hook and a component opts out of it.

const POLL_MS = 30000

export function useAddonStock({ itemId, checkIn, checkOut, scheduleKey }) {
    const [status, setStatus] = useState(null)

    useEffect(() => {
        // Nothing to poll — left as whatever it last was rather than reset,
        // the same call usePaymentWindow.js makes for its own "nothing to
        // track" branch: nothing renders a stale reading once the component
        // that would have shown it isn't mounted for this item anymore.
        if (!itemId || !checkIn) return

        let cancelled = false
        const check = async () => {
            const result = await getAddonStockStatus({ itemId, checkIn, checkOut, scheduleKey })
            if (!cancelled) setStatus(result)
        }

        check()
        const timer = setInterval(check, POLL_MS)
        return () => {
            cancelled = true
            clearInterval(timer)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the values' identity below, not the Date objects' references
    }, [itemId, checkIn?.getTime?.(), checkOut?.getTime?.(), scheduleKey])

    // { stockTotal, claimed, available } | null (no limit, or no answer yet)
    return status
}
