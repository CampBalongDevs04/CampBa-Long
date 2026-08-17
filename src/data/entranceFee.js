// Entrance fee is charged per head, at a rate set by the stay schedule
// (₱150 Day Time, ₱350 overnight — see timeOptions in timeSelector.jsx).
// Seniors and kids are a SUBSET of the total guest count (pax), not extra
// heads, so `pax` is the whole party and every head in it starts out charged:
//   • Regular guests pay the full rate.
//   • Senior citizens and kids 7 & below are BOTH charged the full rate HERE
//     — their discounts are given at the resort, not by this system. See
//     SENIOR_DISCOUNT_RATE / KIDS_DISCOUNT_RATE below.
//   • The rate card also waives entrance for up to 2 pax per booking ("free
//     entrance for 2 pax"), on units where that inclusion applies — see
//     FREE_ENTRANCE_EXCLUDED_UNITS in data/accomodationOptions.js. Kids do
//     NOT draw from this pool (see KIDS_DISCOUNT_RATE for why) — it is only
//     ever handed to regular or senior heads, same as before.
//
// A party of 4 with one kid on the Day rate is therefore 4 × ₱150 = ₱600
// (the 2-pax perk, if this booking qualifies for it, reduces it further below).
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

// PERSONS WITH DISABILITY
// -----------------------
// Same story as seniors, and deliberately the same three constants rather than
// a shared "special guest" abstraction: the two are separate entitlements with
// separate IDs, and the resort may well want one of them back in the system
// without the other. Zero here means a PWD head is charged the full entrance
// rate and the discount is given at the front desk against a PWD ID.
//
// `pwd` is carried on the booking, the receipt and the admin list for exactly
// the reason the senior count is — the desk cannot give a discount it cannot
// see. Nothing in computeEntranceFee() reads it, because at rate 0 a PWD head
// and a regular head cost the same; wire it in there the day the rate changes.
export const PWD_DISCOUNT_RATE = 0
export const PWD_DISCOUNT_IN_SYSTEM = PWD_DISCOUNT_RATE > 0
export const PWD_DISCOUNT_LABEL = `${Math.round(PWD_DISCOUNT_RATE * 100)}%`

// KIDS 7 & BELOW
// --------------
// Used to be an unconditional, always-on exemption computed here — every kid
// was simply free, full stop. Now the same three-constant shape as seniors
// and PWD above: zero here means a kid is charged the full entrance rate
// online and the discount is given at the front desk, same as the other two.
//
// Kids still do NOT draw from the 2-pax "resort inclusion" perk below —
// they're their own carved-out count in computeEntranceFee(), same as
// before, just no longer automatically zeroed out. Folding them into the
// perk's shared, capped pool instead would be a regression: a party of 1
// adult + 2 kids would go from "everyone free" (kids exempt outright, the
// adult using the 2-pax perk) to "only 2 of the 3 heads get it," which could
// land on the two kids and leave the paying adult with nothing.
//
// `kids` is still carried on the booking, the receipt and the admin list —
// the desk cannot give a discount it cannot see.
export const KIDS_DISCOUNT_RATE = 0
export const KIDS_DISCOUNT_IN_SYSTEM = KIDS_DISCOUNT_RATE > 0
export const KIDS_DISCOUNT_LABEL = `${Math.round(KIDS_DISCOUNT_RATE * 100)}%`

// ON "FREE ENTRANCE FOR 2 PAX" — AND RENT ALL RESORT'S OWN, BIGGER QUOTA
// ------------------------------------------------------------------------
// This perk used to be advertised in INCLUSIONS and subtracted here ON TOP OF
// the kids' exemption — 2 extra free heads regardless of how many kids were
// already free — so a party of 4 with one child was charged for a single head
// (₱150) where ₱450 was owed. It was removed rather than fixed at the time.
//
// Kids stay OUT of this pool, same as before — the quota is only ever handed
// to regular or senior heads (regular first, since that's the bigger saving,
// then seniors if the party has fewer non-kid heads than the quota). Folding
// kids into this shared, capped pool instead of leaving them purely
// rate-based (like seniors and PWD) would be a regression: a party of 1
// adult + 2 kids would go from "everyone free" (kids exempt outright, the
// adult using the 2-pax perk) to "only 2 of the 3 heads get it," which could
// land on the two kids and leave the paying adult with nothing. A senior head
// that gets the perk is fully waived instead of just getting the senior
// discount, so it's dropped from the senior count before the discount is
// calculated — otherwise that head would be discounted twice.
//
// The quota is 2 for an ordinary unit booking — the rate card's standing
// inclusion — but Rent All Resort has its own, bigger one: the rate card only
// waives entrance for the first RENT_ALL_FREE_ENTRANCE_PAX heads of a
// whole-resort booking, not the entire party regardless of size. Callers pass
// whichever quota applies via `freeQuota`; booking.jsx is what decides which
// one that is. The SQL twin, entrance_breakdown() in
// supabase/migrations/20260817120000_kids_discount_claimed_at_resort.sql,
// takes the same parameter — change one, change the other.
//
// `freeApplied` / `freeSavings` are the 2-pax perk ALONE now — what the
// receipt, My Bookings and the admin export read as entrance_free_applied/
// entrance_free_savings. Kids no longer contribute to this bucket (see
// KIDS_DISCOUNT_RATE above); a booking made before this change still has
// them folded in, since that row's total was genuinely computed that way at
// the time.
//
// Returns a full entrance-fee breakdown. `paxTotal` is every head at the full
// rate and the deductions come off it, so a screen can list the charges and
// have them add up to `total`. `perHead` is the schedule's rate (0 when no
// schedule is chosen yet), so callers can render partial totals.
export const DEFAULT_FREE_ENTRANCE_QUOTA = 2

