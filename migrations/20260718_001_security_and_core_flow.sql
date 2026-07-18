-- RunWise security and core-flow hardening
-- Safe to run once after schema.sql and functions.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. Profiles: prevent self-promotion to admin and stop exposing phone numbers.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'::public.user_role
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role public.user_role;
begin
  requested_role := case
    when new.raw_user_meta_data->>'role' = 'runner' then 'runner'::public.user_role
    else 'customer'::public.user_role
  end;

  insert into public.profiles (id, full_name, role, active_role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'New User'),
    requested_role,
    requested_role
  );

  insert into public.wallets (user_id, owner_type)
  values (
    new.id,
    case when requested_role = 'runner' then 'runner'::public.wallet_owner_type else 'customer'::public.wallet_owner_type end
  );

  return new;
end;
$$;

alter table public.profiles drop constraint if exists profiles_admin_active_role_guard;
update public.profiles
set active_role = 'customer'::public.user_role
where active_role = 'admin'::public.user_role and role <> 'admin'::public.user_role;
alter table public.profiles add constraint profiles_admin_active_role_guard
  check (active_role <> 'admin'::public.user_role or role = 'admin'::public.user_role);

revoke select, insert, update, delete on table public.profiles from anon, authenticated;
grant select (id, full_name, role, active_role, run_score, run_score_level, rating_sum, rating_count, created_at)
  on table public.profiles to authenticated;
grant update (full_name, phone, active_role) on table public.profiles to authenticated;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_select_public_basics" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_authenticated_read" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_safe_fields" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- 2. Verification and vehicles: owners submit; admins approve.
-- ---------------------------------------------------------------------------
drop policy if exists "runner_verif_owner_or_admin" on public.runner_verifications;
create policy "runner_verif_select" on public.runner_verifications
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());
create policy "runner_verif_submit" on public.runner_verifications
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'::public.verification_status
    and reviewed_by is null
    and reviewed_at is null
  );
create policy "runner_verif_admin_update" on public.runner_verifications
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "runner_verif_admin_delete" on public.runner_verifications
  for delete to authenticated using (public.is_admin());

drop policy if exists "vehicles_owner_or_admin" on public.vehicles;
drop policy if exists "vehicles_public_read" on public.vehicles;
create policy "vehicles_select" on public.vehicles
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());
create policy "vehicles_submit" on public.vehicles
  for insert to authenticated
  with check ((select auth.uid()) = user_id and approved = false);
create policy "vehicles_admin_update" on public.vehicles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "vehicles_owner_delete_pending" on public.vehicles
  for delete to authenticated
  using ((select auth.uid()) = user_id and approved = false);

-- Only verified runners using an approved vehicle may announce new trips.
drop policy if exists "trips_owner_write" on public.trips;
create policy "trips_verified_runner_insert" on public.trips
  for insert to authenticated
  with check (
    (select auth.uid()) = runner_id
    and exists (
      select 1 from public.runner_verifications rv
      where rv.user_id = (select auth.uid()) and rv.status = 'approved'::public.verification_status
    )
    and exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.user_id = (select auth.uid()) and v.approved = true
    )
  );

-- Trip/request state changes are performed by trusted functions, not arbitrary API updates.
revoke update, delete on table public.trips from anon, authenticated;
revoke update, delete on table public.requests from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Transactional tables: remove direct client mutation of trusted state.
-- ---------------------------------------------------------------------------
drop policy if exists "matches_participant_or_admin" on public.matches;
create policy "matches_participant_select" on public.matches
  for select to authenticated
  using ((select auth.uid()) in (runner_id, customer_id) or public.is_admin());

drop policy if exists "order_rooms_participant_or_admin" on public.order_rooms;
create policy "order_rooms_participant_select" on public.order_rooms
  for select to authenticated
  using ((select auth.uid()) in (customer_id, runner_id) or public.is_admin());

revoke insert, update, delete on table public.matches from anon, authenticated;
revoke insert, update, delete on table public.order_rooms from anon, authenticated;
revoke insert, update, delete on table public.journey_milestones from anon, authenticated;
revoke insert, update, delete on table public.escrow_transactions from anon, authenticated;
revoke insert, update, delete on table public.wallets from anon, authenticated;
revoke insert, update, delete on table public.wallet_transactions from anon, authenticated;

drop policy if exists "order_messages_participant_or_admin" on public.order_messages;
create policy "order_messages_select" on public.order_messages
  for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.order_rooms room
      where room.id = order_room_id and (select auth.uid()) in (room.customer_id, room.runner_id)
    )
  );
create policy "order_messages_insert" on public.order_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid()) and exists (
      select 1 from public.order_rooms room
      where room.id = order_room_id
        and room.is_read_only = false
        and (select auth.uid()) in (room.customer_id, room.runner_id)
    )
  );

