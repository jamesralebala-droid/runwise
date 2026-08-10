-- ============================================================================
-- RunWise — Wallet & Payment Management System
-- ============================================================================
-- Adds the payment tracking / settlement-management layer:
--   payments, payment_references, transactions (immutable ledger),
--   wallet_ledgers, runner_earnings, settlements, refunds, payment_methods
-- plus admin_users view and every RPC the app + admin portal call.
--
-- IMPORTANT business rule: RunWise never claims the temporary payment
-- recipient is the company. The recipient name is stored per payment method
-- (payment_methods.recipient_name) and the transparency notice is rendered
-- by the client at checkout, on instructions and on the receipt.
--
-- Safe to re-run: idempotent (IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Sequence + payment methods (modular payment layer — future providers
--    are added as new rows: myzaka, card, orange_money_api, ...).
-- ---------------------------------------------------------------------------
create sequence if not exists public.payment_order_no_seq start 1001;

create table if not exists public.payment_methods (
  id text primary key,
  display_name text not null,
  mode text not null default 'manual_verification', -- manual_verification | api
  recipient_name text,                              -- temporary recipient shown at checkout (launch period)
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

insert into public.payment_methods (id, display_name, mode, recipient_name, sort_order)
values
  ('orange_money', 'Orange Money', 'manual_verification', 'Tefo Ralebala', 10)
on conflict (id) do update set
  display_name = excluded.display_name,
  mode = excluded.mode,
  recipient_name = excluded.recipient_name,
  is_active = true;

alter table public.payment_methods enable row level security;
drop policy if exists "payment_methods_read_all" on public.payment_methods;
create policy "payment_methods_read_all" on public.payment_methods
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- 2. Payments (one or more per order room; terminal states allow retry)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default ('RW-' || lpad(nextval('public.payment_order_no_seq')::text, 4, '0')),
  order_room_id uuid not null references public.order_rooms(id) on delete cascade,
  customer_id uuid not null references public.profiles(id),
  runner_id uuid not null references public.profiles(id),
  delivery_fee numeric not null check (delivery_fee > 0),
  commission numeric not null default 0 check (commission >= 0),
  runner_earnings numeric not null default 0 check (runner_earnings >= 0),
  total_amount numeric not null check (total_amount > 0),
  payment_method text not null references public.payment_methods(id),
  recipient_name text,
  status text not null default 'payment_verification_required' check (
    status in ('payment_verification_required', 'info_requested', 'paid', 'rejected', 'refunded', 'cancelled')
  ),
  reference_number text,
  amount_reported numeric,
  screenshot_url text,
  paid_at timestamptz,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  rejection_reason text,
  info_request_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_order_room on public.payments (order_room_id, created_at desc);
create index if not exists idx_payments_status on public.payments (status, created_at desc);
create index if not exists idx_payments_customer on public.payments (customer_id, created_at desc);
create index if not exists idx_payments_runner on public.payments (runner_id, created_at desc);

alter table public.payments enable row level security;
drop policy if exists "payments_select_participant_or_admin" on public.payments;
create policy "payments_select_participant_or_admin" on public.payments
  for select to authenticated
  using (
    (select auth.uid()) in (customer_id, runner_id)
    or public.is_admin()
  );

-- All payment writes go through security definer RPCs.
revoke insert, update, delete on public.payments from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Payment references — every customer submission of proof is recorded
-- ---------------------------------------------------------------------------
create table if not exists public.payment_references (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  reference_number text not null,
  amount_reported numeric,
  screenshot_url text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_references_payment on public.payment_references (payment_id, created_at desc);

alter table public.payment_references enable row level security;
drop policy if exists "payment_references_select" on public.payment_references;
create policy "payment_references_select" on public.payment_references
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.payments p
      where p.id = payment_id and (select auth.uid()) in (p.customer_id, p.runner_id)
    )
  );

revoke insert, update, delete on public.payment_references from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Transactions — the immutable RunWise ledger. No UPDATE/DELETE ever.
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  tx_ref text not null unique,
  order_room_id uuid references public.order_rooms(id),
  payment_id uuid references public.payments(id),
  customer_id uuid references public.profiles(id),
  runner_id uuid references public.profiles(id),
  amount numeric not null,
  transaction_type text not null check (
    transaction_type in (
      'CUSTOMER_PAYMENT', 'RUNWISE_COMMISSION', 'RUNNER_EARNING',
      'RUNNER_SETTLEMENT', 'REFUND', 'PAYMENT_REVERSAL', 'ADJUSTMENT'
    )
  ),
  payment_method text,
  status text not null default 'completed',
  reference_number text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_order on public.transactions (order_room_id, created_at desc);
create index if not exists idx_transactions_type on public.transactions (transaction_type, created_at desc);
create index if not exists idx_transactions_customer on public.transactions (customer_id, created_at desc);
create index if not exists idx_transactions_runner on public.transactions (runner_id, created_at desc);
create index if not exists idx_transactions_created on public.transactions (created_at desc);

alter table public.transactions enable row level security;
drop policy if exists "transactions_select_participant_or_admin" on public.transactions;
create policy "transactions_select_participant_or_admin" on public.transactions
  for select to authenticated
  using (
    public.is_admin()
    or (select auth.uid()) = customer_id
    or (select auth.uid()) = runner_id
  );

revoke insert, update, delete on public.transactions from anon, authenticated;

-- Hard immutability guard: even security definer functions cannot change
-- or remove a ledger row (only INSERT is allowed).
create or replace function public.guard_transactions_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Ledger transactions are immutable and cannot be updated or deleted';
end;
$$;

drop trigger if exists trg_transactions_immutable on public.transactions;
create trigger trg_transactions_immutable
  before update or delete on public.transactions
  for each row execute function public.guard_transactions_immutable();

-- ---------------------------------------------------------------------------
-- 5. Wallet ledgers — per-order financial summary
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_ledgers (
  id uuid primary key default gen_random_uuid(),
  order_room_id uuid not null references public.order_rooms(id) on delete cascade,
  order_no text not null,
  customer_payment numeric not null default 0,
  runwise_revenue numeric not null default 0,
  runner_earnings numeric not null default 0,
  refund_amount numeric not null default 0,
  payment_status text not null default 'pending',
  delivery_status text not null default 'pending',
  settlement_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_wallet_ledgers_room on public.wallet_ledgers (order_room_id);
create index if not exists idx_wallet_ledgers_order_no on public.wallet_ledgers (order_no);

alter table public.wallet_ledgers enable row level security;
drop policy if exists "wallet_ledgers_select_participant_or_admin" on public.wallet_ledgers;
create policy "wallet_ledgers_select_participant_or_admin" on public.wallet_ledgers
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.order_rooms r
      where r.id = order_room_id and (select auth.uid()) in (r.customer_id, r.runner_id)
    )
  );

