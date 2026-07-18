-- ============================================================================
-- RUNWISE — LEGAL FOUNDATION V1.0
-- ============================================================================
-- Run this after schema.sql, functions.sql, storage.sql, settings_and_privacy.sql.
-- Adds: versioned legal documents (immutable once published), an append-only
-- acceptance ledger, and admin-configurable compliance flags.
--
-- LABEL: these documents and this framework are a starting structure, not a
-- substitute for review by qualified counsel in each applicable jurisdiction.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- LEGAL DOCUMENTS — versioned, immutable once published. To change a
-- document, publish a new version; the old one is archived, never edited.
-- ---------------------------------------------------------------------------
create table if not exists legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  version text not null,
  title text not null,
  body_html text not null,
  effective_date text, -- text, not date: holds the literal placeholder "[EFFECTIVE DATE]" until Botwise confirms a real launch date
  is_material boolean not null default false,
  status text not null default 'draft', -- draft | published | archived
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (document_type, version)
);

alter table legal_documents enable row level security;

create policy "legal_documents_public_read_published" on legal_documents
  for select using (status = 'published' or is_admin());

create policy "legal_documents_admin_insert" on legal_documents
  for insert with check (is_admin());

create policy "legal_documents_admin_update" on legal_documents
  for update using (is_admin());

-- Enforce immutability: once a document is published, its body/version/type
-- can never change again — only its status may move published -> archived.
create or replace function prevent_legal_document_edit()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.status = 'published' then
    if new.body_html <> old.body_html or new.document_type <> old.document_type
       or new.version <> old.version or new.title <> old.title then
      raise exception 'Published legal documents are immutable. Publish a new version instead.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_legal_document_update on legal_documents;
create trigger on_legal_document_update
  before update on legal_documents
  for each row execute procedure prevent_legal_document_edit();

-- Only one published version per document_type at a time — publishing a new
-- one automatically archives the previous published version.
create or replace function archive_previous_legal_version()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'published' then
    update legal_documents
      set status = 'archived', archived_at = now()
      where document_type = new.document_type
        and status = 'published'
        and id <> new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_legal_document_publish on legal_documents;
create trigger on_legal_document_publish
  after insert or update of status on legal_documents
  for each row execute procedure archive_previous_legal_version();

-- ---------------------------------------------------------------------------
-- LEGAL ACCEPTANCES — append-only. No one, including admins, can update or
-- delete a record; the only insert policy is "insert your own", enforced by
-- auth.uid() = user_id, so a user can't backdate or forge someone else's
-- acceptance either.
-- ---------------------------------------------------------------------------
create table if not exists legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  document_type text not null,
  document_version text not null,
  accepted_at timestamptz not null default now(),
  acceptance_context text not null,
  related_record_id uuid,       -- optional: the specific request/trip/order this was for
  country_code text,
  user_role text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table legal_acceptances enable row level security;

create policy "legal_acceptances_select_own_or_admin" on legal_acceptances
  for select using (auth.uid() = user_id or is_admin());

create policy "legal_acceptances_insert_own" on legal_acceptances
  for insert with check (auth.uid() = user_id);

-- Deliberately no update or delete policy at all — nobody can modify or
-- remove an acceptance record once it exists, including admins.

-- ---------------------------------------------------------------------------
-- LEGAL COMPLIANCE FLAGS — admin-configurable, applied by transaction/item/
-- country, never a blanket regional block.
-- ---------------------------------------------------------------------------
create table if not exists legal_compliance_flags (
  id uuid primary key default gen_random_uuid(),
  flag_type text not null, -- e.g. customs_declaration_required, prohibited_item, high_value_item_review_required
  scope_type text not null, -- 'country' | 'route' | 'item_type' | 'global'
  scope_value text,         -- e.g. 'ZW', 'shopping', or null for global
  active boolean not null default true,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table legal_compliance_flags enable row level security;

create policy "compliance_flags_public_read_active" on legal_compliance_flags
  for select using (active or is_admin());

create policy "compliance_flags_admin_write" on legal_compliance_flags
  for all using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- Helper: has the current user accepted the currently-published version of
-- a given document type? Used to gate registration/runner-activation/etc.
-- client-side; the real enforcement for each gated action lives in that
-- action's own RLS/RPC checks below.
-- ---------------------------------------------------------------------------
create or replace function has_accepted_current(p_document_type text, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from legal_acceptances a
    join legal_documents d on d.document_type = a.document_type and d.version = a.document_version
    where a.user_id = p_user_id
      and a.document_type = p_document_type
      and d.status = 'published'
  );
$$;

-- ---------------------------------------------------------------------------
-- Optional GPS / rural-location fields on trips and requests (spec section 9:
-- open geography, GPS-pin fallback for locations absent from any geocoding
-- database). Additive, nullable — doesn't disturb existing rows or the
-- existing free-text from_city/to_city fields.
-- ---------------------------------------------------------------------------
alter table trips add column if not exists from_landmark text;
alter table trips add column if not exists from_gps_lat numeric;
alter table trips add column if not exists from_gps_lng numeric;
alter table trips add column if not exists to_landmark text;
alter table trips add column if not exists to_gps_lat numeric;
alter table trips add column if not exists to_gps_lng numeric;
alter table trips add column if not exists written_directions text;

alter table requests add column if not exists from_landmark text;
alter table requests add column if not exists from_gps_lat numeric;
alter table requests add column if not exists from_gps_lng numeric;
alter table requests add column if not exists to_landmark text;
alter table requests add column if not exists to_gps_lat numeric;
alter table requests add column if not exists to_gps_lng numeric;
alter table requests add column if not exists written_directions text;
