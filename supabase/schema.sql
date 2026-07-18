-- ============================================================================
-- RUNWISE — SUPABASE SCHEMA (Version 1)
-- ============================================================================
-- Run this once in your Supabase project's SQL Editor (or via `supabase db push`).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE everywhere it can.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('customer','runner','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_type as enum ('shopping','parcel','documents','medicine','gift','business_stock','large_cargo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type trip_status as enum ('leaving_soon','today','tomorrow','upcoming','in_progress','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type run_score_level as enum ('bronze','silver','gold','platinum');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_status as enum ('proposed','accepted_by_customer','accepted_by_runner','confirmed','declined','cancelled','completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type escrow_status as enum (
    'awaiting_funding','funded','locked','purchase_authorised','shopping','collected',
    'journey_active','delivery_pending','released','refunded','partially_refunded',
    'frozen','disputed','cancelled','expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type journey_milestone_type as enum (
    'heading_to_pickup','collected','shopping_started','shopping_complete','journey_started',
    'border_reached','customs_processing','border_cleared','destination_reached',
    'out_for_delivery','delivered','delayed','personal_stop','vehicle_breakdown','emergency'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type proof_stage as enum ('shopping','collection','delivery');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dispute_status as enum ('open','reviewing','resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type verification_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wallet_owner_type as enum ('customer','runner','treasury');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- PROFILES  (1:1 with auth.users) — created before is_admin() below, since
-- that function references this table and `language sql` functions are
-- validated at creation time (unlike plpgsql), so the table must exist first.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role user_role not null default 'customer',       -- primary/registered role
  active_role user_role not null default 'customer', -- which portal they're currently using
  run_score int not null default 50,
  run_score_level run_score_level not null default 'bronze',
  rating_sum numeric not null default 0,
  rating_count int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- HELPER: is_admin()
-- ---------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

alter table profiles enable row level security;

create policy "profiles_select_own_or_admin" on profiles
  for select using (auth.uid() = id or is_admin());

create policy "profiles_select_public_basics" on profiles
  for select using (true); -- name/rating needs to be visible on trip/request cards; sensitive fields kept in other tables

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id or is_admin());

create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, role, active_role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'customer'),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'customer')
  );

  insert into public.wallets (user_id, owner_type) values (new.id, 'customer');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------------------------------------------------------------------------
-- RUNNER VERIFICATIONS (KYC)
-- ---------------------------------------------------------------------------
create table if not exists runner_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  id_document_url text,
  selfie_url text,
  next_of_kin_name text,
  next_of_kin_phone text,
  status verification_status not null default 'pending',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table runner_verifications enable row level security;

create policy "runner_verif_owner_or_admin" on runner_verifications
  for all using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- ---------------------------------------------------------------------------
-- VEHICLES
-- ---------------------------------------------------------------------------
create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  make_model text not null,
  plate_number text,
  photo_urls text[] not null default '{}',
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table vehicles enable row level security;

create policy "vehicles_owner_or_admin" on vehicles
  for all using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

create policy "vehicles_public_read" on vehicles
  for select using (true);

-- ---------------------------------------------------------------------------
-- TRIPS
-- ---------------------------------------------------------------------------
create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  runner_id uuid not null references profiles(id) on delete cascade,
  vehicle_id uuid references vehicles(id),
  from_country text not null,
  from_city text not null,
  to_country text not null,
  to_city text not null,
  depart_date date not null,
  depart_time time not null,
  stops text[] not null default '{}',
  capacity_kg numeric not null default 0,
  capacity_spaces int not null default 0,
  spaces_remaining int not null default 0,
  services request_type[] not null default '{}',
  potential_earnings numeric not null default 0,
  status trip_status not null default 'upcoming',
  created_at timestamptz not null default now()
);

alter table trips enable row level security;

create policy "trips_public_read" on trips
  for select using (true);

create policy "trips_owner_write" on trips
  for insert with check (auth.uid() = runner_id);

create policy "trips_owner_update" on trips
  for update using (auth.uid() = runner_id or is_admin());

create policy "trips_owner_delete" on trips
  for delete using (auth.uid() = runner_id or is_admin());

-- ---------------------------------------------------------------------------
-- REQUESTS
-- ---------------------------------------------------------------------------
create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  type request_type not null,
  from_city text not null,
  to_city text not null,
  estimated_value numeric not null default 0,
  details text,
  status text not null default 'open', -- open | matched | cancelled
  created_at timestamptz not null default now()
);

alter table requests enable row level security;

