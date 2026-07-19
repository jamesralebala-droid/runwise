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

## Local setup

1. Copy `.env.example` to `.env`.
2. Add the same Supabase project URL and anonymous key used by the RunWise web app.
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
