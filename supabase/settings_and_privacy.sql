-- ============================================================================
-- RUNWISE — PLATFORM SETTINGS, PUBLIC PROFILE PRIVACY FIX, PROXIMITY REVEAL
-- ============================================================================
-- Run this after schema.sql, functions.sql, and storage.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PRIVACY FIX: the original schema.sql included a "profiles_select_public_basics"
-- policy with `using (true)` on the *whole* profiles table — meaning any
-- signed-in user could query someone else's `phone` column directly, not just
-- the name/rating fields the UI actually shows. Row Level Security can't
-- restrict individual columns, only rows, so the fix is a separate table that
-- only ever holds the safe-to-share fields.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_public_basics" on profiles;

create table if not exists public_profiles (
  id uuid primary key references profiles(id) on delete cascade,
  full_name text,
  rating_sum numeric,
  rating_count int,
  run_score_level run_score_level,
  updated_at timestamptz not null default now()
);

alter table public_profiles enable row level security;

create policy "public_profiles_read_all" on public_profiles
  for select using (true);

create policy "public_profiles_admin_write" on public_profiles
  for all using (is_admin())
  with check (is_admin());

create or replace function sync_public_profile()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public_profiles (id, full_name, rating_sum, rating_count, run_score_level, updated_at)
  values (new.id, new.full_name, new.rating_sum, new.rating_count, new.run_score_level, now())
  on conflict (id) do update set
    full_name = excluded.full_name,
    rating_sum = excluded.rating_sum,
    rating_count = excluded.rating_count,
    run_score_level = excluded.run_score_level,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_profile_change_sync_public on profiles;
create trigger on_profile_change_sync_public
  after insert or update of full_name, rating_sum, rating_count, run_score_level on profiles
  for each row execute procedure sync_public_profile();

-- Backfill existing rows
insert into public_profiles (id, full_name, rating_sum, rating_count, run_score_level)
select id, full_name, rating_sum, rating_count, run_score_level from profiles
on conflict (id) do update set
  full_name = excluded.full_name, rating_sum = excluded.rating_sum,
  rating_count = excluded.rating_count, run_score_level = excluded.run_score_level;

-- ---------------------------------------------------------------------------
-- PLATFORM SETTINGS — single-row table so admins can tune fees/thresholds
-- without a code deploy. accept_match() reads from this instead of having
-- percentages hardcoded.
-- ---------------------------------------------------------------------------
create table if not exists platform_settings (
  id int primary key default 1,
  runner_fee_pct numeric not null default 0.12,
  platform_fee_pct numeric not null default 0.05,
  protection_fee_pct numeric not null default 0.03,
  max_shopping_value numeric not null default 5000,
  runscore_silver_min int not null default 60,
  runscore_gold_min int not null default 80,
  runscore_platinum_min int not null default 95,
  proximity_reveal_meters numeric not null default 500,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),
  constraint single_row check (id = 1)
);

insert into platform_settings (id) values (1) on conflict (id) do nothing;

alter table platform_settings enable row level security;

create policy "platform_settings_read_all" on platform_settings
  for select using (true);

create policy "platform_settings_admin_write" on platform_settings
  for update using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- Auto-assign RunScore tier whenever run_score changes, using the
-- thresholds an admin has configured.
-- ---------------------------------------------------------------------------
create or replace function apply_run_score_level()
returns trigger
language plpgsql
security definer
as $$
declare
  s platform_settings%rowtype;
begin
  select * into s from platform_settings where id = 1;
  new.run_score_level := case
    when new.run_score >= s.runscore_platinum_min then 'platinum'
    when new.run_score >= s.runscore_gold_min then 'gold'
    when new.run_score >= s.runscore_silver_min then 'silver'
    else 'bronze'
  end;
  return new;
end;
$$;

drop trigger if exists on_run_score_change on profiles;
create trigger on_run_score_change
  before insert or update of run_score on profiles
  for each row execute procedure apply_run_score_level();

