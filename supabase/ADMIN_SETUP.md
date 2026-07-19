# RunWise admin portal setup

The admin portal is the existing web app (`index.html`). Admin access is controlled by
the authenticated user's row in `public.profiles`; it is not a separate Expo account.

## 1. Install the database migrations

In Supabase, open **SQL Editor → New query** and run these files in timestamp order:

1. `supabase/migrations/20260719132500_add_propose_match.sql`
2. `supabase/migrations/20260719152000_admin_operations.sql`
3. `supabase/migrations/20260719152500_privacy_and_role_hardening.sql`

The admin migrations add secure review functions, rejection reasons, audit logging,
account restriction/suspension controls, and privacy protections. They also pin the
search path on security-definer functions to address the Security Advisor warnings.

## 2. Create the first admin login

First create a normal RunWise account with the email that will be used for administration.
Confirm the email, then run this once in the Supabase SQL Editor, replacing the example
email:

```sql
update public.profiles as profile
set role = 'admin',
    active_role = 'admin'
from auth.users as account
where profile.id = account.id
  and lower(account.email) = lower('admin@example.com');

select account.email, profile.full_name, profile.role, profile.active_role
from auth.users as account
join public.profiles as profile on profile.id = account.id
where lower(account.email) = lower('admin@example.com');
```

The second query must return exactly one row with both roles set to `admin`.

Do not put a Supabase service-role key in the web app or mobile app. The browser uses
only the publishable key; database policies and admin-only RPCs enforce access.

## 3. Open the portal

Deploy the repository root as a static website, then log in at that website using the
admin email and password. The sidebar will show:

- Admin Home
- Runner Approvals
- Vehicle Approvals
- Dispute Cases
- Operations
- Audit Log
- Platform Settings
- Legal Documents

## 4. Normal admin workflow

- Open every identity document or vehicle photo before deciding.
- Rejections require a reason; the runner sees that reason and can resubmit.
- Open the full dispute case file before resolving escrow.
- Account restrictions and suspensions require an internal reason.
- Use Audit Log to review who changed what and when.
