-- ============================================================================
--  Camp Ba-long — the unit is held for 10 minutes, not forever
-- ----------------------------------------------------------------------------
--  WHY
--  ---
--  The previous migration moved payment AFTER the booking, so the unit is now
--  held before a peso is sent. That fixed the guest's problem (nothing was
--  reserved while they were away in their banking app) and created the
--  resort's: a hold that costs nothing to make and never lapses. Open the form,
--  press Reserve, walk away, and the last A-House Family is off the market
--  indefinitely — for everyone, including guests who would have paid.
--
--  So the hold gets a clock. Ten minutes from the moment the booking is
--  created, the guest uploads their receipt or the booking is cancelled and the
--  unit goes back on the market.
--
--  WHAT STARTS AND STOPS THE CLOCK
--  -------------------------------
--  It runs on exactly one kind of row: `pending` with NO receipt on file. That
--  is the narrowest definition of "held but nothing sent", and it is deliberate
--  in both directions:
--
--    • Submitting a receipt stops the clock for good, even an unverified one.
--      Staff review is measured in hours; the guest has done their part and
--      must not lose the unit while someone looks at the image.
--    • A guest who orders food after paying owes a bit more, and that top-up is
--      NOT timed. There is already a receipt on the row, so the window closed
--      the first time — a second timer over an add-on balance would cancel a
--      paid reservation over a ₱200 difference.
--
--  WHERE IT IS ENFORCED
--  --------------------
--  Here, not in the browser. The countdown on the payment panel is a display of
--  this rule, not the rule itself — a guest with a slow clock, a paused tab or
--  the devtools open still cannot pay a minute late, because pay_my_booking()
--  checks the deadline against the server's own now().
--
--  HOW A LAPSED HOLD IS ACTUALLY RELEASED
--  --------------------------------------
--  Two mechanisms, because there is no cron on this project and one of them
--  alone is not enough:
--
--    1. available_units() ignores lapsed holds outright, so the unit is offered
--       to the next guest the instant the ten minutes are up, whether or not
--       anything has swept the table yet. This is what makes the release
--       immediate rather than eventual.
--    2. expire_stale_bookings() actually flips those rows to 'cancelled'.
--       book_accommodation() runs it before picking a unit — it has to, because
--       (1) would otherwise offer a unit whose lapsed row still holds it under
--       the exclusion constraint, and the insert would fail. The app also runs
--       it on boot and when a guest's own countdown reaches zero, which is what
--       turns their card into "cancelled" in front of them.
--
--  A cancelled row is not deleted. `cancel_reason` records why, so the guest is
--  told their window closed rather than left wondering who cancelled their
--  stay, and staff can tell an abandoned hold from a guest who changed plans.
-- ============================================================================


-- ========================================================= how long they have
-- One place, so the SQL that enforces the window and the message that explains
-- it cannot disagree. The app has its own copy for the countdown display
-- (PAYMENT_WINDOW_MINUTES in src/data/accommodationDB.js); the deadline it
-- draws still comes from here, over the wire.
create or replace function public.payment_window_minutes()
returns integer
language sql
immutable
set search_path = public
as $$ select 10 $$;

grant execute on function public.payment_window_minutes() to anon, authenticated;


-- ============================================================= why cancelled
alter table public.bookings
    add column if not exists cancel_reason text;

comment on column public.bookings.cancel_reason is
    'Why the booking was cancelled: ''payment-timeout'' when the 10-minute '
    'payment window lapsed, null when a guest or staff cancelled it by hand.';


-- ============================================================ the deadline
-- STABLE rather than IMMUTABLE: adding an interval to a timestamptz depends on
-- the session's time zone, so Postgres will not let this be treated as a
-- constant. It is never used in a generated column or an index, so stable is
-- all it needs to be.
create or replace function public.payment_due_at(p_created_at timestamptz)
returns timestamptz
language sql
stable
set search_path = public
as $$
    select p_created_at + make_interval(mins => public.payment_window_minutes());
