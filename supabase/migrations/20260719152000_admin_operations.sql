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
