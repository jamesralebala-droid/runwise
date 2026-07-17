# RunWise — Supabase Backend Setup

This replaces the localStorage-only prototype with real auth, a real Postgres
database, row-level security, and server-side financial logic — the
foundation the Master Continuation Prompt requires before anything else.

**Once setup is done, see `TESTING-CHECKLIST.md`** for a step-by-step manual
walkthrough of the entire flow — signup through KYC, trip/request matching,
escrow, delivery, ratings, disputes, and admin controls — before you rely on
any of this.

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
   - `supabase/functions.sql` (includes escrow, disputes, ratings, and
     withdrawals — safe to re-run if you already applied an earlier version)
   - `supabase/storage.sql` (creates the private `runwise-uploads` bucket used
     for KYC documents and vehicle photos)
   - `supabase/settings_and_privacy.sql` (platform settings, RunScore
     automation, proximity phone reveal, **and a privacy fix** — see below)
   - `supabase/verify_install.sql` — not required, but run this last and
     check the output. It confirms every table/function/bucket from the
     four files above actually got created, and specifically checks that
     the privacy-fix policy drop took effect. Doesn't change anything.
3. Open **Project Settings → API** and copy your **Project URL** and
   **anon public key**.

### Important: privacy fix included in this update

The original `schema.sql` had a `profiles_select_public_basics` policy with
`using (true)` on the **entire** profiles table, meaning any signed-in user
could query someone else's phone number directly through the anon key, not
just the name/rating fields the UI actually shows — Row Level Security can
only restrict which *rows* you see, not which *columns*. `settings_and_privacy.sql`
drops that policy and adds a `public_profiles` table that only ever holds
safe-to-share fields (name, rating, RunScore tier), kept in sync via a
trigger. If you already had users sign up before applying this file, it
backfills `public_profiles` for them automatically.

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
- Ratings — after escrow is released or a dispute is refunded, both parties
  see a "Rate" panel in the Order Room (stars + tagged strengths + comment);
  a trigger keeps `profiles.rating_sum` / `rating_count` in sync automatically
- Disputes — either party can raise one from the Order Room while an order is
  active; this immediately flips escrow to `disputed` and freezes further
  action (no fund/confirm-delivery buttons) until an admin resolves it.
  Admin resolution supports: release funds to runner, full refund to customer
  (runner forfeits their fee), partial refund (admin sets how much of the
  runner's fee still gets paid out), runner penalty (RunScore −15), and
  account restriction/suspension flags — all logged to `admin_audit_log`.
  Note: refunds happen on whatever real payment gateway you eventually wire
  up to `fund_escrow()` — RunWise's own wallet ledger only ever tracks money
  *owed to* runners and the platform, never customer funds in custody.

**Schema is ready for these, but there's no UI yet — next priorities per the
Master Prompt's own ordering:**
- Real payment gateway integration (Orange Money / MyZaka / card) — see
  below, this is deliberately left as scaffolding, not a working integration

### Also now real as of this update

- **Suspension/restriction enforcement** — `is_active_account()` is checked
  directly in the RLS policies on `trips` and `requests`, so a restricted or
  suspended account genuinely cannot insert new listings, even via a raw API
  call with their own token — this isn't just a hidden button. A suspended
  user is also force-signed-out on next load with a dedicated blocked
  screen; a restricted user sees a banner and can still manage existing
  orders, chat, and get paid out on work already underway.
- **Admin Platform Settings screen** — fee percentages (runner/platform/
  protection), max shopping value, RunScore tier thresholds, and the
  proximity phone-reveal distance are all editable from the admin portal
  instead of hardcoded. `accept_match()` reads live from this table.
- **RunScore tiers are automatic** — a trigger recalculates bronze/silver/
  gold/platinum whenever `run_score` changes, using the admin's thresholds.
- **Proximity-based phone reveal** — in the Order Room, both parties can
  share their location (browser geolocation) and check the distance between
  them. The actual phone number is only ever disclosed by a server-side
  function that independently computes the distance (Haversine) between
  both parties' most recently shared positions — a client can't just claim
  "we're close" to get the number.
- **Payment gateway scaffolding** — `supabase/functions/payment-webhook/`
  is a real Edge Function *shape*, deliberately left with two TODOs
  (signature verification, payload field names) because I don't have and
  can't fabricate real Orange Money/MyZaka/card credentials or their actual
  webhook formats. It calls a new `fund_escrow_serverside()` SQL function
  that's locked down to the service role only — no authenticated user can
  call it directly, unlike the current demo `fund_escrow()`. When you have
  real gateway credentials: fill in the two TODOs, point the gateway's
  webhook at this function's URL, and change the frontend's "Fund Escrow"
  button to redirect to the gateway's checkout instead of calling
  `fund_escrow()` directly.

## Why this order

Per the Master Prompt's own priority list: "make the app run" → "authentication
and roles" → "trips, requests, matching, booking" → "Order Room and
communication" → "escrow, wallets, demo payments" → "journey, proof, Delivery
PIN" come before Admin, disputes, ratings, and KYC uploads. This package
covers everything through Delivery PIN and automatic escrow split.
