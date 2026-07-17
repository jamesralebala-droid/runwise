// ============================================================================
// RunWise — payment-webhook Edge Function (STUB)
// ============================================================================
// This is scaffolding, not a working integration. I don't have — and can't
// fabricate — real Orange Money / MyZaka / card processor credentials or
// their actual webhook payload shapes, so this function is deliberately
// incomplete. What it DOES show you is the correct, secure shape for the
// real thing:
//
//   1. The gateway calls this URL after a customer pays.
//   2. This function verifies the webhook is genuinely from the gateway
//      (HMAC signature check — mechanism varies per provider).
//   3. Only after that check passes does it call fund_escrow_serverside(),
//      using the SERVICE ROLE key — never the anon key — because that RPC
//      is locked down to service_role only (see settings_and_privacy.sql).
//
// Deploy with: supabase functions deploy payment-webhook
// Set secrets with: supabase secrets set GATEWAY_WEBHOOK_SECRET=...
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GATEWAY_WEBHOOK_SECRET = Deno.env.get("GATEWAY_WEBHOOK_SECRET") ?? "";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // --------------------------------------------------------------------
  // TODO: replace with the real gateway's signature verification.
  // Every provider does this differently — e.g. an HMAC-SHA256 of the raw
  // body using a shared secret, compared against a header they send. Do
  // NOT skip this in production: without it, anyone who finds this URL
  // could mark any order as "paid".
  // --------------------------------------------------------------------
  const signatureHeader = req.headers.get("x-gateway-signature") ?? "";
  const verified = await verifySignature(rawBody, signatureHeader, GATEWAY_WEBHOOK_SECRET);
  if (!verified) {
    return new Response("Invalid signature", { status: 401 });
  }

  // --------------------------------------------------------------------
  // TODO: replace with the real payload shape. This assumes a generic
  // { order_room_id, status, method, reference } body — adjust field
  // names once you have the real provider's docs.
  // --------------------------------------------------------------------
  const payload = JSON.parse(rawBody);
  if (payload.status !== "success") {
    return new Response("Ignored (payment not successful)", { status: 200 });
  }

  const { data, error } = await sb.rpc("fund_escrow_serverside", {
    p_order_room_id: payload.order_room_id,
    p_method: payload.method ?? "unknown",
    p_gateway_reference: payload.reference ?? "unknown",
  });

  if (error) {
    console.error("fund_escrow_serverside failed:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, escrow: data }), { status: 200 });
});

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  if (!secret) return false; // fail closed if no secret configured
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
}
