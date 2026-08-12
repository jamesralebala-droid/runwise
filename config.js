// RunWise browser configuration.
// This publishable key is intentionally safe for client-side use; Supabase RLS
// and the admin-only RPCs enforce authorization.
const SUPABASE_URL = "https://lugbyiwtmxvhmhtwcrle.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KG7TwPctMeDCLnRVcTdjIQ_ol3yPVvX";

// Expose on window so standalone pages (early-access.html) and other scripts
// can reach the configuration regardless of script order.
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// VAPID public key for Web Push notifications.
// To generate a VAPID key pair, run: npx web-push generate-vapid-keys
// Set this value and keep the corresponding PRIVATE key in your hosting
// environment (Vercel, Netlify) or Supabase Edge Function for sending pushes.
const VAPID_PUBLIC_KEY = "BGq8N5ZlemBUQeH_GY8vkh4bUku0MJNBrjCqexhvnypCgmxM0WO1vIZjAcXzYb1Y4xUmz2X5urXhIjJjPOQeZtY";
window.VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY;

// ---------------------------------------------------------------------------
// Pata (Botswana) checkout widget — pay.pata.co.bw.
// Leave PATA_MERCHANT_ID empty (or "your-merchant-id") to keep the widget
// dormant: the manual Orange Money flow stays in effect and the widget script
// is never loaded. Fill in your real merchant ID once Pata activates your
// account and the widget goes live.
// ---------------------------------------------------------------------------
const PATA_MERCHANT_ID = "";
const PATA_WIDGET_URL = "https://pay.pata.co.bw/widget.js";
window.PATA_MERCHANT_ID = PATA_MERCHANT_ID;
window.PATA_WIDGET_URL = PATA_WIDGET_URL;