$$;

grant execute on function public.payment_due_at(timestamptz) to anon, authenticated;


-- Has this hold lapsed? Takes the three fields it needs rather than the whole
-- row, so it reads the same wherever it is used — inside a query over the
-- bookings table, and against a single row already fetched into a variable.
create or replace function public.booking_hold_expired(
    p_status     public.booking_status,
    p_receipt_url text,
    p_created_at timestamptz
)
returns boolean
language sql
stable
set search_path = public
as $$
    select p_status = 'pending'
       and p_receipt_url is null
       and now() >= public.payment_due_at(p_created_at);
$$;

grant execute on function public.booking_hold_expired(public.booking_status, text, timestamptz)
    to anon, authenticated;


-- ====================================================== release lapsed holds
-- Cancels every hold whose window has closed and reports how many. Safe to call
-- from anywhere at any time: it is idempotent (a cancelled row no longer
-- matches) and it can only ever touch rows that have already lapsed by the
-- server's own clock, so a caller cannot use it to cancel anyone's booking
-- early. That is why anon may run it — the guest whose timer just hit zero is
-- the person best placed to trigger the sweep.
create or replace function public.expire_stale_bookings()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_count integer;
begin
    with lapsed as (
        update public.bookings
           set status        = 'cancelled'::public.booking_status,
               cancel_reason = 'payment-timeout',
               updated_at    = now()
         where status = 'pending'::public.booking_status
           and receipt_url is null
           and now() >= public.payment_due_at(created_at)
        returning 1
    )
    select count(*)::integer into v_count from lapsed;

    return v_count;
end;
$$;

grant execute on function public.expire_stale_bookings() to anon, authenticated;


-- ==================================================== availability, with time
-- A lapsed hold stops blocking its unit immediately, without waiting for the
-- sweep above to run. Everything that answers "is this free?" goes through this
-- function — the booking page carousel, the admin cards, next_available_date()
-- and book_accommodation() itself — so this one clause is the whole release.
create or replace function public.available_units(
    p_type_id      text,
    p_check_in     date,
    p_check_out    date default null,
    p_schedule_key text default null
)
returns table (unit_id text)
language sql
stable
set search_path = public
as $$
    with w as (
        select * from public.occupancy_window(p_check_in, p_check_out, p_schedule_key)
    )
    select u.id
    from public.accommodation_units u, w
    where u.type_id = p_type_id
      and u.is_active
      and not exists (
          select 1 from public.bookings b
          where b.unit_id = u.id
            and b.status <> 'cancelled'
            -- Held, but nobody has paid and the ten minutes are up. The row is
            -- still 'pending' until something sweeps it; it stopped holding the
            -- unit the moment its window closed.
            and not public.booking_hold_expired(b.status, b.receipt_url, b.created_at)
            and b.occupancy && tstzrange(w.starts_at, w.ends_at, '[)')
      )
    order by u.unit_no;
$$;


