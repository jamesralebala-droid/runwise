# RunWise Mobile

Android-first Expo React Native conversion of the RunWise customer and runner experience. The existing static web application remains available for the admin and business dashboard while this mobile client uses the same secured Supabase backend.

## Included in this first conversion

- Supabase email authentication and persistent mobile sessions
- Customer and runner mode switching
- Customer home, trip marketplace, request creation and offer acceptance/decline
- Runner verification, private KYC uploads, vehicle submission and trip announcement
- Smart route matches and server-side match proposals
- Order Rooms with escrow status, chat, journey milestones and real-time refresh
- Delivery PIN creation and server-side delivery confirmation
- Proximity-based location sharing and protected phone reveal
- Disputes, ratings, wallet activity and demo withdrawals
- Android package configuration and internal APK build profile

Admin and business operations intentionally remain in the web dashboard. Real Orange Money, MyZaka and card processing are still blocked on payment-provider credentials; this client clearly retains the existing demo payment behavior rather than pretending a live gateway is connected.

## Pata checkout (web + mobile placement)

Pata (pay.pata.co.bw) is RunWise's Botswana card / mobile-money gateway. Its widget is intended on **both the web app and this mobile client** (Pata placement: Both). The web integration lives in `public/pata.js` + `config.js` (`PATA_MERCHANT_ID`) and is **dormant until Pata activates the merchant account** — with no merchant ID set, no widget script loads and the manual flow stays in effect.

When wiring Pata here, mirror the web contract exactly so both clients reconcile against the same backend RPCs:

1. **Merchant ID**: reuse the same `PATA_MERCHANT_ID` from the web config (one Pata merchant account covers both placements). Keep the widget dormant until Pata confirms the account is live.
2. **Pay for an order**: create the payment with `create_order_payment(p_order_room_id, p_delivery_fee, p_payment_method: 'pata')`, open the Pata checkout (in-app browser or WebView mounting the widget with the order number as the transaction reference), then submit the returned reference with `submit_payment_reference(...)` — same as `payments.js`. Payments stay `payment_verification_required` until the admin portal verifies them, so no client-side trust is introduced.
3. **Wallet top-up**: call `request_wallet_topup(p_amount, p_reference)` with the Pata transaction reference after a successful checkout — the same RPC the web wallet uses.
4. **Dormancy**: while `PATA_MERCHANT_ID` is empty, hide Pata UI and keep the existing demo/manual payment behavior.

Supabase migration `20260812_001_pata_checkout.sql` seeds the `pata` payment method and defines `request_wallet_topup`; it must be applied before Pata goes live.

## Local setup

1. Copy `.env.example` to `.env`.
2. Add the same Supabase project URL and publishable key used by the RunWise web app.
3. Install packages with `npm install`.
4. Run `npm start`, then open the project in Expo Go or an Android emulator.

The Supabase SQL files and the `20260718_001_security_and_core_flow.sql` migration from the repository must already be installed.

## Checks

```bash
npm run typecheck
npx expo-doctor
```

## Android APK

After signing in to a free Expo account:

```bash
npx eas-cli build --platform android --profile preview
```

The `preview` profile creates an installable APK for direct testing. Production Play Store signing and release configuration come after the end-to-end test checklist passes on physical Android devices.
