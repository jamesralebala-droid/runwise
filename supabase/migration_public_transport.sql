-- ============================================================================
-- RUNWISE — PUBLIC TRANSPORT DETAIL COLUMNS
-- ============================================================================
-- Adds columns to the trips table for public transport runners who travel
-- by bus/taxi/shuttle rather than private vehicle.
--
-- Safe to re-run: uses IF NOT EXISTS.
-- ============================================================================

alter table trips
  add column if not exists transport_company text,
  add column if not exists licence_plate text,
  add column if not exists transport_id_complete boolean not null default false;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- alter table trips drop column transport_company;
-- alter table trips drop column licence_plate;
-- alter table trips drop column transport_id_complete;
