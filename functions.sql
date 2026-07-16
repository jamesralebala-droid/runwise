-- ============================================================================
-- RUNWISE — SERVER-SIDE FUNCTIONS
-- ============================================================================
-- These are the ONLY way escrow/wallet state changes. The client calls them
-- via supabase.rpc(...) — it never writes to escrow_transactions or wallets
-- directly (RLS blocks that; see schema.sql "*_admin_write_only" policies).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- accept_match: runner and customer each call this once. When both have
-- accepted, the match is confirmed and an Order Room + escrow row are created.
-- ---------------------------------------------------------------------------
create or replace function accept_match(p_match_id uuid)
returns table (order_room_id uuid, match_status match_status)
language plpgsql
security definer
as $$
declare
  m matches%rowtype;
  new_room_id uuid;
begin
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
      select new_room_id, r.estimated_value, round(r.estimated_value * 0.12, 2), round(r.estimated_value * 0.05, 2), round(r.estimated_value * 0.03, 2)
      from requests r where r.id = m.request_id;

      update requests set status = 'matched' where id = m.request_id;
      update trips set spaces_remaining = greatest(spaces_remaining - 1, 0) where id = m.trip_id;
    end if;
  end if;

  return query select new_room_id, m.status;
end;
$$;

-- ---------------------------------------------------------------------------
-- fund_escrow: customer "pays" (demo payment methods only — no real gateway
-- wired up yet). Moves the escrow row from awaiting_funding -> funded.
-- ---------------------------------------------------------------------------
create or replace function fund_escrow(p_order_room_id uuid, p_method text)
returns escrow_transactions
language plpgsql
security definer
as $$
declare
  room order_rooms%rowtype;
  esc escrow_transactions%rowtype;
begin
  select * into room from order_rooms where id = p_order_room_id;
  if not found then raise exception 'Order room not found'; end if;
  if auth.uid() <> room.customer_id and not is_admin() then
    raise exception 'Only the customer can fund escrow';
  end if;

  select * into esc from escrow_transactions where order_room_id = p_order_room_id for update;
  if esc.status <> 'awaiting_funding' then
    raise exception 'Escrow is not awaiting funding (current status: %)', esc.status;
  end if;

  update escrow_transactions
    set status = 'funded', updated_at = now()
    where order_room_id = p_order_room_id
    returning * into esc;

  insert into journey_milestones (order_room_id, milestone, note)
  values (p_order_room_id, 'heading_to_pickup', 'Escrow funded via ' || p_method || ' (demo payment)');

  return esc;
end;
$$;

-- ---------------------------------------------------------------------------
-- add_milestone: either party posts a journey update.
-- ---------------------------------------------------------------------------
create or replace function add_milestone(p_order_room_id uuid, p_milestone journey_milestone_type, p_note text default null)
returns journey_milestones
language plpgsql
security definer
as $$
declare
  room order_rooms%rowtype;
  row_out journey_milestones%rowtype;
begin
  select * into room from order_rooms where id = p_order_room_id;
  if not found then raise exception 'Order room not found'; end if;
  if auth.uid() <> room.customer_id and auth.uid() <> room.runner_id and not is_admin() then
    raise exception 'Not a participant';
  end if;

  insert into journey_milestones (order_room_id, milestone, note)
  values (p_order_room_id, p_milestone, p_note)
  returning * into row_out;

  update escrow_transactions set status = case
      when p_milestone = 'collected' then 'collected'
      when p_milestone in ('journey_started','border_reached','customs_processing','border_cleared','destination_reached') then 'journey_active'
      when p_milestone = 'out_for_delivery' then 'delivery_pending'
      else status
    end,
    updated_at = now()
  where order_room_id = p_order_room_id;

  return row_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_delivery_pin: runner or system generates the PIN at booking time;
-- stored only as a hash. Call once, right after escrow is funded.
-- ---------------------------------------------------------------------------
create or replace function set_delivery_pin(p_order_room_id uuid, p_pin text)
returns void
language plpgsql
security definer
as $$
declare
  room order_rooms%rowtype;
begin
  select * into room from order_rooms where id = p_order_room_id;
  if not found then raise exception 'Order room not found'; end if;
  if auth.uid() <> room.customer_id and auth.uid() <> room.runner_id and not is_admin() then
    raise exception 'Not a participant';
  end if;

  update order_rooms set delivery_pin_hash = crypt(p_pin, gen_salt('bf')) where id = p_order_room_id;
  update escrow_transactions set delivery_pin_hash = crypt(p_pin, gen_salt('bf')) where order_room_id = p_order_room_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_delivery: customer enters the PIN. On match, escrow releases and
