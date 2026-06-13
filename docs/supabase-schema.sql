-- 강동무에타이장 PT 관리 앱 v1 Supabase schema
-- Run in Supabase SQL Editor.
-- Status: initial schema/RLS draft.
-- Before production, enforce reservation request/cancel/payment state changes
-- through RPC or server actions so multi-table policy checks run atomically.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '관리자',
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  normalized_phone text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists members_normalized_phone_idx
  on public.members(normalized_phone);

create table if not exists public.member_link_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  auth_provider text not null check (auth_provider in ('kakao', 'google')),
  display_name text not null,
  input_phone text not null,
  normalized_phone text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejected_at timestamptz
);

create index if not exists member_link_requests_auth_user_id_idx
  on public.member_link_requests(auth_user_id);

create index if not exists member_link_requests_member_id_idx
  on public.member_link_requests(member_id);

create table if not exists public.policy_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'default',
  settings jsonb not null,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.pt_pass_products (
  id uuid primary key default gen_random_uuid(),
  sessions integer not null check (sessions > 0),
  name text not null,
  price integer not null check (price >= 0),
  default_valid_days integer not null check (default_valid_days > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pt_pass_products_sessions_idx
  on public.pt_pass_products(sessions);

create table if not exists public.pt_passes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  product_id uuid references public.pt_pass_products(id),
  total_sessions integer not null check (total_sessions >= 0),
  remaining_sessions integer not null check (remaining_sessions >= 0),
  price integer not null check (price >= 0),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'boxpos_requested', 'paid', 'refunded')),
  starts_on date not null default current_date,
  expires_on date not null,
  active boolean not null default true,
  policy_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pt_passes_member_id_idx
  on public.pt_passes(member_id);

create table if not exists public.availability_templates (
  id uuid primary key default gen_random_uuid(),
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'held', 'confirmed', 'blocked')),
  held_until timestamptz,
  created_at timestamptz not null default now(),
  constraint slot_valid_range check (end_at > start_at)
);

create unique index if not exists availability_slots_start_at_idx
  on public.availability_slots(start_at);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  pass_id uuid not null references public.pt_passes(id) on delete restrict,
  slot_id uuid not null references public.availability_slots(id) on delete restrict,
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'completed', 'cancelled', 'cancel_requested', 'no_show', 'expired')),
  requested_at timestamptz not null default now(),
  locked_until timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  deduct_on_cancel boolean,
  policy_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reservations_slot_active_idx
  on public.reservations(slot_id)
  where status in ('requested', 'confirmed', 'cancel_requested');

create index if not exists reservations_member_id_idx
  on public.reservations(member_id);

create index if not exists reservations_slot_id_idx
  on public.reservations(slot_id);

create table if not exists public.pass_events (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid not null references public.pt_passes(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  event_type text not null
    check (event_type in ('pass_created', 'session_completed', 'late_cancel_deducted', 'exception_restored', 'refund_adjusted', 'extension_added')),
  delta_count integer not null,
  reason text not null default '',
  actor_auth_user_id uuid references auth.users(id),
  actor_role text not null default 'admin' check (actor_role in ('admin', 'member', 'system')),
  created_at timestamptz not null default now()
);

create unique index if not exists pass_events_one_completion_per_reservation_idx
  on public.pass_events(reservation_id)
  where event_type in ('session_completed', 'late_cancel_deducted');

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  pass_id uuid not null references public.pt_passes(id) on delete cascade,
  amount integer not null check (amount >= 0),
  status text not null default 'unpaid'
    check (status in ('unpaid', 'boxpos_requested', 'paid', 'refunded')),
  method text not null default 'boxpos' check (method in ('cash', 'card', 'boxpos', 'refund')),
  boxpos_reference text,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_member_id_idx
  on public.payments(member_id);

create index if not exists payments_pass_id_idx
  on public.payments(pass_id);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  from_status text not null,
  to_status text not null,
  actor_auth_user_id uuid references auth.users(id),
  actor_role text not null default 'admin' check (actor_role in ('admin', 'system')),
  memo text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.extension_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  pass_id uuid not null references public.pt_passes(id) on delete cascade,
  reason text not null,
  days integer not null check (days > 0),
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id),
  decided_at timestamptz
);

