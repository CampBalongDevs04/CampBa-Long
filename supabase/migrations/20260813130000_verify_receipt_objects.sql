-- ============================================================================
--  Camp Ba-long — a receipt has to be a receipt
-- ----------------------------------------------------------------------------
--  THE HOLE THIS CLOSES
--  --------------------
--  pay_my_booking() accepted any non-blank string as p_receipt_path, wrote it
--  to receipt_url, credited an amount against it and set payment to
--  'down-payment'. Nothing checked that the path named an object in the
--  receipts bucket. pay_booking_group() was the same shape.
--
--  The fake "paid" badge is not the interesting part — staff see a broken image
--  and ask. The damage is to the ten-minute payment window:
--
--      expire_stale_bookings() cancels rows "where receipt_url is null"
--
--  so a guest who calls pay_my_booking(id, token, 'x') with no upload at all is
--  permanently exempt from the sweep, and the unit is held indefinitely. That is
--  the exact abuse the window exists to prevent (see the PAYMENT_WINDOW_MINUTES
--  comment in src/data/accommodationDB.js). add_booking_addon() gates on
--  "receipt_url is not null" too, so food and spa unlocked on a booking that
--  had never paid a centavo.
--
--  book_stay() had a third door onto the same trick: p_receipt_url is passed
--  straight through book_accommodation() into the column, so a booking could be
--  born exempt from the sweep. The frontend stopped sending it when payment
--  moved to after the hold, but the parameter was still live.
--
--  THE FIX
--  -------
--  Both payment functions now require the path to name a real object in the
--  'receipts' bucket, AND to sit under this booking's own id — so one booking's
--  upload cannot be replayed onto another. uploadReceipt() writes
--  `<booking id>/<random>.jpg` to match (same commit, src/data/accommodationDB.js).
--  book_accommodation() ignores p_receipt_url entirely: at the moment it runs
--  there is no booking id yet, so there is no prefix that could be verified.
--
--  WHY expire_stale_bookings() ITSELF IS NOT CHANGED
--  -------------------------------------------------
--  It would be tempting to make the sweep re-check that receipt_url names a
--  real object. It must not: rows written before the bucket existed legitimately
--  carry the marker 'pending-upload' (see the column comment in
--  *_receipt_storage.sql), and a sweep that suddenly cancelled them would be a
--  regression against real, settled bookings. Closing the writers is what makes
--  the sweep trustworthy — after this migration receipt_url has exactly three
--  sources, and all three are checked:
--
--      pay_my_booking()     — verified below
--      pay_booking_group()  — verified below
--      book_accommodation() — neutralised below
--
--  (Staff write through table RLS, not through these functions.) add_booking_addon()
--  needs no change for the same reason: it reads a column that can no longer be
--  set to a junk string.
--
--  READ THIS BEFORE DEPLOYING
--  --------------------------
--  Apply this together with the frontend change in the same commit. A browser
--  tab still holding the previous bundle uploads to `<random>/receipt.jpg`, and
--  the prefix check will refuse it — the guest is told to refresh, and the
--  retry succeeds. That window only affects guests who are mid-payment during
--  the deploy, and it is the safe direction to fail in.
--
--  To drop:
--      (recreate the three functions from 20260730200000_payment_window_expires.sql,
--       20260804150000_accommodation_booking_groups.sql and
--       20260813120000_server_side_pricing.sql)
-- ============================================================================


-- ========================================== letting the owner see the bucket
-- The checks below read storage.objects from inside a SECURITY DEFINER function
-- owned by `postgres`. On Supabase that role has BYPASSRLS and can already read
-- it — but a payment path must not rest on a platform detail this repository
-- cannot verify from here. If RLS did apply, the "staff read receipts" policy
-- would return zero rows for a guest's payment and every legitimate receipt
-- would be rejected as missing: a silent failure, in the worst possible place.
--
-- So the access is made explicit. Both statements are no-ops where the platform
-- already allows it, and both are wrapped because a project whose storage schema
-- is owned differently must not fail to migrate over a belt-and-braces grant.
do $$
begin
    execute 'grant select on storage.objects to postgres';
exception when others then
    raise notice 'Could not grant select on storage.objects to postgres (%). '
                 'Fine if the role already reads it — see the verification note.', sqlerrm;
end;
$$;

do $$
begin
    execute $p$
        drop policy if exists "owner verifies receipts" on storage.objects;
        $p$;
    execute $p$
        create policy "owner verifies receipts" on storage.objects
            for select to postgres
            using (bucket_id = 'receipts');
        $p$;
