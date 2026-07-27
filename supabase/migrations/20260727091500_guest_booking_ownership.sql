-- ============================================================================
--  Guest booking ownership — "you see your bookings, and only yours"
-- ----------------------------------------------------------------------------
--  THE PROBLEM
--  -----------
--  Guests never sign in, so a booking row had no owner. Two consequences:
--
--    1. My Bookings could only show what the current JS session happened to
--       hold in memory. A refresh emptied the page, and the only reason a guest
--       never saw a stranger's reservation was that nobody's reservation
--       survived a reload.
--    2. Anything that took a booking id took ANY booking id. add_booking_addon()
--       is SECURITY DEFINER and granted to anon, so knowing a uuid was enough to
--       staple food and spa orders onto someone else's stay.
--
--  THE MODEL
--  ---------
--  Each browser mints a 256-bit random owner token on its first booking and
--  keeps it in localStorage. The token itself NEVER reaches the database — only
--  its SHA-256 hash is stored, so a dump of `bookings` hands an attacker
--  nothing they can replay. Proving ownership means presenting the token; the
--  database hashes it and compares.
--
--  That makes the token a bearer capability, which is exactly the scoping asked
--  for: the device that made the booking can see and manage it, and a different
--  device — or a different browser on the same device — is a different guest
--  and sees nothing. Guests who clear their browser data lose the list, not the
--  reservation; they quote their CBL-… code to staff like always.
--
--  WHAT ENFORCES IT
--  ----------------
--  Not the front end. `anon` has no privileges on public.bookings at all after
--  this migration and no RLS policy grants it any, so a guest cannot read,
--  update or delete a booking row directly no matter what the client asks for.
--  Every guest-facing operation goes through the SECURITY DEFINER functions
--  below, each of which requires the owner token and refuses without it.
--
--  Staff are unaffected: the "staff manage bookings" policy still gives a
--  signed-in roster member the whole table.
-- ============================================================================


-- ============================================================== ownership key

alter table public.bookings
    -- SHA-256 (hex) of the guest's owner token. Null on rows created before
    -- this migration, which therefore belong to nobody and are visible only to
    -- staff — the safe direction to fail.
    add column if not exists owner_hash   text,
    -- A guest clearing a cancelled booking off their own list. The row stays
    -- for staff: a cancellation is history, not a mistake to erase.
    add column if not exists guest_hidden boolean not null default false;

create index if not exists bookings_owner_idx
    on public.bookings (owner_hash) where owner_hash is not null;

comment on column public.bookings.owner_hash is
    'SHA-256 of the guest device''s owner token. Never the token itself.';
comment on column public.bookings.guest_hidden is
    'Guest dismissed this cancelled booking from their own list; staff still see it.';


-- The one place the token is turned into a stored value. A token shorter than
-- 32 characters yields null, so an empty or throwaway string can never match a
-- row: null is not equal to anything, including another null.
create or replace function public.booking_owner_hash(p_token text)
returns text
language sql
immutable
set search_path = public
as $$
    select case
        when p_token is null or length(p_token) < 32 then null
        else encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    end;
$$;

grant execute on function public.booking_owner_hash(text) to anon, authenticated;


-- ------------------------------------------------------------ shut the door
-- Defence in depth. RLS already denied anonymous visitors every row, but
-- Supabase grants the anon role table privileges by default and RLS was the
-- only thing standing between a guest and `select * from bookings`. Take the
-- privilege away too, so a policy added carelessly later cannot re-open it.
revoke all on public.bookings from anon;

-- Being explicit beats relying on the absence of a policy: this states, in the
-- schema, that anonymous callers reach bookings only through the functions.
drop policy if exists "guests use rpcs only" on public.bookings;
create policy "guests use rpcs only" on public.bookings
    for select to anon using (false);


-- ================================================== read your own bookings

