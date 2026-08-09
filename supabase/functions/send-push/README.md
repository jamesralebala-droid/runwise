# RunWise — `send-push` Edge Function

Server-side browser push delivery via VAPID (Web Push). This is the piece that
makes notifications arrive even when the recipient's RunWise tab is **closed**.

Flow:

```
sender's app.js -> triggerNotification() -> insert_notification RPC (returns row)
  -> sb.functions.invoke('send-push', { notification_id })
  -> web-push (VAPID-signed) -> recipient's push service (FCM/APNs/WebPush)
  -> notification-worker.js -> OS notification
```

## Prerequisites (one-time)

1. **VAPID keys** — already in use by the app:
   - Public key lives in `public/config.js` → `VAPID_PUBLIC_KEY` (client uses it
     to subscribe).
   - The **private** key must be set as a Supabase function secret (below). It is
     never shipped to the browser.
2. **Notification migration applied** — `supabase/migration_notifications.sql`
   (creates `notification_history`, `push_subscriptions`,
   `notification_preferences`, plus RLS and the `insert_notification` helper).
   If it hasn't been run yet, run it in the Supabase SQL Editor first.
3. **Realtime** — the notification migration now adds
   `notification_history` to the `supabase_realtime` publication automatically
   (idempotent). If in-app updates still don't arrive live after applying it,
   toggle Realtime on for that table in the Supabase dashboard.

## Deploy

From the repo root (function config lives in `supabase/config.toml`):

```bash
supabase login
supabase link --project-ref lugbyiwtmxvhmhtwcrle

supabase secrets set \
  VAPID_PRIVATE_KEY='<the private key matching public/config.js>' \
  VAPID_PUBLIC_KEY='BIMA8J7oauIVmPPdMz-FuUnfnD0Mj3ZuoAr30s3BiaO_T1LzraK1oFOVN83RyG_WdIx-aSifUhTjmiq1ocFnrvI' \
  VAPID_SUBJECT='mailto:support@runwise.co.bw' \
  PUSH_SEND_SECRET='<long random string>'

supabase functions deploy send-push
```

| Secret | Required | Purpose |
|---|---|---|
| `VAPID_PRIVATE_KEY` | ✅ | Signs every push. Function refuses to run without it. |
| `VAPID_PUBLIC_KEY` | optional | Matches `config.js`; included in VAPID details. |
| `VAPID_SUBJECT` | optional | Contact for push services; defaults to `mailto:support@runwise.co.bw`. |
| `PUSH_SEND_SECRET` | optional | Shared secret for server-side callers (e.g. a future DB trigger / cron): send it in the `x-push-secret` header. Client calls use the caller's Supabase JWT instead. |

To (re)generate a key pair if you ever rotate: `npx web-push generate-vapid-keys`
— then update BOTH `public/config.js` and the `VAPID_PRIVATE_KEY` secret.

## Request

`POST https://lugbyiwtmxvhmhtwcrle.supabase.co/functions/v1/send-push`

**Mode 1 — notification_id (used by the app):**
```json
{ "notification_id": "<uuid returned by insert_notification>" }
```
The function loads the row itself and sends to the notification's `user_id`.

**Mode 2 — direct (testing / server-side tools):**
```json
{ "user_id": "...", "title": "...", "body": "...", "data": { "order_room_id": "..." }, "priority": "high" }
```

## Behavior

- Respects the recipient's `notification_preferences.push_enabled` (skips when
  disabled, returns `{ "sent": 0, "skipped": "push_disabled" }`).
- Sends to **every** `push_subscriptions` row for the recipient.
- Prunes dead endpoints (push service returns 404/410) so the table stays clean.
- Returns `{ sent, failed, removed }`.

## Auth

- **Supabase user JWT** (`Authorization: Bearer …`) — used by the app's
  `sb.functions.invoke()` call automatically.
- **`x-push-secret`** header equal to `PUSH_SEND_SECRET` — for server-side
  callers that have no user session.
- `verify_jwt = false` in `supabase/config.toml` keeps the platform gate off so
  the shared-secret path works; the function performs its own authorization and
  rejects everything else with 401.
