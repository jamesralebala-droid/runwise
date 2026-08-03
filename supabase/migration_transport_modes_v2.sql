-- ============================================================================
-- RUNWISE — EXPANDED TRANSPORT MODES (v2)
-- ============================================================================
-- Expands transport_mode from 3 categories (private_vehicle, public_transport,
-- other) to 8 practical transport categories, and adds columns for air travel.
--
-- Safe to re-run: uses IF NOT EXISTS / DO blocks.
-- ============================================================================

-- 1. Add columns for air travel
alter table trips
  add column if not exists airline text,
  add column if not exists flight_number text;

-- 2. Update the check constraint
-- PostgreSQL won't let us ALTER an existing CHECK constraint, so we drop and recreate.
do $$
begin
  -- Drop the old constraint (safe even if it doesn't exist yet)
  alter table trips drop constraint if exists trips_transport_mode_check;
  
  -- Add the new constraint with 8 transport modes
  alter table trips add constraint trips_transport_mode_check
    check (transport_mode in (
      'private_car',
      'bus_coach',
      'combi_taxi',
      'truck',
      'motorcycle',
      'bicycle',
      'air_travel',
      'other'
    ));
end $$;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- alter table trips drop column airline;
-- alter table trips drop column flight_number;
-- alter table trips drop constraint trips_transport_mode_check;
-- alter table trips add constraint trips_transport_mode_check
--   check (transport_mode in ('private_vehicle', 'public_transport', 'other'));