// Rent All Resort's own free-entrance quota — bigger than the standing 2-pax
// unit inclusion because it covers a whole-resort party, not one unit's worth
// of guests. Anyone past this many heads still owes the schedule's per-head
// rate; the flat card price only ever covered getting everyone IN, not every
// head that shows up. See the module comment above for the SQL twin.
export const RENT_ALL_FREE_ENTRANCE_PAX = 20

export function computeEntranceFee({
    perHead = 0, pax = 0, seniors = 0, kids = 0, freeEntranceEligible = true,
    freeQuota = DEFAULT_FREE_ENTRANCE_QUOTA,
} = {}){
    const rate = Number(perHead) || 0
    const totalPax = Math.max(0, Number(pax) || 0)
    // Both are counted WITHIN the party, so neither can exceed it — a clamp in
    // case the counters are momentarily inconsistent (pax lowered last).
    const seniorCount = Math.min(Math.max(0, Number(seniors) || 0), totalPax)
    const kidsCount = Math.min(Math.max(0, Number(kids) || 0), totalPax - seniorCount)

    // Regular (full-fare) guests are whoever's left after seniors and kids.
    const regularCount = Math.max(0, totalPax - seniorCount - kidsCount)

    // Up to `freeQuota` non-kid heads ride free. Regular heads are freed
    // before senior heads, and the senior heads that do get freed come out of
    // seniorCount below so they aren't also discounted. With
    // SENIOR_DISCOUNT_RATE at 0 the two kinds of head cost the same and the
    // ordering changes no money — it is kept because it is the correct order
    // the moment a discount comes back.
    const quota = Math.max(0, Number(freeQuota) || 0)
    const perkApplied = freeEntranceEligible ? Math.min(quota, regularCount + seniorCount) : 0
    const perkFromRegular = Math.min(perkApplied, regularCount)
    const perkFromSenior = perkApplied - perkFromRegular
    const payingSeniorCount = seniorCount - perkFromSenior

    // Every head at the full rate, then everything that comes off it. Kids'
    // own discount sits beside the senior one — both zero today, both a
    // straight rate off the full charge rather than an unconditional waiver.
    const paxTotal = totalPax * rate
    const kidsGross = kidsCount * rate
    const kidsDiscount = kidsGross * KIDS_DISCOUNT_RATE
    const perkSavings = perkApplied * rate
    const seniorGross = payingSeniorCount * rate
    const seniorDiscount = seniorGross * SENIOR_DISCOUNT_RATE

    const total = Math.max(0, paxTotal - perkSavings - kidsDiscount - seniorDiscount)

    return {
        perHead: rate,
        paxCount: totalPax,
        paxTotal,
        regularCount,
        regularTotal: (regularCount - perkFromRegular) * rate,
        kidsCount,
        kidsGross,
        kidsDiscount,
        kidsNet: kidsGross - kidsDiscount,
        // Only the still-paying seniors — the ones the discount below
        // actually applies to.
        seniorCount: payingSeniorCount,
        seniorGross,
        seniorDiscount,
        seniorNet: seniorGross - seniorDiscount,
        perkApplied,
        perkSavings,
        // The 2-pax perk alone now — kids no longer contribute (see
        // KIDS_DISCOUNT_RATE above).
        freeApplied: perkApplied,
        freeSavings: perkSavings,
        payingHeads: totalPax - perkApplied,
        total,
    }
}

// Reads a STORED booking's freeApplied/freeSavings bucket back. A booking
// made before 20260817120000_kids_discount_claimed_at_resort.sql shipped had
// kids folded into that bucket alongside the 2-pax perk (see the migration's
// header) — this recovers that historical split correctly, `kids` being its
// own column on the row and always the kids' share, so whatever's left is
// the perk's share.
//
// A booking made after that migration never puts kids in the bucket at all —
// but this function has no way to tell an old row from a new one, so it
// still assumes kids-first. On a new-format row with kids > 0 AND a nonzero
// freeApplied (from the perk going to an adult or senior), it will
// mislabel some of that perk as the kids' share even though no kid actually
// drew from it. The row's own `total`/kids/perk figures are still correct
// either way — only this reconstructed label can be wrong, and only for
// bookings made after the migration above. Known, narrow, and not fixed here
// — see that migration's header for why.
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