revoke insert, update, delete on public.wallet_ledgers from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Runner earnings — per-order owed amounts (pending -> paid on settlement)
-- ---------------------------------------------------------------------------
create table if not exists public.runner_earnings (
  id uuid primary key default gen_random_uuid(),
  runner_id uuid not null references public.profiles(id),
  order_room_id uuid not null references public.order_rooms(id) on delete cascade,
  payment_id uuid references public.payments(id),
  amount numeric not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected')),
  settled_at timestamptz,
  settled_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_runner_earnings_runner on public.runner_earnings (runner_id, status, created_at desc);
create index if not exists idx_runner_earnings_room on public.runner_earnings (order_room_id);
create unique index if not exists idx_runner_earnings_payment on public.runner_earnings (payment_id);

alter table public.runner_earnings enable row level security;
drop policy if exists "runner_earnings_select" on public.runner_earnings;
create policy "runner_earnings_select" on public.runner_earnings
  for select to authenticated
  using ((select auth.uid()) = runner_id or public.is_admin());

revoke insert, update, delete on public.runner_earnings from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Settlements — runner payout requests, admin-controlled lifecycle
-- ---------------------------------------------------------------------------
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  runner_id uuid not null references public.profiles(id),
  amount numeric not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected')),
  payment_method text references public.payment_methods(id),
  reference_number text,
  requested_by uuid references public.profiles(id),
  processed_by uuid references public.profiles(id),
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_settlements_runner on public.settlements (runner_id, created_at desc);
create index if not exists idx_settlements_status on public.settlements (status, created_at desc);

alter table public.settlements enable row level security;
drop policy if exists "settlements_select" on public.settlements;
create policy "settlements_select" on public.settlements
  for select to authenticated
  using ((select auth.uid()) = runner_id or public.is_admin());

revoke insert, update, delete on public.settlements from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Refunds
-- ---------------------------------------------------------------------------
create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id),
  order_room_id uuid not null references public.order_rooms(id) on delete cascade,
  customer_id uuid not null references public.profiles(id),
  amount numeric not null check (amount > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'processed', 'rejected')),
  processed_by uuid references public.profiles(id),
  processed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_refunds_order on public.refunds (order_room_id, created_at desc);

