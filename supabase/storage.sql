-- ============================================================================
-- RUNWISE — STORAGE SETUP (KYC documents + vehicle photos)
-- ============================================================================
-- Run this after schema.sql and functions.sql.
-- Creates one private bucket, split into folders:
--   kyc/{user_id}/...        selfie + ID document photos
--   vehicles/{user_id}/...   vehicle photos
-- Nothing in this bucket is public. Access is via signed URLs generated
-- server-side/client-side after an RLS check, same pattern as every other
-- table in this schema.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('runwise-uploads', 'runwise-uploads', false)
on conflict (id) do nothing;

-- A user may upload into their own folder (kyc/<their-uid>/... or vehicles/<their-uid>/...)
create policy "kyc_upload_own_folder"
on storage.objects for insert
with check (
  bucket_id = 'runwise-uploads'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- A user may read their own uploads; admins may read everything in the bucket
create policy "kyc_read_own_or_admin"
on storage.objects for select
using (
  bucket_id = 'runwise-uploads'
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or is_admin()
  )
);

-- A user may delete/replace their own uploads (e.g. re-submitting KYC)
create policy "kyc_modify_own"
on storage.objects for update
using (
  bucket_id = 'runwise-uploads'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "kyc_delete_own_or_admin"
on storage.objects for delete
using (
  bucket_id = 'runwise-uploads'
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or is_admin()
  )
);

-- Expected object path shape: "kyc/<user_id>/selfie_169...jpg"
-- or "vehicles/<user_id>/front_169....jpg" — folder index 1 is the top-level
-- folder ("kyc"/"vehicles"), index 2 is the user id, which is what every
-- policy above checks against auth.uid().
