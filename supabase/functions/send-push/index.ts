// ============================================================================
// RunWise — send-push Edge Function
// ============================================================================
// Server-side browser push delivery. Completes the notification loop that the
// client started in public/notification-system.js:
//
//   sender's app.js -> triggerNotification() -> insert_notification RPC
//     -> this function (send-push) -> web-push -> recipient's push service
//     -> notification-worker.js -> OS notification
//
// This is what makes pushes arrive even when the recipient's RunWise tab is
// CLOSED (the old client-only path could only show a Notification while the
// tab was open in the background).
//
// Payload (either mode):
//   { notification_id }                     -> function reads the row itself
//   { user_id, title, body, data, priority }-> direct mode (for testing/tools)
//
// Security:
//   - Requires a valid Supabase user JWT (Authorization: Bearer …) OR the
//     PUSH_SEND_SECRET shared secret (x-push-secret header) for server-side
//     callers (e.g. a future DB trigger). No anonymous spam.
//   - Uses the SERVICE ROLE key internally, so RLS never blocks reading the
//     recipient's subscriptions. Never exposes any payload to other users.
//   - Respects the recipient's notification_preferences.push_enabled flag.
//   - Prunes push_subscriptions that the push service reports as dead
//     (404/410) so the table never fills with stale endpoints.
//
// Deploy:
//   supabase functions deploy send-push
//   supabase secrets set VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:you@example.com
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@runwise.co.bw";
const PUSH_SEND_SECRET = Deno.env.get("PUSH_SEND_SECRET") ?? "";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const corsHeaders = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

/** Accepts a valid Supabase user JWT or the shared PUSH_SEND_SECRET. */
async function authorize(authz: string, secret: string): Promise<boolean> {
  if (PUSH_SEND_SECRET && secret && secret === PUSH_SEND_SECRET) return true;
  if (authz && authz.startsWith("Bearer ")) {
    try {
      const token = authz.slice("Bearer ".length);
      const { data, error } = await sb.auth.getUser(token);
      return Boolean(data?.user) && !error;
    } catch {
      return false;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authorized = await authorize(
    req.headers.get("Authorization") ?? "",
    req.headers.get("x-push-secret") ?? "",
  );
  if (!authorized) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!VAPID_PRIVATE_KEY) {
    return json({ error: "VAPID_PRIVATE_KEY not configured on this function" }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // ---- Resolve the notification + recipient -----------------------------
  let userId = String(body.user_id ?? "");
  let title = String(body.title ?? "");
  let description = String(body.description ?? "");
  let data: Record<string, unknown> = (body.data && typeof body.data === "object")
    ? body.data as Record<string, unknown>
    : {};
  let highPriority = Boolean(body.high_priority) || body.priority === "high";
  let tag = "";

  if (body.notification_id) {
    const { data: notif, error } = await sb
      .from("notification_history")
      .select("*")
      .eq("id", body.notification_id)
      .maybeSingle();

    if (error) {
      console.error("load notification failed:", error);
      return json({ error: "Could not load notification" }, 500);
    }
    if (!notif) {
      return json({ error: "Notification not found" }, 404);
    }
    userId = String(notif.user_id);
    title = notif.title;
    description = notif.description;
    data = (notif.data && typeof notif.data === "object") ? notif.data : {};
    highPriority = Boolean(notif.is_high_priority);
    tag = "runwise-" + notif.id;
  }

  if (!userId || !title) {
    return json({ error: "user_id and title are required" }, 400);
  }

  // ---- Respect the recipient's push preference --------------------------
  const { data: prefs } = await sb
    .from("notification_preferences")
    .select("push_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (prefs && prefs.push_enabled === false) {
    return json({ sent: 0, skipped: "push_disabled" });
  }

  // ---- Load the recipient's subscriptions -------------------------------
  const { data: subs, error: subErr } = await sb
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (subErr) {
    console.error("load subscriptions failed:", subErr);
    return json({ error: "Could not load subscriptions" }, 500);
  }
  if (!subs || subs.length === 0) {
    return json({ sent: 0, skipped: "no_subscriptions" });
  }

  // ---- Send to every endpoint --------------------------------------------
  const payload = JSON.stringify({
    title,
    body: description,
    icon: "/runwise-logo.svg",
    badge: "/runwise-logo.svg",
    tag: tag || "runwise-default",
    data,
    requireInteraction: highPriority,
    silent: false,
  });

  const options = {
    TTL: 86400, // drop after 24h if device is offline
    urgency: highPriority ? ("high" as const) : ("normal" as const),
    vapidDetails: {
      subject: VAPID_SUBJECT,
      privateKey: VAPID_PRIVATE_KEY,
      ...(VAPID_PUBLIC_KEY ? { publicKey: VAPID_PUBLIC_KEY } : {}),
    },
  };

  const results = { sent: 0, failed: 0, removed: 0 };
  for (const sub of subs) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
    };
    try {
      await webpush.sendNotification(pushSub, payload, options);
      results.sent += 1;
    } catch (e) {
      const err = e as { statusCode?: number; status?: number; message?: string };
      const status = err.statusCode ?? err.status ?? 0;
      if (status === 404 || status === 410) {
        // Endpoint is gone — prune it so we don't retry dead subscriptions.
        try {
          await sb.from("push_subscriptions").delete().eq("id", sub.id);
        } catch (delErr) {
          console.warn("failed to delete dead subscription:", delErr);
        }
        results.removed += 1;
      } else {
        results.failed += 1;
        console.warn("push failed:", status, err.message ?? err, sub.endpoint);
      }
    }
  }

  return json(results);
});
