-- ============================================================================
-- RUNWISE — TRANSPORT MODE MIGRATION
-- ============================================================================
-- Adds transport_mode to trips so runners can announce trips without a
-- registered vehicle (public transport / bus / taxi / shuttle).
-- Vehicle verification remains mandatory for private-vehicle trips.
-- KYC verification remains mandatory for ALL runners.
-- Safe to re-run.
-- ============================================================================

alter table trips
  add column if not exists transport_mode text not null default 'private_vehicle'
  check (transport_mode in ('private_vehicle', 'public_transport', 'other'));

-- Make vehicle_id nullable if it isn't already (schema already has it nullable)
-- No action needed — vehicle_id already allows null.