alter table public.refunds enable row level security;
drop policy if exists "refunds_select" on public.refunds;
create policy "refunds_select" on public.refunds
  for select to authenticated
  using ((select auth.uid()) = customer_id or public.is_admin());

revoke insert, update, delete on public.refunds from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Admin users view (read model over profiles — no duplicate user data)
-- ---------------------------------------------------------------------------
create or replace view public.admin_users
with (security_invoker = false) as
select p.id, p.full_name, p.role, p.active_role, p.created_at
from public.profiles p
where p.role = 'admin'::public.user_role;

grant select on public.admin_users to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Commission setting (percent of delivery fee kept by RunWise)
-- ---------------------------------------------------------------------------
alter table public.platform_settings add column if not exists payment_commission_pct numeric not null default 0.15;

-- ============================================================================
-- RPCs
-- ============================================================================

-- ---------------------------------------------------------------------------
-- create_order_payment: customer starts checkout. Computes the split
-- (commission + runner earnings) server-side and returns the payment row.
-- ---------------------------------------------------------------------------
create or replace function public.create_order_payment(
  p_order_room_id uuid,
  p_delivery_fee numeric,
  p_payment_method text default 'orange_money'
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.order_rooms%rowtype;
  v_method public.payment_methods%rowtype;
  v_settings public.platform_settings%rowtype;
  v_commission numeric;
  v_runner_share numeric;
  v_payment public.payments%rowtype;
begin
  select * into v_room from public.order_rooms where id = p_order_room_id;
  if not found then raise exception 'Order room not found'; end if;
  if (select auth.uid()) <> v_room.customer_id and not public.is_admin() then
    raise exception 'Only the customer can start checkout';
  end if;
  if p_delivery_fee is null or p_delivery_fee <= 0 then
    raise exception 'Delivery fee must be greater than zero';
  end if;

  select * into v_method from public.payment_methods where id = p_payment_method and is_active;
  if not found then raise exception 'Payment method is not available'; end if;

  -- Only one non-terminal payment per order room.
  if exists (
    select 1 from public.payments
    where order_room_id = p_order_room_id
      and status not in ('rejected', 'refunded', 'cancelled')
  ) then
    raise exception 'This order already has an active payment';
  end if;

  select * into v_settings from public.platform_settings where id = 1;
  v_commission := round(p_delivery_fee * coalesce(v_settings.payment_commission_pct, 0.15), 2);
  v_runner_share := round(p_delivery_fee - v_commission, 2);

  insert into public.payments (
    order_room_id, customer_id, runner_id, delivery_fee, commission, runner_earnings,
    total_amount, payment_method, recipient_name, status, created_at, updated_at
  )
  values (
    v_room.id, v_room.customer_id, v_room.runner_id,
    round(p_delivery_fee, 2), v_commission, v_runner_share,
    round(p_delivery_fee, 2), v_method.id, v_method.recipient_name,
    'payment_verification_required', now(), now()
  )
  returning * into v_payment;

  return v_payment;
end;
$$;

revoke all on function public.create_order_payment(uuid, numeric, text) from public, anon;
grant execute on function public.create_order_payment(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- submit_payment_reference: customer reports they have paid. NEVER auto-marks
-- the payment as successful — it stays PAYMENT VERIFICATION REQUIRED.
-- ---------------------------------------------------------------------------
create or replace function public.submit_payment_reference(
  p_payment_id uuid,
  p_reference_number text,
  p_amount_reported numeric default null,
  p_screenshot_url text default null,
  p_paid_at timestamptz default null,
  p_notes text default null
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then raise exception 'Payment not found'; end if;
  if (select auth.uid()) <> v_payment.customer_id and not public.is_admin() then
    raise exception 'Only the customer can submit payment details';
  end if;
  if nullif(btrim(p_reference_number), '') is null then
    raise exception 'A transaction reference number is required';
  end if;
  if v_payment.status in ('paid', 'refunded', 'cancelled') then
    raise exception 'This payment is already closed';
  end if;

  insert into public.payment_references (
    payment_id, submitted_by, reference_number, amount_reported, screenshot_url, paid_at, notes
  )
  values (
    p_payment_id, (select auth.uid()),
    btrim(p_reference_number),
    coalesce(p_amount_reported, v_payment.total_amount),
    p_screenshot_url,
    coalesce(p_paid_at, now()),
    nullif(btrim(coalesce(p_notes, '')), '')
  );

  update public.payments
  set reference_number = btrim(p_reference_number),
      amount_reported = coalesce(p_amount_reported, total_amount),
      screenshot_url = coalesce(p_screenshot_url, screenshot_url),
      paid_at = coalesce(p_paid_at, now()),
      status = 'payment_verification_required',
      info_request_reason = null,
      updated_at = now()
  where id = p_payment_id
  returning * into v_payment;

  return v_payment;
end;
$$;

revoke all on function public.submit_payment_reference(uuid, text, numeric, text, timestamptz, text) from public, anon;
grant execute on function public.submit_payment_reference(uuid, text, numeric, text, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Internal ledger writer (used by admin RPCs; immutable insert only).
-- ---------------------------------------------------------------------------
create or replace function public.ledger_write(
  p_order_room_id uuid,
  p_payment_id uuid,
  p_customer_id uuid,
  p_runner_id uuid,
  p_amount numeric,
  p_type text,
  p_method text,
  p_reference text,
  p_notes text
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  if p_type not in ('CUSTOMER_PAYMENT', 'RUNWISE_COMMISSION', 'RUNNER_EARNING', 'RUNNER_SETTLEMENT', 'REFUND', 'PAYMENT_REVERSAL', 'ADJUSTMENT') then
    raise exception 'Invalid transaction type';
  end if;
  insert into public.transactions (
    tx_ref, order_room_id, payment_id, customer_id, runner_id,
    amount, transaction_type, payment_method, status, reference_number,
    created_by, updated_by, notes, created_at
  )
  values (
    'TX-' || replace(gen_random_uuid()::text, '-', ''),
    p_order_room_id, p_payment_id, p_customer_id, p_runner_id,
    p_amount, p_type, p_method, 'completed', p_reference,
    (select auth.uid()), (select auth.uid()), nullif(btrim(coalesce(p_notes, '')), ''), now()
  )
  returning * into v_tx;
  return v_tx;
end;
$$;

revoke all on function public.ledger_write(uuid, uuid, uuid, uuid, numeric, text, text, text, text) from public, anon;
grant execute on function public.ledger_write(uuid, uuid, uuid, uuid, numeric, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_verify_payment: the ONLY way a payment becomes PAID. Writes the
-- ledger (customer payment, commission, runner earning), creates runner
-- earnings + wallet ledger, records audit, and marks the order escrow as
-- funded so the existing journey flow can continue.
-- ---------------------------------------------------------------------------
create or replace function public.admin_verify_payment(p_payment_id uuid, p_notes text default null)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_wallet_id uuid;
  v_treasury_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;

  select * into v_payment from public.payments where id = p_payment_id;
  if not found then raise exception 'Payment not found'; end if;
  if v_payment.status = 'paid' then raise exception 'Payment is already paid'; end if;
  if v_payment.status not in ('payment_verification_required', 'info_requested') then
    raise exception 'Payment is not awaiting verification';
  end if;

  update public.payments
  set status = 'paid',
      verified_by = (select auth.uid()),
      verified_at = now(),
      notes = nullif(btrim(coalesce(p_notes, v_payment.notes)), ''),
      updated_at = now()
  where id = p_payment_id
  returning * into v_payment;

  -- Ledger: customer payment
  perform public.ledger_write(
    v_payment.order_room_id, v_payment.id, v_payment.customer_id, v_payment.runner_id,
    v_payment.total_amount, 'CUSTOMER_PAYMENT', v_payment.payment_method,
    v_payment.reference_number, 'Payment verified'
  );
  -- Ledger: RunWise commission
  perform public.ledger_write(
    v_payment.order_room_id, v_payment.id, v_payment.customer_id, v_payment.runner_id,
    v_payment.commission, 'RUNWISE_COMMISSION', v_payment.payment_method,
    v_payment.reference_number, 'RunWise service commission'
  );
  -- Ledger: runner earnings
  perform public.ledger_write(
    v_payment.order_room_id, v_payment.id, v_payment.customer_id, v_payment.runner_id,
    v_payment.runner_earnings, 'RUNNER_EARNING', v_payment.payment_method,
    v_payment.reference_number, 'Runner earnings'
  );

  -- Runner earnings record + wallet ledger summary
  insert into public.runner_earnings (runner_id, order_room_id, payment_id, amount, status)
  values (v_payment.runner_id, v_payment.order_room_id, v_payment.id, v_payment.runner_earnings, 'pending')
  on conflict do nothing;

  insert into public.wallet_ledgers (order_room_id, order_no, customer_payment, runwise_revenue, runner_earnings, payment_status, delivery_status, settlement_status)
  values (v_payment.order_room_id, v_payment.order_no, v_payment.total_amount, v_payment.commission, v_payment.runner_earnings, 'paid', 'pending', 'pending')
  on conflict (order_room_id) do update set
    order_no = excluded.order_no,
    customer_payment = excluded.customer_payment,
    runwise_revenue = excluded.runwise_revenue,
    runner_earnings = excluded.runner_earnings,
    payment_status = excluded.payment_status,
    updated_at = now();

  -- Treasury virtual balance (commission) — informational ledger, not a bank balance
  select id into v_treasury_id from public.wallets where owner_type = 'treasury'::public.wallet_owner_type limit 1;
  if v_treasury_id is not null then
    insert into public.wallet_transactions (wallet_id, amount, type, reference)
    values (v_treasury_id, v_payment.commission, 'platform_revenue', v_payment.order_no)
    on conflict do nothing;
    update public.wallets set available_balance = available_balance + v_payment.commission
    where id = v_treasury_id;
  end if;

  -- Runner wallet pending balance (earnings owed)
  select id into v_wallet_id from public.wallets where user_id = v_payment.runner_id;
  if v_wallet_id is not null then
    insert into public.wallet_transactions (wallet_id, amount, type, reference)
    values (v_wallet_id, v_payment.runner_earnings, 'runner_earning', v_payment.order_no)
    on conflict do nothing;
    update public.wallets set pending_balance = pending_balance + v_payment.runner_earnings
    where id = v_wallet_id;
  end if;

  -- Advance the escrow so the existing journey flow continues
  update public.escrow_transactions
  set status = 'funded', updated_at = now()
  where order_room_id = v_payment.order_room_id and status = 'awaiting_funding';

  insert into public.journey_milestones (order_room_id, milestone, note)
  values (v_payment.order_room_id, 'heading_to_pickup', 'Payment verified via ' || v_payment.payment_method);

  -- Audit trail
  perform public.admin_log_event(
    'verify_payment', 'payments', p_payment_id,
    'Order ' || v_payment.order_no || ' P' || v_payment.total_amount || ' — verified' ||
    coalesce(': ' || nullif(btrim(coalesce(p_notes, '')), ''), '')
  );

  return v_payment;
end;
$$;

revoke all on function public.admin_verify_payment(uuid, text) from public, anon;
grant execute on function public.admin_verify_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_reject_payment
-- ---------------------------------------------------------------------------
create or replace function public.admin_reject_payment(p_payment_id uuid, p_reason text default null)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;

  select * into v_payment from public.payments where id = p_payment_id;
  if not found then raise exception 'Payment not found'; end if;
  if v_payment.status in ('paid', 'refunded', 'cancelled') then
    raise exception 'Payment is already closed';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A rejection reason is required';
  end if;

  update public.payments
  set status = 'rejected',
      rejection_reason = btrim(p_reason),
      verified_by = (select auth.uid()),
      verified_at = now(),
      updated_at = now()
  where id = p_payment_id
  returning * into v_payment;

  perform public.ledger_write(
    v_payment.order_room_id, v_payment.id, v_payment.customer_id, v_payment.runner_id,
    -v_payment.total_amount, 'PAYMENT_REVERSAL', v_payment.payment_method,
    v_payment.reference_number, 'Payment rejected: ' || btrim(p_reason)
  );

  perform public.admin_log_event('reject_payment', 'payments', p_payment_id, 'Order ' || v_payment.order_no || ' — ' || btrim(p_reason));

  return v_payment;
end;
$$;

revoke all on function public.admin_reject_payment(uuid, text) from public, anon;
grant execute on function public.admin_reject_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_request_payment_info
-- ---------------------------------------------------------------------------
create or replace function public.admin_request_payment_info(p_payment_id uuid, p_reason text default null)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;

  select * into v_payment from public.payments where id = p_payment_id;
  if not found then raise exception 'Payment not found'; end if;
  if v_payment.status not in ('payment_verification_required', 'info_requested') then
    raise exception 'Payment is not awaiting verification';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Please explain what information is needed';
  end if;

  update public.payments
  set status = 'info_requested',
      info_request_reason = btrim(p_reason),
      updated_at = now()
  where id = p_payment_id
  returning * into v_payment;

  perform public.admin_log_event('request_payment_info', 'payments', p_payment_id, 'Order ' || v_payment.order_no || ' — ' || btrim(p_reason));

  return v_payment;
end;
$$;

revoke all on function public.admin_request_payment_info(uuid, text) from public, anon;
grant execute on function public.admin_request_payment_info(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- request_settlement: runner asks to be paid out. Creates a pending
-- settlement; no money moves until an admin marks it paid.
-- ---------------------------------------------------------------------------
create or replace function public.request_settlement(p_amount numeric, p_method text default 'orange_money')
returns public.settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_earned numeric;
  v_paid_out numeric;
  v_pending numeric;
  v_available numeric;
  v_settlement public.settlements%rowtype;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  if not exists (select 1 from public.payment_methods where id = p_method and is_active) then
    raise exception 'Payment method is not available';
  end if;

  select coalesce(sum(amount), 0) into v_earned from public.runner_earnings where runner_id = (select auth.uid());
  select coalesce(sum(amount), 0) into v_paid_out from public.settlements where runner_id = (select auth.uid()) and status = 'paid';
  select coalesce(sum(amount), 0) into v_pending from public.runner_earnings where runner_id = (select auth.uid()) and status in ('pending', 'approved');
  v_available := greatest(v_earned - v_paid_out - v_pending, 0);

  if p_amount > v_available then
    raise exception 'Requested amount exceeds your available earnings (available: P%)', round(v_available, 2);
  end if;

  insert into public.settlements (runner_id, amount, status, payment_method, requested_by, created_at, updated_at)
  values ((select auth.uid()), round(p_amount, 2), 'pending', p_method, (select auth.uid()), now(), now())
  returning * into v_settlement;

  return v_settlement;
end;
$$;

revoke all on function public.request_settlement(numeric, text) from public, anon;
grant execute on function public.request_settlement(numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_update_settlement: pending -> approved -> paid (with reference) or
-- rejected. When paid, earnings move pending -> paid and a RUNNER_SETTLEMENT
-- ledger row is recorded.
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_settlement(
  p_settlement_id uuid,
  p_status text,
  p_payment_method text default null,
  p_reference_number text default null,
  p_notes text default null
)
returns public.settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settlement public.settlements%rowtype;
  v_remaining numeric;
  v_wallet_id uuid;
  v_earning record;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  if p_status not in ('pending', 'approved', 'paid', 'rejected') then
    raise exception 'Invalid settlement status';
  end if;

  select * into v_settlement from public.settlements where id = p_settlement_id;
  if not found then raise exception 'Settlement not found'; end if;
  if p_status = 'paid' and nullif(btrim(coalesce(p_reference_number, '')), '') is null then
    raise exception 'A transaction reference is required when marking a settlement as paid';
  end if;
  if p_status = 'paid' and p_payment_method is null then
    raise exception 'A payment method is required when marking a settlement as paid';
  end if;

  update public.settlements
  set status = p_status,
      payment_method = coalesce(p_payment_method, payment_method),
      reference_number = coalesce(nullif(btrim(coalesce(p_reference_number, '')), ''), reference_number),
      notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), notes),
      processed_by = (select auth.uid()),
      paid_at = case when p_status = 'paid' then now() else paid_at end,
      updated_at = now()
  where id = p_settlement_id
  returning * into v_settlement;

  if p_status = 'paid' then
    -- Ledger row for the payout
    perform public.ledger_write(
      null, null, null, v_settlement.runner_id,
      v_settlement.amount, 'RUNNER_SETTLEMENT', v_settlement.payment_method,
      v_settlement.reference_number, 'Settlement paid' ||
      coalesce(': ' || nullif(btrim(coalesce(p_notes, '')), ''), '')
    );

    -- Move runner earnings pending -> paid (FIFO) up to the settled amount
    v_remaining := v_settlement.amount;
    for v_earning in
      select id, amount from public.runner_earnings
      where runner_id = v_settlement.runner_id and status in ('pending', 'approved')
      order by created_at asc
      for update
    loop
      exit when v_remaining <= 0;
      update public.runner_earnings
      set status = 'paid', settled_at = now(), settled_by = (select auth.uid())
      where id = v_earning.id;
      v_remaining := v_remaining - v_earning.amount;
    end loop;

    -- Update wallet balances (pending -> available) as an informational ledger
    select id into v_wallet_id from public.wallets where user_id = v_settlement.runner_id;
    if v_wallet_id is not null then
      update public.wallets
      set pending_balance = greatest(pending_balance - v_settlement.amount, 0),
          available_balance = available_balance + v_settlement.amount
      where id = v_wallet_id;
      insert into public.wallet_transactions (wallet_id, amount, type, reference)
      values (v_wallet_id, -v_settlement.amount, 'runner_settlement', v_settlement.id::text)
      on conflict do nothing;
    end if;
  end if;

  perform public.admin_log_event(
    'settlement_' || p_status, 'settlements', p_settlement_id,
    'Runner settlement P' || v_settlement.amount || ' ' || p_status ||
    coalesce(': ' || nullif(btrim(coalesce(p_notes, '')), ''), '')
  );

  return v_settlement;
end;
$$;

revoke all on function public.admin_update_settlement(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_update_settlement(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_runner_wallet_summary: runner dashboard numbers (ledger-based).
-- ---------------------------------------------------------------------------
create or replace function public.get_runner_wallet_summary(p_runner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_runner uuid;
  v_total numeric;
  v_paid_out numeric;
  v_pending numeric;
  v_available numeric;
  v_completed int;
begin
  v_runner := coalesce(p_runner_id, (select auth.uid()));
  if (select auth.uid()) <> v_runner and not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  select coalesce(sum(amount), 0) into v_total from public.runner_earnings where runner_id = v_runner;
  select coalesce(sum(amount), 0) into v_paid_out from public.settlements where runner_id = v_runner and status = 'paid';
  select coalesce(sum(amount), 0) into v_pending from public.runner_earnings where runner_id = v_runner and status in ('pending', 'approved');
  v_available := greatest(v_total - v_paid_out - v_pending, 0);

  select count(*) into v_completed
  from public.order_rooms r
  join public.escrow_transactions e on e.order_room_id = r.id
  where r.runner_id = v_runner and e.status = 'released';

  return jsonb_build_object(
    'runner_id', v_runner,
    'total_earned', round(v_total, 2),
    'pending', round(v_pending, 2),
    'paid_out', round(v_paid_out, 2),
    'available', round(v_available, 2),
    'completed_deliveries', v_completed
  );
end;
$$;

revoke all on function public.get_runner_wallet_summary(uuid) from public, anon;
grant execute on function public.get_runner_wallet_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_admin_payment_dashboard: aggregate numbers for the admin dashboard.
-- ---------------------------------------------------------------------------
create or replace function public.get_admin_payment_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_tx int;
  v_today_revenue numeric;
  v_total_commission numeric;
  v_total_runner_earnings numeric;
  v_awaiting_verification int;
  v_info_requested int;
  v_pending_settlements int;
  v_completed_deliveries int;
  v_refunds numeric;
  v_rejected int;
  v_paid_today numeric;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;

  select count(*) into v_total_tx from public.transactions;
  select coalesce(sum(amount), 0) into v_today_revenue
  from public.transactions
  where transaction_type = 'RUNWISE_COMMISSION' and created_at::date = current_date;
  select coalesce(sum(amount), 0) into v_total_commission
  from public.transactions where transaction_type = 'RUNWISE_COMMISSION';
  select coalesce(sum(amount), 0) into v_total_runner_earnings
  from public.transactions where transaction_type = 'RUNNER_EARNING';
  select count(*) into v_awaiting_verification
  from public.payments where status = 'payment_verification_required';
  select count(*) into v_info_requested
  from public.payments where status = 'info_requested';
  select count(*) into v_pending_settlements
  from public.settlements where status in ('pending', 'approved');
  select count(*) into v_completed_deliveries
  from public.order_rooms r
  join public.escrow_transactions e on e.order_room_id = r.id
  where e.status = 'released';
  select coalesce(sum(amount), 0) into v_refunds
  from public.transactions where transaction_type = 'REFUND';
  select count(*) into v_rejected from public.payments where status = 'rejected';
  select coalesce(sum(amount), 0) into v_paid_today
  from public.transactions
  where transaction_type = 'CUSTOMER_PAYMENT' and created_at::date = current_date;

  return jsonb_build_object(
    'total_transactions', v_total_tx,
    'today_revenue', round(v_today_revenue, 2),
    'paid_today', round(v_paid_today, 2),
    'total_commission', round(v_total_commission, 2),
    'total_runner_earnings', round(v_total_runner_earnings, 2),
    'awaiting_verification', v_awaiting_verification,
    'info_requested', v_info_requested,
    'pending_settlements', v_pending_settlements,
    'completed_deliveries', v_completed_deliveries,
    'refunds', round(v_refunds, 2),
    'rejected_payments', v_rejected
  );
end;
$$;

revoke all on function public.get_admin_payment_dashboard() from public, anon;
grant execute on function public.get_admin_payment_dashboard() to authenticated;

-- ---------------------------------------------------------------------------
-- Updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_payments_touch on public.payments;
create trigger trg_payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_settlements_touch on public.settlements;
create trigger trg_settlements_touch before update on public.settlements
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_wallet_ledgers_touch on public.wallet_ledgers;
create trigger trg_wallet_ledgers_touch before update on public.wallet_ledgers
  for each row execute function public.touch_updated_at();

commit;
