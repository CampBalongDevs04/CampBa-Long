-- ============================================================================
--  Camp Ba-long — Kids' entrance discount moves to "claimed at the resort"
-- ----------------------------------------------------------------------------
--  THE RULE THAT CHANGED
--  ----------------------
--  Kids 7 & below used to be unconditionally exempt from the entrance fee
--  ONLINE — entrance_breakdown() zeroed their share out of the total and
--  folded it into the free_applied/free_savings bucket alongside the 2-pax
--  (20 for Rent All) "resort inclusion" perk. Kids now get the exact same
--  treatment seniors and PWD guests already have: counted at the FULL rate
--  in the quoted/charged total, with the discount given in person at the
--  front desk instead of computed by this system. See the SENIOR_DISCOUNT_RATE
--  comment in src/data/entranceFee.js for why that pattern exists — kids now
--  follow it too, via the new c_kids_rate constant below (mirrored client-side
--  as KIDS_DISCOUNT_RATE in the same file).
--
--  KIDS STILL DO NOT COMPETE FOR THE 2-PAX PERK
--  ---------------------------------------------
--  This is the one thing that did NOT change, and matters: kids stay carved
--  out of v_regular, so they never draw from the standing "free entrance for
--  2 pax" (20 for Rent All) inclusion the way an adult or senior head does.
--  Folding kids into that shared, capped pool instead of keeping them purely
--  rate-based would have been a regression — a party of 1 adult + 2 kids
--  would go from "everyone free" (2 kids exempt outright + the adult using
--  the 2-pax perk) to "only 2 of the 3 heads get the perk," which could just
--  as easily land on the two kids and leave the paying adult with nothing.
--  Kids are still their own carved-out count, same as before; only the
--  automatic 100%-off treatment of that count is gone.
--
--  free_applied / free_savings NO LONGER INCLUDE KIDS
--  -----------------------------------------------------
--  That combined bucket is now the 2-pax perk alone. A booking made under the
--  OLD formula still has kids folded into its stored free_applied/
--  free_savings — those rows are historically accurate as written and are not
--  touched by this migration. Only bookings created from here on read
--  differently: kids show up on the row's own `kids` column (unchanged) but
--  no longer inside the free-entrance bucket. src/data/entranceFee.js's
--  splitFreeEntrance() (used to reconstruct the old kids/perk split for My
--  Bookings and the receipt image) is a known, narrow gap for bookings placed
--  after this ships — it can still slightly mislabel which heads a NEW
--  booking's free_applied count belongs to. The stored total/kids/perk
--  figures themselves are correct either way; only that one reconstructed
--  label is affected, and fixing it would mean threading a new "kids' own
--  discount" figure through storage and both history screens — out of scope
--  here on purpose.
--
--  NO NEW COLUMN FOR A KIDS DISCOUNT
--  ------------------------------------
--  Exactly like PWD today (see PWD_DISCOUNT_RATE in entranceFee.js — "nothing
--  in computeEntranceFee() reads it, because at rate 0 a PWD head and a
--  regular head cost the same"): at c_kids_rate = 0, a kid's discount is
--  always ₱0, so there is nothing worth a bookings.entrance_kids_discount
--  column for. entrance_breakdown()'s return shape is UNCHANGED (still 5
--  columns) — only the arithmetic inside changed — so book_accommodation()
--  and book_stay_group() need no edits at all; they already store whatever
--  this function returns under the same column names.
--
--  To drop: recreate entrance_breakdown() from
--  20260815150000_rent_all_free_entrance_quota.sql (the 7-argument version
--  with the old kids-are-always-free arithmetic). Same signature both ways,
--  so a plain CREATE OR REPLACE is enough — no drop/grant dance needed.
-- ============================================================================

create or replace function public.entrance_breakdown(
    p_per_head       numeric,
    p_pax            integer,
    p_kids           integer default 0,
    p_seniors        integer default 0,
    p_free_eligible  boolean default true,
    p_nights         integer default 1,
    p_free_quota     integer default 2
)
returns table (
    per_head        numeric,
    total           numeric,
    senior_discount numeric,
    free_applied    integer,
    free_savings    numeric
)
language plpgsql
immutable
set search_path = public
as $$
declare
    -- THE SYSTEM NO LONGER APPLIES A SENIOR, PWD, OR KIDS DISCOUNT. See this
    -- migration's header and the comment on SENIOR_DISCOUNT_RATE in
    -- src/data/entranceFee.js: set either constant back above 0 and the
    -- matching screens resume showing and charging a real discount, with no
    -- other edit needed.
    c_senior_rate constant numeric := 0;
    c_kids_rate   constant numeric := 0;

    v_rate      numeric := coalesce(p_per_head, 0);
    v_nights    integer := greatest(coalesce(p_nights, 1), 1);
    v_pax       integer := greatest(coalesce(p_pax, 0), 0);
    v_quota     integer := greatest(coalesce(p_free_quota, 2), 0);
    v_seniors   integer;
    v_kids      integer;
    v_regular   integer;
    v_perk      integer;
    v_perk_reg  integer;
    v_paying_sr integer;

    v_pax_total    numeric;
    v_kids_disc    numeric;
    v_perk_savings numeric;
    v_senior_disc  numeric;
    v_total        numeric;
begin
    -- Seniors and kids are both counted WITHIN the party, so neither can exceed
    -- it — clamped in case the counters are momentarily inconsistent.
    v_seniors := least(greatest(coalesce(p_seniors, 0), 0), v_pax);
    v_kids    := least(greatest(coalesce(p_kids, 0), 0), v_pax - v_seniors);
    v_regular := greatest(v_pax - v_seniors - v_kids, 0);

    -- Up to p_free_quota non-kid heads ride free (2 for an ordinary unit, 20
    -- for Rent All Resort). Kids stay OUT of this pool — see this migration's
    -- header for why folding them in would be a regression, not a fix.
    -- Regular heads are freed before senior heads (the bigger saving), and a
    -- senior head that gets the perk is dropped from the paying senior count
    -- so it cannot also be discounted.
    v_perk     := case when coalesce(p_free_eligible, true)
                       then least(v_quota, v_regular + v_seniors) else 0 end;
    v_perk_reg := least(v_perk, v_regular);
    v_paying_sr := v_seniors - (v_perk - v_perk_reg);

    -- Every head at the full rate, then everything that comes off it. Kids'
    -- own discount sits beside the senior one now — both zero today, both a
    -- straight rate off the full charge rather than an unconditional waiver.
    v_pax_total    := v_pax * v_rate;
    v_kids_disc    := (v_kids * v_rate) * c_kids_rate;
    v_perk_savings := v_perk * v_rate;
    v_senior_disc  := (v_paying_sr * v_rate) * c_senior_rate;
    v_total        := greatest(v_pax_total - v_perk_savings - v_kids_disc - v_senior_disc, 0);

    return query select
        round(v_rate * v_nights, 2),
        round(v_total * v_nights, 2),
        round(v_senior_disc * v_nights, 2),
        v_perk,                                   -- a head count: never scaled; kids no longer folded in
        round(v_perk_savings * v_nights, 2);
end;
$$;

-- CREATE OR REPLACE with an unchanged signature and return type preserves the
-- existing grant automatically — see the header of
-- 20260815150000_rent_all_free_entrance_quota.sql for the same reasoning.
-- No re-grant needed here.