create policy "requests_public_read_open" on requests
  for select using (status = 'open' or auth.uid() = customer_id or is_admin());

create policy "requests_owner_write" on requests
  for insert with check (auth.uid() = customer_id);

create policy "requests_owner_update" on requests
  for update using (auth.uid() = customer_id or is_admin());

-- ---------------------------------------------------------------------------
-- MATCHES / BOOKINGS
-- ---------------------------------------------------------------------------
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  request_id uuid not null references requests(id) on delete cascade,
  runner_id uuid not null references profiles(id),
  customer_id uuid not null references profiles(id),
  status match_status not null default 'proposed',
  created_at timestamptz not null default now(),
  unique (trip_id, request_id)
);

alter table matches enable row level security;

create policy "matches_participant_or_admin" on matches
  for all using (auth.uid() = runner_id or auth.uid() = customer_id or is_admin())
  with check (auth.uid() = runner_id or auth.uid() = customer_id or is_admin());

-- ---------------------------------------------------------------------------
-- ORDER ROOMS  (created once both parties accept)
-- ---------------------------------------------------------------------------
create table if not exists order_rooms (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references matches(id) on delete cascade,
  customer_id uuid not null references profiles(id),
  runner_id uuid not null references profiles(id),
  delivery_pin_hash text,
  is_read_only boolean not null default false,
  created_at timestamptz not null default now()
);

alter table order_rooms enable row level security;

create policy "order_rooms_participant_or_admin" on order_rooms
  for all using (auth.uid() = customer_id or auth.uid() = runner_id or is_admin())
  with check (auth.uid() = customer_id or auth.uid() = runner_id or is_admin());

