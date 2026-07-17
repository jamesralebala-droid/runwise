# RunWise — End-to-End Test Checklist

Run through this once after setup, in roughly this order. Use two different
browsers (or one regular + one incognito window) so you can be logged in as
a customer and a runner at the same time — you'll need both to test matches.

## 0. Install sanity check

Run `supabase/verify_install.sql` in the SQL Editor first. It checks that
every table, function, and RLS policy this package expects actually exists,
and prints a pass/fail summary — much faster than discovering a missing
piece three steps into a manual test.

## 1. Accounts

- [ ] Sign up as a **customer** (Account A). Confirm the email if your
      Supabase project requires it, then log in.
- [ ] Sign up as a **runner** (Account B), in a second browser/window.
- [ ] Sign up a **third** account (Account C) — you'll promote this one to
      admin. In the SQL Editor:
      ```sql
      update profiles set role = 'admin', active_role = 'admin' where id = '<Account C's auth.users id>';
      insert into wallets (user_id, owner_type) values ('<Account C's id>', 'treasury')
        on conflict (user_id) do update set owner_type = 'treasury';
      ```
      Log out and back in on Account C — the sidebar should now show
      Admin Home / Runner Approvals / Vehicle Approvals / Disputes /
      Platform Settings, and the mode-switch button should cycle
      Customer → Runner → Admin.

## 2. Runner verification & vehicle (Account B)

- [ ] Switch to Runner mode. Go to **Verification**, upload any two small
      images as "ID" and "Selfie", fill in next-of-kin details, submit.
      Status should show "pending".
- [ ] Go to **My Vehicles**, add a vehicle with a couple of photos. Status
      should show "Pending approval".
- [ ] As Account C (admin): open **Runner Approvals**, confirm you can see
      Account B's submission and the two document links actually open
      (this proves the signed URL / storage RLS is working). Approve it.
- [ ] Open **Vehicle Approvals**, confirm the vehicle is listed. Approve it.
- [ ] Back on Account B: verification status should now read "approved",
      vehicle should read "Approved".

## 3. Trip + request + match (Accounts A & B)

- [ ] As Account B (runner): **Announce Trip** — pick a route (e.g.
      Gaborone → Johannesburg), fill in the form, publish.
- [ ] As Account A (customer): go to **Trip Marketplace**, confirm the trip
      shows up with the runner's name and rating.
- [ ] As Account A: click **Match a Request** on that trip, fill in the
      prompt-based request form (type, cities matching the trip's route,
      value).
- [ ] As Account B: go to **Smart Matches** — the request should appear as
      a compatible match (same from/to cities as your trip). Click
      **Propose Match**.
- [ ] As Account A: go to **My Orders** — an order should now exist (this
      confirms `accept_match()` fired correctly and created the Order Room
      + escrow record once both sides had accepted).

## 4. Escrow, journey, delivery (Accounts A & B)

- [ ] As Account A: open the order, click **Fund Escrow (demo payment)**.
      Status should move to "funded".
- [ ] As either party: click **Set Delivery PIN**, enter a PIN when
      prompted (remember it for the next step).
- [ ] As Account B: post a couple of journey milestones (e.g. "Heading to
      Pickup", "Collected", "Journey Started"). Confirm they appear in the
      timeline for both accounts.
- [ ] Send a chat message from both sides, confirm both see both messages.
- [ ] **Proximity reveal**: on both accounts, click **Share My Location**
      (allow the browser permission prompt). Click **Check Distance** on
      each. If you're testing from the same physical location, the phone
      number should be revealed; if not, you should see a "still Xm apart"
      message instead — either way, confirm it's not just always showing
      the number.
- [ ] As Account A: under **Confirm delivery**, enter the PIN (and
      optionally an "actual amount spent" less than the estimated value to
      test the unused-shopping-refund path) and confirm.
- [ ] Check **Wallet** (Account A) and **Earnings** (Account B) — the
      runner's fee should show as a pending-balance credit, and if you
      entered a lower "actual spent" amount, Account A should see an
      "unused_shopping_refund" transaction.
- [ ] Both accounts should now see a **Rate** panel in the Order Room.
      Submit a rating from each side. Reload the page — the profile's
      aggregate rating should reflect it (visible as the ★ score on trip
      cards elsewhere in the app).

## 5. Disputes (repeat steps 3–4 with a fresh match first)

Set up a second order the same way as step 3–4, but stop before confirming
delivery.

- [ ] As either party: click **Raise a Dispute**, pick a reason, add
      details, submit. Confirm the escrow status flips to "disputed" and
      the fund/confirm-delivery buttons disappear for both accounts.
- [ ] As Account C (admin): open **Disputes**, confirm the case appears
      with the reason and order details.
- [ ] Try each resolution outcome on separate test orders if you have time,
      otherwise at minimum test:
  - [ ] **Release funds to runner** — confirm the runner's wallet gets
        credited exactly as it would on a normal confirm_delivery.
  - [ ] **Partial refund** — enter an amount less than the full runner
        fee, confirm only that amount lands in the runner's wallet.
  - [ ] **Runner penalty** — confirm the runner's RunScore drops by 15 and,
        if it crosses a tier threshold, their RunScore level updates too.
  - [ ] **Suspend runner** — confirm that runner is signed out and shown
        the "Account Suspended" screen on next login, and that trying to
        announce a new trip (if you can still reach the form) is rejected.

## 6. Restriction enforcement

- [ ] Manually restrict a test account:
      `update profiles set restricted = true where id = '<some user id>';`
- [ ] Log in as that account. Confirm the restricted banner shows, the
      "+ Post Request" / "+ Announce Trip" button is disabled, and — this
      is the important one — trying to insert directly (e.g. via the
      Supabase JS console: `supabase.from('requests').insert(...)`) is
      rejected by RLS, not just hidden by the UI.
- [ ] Un-restrict it (`update profiles set restricted = false ...`) and
      confirm the banner disappears and posting works again.

## 7. Platform settings

- [ ] As Account C (admin): open **Platform Settings**, change the runner
      fee percentage, save.
- [ ] Set up a brand-new match (steps 3–4). Confirm the new fee percentage
      was actually used in the escrow calculation — the old order from
      step 3 should still show the old percentage (fees are locked in at
      match time, not recalculated).

## What this checklist does *not* cover

- Real payment gateway behavior — there isn't one connected yet
      (`fund_escrow_serverside` and the webhook stub have no real gateway
      to call them).
- Load/concurrency testing — this is a functional walkthrough, not a
      stress test.
- Mobile responsiveness beyond the basic breakpoint in `styles.css`.