exception when others then
    raise notice 'Could not add the owner read policy on storage.objects (%).', sqlerrm;
end;
$$;


-- ============================================================== pay a booking
-- Body as 20260730200000_payment_window_expires.sql, plus the two checks marked
-- below. Everything else is reproduced verbatim so this file reads as the
-- current definition.

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

    -- NEW — the receipt has to be THIS booking's. uploadReceipt() puts the
    -- image under the booking's own id, so a path from another booking (or a
    -- path invented on the spot) is refused here rather than credited.
    if split_part(v_path, '/', 1) is distinct from p_booking_id::text then
        raise exception
            'That receipt does not belong to this booking. Please refresh the page and upload your screenshot again.'
            using errcode = 'P0001';
    end if;

    -- NEW — and it has to exist. Without this, any string at all bought the
    -- booking permanent exemption from expire_stale_bookings(). See the header.
    if not exists (
        select 1 from storage.objects
         where bucket_id = 'receipts' and name = v_path
    ) then
        raise exception 'Upload a screenshot of your payment first.' using errcode = 'P0001';
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


-- ================================================================ pay a group
-- Body as 20260804150000_accommodation_booking_groups.sql, plus the same two
-- checks, keyed on the group id.

create or replace function public.pay_booking_group(
    p_group_id     uuid,
    p_owner_token  text,
    p_receipt_path text
)
returns public.booking_groups
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row  public.booking_groups := public.owned_booking_group(p_group_id, p_owner_token);
    v_path text := nullif(btrim(p_receipt_path), '');
begin
    if v_path is null then
        raise exception 'Upload a screenshot of your payment first.' using errcode = 'P0001';
    end if;

    if v_row.status = 'cancelled' then
        if v_row.cancel_reason = 'payment-timeout' then
            raise exception
                'Your % minute payment window closed, so this reservation was cancelled and the units released. Please try to book again.',
                public.payment_window_minutes()
                using errcode = 'P0001', hint = 'payment-timeout';
        end if;
        raise exception 'That reservation is cancelled.' using errcode = 'P0001';
    end if;

    if public.booking_hold_expired(v_row.status, v_row.receipt_url, v_row.created_at) then
        perform public.expire_stale_booking_groups();
        perform public.expire_stale_bookings();
        raise exception
            'Your % minute payment window closed, so this reservation was cancelled and the units released. Please try to book again.',
            public.payment_window_minutes()
            using errcode = 'P0001', hint = 'payment-timeout';
    end if;

    -- NEW — see pay_my_booking() above. A group's receipt lives under the
    -- GROUP's id, not under any one member booking's.
    if split_part(v_path, '/', 1) is distinct from p_group_id::text then
        raise exception
            'That receipt does not belong to this reservation. Please refresh the page and upload your screenshot again.'
            using errcode = 'P0001';
    end if;

    if not exists (
        select 1 from storage.objects
         where bucket_id = 'receipts' and name = v_path
    ) then
        raise exception 'Upload a screenshot of your payment first.' using errcode = 'P0001';
    end if;

    update public.booking_groups
       set receipt_url = v_path,
           receipt_uploads = receipt_uploads || jsonb_build_array(jsonb_build_object(
               'path', v_path,
               'uploadedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
               'amount', greatest(
                   round(downpayment - public.receipts_credited(receipt_uploads), 2),
                   0
               )
           )),
           payment = 'down-payment'::public.payment_status,
           updated_at = now()
     where id = p_group_id
    returning * into v_row;

    -- Stops expire_stale_bookings() from later cancelling a paid group's own
    -- units: from its point of view a member row now looks paid, exactly like
    -- an ordinary single-unit booking with a receipt on file.
    update public.bookings
       set receipt_url = v_path,
           payment = 'down-payment'::public.payment_status,
           updated_at = now()
     where group_id = p_group_id;

    v_row.owner_hash      := null;
    v_row.receipt_url     := 'pending-upload';
    v_row.receipt_uploads := public.masked_receipt_uploads(v_row.receipt_uploads);
    return v_row;
end;
$$;


