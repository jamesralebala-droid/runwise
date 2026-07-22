-- ============================================================================
-- RUNWISE — NOTIFICATION SYSTEM (tables, RLS, helper functions)
-- ============================================================================
-- Run this once in your Supabase project's SQL Editor.
-- Adds: notification_history, push_subscriptions, notification_preferences
-- ============================================================================

-- ---------------------------------------------------------------------------
-- NOTIFICATION HISTORY (in-app + push log)
-- ---------------------------------------------------------------------------
create table if not exists notification_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
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

create index if not exists idx_notifications_user_unread on notification_history (user_id, is_read, created_at desc);
create index if not exists idx_notifications_user_all on notification_history (user_id, created_at desc);

alter table notification_history enable row level security;

-- Users can read their own notifications; admins can read all
create policy "notif_select_own_or_admin" on notification_history
  for select using (auth.uid() = user_id or is_admin());

-- System/backend creates notifications (service role); users can update is_read
create policy "notif_update_read" on notification_history
  for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- PUSH SUBSCRIPTIONS (browser push notification endpoint storage)
-- ---------------------------------------------------------------------------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists idx_push_sub_user on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy "push_sub_own" on push_subscriptions
  for select using (auth.uid() = user_id);

create policy "push_sub_insert_own" on push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "push_sub_delete_own" on push_subscriptions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- NOTIFICATION PREFERENCES (per-user sound + push toggles)
-- ---------------------------------------------------------------------------
create table if not exists notification_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  sound_enabled boolean not null default true,
  push_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notification_preferences enable row level security;

create policy "notif_prefs_own" on notification_preferences
  for select using (auth.uid() = user_id);

create policy "notif_prefs_upsert_own" on notification_preferences
  for insert with check (auth.uid() = user_id);

create policy "notif_prefs_update_own" on notification_preferences
  for update using (auth.uid() = user_id);

-- Auto-create notification_preferences row when a profile is created
create or replace function handle_new_user_notif_prefs()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.notification_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_notif on profiles;
create trigger on_profile_created_notif
  after insert on profiles
  for each row execute procedure handle_new_user_notif_prefs();

-- ---------------------------------------------------------------------------
-- HELPER: insert a notification (called from application code or triggers)
-- ---------------------------------------------------------------------------
create or replace function insert_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_description text,
  p_data jsonb default '{}'::jsonb,
  p_high_priority boolean default false
)
returns notification_history
language plpgsql
security definer
as $$
declare
  n notification_history%rowtype;
begin
  insert into notification_history (user_id, type, title, description, data, is_high_priority)
  values (p_user_id, p_type, p_title, p_description, p_data, p_high_priority)
  returning * into n;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- HELPER: get unread notification count for the current user
-- ---------------------------------------------------------------------------
create or replace function unread_notification_count()
returns int
language sql
security definer
stable
as $$
  select count(*)::int from notification_history
  where user_id = auth.uid() and not is_read;
$$;

-- ---------------------------------------------------------------------------
-- HELPER: mark all notifications as read for the current user
-- ---------------------------------------------------------------------------
create or replace function mark_all_notifications_read()
returns void
language sql
security definer
as $$
  update notification_history set is_read = true
  where user_id = auth.uid() and not is_read;
$$;

-- ---------------------------------------------------------------------------
-- Enable Supabase Realtime for notification_history (so in-app updates work)
-- ---------------------------------------------------------------------------
-- Note: Run this separately if your Supabase project requires it:
-- alter publication supabase_realtime add table notification_history;
-- (You may need to enable Realtime in the Supabase dashboard first.)
-- ============================================================================
-- END OF NOTIFICATION MIGRATION
-- ============================================================================
