-- ============================================================================
--  Camp Ba-long — book more than one accommodation as ONE reservation
-- ----------------------------------------------------------------------------
--  THE PROBLEM
--  -----------
--  `bookings` is one row per guest + one unit + one occupancy window, on
--  purpose (see 20260727062826_accommodation_schema.sql) — that is what makes
--  the GiST exclusion constraint work. A guest who wants 2 Teepees and an
--  A-House for the same stay had no way to get that as one reservation: one
--  code, one 10-minute hold, one down payment.
--
--  THE APPROACH
--  ------------
--  A NEW, ADDITIVE table — `booking_groups` — holds the reservation-level
--  facts that used to live only on `bookings`: guest, dates/schedule, pax,
--  entrance fees, payment, receipts. `bookings` gets exactly ONE new nullable
--  column, `group_id`. A member row (group_id set) still goes through the
--  exact same `available_units()` / exclusion-constraint machinery as any
--  other booking — per-unit double-booking protection is untouched — but its
--  own guest/pax/entrance fields are left null; the group row is authoritative
--  for those.
--
--  This is deliberately additive so it can be dropped cleanly if something
--  goes wrong, with zero effect on the existing single-unit flow (every row
--  written before this migration, and every row written by the untouched
--  single-unit `book_stay`/`book_accommodation` path, simply has
--  group_id = null):
--
--      drop function if exists public.book_stay_group(jsonb, text, date, date, text, text, text, integer, integer, integer, numeric, numeric, numeric, integer, numeric, text);
--      drop function if exists public.my_booking_groups(text);
--      drop function if exists public.pay_booking_group(uuid, text, text);
--      drop function if exists public.cancel_booking_group(uuid, text);
--      drop function if exists public.dismiss_booking_group(uuid, text);
--      drop function if exists public.expire_stale_booking_groups();
--      drop function if exists public.owned_booking_group(uuid, text);
--      alter table public.bookings drop column if exists group_id;
--      drop table if exists public.booking_groups;
--
--  WHY MEMBER ROWS MIRROR THE RECEIPT ONCE PAID
--  ----------------------------------------------
--  expire_stale_bookings() cancels any `bookings` row that is still 'pending'
--  with no receipt once its OWN 10-minute window closes — a rule that applies
--  uniformly, group member or not, and is what makes a lapsed group's units
--  come back on the market with no extra code here. But it also means a group
--  member row must stop looking "unpaid" once the GROUP is paid, or the sweep
--  would cancel a paid guest's units out from under them ten minutes after a
--  successful payment. So pay_booking_group() mirrors the receipt path onto
--  every member row — see below.
-- ============================================================================


-- ==================================================================== table

create table if not exists public.booking_groups (
    id              uuid primary key default gen_random_uuid(),
    code            text not null unique,     -- 'CBG-…' — distinct prefix from 'CBL-' so staff can tell a group code from a single-unit code at a glance

    owner_hash      text,
    guest_hidden    boolean not null default false,

    guest_name      text not null,
    guest_email     text,
    guest_mobile    text,

    schedule_key    text not null references public.stay_schedules (key),
    check_in_date   date not null,
    check_out_date  date not null,
    starts_at       timestamptz not null,
    ends_at         timestamptz not null,
    occupancy       tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,

    pax             integer check (pax is null or pax > 0),
    kids            integer not null default 0 check (kids >= 0),
    seniors         integer not null default 0 check (seniors >= 0),

    -- Sum of the member units' price, set once by book_stay_group() right
    -- after they're inserted — members never change price afterward, so this
    -- is written once rather than kept in step by a trigger.
    unit_subtotal   numeric(10,2) not null default 0,
    entrance_total  numeric(10,2),
    entrance_per_head        numeric(10,2) not null default 0,
    entrance_senior_discount numeric(10,2) not null default 0,
    entrance_free_applied    integer not null default 0,
    entrance_free_savings    numeric(10,2) not null default 0,

    downpayment numeric(10,2) generated always as (
        round((
            coalesce(unit_subtotal, 0)
            + coalesce(entrance_total, 0)
            + public.addon_total(food_orders)
            + public.addon_total(spa_orders)
        ) * 0.5, 2)
    ) stored,

    payment         public.payment_status not null default 'unpaid',
    receipt_url     text,
    receipt_uploads jsonb not null default '[]'::jsonb,

    -- Present for schema symmetry with `bookings`. Ordering food/spa against a
    -- group reservation is not wired up yet (a guest's existing single-unit
    -- bookings still order normally) — a deliberate scope cut, not an oversight.
    food_orders     jsonb not null default '[]'::jsonb,
    spa_orders      jsonb not null default '[]'::jsonb,

    status          public.booking_status not null default 'pending',
    cancel_reason   text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),

    constraint booking_groups_dates_ordered check (check_out_date >= check_in_date),
    constraint booking_groups_window_ordered check (ends_at > starts_at),
    constraint booking_groups_specials_fit check (coalesce(pax, 0) = 0 or kids + seniors <= pax)
);

