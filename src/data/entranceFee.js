// Entrance fee is charged per head, at a rate set by the stay schedule
// (₱150 Day Time, ₱350 overnight — see timeOptions in timeSelector.jsx).
// Seniors and kids are a SUBSET of the total guest count (pax), not extra
// heads, so `pax` is the whole party and every head in it starts out charged:
//   • Regular guests pay the full rate.
//   • Senior citizens are charged the full rate HERE — their discount is
//     given at the resort, not by this system. See SENIOR_DISCOUNT_RATE.
//   • Kids 7 & below are exempt — always free, regardless of the perk below.
//   • The rate card also waives entrance for up to 2 pax per booking ("free
//     entrance for 2 pax"), on units where that inclusion applies — see
//     FREE_ENTRANCE_EXCLUDED_UNITS in data/accomodationOptions.js.
//
// A party of 4 with one kid on the Day rate is therefore 4 × ₱150 = ₱600, less
// the kid's ₱150 → ₱450 (before the 2-pax perk further reduces it below).
// THE SYSTEM NO LONGER APPLIES A SENIOR DISCOUNT.
// -----------------------------------------------
// The resort gives it at the front desk instead, against the ID the guest
// presents on arrival — so quoting a discounted figure online would promise a
// reduction this system is not the one making, and would double it if the desk
// then applied its own. Zero here means the booking is quoted and stored at the
// full rate, and the discount happens once, in person, off the remaining
// balance.
//
// SENIORS ARE STILL COUNTED. `seniors` stays on the booking, on the receipt and
// in the admin list — the desk cannot give a discount it cannot see, so the
// count is exactly the part that still has to travel end to end. Only the
// arithmetic went away.
//
// The rate is kept as a constant rather than deleted so the whole path stays
// intact and correct: set it back to 0.2 and every screen resumes showing and
// charging a discount, with no other edit. It also keeps historical bookings
// honest — rows written while a discount WAS applied still carry their own
// entrance_senior_discount, and every screen reads that stored figure rather
// than recomputing from this constant.
export const SENIOR_DISCOUNT_RATE = 0

// True when the system itself takes something off for seniors. Screens use this
// to decide between "20% off" and "claimed at the resort" rather than testing
// the number themselves, so the copy and the arithmetic cannot disagree.
export const SENIOR_DISCOUNT_IN_SYSTEM = SENIOR_DISCOUNT_RATE > 0

// The rate as a percentage, for anything that shows it to a guest.
//
// It used to be typed out as "10%" in six different screens, which is how a
// change to the rate turns into a hunt through the codebase — and how one
// screen ends up quoting a discount the arithmetic no longer gives. Every
// label reads this instead, so the number and the words about it move together
// by construction.
export const SENIOR_DISCOUNT_LABEL = `${Math.round(SENIOR_DISCOUNT_RATE * 100)}%`

// ON "FREE ENTRANCE FOR 2 PAX"
// -----------------------------
// This perk used to be advertised in INCLUSIONS and subtracted here ON TOP OF
// the kids' exemption — 2 extra free heads regardless of how many kids were
// already free — so a party of 4 with one child was charged for a single head
// (₱150) where ₱450 was owed. It was removed rather than fixed at the time.
//
// It's back, implemented so it can't stack with the kids' exemption: kids are
// already free on their own, so the 2-pax quota is only ever handed to
// non-kid heads (regular first, since that's the bigger saving, then seniors
// if the party has fewer than 2 non-kid heads). A senior head that gets the
// perk is fully waived instead of just getting the senior discount, so it's
// dropped from the senior count before the discount is calculated — otherwise
// that head would be discounted twice.
//
// `freeApplied` / `freeSavings` are the combined "free entrance" bucket the
// receipt, My Bookings and the admin export have always read (kids + the
// perk, matching what's stored in entrance_free_applied/entrance_free_savings).
// `kidsFree`/`kidsCount` and `perkApplied`/`perkSavings` are the two components
// of that bucket, for screens that want to show them as separate line items.
//
// Returns a full entrance-fee breakdown. `paxTotal` is every head at the full
// rate and the deductions come off it, so a screen can list the charges and
// have them add up to `total`. `perHead` is the schedule's rate (0 when no
// schedule is chosen yet), so callers can render partial totals.
export function computeEntranceFee({
    perHead = 0, pax = 0, seniors = 0, kids = 0, freeEntranceEligible = true,
} = {}){
    const rate = Number(perHead) || 0
    const totalPax = Math.max(0, Number(pax) || 0)
    // Both are counted WITHIN the party, so neither can exceed it — a clamp in
    // case the counters are momentarily inconsistent (pax lowered last).
    const seniorCount = Math.min(Math.max(0, Number(seniors) || 0), totalPax)
    const kidsCount = Math.min(Math.max(0, Number(kids) || 0), totalPax - seniorCount)

    // Regular (full-fare) guests are whoever's left after seniors and kids.
    const regularCount = Math.max(0, totalPax - seniorCount - kidsCount)

    // Up to 2 non-kid heads ride free. Regular heads are freed before senior
    // heads, and the senior heads that do get freed come out of seniorCount
    // below so they aren't also discounted. With SENIOR_DISCOUNT_RATE at 0 the
    // two kinds of head cost the same and the ordering changes no money — it is
    // kept because it is the correct order the moment a discount comes back.
    const perkApplied = freeEntranceEligible ? Math.min(2, regularCount + seniorCount) : 0
    const perkFromRegular = Math.min(perkApplied, regularCount)
    const perkFromSenior = perkApplied - perkFromRegular
    const payingSeniorCount = seniorCount - perkFromSenior

    // Every head at the full rate, then everything that comes off it.
    const paxTotal = totalPax * rate
    const kidsFree = kidsCount * rate
    const perkSavings = perkApplied * rate
    const seniorGross = payingSeniorCount * rate
    const seniorDiscount = seniorGross * SENIOR_DISCOUNT_RATE

    const total = Math.max(0, paxTotal - kidsFree - perkSavings - seniorDiscount)

    return {
        perHead: rate,
        paxCount: totalPax,
        paxTotal,
        regularCount,
        regularTotal: (regularCount - perkFromRegular) * rate,
        // Only the still-paying seniors — the ones the discount below
        // actually applies to.
        seniorCount: payingSeniorCount,
        seniorGross,
        seniorDiscount,
        seniorNet: seniorGross - seniorDiscount,
        kidsCount,
        kidsFree,
        perkApplied,
        perkSavings,
        // Combined free-entrance bucket: kids + the 2-pax perk.
        freeApplied: kidsCount + perkApplied,
        freeSavings: kidsFree + perkSavings,
        payingHeads: totalPax - kidsCount - perkApplied,
        total,
    }
}

// Historical bookings only ever had the combined freeApplied/freeSavings
// bucket stored (see above), not the kids/perk split. `kids` is its own
// column on the booking row and is always the kids' share, so whatever is
// left in the combined bucket is the perk's share — this recovers the split
// for screens (My Bookings, the receipt image) reading a saved booking back.
export function splitFreeEntrance({ freeApplied = 0, freeSavings = 0, kids = 0, perHead = 0 } = {}){
    const kidsApplied = Math.min(Math.max(0, Number(kids) || 0), Number(freeApplied) || 0)
    const kidsFree = kidsApplied * (Number(perHead) || 0)
    return {
        kidsApplied,
        kidsFree,
        perkApplied: Math.max(0, (Number(freeApplied) || 0) - kidsApplied),
        perkSavings: Math.max(0, (Number(freeSavings) || 0) - kidsFree),
    }
}