create index if not exists extension_requests_member_id_idx
  on public.extension_requests(member_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_member_id_idx
  on public.notifications(member_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users admin_user
    where admin_user.auth_user_id = auth.uid()
  );
$$;

create or replace function public.approved_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select member_id
  from public.member_link_requests
  where auth_user_id = auth.uid()
    and status = 'approved'
  order by approved_at desc nulls last
  limit 1;
$$;

create or replace function public.complete_session(target_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_reservation public.reservations%rowtype;
  target_pass public.pt_passes%rowtype;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select *
  into target_reservation
  from public.reservations
  where id = target_reservation_id
  for update;

  if not found then
    raise exception 'reservation not found';
  end if;

  if target_reservation.status = 'completed' then
    return;
  end if;

  if target_reservation.status <> 'confirmed' then
    raise exception 'reservation must be confirmed';
  end if;

  select *
  into target_pass
  from public.pt_passes
  where id = target_reservation.pass_id
  for update;

  if target_pass.remaining_sessions < 1 then
    raise exception 'no remaining sessions';
  end if;

  update public.reservations
  set status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = target_reservation_id;

  update public.pt_passes
  set remaining_sessions = remaining_sessions - 1,
      updated_at = now()
  where id = target_pass.id;

  insert into public.pass_events (
    pass_id,
    member_id,
    reservation_id,
    event_type,
    delta_count,
    reason,
    actor_auth_user_id,
    actor_role
  )
  values (
    target_pass.id,
    target_pass.member_id,
    target_reservation_id,
    'session_completed',
    -1,
    '수업완료',
    auth.uid(),
    'admin'
  )
  on conflict do nothing;
end;
$$;

create or replace function public.expire_requested_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
begin
  update public.reservations
  set status = 'expired',
      updated_at = now()
  where status = 'requested'
    and locked_until is not null
    and locked_until < now();

  get diagnostics expired_count = row_count;

  update public.availability_slots slot
  set status = 'open',
      held_until = null
  where status = 'held'
    and held_until is not null
    and held_until < now()
    and not exists (
      select 1
      from public.reservations reservation
      where reservation.slot_id = slot.id
        and reservation.status in ('requested', 'confirmed', 'cancel_requested')
    );

  return expired_count;
end;
$$;

alter table public.admin_users enable row level security;
alter table public.members enable row level security;
alter table public.member_link_requests enable row level security;
alter table public.policy_settings enable row level security;
alter table public.pt_pass_products enable row level security;
alter table public.pt_passes enable row level security;
alter table public.availability_templates enable row level security;
alter table public.availability_slots enable row level security;
alter table public.reservations enable row level security;
alter table public.pass_events enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.extension_requests enable row level security;
alter table public.notifications enable row level security;

create policy "admins can manage admin users"
  on public.admin_users for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins can manage members"
  on public.members for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "approved members can read own member row"
  on public.members for select
  using (id = public.approved_member_id());

create policy "users can create own link request"
  on public.member_link_requests for insert
  with check (auth_user_id = auth.uid());

create policy "users can read own link request"
  on public.member_link_requests for select
  using (auth_user_id = auth.uid() or public.is_admin());

create policy "admins can update link requests"
  on public.member_link_requests for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins manage policy settings"
  on public.policy_settings for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins manage pass products"
  on public.pt_pass_products for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "members read active pass products"
  on public.pt_pass_products for select
  using (active = true);

create policy "admins manage passes"
  on public.pt_passes for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "members read own passes"
  on public.pt_passes for select
  using (member_id = public.approved_member_id());

create policy "admins manage availability templates"
  on public.availability_templates for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins manage slots"
  on public.availability_slots for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "members read visible slots"
  on public.availability_slots for select
  using (
    status = 'open'
    or exists (
      select 1
      from public.reservations reservation
      where reservation.slot_id = availability_slots.id
        and reservation.member_id = public.approved_member_id()
    )
  );

create policy "admins manage reservations"
  on public.reservations for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "members read own reservations"
  on public.reservations for select
  using (member_id = public.approved_member_id());

create policy "members create own reservation requests"
  on public.reservations for insert
  with check (
    member_id = public.approved_member_id()
    and status = 'requested'
  );

create policy "members update own cancellation requests"
  on public.reservations for update
  using (member_id = public.approved_member_id())
  with check (
    member_id = public.approved_member_id()
    and status in ('cancelled', 'cancel_requested')
  );

create policy "admins manage pass events"
  on public.pass_events for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "members read own pass events"
  on public.pass_events for select
  using (member_id = public.approved_member_id());

create policy "admins manage payments"
  on public.payments for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "members read own payments"
  on public.payments for select
  using (member_id = public.approved_member_id());

create policy "admins manage payment events"
  on public.payment_events for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "members read own payment events"
  on public.payment_events for select
  using (
    exists (
      select 1
      from public.payments payment
      where payment.id = payment_id
        and payment.member_id = public.approved_member_id()
    )
  );

create policy "admins manage extension requests"
  on public.extension_requests for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "members read own extension requests"
  on public.extension_requests for select
  using (member_id = public.approved_member_id());

create policy "members create own extension requests"
  on public.extension_requests for insert
  with check (
    member_id = public.approved_member_id()
    and status = 'requested'
  );

create policy "admins manage notifications"
  on public.notifications for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "members read own notifications"
  on public.notifications for select
  using (member_id = public.approved_member_id());

insert into public.pt_pass_products (sessions, name, price, default_valid_days, active)
values
  (1, '1회권', 60000, 30, true),
  (2, '2회권', 120000, 30, true),
  (3, '3회권', 180000, 30, true),
  (4, '4회권', 240000, 30, true),
  (5, '5회권', 300000, 30, true),
  (6, '6회권', 360000, 60, true),
  (7, '7회권', 420000, 60, true),
  (8, '8회권', 480000, 60, true),
  (9, '9회권', 540000, 60, true),
  (10, '10회권', 600000, 60, true)
on conflict (sessions) do nothing;

insert into public.policy_settings (name, settings, active)
select
  'default',
  '{
    "booking": {
      "publishWeeks": 4,
      "requestExpiryHours": 24,
      "memberFutureBookingLimit": "remaining_sessions",
      "fixedFutureBookingLimit": 2,
      "allowUnpaidBooking": true
    },
    "cancellation": {
      "autoCancelHoursBeforeSession": 24,
      "lateCancelDefaultDeduct": true,
      "exceptionReasons": ["질병", "부상", "가족일", "업무 일정", "기타"]
    },
    "extension": {
      "memberRequestEnabled": true,
      "defaultReasons": ["질병", "부상", "출장", "개인사정"]
    },
    "renewal": {
      "remainingSessionsThreshold": 2,
      "daysBeforeExpiryThreshold": 7,
      "showToMember": true
    }
  }'::jsonb,
  true
where not exists (
  select 1
  from public.policy_settings
  where name = 'default'
    and active = true
);
