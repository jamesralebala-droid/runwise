-- ============================================================================
-- RUNWISE — PATA CHECKOUT (Botswana payment gateway)
-- ============================================================================
-- Adds the Pata (pay.pata.co.bw) payment method to the payments system and a
-- wallet top-up function. The web app keeps Pata dormant until a merchant ID
-- is set in config.js (PATA_MERCHANT_ID); this migration only defines the
-- backend pieces it needs once Pata goes live.
--
-- 1. payment_methods: seeds the 'pata' method (used by the checkout select,
--    payment records and the admin portal). The payments/payment_methods
--    tables were created from the dashboard, so we only INSERT — the table is
--    assumed to exist with columns (id, display_name, is_active, sort_order,
--    recipient_name).
-- 2. request_wallet_topup: security-definer RPC that credits the caller's
--    wallet available_balance and writes a ledger entry, exactly mirroring
--    request_withdrawal's style (single place that mutates wallet state).
--
-- Safe to re-run.
-- ============================================================================

-- 1. Payment method row (idempotent). mode='instant' because Pata confirms
--    payments in real time (unlike the manual Orange Money flow).
insert into public.payment_methods (id, display_name, mode, is_active, sort_order)
values ('pata', 'Pata', 'instant', true, 5)
on conflict (id) do update
  set display_name = excluded.display_name,
      mode = excluded.mode,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order;

-- 2. Wallet top-up RPC. Only the owner (or an admin) may top up their wallet;
--    the amount is credited to available_balance and recorded in the ledger
--    with the Pata transaction reference for reconciliation.
create or replace function public.request_wallet_topup(p_amount numeric, p_reference text default null)
returns wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  w wallets%rowtype;
  tx wallet_transactions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select * into w from wallets where user_id = auth.uid() for update;
  if not found then
    raise exception 'Wallet not found';
  end if;

  update wallets
    set available_balance = available_balance + p_amount
  where id = w.id;

  insert into wallet_transactions (wallet_id, amount, type, reference)
  values (w.id, p_amount, 'wallet_topup', p_reference)
  returning * into tx;

  return tx;
end;
$$;

grant execute on function public.request_wallet_topup(numeric, text) to authenticated;