drop policy if exists "milestones_participant_or_admin" on public.journey_milestones;
create policy "milestones_participant_select" on public.journey_milestones
  for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.order_rooms room
      where room.id = order_room_id and (select auth.uid()) in (room.customer_id, room.runner_id)
    )
  );

drop policy if exists "proof_uploads_participant_or_admin" on public.proof_uploads;
create policy "proof_uploads_participant_select" on public.proof_uploads
  for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.order_rooms room
      where room.id = order_room_id and (select auth.uid()) in (room.customer_id, room.runner_id)
    )
  );
create policy "proof_uploads_participant_insert" on public.proof_uploads
  for insert to authenticated
  with check (
    exists (
      select 1 from public.order_rooms room
      where room.id = order_room_id
        and room.is_read_only = false
        and (select auth.uid()) in (room.customer_id, room.runner_id)
    )
  );

drop policy if exists "ratings_insert_own" on public.ratings;
create policy "ratings_insert_completed_order" on public.ratings
  for insert to authenticated
  with check (
    rater_id = (select auth.uid())
    and exists (
      select 1
      from public.order_rooms room
      join public.escrow_transactions escrow on escrow.order_room_id = room.id
      where room.id = order_room_id
        and escrow.status = 'released'::public.escrow_status
        and (
          (room.customer_id = (select auth.uid()) and ratee_id = room.runner_id)
          or (room.runner_id = (select auth.uid()) and ratee_id = room.customer_id)
        )
    )
  );

