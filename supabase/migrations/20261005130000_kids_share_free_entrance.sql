-- ============================================================================
--  Camp Ba-long — Kids get leftover free-entrance slots
-- ----------------------------------------------------------------------------
--  THE RULE THAT CHANGED
--  ----------------------
--  The free-entrance perk (accommodation_types.free_entrance_pax, summed per
--  unit since 20261005120000_free_entrance_per_unit.sql) used to go to
--  regular and senior heads only — kids were kept out of it, a leftover from
--  when every kid was free outright. Since kids pay the full rate online
--  (20260817120000_kids_discount_claimed_at_resort.sql), that meant a
--  5-adult + 1-kid party on a 6-pax quota paid for the kid while a free slot
--  sat unused.
--
--  The perk is now handed out in priority order: regular heads (adults and
--  PWD) first, then seniors, then kids with whatever is left. 6 adults + 1 kid
--  on a 6-pax quota still leaves the kid paying — kids never take a slot an
--  adult in the party could have used.
--
--  The frontend twin is computeEntranceFee() in src/data/entranceFee.js.
--
--  WHAT THIS TOUCHES
--  -----------------
--  Only entrance_breakdown(), and in it only who gets the perk. Same
--  signature and return columns, so CREATE OR REPLACE keeps every privilege
--  and book_accommodation()/book_stay_group() call it unchanged. No table,
--  column, row or policy is changed; existing bookings keep their stored
--  entrance figures.
--
--  free_applied still counts perk heads only — a kid freed by a leftover slot
--  is part of the resort inclusion, which is how every screen labels it.
--
--  To undo: re-run entrance_breakdown from
--  20260817120000_kids_discount_claimed_at_resort.sql.
-- ============================================================================

create or replace function public.entrance_breakdown(
    p_per_head      numeric,
    p_pax           integer,
    p_kids          integer default 0,
    p_seniors       integer default 0,
    p_free_eligible boolean default true,
    p_nights        integer default 1,
    p_free_quota    integer default 2
)
returns table(per_head numeric, total numeric, senior_discount numeric, free_applied integer, free_savings numeric)
language plpgsql
immutable
set search_path = public
as $$
declare
    -- THE SYSTEM NO LONGER APPLIES A SENIOR, PWD, OR KIDS DISCOUNT. See the
    -- comment on SENIOR_DISCOUNT_RATE in src/data/entranceFee.js: set either
    -- constant back above 0 and the matching screens resume showing and
    -- charging a real discount, with no other edit needed.
    c_senior_rate constant numeric := 0;
    c_kids_rate   constant numeric := 0;

    v_rate       numeric := coalesce(p_per_head, 0);
    v_nights     integer := greatest(coalesce(p_nights, 1), 1);
    v_pax        integer := greatest(coalesce(p_pax, 0), 0);
    v_quota      integer := greatest(coalesce(p_free_quota, 2), 0);
    v_seniors    integer;
    v_kids       integer;
    v_regular    integer;
    v_perk       integer;
    v_perk_reg   integer;
    v_perk_sr    integer;
    v_paying_sr  integer;
    v_paying_kid integer;

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

    -- Up to p_free_quota heads ride free: regular heads first, then seniors,
    -- then kids with whatever is left. A senior or kid head that gets the perk
    -- is dropped from its paying count so it cannot also be discounted.
    v_perk       := case when coalesce(p_free_eligible, true)
                         then least(v_quota, v_pax) else 0 end;
    v_perk_reg   := least(v_perk, v_regular);
    v_perk_sr    := least(v_perk - v_perk_reg, v_seniors);
    v_paying_sr  := v_seniors - v_perk_sr;
    v_paying_kid := v_kids - (v_perk - v_perk_reg - v_perk_sr);

    -- Every head at the full rate, then everything that comes off it.
    v_pax_total    := v_pax * v_rate;
    v_kids_disc    := (v_paying_kid * v_rate) * c_kids_rate;
    v_perk_savings := v_perk * v_rate;
    v_senior_disc  := (v_paying_sr * v_rate) * c_senior_rate;
    v_total        := greatest(v_pax_total - v_perk_savings - v_kids_disc - v_senior_disc, 0);

    return query select
        round(v_rate * v_nights, 2),
        round(v_total * v_nights, 2),
        round(v_senior_disc * v_nights, 2),
        v_perk,                                   -- a head count: never scaled
        round(v_perk_savings * v_nights, 2);
end;
$$;
