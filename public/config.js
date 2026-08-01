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
const VAPID_PUBLIC_KEY = "BIMA8J7oauIVmPPdMz-FuUnfnD0Mj3ZuoAr30s3BiaO_T1LzraK1oFOVN83RyG_WdIx-aSifUhTjmiq1ocFnrvI";
window.VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY;