-- ========================================================= book_accommodation
-- Body as 20260813120000_server_side_pricing.sql, with p_receipt_url no longer
-- reaching the row. A booking is born 'unpaid' and stays subject to the sweep
-- until a verified receipt is credited by pay_my_booking(). The parameter stays
-- on the signature for the same reason p_price does — a shipped bundle still
-- names it, and PostgREST resolves an RPC by argument name.

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
    p_owner_token  text default null,
    p_pwd          integer default 0
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
    v_unit     text;
    v_tracked  boolean;
    v_next     date;
    v_row      public.bookings;
    v_schedule public.stay_schedules;
    v_eligible boolean;
    v_nights   integer;
    v_price    numeric;
    v_entrance record;

    -- Broken out of v_entrance so a row with no party of its own can be stored
    -- exactly as it always was — see where they are set below.
    v_ent_total     numeric := null;
    v_ent_per_head  numeric := 0;
    v_ent_senior    numeric := 0;
    v_ent_free_cnt  integer := 0;
    v_ent_free_save numeric := 0;
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

    -- ------------------------------------------------------------- the money
    -- Everything below this line used to come from the caller. See the header
    -- of 20260813120000_server_side_pricing.sql.
    select * into v_schedule from public.stay_schedules where key = p_schedule_key;
    if not found then
        raise exception 'Unknown stay schedule: %', p_schedule_key using errcode = 'P0001';
    end if;

    -- How many nights this is BILLED for. Day Time is one block however the
    -- dates read, and never bills as zero. The twin of billableNights() in
    -- src/data/extendedStay.js, and it agrees with the generated bookings.nights.
    v_nights := case when v_schedule.same_day
                     then 1
                     else greatest(p_check_out - p_check_in, 1) end;

    v_price := round(public.effective_rate_price(p_type_id, v_schedule.rate_group) * v_nights, 2);

    -- A unit added from the dashboard with no flag set is eligible, same as the
    -- column default — the exclusions are the exception, not the rule.
    select coalesce(free_entrance_eligible, true) into v_eligible
    from public.accommodation_types where id = p_type_id;

    -- No pax means no party ON THIS ROW: it is a group member, and the group
    -- row carries the party and the whole reservation's entrance. Leaving the
    -- five fields at their no-party values (null total, zeroes) is how such a
    -- row has always looked, so the admin list and the receipt read unchanged.
    if p_pax is not null then
        select * into v_entrance from public.entrance_breakdown(
            v_schedule.entrance_fee, p_pax, p_kids, p_seniors,
            coalesce(v_eligible, true), v_nights);

        v_ent_total     := v_entrance.total;
        v_ent_per_head  := v_entrance.per_head;
        v_ent_senior    := v_entrance.senior_discount;
        v_ent_free_cnt  := v_entrance.free_applied;
        v_ent_free_save := v_entrance.free_savings;
    end if;

    -- Not an error, and deliberately not raised to the caller: a rate edited
    -- while a guest had the booking page open makes the browser's figure stale
    -- through nobody's fault, and refusing the booking over it would be worse
    -- than charging the correct amount. Tampering lands here too, which is why
    -- it is worth a line in the server log.
    if p_price is not null and round(p_price, 2) is distinct from v_price then
        raise log 'book_accommodation: client quoted price % for % (%, % night(s)); charging %',
            p_price, p_type_id, p_schedule_key, v_nights, v_price;
    end if;

    -- p_receipt_url is NOT read. A receipt cannot be verified here — the row it
    -- would have to prove it belongs to does not exist yet — and an unverified
    -- one written to the column would exempt the booking from the ten-minute
    -- sweep for good. Receipts arrive through pay_my_booking(), after the
    -- booking has an id to file them under.
    if p_receipt_url is not null then
        raise log 'book_accommodation: ignoring p_receipt_url on a new booking (%)', p_type_id;
    end if;

    insert into public.bookings (
        code, type_id, unit_id, schedule_key,
        check_in_date, check_out_date,
        starts_at, ends_at,                       -- overwritten by the trigger
        guest_name, guest_email, guest_mobile,
        pax, kids, seniors, pwd,
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
        p_pax, p_kids, p_seniors, coalesce(p_pwd, 0),
        v_price,
        v_ent_total, v_ent_per_head, v_ent_senior,
        v_ent_free_cnt, v_ent_free_save,
        'unpaid'::public.payment_status,
        null,
        'pending'::public.booking_status,
        public.booking_owner_hash(p_owner_token)
    )
    returning * into v_row;

    -- The caller gets its own booking back, but not the key that proves
    -- ownership of it — that only ever travels in the other direction.
    v_row.owner_hash      := null;
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