create index if not exists booking_groups_owner_idx
    on public.booking_groups (owner_hash) where owner_hash is not null;
create index if not exists booking_groups_occupancy_idx
    on public.booking_groups using gist (occupancy);

comment on column public.booking_groups.downpayment is
    '50% of the whole reservation — every member unit''s rate + entrance + '
    'food + spa. Generated, same rule as bookings.downpayment.';

-- Same trigger function `bookings`, uses only NEW.* and stay_schedules, so it
-- attaches cleanly to a second table with the same column names.
drop trigger if exists booking_groups_set_occupancy_trg on public.booking_groups;
create trigger booking_groups_set_occupancy_trg
    before insert or update of check_in_date, check_out_date, schedule_key
    on public.booking_groups
    for each row execute function public.bookings_set_occupancy();


-- ============================================================= bookings link

alter table public.bookings
    add column if not exists group_id uuid references public.booking_groups (id) on delete cascade;

create index if not exists bookings_group_idx
    on public.bookings (group_id) where group_id is not null;

comment on column public.bookings.group_id is
    'Set when this unit is one member of a combined reservation — see '
    'booking_groups. Null (the vast majority of rows) means an ordinary '
    'single-unit booking, handled exactly as before this column existed.';


-- ==================================================================== RLS
-- Same shape as `bookings`: anon has no table privilege at all and reaches
-- this only through the SECURITY DEFINER functions below; staff (is_staff())
-- get the whole table, same as the "staff manage bookings" policy.

alter table public.booking_groups enable row level security;

revoke all on public.booking_groups from anon;

drop policy if exists "guests use rpcs only" on public.booking_groups;
create policy "guests use rpcs only" on public.booking_groups
    for select to anon using (false);

drop policy if exists "staff manage booking groups" on public.booking_groups;
create policy "staff manage booking groups" on public.booking_groups
    for all to authenticated
    using (public.is_staff())
    with check (public.is_staff());


-- ============================================================= ownership gate
-- Mirrors owned_booking() (20260727091500_guest_booking_ownership.sql:165).

create or replace function public.owned_booking_group(p_group_id uuid, p_owner_token text)
returns public.booking_groups
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_hash text := public.booking_owner_hash(p_owner_token);
    v_row  public.booking_groups;
begin
    if v_hash is null then
        raise exception 'This reservation is not on this device.' using errcode = 'P0001';
    end if;

    select * into v_row
    from public.booking_groups
    where id = p_group_id and owner_hash = v_hash;

    if not found then
        raise exception 'This reservation is not on this device.' using errcode = 'P0001';
    end if;

    return v_row;
end;
$$;

revoke all on function public.owned_booking_group(uuid, text) from public, anon, authenticated;


-- ========================================================= release lapsed holds
-- Mirrors expire_stale_bookings() (20260730200000_payment_window_expires.sql:130).
-- Only touches booking_groups — the member `bookings` rows are ALREADY caught
-- by the existing expire_stale_bookings() sweep, because a member row's own
-- 10-minute window is judged the same way any other pending, receipt-less row
-- is. This just keeps the group's own status (what My Bookings and the admin
-- board read) from being stuck on "pending" once that happens.
create or replace function public.expire_stale_booking_groups()
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
        update public.booking_groups
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

grant execute on function public.expire_stale_booking_groups() to anon, authenticated;


