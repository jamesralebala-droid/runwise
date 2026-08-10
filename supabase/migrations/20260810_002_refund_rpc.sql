-- ============================================================================
-- RunWise — Refund processing RPCs
-- ============================================================================
-- Adds the admin refund lifecycle on top of the refunds table created in
-- 20260810_001_wallet_payment_system.sql:
--   admin_create_refund — create a pending refund against a PAID payment
--   admin_update_refund — process (money returned) or reject a refund
-- and refreshes get_admin_payment_dashboard with a pending_refunds count and
-- an absolute refunds total (REFUND ledger entries are outflows, i.e.
-- negative amounts).
--
-- Processing a refund writes an immutable REFUND ledger entry, flips the
-- payment to REFUNDED, voids the runner earning for that payment (the earning
-- basis is gone; paying the runner anyway is a separate ADJUSTMENT), and
-- updates the per-order wallet ledger. Safe to re-run (CREATE OR REPLACE).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- admin_create_refund: admin opens a refund against a paid payment.
-- Validates the amount against the remaining refundable balance and records
-- an audit entry. No ledger movement happens until the refund is processed.
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_refund(
  p_payment_id uuid,
  p_amount numeric default null,
  p_reason text default null
)
returns public.refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_refunded numeric;
  v_amount numeric;
  v_refund public.refunds%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;

  select * into v_payment from public.payments where id = p_payment_id;
  if not found then raise exception 'Payment not found'; end if;
  if v_payment.status <> 'paid' then
    raise exception 'Only paid payments can be refunded (current status: %)', v_payment.status;
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A refund reason is required';
  end if;

  select coalesce(sum(amount), 0) into v_refunded
  from public.refunds
  where payment_id = p_payment_id and status in ('pending', 'processed');

  v_amount := round(coalesce(p_amount, v_payment.total_amount), 2);
  if v_amount <= 0 then raise exception 'Refund amount must be greater than zero'; end if;
  if v_amount > (v_payment.total_amount - v_refunded) then
    raise exception 'Refund exceeds the remaining refundable amount (remaining: P%)',
      round(v_payment.total_amount - v_refunded, 2);
  end if;

  insert into public.refunds (payment_id, order_room_id, customer_id, amount, reason, status, notes, created_at)
  values (v_payment.id, v_payment.order_room_id, v_payment.customer_id, v_amount, btrim(p_reason), 'pending', null, now())
  returning * into v_refund;

  perform public.admin_log_event('refund_created', 'refunds', v_refund.id,
    'Order ' || v_payment.order_no || ' — refund P' || v_amount || ' — ' || btrim(p_reason));

  return v_refund;
end;
$$;

revoke all on function public.admin_create_refund(uuid, numeric, text) from public, anon;
grant execute on function public.admin_create_refund(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_update_refund: process (money returned to the customer) or reject a
-- pending refund. Processing writes the immutable REFUND ledger entry, flips
-- the payment to REFUNDED, voids the runner earning for that payment and
-- updates the per-order wallet ledger + runner wallet balance cache.
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_refund(
  p_refund_id uuid,
  p_status text,
  p_notes text default null
)
returns public.refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.refunds%rowtype;
  v_payment public.payments%rowtype;
  v_wallet_id uuid;
  v_voided numeric;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  if p_status not in ('processed', 'rejected') then
    raise exception 'Invalid refund status';
  end if;

  select * into v_refund from public.refunds where id = p_refund_id;
  if not found then raise exception 'Refund not found'; end if;
  if v_refund.status <> 'pending' then
    raise exception 'Only pending refunds can be updated';
  end if;
  if p_status = 'rejected' and nullif(btrim(coalesce(p_notes, '')), '') is null then
    raise exception 'A reason is required when rejecting a refund';
  end if;

  update public.refunds
  set status = p_status,
      notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), notes),
      processed_by = (select auth.uid()),
      processed_at = case when p_status = 'processed' then now() else processed_at end
  where id = p_refund_id
  returning * into v_refund;

  if p_status = 'processed' then
    select * into v_payment from public.payments where id = v_refund.payment_id;

    -- Immutable ledger entry: money returned to the customer (outflow).
    -- ledger_write guards its own admin check and can only INSERT.
    perform public.ledger_write(
      v_refund.order_room_id, v_refund.payment_id, v_refund.customer_id, null,
      -v_refund.amount, 'REFUND', v_payment.payment_method, v_refund.id::text,
      'Refund processed' || coalesce(': ' || nullif(btrim(coalesce(p_notes, '')), ''), '')
    );

    -- Payment -> refunded
    update public.payments
    set status = 'refunded', updated_at = now()
    where id = v_refund.payment_id;

    -- Per-order wallet ledger summary
    update public.wallet_ledgers
    set refund_amount = refund_amount + v_refund.amount,
        payment_status = 'refunded',
        updated_at = now()
    where order_room_id = v_refund.order_room_id;

    -- Void the runner earning for this payment (the earning basis is gone).
    select coalesce(sum(amount), 0) into v_voided
    from public.runner_earnings
    where payment_id = v_refund.payment_id and status in ('pending', 'approved');

    update public.runner_earnings
    set status = 'rejected'
    where payment_id = v_refund.payment_id and status in ('pending', 'approved');

    -- Reflect the void in the runner wallet balance cache
    if v_voided > 0 and v_payment.runner_id is not null then
      select id into v_wallet_id from public.wallets where user_id = v_payment.runner_id;
      if v_wallet_id is not null then
        update public.wallets
        set pending_balance = greatest(pending_balance - v_voided, 0)
        where id = v_wallet_id;
        insert into public.wallet_transactions (wallet_id, amount, type, reference)
        values (v_wallet_id, -v_voided, 'runner_earning_void', v_refund.id::text);
      end if;
    end if;
  end if;

  perform public.admin_log_event(
    'refund_' || p_status, 'refunds', p_refund_id,
    'Order ' || coalesce(v_payment.order_no, '?') || ' — refund P' || v_refund.amount || ' ' || p_status ||
    coalesce(': ' || nullif(btrim(coalesce(p_notes, '')), ''), '')
  );

  return v_refund;
end;
$$;

revoke all on function public.admin_update_refund(uuid, text, text) from public, anon;
grant execute on function public.admin_update_refund(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Refreshed admin payment dashboard: adds pending_refunds and reports the
-- refunds total as a positive number (REFUND ledger rows are outflows).
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
  v_pending_refunds int;
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
  select coalesce(abs(sum(amount)), 0) into v_refunds
  from public.transactions where transaction_type = 'REFUND';
  select count(*) into v_rejected from public.payments where status = 'rejected';
  select coalesce(sum(amount), 0) into v_paid_today
  from public.transactions
  where transaction_type = 'CUSTOMER_PAYMENT' and created_at::date = current_date;
  select count(*) into v_pending_refunds
  from public.refunds where status = 'pending';

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
    'rejected_payments', v_rejected,
    'pending_refunds', v_pending_refunds
  );
end;
$$;

revoke all on function public.get_admin_payment_dashboard() from public, anon;
grant execute on function public.get_admin_payment_dashboard() to authenticated;

commit;
