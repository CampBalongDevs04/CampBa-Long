// Entrance fee is charged per head, at a rate set by the stay schedule
// (₱150 Day Time, ₱350 overnight — see timeOptions in timeSelector.jsx).
// Seniors and kids are a SUBSET of the total guest count (pax), not extra
// heads. So of `pax` total guests:
//   • Regular guests = pax − seniors − kids → pay the full rate.
//   • Senior citizens pay the rate minus a 10% discount (ID required on-site).
//   • Kids 7 & below are exempt (free).
export const SENIOR_DISCOUNT_RATE = 0.1

// Returns a full entrance-fee breakdown. `perHead` is the schedule's rate
// (0 when no schedule is chosen yet), so callers can render partial totals.
export function computeEntranceFee({ perHead = 0, pax = 0, seniors = 0, kids = 0 } = {}){
    const rate = Number(perHead) || 0
    const totalPax = Number(pax) || 0
    const seniorCount = Number(seniors) || 0
    const kidsCount = Number(kids) || 0

    // Regular (full-fare) guests are whoever's left after seniors and kids.
    // Clamp at 0 in case the counts are momentarily inconsistent.
    const regularCount = Math.max(0, totalPax - seniorCount - kidsCount)

    const regularTotal = regularCount * rate
    const seniorGross = seniorCount * rate
    const seniorDiscount = seniorGross * SENIOR_DISCOUNT_RATE
    const seniorNet = seniorGross - seniorDiscount
    const total = regularTotal + seniorNet

    return {
        perHead: rate,
        regularCount,
        regularTotal,
        seniorCount,
        seniorGross,
        seniorDiscount,
        seniorNet,
        kidsCount,
        payingHeads: regularCount + seniorCount,
        total,
    }
}
