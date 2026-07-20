---
name: RunWise architecture
description: How the RunWise project is structured — backends, auth, and data access patterns.
---

## Stack
- **Mobile app** (`artifacts/runwise`): Expo 54 + Expo Router + TypeScript. Talks **directly to Supabase** via `@supabase/supabase-js`. No Express API.
- **Admin portal** (`artifacts/runwise-admin`): React + Vite + shadcn/ui. Also talks **directly to Supabase**. No Express API.
- **API server** (`artifacts/api-server`): scaffold stub only — not used by RunWise features.
- **Database**: Supabase PostgreSQL at `https://lugbyiwtmxvhmhtwcrle.supabase.co`. RLS policies enforce access by role.

## Supabase env vars
- Mobile: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Admin: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Admin auth pattern
Admin users log in with Supabase email/password; after sign-in, `profiles.role` must equal `'admin'` or they are signed out.

## Mobile file layout
All source lives at `artifacts/runwise/` root (not in a `src/` subdirectory). `@/` path alias maps to `artifacts/runwise/`.

Key directories:
- `lib/` — supabase client, api helpers, theme, types, constants
- `providers/` — AuthProvider (session, profile, role switching)
- `components/` — ui.tsx (Screen, Card, AppButton, Field, Pill, etc.)
- `app/` — Expo Router file-based routing

## Critical RPC names (Supabase)
`propose_match`, `accept_match`, `decline_match`, `add_milestone`, `fund_escrow`, `set_delivery_pin`, `confirm_delivery`, `raise_dispute`, `get_nearby_contact`, `request_withdrawal`

**Why:** These RPCs are called from mobile screens. If they don't exist in Supabase, those actions will fail silently or throw; they must be created in the Supabase migrations.

## UUID generation
Mobile uses `crypto.randomUUID()` (built into RN 0.73+ / Hermes) with a fallback for environments where it is absent. Do NOT use `expo-crypto` — it causes Metro resolution errors with expo 54.
