-- ============================================================================
-- RunWise — COMPREHENSIVE SCHEMA COMPLETION MIGRATION
-- ============================================================================
-- Adds missing tables, columns, and indexes that the app.js code references
-- but that are not in the base schema.sql. Safe to re-run: uses IF NOT EXISTS.
--
-- Run this AFTER schema.sql, functions.sql, settings_and_privacy.sql,
-- legal.sql, migration_notifications.sql, and all other existing migrations.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. MISSING TRIPS COLUMNS (app.js sends these but base schema lacks them)
-- ---------------------------------------------------------------------------
alter table public.trips add column if not exists transport_mode text not null default 'private_car';
alter table public.trips add column if not exists transport_company text;
alter table public.trips add column if not exists licence_plate text;
alter table public.trips add column if not exists transport_id_complete boolean;
alter table public.trips add column if not exists transport_details text;
alter table public.trips add column if not exists airline text;
alter table public.trips add column if not exists flight_number text;
alter table public.trips add column if not exists from_landmark text;
alter table public.trips add column if not exists to_landmark text;
alter table public.trips add column if not exists written_directions text;

-- Transport mode check constraint (8 modes)
do $$ begin
  alter table public.trips drop constraint if exists trips_transport_mode_check;
  alter table public.trips add constraint trips_transport_mode_check
    check (transport_mode in (
      'private_car', 'bus_coach', 'combi_taxi', 'truck',
      'motorcycle', 'bicycle', 'air_travel', 'other'
    ));
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. MISSING REQUESTS COLUMNS (from_landmark, to_landmark, written_directions)
-- ---------------------------------------------------------------------------
alter table public.requests add column if not exists from_landmark text;
alter table public.requests add column if not exists to_landmark text;
alter table public.requests add column if not exists written_directions text;

-- ---------------------------------------------------------------------------
-- 3. MISSING DISPUTES COLUMN (resolved_at is in functions.sql but not schema)
-- ---------------------------------------------------------------------------
alter table public.disputes add column if not exists resolved_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4. MISSING PROFILE COLUMNS (suspended, restricted — in functions.sql)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists suspended boolean not null default false;
alter table public.profiles add column if not exists restricted boolean not null default false;

-- ---------------------------------------------------------------------------
-- 5. MISSING NOTIFICATION TABLES (from migration_notifications.sql)
--    These are created by the standalone migration file. Ensure they exist.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  description text not null,
  data jsonb default '{}'::jsonb,
  is_read boolean not null default false,
  is_high_priority boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread
  on public.notification_history (user_id, is_read, created_at desc);
create index if not exists idx_notifications_user_all
  on public.notification_history (user_id, created_at desc);

alter table public.notification_history enable row level security;

drop policy if exists "notif_select_own_or_admin" on public.notification_history;
create policy "notif_select_own_or_admin" on public.notification_history
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "notif_update_read" on public.notification_history;
create policy "notif_update_read" on public.notification_history
  for update using (auth.uid() = user_id);

-- Push subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists idx_push_sub_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_sub_own" on public.push_subscriptions;
create policy "push_sub_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push_sub_insert_own" on public.push_subscriptions;
create policy "push_sub_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_sub_delete_own" on public.push_subscriptions;
create policy "push_sub_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. LEGAL TABLES (from legal.sql — ensure they exist for the app)
-- ---------------------------------------------------------------------------
create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  version text not null,
  title text not null,
  body_html text not null,
  effective_date text,
  is_material boolean not null default false,
  status text not null default 'draft',
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (document_type, version)
);

alter table public.legal_documents enable row level security;

drop policy if exists "legal_documents_public_read_published" on public.legal_documents;
create policy "legal_documents_public_read_published" on public.legal_documents
  for select using (status = 'published' or public.is_admin());

drop policy if exists "legal_documents_admin_insert" on public.legal_documents;
create policy "legal_documents_admin_insert" on public.legal_documents
  for insert with check (public.is_admin());

drop policy if exists "legal_documents_admin_update" on public.legal_documents;
create policy "legal_documents_admin_update" on public.legal_documents
  for update using (public.is_admin());

-- Legal acceptances
create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null,
  document_version text not null,
  acceptance_context text not null default 'registration',
  related_record_id uuid,
  user_role text,
  created_at timestamptz not null default now()
);

