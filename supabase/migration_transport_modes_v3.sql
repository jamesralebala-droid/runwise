-- ============================================================================
-- RUNWISE — TRANSPORT MODES v3: ANY MODE, PRIVATE OR PUBLIC
-- ============================================================================
-- Lets runners announce trips with ANY transport mode (private car, bus/coach,
-- combi/taxi, truck, motorcycle, bicycle, air travel, or other). An approved
-- vehicle is now required ONLY for private-vehicle modes (private_car,
-- motorcycle, truck). Bus/coach, combi/taxi, bicycle, air and other modes
-- need no vehicle at all.
--
-- Also adds the public-transport columns the web app already sends, and fixes
-- the transport_mode column default (v1 set it to 'private_vehicle', which the
-- v2 check constraint no longer allows).
--
-- KYC (identity) verification remains mandatory for ALL runners.
-- Safe to re-run.
-- ============================================================================

-- 1. Columns the app sends for public transport / other modes.
alter table trips
  add column if not exists transport_company text,
  add column if not exists licence_plate text,
  add column if not exists transport_id_complete boolean,
  add column if not exists transport_details text;

-- 2. Ensure the 8-mode check constraint is in place (v2 also does this; the
--    DO block keeps this migration self-contained if v2 was never applied).
do $$
begin
  alter table trips drop constraint if exists trips_transport_mode_check;
  alter table trips add constraint trips_transport_mode_check
    check (transport_mode in (
      'private_car', 'bus_coach', 'combi_taxi', 'truck',
      'motorcycle', 'bicycle', 'air_travel', 'other'
    ));
end $$;

-- 3. Fix the default: v1 defaulted to 'private_vehicle', which the 8-mode check
--    constraint no longer accepts. Clients that omit the field (older builds)
--    now get a valid mode.
alter table trips alter column transport_mode set default 'private_car';

-- 4. Normalize any legacy rows to an allowed mode.
update trips
  set transport_mode = 'other'
  where transport_mode is null
     or transport_mode not in (
       'private_car', 'bus_coach', 'combi_taxi', 'truck',
       'motorcycle', 'bicycle', 'air_travel', 'other'
     );

-- 5. Relax the announce policy: identity approval is still mandatory, but an
--    approved vehicle is only required when the runner is using their own
--    vehicle (private_car / motorcycle / truck).
drop policy if exists "trips_verified_runner_insert" on public.trips;
create policy "trips_verified_runner_insert" on public.trips
  for insert to authenticated
  with check (
    (select auth.uid()) = runner_id
    and exists (
      select 1 from public.runner_verifications rv
      where rv.user_id = (select auth.uid()) and rv.status = 'approved'::public.verification_status
    )
    and (
      transport_mode not in ('private_car', 'motorcycle', 'truck')
      or (
        vehicle_id is not null
        and exists (
          select 1 from public.vehicles v
          where v.id = vehicle_id and v.user_id = (select auth.uid()) and v.approved = true
        )
      )
    )
  );

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- drop policy if exists "trips_verified_runner_insert" on public.trips;
-- create policy "trips_verified_runner_insert" on public.trips
--   for insert to authenticated
--   with check (
--     (select auth.uid()) = runner_id
--     and exists (
--       select 1 from public.runner_verifications rv
--       where rv.user_id = (select auth.uid()) and rv.status = 'approved'::public.verification_status
--     )
--     and exists (
--       select 1 from public.vehicles v
--       where v.id = vehicle_id and v.user_id = (select auth.uid()) and v.approved = true
--     )
--   );
-- alter table trips alter column transport_mode set default 'private_vehicle';
-- alter table trips drop column if exists transport_details;
-- alter table trips drop column if exists transport_id_complete;
-- alter table trips drop column if exists licence_plate;
-- alter table trips drop column if exists transport_company;
