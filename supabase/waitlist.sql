-- ============================================================================
-- RUNWISE — WAITLIST SIGNUPS
-- ============================================================================
-- Public insert (no auth required), admin-only select/update/delete.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================================

create table if not exists waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null default '',
  interest text not null check (interest in ('customer', 'runner', 'both')),
  town_city text not null default '',
  frequent_routes text default '',
  phone text default '',
  marketing_consent boolean not null default false,
  source text not null default 'organic',
  status text not null default 'new',
  notes text default '',
  created_at timestamptz not null default now()
);

-- Duplicate protection: one signup per email
create unique index if not exists idx_waitlist_signups_email on waitlist_signups (lower(email));

-- Grant INSERT to anon so the public REST API (anon key) can submit signups
-- SELECT/UPDATE/DELETE are blocked by RLS for non-admins
grant insert on table waitlist_signups to anon;
grant insert on table waitlist_signups to authenticated;
alter table waitlist_signups enable row level security;

-- Anyone can sign up (public insert, no auth required)
create policy "waitlist_insert_public" on waitlist_signups
  for insert with check (true);

-- Only admins can view entries
create policy "waitlist_select_admin_only" on waitlist_signups
  for select using (is_admin());

-- Only admins can update entries (status, notes)
create policy "waitlist_update_admin_only" on waitlist_signups
  for update using (is_admin())
  with check (is_admin());

-- Only admins can delete entries
create policy "waitlist_delete_admin_only" on waitlist_signups
  for delete using (is_admin());
