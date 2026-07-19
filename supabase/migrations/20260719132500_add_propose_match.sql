-- Adds the runner-to-customer matching RPC used by the mobile app.
-- Safe to run more than once.

create or replace function public.propose_match(
  p_request_id uuid,
  p_trip_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_runner_id uuid;
  v_customer_id uuid;
  v_trip_from text;
  v_trip_to text;
  v_trip_status text;
  v_request_from text;
  v_request_to text;
  v_request_status text;
  v_match_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  select runner_id, from_city, to_city, status
    into v_runner_id, v_trip_from, v_trip_to, v_trip_status
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Trip not found';
  end if;

  if v_runner_id <> v_actor_id then
    raise exception 'Only the runner who owns this trip can propose a match';
  end if;

  if v_trip_status not in ('leaving_soon', 'today', 'tomorrow', 'upcoming') then
    raise exception 'This trip is not available for matching';
  end if;

  select customer_id, from_city, to_city, status
    into v_customer_id, v_request_from, v_request_to, v_request_status
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_request_status <> 'open' then
    raise exception 'This request is no longer open';
  end if;

  if v_customer_id = v_actor_id then
    raise exception 'You cannot match your own request';
  end if;

  if lower(trim(v_trip_from)) <> lower(trim(v_request_from))
     or lower(trim(v_trip_to)) <> lower(trim(v_request_to)) then
    raise exception 'The request does not match this trip route';
  end if;

  select id
    into v_match_id
  from public.matches
  where trip_id = p_trip_id
    and request_id = p_request_id
  order by created_at desc
  limit 1
  for update;

  if v_match_id is not null then
    update public.matches
      set status = 'accepted_by_runner'
    where id = v_match_id
      and status in ('declined', 'cancelled', 'proposed');

    return v_match_id;
  end if;

  v_match_id := gen_random_uuid();

  insert into public.matches (
    id,
    trip_id,
    request_id,
    runner_id,
    customer_id,
    status
  )
  values (
    v_match_id,
    p_trip_id,
    p_request_id,
    v_runner_id,
    v_customer_id,
    'accepted_by_runner'
  );

  return v_match_id;
end;
$function$;

revoke all on function public.propose_match(uuid, uuid) from public;
grant execute on function public.propose_match(uuid, uuid) to authenticated;

comment on function public.propose_match(uuid, uuid)
  is 'Allows an authenticated runner to propose one of their available trips for an open request on the same route.';

notify pgrst, 'reload schema';
