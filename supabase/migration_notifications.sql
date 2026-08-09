-- ============================================================================
-- RUNWISE — NOTIFICATION SYSTEM (tables, RLS, helper functions)
-- ============================================================================
-- Run this once in your Supabase project's SQL Editor.
-- Adds: notification_history, push_subscriptions, notification_preferences
--
-- Safe to re-run: every statement is idempotent (create ... if not exists /
-- create or replace / drop policy if exists).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- NOTIFICATION HISTORY (in-app + push log)
-- ---------------------------------------------------------------------------
create table if not exists public.notification_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,            -- match_found | offer_proposed | offer_accepted | job_confirmed | new_message |
                                 -- payment_funded | pickup_ready | journey_started | approaching_delivery |
                                 -- delivery_completed | dispute_raised | dispute_resolved | rating_received |
                                 -- verification_approved | verification_rejected | withdrawal_processed
  title text not null,
  description text not null,
  data jsonb default '{}'::jsonb, -- { order_room_id, match_id, trip_id, request_id, from_city, to_city, etc. }
  is_read boolean not null default false,
  is_high_priority boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread
  on public.notification_history (user_id, is_read, created_at desc);
create index if not exists idx_notifications_user_all
  on public.notification_history (user_id, created_at desc);

alter table public.notification_history enable row level security;

-- Users can read their own notifications; admins can read all.
drop policy if exists "notif_select_own_or_admin" on public.notification_history;
create policy "notif_select_own_or_admin" on public.notification_history
  for select
  using (auth.uid() = user_id or public.is_admin());

-- Users can update (mark read) their own notifications.
drop policy if exists "notif_update_read" on public.notification_history;
create policy "notif_update_read" on public.notification_history
  for update
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- PUSH SUBSCRIPTIONS (browser push notification endpoint storage)
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists idx_push_sub_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_sub_own" on public.push_subscriptions;
create policy "push_sub_own" on public.push_subscriptions
  for select
  using (auth.uid() = user_id);

drop policy if exists "push_sub_insert_own" on public.push_subscriptions;
create policy "push_sub_insert_own" on public.push_subscriptions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "push_sub_delete_own" on public.push_subscriptions;
create policy "push_sub_delete_own" on public.push_subscriptions
  for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- NOTIFICATION PREFERENCES (per-user sound + push toggles)
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  sound_enabled boolean not null default true,
  push_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notif_prefs_own" on public.notification_preferences;
create policy "notif_prefs_own" on public.notification_preferences
  for select
  using (auth.uid() = user_id);

drop policy if exists "notif_prefs_upsert_own" on public.notification_preferences;
create policy "notif_prefs_upsert_own" on public.notification_preferences
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "notif_prefs_update_own" on public.notification_preferences;
create policy "notif_prefs_update_own" on public.notification_preferences
  for update
  using (auth.uid() = user_id);

-- Auto-create notification_preferences row when a profile is created.
create or replace function public.handle_new_user_notif_prefs()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.notification_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user_notif_prefs() from public;

drop trigger if exists on_profile_created_notif on public.profiles;
create trigger on_profile_created_notif
  after insert on public.profiles
  for each row execute procedure public.handle_new_user_notif_prefs();

-- ---------------------------------------------------------------------------
-- HELPER: insert a notification (called from application code or triggers)
-- Returns the inserted row so the caller can hand it to send-push.
-- ---------------------------------------------------------------------------
create or replace function public.insert_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_description text,
  p_data jsonb default '{}'::jsonb,
  p_high_priority boolean default false
)
returns public.notification_history
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  n public.notification_history%rowtype;
begin
  insert into public.notification_history
    (user_id, type, title, description, data, is_high_priority)
  values
    (p_user_id, p_type, p_title, p_description, p_data, p_high_priority)
  returning * into n;
  return n;
end;
$$;

revoke all on function public.insert_notification(uuid, text, text, text, jsonb, boolean) from public;
grant execute on function public.insert_notification(uuid, text, text, text, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- HELPER: get unread notification count for the current user
-- ---------------------------------------------------------------------------
create or replace function public.unread_notification_count()
returns int
language sql
security definer
stable
set search_path = pg_catalog
as $$
  select count(*)::int
  from public.notification_history
  where user_id = auth.uid() and not is_read;
$$;

revoke all on function public.unread_notification_count() from public;
grant execute on function public.unread_notification_count() to authenticated;

-- ---------------------------------------------------------------------------
-- HELPER: mark all notifications as read for the current user
-- ---------------------------------------------------------------------------
create or replace function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = pg_catalog
as $$
  update public.notification_history
  set is_read = true
  where user_id = auth.uid() and not is_read;
$$;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ---------------------------------------------------------------------------
-- Enable Supabase Realtime for notification_history so in-app notifications
-- arrive live (the web app subscribes with postgres_changes on INSERT).
-- Idempotent: skips if the publication is missing or already contains the
-- table. If your project still has no realtime updates after this, enable
-- "Realtime" for the table in the Supabase dashboard too.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notification_history'
  ) then
    alter publication supabase_realtime add table public.notification_history;
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;

-- ============================================================================
-- END OF NOTIFICATION MIGRATION
-- ============================================================================