-- ---------------------------------------------------------------------------
-- accept_match: now reads fee percentages from platform_settings instead of
-- hardcoded 0.12 / 0.05 / 0.03.
-- ---------------------------------------------------------------------------
create or replace function accept_match(p_match_id uuid)
returns table (order_room_id uuid, match_status match_status)
language plpgsql
security definer
as $$
declare
  m matches%rowtype;
  new_room_id uuid;
  s platform_settings%rowtype;
begin
  select * into s from platform_settings where id = 1;
  select * into m from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;

  if auth.uid() <> m.customer_id and auth.uid() <> m.runner_id and not is_admin() then
    raise exception 'Not a participant in this match';
  end if;

  if auth.uid() = m.customer_id then
    update matches set status = case
      when status = 'accepted_by_runner' then 'confirmed'
      else 'accepted_by_customer'
    end where id = p_match_id;
  elsif auth.uid() = m.runner_id then
    update matches set status = case
      when status = 'accepted_by_customer' then 'confirmed'
      else 'accepted_by_runner'
    end where id = p_match_id;
  end if;

  select * into m from matches where id = p_match_id;

  if m.status = 'confirmed' then
    insert into order_rooms (match_id, customer_id, runner_id)
    values (m.id, m.customer_id, m.runner_id)
    on conflict (match_id) do nothing
    returning id into new_room_id;

    if new_room_id is null then
      select id into new_room_id from order_rooms where match_id = m.id;
    else
      insert into escrow_transactions (order_room_id, item_value, runner_fee, platform_fee, protection_fee)
      select new_room_id, r.estimated_value,
        round(r.estimated_value * s.runner_fee_pct, 2),
        round(r.estimated_value * s.platform_fee_pct, 2),
        round(r.estimated_value * s.protection_fee_pct, 2)
      from requests r where r.id = m.request_id;

      update requests set status = 'matched' where id = m.request_id;
      update trips set spaces_remaining = greatest(spaces_remaining - 1, 0) where id = m.trip_id;
    end if;
  end if;

  return query select new_room_id, m.status;
end;
$$;