create index if not exists idx_legal_acceptances_user_type
  on public.legal_acceptances (user_id, document_type, created_at desc);

alter table public.legal_acceptances enable row level security;

drop policy if exists "legal_acceptances_select_own_or_admin" on public.legal_acceptances;
create policy "legal_acceptances_select_own_or_admin" on public.legal_acceptances
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "legal_acceptances_insert_own" on public.legal_acceptances;
create policy "legal_acceptances_insert_own" on public.legal_acceptances
  for insert with check (auth.uid() = user_id);

-- Legal compliance flags
create table if not exists public.legal_compliance_flags (
  id uuid primary key default gen_random_uuid(),
  flag_type text not null,
  scope_type text not null default 'global',
  scope_value text,
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.legal_compliance_flags enable row level security;

drop policy if exists "legal_flags_select_all" on public.legal_compliance_flags;
create policy "legal_flags_select_all" on public.legal_compliance_flags
  for select using (true);

drop policy if exists "legal_flags_admin_write" on public.legal_compliance_flags;
create policy "legal_flags_admin_write" on public.legal_compliance_flags
  for all using (public.is_admin()) with check (public.is_admin());

-- has_accepted_current RPC (used by app.js for runner activation gate)
create or replace function public.has_accepted_current(p_document_type text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_latest text;
  v_accepted text;
begin
  select version into v_latest
  from public.legal_documents
  where document_type = p_document_type and status = 'published'
  order by created_at desc limit 1;

  if v_latest is null then return true; end if;

  select document_version into v_accepted
  from public.legal_acceptances
  where user_id = auth.uid() and document_type = p_document_type
  order by created_at desc limit 1;

  return v_accepted = v_latest;
end;
$$;

revoke all on function public.has_accepted_current(text) from public;
grant execute on function public.has_accepted_current(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. GET RUNNER WALLET SUMMARY RPC (used by earningsView in payments.js)
-- ---------------------------------------------------------------------------
create or replace function public.get_runner_wallet_summary(p_runner_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_wallet record;
  v_result json;
begin
  if (select auth.uid()) <> p_runner_id and not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select * into v_wallet from public.wallets where user_id = p_runner_id;
  if not found then
    return json_build_object('available', 0, 'pending', 0, 'total_earned', 0, 'completed_deliveries', 0);
  end if;

  select json_build_object(
    'available', v_wallet.available_balance,
    'pending', v_wallet.pending_balance,
    'total_earned', coalesce((select sum(amount) from public.wallet_transactions where wallet_id = v_wallet.id and amount > 0), 0),
    'completed_deliveries', coalesce((select count(*) from public.order_rooms where runner_id = p_runner_id and is_read_only = true), 0)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_runner_wallet_summary(uuid) from public;
grant execute on function public.get_runner_wallet_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. REQUEST SETTLEMENT RPC (used by payments.js)
-- ---------------------------------------------------------------------------
create or replace function public.request_settlement(p_amount numeric, p_method text)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_wallet record;
begin
  select * into v_wallet from public.wallets where user_id = auth.uid() for update;
  if not found then raise exception 'Wallet not found'; end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if p_amount > v_wallet.available_balance then
    raise exception 'Insufficient available balance';
  end if;

  insert into public.settlements (runner_id, amount, status, payment_method, requested_by)
  values (auth.uid(), p_amount, 'pending', p_method, auth.uid());
end;
$$;

revoke all on function public.request_settlement(numeric, text) from public;
grant execute on function public.request_settlement(numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. ADDITIONAL INDEXES FOR PERFORMANCE
-- ---------------------------------------------------------------------------
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_active_role on public.profiles (active_role);
create index if not exists idx_profiles_suspended on public.profiles (suspended) where suspended = true;
create index if not exists idx_profiles_restricted on public.profiles (restricted) where restricted = true;
create index if not exists idx_order_rooms_customer on public.order_rooms (customer_id, created_at desc);
create index if not exists idx_order_rooms_runner on public.order_rooms (runner_id, created_at desc);
create index if not exists idx_disputes_room on public.disputes (order_room_id);
create index if not exists idx_ratings_room on public.ratings (order_room_id);
create index if not exists idx_ratings_ratee on public.ratings (ratee_id);
create index if not exists idx_live_locations_room on public.live_locations (order_room_id);

-- ---------------------------------------------------------------------------
-- 10. NOTIFY PostgREST to reload schema
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';

commit;
