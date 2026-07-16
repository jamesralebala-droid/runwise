# RunWise — Supabase Backend Setup

This replaces the localStorage-only prototype with real auth, a real Postgres
database, row-level security, and server-side financial logic — the
foundation the Master Continuation Prompt requires before anything else.

## 1. Clean up the repo first

The repo currently has **three copies** of the app (root `index.html`/`app.js`,
`" zip 3"/`, `"files.zip 5"/`). Delete the two duplicate folders and the old
root files before adding these — keeping divergent copies around is exactly
what the Master Prompt says not to do.

```
git rm -r " zip 3" "files.zip 5"
git rm index.html app.js styles.css
```

## 2. Create your Supabase project

1. Go to https://supabase.com → New Project.
2. Once it's provisioned, open **SQL Editor** and run, in order:
   - `supabase/schema.sql`
   - `supabase/functions.sql`
   - `supabase/storage.sql` (creates the private `runwise-uploads` bucket used
     for KYC documents and vehicle photos)
3. Open **Project Settings → API** and copy your **Project URL** and
   **anon public key**.

## 3. Seed a treasury wallet (one-time)

The platform's own fee revenue needs one wallet row with `owner_type =
'treasury'`. Easiest way: sign up a normal account to use as the "RunWise
Treasury" user, then in the SQL Editor run:

```sql
update profiles set role = 'admin', active_role = 'admin' where id = '<that user's id>';
insert into wallets (user_id, owner_type) values ('<that user's id>', 'treasury')
  on conflict (user_id) do update set owner_type = 'treasury';
```

## 4. Add the frontend files to the repo

Copy everything in this package's `web/` folder into the repo root:

```
config.example.js   -> copy to config.js, then fill in SUPABASE_URL / SUPABASE_ANON_KEY
index.html
app.js
styles.css
runwise-logo.svg
```

**Do not commit `config.js`** — add it to `.gitignore` (included in this
package). The anon key is safe to expose publicly (RLS enforces access), but
keeping it out of git means you can swap Supabase projects (dev/staging/prod)
without a merge conflict.

## 5. Run it

Any static file server works, e.g.:

```
npx serve web
```

Or open `index.html` directly in a browser (Supabase Auth needs the page
served over http/https, not `file://`, for redirects to work correctly —
`npx serve` is the easiest fix).

## What's real now vs. what's still a stub

**Now real, persisted, and RLS-protected:**
- Sign up / log in / log out (Supabase Auth), with `customer` / `runner` role chosen at signup
- Role switching (customer ⇄ runner) updates a real `profiles` row
- Trip Marketplace: runners publish real trips to Postgres; customers browse them
- Requests: customers post real requests
- Matching → Order Room → Escrow → Journey Milestones → Delivery PIN → automatic
  fee split, all running through the `functions.sql` RPCs so a customer can
  never edit their own price in devtools
- Wallets with an append-only `wallet_transactions` ledger
- Withdrawals (demo — no real payment rail connected yet, exactly like the
  Master Prompt's "demo payment methods for MVP")

**Also now real as of this update:**
- Runner KYC submission — ID + selfie upload to a private Supabase Storage
  bucket, next-of-kin details, status tracking (pending/approved/rejected)
- Vehicle submission — make/model, plate, multi-photo upload, pending approval
- Admin portal (only visible to users with `profiles.role = 'admin'`, via the
  role-switch button) — dashboard of pending counts, runner verification
  review with signed-URL document viewing and approve/reject, vehicle
  approval queue, and every decision logged to `admin_audit_log`

**Schema is ready for these, but there's no UI yet — next priorities per the
Master Prompt's own ordering:**
- Ratings UI (table exists, no submission screen yet)
- Dispute flow UI (table + escrow "frozen"/"disputed" statuses exist, no
  screen to raise or resolve one yet)
- Real payment gateway integration (Orange Money / MyZaka / card) — currently
  simulated via `fund_escrow()`
- Proximity-based temporary phone number reveal (needs live location, which
  needs a decision on a maps/geolocation provider)
- Fee/threshold configuration screen for admins (RunScore levels, shopping
  limits — currently hardcoded in `functions.sql`)

## Why this order

Per the Master Prompt's own priority list: "make the app run" → "authentication
and roles" → "trips, requests, matching, booking" → "Order Room and
communication" → "escrow, wallets, demo payments" → "journey, proof, Delivery
PIN" come before Admin, disputes, ratings, and KYC uploads. This package
covers everything through Delivery PIN and automatic escrow split.