-- ---------------------------------------------------------------------------
-- ORDER MESSAGES (Order Room chat)
-- ---------------------------------------------------------------------------
create table if not exists order_messages (
  id uuid primary key default gen_random_uuid(),
  order_room_id uuid not null references order_rooms(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  message text not null,
  created_at timestamptz not null default now()
);

alter table order_messages enable row level security;

create policy "order_messages_participant_or_admin" on order_messages
  for all using (
    is_admin() or exists (
      select 1 from order_rooms r
      where r.id = order_room_id and (r.customer_id = auth.uid() or r.runner_id = auth.uid())
    )
  )
  with check (
    is_admin() or exists (
      select 1 from order_rooms r
      where r.id = order_room_id and (r.customer_id = auth.uid() or r.runner_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- PROOF UPLOADS
-- ---------------------------------------------------------------------------
create table if not exists proof_uploads (
  id uuid primary key default gen_random_uuid(),
  order_room_id uuid not null references order_rooms(id) on delete cascade,
  stage proof_stage not null,
  file_url text,
  amount numeric,
  note text,
  created_at timestamptz not null default now()
);

alter table proof_uploads enable row level security;

create policy "proof_uploads_participant_or_admin" on proof_uploads
  for all using (
    is_admin() or exists (
      select 1 from order_rooms r
      where r.id = order_room_id and (r.customer_id = auth.uid() or r.runner_id = auth.uid())
    )
  )
  with check (
    is_admin() or exists (
      select 1 from order_rooms r
      where r.id = order_room_id and (r.customer_id = auth.uid() or r.runner_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- JOURNEY MILESTONES
-- ---------------------------------------------------------------------------
create table if not exists journey_milestones (
  id uuid primary key default gen_random_uuid(),
  order_room_id uuid not null references order_rooms(id) on delete cascade,
  milestone journey_milestone_type not null,
  note text,
  created_at timestamptz not null default now()
);

alter table journey_milestones enable row level security;

create policy "milestones_participant_or_admin" on journey_milestones
  for all using (
    is_admin() or exists (
      select 1 from order_rooms r
      where r.id = order_room_id and (r.customer_id = auth.uid() or r.runner_id = auth.uid())
    )
  )
  with check (
    is_admin() or exists (
      select 1 from order_rooms r
      where r.id = order_room_id and (r.customer_id = auth.uid() or r.runner_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- ESCROW TRANSACTIONS  (one active escrow record per order room)
-- ---------------------------------------------------------------------------
create table if not exists escrow_transactions (
  id uuid primary key default gen_random_uuid(),
  order_room_id uuid not null unique references order_rooms(id) on delete cascade,
  item_value numeric not null default 0,
  runner_fee numeric not null default 0,
  platform_fee numeric not null default 0,
  protection_fee numeric not null default 0,
  priority_fee numeric not null default 0,
  total numeric generated always as (item_value + runner_fee + platform_fee + protection_fee + priority_fee) stored,
  status escrow_status not null default 'awaiting_funding',
  delivery_pin_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table escrow_transactions enable row level security;

create policy "escrow_participant_or_admin" on escrow_transactions
  for select using (
    is_admin() or exists (
      select 1 from order_rooms r
      where r.id = order_room_id and (r.customer_id = auth.uid() or r.runner_id = auth.uid())
    )
  );

-- Escrow status changes should go through a server-side function (definer),
-- never a direct client update, so financial logic stays server-side.
create policy "escrow_admin_write_only" on escrow_transactions
  for all using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- WALLETS  (append-only ledger via wallet_transactions; balance is a cache)
-- ---------------------------------------------------------------------------
create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  owner_type wallet_owner_type not null default 'customer',
  available_balance numeric not null default 0,
  pending_balance numeric not null default 0,
  frozen_balance numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table wallets enable row level security;

create policy "wallets_owner_or_admin" on wallets
  for select using (auth.uid() = user_id or is_admin());

create policy "wallets_admin_write_only" on wallets
  for all using (is_admin())
  with check (is_admin());

create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets(id) on delete cascade,
  amount numeric not null,          -- positive = credit, negative = debit
  type text not null,               -- e.g. 'escrow_release','withdrawal','refund','platform_fee'
  reference text,                   -- e.g. order_room_id or withdrawal batch id
  created_at timestamptz not null default now()
);

alter table wallet_transactions enable row level security;

create policy "wallet_tx_owner_or_admin" on wallet_transactions
  for select using (
    is_admin() or exists (select 1 from wallets w where w.id = wallet_id and w.user_id = auth.uid())
  );

create policy "wallet_tx_admin_write_only" on wallet_transactions
  for all using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- RATINGS
-- ---------------------------------------------------------------------------
create table if not exists ratings (
  id uuid primary key default gen_random_uuid(),
  order_room_id uuid not null references order_rooms(id) on delete cascade,
  rater_id uuid not null references profiles(id),
  ratee_id uuid not null references profiles(id),
  stars int not null check (stars between 1 and 5),
  areas jsonb not null default '{}'::jsonb,
  comment text,
  created_at timestamptz not null default now(),
  unique (order_room_id, rater_id)
);

alter table ratings enable row level security;

create policy "ratings_participant_or_admin" on ratings
  for select using (true);

create policy "ratings_insert_own" on ratings
  for insert with check (auth.uid() = rater_id);

-- ---------------------------------------------------------------------------
-- DISPUTES
-- ---------------------------------------------------------------------------
create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  order_room_id uuid not null references order_rooms(id) on delete cascade,
  raised_by uuid not null references profiles(id),
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  status dispute_status not null default 'open',
  resolution text,
  resolved_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table disputes enable row level security;

create policy "disputes_participant_or_admin" on disputes
  for select using (
    is_admin() or exists (
      select 1 from order_rooms r
      where r.id = order_room_id and (r.customer_id = auth.uid() or r.runner_id = auth.uid())
    )
  );

create policy "disputes_insert_participant" on disputes
  for insert with check (
    exists (
      select 1 from order_rooms r
      where r.id = order_room_id and (r.customer_id = auth.uid() or r.runner_id = auth.uid())
    )
  );

create policy "disputes_admin_update" on disputes
  for update using (is_admin());

-- ---------------------------------------------------------------------------
-- RESTRICTED / PROHIBITED ITEMS (admin-configurable per country)
-- ---------------------------------------------------------------------------
create table if not exists restricted_items (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  item_name text not null,
  created_at timestamptz not null default now()
);

alter table restricted_items enable row level security;

create policy "restricted_items_public_read" on restricted_items
  for select using (true);

create policy "restricted_items_admin_write" on restricted_items
  for all using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- ADMIN AUDIT LOG
-- ---------------------------------------------------------------------------
create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles(id),
  action text not null,
  target_table text,
  target_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

alter table admin_audit_log enable row level security;

create policy "audit_log_admin_only" on admin_audit_log
  for all using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
create index if not exists idx_trips_route on trips (from_city, to_city, depart_date);
create index if not exists idx_requests_route on requests (from_city, to_city, status);
create index if not exists idx_matches_trip on matches (trip_id);
create index if not exists idx_matches_request on matches (request_id);
create index if not exists idx_order_messages_room on order_messages (order_room_id, created_at);
create index if not exists idx_journey_milestones_room on journey_milestones (order_room_id, created_at);
create index if not exists idx_wallet_tx_wallet on wallet_transactions (wallet_id, created_at);
