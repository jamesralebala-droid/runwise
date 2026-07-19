-- RUNWISE ONE-TIME ADMIN INSTALL (live-project corrected version 3)
-- First admin: jamesralebala@gmail.com
-- Run this entire file once in Supabase SQL Editor.


-- ============================================================================
-- supabase/migrations/20260719132500_add_propose_match.sql
-- ============================================================================

-- Adds the runner-to-customer matching RPC used by the mobile app.
-- Safe to run more than once.

create or replace function public.propose_match(
  p_request_id uuid,
  p_trip_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_runner_id uuid;
  v_customer_id uuid;
  v_trip_from text;
  v_trip_to text;
  v_trip_status text;
  v_request_from text;
  v_request_to text;
  v_request_status text;
  v_match_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  select runner_id, from_city, to_city, status
    into v_runner_id, v_trip_from, v_trip_to, v_trip_status
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Trip not found';
  end if;

  if v_runner_id <> v_actor_id then
    raise exception 'Only the runner who owns this trip can propose a match';
  end if;

  if v_trip_status not in ('leaving_soon', 'today', 'tomorrow', 'upcoming') then
    raise exception 'This trip is not available for matching';
  end if;

  select customer_id, from_city, to_city, status
    into v_customer_id, v_request_from, v_request_to, v_request_status
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_request_status <> 'open' then
    raise exception 'This request is no longer open';
  end if;

  if v_customer_id = v_actor_id then
    raise exception 'You cannot match your own request';
  end if;

  if lower(trim(v_trip_from)) <> lower(trim(v_request_from))
     or lower(trim(v_trip_to)) <> lower(trim(v_request_to)) then
    raise exception 'The request does not match this trip route';
  end if;

  select id
    into v_match_id
  from public.matches
  where trip_id = p_trip_id
    and request_id = p_request_id
  order by created_at desc
  limit 1
  for update;

  if v_match_id is not null then
    update public.matches
      set status = 'accepted_by_runner'
    where id = v_match_id
      and status in ('declined', 'cancelled', 'proposed');

    return v_match_id;
  end if;

  v_match_id := gen_random_uuid();

  insert into public.matches (
    id,
    trip_id,
    request_id,
    runner_id,
    customer_id,
    status
  )
  values (
    v_match_id,
    p_trip_id,
    p_request_id,
    v_runner_id,
    v_customer_id,
    'accepted_by_runner'
  );

  return v_match_id;
end;
$function$;

revoke all on function public.propose_match(uuid, uuid) from public;
grant execute on function public.propose_match(uuid, uuid) to authenticated;

comment on function public.propose_match(uuid, uuid)
  is 'Allows an authenticated runner to propose one of their available trips for an open request on the same route.';

notify pgrst, 'reload schema';

-- ============================================================================
-- supabase/migrations/20260719152000_admin_operations.sql
-- ============================================================================

-- RunWise admin operations hardening.
-- Adds review reasons, secure admin-only RPCs, account controls, and complete audit logging.

begin;

alter table public.runner_verifications
  add column if not exists rejection_reason text;

alter table public.vehicles
  add column if not exists review_status text not null default 'pending',
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason text;

update public.vehicles
set review_status = case when approved then 'approved' else 'pending' end
where review_status is null
   or (approved and review_status <> 'approved');

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'vehicles_review_status_check'
      and conrelid = 'public.vehicles'::regclass
  ) then
    alter table public.vehicles
      add constraint vehicles_review_status_check
      check (review_status in ('pending', 'approved', 'rejected'));
  end if;
end
$$;

create index if not exists idx_vehicles_review_status
  on public.vehicles (review_status, created_at);
create index if not exists idx_runner_verifications_status
  on public.runner_verifications (status, created_at);
create index if not exists idx_admin_audit_log_created_at
  on public.admin_audit_log (created_at desc);
create index if not exists idx_order_rooms_created_at
  on public.order_rooms (created_at desc);
