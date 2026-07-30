-- ============================================================================
--  Camp Ba-long — payment moves to after the booking
-- ----------------------------------------------------------------------------
--  THE CHANGE
--  ----------
--  Paying used to be step 4 of 5 on the booking form: scan a QR, upload the
--  screenshot, and only then was the reservation created. That ordering had two
--  consequences worth naming:
--
--    1. Nothing was held while the guest was away in their banking app. The
--       last unit could be taken from under them, and by the time they found
--       out the money had already been sent.
--    2. Food and spa add-ons could never be part of the down payment. They
--       attach to an existing booking, and the booking did not exist until
--       after payment — so the amount was always just the unit rate, never
--       what the guest actually owed.
--
--  The booking is created first now and payment happens from My Bookings, which
--  lets the amount due be a fact about the whole stay:
--
--      down payment = 50% × (unit rate + entrance fees + food + spa)
--
--  Note that entrance fees are now HALF PREPAID rather than settled entirely
--  on-site. Every screen that used to say otherwise has been changed with this
--  migration; if you are reading this while chasing a discrepancy, that is the
--  deliberate part.
--
--  WHY downpayment BECOMES A GENERATED COLUMN
--  ------------------------------------------
--  It used to be written once, at insert, as price × 0.5. With add-ons in the
--  figure it stops being a fact recorded at booking time and becomes a running
--  total — every order a guest places moves it. Three separate code paths could
--  recompute it and stay in step, or the arithmetic can live in the schema and
--  not be anyone's job to remember. This is the second: after this migration it
--  is not possible for the amount the guest is asked to pay and the amount
--  staff verify against to disagree, because they are the same expression.
--
--  WHY RECEIPTS BECOME A LIST
--  --------------------------
--  Add-ons can be ordered at any time, including after the down payment has
--  been sent — which raises the total and leaves the guest owing a bit more. A
--  single receipt_url column would mean the second screenshot overwrote the
--  first, destroying the resort's proof of the first payment. So every
--  submission is appended to receipt_uploads, stamped with the amount that was
--  being asked for at that moment: an honest payment can never be made to look
--  short by an order placed afterwards. receipt_url still mirrors the latest,
--  so the admin receipt viewer and hasReceipt keep working unchanged.
-- ============================================================================


-- ============================================================ add-on totals

-- Sums the `total` of an order array. IMMUTABLE because it is a pure function
-- of its argument, which is what lets the generated column below call it —
-- a generated expression may not contain a subquery, but it may call a
-- function that does.
--
-- Non-numeric totals are counted as zero rather than allowed to raise: this
-- runs on every write to a booking row, and one malformed order line from the
-- pre-validation era must not be able to make a row unwritable.
create or replace function public.addon_total(p_orders jsonb)
returns numeric
language sql
immutable
set search_path = public
as $$
    select coalesce(sum(
        case when jsonb_typeof(o -> 'total') = 'number'
             then (o ->> 'total')::numeric
             else 0
        end
    ), 0)
    from jsonb_array_elements(
        case when jsonb_typeof(p_orders) = 'array' then p_orders else '[]'::jsonb end
    ) as o;
$$;

grant execute on function public.addon_total(jsonb) to anon, authenticated;


-- ================================================= downpayment, recalculated

-- Nothing depends on the old column — no index, constraint, view or policy
-- references it, and only book_accommodation() ever wrote to it (fixed below).
alter table public.bookings drop column if exists downpayment;

alter table public.bookings
    add column downpayment numeric(10,2)
    generated always as (
        round((
            coalesce(price, 0)
            + coalesce(entrance_total, 0)
            + public.addon_total(food_orders)
            + public.addon_total(spa_orders)
        ) * 0.5, 2)
    ) stored;

comment on column public.bookings.downpayment is
    '50% of the whole stay — unit rate + entrance + food + spa. Generated: it '
    'moves on its own as add-ons are ordered, and cannot be written directly.';


-- ============================================================ receipt list

alter table public.bookings
    add column if not exists receipt_uploads jsonb not null default '[]'::jsonb;

comment on column public.bookings.receipt_uploads is
    'Every proof of payment submitted: [{ path, uploadedAt, amount }]. `amount` '
    'is what was being asked for when it was sent. receipt_url mirrors the latest.';