-- ============================================================ pay a booking
-- Unchanged from the previous migration except for the window check at the top;
-- the rest of the body is reproduced verbatim so this file reads as the current
-- definition.
create or replace function public.pay_my_booking(
    p_booking_id   uuid,
    p_owner_token  text,
    p_receipt_path text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row  public.bookings := public.owned_booking(p_booking_id, p_owner_token);
    v_path text := nullif(btrim(p_receipt_path), '');
begin
    if v_path is null then
        raise exception 'Upload a screenshot of your payment first.' using errcode = 'P0001';
    end if;

    -- Already swept. Said in the guest's terms — they did not cancel this, a
    -- clock did — and with the one instruction that gets them their stay back.
    if v_row.status = 'cancelled' then
        if v_row.cancel_reason = 'payment-timeout' then
            raise exception
                'Your % minute payment window closed, so this booking was cancelled and the unit released. Please try to book again.',
                public.payment_window_minutes()
                using errcode = 'P0001', hint = 'payment-timeout';
        end if;
        raise exception 'That booking is cancelled.' using errcode = 'P0001';
    end if;

    -- Lapsed but not yet swept: the receipt is genuinely late, and the guest
    -- must not be able to win the unit back by being the one who never
    -- triggered the sweep. Cancel it here, then say the same thing.
    if public.booking_hold_expired(v_row.status, v_row.receipt_url, v_row.created_at) then
        perform public.expire_stale_bookings();
        raise exception
            'Your % minute payment window closed, so this booking was cancelled and the unit released. Please try to book again.',
            public.payment_window_minutes()
            using errcode = 'P0001', hint = 'payment-timeout';
    end if;

    update public.bookings
       set receipt_url = v_path,
           receipt_uploads = receipt_uploads || jsonb_build_array(jsonb_build_object(
               'path', v_path,
               'uploadedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
               -- What the guest was asked for at this moment: the down payment
               -- as it stands right now, less everything already credited.
               -- Frozen here, so an add-on ordered afterwards cannot turn a
               -- complete payment into a shortfall — and not gross, so a
               -- top-up cannot credit the earlier payment a second time.
               --
               -- Both column references read the OLD row, which is what makes
               -- this the outstanding figure rather than zero.
               'amount', greatest(
                   round(downpayment - public.receipts_credited(receipt_uploads), 2),
                   0
               )
           )),
           payment = 'down-payment'::public.payment_status,
           updated_at = now()
     where id = p_booking_id
    returning * into v_row;

    -- Same masking as my_bookings(): no ownership key, no path into the bucket.
    v_row.owner_hash      := null;
    v_row.receipt_url     := 'pending-upload';
    v_row.receipt_uploads := public.masked_receipt_uploads(v_row.receipt_uploads);
    return v_row;
end;
$$;

grant execute on function public.pay_my_booking(uuid, text, text) to anon, authenticated;


-- ================================================================== add-ons
-- Ordering food against a hold that has already lapsed would attach a meal to a
-- booking that is about to be cancelled — and, worse, raise the down payment
-- the guest is racing to pay. Refused for the same reason paying is.
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
    v_item_id   text    := nullif(btrim(p_order ->> 'itemId'), '');
    v_clean     jsonb;
begin
    if p_kind not in ('food', 'spa') then
        raise exception 'Unknown add-on kind: %', p_kind using errcode = 'P0001';
    end if;

    if v_name is null or v_quantity < 1 or v_total < 0 or v_unit_cost < 0 then
        raise exception 'That order is not valid.' using errcode = 'P0001';
    end if;

    if v_row.status = 'cancelled' then
        if v_row.cancel_reason = 'payment-timeout' then
            raise exception
                'Your % minute payment window closed, so this booking was cancelled. Please try to book again.',
                public.payment_window_minutes()
                using errcode = 'P0001', hint = 'payment-timeout';
        end if;
        raise exception 'That booking is cancelled.' using errcode = 'P0001';
    end if;

    if public.booking_hold_expired(v_row.status, v_row.receipt_url, v_row.created_at) then
        perform public.expire_stale_bookings();
        raise exception
            'Your % minute payment window closed, so this booking was cancelled. Please try to book again.',
            public.payment_window_minutes()
            using errcode = 'P0001', hint = 'payment-timeout';
    end if;

    -- An id that isn't in the catalog is dropped rather than refused: the order
    -- itself is legitimate (staff can still read the name and price off it), so
    -- a stale menu in a long-open browser tab must not cost the guest a meal.
    if v_item_id is not null then
        if p_kind = 'food' then
            if not exists (select 1 from public.food_menu_items where id = v_item_id) then
                v_item_id := null;
            end if;
        else
            if not exists (select 1 from public.spa_services where id = v_item_id) then
                v_item_id := null;
            end if;
        end if;
    end if;

    v_clean := jsonb_build_object(
        'itemId', v_item_id,
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

    v_row.owner_hash      := null;
    v_row.receipt_url     := case when v_row.receipt_url is null then null else 'pending-upload' end;
    v_row.receipt_uploads := public.masked_receipt_uploads(v_row.receipt_uploads);
    return v_row;
end;
$$;

grant execute on function public.add_booking_addon(uuid, text, jsonb, text) to anon, authenticated;


-- ========================================================= read my bookings
-- Three additions, all of them so the countdown on the payment panel is drawn
-- from the database rather than guessed at:
--
--   payment_due_at — the deadline itself. Derived here, not in the browser, so
--                    changing payment_window_minutes() moves every guest's
--                    timer without shipping a new front end.
--   cancel_reason  — lets My Bookings say "your window closed, book again"
--                    instead of a bare "Cancelled".
--   server_now     — the resort's clock, sent alongside. A phone whose clock is
--                    four minutes fast would otherwise show a guest four
--                    minutes less than they have; the app measures the offset
--                    from this and counts down against corrected time.
--
-- Adding columns changes the return type, which `create or replace` cannot do.
drop function if exists public.my_bookings(text);

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
    receipt_uploads jsonb,
    food_orders     jsonb,
    spa_orders      jsonb,
    created_at      timestamptz,
    cancel_reason   text,
    payment_due_at  timestamptz,
    server_now      timestamptz
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
           public.masked_receipt_uploads(b.receipt_uploads),
           b.food_orders, b.spa_orders, b.created_at,
           b.cancel_reason,
           public.payment_due_at(b.created_at),
           now()
    from public.bookings b
    where b.owner_hash is not null
      and b.owner_hash = public.booking_owner_hash(p_owner_token)
      and not b.guest_hidden
    order by b.created_at desc;
$$;

grant execute on function public.my_bookings(text) to anon, authenticated;


-- ============================================================== book a stay
-- Unchanged except for the sweep on the first line; the rest is reproduced
-- verbatim so this file reads as the current definition.
--
-- The sweep has to happen BEFORE a unit is picked. available_units() already
-- ignores lapsed holds, so without it this function would happily choose a unit
-- whose lapsed row still holds it under the exclusion constraint — and the
-- guest would get "that unit was just taken" for a unit nobody wants.
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
    -- Hand back every unit whose ten minutes ran out, so this booking can have
    -- one of them.
    perform public.expire_stale_bookings();

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
        price,
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
        p_price,
        p_entrance_total, coalesce(p_entrance_per_head, 0), coalesce(p_entrance_senior_discount, 0),
        coalesce(p_entrance_free_applied, 0), coalesce(p_entrance_free_savings, 0),
        -- A CASE result is untyped text, so it needs the explicit enum cast.
        (case when p_receipt_url is null then 'unpaid' else 'down-payment' end)::public.payment_status,
        p_receipt_url,
        'pending'::public.booking_status,
        public.booking_owner_hash(p_owner_token)
    )
    returning * into v_row;

    -- Credit a receipt supplied at creation, now that downpayment exists to
    -- stamp it with. Done as a second statement because the generated column
    -- is not readable until the row is in.
    if p_receipt_url is not null then
        update public.bookings
           set receipt_uploads = jsonb_build_array(jsonb_build_object(
                'path', p_receipt_url,
                'uploadedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                'amount', downpayment
           ))
         where id = v_row.id
        returning * into v_row;
    end if;

    -- The caller gets its own booking back, but not the key that proves
    -- ownership of it — that only ever travels in the other direction. The
    -- receipt path is masked to match my_bookings(), so the row the guest holds
    -- now and the row they get after a refresh are the same row.
    v_row.owner_hash      := null;
    v_row.receipt_url     := case when v_row.receipt_url is null then null else 'pending-upload' end;
    v_row.receipt_uploads := public.masked_receipt_uploads(v_row.receipt_uploads);
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

notify pgrst, 'reload schema';
