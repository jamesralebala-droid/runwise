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
- **Matching feed** — requests matched to trips by route + date (bug fixed: date comparison used to be backwards).
  - Runner view has a sort toggle: highest pay vs. closest to your actual route (word-overlap heuristic on pickup/drop-off points).
- **Match lifecycle** — accept → escrow (simulated, not real payment) → pickup confirmation → drop-off via 4-digit code → wallet payout.
- **In-app chat** per match.
- **Ratings** — 1–5 stars after delivery, running average shown on profile.
- **Wallet** — balance + transaction history (simulated).
- **Disputes** — either party can flag a delivery, which freezes the escrowed funds. A resolution panel
  (release to runner / refund sender, with a note kept on record) lets someone review and close it out.
  In production this review step needs to be restricted to an actual admin/reviewer role, not either party.

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
- **Dispute resolution has no access control.** Anyone looking at a disputed match can resolve it from
  either side right now. Needs a real admin-only gate before this is trustworthy.

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
4. Restrict dispute resolution to an admin role.
5. Cross-border rules currently only cover a small hardcoded city list (`COUNTRY_MAP` in `index.html`)
   — expand as needed.