-- Everything My Bookings renders, for the rows this token owns and nothing
-- else. receipt_url is deliberately masked: the guest already knows they
-- uploaded a receipt, the image lives in a staff-only bucket, and handing out
-- the storage path would be the one piece of information that could turn into
-- a request for it.
create or replace function public.my_bookings(p_owner_token text)
returns table (
    id              uuid,
    code            text,
    status          public.booking_status,
    type_id         text,
    unit_id         text,
    schedule_key    text,
    check_in_date   date,
    check_out_date  date,
    starts_at       timestamptz,
    ends_at         timestamptz,
    guest_name      text,
    guest_email     text,
    guest_mobile    text,
    pax             integer,
    kids            integer,
    seniors         integer,
    price           numeric,
    downpayment     numeric,
    entrance_total  numeric,
    entrance_per_head        numeric,
    entrance_senior_discount numeric,
    entrance_free_applied    integer,
    entrance_free_savings    numeric,
    payment         public.payment_status,
    receipt_url     text,
    food_orders     jsonb,
    spa_orders      jsonb,
    created_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
    select b.id, b.code, b.status, b.type_id, b.unit_id, b.schedule_key,
           b.check_in_date, b.check_out_date, b.starts_at, b.ends_at,
           b.guest_name, b.guest_email, b.guest_mobile,
           b.pax, b.kids, b.seniors,
           b.price, b.downpayment,
           b.entrance_total, b.entrance_per_head, b.entrance_senior_discount,
           b.entrance_free_applied, b.entrance_free_savings,
           b.payment,
           -- "a receipt is on file, but here is no path to it".
           case when b.receipt_url is null then null else 'pending-upload' end,
           b.food_orders, b.spa_orders, b.created_at
    from public.bookings b
    where b.owner_hash is not null
      and b.owner_hash = public.booking_owner_hash(p_owner_token)
      and not b.guest_hidden
    order by b.created_at desc;
$$;

grant execute on function public.my_bookings(text) to anon, authenticated;


-- ==================================================== manage your own booking

-- Shared gate: resolve a (booking id, token) pair to a row, or refuse. Every
-- guest mutation below starts here, so there is exactly one ownership check to
-- get right. The message is the same whether the booking does not exist or
-- belongs to someone else — a guest with a stolen uuid learns nothing.
create or replace function public.owned_booking(p_booking_id uuid, p_owner_token text)
returns public.bookings
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_hash text := public.booking_owner_hash(p_owner_token);
    v_row  public.bookings;
begin
    if v_hash is null then
        raise exception 'This booking is not on this device.' using errcode = 'P0001';
    end if;

    select * into v_row
    from public.bookings
    where id = p_booking_id and owner_hash = v_hash;

    if not found then
        raise exception 'This booking is not on this device.' using errcode = 'P0001';
    end if;

    return v_row;
end;
$$;

-- Internal only. Postgres grants EXECUTE on new functions to PUBLIC, so the
-- revoke has to name PUBLIC — revoking from anon alone would leave the grant
-- they inherit from it. The callers below are SECURITY DEFINER and run as the
-- owner, so they still reach it.
revoke all on function public.owned_booking(uuid, text) from public, anon, authenticated;


-- Cancel your own stay. Frees the unit for those hours immediately, because
-- the exclusion constraint stops applying to cancelled rows.
create or replace function public.cancel_my_booking(p_booking_id uuid, p_owner_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.bookings := public.owned_booking(p_booking_id, p_owner_token);
begin
    if v_row.status = 'cancelled' then
        return;                                  -- already done; not an error
    end if;

    if v_row.ends_at < now() then
        raise exception 'That stay is already over and can no longer be cancelled.'
            using errcode = 'P0001';
    end if;

    update public.bookings
       set status = 'cancelled', updated_at = now()
     where id = p_booking_id;
end;
$$;

grant execute on function public.cancel_my_booking(uuid, text) to anon, authenticated;


-- Clear a cancelled booking off your own list. The row survives for staff —
-- guests get their list tidied, the resort keeps its records.
create or replace function public.dismiss_my_booking(p_booking_id uuid, p_owner_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.bookings := public.owned_booking(p_booking_id, p_owner_token);
begin
    if v_row.status <> 'cancelled' then
        raise exception 'Cancel this booking before removing it from your list.'
            using errcode = 'P0001';
    end if;

    update public.bookings
       set guest_hidden = true, updated_at = now()
     where id = p_booking_id;
end;
$$;

grant execute on function public.dismiss_my_booking(uuid, text) to anon, authenticated;


-- ================================================================== add-ons

-- The previous version took a booking id and appended whatever JSON it was
-- handed, for anyone who asked. Now it needs the owner token, and it builds the
-- stored order from three validated fields instead of trusting the payload —
-- a negative total or an extra key can no longer be smuggled onto a row that
-- the admin revenue figures add up.
drop function if exists public.add_booking_addon(uuid, text, jsonb);

create or replace function public.add_booking_addon(
    p_booking_id  uuid,
    p_kind        text,          -- 'food' | 'spa'
    p_order       jsonb,
    p_owner_token text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row       public.bookings := public.owned_booking(p_booking_id, p_owner_token);
    v_name      text    := nullif(btrim(p_order ->> 'name'), '');
    v_quantity  integer := floor(coalesce((p_order ->> 'quantity')::numeric, 0));
    v_total     numeric := round(coalesce((p_order ->> 'total')::numeric, 0), 2);
    v_unit_cost numeric := round(coalesce((p_order ->> 'unitPrice')::numeric, 0), 2);
    v_clean     jsonb;
begin
    if p_kind not in ('food', 'spa') then
        raise exception 'Unknown add-on kind: %', p_kind using errcode = 'P0001';
    end if;

    if v_name is null or v_quantity < 1 or v_total < 0 or v_unit_cost < 0 then
        raise exception 'That order is not valid.' using errcode = 'P0001';
    end if;

    -- Same rule the menu and spa pages apply, restated where it is enforceable:
    -- add-ons attach to a live stay with a down-payment receipt on file.
    if v_row.status = 'cancelled' then
        raise exception 'That booking is cancelled.' using errcode = 'P0001';
    end if;

    if v_row.receipt_url is null then
        raise exception 'Upload your down-payment receipt before ordering.'
            using errcode = 'P0001';
    end if;

    -- Rebuilt field by field rather than stored as received: the shape is now
    -- fixed, and `orderedAt` is the server's clock instead of whatever time the
    -- caller claimed it was.
    v_clean := jsonb_build_object(
        'name', left(v_name, 120),
        'unitPrice', v_unit_cost,
        'quantity', least(v_quantity, 999),
        'total', v_total,
        'orderedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    );

    update public.bookings
       set food_orders = case when p_kind = 'food'
                              then food_orders || jsonb_build_array(v_clean)
                              else food_orders end,
           spa_orders  = case when p_kind = 'spa'
                              then spa_orders  || jsonb_build_array(v_clean)
                              else spa_orders  end,
           updated_at = now()
     where id = p_booking_id
    returning * into v_row;

    -- The caller is a guest, so hand back exactly what my_bookings() would:
    -- no ownership key, and no path into the staff-only receipts bucket.
    v_row.owner_hash  := null;
    v_row.receipt_url := case when v_row.receipt_url is null then null else 'pending-upload' end;
    return v_row;
end;
$$;

grant execute on function public.add_booking_addon(uuid, text, jsonb, text) to anon, authenticated;


-- ============================================================ book a stay
-- Same function as before plus the owner token, so a new booking is stamped
-- with the device that made it. Adding a parameter would create an overload
-- PostgREST could not choose between, so drop the old signature first.

drop function if exists public.book_accommodation(text, text, date, date, text, text, text, integer, integer, integer, numeric, numeric, text, numeric, numeric, integer, numeric);

create or replace function public.book_accommodation(
    p_type_id      text,
    p_schedule_key text,
    p_check_in     date,
    p_check_out    date,
    p_guest_name   text,
    p_guest_email  text default null,
    p_guest_mobile text default null,
    p_pax          integer default null,
    p_kids         integer default 0,
    p_seniors      integer default 0,
    p_price        numeric default null,
    p_entrance_total numeric default null,
    p_receipt_url  text default null,
    p_entrance_per_head        numeric default 0,
    p_entrance_senior_discount numeric default 0,
    p_entrance_free_applied    integer default 0,
    p_entrance_free_savings    numeric default 0,
    p_owner_token  text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
    v_unit    text;
    v_tracked boolean;
    v_next    date;
    v_row     public.bookings;
begin
    select exists (select 1 from public.accommodation_types where id = p_type_id and is_active)
      into v_tracked;

    -- Types with a unit ceiling need a free unit; unlimited ones (tent
    -- pitching) book without holding anything.
    if v_tracked then
        select unit_id into v_unit
        from public.available_units(p_type_id, p_check_in, p_check_out, p_schedule_key)
        limit 1;

        if v_unit is null then
            v_next := public.next_available_date(p_type_id, p_check_in, p_schedule_key, 60);
            raise exception using
                errcode = 'P0001',
                message = format('%s is fully booked for that schedule.',
                                 coalesce((select name from public.accommodation_types where id = p_type_id), p_type_id)),
                detail  = coalesce('Next free date: ' || v_next::text, 'No free date in the next 60 days.'),
                hint    = 'unavailable';
        end if;
    end if;

    insert into public.bookings (
        code, type_id, unit_id, schedule_key,
        check_in_date, check_out_date,
        starts_at, ends_at,                       -- overwritten by the trigger
        guest_name, guest_email, guest_mobile,
        pax, kids, seniors,
        price, downpayment,
        entrance_total, entrance_per_head, entrance_senior_discount,
        entrance_free_applied, entrance_free_savings,
        payment, receipt_url, status, owner_hash
    ) values (
        'CBL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
        p_type_id, v_unit, p_schedule_key,
        p_check_in, p_check_out,
        now(), now() + interval '1 hour',
        p_guest_name, p_guest_email, p_guest_mobile,
        p_pax, p_kids, p_seniors,
        p_price, p_price * 0.5,
        p_entrance_total, coalesce(p_entrance_per_head, 0), coalesce(p_entrance_senior_discount, 0),
        coalesce(p_entrance_free_applied, 0), coalesce(p_entrance_free_savings, 0),
        -- A CASE result is untyped text, so it needs the explicit enum cast.
        (case when p_receipt_url is null then 'unpaid' else 'down-payment' end)::public.payment_status,
        p_receipt_url,
        'pending'::public.booking_status,
        public.booking_owner_hash(p_owner_token)
    )
    returning * into v_row;

    -- The caller gets its own booking back, but not the key that proves
    -- ownership of it — that only ever travels in the other direction. The
    -- receipt path is masked to match my_bookings(), so the row the guest holds
    -- now and the row they get after a refresh are the same row.
    v_row.owner_hash  := null;
    v_row.receipt_url := case when v_row.receipt_url is null then null else 'pending-upload' end;
    return v_row;
exception
    -- Lost the race for the last unit between the SELECT and the INSERT.
    when exclusion_violation then
        raise exception using
            errcode = 'P0001',
            message = 'That unit was just taken for those hours. Please pick another date or unit.',
            hint    = 'unavailable';
end;
$$;

grant execute on function public.book_accommodation(text, text, date, date, text, text, text, integer, integer, integer, numeric, numeric, text, numeric, numeric, integer, numeric, text) to anon, authenticated;