-- ============================================================== book a group
-- One reservation, several units, all-or-nothing. `p_items` is a jsonb array,
-- one entry per unit — `[{"type_id": "teepee", "price": 900}, …]`, the same
-- type repeated for quantity > 1.
--
-- Reuses book_accommodation() UNCHANGED, once per item. That function already
-- catches `exclusion_violation` and re-raises a friendly P0001 — nothing here
-- catches it a second time, so the first item that fails aborts this whole
-- function, and because a function body runs inside the caller's transaction,
-- every insert already made in this call (the group row, and any units picked
-- before the failing one) rolls back with it. No client-side compensation is
-- needed for "all or nothing".
create or replace function public.book_stay_group(
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
    p_owner_token  text default null
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
        pax, kids, seniors,
        entrance_total, entrance_per_head, entrance_senior_discount,
        entrance_free_applied, entrance_free_savings,
        status, owner_hash
    ) values (
        'CBG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
        p_schedule_key, p_check_in, p_check_out,
        now(), now() + interval '1 hour',
        p_guest_name, p_guest_email, p_guest_mobile,
        p_pax, p_kids, p_seniors,
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
            -- pax/kids/seniors/entrance live on the group, not per unit — a
            -- member row's own bookings_specials_fit check passes trivially
            -- because coalesce(pax, 0) = 0.
            p_pax          => null,
            p_kids         => 0,
            p_seniors      => 0,
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
    numeric, numeric, numeric, integer, numeric, text
) to anon, authenticated;


-- ======================================================== read my reservations
-- Mirrors my_bookings() (20260730200000_payment_window_expires.sql:387).
-- `units` carries only what the client can't already resolve locally — it
-- already has the accommodation_types catalog loaded, so type NAME is looked
-- up client-side from type_id rather than joined here.
create or replace function public.my_booking_groups(p_owner_token text)
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
           g.pax, g.kids, g.seniors,
           g.unit_subtotal, g.downpayment,
           g.entrance_total, g.entrance_per_head, g.entrance_senior_discount,
           g.entrance_free_applied, g.entrance_free_savings,
           g.payment,
           case when g.receipt_url is null then null else 'pending-upload' end,
           public.masked_receipt_uploads(g.receipt_uploads),
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


-- ============================================================ pay a group
-- Mirrors pay_my_booking() (20260730200000_payment_window_expires.sql:200).
-- Also mirrors the receipt onto every member `bookings` row — see the header
-- comment on why: without this, expire_stale_bookings() would cancel a paid
-- group's units ten minutes after a successful payment, because a member row
-- looks exactly like an unpaid hold otherwise.
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

grant execute on function public.pay_booking_group(uuid, text, text) to anon, authenticated;


-- ========================================================== cancel a group
-- Mirrors cancel_my_booking() (20260727091500_guest_booking_ownership.sql:201).
-- Unlike the sweep, an explicit cancel DOES need to flip the member rows
-- itself — this isn't a lapsed-window cancellation the generic sweep would
-- have caught on its own, it's a guest choosing to give the units back now.
create or replace function public.cancel_booking_group(p_group_id uuid, p_owner_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.booking_groups := public.owned_booking_group(p_group_id, p_owner_token);
begin
    if v_row.status = 'cancelled' then
        return;
    end if;

    if v_row.ends_at < now() then
        raise exception 'That stay is already over and can no longer be cancelled.'
            using errcode = 'P0001';
    end if;

    update public.bookings
       set status = 'cancelled', updated_at = now()
     where group_id = p_group_id
       and status <> 'cancelled';

    update public.booking_groups
       set status = 'cancelled', updated_at = now()
     where id = p_group_id;
end;
$$;

grant execute on function public.cancel_booking_group(uuid, text) to anon, authenticated;


-- ==================================================== dismiss a group
-- Mirrors dismiss_my_booking() (20260727091500_guest_booking_ownership.sql:230).
create or replace function public.dismiss_booking_group(p_group_id uuid, p_owner_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.booking_groups := public.owned_booking_group(p_group_id, p_owner_token);
begin
    if v_row.status <> 'cancelled' then
        raise exception 'Cancel this reservation before removing it from your list.'
            using errcode = 'P0001';
    end if;

    update public.booking_groups
       set guest_hidden = true, updated_at = now()
     where id = p_group_id;
end;
$$;

grant execute on function public.dismiss_booking_group(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