drop policy if exists "disputes_insert_participant" on public.disputes;
create policy "disputes_insert_participant" on public.disputes
  for insert to authenticated
  with check (
    raised_by = (select auth.uid()) and exists (
      select 1 from public.order_rooms room
      where room.id = order_room_id and (select auth.uid()) in (room.customer_id, room.runner_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Match proposal, acceptance and decline live exclusively on the server.
-- ---------------------------------------------------------------------------
create or replace function public.propose_match(p_trip_id uuid, p_request_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip_row public.trips%rowtype;
  request_row public.requests%rowtype;
  match_row public.matches%rowtype;
begin
  select * into trip_row from public.trips where id = p_trip_id;
  if not found or trip_row.runner_id <> (select auth.uid()) then
    raise exception 'Trip not found or not owned by this runner';
  end if;
  if trip_row.spaces_remaining <= 0 or trip_row.status in ('completed'::public.trip_status, 'cancelled'::public.trip_status) then
    raise exception 'Trip has no available space';
  end if;

  if not exists (
    select 1 from public.runner_verifications
    where user_id = (select auth.uid()) and status = 'approved'::public.verification_status
  ) then
    raise exception 'Runner verification is required';
  end if;

  select * into request_row from public.requests where id = p_request_id and status = 'open';
  if not found then raise exception 'Request is no longer open'; end if;

  insert into public.matches (trip_id, request_id, runner_id, customer_id, status)
  values (trip_row.id, request_row.id, trip_row.runner_id, request_row.customer_id, 'accepted_by_runner')
  on conflict (trip_id, request_id) do update
    set status = case
      when public.matches.status = 'accepted_by_customer'::public.match_status then 'confirmed'::public.match_status
      else public.matches.status
    end
  returning * into match_row;

  if match_row.status = 'confirmed'::public.match_status then
    perform public.accept_match(match_row.id);
  end if;

  return match_row;
end;
$$;

create or replace function public.accept_match(p_match_id uuid)
returns table (order_room_id uuid, match_status public.match_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_row public.matches%rowtype;
  trip_row public.trips%rowtype;
  request_row public.requests%rowtype;
  new_room_id uuid;
begin
  select * into match_row from public.matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if (select auth.uid()) not in (match_row.customer_id, match_row.runner_id) and not public.is_admin() then
    raise exception 'Not a participant in this match';
  end if;
  if match_row.status in ('declined'::public.match_status, 'cancelled'::public.match_status, 'completed'::public.match_status) then
    raise exception 'This match can no longer be accepted';
  end if;

  if match_row.status <> 'confirmed'::public.match_status then
    if (select auth.uid()) = match_row.customer_id then
      update public.matches set status = case
        when status = 'accepted_by_runner'::public.match_status then 'confirmed'::public.match_status
        else 'accepted_by_customer'::public.match_status
      end where id = p_match_id;
    elsif (select auth.uid()) = match_row.runner_id then
      update public.matches set status = case
        when status = 'accepted_by_customer'::public.match_status then 'confirmed'::public.match_status
        else 'accepted_by_runner'::public.match_status
      end where id = p_match_id;
    end if;
  end if;

  select * into match_row from public.matches where id = p_match_id;
  if match_row.status = 'confirmed'::public.match_status then
    select * into request_row from public.requests where id = match_row.request_id for update;
    select * into trip_row from public.trips where id = match_row.trip_id for update;
    if request_row.status <> 'open' then raise exception 'Request is no longer open'; end if;
    if trip_row.spaces_remaining <= 0 then raise exception 'Trip has no available space'; end if;

    insert into public.order_rooms (match_id, customer_id, runner_id)
    values (match_row.id, match_row.customer_id, match_row.runner_id)
    on conflict (match_id) do nothing
    returning id into new_room_id;

    if new_room_id is null then
      select id into new_room_id from public.order_rooms where match_id = match_row.id;
    else
      insert into public.escrow_transactions (order_room_id, item_value, runner_fee, platform_fee, protection_fee)
      values (
        new_room_id,
        request_row.estimated_value,
        round(request_row.estimated_value * 0.12, 2),
        round(request_row.estimated_value * 0.05, 2),
        round(request_row.estimated_value * 0.03, 2)
      );
      update public.requests set status = 'matched' where id = request_row.id;
      update public.trips set spaces_remaining = greatest(spaces_remaining - 1, 0) where id = trip_row.id;
    end if;
  end if;

  return query select new_room_id, match_row.status;
end;
$$;

create or replace function public.decline_match(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_row public.matches%rowtype;
begin
  select * into match_row from public.matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if (select auth.uid()) not in (match_row.customer_id, match_row.runner_id) and not public.is_admin() then
    raise exception 'Not a participant in this match';
  end if;
  if match_row.status = 'confirmed'::public.match_status then
    raise exception 'A confirmed match must be cancelled through support';
  end if;
  update public.matches set status = 'declined' where id = p_match_id returning * into match_row;
  return match_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Journey and delivery financial guardrails.
-- ---------------------------------------------------------------------------
create or replace function public.add_milestone(
  p_order_room_id uuid,
  p_milestone public.journey_milestone_type,
  p_note text default null
)
returns public.journey_milestones
language plpgsql
security definer
set search_path = ''
as $$
declare
  room public.order_rooms%rowtype;
  row_out public.journey_milestones%rowtype;
begin
  select * into room from public.order_rooms where id = p_order_room_id;
  if not found then raise exception 'Order room not found'; end if;
  if (select auth.uid()) <> room.runner_id and not public.is_admin() then
    raise exception 'Only the runner can post journey milestones';
  end if;
  if room.is_read_only then raise exception 'Order room is closed'; end if;

  insert into public.journey_milestones (order_room_id, milestone, note)
  values (p_order_room_id, p_milestone, nullif(trim(p_note), ''))
  returning * into row_out;

  update public.escrow_transactions set
    status = case
      when p_milestone = 'collected'::public.journey_milestone_type then 'collected'::public.escrow_status
      when p_milestone in (
        'journey_started'::public.journey_milestone_type,
        'border_reached'::public.journey_milestone_type,
        'customs_processing'::public.journey_milestone_type,
        'border_cleared'::public.journey_milestone_type,
        'destination_reached'::public.journey_milestone_type
      ) then 'journey_active'::public.escrow_status
      when p_milestone = 'out_for_delivery'::public.journey_milestone_type then 'delivery_pending'::public.escrow_status
      else status
    end,
    updated_at = now()
  where order_room_id = p_order_room_id;

  return row_out;
end;
$$;

create or replace function public.set_delivery_pin(p_order_room_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  room public.order_rooms%rowtype;
  escrow public.escrow_transactions%rowtype;
begin
  select * into room from public.order_rooms where id = p_order_room_id;
  if not found then raise exception 'Order room not found'; end if;
  if (select auth.uid()) <> room.customer_id and not public.is_admin() then
    raise exception 'Only the customer can create the delivery PIN';
  end if;
  if p_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN must contain 4 to 6 digits'; end if;
  select * into escrow from public.escrow_transactions where order_room_id = p_order_room_id;
  if escrow.status not in (
    'funded'::public.escrow_status, 'locked'::public.escrow_status,
    'purchase_authorised'::public.escrow_status, 'shopping'::public.escrow_status,
    'collected'::public.escrow_status, 'journey_active'::public.escrow_status,
    'delivery_pending'::public.escrow_status
  ) then raise exception 'Escrow must be funded before creating a PIN'; end if;

  update public.order_rooms
    set delivery_pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
    where id = p_order_room_id;
  update public.escrow_transactions
    set delivery_pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
    where order_room_id = p_order_room_id;
end;
$$;

create or replace function public.confirm_delivery(
  p_order_room_id uuid,
  p_pin text,
  p_actual_spent numeric default null
)
returns public.escrow_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  room public.order_rooms%rowtype;
  escrow public.escrow_transactions%rowtype;
  runner_wallet_id uuid;
  customer_wallet_id uuid;
  treasury_wallet_id uuid;
  spent numeric;
  unused numeric;
begin
  select * into room from public.order_rooms where id = p_order_room_id;
  if not found then raise exception 'Order room not found'; end if;
  if (select auth.uid()) <> room.customer_id and not public.is_admin() then
    raise exception 'Only the customer can confirm delivery';
  end if;
  if room.delivery_pin_hash is null
     or room.delivery_pin_hash <> extensions.crypt(p_pin, room.delivery_pin_hash) then
    raise exception 'Incorrect delivery PIN';
  end if;

  select * into escrow from public.escrow_transactions
  where order_room_id = p_order_room_id for update;
  if escrow.status not in (
    'funded'::public.escrow_status, 'locked'::public.escrow_status,
    'purchase_authorised'::public.escrow_status, 'shopping'::public.escrow_status,
    'collected'::public.escrow_status, 'journey_active'::public.escrow_status,
    'delivery_pending'::public.escrow_status
  ) then raise exception 'Escrow is not in a releasable state'; end if;

  spent := coalesce(p_actual_spent, escrow.item_value);
  if spent < 0 or spent > escrow.item_value then
    raise exception 'Actual spend must be between 0 and the funded item value';
  end if;
  unused := escrow.item_value - spent;

  select id into runner_wallet_id from public.wallets where user_id = room.runner_id;
  select id into customer_wallet_id from public.wallets where user_id = room.customer_id;
  select id into treasury_wallet_id from public.wallets where owner_type = 'treasury'::public.wallet_owner_type limit 1;
  if runner_wallet_id is null or customer_wallet_id is null then raise exception 'Participant wallet missing'; end if;

  update public.escrow_transactions set status = 'released', updated_at = now()
  where order_room_id = p_order_room_id returning * into escrow;
  update public.order_rooms set is_read_only = true where id = p_order_room_id;

  insert into public.wallet_transactions (wallet_id, amount, type, reference)
  values (runner_wallet_id, escrow.runner_fee, 'escrow_release_runner_fee', p_order_room_id::text);
  update public.wallets set pending_balance = pending_balance + escrow.runner_fee where id = runner_wallet_id;

  if treasury_wallet_id is not null then
    insert into public.wallet_transactions (wallet_id, amount, type, reference)
    values (treasury_wallet_id, escrow.platform_fee + escrow.protection_fee + escrow.priority_fee, 'platform_revenue', p_order_room_id::text);
    update public.wallets set available_balance = available_balance + escrow.platform_fee + escrow.protection_fee + escrow.priority_fee
    where id = treasury_wallet_id;
  end if;

  if unused > 0 then
    insert into public.wallet_transactions (wallet_id, amount, type, reference)
    values (customer_wallet_id, unused, 'unused_shopping_refund', p_order_room_id::text);
    update public.wallets set available_balance = available_balance + unused where id = customer_wallet_id;
  end if;

  insert into public.journey_milestones (order_room_id, milestone, note)
  values (p_order_room_id, 'delivered', 'Delivery confirmed via PIN');
  return escrow;
end;
$$;

-- A treasury wallet must not require a fake user profile.
alter table public.wallets alter column user_id drop not null;
create unique index if not exists wallets_one_treasury
  on public.wallets (owner_type) where owner_type = 'treasury'::public.wallet_owner_type;
insert into public.wallets (user_id, owner_type)
select null, 'treasury'::public.wallet_owner_type
where not exists (select 1 from public.wallets where owner_type = 'treasury'::public.wallet_owner_type);

revoke all on function public.propose_match(uuid, uuid) from public, anon;
revoke all on function public.accept_match(uuid) from public, anon;
revoke all on function public.decline_match(uuid) from public, anon;
revoke all on function public.add_milestone(uuid, public.journey_milestone_type, text) from public, anon;
revoke all on function public.set_delivery_pin(uuid, text) from public, anon;
revoke all on function public.confirm_delivery(uuid, text, numeric) from public, anon;
grant execute on function public.propose_match(uuid, uuid) to authenticated;
grant execute on function public.accept_match(uuid) to authenticated;
grant execute on function public.decline_match(uuid) to authenticated;
grant execute on function public.add_milestone(uuid, public.journey_milestone_type, text) to authenticated;
grant execute on function public.set_delivery_pin(uuid, text) to authenticated;
grant execute on function public.confirm_delivery(uuid, text, numeric) to authenticated;

commit;