-- ---------------------------------------------------------------------------
-- LIVE LOCATIONS — short-lived per-order-room position sharing. Each
-- participant upserts their own row directly (RLS enforces "own row only,
-- and only if you're actually in this order room").
-- ---------------------------------------------------------------------------
create table if not exists live_locations (
  order_room_id uuid not null references order_rooms(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  lat numeric not null,
  lng numeric not null,
  updated_at timestamptz not null default now(),
  primary key (order_room_id, user_id)
);

alter table live_locations enable row level security;

create policy "live_locations_participant_read" on live_locations
  for select using (
    is_admin() or exists (
      select 1 from order_rooms r
      where r.id = order_room_id and (r.customer_id = auth.uid() or r.runner_id = auth.uid())
    )
  );

create policy "live_locations_own_write" on live_locations
  for insert with check (
    auth.uid() = user_id and exists (
      select 1 from order_rooms r
      where r.id = order_room_id and (r.customer_id = auth.uid() or r.runner_id = auth.uid())
    )
  );

create policy "live_locations_own_update" on live_locations
  for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- ACCOUNT RESTRICTION / SUSPENSION ENFORCEMENT
-- ---------------------------------------------------------------------------
-- resolve_dispute() (see functions.sql) already sets profiles.restricted /
-- profiles.suspended. This is where that actually starts to matter: a
-- restricted or suspended account can no longer create new marketplace
-- activity (new trips, new requests). They can still view existing orders,
-- chat, post journey milestones, and receive payouts on work already in
-- progress — restriction stops new business, it doesn't strand a delivery
-- that's already underway. Suspension (runner-only) is enforced the same way
-- at the database level; the frontend additionally forces a sign-out and
-- shows a blocked screen so a suspended runner isn't left staring at a
-- confusing half-working UI.
-- ---------------------------------------------------------------------------
create or replace function is_active_account(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
as $$
  select not coalesce(
    (select restricted or suspended from profiles where id = p_user_id),
    false
  );
$$;

drop policy if exists "trips_owner_write" on trips;
create policy "trips_owner_write" on trips
  for insert with check (auth.uid() = runner_id and is_active_account());

drop policy if exists "requests_owner_write" on requests;
create policy "requests_owner_write" on requests
  for insert with check (auth.uid() = customer_id and is_active_account());

-- ---------------------------------------------------------------------------
-- fund_escrow_serverside: for when a REAL payment gateway is wired up.
--
-- The client-callable fund_escrow() (in functions.sql) trusts the logged-in
-- customer's own claim that they've paid — fine for this demo build, entirely
-- wrong once real money is involved. Once you have real gateway credentials,
-- switch the frontend's "Fund Escrow" button to instead redirect to the
-- gateway's checkout page, and have the gateway's webhook call this function
-- (via a Supabase Edge Function using the service role key — see
-- supabase/functions/payment-webhook/) after it has independently confirmed
-- payment. Locked down below so only the service role can call it — no
-- authenticated user, however they authenticate, can invoke this directly.
-- ---------------------------------------------------------------------------
create or replace function fund_escrow_serverside(p_order_room_id uuid, p_method text, p_gateway_reference text)
returns escrow_transactions
language plpgsql
security definer
as $$
declare
  esc escrow_transactions%rowtype;
begin
  select * into esc from escrow_transactions where order_room_id = p_order_room_id for update;
  if not found then raise exception 'Escrow record not found'; end if;
  if esc.status <> 'awaiting_funding' then
    raise exception 'Escrow is not awaiting funding (current status: %)', esc.status;
  end if;

  update escrow_transactions set status = 'funded', updated_at = now()
    where order_room_id = p_order_room_id
    returning * into esc;

  insert into journey_milestones (order_room_id, milestone, note)
  values (p_order_room_id, 'heading_to_pickup', 'Escrow funded via ' || p_method || ' (gateway ref: ' || p_gateway_reference || ')');

  return esc;
end;
$$;

revoke execute on function fund_escrow_serverside(uuid, text, text) from public, authenticated, anon;
grant execute on function fund_escrow_serverside(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- get_nearby_contact: the ONLY way a phone number crosses from one
-- participant to the other. Computes distance server-side (Haversine) so a
-- client can't just claim "we're close" — it re-derives that from both
-- parties' most recent reported positions and only discloses the number
-- (from the real `profiles` table, which is no longer publicly readable)
-- when they're genuinely within `platform_settings.proximity_reveal_meters`.
-- ---------------------------------------------------------------------------
create or replace function get_nearby_contact(p_order_room_id uuid)
returns table (revealed boolean, phone text, distance_meters numeric)
language plpgsql
security definer
as $$
declare
  room order_rooms%rowtype;
  other_id uuid;
  mine live_locations%rowtype;
  theirs live_locations%rowtype;
  s platform_settings%rowtype;
  d numeric;
  earth_radius_m constant numeric := 6371000;
  lat1 numeric; lat2 numeric; dlat numeric; dlng numeric; a numeric;
begin
  select * into room from order_rooms where id = p_order_room_id;
  if not found then raise exception 'Order room not found'; end if;
  if auth.uid() <> room.customer_id and auth.uid() <> room.runner_id then
    raise exception 'Not a participant';
  end if;

  other_id := case when auth.uid() = room.customer_id then room.runner_id else room.customer_id end;

  select * into mine from live_locations where order_room_id = p_order_room_id and user_id = auth.uid();
  select * into theirs from live_locations where order_room_id = p_order_room_id and user_id = other_id;

  if mine is null or theirs is null then
    return query select false, null::text, null::numeric;
    return;
  end if;

  -- Haversine distance in meters
  lat1 := radians(mine.lat); lat2 := radians(theirs.lat);
  dlat := radians(theirs.lat - mine.lat);
  dlng := radians(theirs.lng - mine.lng);
  a := sin(dlat/2)^2 + cos(lat1) * cos(lat2) * sin(dlng/2)^2;
  d := earth_radius_m * 2 * atan2(sqrt(a), sqrt(1-a));

  select * into s from platform_settings where id = 1;

  if d <= s.proximity_reveal_meters then
    return query select true, (select phone from profiles where id = other_id), round(d, 1);
  else
    return query select false, null::text, round(d, 1);
  end if;
end;
$$;
