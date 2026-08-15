-- ============================================================================
--  Camp Ba-long — persons with disability, counted on the booking
-- ----------------------------------------------------------------------------
--  WHY
--  ---
--  Senior citizens and PWD guests are both entitled to a discount, and the
--  resort now gives BOTH of them at the front desk rather than through this
--  system (see SENIOR_DISCOUNT_RATE / PWD_DISCOUNT_RATE in
--  src/data/entranceFee.js — both are 0). That makes the COUNT the thing that
--  has to survive the trip: the desk cannot apply a discount it cannot see.
--
--  `seniors` has been on `bookings` since the first schema. `pwd` had nowhere
--  to live at all, so a guest could declare it on the form and it would be
--  thrown away on the way to Postgres. This adds the column and threads the
--  parameter through the four functions between the booking page and the row.
--
--  READ THIS BEFORE DEPLOYING
--  -------------------------
--  The client sends `p_pwd` on every booking from the moment the new frontend
--  ships. PostgREST resolves an RPC by its argument NAMES, so a frontend that
--  sends p_pwd against a database without this migration does not degrade —
--  it fails outright, on every booking. APPLY THIS FIRST, then deploy.
--
--  WHY THE FUNCTIONS ARE RECREATED RATHER THAN PATCHED
--  ---------------------------------------------------
--  Postgres treats a different argument list as a different function, so
--  CREATE OR REPLACE with an extra parameter creates a second overload and
--  every existing call becomes ambiguous. Each one is therefore dropped by its
--  exact old signature and recreated. `p_pwd` is appended LAST with a default,
--  which is also what keeps book_stay()'s positional call into
--  book_accommodation() valid while it is being changed.
--
--  This is the same shape as every previous field addition here — see
--  *_store_entrance_fee_breakdown.sql and *_guest_booking_ownership.sql, which
--  both grew book_accommodation() the same way.
--
--  To drop:
--      (recreate the four functions from the migrations named above, then)
--      alter table public.bookings       drop column if exists pwd;
--      alter table public.booking_groups drop column if exists pwd;
-- ============================================================================


-- ==================================================================== column

alter table public.bookings
    add column if not exists pwd integer not null default 0 check (pwd >= 0);

alter table public.booking_groups
    add column if not exists pwd integer not null default 0 check (pwd >= 0);

comment on column public.bookings.pwd is
    'Persons with disability in the party. A COUNT, never a price: the PWD '
    'discount is applied at the resort against a PWD ID, not by this system. '
    'Counted within pax, like kids and seniors.';

comment on column public.booking_groups.pwd is
    'Persons with disability in the party. Same rule as bookings.pwd.';

-- The three subset counts together can never exceed the party. Replaces the
-- kids + seniors form of the same rule.
alter table public.bookings drop constraint if exists bookings_specials_fit;
alter table public.bookings add constraint bookings_specials_fit
    check (coalesce(pax, 0) = 0 or kids + seniors + pwd <= pax);

alter table public.booking_groups drop constraint if exists booking_groups_specials_fit;
alter table public.booking_groups add constraint booking_groups_specials_fit
    check (coalesce(pax, 0) = 0 or kids + seniors + pwd <= pax);


-- ======================================================= book_accommodation
-- Body identical to 20260730200000_payment_window_expires.sql, plus p_pwd on
-- the signature and in the INSERT.

drop function if exists public.book_accommodation(
    text, text, date, date, text, text, text, integer, integer, integer,
    numeric, numeric, text, numeric, numeric, integer, numeric, text);

