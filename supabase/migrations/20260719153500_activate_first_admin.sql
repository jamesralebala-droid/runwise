-- One-time RunWise owner/admin activation.
-- This must be executed from the authenticated Supabase SQL Editor.

do $$
declare
  v_user_id uuid;
begin
  select id
  into v_user_id
  from auth.users
  where lower(email) = lower('jamesralebala@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'No RunWise login exists for jamesralebala@gmail.com. Create and confirm that account in RunWise first, then run this file again.';
  end if;

  update public.profiles
  set role = 'admin',
      active_role = 'admin'
  where id = v_user_id;

  if not found then
    raise exception 'The login exists but its RunWise profile is missing. Sign in to RunWise once, then run this file again.';
  end if;
end
$$;

select
  account.email,
  profile.full_name,
  profile.role,
  profile.active_role,
  profile.suspended,
  profile.restricted
from auth.users as account
join public.profiles as profile on profile.id = account.id
where lower(account.email) = lower('jamesralebala@gmail.com');
