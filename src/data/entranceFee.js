// Entrance fee is charged per head, at a rate set by the stay schedule
// (₱150 Day Time, ₱350 overnight — see timeOptions in timeSelector.jsx).
// Seniors and kids are a SUBSET of the total guest count (pax), not extra
// heads. So of `pax` total guests:
//   • Regular guests = pax − seniors − kids → pay the full rate.
//   • Senior citizens pay the rate minus a 10% discount (ID required on-site).
//   • Kids 7 & below are exempt (free).
export const SENIOR_DISCOUNT_RATE = 0.1

// Most units also waive entrance for the first couple of guests (see
// FREE_ENTRANCE_PAX / freeEntranceExempt in accomodationOptions.js). Kids are
// already free, so the free headcount is spent on regular guests first, then
// any leftover on seniors — never "wasted" on heads that don't pay anyway.
//
// Returns a full entrance-fee breakdown. `perHead` is the schedule's rate
// (0 when no schedule is chosen yet), so callers can render partial totals.
export function computeEntranceFee({ perHead = 0, pax = 0, seniors = 0, kids = 0, freeEntrance = 0 } = {}){
    const rate = Number(perHead) || 0
    const totalPax = Number(pax) || 0
    const seniorCount = Number(seniors) || 0
    const kidsCount = Number(kids) || 0
    const freeCount = Math.max(0, Number(freeEntrance) || 0)

    // Regular (full-fare) guests are whoever's left after seniors and kids.
    // Clamp at 0 in case the counts are momentarily inconsistent.
    const regularCount = Math.max(0, totalPax - seniorCount - kidsCount)

    const freeRegular = Math.min(regularCount, freeCount)
    const freeSenior = Math.min(seniorCount, freeCount - freeRegular)
    const payingRegularCount = regularCount - freeRegular
    const payingSeniorCount = seniorCount - freeSenior

    const regularTotal = payingRegularCount * rate
    const seniorGross = payingSeniorCount * rate
    const seniorDiscount = seniorGross * SENIOR_DISCOUNT_RATE
    const seniorNet = seniorGross - seniorDiscount
    const total = regularTotal + seniorNet

    const freeApplied = freeRegular + freeSenior
    const freeSavings = freeRegular * rate + freeSenior * rate * (1 - SENIOR_DISCOUNT_RATE)

    return {
        perHead: rate,
        regularCount: payingRegularCount,
        regularTotal,
        seniorCount: payingSeniorCount,
        seniorGross,
        seniorDiscount,
        seniorNet,
        kidsCount,
        freeApplied,
        freeSavings,
        payingHeads: payingRegularCount + payingSeniorCount,
        total,
    }
}