-- splits automatically: runner fee -> runner wallet, platform/protection/
-- priority fees -> treasury, any unused shopping balance -> customer wallet.
-- ---------------------------------------------------------------------------
create or replace function confirm_delivery(p_order_room_id uuid, p_pin text, p_actual_spent numeric default null)
returns escrow_transactions
language plpgsql
security definer
as $$
declare
  room order_rooms%rowtype;
  esc escrow_transactions%rowtype;
  runner_wallet_id uuid;
  customer_wallet_id uuid;
  treasury_wallet_id uuid;
  spent numeric;
  unused numeric;
begin
  select * into room from order_rooms where id = p_order_room_id;
  if not found then raise exception 'Order room not found'; end if;
  if auth.uid() <> room.customer_id and not is_admin() then
    raise exception 'Only the customer can confirm delivery';
  end if;

  if room.delivery_pin_hash is null or room.delivery_pin_hash <> crypt(p_pin, room.delivery_pin_hash) then
    raise exception 'Incorrect delivery PIN';
  end if;

  select * into esc from escrow_transactions where order_room_id = p_order_room_id for update;
  if esc.status = 'released' then
    raise exception 'Escrow already released';
  end if;

  spent := coalesce(p_actual_spent, esc.item_value);
  unused := greatest(esc.item_value - spent, 0);

  select id into runner_wallet_id from wallets where user_id = room.runner_id;
  select id into customer_wallet_id from wallets where user_id = room.customer_id;

  -- Ensure a treasury wallet exists (single shared row owned by no specific user;
  -- represented here by owner_type = 'treasury' with a fixed sentinel user).
  select id into treasury_wallet_id from wallets where owner_type = 'treasury' limit 1;

  update escrow_transactions
    set status = 'released', updated_at = now()
    where order_room_id = p_order_room_id
    returning * into esc;

  update order_rooms set is_read_only = true where id = p_order_room_id;

  insert into wallet_transactions (wallet_id, amount, type, reference)
  values (runner_wallet_id, esc.runner_fee, 'escrow_release_runner_fee', p_order_room_id::text);
  update wallets set pending_balance = pending_balance + esc.runner_fee where id = runner_wallet_id;

  if treasury_wallet_id is not null then
    insert into wallet_transactions (wallet_id, amount, type, reference)
    values (treasury_wallet_id, esc.platform_fee + esc.protection_fee + esc.priority_fee, 'platform_revenue', p_order_room_id::text);
    update wallets set available_balance = available_balance + esc.platform_fee + esc.protection_fee + esc.priority_fee where id = treasury_wallet_id;
  end if;

  if unused > 0 then
    insert into wallet_transactions (wallet_id, amount, type, reference)
    values (customer_wallet_id, unused, 'unused_shopping_refund', p_order_room_id::text);
    update wallets set available_balance = available_balance + unused where id = customer_wallet_id;
  end if;

  insert into journey_milestones (order_room_id, milestone, note)
  values (p_order_room_id, 'delivered', 'Delivery confirmed via PIN');

  return esc;
end;
$$;

-- ---------------------------------------------------------------------------
-- withdraw: runner moves pending -> a withdrawal record (demo — no real payout
-- rail connected yet). Deducts from pending_balance immediately.
-- ---------------------------------------------------------------------------
create or replace function request_withdrawal(p_amount numeric, p_method text)
returns wallet_transactions
language plpgsql
security definer
as $$
declare
  w wallets%rowtype;
  tx wallet_transactions%rowtype;
begin
  select * into w from wallets where user_id = auth.uid() for update;
  if not found then raise exception 'Wallet not found'; end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if p_amount > w.pending_balance + w.available_balance then
    raise exception 'Amount exceeds withdrawable balance';
  end if;

  -- draw from available first, then pending
  if p_amount <= w.available_balance then
    update wallets set available_balance = available_balance - p_amount where id = w.id;
  else
    update wallets set
      pending_balance = pending_balance - (p_amount - available_balance),
      available_balance = 0
    where id = w.id;
  end if;

  insert into wallet_transactions (wallet_id, amount, type, reference)
  values (w.id, -p_amount, 'withdrawal_' || p_method, null)
  returning * into tx;

  return tx;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed a single treasury wallet row (idempotent). Run once after schema.sql.
-- Requires at least one admin profile to exist first, OR run this manually
-- with a chosen admin user id.
-- ---------------------------------------------------------------------------
-- Example (replace the uuid with your admin user's id from auth.users):
-- insert into wallets (user_id, owner_type) values ('00000000-0000-0000-0000-000000000000', 'treasury')
--   on conflict (user_id) do nothing;