create index if not exists idx_disputes_status_created_at
  on public.disputes (status, created_at);

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_review_runner(
  p_verification_id uuid,
  p_decision text,
  p_reason text default null
)
returns public.runner_verifications
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_result public.runner_verifications%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;
  if p_decision = 'rejected' and nullif(pg_catalog.btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A rejection reason is required';
  end if;

  update public.runner_verifications
  set status = p_decision::public.verification_status,
      reviewed_by = auth.uid(),
      reviewed_at = pg_catalog.now(),
      rejection_reason = case when p_decision = 'rejected' then pg_catalog.btrim(p_reason) else null end
  where id = p_verification_id
    and status = 'pending'
  returning * into v_result;

  if not found then
    raise exception 'Pending runner verification not found';
  end if;

  insert into public.admin_audit_log (admin_id, action, target_table, target_id, notes)
  values (
    auth.uid(),
    'review_runner_' || p_decision,
    'runner_verifications',
    p_verification_id,
    nullif(pg_catalog.btrim(coalesce(p_reason, '')), '')
  );

  return v_result;
end;
$$;

revoke all on function public.admin_review_runner(uuid, text, text) from public;
grant execute on function public.admin_review_runner(uuid, text, text) to authenticated;

create or replace function public.admin_review_vehicle(
  p_vehicle_id uuid,
  p_decision text,
  p_reason text default null
)
returns public.vehicles
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_result public.vehicles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;
  if p_decision = 'rejected' and nullif(pg_catalog.btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A rejection reason is required';
  end if;

  update public.vehicles
  set approved = (p_decision = 'approved'),
      review_status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = pg_catalog.now(),
      rejection_reason = case when p_decision = 'rejected' then pg_catalog.btrim(p_reason) else null end
  where id = p_vehicle_id
    and review_status = 'pending'
  returning * into v_result;

  if not found then
    raise exception 'Pending vehicle not found';
  end if;

  insert into public.admin_audit_log (admin_id, action, target_table, target_id, notes)
  values (
    auth.uid(),
    'review_vehicle_' || p_decision,
    'vehicles',
    p_vehicle_id,
    nullif(pg_catalog.btrim(coalesce(p_reason, '')), '')
  );

  return v_result;
end;
$$;

revoke all on function public.admin_review_vehicle(uuid, text, text) from public;
grant execute on function public.admin_review_vehicle(uuid, text, text) to authenticated;

create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_restricted boolean,
  p_suspended boolean,
  p_note text
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_result public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_user_id = auth.uid() and p_suspended then
    raise exception 'You cannot suspend your own admin account';
  end if;
  if nullif(pg_catalog.btrim(coalesce(p_note, '')), '') is null then
    raise exception 'An internal reason is required';
  end if;

  update public.profiles
  set restricted = p_restricted,
      suspended = p_suspended
  where id = p_user_id
  returning * into v_result;

  if not found then
    raise exception 'User not found';
  end if;

  insert into public.admin_audit_log (admin_id, action, target_table, target_id, notes)
  values (
    auth.uid(),
    'set_account_status',
    'profiles',
    p_user_id,
    pg_catalog.concat(
      'restricted=', p_restricted,
      ', suspended=', p_suspended,
      '; ', pg_catalog.btrim(p_note)
    )
  );

  return v_result;
end;
$$;

revoke all on function public.admin_set_account_status(uuid, boolean, boolean, text) from public;
grant execute on function public.admin_set_account_status(uuid, boolean, boolean, text) to authenticated;

create or replace function public.admin_log_event(
  p_action text,
  p_target_table text default null,
  p_target_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if nullif(pg_catalog.btrim(coalesce(p_action, '')), '') is null then
    raise exception 'Action is required';
  end if;

  insert into public.admin_audit_log (admin_id, action, target_table, target_id, notes)
  values (
    auth.uid(),
    pg_catalog.btrim(p_action),
    nullif(pg_catalog.btrim(coalesce(p_target_table, '')), ''),
    p_target_id,
    nullif(pg_catalog.btrim(coalesce(p_notes, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_log_event(text, text, uuid, text) from public;
grant execute on function public.admin_log_event(text, text, uuid, text) to authenticated;

-- Pin every security-definer function in public to a fixed search path.
-- This addresses Supabase's "Function Search Path Mutable" warnings while
-- preserving access to app objects and extension functions already in public.
do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute pg_catalog.format(
      'alter function %s set search_path = pg_catalog, public, auth',
      v_function.signature
    );
  end loop;
end
$$;

notify pgrst, 'reload schema';

commit;

-- ============================================================================
-- supabase/migrations/20260719152500_privacy_and_role_hardening.sql
-- ============================================================================

-- RunWise privacy and privilege-escalation hardening.
-- Keeps phone numbers, KYC records, vehicle reviews and admin status private.

begin;

-- The full profile row is private to its owner and administrators.
drop policy if exists "profiles_select_public_basics" on public.profiles;
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select
  using (auth.uid() = id or public.is_admin());

-- Users may edit their public name, phone and active customer/runner mode, but
-- cannot grant themselves admin mode or change scores/account restrictions.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update
  using (auth.uid() = id or public.is_admin())
  with check (
    public.is_admin()
    or (auth.uid() = id and active_role <> 'admin')
  );

revoke update on public.profiles from authenticated;
grant update (full_name, phone, active_role) on public.profiles to authenticated;

-- This RunWise project already uses public.public_profiles as a table.
-- Keep that table and expose only the four marketplace-card columns.
revoke all on public.public_profiles from public;
revoke all on public.public_profiles from anon;
revoke all on public.public_profiles from authenticated;
grant select (id, full_name, rating_sum, rating_count)
  on public.public_profiles to authenticated;

-- Never trust a requested role from signup metadata if it asks for admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_requested_role text;
  v_role public.user_role;
begin
  v_requested_role := coalesce(new.raw_user_meta_data->>'role', 'customer');
  v_role := case
    when v_requested_role = 'runner' then 'runner'::public.user_role
    else 'customer'::public.user_role
  end;

  insert into public.profiles (id, full_name, role, active_role)
  values (
    new.id,
    coalesce(nullif(pg_catalog.btrim(new.raw_user_meta_data->>'full_name'), ''), 'New User'),
    v_role,
    v_role
  );

  insert into public.wallets (user_id, owner_type)
  values (new.id, 'customer')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Owners can submit and read KYC, but cannot approve themselves.
drop policy if exists "runner_verif_owner_or_admin" on public.runner_verifications;
drop policy if exists "runner_verif_owner_select" on public.runner_verifications;
drop policy if exists "runner_verif_owner_insert_pending" on public.runner_verifications;
drop policy if exists "runner_verif_admin_all" on public.runner_verifications;

create policy "runner_verif_owner_select" on public.runner_verifications
  for select
  using (auth.uid() = user_id or public.is_admin());

create policy "runner_verif_owner_insert_pending" on public.runner_verifications
  for insert
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

create policy "runner_verif_admin_all" on public.runner_verifications
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Vehicle owners can submit/read their records but cannot set approved=true.
drop policy if exists "vehicles_owner_or_admin" on public.vehicles;
drop policy if exists "vehicles_public_read" on public.vehicles;
drop policy if exists "vehicles_owner_select" on public.vehicles;
drop policy if exists "vehicles_owner_insert_pending" on public.vehicles;
drop policy if exists "vehicles_admin_all" on public.vehicles;

create policy "vehicles_owner_select" on public.vehicles
  for select
  using (auth.uid() = user_id or public.is_admin());

create policy "vehicles_owner_insert_pending" on public.vehicles
  for insert
  with check (
    auth.uid() = user_id
    and approved = false
    and review_status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

create policy "vehicles_admin_all" on public.vehicles
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Keep the privileged helper functions off the anonymous/public role.
revoke all on function public.handle_new_user() from public;
revoke all on function public.admin_review_runner(uuid, text, text) from anon;
revoke all on function public.admin_review_vehicle(uuid, text, text) from anon;
revoke all on function public.admin_set_account_status(uuid, boolean, boolean, text) from anon;
revoke all on function public.admin_log_event(text, text, uuid, text) from anon;

notify pgrst, 'reload schema';

commit;

-- ============================================================================
-- supabase/migrations/20260719153500_activate_first_admin.sql
-- ============================================================================

-- One-time RunWise owner/admin activation.
-- This must be executed from the authenticated Supabase SQL Editor.

do $$
declare
  v_user_id uuid;
begin
  select id
  into v_user_id
  from auth.users
  where lower(email) = lower('jamesralebala@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'No RunWise login exists for jamesralebala@gmail.com. Create and confirm that account in RunWise first, then run this file again.';
  end if;

  update public.profiles
  set role = 'admin',
      active_role = 'admin'
  where id = v_user_id;

  if not found then
    raise exception 'The login exists but its RunWise profile is missing. Sign in to RunWise once, then run this file again.';
  end if;
end
$$;

select
  account.email,
  profile.full_name,
  profile.role,
  profile.active_role,
  profile.suspended,
  profile.restricted
from auth.users as account
join public.profiles as profile on profile.id = account.id
where lower(account.email) = lower('jamesralebala@gmail.com');
