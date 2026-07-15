# RunWise — Your Cart. Our Run.

Travel-powered logistics marketplace across Botswana, South Africa, Zimbabwe, and Zambia.
Connects senders who need something delivered with runners who are already traveling that route.

## Status

Working front-end prototype (`index.html`) — single-file HTML/CSS/JS, no build step, no backend.
Data persists in the browser's `localStorage`, so it's single-device only right now — not yet
shared between different people. See "Known limitations" below.

Open `index.html` directly in a browser, or serve the repo with any static host (GitHub Pages works).

## What's implemented

- **Send / Run mode toggle** — one app, two roles.
- **Post a delivery request** (sender) — item, category, pickup/drop-off city + point, needed-by date, budget.
  - Restricted-items confirmation checkbox before posting.
  - Cross-border customs declaration flow (triggers for Electronics between different countries — see `COUNTRY_MAP` in `index.html`).
- **Post a trip** (runner) — route, date, mode, free capacity.
- **Your posts** — Home shows everything you've posted (requests in Send mode, trips in Run mode) with
  a **Cancel** button while it's still open. Cancelled posts stop appearing in anyone's matching feed.
- Date pickers for "needed by" and "travel date" no longer allow selecting a day in the past
  (enforced both by the picker itself and by a JS check on submit, in case a browser lets someone type one in manually).
- Form validation tightened: budget, declared value, and free capacity must all be greater than 0 —
  a 0 or blank value used to be accepted silently.
- Cross-border city coverage expanded to ~40 towns across Botswana, South Africa, Zimbabwe, and Zambia
  (still a hardcoded list — see `COUNTRY_MAP` in `index.html`).
- **Matching feed** — requests matched to trips by route + date (bug fixed: date comparison used to be backwards).
  - Runner view has a sort toggle: highest pay vs. closest to your actual route (word-overlap heuristic on pickup/drop-off points).
- **Match lifecycle** — accept (now with a confirmation dialog showing the item, route, and price
  before anything locks) → escrow (simulated, not real payment) → pickup confirmation → drop-off via
  4-digit code → wallet payout.
- **In-app chat** per match.
- **Ratings** — 1–5 stars after delivery, running average shown on profile.
- **Wallet** — balance + transaction history (simulated). Withdrawals now actually deduct from the
  balance and log a transaction, instead of just showing a toast with payout options and doing nothing.
- **Disputes** — either party can flag a delivery, which freezes the escrowed funds. Resolving a
  dispute (release to runner / refund sender, with a note kept on record) now requires unlocking
  **admin mode** in Profile with a PIN. This is a client-side placeholder gate for solo testing —
  the PIN lives in the page source (`ADMIN_PIN` in `index.html`), so it is **not real security**.
  It stops accidental self-resolution during testing, not a determined bad actor.

## Known limitations — read before assuming something's "done"

- **No real backend.** All data lives in one browser's `localStorage`. Two people testing on two
  different devices will *not* see each other's requests/trips. This was previously tried with
  Claude-artifact-only shared storage (`window.storage`), which broke the moment the file was
  downloaded and opened outside Claude.ai — that's why it was switched to plain `localStorage`.
- **No real payments.** Escrow, wallet balances, and payouts are simulated in-browser. Orange Money,
  MyZaka, BTC Smega, Visa/Mastercard integration all require real merchant agreements + API keys that
  need to be wired in separately — this file does not and cannot fabricate that.
- **No real auth.** "Login" is just a name prompt stored locally. No password, no verification.
- **Verification tiers are cosmetic.** The "upgrade verification" button in Profile just increments a
  number — there's no real ID upload/OCR/check behind it yet.
- **Dispute resolution has a placeholder gate, not real access control.** Admin mode is unlocked by
  a PIN that's visible in the page source — fine for solo testing, not a real permission system.
  Needs a real server-side admin role before this is trustworthy with real money.

## Locked product decisions (do not re-litigate these without a reason)

- PWA-first / static-web architecture — no native mobile apps.
- Fixed category-based restricted items list (cash, weapons, drugs, live animals, perishables, unpermitted exports never allowed).
- Cross-border electronics require a customs declaration with a declared value.
- Dispute flow: flagging freezes funds — never auto-releases, never auto-refunds.

## Repo structure

```
index.html   — the entire working app (HTML/CSS/JS, no dependencies)
docs/        — reserved for future design notes / specs
README.md    — this file
```

## Next steps (pick up here, don't rebuild from scratch)

1. Decide on a real backend (this is the biggest unlock — turns matching, escrow, and wallet from
   simulated to real, and enables actual multi-user matching).
2. Wire a real payment provider for escrow release/refund.
3. Add real ID verification for the tier system.
4. Replace the placeholder admin PIN with real server-side admin auth.
5. Cross-border rules currently only cover a small hardcoded city list (`COUNTRY_MAP` in `index.html`)
   — expand as needed.
