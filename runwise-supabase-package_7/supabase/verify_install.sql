-- ============================================================================
-- RUNWISE — INSTALL VERIFICATION
-- ============================================================================
-- Run this after schema.sql, functions.sql, storage.sql, and
-- settings_and_privacy.sql. It doesn't modify anything — just reports
-- what's missing, if anything, so you catch a skipped step immediately
-- instead of three test-flow steps later.
-- ============================================================================

do $$
declare
  missing text[] := '{}';
  expected_tables text[] := array[
    'profiles','runner_verifications','vehicles','trips','requests','matches',
    'order_rooms','order_messages','proof_uploads','journey_milestones',
    'escrow_transactions','wallets','wallet_transactions','ratings','disputes',
    'restricted_items','admin_audit_log','public_profiles','platform_settings',
    'live_locations'
  ];
  expected_functions text[] := array[
    'is_admin','handle_new_user','accept_match','fund_escrow','add_milestone',
    'set_delivery_pin','confirm_delivery','request_withdrawal','raise_dispute',
    'resolve_dispute','apply_rating','sync_public_profile','apply_run_score_level',
    'is_active_account','get_nearby_contact','fund_escrow_serverside'
  ];
  t text;
  f text;
begin
  foreach t in array expected_tables loop
    if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      missing := array_append(missing, 'TABLE: ' || t);
    end if;
  end loop;

  foreach f in array expected_functions loop
    if not exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid
                   where n.nspname = 'public' and p.proname = f) then
      missing := array_append(missing, 'FUNCTION: ' || f);
    end if;
  end loop;

  if not exists (select 1 from storage.buckets where id = 'runwise-uploads') then
    missing := array_append(missing, 'STORAGE BUCKET: runwise-uploads');
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_public_basics') then
    missing := array_append(missing, 'PRIVACY ISSUE: profiles_select_public_basics policy still exists (settings_and_privacy.sql should have dropped it) — phone numbers may be publicly queryable!');
  end if;

  if array_length(missing, 1) is null then
    raise notice '✅ All expected tables, functions, and the storage bucket are present. Nothing missing.';
  else
    raise notice '❌ Missing % item(s):', array_length(missing, 1);
    for i in 1..array_length(missing, 1) loop
      raise notice '   - %', missing[i];
    end loop;
  end if;
end $$;

-- Row-level security should be ON for every RunWise table (spot check).
select tablename,
       rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles','runner_verifications','vehicles','trips','requests','matches',
    'order_rooms','order_messages','proof_uploads','journey_milestones',
    'escrow_transactions','wallets','wallet_transactions','ratings','disputes',
    'restricted_items','admin_audit_log','public_profiles','platform_settings',
    'live_locations'
  )
order by tablename;

-- Should return exactly one row (the seeded default settings).
select * from platform_settings;
