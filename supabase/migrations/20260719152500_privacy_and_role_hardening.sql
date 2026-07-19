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
