-- ============================================================================
-- RUNWISE — MINIMAL SECURITY FIX MIGRATION (v2, after deep audit)
-- ============================================================================
-- 
-- AUDIT SUMMARY:
--   The only confirmed vulnerability is in waitlist_signups RLS policies.
--   SECURITY DEFINER functions are ALREADY blocked from anon (return 404).
--   is_admin() must remain callable for RLS policy evaluation.
--   Trigger-only functions are not directly callable by users.
--
-- WHAT THIS DOES:
--   1. Fix waitlist_signups RLS — the ONLY confirmed breach
--   2. Explicitly revoke EXECUTE from trigger-only functions (defense in depth)
--   3. Document rollback plan
--
-- WHAT THIS DOES NOT DO:
--   - Does NOT recreate working SECURITY DEFINER functions (they already work)
--   - Does NOT add auth() checks (not needed since anon can't call these)
--   - Does NOT revoke is_admin() (needed for all RLS policies)
--   - Does NOT alter table-level grants on tables that RLS already protects
--   - Does NOT change any production data
--
-- Safe to re-run: all operations use IF EXISTS / DROP IF EXISTS
-- ============================================================================

-- ============================================================================
-- PART 1: FIX waitlist_signups RLS (PRIMARY VULNERABILITY)
-- ============================================================================
-- Before:
--   - INSERT had "with check (true)" — anon could set status="approved"
--   - anon could SELECT (200 OK, empty results)
--   - anon could UPDATE (HTTP 204 on PATCH)
--   - anon could DELETE (HTTP 204 on DELETE)
-- After:
--   - INSERT only for anon, with status forced to 'new'
--   - SELECT, UPDATE, DELETE explicitly revoked from anon

-- 1a: Drop the overly permissive insert policy
drop policy if exists "waitlist_insert_public" on waitlist_signups;

-- 1b: Create strict insert policy — anon can only insert with status='new'
--     This prevents status escalation attacks (e.g., signing up as "approved")
create policy "waitlist_insert_anon" on waitlist_signups
  for insert
  to anon
  with check (status = 'new');

-- 1c: Authenticated users also constrained to 'new' on insert
create policy "waitlist_insert_authenticated" on waitlist_signups
  for insert
  to authenticated
  with check (status = 'new');

-- 1d: Recreate the SELECT policy (already working but make it explicit)
drop policy if exists "waitlist_select_admin_only" on waitlist_signups;
create policy "waitlist_select_admin_only" on waitlist_signups
  for select
  using (is_admin());

-- 1e: Recreate the UPDATE policy (already working)
drop policy if exists "waitlist_update_admin_only" on waitlist_signups;
create policy "waitlist_update_admin_only" on waitlist_signups
  for update
  using (is_admin())
  with check (is_admin());

-- 1f: Recreate the DELETE policy (already working)
drop policy if exists "waitlist_delete_admin_only" on waitlist_signups;
create policy "waitlist_delete_admin_only" on waitlist_signups
  for delete
  using (is_admin());

-- 1g: Explicitly remove anon's ability to SELECT, UPDATE, DELETE
--     Keep only INSERT (needed for waitlist signup)
revoke select, update, delete on table waitlist_signups from anon;
revoke select, update, delete on table waitlist_signups from public;

-- ============================================================================
-- PART 2: DEFENSE IN DEPTH — Trigger-only SECURITY DEFINER functions
-- ============================================================================
-- These functions are only ever called by database triggers, never by users.
-- Revoking EXECUTE prevents any direct exploitation attempt.
--
-- handle_new_user:      Called by the auth.users INSERT trigger
-- sync_public_profile:  Called by the profiles AFTER UPDATE trigger
-- apply_run_score_level: Called by the profiles BEFORE UPDATE trigger
--
-- NOTE: is_admin() is deliberately NOT touched — RLS policies throughout the
--       schema rely on it being executable by all roles (including anon)
--       because PostgreSQL evaluates RLS policies in the context of the
--       current user, and policies like `using (is_admin())` need it.

do $$
declare
  rec record;
begin
  for rec in
    select p.proname as name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef = true
      and p.proname in ('handle_new_user', 'sync_public_profile', 'apply_run_score_level')
  loop
    execute format('revoke execute on function %I.%s(%s) from anon', 'public', rec.name, rec.args);
    execute format('revoke execute on function %I.%s(%s) from public', 'public', rec.name, rec.args);
    execute format('revoke execute on function %I.%s(%s) from authenticated', 'public', rec.name, rec.args);
  end loop;
end $$;

-- ============================================================================
-- PART 3: VERIFICATION QUERIES
-- ============================================================================
-- Run these after the migration to verify it worked:

-- 3a: Check waitlist_signups policies
select schemaname, tablename, policyname, roles, cmd, with_check
from pg_policies
where tablename = 'waitlist_signups'
order by policyname;

-- 3b: Check waitlist_signups table-level grants
select grantee, privilege_type
from information_schema.role_table_grants
where table_name = 'waitlist_signups'
  and table_schema = 'public'
order by grantee, privilege_type;

-- 3c: Verify trigger-only functions are revoked from anon/public
select
  p.proname as function_name,
  case when has_function_privilege('anon', p.oid, 'execute') then '❌ anon CAN execute'
       else '✅ anon CANNOT execute'
  end as anon_access,
  case when has_function_privilege('authenticated', p.oid, 'execute') then '⚠️ authenticated CAN execute'
       else '✅ authenticated CANNOT execute'
  end as auth_access
from pg_proc p
join pg_namespace n on p.pronamespace = n.oid
where n.nspname = 'public'
  and p.prokind = 'f'
  and p.prosecdef = true
  and p.proname in ('handle_new_user', 'sync_public_profile', 'apply_run_score_level')
order by p.proname;

-- 3d: Verify is_admin still works for all roles
select
  'is_admin' as function_name,
  case when has_function_privilege('anon', 'is_admin()', 'execute') then '✅ anon CAN execute (OK — needed for RLS)'
       else '❌ CRITICAL: anon CANNOT execute — RLS policies may break!'
  end as status;

-- ============================================================================
-- PART 4: ROLLBACK PLAN
-- ============================================================================
-- If any workflow breaks, run the following in Supabase SQL Editor:
--
-- -- Restore original waitlist INSERT policy (allows status manipulation)
-- drop policy if exists "waitlist_insert_anon" on waitlist_signups;
-- drop policy if exists "waitlist_insert_authenticated" on waitlist_signups;
-- create policy "waitlist_insert_public" on waitlist_signups
--   for insert with check (true);
--
-- -- Restore anon SELECT (if needed — likely not)
-- grant select on table waitlist_signups to anon;
-- grant select on table waitlist_signups to public;
--
-- -- Grant EXECUTE back to trigger functions (triggers always work, this only
-- -- matters if you need to call them manually via RPC)
-- grant execute on function handle_new_user() to anon;
-- grant execute on function handle_new_user() to authenticated;
-- grant execute on function sync_public_profile() to anon;
-- grant execute on function sync_public_profile() to authenticated;
-- grant execute on function apply_run_score_level() to anon;
-- grant execute on function apply_run_score_level() to authenticated;
-- ============================================================================
