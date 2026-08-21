// ============================================================================
// RunWise — send-email Edge Function
// ============================================================================
// Transactional email delivery via Resend. Called from the client or from
// database triggers (e.g. after KYC approval, order completion).
//
// Payload:
//   { to, subject, html, text? }                    — direct mode
//   { template, to, data }                           — template mode
//
// Supported templates:
//   - order_confirmed     { customer_name, runner_name, order_no, route }
//   - delivery_complete   { customer_name, order_no, amount }
//   - kyc_approved        { full_name }
//   - kyc_rejected        { full_name, reason }
//   - welcome             { full_name }
//
// Deploy:
//   supabase functions deploy send-email
//   supabase secrets set RESEND_API_KEY=re_xxxxx
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("EMAIL_FROM") ?? "RunWise <notifications@runwise.co.bw>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const corsHeaders = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------
const TEMPLATES: Record<string, (d: Record<string, string>) => { subject: string; html: string }> = {
  welcome: (d) => ({
    subject: "Welcome to RunWise! 🚀",
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px">
        <h1 style="color:#123F34;font-size:24px">Welcome to RunWise, ${d.full_name}! 🎉</h1>
        <p style="color:#374151;line-height:1.6;font-size:15px">
          You're now part of Botswana's smartest delivery network. Whether you're sending or carrying,
          RunWise connects you with trusted runners across the country.
        </p>
        <div style="background:#F7F2E8;border-radius:12px;padding:20px;margin:24px 0">
          <p style="margin:0;color:#123F34;font-weight:600">What you can do next:</p>
          <ul style="color:#374151;font-size:14px;line-height:1.8;margin:8px 0 0 0">
            <li>📦 Post a delivery request</li>
            <li>🚗 Announce a trip (if you're a runner)</li>
            <li>🪪 Complete your KYC verification</li>
            <li>🚙 Add your vehicle for approval</li>
          </ul>
        </div>
        <a href="https://jamesralebala-droid.github.io/runwise/app/" style="display:inline-block;background:#123F34;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Open RunWise</a>
        <p style="color:#9CA3AF;font-size:12px;margin-top:32px">RunWise — Deliver Smarter. Move Faster. Earn More.</p>
      </div>`,
  }),

  order_confirmed: (d) => ({
    subject: `Order #${d.order_no} confirmed — your delivery is on the way!`,
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px">
        <h1 style="color:#123F34;font-size:22px">Order Confirmed ✅</h1>
        <p style="color:#374151;line-height:1.6;font-size:15px">Hi ${d.customer_name},</p>
        <p style="color:#374151;line-height:1.6;font-size:15px">
          Your delivery order <b>#${d.order_no}</b> has been matched with runner <b>${d.runner_name}</b>.
        </p>
        <div style="background:#F7F2E8;border-radius:12px;padding:20px;margin:24px 0">
          <p style="margin:0 0 8px;color:#123F34;font-weight:600">Route</p>
          <p style="margin:0;color:#374151;font-size:14px">${d.route || 'See order details in the app'}</p>
        </div>
        <a href="https://jamesralebala-droid.github.io/runwise/app/" style="display:inline-block;background:#123F34;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Track Your Order</a>
        <p style="color:#9CA3AF;font-size:12px;margin-top:32px">RunWise — Deliver Smarter. Move Faster. Earn More.</p>
      </div>`,
  }),

  delivery_complete: (d) => ({
    subject: `Order #${d.order_no} delivered! 🎉`,
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px">
        <h1 style="color:#123F34;font-size:22px">Delivery Complete 🎉</h1>
        <p style="color:#374151;line-height:1.6;font-size:15px">Hi ${d.customer_name},</p>
        <p style="color:#374151;line-height:1.6;font-size:15px">
          Your delivery order <b>#${d.order_no}</b> has been completed.
          ${d.amount ? `The amount of <b>P${d.amount}</b> has been released from escrow.` : ''}
        </p>
        <div style="background:#F7F2E8;border-radius:12px;padding:20px;margin:24px 0;text-align:center">
          <p style="margin:0;color:#123F34;font-size:28px">⭐ ⭐ ⭐ ⭐ ⭐</p>
          <p style="margin:8px 0 0;color:#68756e;font-size:13px">Rate your experience in the app</p>
        </div>
        <a href="https://jamesralebala-droid.github.io/runwise/app/" style="display:inline-block;background:#123F34;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Open RunWise</a>
        <p style="color:#9CA3AF;font-size:12px;margin-top:32px">RunWise — Deliver Smarter. Move Faster. Earn More.</p>
      </div>`,
  }),

  kyc_approved: (d) => ({
    subject: "Your RunWise identity has been verified ✅",
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px">
        <h1 style="color:#123F34;font-size:22px">Identity Verified ✅</h1>
        <p style="color:#374151;line-height:1.6;font-size:15px">Hi ${d.full_name},</p>
        <p style="color:#374151;line-height:1.6;font-size:15px">
          Great news — your identity documents have been approved by our team. You're now verified on RunWise and can accept delivery orders.
        </p>
        <a href="https://jamesralebala-droid.github.io/runwise/app/" style="display:inline-block;background:#123F34;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Open RunWise</a>
        <p style="color:#9CA3AF;font-size:12px;margin-top:32px">RunWise — Deliver Smarter. Move Faster. Earn More.</p>
      </div>`,
  }),

  kyc_rejected: (d) => ({
    subject: "Action needed — identity verification",
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px">
        <h1 style="color:#123F34;font-size:22px">Verification Update</h1>
        <p style="color:#374151;line-height:1.6;font-size:15px">Hi ${d.full_name},</p>
        <p style="color:#374151;line-height:1.6;font-size:15px">
          Unfortunately, we couldn't verify your identity with the documents provided.
        </p>
        <div style="background:#FEF2F2;border-left:4px solid #EF4444;border-radius:0 8px 8px 0;padding:16px;margin:24px 0">
          <p style="margin:0;color:#374151;font-size:14px"><b>Reason:</b> ${d.reason || 'The documents could not be approved.'}</p>
        </div>
        <p style="color:#374151;line-height:1.6;font-size:15px">Please try again with clearer or corrected documents.</p>
        <a href="https://jamesralebala-droid.github.io/runwise/app/" style="display:inline-block;background:#123F34;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Resubmit Documents</a>
        <p style="color:#9CA3AF;font-size:12px;margin-top:32px">RunWise — Deliver Smarter. Move Faster. Earn More.</p>
      </div>`,
  }),
};

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

  if (!RESEND_API_KEY) {
    return json({ error: "RESEND_API_KEY not configured" }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  let subject: string;
  let html: string;
  let to: string;

  // Template mode
  if (body.template && typeof body.template === "string" && TEMPLATES[body.template]) {
    to = String(body.to ?? "");
    if (!to) return json({ error: "to is required" }, 400);
    const rendered = TEMPLATES[body.template](body.data as Record<string, string> || {});
    subject = rendered.subject;
    html = rendered.html;
  }
  // Direct mode
  else if (body.subject && body.html && body.to) {
    to = String(body.to);
    subject = String(body.subject);
    html = String(body.html);
  } else {
    return json({ error: "Provide {template, to, data} or {to, subject, html}" }, 400);
  }

  // Send via Resend
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Resend error:", data);
      return json({ error: data.message || "Email send failed" }, 502);
    }

    return json({ sent: true, id: data.id });
  } catch (err) {
    console.error("Email send failed:", err);
    return json({ error: "Email delivery failed" }, 500);
  }
});