create function public.book_accommodation(
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

grant execute on function public.book_accommodation(
    text, text, date, date, text, text, text, integer, integer, integer,
    numeric, numeric, text, numeric, numeric, integer, numeric, text, integer
) to anon, authenticated;


-- ================================================================= book_stay
-- The queue-aware wrapper. Body identical to 20260801120000_booking_hold_queue
-- .sql, plus p_pwd on the signature and passed through to book_accommodation().

drop function if exists public.book_stay(
    text, text, date, date, text, text, text, integer, integer, integer,
    numeric, numeric, text, numeric, numeric, integer, numeric, text);

create function public.book_stay(
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
    v_hash     text := public.booking_owner_hash(p_owner_token);
    v_row      public.bookings;
    v_conflict record;
    v_window   record;
    v_tracked  boolean;
    v_ahead    integer := 0;
    v_name     text;
    v_minutes  integer;
    v_hint     text;
begin
    -- Hand back every unit whose ten minutes ran out, then move the line along
    -- against what that freed.
    perform public.expire_stale_bookings();
    perform public.promote_booking_queue();

    select exists (select 1 from public.accommodation_types where id = p_type_id and is_active)
      into v_tracked;

    -- Types with a unit ceiling are the only ones with anything to queue for.
    -- Unlimited ones (guests pitching their own tent) go straight through.
    if v_tracked then
        v_name := coalesce((select name from public.accommodation_types where id = p_type_id), p_type_id);

        -- Taken BEFORE the booking attempt, so it is still the reason the
        -- attempt failed if it does. Microseconds old by the time it is read.
        select * into v_conflict
        from public.hold_conflict(p_type_id, p_check_in, p_check_out, p_schedule_key);

        select * into v_window
        from public.occupancy_window(p_check_in, p_check_out, p_schedule_key);

        -- Live claims held by everyone EXCEPT this caller. If they cover every
        -- free unit, the guests ahead get them — including when the caller
        -- never queued at all, which is the point of the whole table.
        select count(*)::integer into v_ahead
        from public.booking_queue q
        where q.status = 'ready'
          and q.claim_until > now()
          and q.type_id = p_type_id
          and q.occupancy && tstzrange(v_window.starts_at, v_window.ends_at, '[)')
          and (v_hash is null or q.owner_hash <> v_hash);

        if v_conflict.free_units > 0 and v_conflict.free_units <= v_ahead then
            raise exception using
                errcode = 'P0001',
                message = format(
                    'A guest ahead of you in line is booking the last %s right now.', v_name),
                detail  = 'Wait a moment and we will try again for you.',
                hint    = 'queued';
        end if;
    end if;

    begin
        v_row := public.book_accommodation(
            p_type_id, p_schedule_key, p_check_in, p_check_out,
            p_guest_name, p_guest_email, p_guest_mobile,
            p_pax, p_kids, p_seniors,
            p_price, p_entrance_total, p_receipt_url,
            p_entrance_per_head, p_entrance_senior_discount,
            p_entrance_free_applied, p_entrance_free_savings,
            p_owner_token, p_pwd);
    exception
        when others then
            get stacked diagnostics v_hint = pg_exception_hint;

            -- "Fully booked" is the wrong word when every blocker is an unpaid
            -- ten-minute hold. Same refusal, re-labelled with the one fact that
            -- changes what the guest should do about it: when it comes back.
            if v_hint = 'unavailable'
               and v_tracked
               and v_conflict.held_units > 0
               and v_conflict.releases_at is not null then
                v_minutes := greatest(1, ceil(extract(epoch from (v_conflict.releases_at - now())) / 60)::integer);
                raise exception using
                    errcode = 'P0001',
                    message = format(
                        '%s is being held by another guest who has %s minute%s left to pay for it.',
                        v_name, v_minutes, case when v_minutes = 1 then '' else 's' end),
                    detail  = 'It goes back on the market at '
                              || to_char(v_conflict.releases_at at time zone public.resort_timezone(), 'HH12:MI AM')
                              || ' if they do not.',
                    hint    = 'held';
            end if;

            -- Anything else is passed through exactly as it was raised. A
            -- wrapper that swallowed or reworded genuine failures would be
            -- worse than no wrapper at all.
            raise;
    end;

    -- They were waiting and they got it. Closing the entry here — rather than
    -- leaving the browser to do it — releases the claim immediately for
    -- everyone behind them.
    if v_hash is not null then
        update public.booking_queue q
           set status = 'booked', updated_at = now()
         where q.owner_hash = v_hash
           and q.status in ('waiting', 'ready')
           and q.type_id = p_type_id
           and q.occupancy && v_row.occupancy;

        perform public.promote_booking_queue();
    end if;

    return v_row;
end;
$$;

grant execute on function public.book_stay(
    text, text, date, date, text, text, text, integer, integer, integer,
    numeric, numeric, text, numeric, numeric, integer, numeric, text, integer
) to anon, authenticated;


-- =========================================================== book_stay_group
-- Body identical to 20260804150000_accommodation_booking_groups.sql, plus
-- p_pwd. Member rows still carry no party of their own — the group row is
-- authoritative — so book_accommodation() is called with p_pwd => 0 there.

drop function if exists public.book_stay_group(
    jsonb, text, date, date, text, text, text, integer, integer, integer,
    numeric, numeric, numeric, integer, numeric, text);

create function public.book_stay_group(
    p_items        jsonb,
    p_schedule_key text,
    p_check_in     date,
    p_check_out    date,
    p_guest_name   text,
    p_guest_email  text default null,
    p_guest_mobile text default null,
    p_pax          integer default null,
    p_kids         integer default 0,
    p_seniors      integer default 0,
    p_entrance_total numeric default null,
    p_entrance_per_head        numeric default 0,
    p_entrance_senior_discount numeric default 0,
    p_entrance_free_applied    integer default 0,
    p_entrance_free_savings    numeric default 0,
    p_owner_token  text default null,
    p_pwd          integer default 0
)
returns public.booking_groups
language plpgsql
security definer
set search_path = public
as $$
declare
    v_group    public.booking_groups;
    v_item     jsonb;
    v_booking  public.bookings;
    v_subtotal numeric := 0;
    v_type_id  text;
    v_price    numeric;
begin
    perform public.expire_stale_booking_groups();

    if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'Pick at least one accommodation.' using errcode = 'P0001';
    end if;

    insert into public.booking_groups (
        code, schedule_key, check_in_date, check_out_date,
        starts_at, ends_at,                       -- overwritten by the trigger
        guest_name, guest_email, guest_mobile,
        pax, kids, seniors, pwd,
        entrance_total, entrance_per_head, entrance_senior_discount,
        entrance_free_applied, entrance_free_savings,
        status, owner_hash
    ) values (
        'CBG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
        p_schedule_key, p_check_in, p_check_out,
        now(), now() + interval '1 hour',
        p_guest_name, p_guest_email, p_guest_mobile,
        p_pax, p_kids, p_seniors, coalesce(p_pwd, 0),
        p_entrance_total, coalesce(p_entrance_per_head, 0), coalesce(p_entrance_senior_discount, 0),
        coalesce(p_entrance_free_applied, 0), coalesce(p_entrance_free_savings, 0),
        'pending'::public.booking_status,
        public.booking_owner_hash(p_owner_token)
    )
    returning * into v_group;

    for v_item in select * from jsonb_array_elements(p_items) loop
        v_type_id := v_item ->> 'type_id';
        v_price   := (v_item ->> 'price')::numeric;

        if v_type_id is null then
            raise exception 'Every accommodation in the cart needs a type.' using errcode = 'P0001';
        end if;

        v_booking := public.book_accommodation(
            p_type_id      => v_type_id,
            p_schedule_key => p_schedule_key,
            p_check_in     => p_check_in,
            p_check_out    => p_check_out,
            p_guest_name   => p_guest_name,
            p_guest_email  => p_guest_email,
            p_guest_mobile => p_guest_mobile,
            -- pax/kids/seniors/pwd/entrance live on the group, not per unit — a
            -- member row's own bookings_specials_fit check passes trivially
            -- because coalesce(pax, 0) = 0.
            p_pax          => null,
            p_kids         => 0,
            p_seniors      => 0,
            p_pwd          => 0,
            p_price        => v_price,
            p_owner_token  => p_owner_token
        );

        update public.bookings set group_id = v_group.id where id = v_booking.id;
        v_subtotal := v_subtotal + coalesce(v_price, 0);
    end loop;

    update public.booking_groups
       set unit_subtotal = v_subtotal
     where id = v_group.id
    returning * into v_group;

    v_group.owner_hash := null;
    return v_group;
end;
$$;

grant execute on function public.book_stay_group(
    jsonb, text, date, date, text, text, text, integer, integer, integer,
    numeric, numeric, numeric, integer, numeric, text, integer
) to anon, authenticated;


-- =============================================================== my_bookings
-- Body identical to 20260804160000_exclude_group_members_from_my_bookings.sql,
-- plus `pwd` in the returned columns.

drop function if exists public.my_bookings(text);

create function public.my_bookings(p_owner_token text)
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
    pwd             integer,
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
           b.pax, b.kids, b.seniors, b.pwd,
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
      -- A group's member unit is represented to the guest by
      -- my_booking_groups() instead, not as a bookings row of its own.
      and b.group_id is null
    order by b.created_at desc;
$$;

grant execute on function public.my_bookings(text) to anon, authenticated;


-- ========================================================= my_booking_groups
-- Body identical to 20260805063000_my_booking_groups_addon_orders.sql, plus
-- `pwd` in the returned columns.

drop function if exists public.my_booking_groups(text);

create function public.my_booking_groups(p_owner_token text)
returns table (
    id              uuid,
    code            text,
    status          public.booking_status,
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
    pwd             integer,
    unit_subtotal   numeric,
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
    units           jsonb,
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
    select g.id, g.code, g.status, g.schedule_key,
           g.check_in_date, g.check_out_date, g.starts_at, g.ends_at,
           g.guest_name, g.guest_email, g.guest_mobile,
           g.pax, g.kids, g.seniors, g.pwd,
           g.unit_subtotal, g.downpayment,
           g.entrance_total, g.entrance_per_head, g.entrance_senior_discount,
           g.entrance_free_applied, g.entrance_free_savings,
           g.payment,
           case when g.receipt_url is null then null else 'pending-upload' end,
           public.masked_receipt_uploads(g.receipt_uploads),
           g.food_orders, g.spa_orders,
           coalesce(
               jsonb_agg(
                   jsonb_build_object('unitId', b.unit_id, 'typeId', b.type_id, 'price', b.price)
                   order by b.created_at
               ) filter (where b.id is not null),
               '[]'::jsonb
           ),
           g.created_at, g.cancel_reason,
           public.payment_due_at(g.created_at),
           now()
    from public.booking_groups g
    left join public.bookings b on b.group_id = g.id
    where g.owner_hash is not null
      and g.owner_hash = public.booking_owner_hash(p_owner_token)
      and not g.guest_hidden
    group by g.id
    order by g.created_at desc;
$$;

grant execute on function public.my_booking_groups(text) to anon, authenticated;

notify pgrst, 'reload schema';
