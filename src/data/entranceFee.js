// Entrance fee is charged per head, at a rate set by the stay schedule
// (₱150 Day Time, ₱350 overnight — see timeOptions in timeSelector.jsx).
// Seniors and kids are a SUBSET of the total guest count (pax), not extra
// heads, so `pax` is the whole party and every head in it starts out charged:
//   • Regular guests pay the full rate.
//   • Senior citizens pay the rate minus a 10% discount (ID required on-site).
//   • Kids 7 & below are exempt — the only heads that get in free.
//
// A party of 4 with one kid on the Day rate is therefore 4 × ₱150 = ₱600, less
// the kid's ₱150 → ₱450.
export const SENIOR_DISCOUNT_RATE = 0.1

// ON THE OLD "FREE ENTRANCE FOR 2 PAX"
// ------------------------------------
// There is no such perk any more. It was advertised in INCLUSIONS and subtracted
// here, on top of the kids' exemption, so a party of 4 with one child was
// charged for a single head — ₱150 where ₱450 was owed. Both are gone: entrance
// is charged for every guest, and the only free heads are the kids, which is
// what `freeApplied` / `freeSavings` report. Those two are what the receipt, My
// Bookings and the admin export print as "free entrance".
//
// Returns a full entrance-fee breakdown. `paxTotal` is every head at the full
// rate and the deductions come off it, so a screen can list the charges and
// have them add up to `total`. `perHead` is the schedule's rate (0 when no
// schedule is chosen yet), so callers can render partial totals.
export function computeEntranceFee({ perHead = 0, pax = 0, seniors = 0, kids = 0 } = {}){
    const rate = Number(perHead) || 0
    const totalPax = Math.max(0, Number(pax) || 0)
    // Both are counted WITHIN the party, so neither can exceed it — a clamp in
    // case the counters are momentarily inconsistent (pax lowered last).
    const seniorCount = Math.min(Math.max(0, Number(seniors) || 0), totalPax)
    const kidsCount = Math.min(Math.max(0, Number(kids) || 0), totalPax - seniorCount)

    // Regular (full-fare) guests are whoever's left after seniors and kids.
    const regularCount = Math.max(0, totalPax - seniorCount - kidsCount)

    // Every head at the full rate, then the two things that come off it.
    const paxTotal = totalPax * rate
    const kidsFree = kidsCount * rate
    const seniorGross = seniorCount * rate
    const seniorDiscount = seniorGross * SENIOR_DISCOUNT_RATE

    const total = Math.max(0, paxTotal - kidsFree - seniorDiscount)

    return {
        perHead: rate,
        paxCount: totalPax,
        paxTotal,
        regularCount,
        regularTotal: regularCount * rate,
        seniorCount,
        seniorGross,
        seniorDiscount,
        seniorNet: seniorGross - seniorDiscount,
        kidsCount,
        // The heads that get in free are the kids, and nothing else.
        freeApplied: kidsCount,
        freeSavings: kidsFree,
        payingHeads: totalPax - kidsCount,
        total,
    }
}