-- Bookings taken before this migration have their one receipt on the row but
-- not in the list. Credit each with HALF THE UNIT RATE — what the old rule
-- actually asked for — and deliberately not with the new downpayment figure.
--
-- The difference is not cosmetic. A guest who paid their 50% and then ordered
-- food afterwards owes the difference, and crediting them the new total would
-- write that debt off; crediting them the new total when they had ordered
-- nothing is the same number anyway. So this reconstructs what was asked at the
-- time, which is the only figure we actually know was paid.
update public.bookings
   set receipt_uploads = jsonb_build_array(jsonb_build_object(
        'path', receipt_url,
        'uploadedAt', to_char(coalesce(updated_at, created_at) at time zone 'UTC',
                              'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'amount', round(coalesce(price, 0) * 0.5, 2)
   ))
 where receipt_url is not null
   and jsonb_array_length(receipt_uploads) = 0;


-- =============================================== what a guest may know back
-- Receipt storage PATHS are staff-only — the bucket is private and a path is
-- what a signed URL is minted from, so handing one to a guest is the single
-- piece of information that could turn into a request for someone's receipt.
-- Guests get the amounts and the timestamps, which is everything their own
-- payment history needs and nothing that reaches the bucket.
create or replace function public.masked_receipt_uploads(p_uploads jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
    select coalesce(jsonb_agg(jsonb_build_object(
        'uploadedAt', u ->> 'uploadedAt',
        'amount', u -> 'amount'
    )), '[]'::jsonb)
    from jsonb_array_elements(
        case when jsonb_typeof(p_uploads) = 'array' then p_uploads else '[]'::jsonb end
    ) as u;
$$;

revoke all on function public.masked_receipt_uploads(jsonb) from public, anon, authenticated;


-- ============================================================ pay a booking
-- The guest side of "proceed to payment". The booking already exists; this
-- attaches the screenshot to it and records what was owed at the time.
--
-- It does NOT confirm the reservation. Staff still verify the image and flip
-- the status, exactly as before — submitting a receipt has never been the same
-- thing as having it accepted.
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

    if v_row.status = 'cancelled' then
        raise exception 'That booking is cancelled.' using errcode = 'P0001';
    end if;

    update public.bookings
       set receipt_url = v_path,
           receipt_uploads = receipt_uploads || jsonb_build_array(jsonb_build_object(
               'path', v_path,
               'uploadedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
               -- The generated column as it stands right now. Reading it here
               -- is what makes a later add-on unable to retroactively turn a
               -- complete payment into a shortfall.
               'amount', downpayment
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


-- ======================================================== add-ons, ungated
-- The receipt requirement is gone. It existed because ordering came after
-- paying; now paying comes after ordering, and demanding a receipt first would
-- make it impossible for food and spa to be part of the down payment at all —
-- which is the whole point of the change.
--
-- A live, owned booking is still required, and that is the check that matters:
-- it is what stops an order being stapled to someone else's stay.
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
        raise exception 'That booking is cancelled.' using errcode = 'P0001';
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
-- Gains receipt_uploads (path-stripped) so My Bookings can show what has
-- already been sent against the amount now due. Adding a column to the result
-- means the return type changes, which `create or replace` cannot do.
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
           public.masked_receipt_uploads(b.receipt_uploads),
           b.food_orders, b.spa_orders, b.created_at
    from public.bookings b
    where b.owner_hash is not null
      and b.owner_hash = public.booking_owner_hash(p_owner_token)
      and not b.guest_hidden
    order by b.created_at desc;
$$;

grant execute on function public.my_bookings(text) to anon, authenticated;


-- ============================================================ book a stay
-- Two changes: downpayment is no longer inserted (it is generated), and a
-- receipt passed at creation seeds receipt_uploads so it is credited like any
-- other payment. The booking form no longer sends one — it hands the guest to
-- My Bookings to pay — but the parameter stays, because a booking taken over
-- the phone with the money already sent is still a real thing to record.

drop function if exists public.book_accommodation(text, text, date, date, text, text, text, integer, integer, integer, numeric, numeric, text, numeric, numeric, integer, numeric, text);

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
