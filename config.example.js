// Copy this file to config.js and fill in your own Supabase project values.
// Find these in Supabase Dashboard -> Project Settings -> API.
// The anon key is safe to expose in client-side code — it only grants what
// your Row Level Security policies (see supabase/schema.sql) allow.

const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";

// Pata (Botswana) checkout widget — pay.pata.co.bw.
// Leave PATA_MERCHANT_ID empty to keep the widget dormant (the manual
// payment flow stays in effect). Paste your real merchant ID here once
// Pata activates your account.
const PATA_MERCHANT_ID = "";
const PATA_WIDGET_URL = "https://pay.pata.co.bw/widget.js";
