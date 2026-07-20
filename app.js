// ============================================================================
// RunWise — app.js
// Talks to Supabase for real auth + persisted data. No localStorage mock data.
// ============================================================================
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = s => document.querySelector(s);
const money = n => 'P' + Number(n || 0).toLocaleString('en-BW');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const cache = new Map();
const newId = () => crypto.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
  const value = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
  return (char === 'x' ? value : (value & 3) | 8).toString(16);
});

const escapeHtml = value => String(value ?? '').replace(/[&<>"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
}[char]));
const titleCase = value => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

function friendlyError(error, fallback = 'Something went wrong. Please try again.') {
  const message = String(error?.message || error || '').trim();
  if (!message) return fallback;
  if (/load failed|failed to fetch|network|timeout|fetch/i.test(message)) return 'The connection was interrupted. Please try again.';
  if (/duplicate key|already exists/i.test(message)) return 'This has already been submitted.';
  return message;
}

function isTransient(error) {
  const message = String(error?.message || error || '');
  const status = Number(error?.status || error?.code || 0);
  return /load failed|failed to fetch|network|timeout|fetch|connection|502|503|504/i.test(message) || [408, 429, 500, 502, 503, 504].includes(status);
}

async function readWithRetry(operation, attempts = 3) {
  let result;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      result = await operation();
    } catch (error) {
      result = { data: null, error };
    }
    if (!result?.error) return result;
    if (!isTransient(result.error) || attempt === attempts - 1) return result;
    await wait(350 * (2 ** attempt));
  }
  return result;
}

async function idempotentWrite(table, payload, attempts = 2) {
  let result;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      result = await sb.from(table).upsert(payload, { onConflict: 'id' });
    } catch (error) {
      result = { error };
    }
    if (!result?.error) return result;
    if (!isTransient(result.error) || attempt === attempts - 1) return result;
    await wait(500 * (attempt + 1));
  }
  return result;
}

async function cachedRead(key, operation, fallback = []) {
  const saved = cache.get(key);
  if (saved && Date.now() - saved.time < 12000) return saved.data;
  const { data, error } = await readWithRetry(operation);
  if (error) throw error;
  const value = data ?? fallback;
  cache.set(key, { data: value, time: Date.now() });
  return value;
}

function clearCache(...prefixes) {
  if (!prefixes.length) return cache.clear();
  for (const key of cache.keys()) {
    if (prefixes.some(prefix => key.startsWith(prefix))) cache.delete(key);
  }
}

function setBusy(button, busy, busyLabel = 'Working…') {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyLabel;
    button.disabled = true;
    button.classList.add('is-busy');
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
    button.classList.remove('is-busy');
  }
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------
const state = {
  session: null, profile: null, page: 'home', openOrderRoom: null,
  legalMode: false, renderId: 0, bootId: 0,
};

const menus = {
  customer: [['home', '⌂ Home'], ['trips', '🚗 Trip Marketplace'], ['requests', '📦 My Requests'],
             ['customerMatches', '🤝 Match Offers'], ['orders', '📍 My Orders'], ['wallet', '◈ Wallet']],
  runner:   [['runner', '⌂ Runner Home'], ['verification', '🪪 Verification'], ['vehicle', '🚙 My Vehicles'],
             ['announce', '✈ Announce Trip'], ['mytrips', '🚗 My Trips'],
             ['matches', '⚡ Smart Matches'], ['orders', '📍 My Orders'], ['earnings', '◈ Earnings']],
  admin:    [['admin', '⌂ Admin Home'], ['adminRunners', '🪪 Runner Approvals'], ['adminVehicles', '🚙 Vehicle Approvals'], ['adminDisputes', '⚖ Dispute Cases'], ['adminOperations', '▦ Operations'], ['adminAudit', '🧾 Audit Log'], ['adminSettings', '⚙ Platform Settings'], ['adminLegal', '📜 Legal Documents']],
};
const titles = {
  home: 'Home', trips: 'Trip Marketplace', requests: 'My Requests', customerMatches: 'Match Offers', orders: 'My Orders', wallet: 'Wallet',
  runner: 'Runner Home', announce: 'Announce Trip', mytrips: 'My Trips', matches: 'Smart Matches', earnings: 'Earnings',
  verification: 'Runner Verification', vehicle: 'My Vehicles',
  admin: 'Admin Home', adminRunners: 'Runner Approvals', adminVehicles: 'Vehicle Approvals', adminDisputes: 'Dispute Cases',
  adminOperations: 'Operations', adminAudit: 'Audit Log', adminSettings: 'Platform Settings', adminLegal: 'Legal Documents', newRequest: 'Post a Request',
};
const REQUEST_TYPES = ['shopping', 'parcel', 'documents', 'medicine', 'gift', 'business_stock', 'large_cargo'];
const MILESTONE_LABELS = {
  heading_to_pickup: 'Heading to Pickup', collected: 'Collected', shopping_started: 'Shopping Started',
  shopping_complete: 'Shopping Complete', journey_started: 'Journey Started', border_reached: 'Border Reached',
  customs_processing: 'Customs Processing', border_cleared: 'Border Cleared', destination_reached: 'Destination Reached',
  out_for_delivery: 'Out for Delivery', delivered: 'Delivered', delayed: 'Delayed', personal_stop: 'Personal Stop',
  vehicle_breakdown: 'Vehicle Breakdown', emergency: 'Emergency',
};
const DISPUTE_REASONS = ['Missing item', 'Wrong item', 'Damaged item', 'Late delivery', 'Payment problem', 'Fraud', 'Unsafe conduct', 'Other'];
const RATING_AREAS = {
  runner: ['Communication', 'Accuracy', 'Packaging', 'Trust', 'Timeliness'],
  customer: ['Respect', 'Pickup readiness', 'Communication', 'Safety', 'Payment reliability'],
};
const DISPUTE_OUTCOMES = [
  ['release_funds', 'Release funds to runner'],
  ['full_refund', 'Full refund to customer (runner forfeits fee)'],
  ['partial_refund', 'Partial refund — pay runner a reduced fee'],
  ['runner_penalty', 'Runner penalty (−15 RunScore)'],
  ['customer_penalty', 'Restrict customer account'],
  ['account_restriction', 'Restrict both accounts'],
  ['suspension', 'Suspend runner'],
];

const LEGAL_DOCS = [
  ['terms', 'Terms and Conditions'],
  ['privacy', 'Privacy Policy'],
  ['runner_agreement', 'Runner Agreement'],
  ['payments_escrow', 'Payments and Escrow Policy'],
  ['refunds_cancellations', 'Refund and Cancellation Policy'],
  ['prohibited_items', 'Prohibited and Restricted Items Policy'],
  ['community_safety', 'Community and Safety Standards'],
  ['kyc_verification', 'KYC and Verification Policy'],
  ['cross_border', 'Cross-Border Delivery Policy'],
  ['cookies', 'Cookie Policy'],
];
const RUNNER_ACTIVATION_DOCS = ['runner_agreement', 'community_safety', 'prohibited_items', 'kyc_verification'];

async function hasAcceptedCurrent(documentType) {
  const { data, error } = await sb.rpc('has_accepted_current', { p_document_type: documentType });
  if (error) { console.error(error); return false; }
  return !!data;
}
async function recordAcceptance(documentType, context, relatedId = null) {
  const { data: doc } = await sb.from('legal_documents').select('version').eq('document_type', documentType).eq('status', 'published').maybeSingle();
  if (!doc) return; // no published version to accept — nothing to record
  await sb.from('legal_acceptances').insert({
    user_id: state.profile.id, document_type: documentType, document_version: doc.version,
    acceptance_context: context, related_record_id: relatedId,
    user_role: state.profile.active_role,
  });
}
function legalLinkHtml(type, label) {
  return `<a href="#legal/${type}" target="_blank" class="legal-link" data-doc="${type}">${label}</a>`;
}

// ---------------------------------------------------------------------------
// AUTH SCREEN WIRING
// ---------------------------------------------------------------------------
$('#tabLogin').onclick = () => { $('#tabLogin').classList.add('active'); $('#tabSignup').classList.remove('active'); $('#loginForm').classList.remove('hidden'); $('#signupForm').classList.add('hidden'); };
$('#tabSignup').onclick = () => { $('#tabSignup').classList.add('active'); $('#tabLogin').classList.remove('active'); $('#signupForm').classList.remove('hidden'); $('#loginForm').classList.add('hidden'); };

document.querySelectorAll('.role-pick button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.role-pick button').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  $('#signupForm [name=role]').value = b.dataset.role;
});

$('#loginForm').onsubmit = async e => {
  e.preventDefault();
  $('#loginError').textContent = '';
  const button = e.submitter;
  setBusy(button, true, 'Logging in…');
  const f = new FormData(e.target);
  const { error } = await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
  if (error) $('#loginError').textContent = friendlyError(error, 'Could not log in.');
  setBusy(button, false);
};

$('#signupForm').onsubmit = async e => {
  e.preventDefault();
  $('#signupError').textContent = '';
  const button = e.submitter;
  setBusy(button, true, 'Creating account…');
  const f = new FormData(e.target);
  if (!f.get('accept_terms') || !f.get('accept_privacy')) {
    $('#signupError').textContent = 'Please accept both the Terms and the Privacy Policy to continue.';
    return;
  }
  const { data, error } = await sb.auth.signUp({
    email: f.get('email'),
    password: f.get('password'),
    options: { data: { full_name: f.get('full_name'), role: f.get('role') } },
  });
  if (error) { $('#signupError').textContent = friendlyError(error, 'Could not create the account.'); setBusy(button, false); return; }
  if (data.session) {
    // No email confirmation required — we have a session now, record acceptance right away.
    state.profile = { id: data.user.id, active_role: f.get('role') };
    await recordAcceptance('terms', 'registration');
    await recordAcceptance('privacy', 'registration');
  }
  toast('Account created. Check your email to confirm, then log in.');
  $('#tabLogin').click();
  setBusy(button, false);
};

$('#signOutBtn').onclick = async () => { clearCache(); await sb.auth.signOut(); };

// ---------------------------------------------------------------------------
// SESSION HANDLING
// ---------------------------------------------------------------------------
sb.auth.onAuthStateChange((_event, session) => {
  state.session = session;
  setTimeout(() => { if (session) boot(session); else showAuth(); }, 0);
});

async function showAuth() {
  if (state.legalMode) return; // legal viewer takes priority over the auth screen
  state.bootId += 1;
  state.profile = null;
  $('#authScreen').classList.remove('hidden');
  $('#app').classList.add('hidden');
  const s = document.getElementById('suspendedScreen');
  if (s) s.classList.add('hidden');
}

// ---------------------------------------------------------------------------
// LEGAL DOCUMENT VIEWER — works with or without a logged-in session.
// Route shape: #legal (index of all documents) or #legal/<document_type>
// ---------------------------------------------------------------------------
function checkLegalRoute() {
  const hash = location.hash || '';
  if (!hash.startsWith('#legal')) {
    if (state.legalMode) {
      state.legalMode = false;
      $('#legalScreen').classList.add('hidden');
      if (state.session) { $('#app').classList.remove('hidden'); } else { $('#authScreen').classList.remove('hidden'); }
    }
    return;
  }
  state.legalMode = true;
  $('#authScreen').classList.add('hidden');
  $('#app').classList.add('hidden');
  $('#legalScreen').classList.remove('hidden');
  const parts = hash.replace('#legal', '').split('/').filter(Boolean);
  if (parts.length) renderLegalDoc(parts[0]); else renderLegalIndex();
}
window.addEventListener('hashchange', checkLegalRoute);

function renderLegalIndex() {
  $('#legalToc').innerHTML = '';
  $('#legalDoc').innerHTML = `<h1>RunWise Legal Documents</h1>
    <p><em>RunWise Legal Pack v1.0 — Draft for review by qualified counsel in each applicable jurisdiction.</em></p>
    <div class="legal-doc-list">${LEGAL_DOCS.map(([type, label]) => `<a href="#legal/${type}">${label}</a>`).join('')}</div>`;
}

async function renderLegalDoc(type) {
  $('#legalDoc').innerHTML = '<p class="loading">Loading…</p>';
  $('#legalToc').innerHTML = '';
  const { data: doc, error } = await sb.from('legal_documents').select('*').eq('document_type', type).eq('status', 'published').maybeSingle();
  if (error || !doc) {
    $('#legalDoc').innerHTML = `<p class="empty">This document isn't available right now.</p><p><a href="#legal">← All legal documents</a></p>`;
    return;
  }
  $('#legalDoc').innerHTML = doc.body_html;
  const headings = Array.from($('#legalDoc').querySelectorAll('h2[id]'));
  $('#legalToc').innerHTML = headings.length
    ? `<b>On this page</b>` + headings.map(h => `<a href="#legal/${type}#${h.id}">${h.textContent}</a>`).join('')
    : '';
}

$('#legalBack').onclick = () => {
  if (history.length > 1) history.back(); else location.hash = '';
};
$('#legalPrint').onclick = () => window.print();

async function boot(session = state.session) {
  const bootId = ++state.bootId;
  let profile = null;
  let lastError = null;
  for (let attempt = 0; attempt < 5 && !profile; attempt += 1) {
    const result = await readWithRetry(() => sb.from('profiles').select('id, full_name, phone, role, active_role, run_score, run_score_level, rating_sum, rating_count, suspended, restricted, created_at').eq('id', session.user.id).maybeSingle(), 2);
    profile = result.data;
    lastError = result.error;
    if (!profile && attempt < 4) await wait(300 * (attempt + 1));
  }
  if (bootId !== state.bootId) return;
  if (!profile) {
    $('#authScreen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#content').innerHTML = `<div class="load-error"><b>We could not finish loading your profile.</b><span>${escapeHtml(friendlyError(lastError))}</span><button class="primary" id="retryBoot">Try again</button></div>`;
    $('#retryBoot').onclick = () => boot(session);
    return;
  }
  state.profile = profile;

  if (profile.suspended) {
    $('#authScreen').classList.add('hidden');
    $('#app').classList.add('hidden');
    showSuspendedScreen();
    return;
  }

  // If they signed up via email confirmation, the acceptance rows couldn't be
  // written at signup time (no session existed yet) — record them now, since
  // the signup form already required both checkboxes before account creation.
  if (!(await hasAcceptedCurrent('terms'))) await recordAcceptance('terms', 'registration');
  if (!(await hasAcceptedCurrent('privacy'))) await recordAcceptance('privacy', 'registration');

  if (state.legalMode) return; // stay on the legal viewer if that's what's open
  $('#authScreen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  state.page = profile.active_role === 'runner' ? 'runner' : 'home';
  render();
}

function showSuspendedScreen() {
  let el = document.getElementById('suspendedScreen');
  if (!el) {
    el = document.createElement('div');
    el.id = 'suspendedScreen';
    el.className = 'auth-wrap';
    document.body.appendChild(el);
  }
  el.innerHTML = `<h1>Account Suspended</h1>
    <p>Your RunWise account has been suspended following a dispute resolution.
    If you believe this is a mistake, please contact RunWise support.</p>
    <button class="primary" id="suspendedSignOut" style="width:100%">Sign out</button>`;
  el.classList.remove('hidden');
  document.getElementById('suspendedSignOut').onclick = async () => { await sb.auth.signOut(); el.classList.add('hidden'); };
}

// ---------------------------------------------------------------------------
// DATA HELPERS
// ---------------------------------------------------------------------------
async function fetchOpenTrips() {
  return cachedRead('open-trips', async () => {
    const { data: trips, error } = await sb.from('trips').select('*').order('depart_date', { ascending: true }).limit(30);
    if (error) return { data: null, error };
    const runnerIds = [...new Set((trips || []).map(t => t.runner_id))];
    if (!runnerIds.length) return { data: trips || [], error: null };
    const profilesResult = await sb.from('public_profiles').select('id, full_name, rating_sum, rating_count').in('id', runnerIds);
    if (profilesResult.error) return { data: null, error: profilesResult.error };
    const byId = Object.fromEntries((profilesResult.data || []).map(p => [p.id, p]));
    trips.forEach(t => { t.profiles = byId[t.runner_id]; });
    return { data: trips, error: null };
  });
}
async function fetchMyRequests() {
  return cachedRead(`my-requests:${state.profile.id}`, () => sb.from('requests').select('*').eq('customer_id', state.profile.id).order('created_at', { ascending: false }));
}
async function fetchMyTrips() {
  return cachedRead(`my-trips:${state.profile.id}`, () => sb.from('trips').select('*').eq('runner_id', state.profile.id).order('created_at', { ascending: false }));
}
async function fetchOpenRequests() {
  return cachedRead('open-requests', () => sb.from('requests').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(30));
}
async function fetchMyOrderRooms() {
  const col = state.profile.active_role === 'runner' ? 'runner_id' : 'customer_id';
  return cachedRead(`rooms:${col}:${state.profile.id}`, () => sb.from('order_rooms').select('*, escrow_transactions(*)').eq(col, state.profile.id).order('created_at', { ascending: false }));
}
async function fetchWallet() {
  return cachedRead(`wallet:${state.profile.id}`, () => sb.from('wallets').select('*').eq('user_id', state.profile.id).maybeSingle(), null);
}
async function fetchWalletTx(walletId) {
  return cachedRead(`wallet-tx:${walletId}`, () => sb.from('wallet_transactions').select('*').eq('wallet_id', walletId).order('created_at', { ascending: false }).limit(20));
}
async function fetchMyVerification() {
  return cachedRead(`verification:${state.profile.id}`, () => sb.from('runner_verifications').select('*').eq('user_id', state.profile.id).order('created_at', { ascending: false }).limit(1).maybeSingle(), null);
}
async function fetchMyVehicles() {
  return cachedRead(`vehicles:${state.profile.id}`, () => sb.from('vehicles').select('*').eq('user_id', state.profile.id).order('created_at', { ascending: false }));
}
async function fetchApprovedVehicles() {
  return cachedRead(`approved-vehicles:${state.profile.id}`, () => sb.from('vehicles').select('id, make_model, plate_number').eq('user_id', state.profile.id).eq('approved', true).order('created_at', { ascending: false }));
}
async function fetchCustomerMatches() {
  return cachedRead(`customer-matches:${state.profile.id}`, () => sb.from('matches')
    .select('*, trips:trip_id(from_city, to_city, depart_date, depart_time), requests:request_id(type, from_city, to_city, estimated_value, details)')
    .eq('customer_id', state.profile.id)
    .order('created_at', { ascending: false }));
}
async function fetchPendingVerifications() {
  return cachedRead('pending-verifications', () => sb.from('runner_verifications').select('*, profiles:user_id(full_name)').eq('status', 'pending').order('created_at', { ascending: true }));
}
async function fetchPendingVehicles() {
  return cachedRead('pending-vehicles', () => sb.from('vehicles').select('*, profiles:user_id(full_name)').eq('review_status', 'pending').order('created_at', { ascending: true }));
}
async function signedUrl(path) {
  if (!path) return null;
  const { data, error } = await sb.storage.from('runwise-uploads').createSignedUrl(path, 600);
  if (error) return null;
  return data.signedUrl;
}
async function uploadToStorage(file, folder) {
  const path = `${folder}/${state.profile.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
  const { error } = await sb.storage.from('runwise-uploads').upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}
async function fetchDisputeForRoom(roomId) {
  const { data } = await sb.from('disputes').select('*').eq('order_room_id', roomId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data;
}
async function fetchMyRatingForRoom(roomId) {
  const { data } = await sb.from('ratings').select('*').eq('order_room_id', roomId).eq('rater_id', state.profile.id).maybeSingle();
  return data;
}
async function fetchOpenDisputes() {
  const { data, error } = await sb.from('disputes').select('*, order_rooms(*, escrow_transactions(*))').eq('status', 'open').order('created_at', { ascending: true });
  if (error) { toast(error.message); return []; }
  return data;
}
async function fetchAdminCounts() {
  const queries = [
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('order_rooms').select('id', { count: 'exact', head: true }),
    sb.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ];
  const [users, orders, disputes] = await Promise.all(queries);
  return { users: users.count || 0, orders: orders.count || 0, disputes: disputes.count || 0 };
}
async function fetchAdminDisputes() {
  const { data, error } = await sb.from('disputes')
    .select('*, order_rooms(*, escrow_transactions(*))')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}
async function fetchAdminUsers() {
  const { data, error } = await sb.from('profiles')
    .select('id, full_name, phone, role, active_role, run_score, run_score_level, rating_sum, rating_count, suspended, restricted, created_at')
    .order('created_at', { ascending: false })
    .limit(250);
  if (error) throw error;
  return data || [];
}
async function fetchAdminOrders() {
  const { data: rooms, error } = await sb.from('order_rooms')
    .select('*, escrow_transactions(*)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const ids = [...new Set((rooms || []).flatMap(r => [r.customer_id, r.runner_id]).filter(Boolean))];
  const { data: profiles, error: profileError } = ids.length
    ? await sb.from('profiles').select('id, full_name, phone').in('id', ids)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  return (rooms || []).map(r => ({ ...r, customer: byId[r.customer_id], runner: byId[r.runner_id] }));
}
async function fetchAdminTransactions() {
  const { data: transactions, error } = await sb.from('wallet_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(250);
  if (error) throw error;
  const walletIds = [...new Set((transactions || []).map(t => t.wallet_id).filter(Boolean))];
  const { data: wallets, error: walletError } = walletIds.length
    ? await sb.from('wallets').select('id, user_id, owner_type').in('id', walletIds)
    : { data: [], error: null };
  if (walletError) throw walletError;
  const userIds = [...new Set((wallets || []).map(w => w.user_id).filter(Boolean))];
  const { data: profiles, error: profileError } = userIds.length
    ? await sb.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const profileById = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  const walletById = Object.fromEntries((wallets || []).map(w => [w.id, { ...w, profile: profileById[w.user_id] }]));
  return (transactions || []).map(t => ({ ...t, wallet: walletById[t.wallet_id] }));
}
async function fetchAdminAudit(limit = 250) {
  const { data: entries, error } = await sb.from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const adminIds = [...new Set((entries || []).map(e => e.admin_id).filter(Boolean))];
  const { data: admins, error: adminError } = adminIds.length
    ? await sb.from('profiles').select('id, full_name').in('id', adminIds)
    : { data: [], error: null };
  if (adminError) throw adminError;
  const byId = Object.fromEntries((admins || []).map(p => [p.id, p]));
  return (entries || []).map(e => ({ ...e, admin: byId[e.admin_id] }));
}
async function fetchSettings() {
  const { data, error } = await sb.from('platform_settings').select('*').eq('id', 1).single();
  if (error) { toast(error.message); return null; }
  return data;
}
async function fetchLegalDocuments() {
  const { data, error } = await sb.from('legal_documents').select('*').order('document_type').order('created_at', { ascending: false });
  if (error) { toast(error.message); return []; }
  return data;
}
async function fetchComplianceFlags() {
  const { data, error } = await sb.from('legal_compliance_flags').select('*').order('created_at', { ascending: false });
  if (error) { toast(error.message); return []; }
  return data;
}
async function fetchAcceptanceCounts() {
  const counts = {};
  for (const [type] of LEGAL_DOCS) {
    const { count } = await sb.from('legal_acceptances').select('id', { count: 'exact', head: true }).eq('document_type', type);
    counts[type] = count || 0;
  }
  return counts;
}
async function shareMyLocation(orderRoomId) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location sharing is not supported on this device.'));
    navigator.geolocation.getCurrentPosition(async pos => {
      const { error } = await sb.from('live_locations').upsert({
        order_room_id: orderRoomId, user_id: state.profile.id,
        lat: pos.coords.latitude, lng: pos.coords.longitude, updated_at: new Date().toISOString(),
      });
      if (error) reject(error); else resolve();
    }, err => reject(new Error('Could not get your location: ' + err.message)));
  });
}
async function checkNearbyContact(orderRoomId) {
  const { data, error } = await sb.rpc('get_nearby_contact', { p_order_room_id: orderRoomId });
  if (error) { toast(error.message); return null; }
  return data && data[0];
}

// ---------------------------------------------------------------------------
// RENDER: SHELL
// ---------------------------------------------------------------------------
async function hasAnyAcceptance(documentType) {
  const { data } = await sb.from('legal_acceptances').select('id').eq('user_id', state.profile.id).eq('document_type', documentType).limit(1);
  return !!(data && data.length);
}

async function attemptSwitchRole(newRole, afterPage) {
  if (newRole === 'runner') {
    const checks = await Promise.all(RUNNER_ACTIVATION_DOCS.map(hasAcceptedCurrent));
    const confirmed = await Promise.all(['runner_capability_confirmation', 'runner_verification_disclaimer'].map(hasAnyAcceptance));
    if (checks.includes(false) || confirmed.includes(false)) {
      showRunnerActivationGate(newRole, afterPage);
      return;
    }
  }
  setBusy($('#modeBtn'), true, 'Switching…');
  const { error } = await sb.from('profiles').update({ active_role: newRole }).eq('id', state.profile.id);
  if (error) { toast(friendlyError(error)); setBusy($('#modeBtn'), false); return; }
  state.profile.active_role = newRole;
  state.page = afterPage;
  render();
}

function showRunnerActivationGate(newRole, afterPage) {
  let el = document.getElementById('runnerGate');
  if (!el) {
    el = document.createElement('div');
    el.id = 'runnerGate';
    el.className = 'auth-wrap';
    el.style.maxWidth = '520px';
    document.body.appendChild(el);
  }
  el.innerHTML = `<h1>Before you activate Runner Mode</h1>
    <p><small>Please review and accept the following before carrying deliveries on RunWise.</small></p>
    <div class="declaration-box">
      ${RUNNER_ACTIVATION_DOCS.map(type => `<div class="legal-check"><label>
        <input type="checkbox" class="gateDoc" data-doc="${type}">
        I have read and accept the ${legalLinkHtml(type, LEGAL_DOCS.find(d => d[0] === type)[1])}.
      </label></div>`).join('')}
      <div class="legal-check"><label>
        <input type="checkbox" class="gateConfirm" data-doc="runner_capability_confirmation">
        I understand that I am responsible for checking and maintaining any licence, roadworthiness certificate, insurance, operator authorisation, customs document, or transport permit required by law.
      </label></div>
      <div class="legal-check"><label>
        <input type="checkbox" class="gateConfirm" data-doc="runner_verification_disclaimer">
        I understand that verification by RunWise is not a guarantee of safety, honesty, legal compliance, or future conduct.
      </label></div>
    </div>
    <button class="primary" id="gateAgree" style="width:100%">I Agree & Continue</button>
    <button class="secondary" id="gateCancel" style="width:100%;margin-top:8px">Cancel</button>`;
  el.classList.remove('hidden');

  document.getElementById('gateCancel').onclick = () => el.classList.add('hidden');
  document.getElementById('gateAgree').onclick = async () => {
    const boxes = Array.from(el.querySelectorAll('input[type=checkbox]'));
    if (boxes.some(b => !b.checked)) { toast('Please accept all items to continue.'); return; }
    for (const b of el.querySelectorAll('.gateDoc')) await recordAcceptance(b.dataset.doc, 'runner_activation');
    for (const b of el.querySelectorAll('.gateConfirm')) {
      await sb.from('legal_acceptances').insert({
        user_id: state.profile.id, document_type: b.dataset.doc, document_version: '1.0',
        acceptance_context: 'runner_activation', user_role: state.profile.active_role,
      });
    }
    el.classList.add('hidden');
    await sb.from('profiles').update({ active_role: newRole }).eq('id', state.profile.id);
    state.profile.active_role = newRole;
    state.page = afterPage;
    render();
  };
}

function render() {
  const role = state.profile.active_role;
  const isAdminUser = state.profile.role === 'admin';
  $('#nav').innerHTML = menus[role].map(([p, label]) =>
    `<button class="nav-btn ${state.page === p ? 'active' : ''}" data-page="${p}">${label}</button>`).join('');
  document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => { state.page = b.dataset.page; render(); });

  $('#portalName').textContent = role === 'runner' ? 'RUNNER MODE' : role === 'admin' ? 'ADMIN MODE' : 'RUNWISE MARKETPLACE';
  $('#pageTitle').textContent = titles[state.page] || 'Home';

  if (isAdminUser) {
    const order = ['customer', 'runner', 'admin'];
    const nextRole = order[(order.indexOf(role) + 1) % order.length];
    $('#modeBtn').textContent = 'Switch to ' + nextRole[0].toUpperCase() + nextRole.slice(1);
    $('#modeBtn').onclick = () => attemptSwitchRole(nextRole, nextRole === 'runner' ? 'runner' : nextRole === 'admin' ? 'admin' : 'home');
  } else {
    $('#modeBtn').textContent = role === 'runner' ? 'Switch to Customer' : 'Switch to Runner';
    $('#modeBtn').onclick = () => {
      const newRole = role === 'runner' ? 'customer' : 'runner';
      attemptSwitchRole(newRole, newRole === 'runner' ? 'runner' : 'home');
    };
  }

  $('#primaryAction').classList.toggle('hidden', role === 'admin');
  $('#primaryAction').textContent = role === 'runner' ? '+ Announce Trip' : '+ Post Request';
  $('#primaryAction').onclick = () => role === 'runner' ? (state.page = 'announce', render()) : openRequestModal();

  if (state.profile.restricted) {
    $('#primaryAction').disabled = true;
    $('#primaryAction').title = 'Your account is restricted — you can\'t create new listings right now.';
  } else {
    $('#primaryAction').disabled = false;
    $('#primaryAction').title = '';
  }

  renderPage();
}

async function renderPage() {
  const c = $('#content');
  const renderId = ++state.renderId;
  c.innerHTML = '<div class="loading-cards"><i></i><i></i><i></i></div>';
  const role = state.profile.active_role;
  let html = '';
  try {
    if (role === 'admin') {
      if (state.page === 'adminRunners') html = await adminRunnersView();
      else if (state.page === 'adminVehicles') html = await adminVehiclesView();
      else if (state.page === 'adminDisputes') html = await adminDisputesView();
      else if (state.page === 'adminOperations') html = await adminOperationsView();
      else if (state.page === 'adminAudit') html = await adminAuditView();
      else if (state.page === 'adminSettings') html = await adminSettingsView();
      else if (state.page === 'adminLegal') html = await adminLegalView();
      else html = await adminHomeView();
    } else if (role === 'runner') {
      if (state.page === 'verification') html = await verificationView();
      else if (state.page === 'vehicle') html = await vehicleView();
      else if (state.page === 'announce') html = await announceView();
      else if (state.page === 'mytrips') html = await myTripsView();
      else if (state.page === 'matches') html = await matchesView('runner');
      else if (state.page === 'orders') html = await ordersView();
      else if (state.page === 'earnings') html = await earningsView();
      else html = await runnerHomeView();
    } else {
      if (state.page === 'trips') html = await tripsView();
      else if (state.page === 'requests') html = await requestsView();
      else if (state.page === 'customerMatches') html = await customerMatchesView();
      else if (state.page === 'orders') html = await ordersView();
      else if (state.page === 'wallet') html = await walletView();
      else html = await homeView();
    }
  } catch (error) {
    if (renderId !== state.renderId) return;
    c.innerHTML = `<div class="load-error"><b>This page did not load.</b><span>${escapeHtml(friendlyError(error))}</span><button class="primary" id="retryPage">Try again</button></div>`;
    $('#retryPage').onclick = () => { clearCache(); renderPage(); };
    return;
  }
  if (renderId !== state.renderId) return;
  c.innerHTML = (state.profile.restricted ? `<div class="card" style="border-color:var(--danger);background:var(--danger-bg)">
      <b>Your account is restricted.</b> You can still manage existing orders, chat, and receive payouts,
      but you can't post new requests or announce new trips. Contact RunWise support if you think this is a mistake.
    </div>` : '') + html;
  bindPage();
}

// ---------------------------------------------------------------------------
// VIEWS: CUSTOMER
// ---------------------------------------------------------------------------
function requestIcon(type) {
  return ({ shopping: '🛍️', parcel: '📦', documents: '📄', medicine: '💊', gift: '🎁', business_stock: '🏪', large_cargo: '🚚' })[type] || '📦';
}

function tripCard(t) {
  const runnerName = t.profiles?.full_name || 'Runner';
  const rating = t.profiles?.rating_count ? (t.profiles.rating_sum / t.profiles.rating_count).toFixed(1) : '—';
  return `<div class="card trip-card">
    <div><span class="badge success">${t.status.replace('_',' ')}</span>
      <h3>${escapeHtml(t.from_city)} → ${escapeHtml(t.to_city)}</h3>
      <p>${escapeHtml(t.depart_date)} • ${escapeHtml(t.depart_time)} • ${escapeHtml(runnerName)} • ★ ${escapeHtml(rating)}</p>
      <div class="pills">${(t.services||[]).map(s=>`<span>${escapeHtml(titleCase(s))}</span>`).join('')}<span>${escapeHtml(t.capacity_kg)} kg</span><span>${escapeHtml(t.spaces_remaining)}/${escapeHtml(t.capacity_spaces)} spaces</span></div>
    </div>
    <div class="price"><small>Potential earnings</small><strong>${money(t.potential_earnings)}</strong>
      <button class="secondary matchTrip" data-id="${escapeHtml(t.id)}" data-from="${escapeHtml(t.from_city)}" data-to="${escapeHtml(t.to_city)}">Match a Request</button>
    </div></div>`;
}

async function homeView() {
  const trips = await fetchOpenTrips();
  return `<div class="hero"><small>BOTSWANA • SOUTH AFRICA • ZIMBABWE • ZAMBIA</small>
    <h2>Someone is already going there. Let RunWise carry it.</h2>
    <p>Find a trip, send a parcel, request shopping, or announce your own journey and earn along the way.</p></div>
    <div class="section"><h3>Leaving soon</h3></div>
    <div class="grid g2">${trips.length ? trips.map(tripCard).join('') : '<div class="empty">No trips posted yet.</div>'}</div>`;
}
async function tripsView() {
  const trips = await fetchOpenTrips();
  return `<div class="section"><h3>Trip board</h3></div>
    <div class="grid g2">${trips.length ? trips.map(tripCard).join('') : '<div class="empty">No trips posted yet.</div>'}</div>`;
}
async function requestsView() {
  const reqs = await fetchMyRequests();
  return `<div class="section"><h3>Your requests</h3></div>
    <div class="grid g2">${reqs.length ? reqs.map(r => `<div class="card request-card">
      <div class="request-card-head"><span class="request-icon">${requestIcon(r.type)}</span><div><small>${escapeHtml(titleCase(r.type))}</small><h3>${escapeHtml(r.from_city)} → ${escapeHtml(r.to_city)}</h3></div></div>
      ${r.details ? `<p>${escapeHtml(r.details)}</p>` : '<p class="muted">No extra instructions added.</p>'}
      <div class="request-card-foot"><strong>${money(r.estimated_value)}</strong><span class="badge ${r.status==='open'?'warning':'success'}">${escapeHtml(titleCase(r.status))}</span></div>
    </div>`).join('') : '<div class="empty card">No requests yet. Use “Post Request” to create your first one.</div>'}</div>`;
}
async function customerMatchesView() {
  const matches = await fetchCustomerMatches();
  const active = matches.filter(match => !['declined', 'cancelled', 'completed'].includes(match.status));
  return `<div class="section"><h3>Runner offers for your requests</h3><p class="muted">Review the route and price before accepting. An Order Room opens only after you accept.</p></div>
    <div class="grid g2">${active.length ? active.map(match => {
      const request = match.requests || {};
      const trip = match.trips || {};
      const canRespond = ['proposed', 'accepted_by_runner'].includes(match.status);
      return `<div class="card match-offer">
        <div class="request-card-head"><span class="request-icon">${requestIcon(request.type)}</span><div><small>${escapeHtml(titleCase(request.type || 'Request'))}</small><h3>${escapeHtml(request.from_city || trip.from_city)} → ${escapeHtml(request.to_city || trip.to_city)}</h3></div></div>
        <div class="offer-facts"><span><b>Travel date</b>${escapeHtml(trip.depart_date || 'Not set')} ${escapeHtml(trip.depart_time || '')}</span><span><b>Item value</b>${money(request.estimated_value)}</span></div>
        ${request.details ? `<p>${escapeHtml(request.details)}</p>` : ''}
        <p>Status: <span class="badge ${match.status === 'confirmed' ? 'success' : 'warning'}">${escapeHtml(titleCase(match.status))}</span></p>
        ${canRespond ? `<div class="offer-actions"><button class="secondary declineMatch" data-id="${escapeHtml(match.id)}">Decline</button><button class="primary acceptMatch" data-id="${escapeHtml(match.id)}">Accept Offer</button></div>` : match.status === 'confirmed' ? '<p class="muted">Accepted—open My Orders to continue.</p>' : '<p class="muted">Waiting for the runner.</p>'}
      </div>`;
    }).join('') : '<div class="empty card">No active match offers yet. Runner proposals will appear here.</div>'}</div>`;
}
async function walletView() {
  const w = await fetchWallet();
  if (!w) return '<div class="empty">No wallet found.</div>';
  const tx = await fetchWalletTx(w.id);
  return `<div class="grid g3">
      <div class="card stat"><span>Available balance</span><strong>${money(w.available_balance)}</strong></div>
      <div class="card stat"><span>Pending</span><strong>${money(w.pending_balance)}</strong></div>
      <div class="card stat"><span>Frozen</span><strong>${money(w.frozen_balance)}</strong></div>
    </div>
    <div class="section"><h3>Recent transactions</h3></div>
    <div class="card">${tx.length ? tx.map(t => `<div class="order"><span>${t.type.replace(/_/g,' ')}</span><span class="price" style="color:${t.amount<0?'var(--danger)':'var(--success)'}">${t.amount<0?'−':'+'}${money(Math.abs(t.amount))}</span></div>`).join('') : '<div class="empty">No transactions yet.</div>'}</div>`;
}

// ---------------------------------------------------------------------------
// VIEWS: RUNNER
// ---------------------------------------------------------------------------
async function runnerHomeView() {
  const trips = await fetchMyTrips();
  return `<div class="hero"><small>RUNNER MODE</small><h2>Turn your next journey into earnings.</h2>
    <p>Announce your route and RunWise finds requests along the way.</p></div>
    <div class="section"><h3>Your recent trips</h3></div>
    <div class="grid g2">${trips.length ? trips.map(tripCard).join('') : '<div class="empty">You haven\'t announced a trip yet.</div>'}</div>`;
}
async function announceView() {
  const [verification, vehicles] = await Promise.all([fetchMyVerification(), fetchApprovedVehicles()]);
  if (!verification || verification.status !== 'approved') {
    return `<div class="gate-card"><span>🪪</span><h2>Verification required</h2><p>An administrator must approve your identity before you can announce a trip.</p><button class="primary goVerification">Open Verification</button></div>`;
  }
  if (!vehicles.length) {
    return `<div class="gate-card"><span>🚙</span><h2>Approved vehicle required</h2><p>Add a vehicle and wait for administrator approval before announcing a trip.</p><button class="primary goVehicle">Open My Vehicles</button></div>`;
  }
  return `<div class="card"><h3>Announce your journey</h3>
    <form id="tripForm" class="grid2">
      <label class="full">Approved vehicle<select name="vehicle_id" required>${vehicles.map(vehicle => `<option value="${escapeHtml(vehicle.id)}">${escapeHtml(vehicle.make_model)} — ${escapeHtml(vehicle.plate_number || 'No plate')}</option>`).join('')}</select></label>
      <label>From country<input name="from_country" required></label>
      <label>From city<input name="from_city" required></label>
      <label>To country<input name="to_country" required></label>
      <label>To city<input name="to_city" required></label>
      <label>Date<input type="date" name="depart_date" required></label>
      <label>Time<input type="time" name="depart_time" required></label>
      <label>Capacity (kg)<input type="number" name="capacity_kg" value="40" required></label>
      <label>Capacity (spaces)<input type="number" name="capacity_spaces" value="6" required></label>
      <label class="full">Intermediate stops (comma separated)<input name="stops" placeholder="Pretoria, Polokwane, Tlokweng Border"></label>
      <label>Landmark near start (optional)<input name="from_landmark"></label>
      <label>Landmark near end (optional)<input name="to_landmark"></label>
      <label class="full">Written directions (optional — for stops without a mappable address)<textarea name="written_directions" rows="2"></textarea></label>
      <label class="full">Services offered<select name="services" multiple size="4">${REQUEST_TYPES.map(t=>`<option value="${t}">${t.replace('_',' ')}</option>`).join('')}</select></label>

      <div class="full declaration-box">
        <div class="legal-check"><label><input type="checkbox" name="d1" required> I am legally permitted to drive and use the listed vehicle.</label></div>
        <div class="legal-check"><label><input type="checkbox" name="d2" required> I will comply with applicable road, transport, insurance, border, and customs laws.</label></div>
        <div class="legal-check"><label><input type="checkbox" name="d3" required> I will not accept goods that appear unlawful, dangerous, or materially different from their description.</label></div>
        <div class="legal-check"><label><input type="checkbox" name="d4" required> I understand that posting a trip does not guarantee a match or payment.</label></div>
        <div id="tripCrossBorderNote" class="hidden">
          <div class="legal-check"><label><input type="checkbox" name="cb1"> This is an international trip — I have read the ${legalLinkHtml('cross_border', 'Cross-Border Delivery Policy')}.</label></div>
        </div>
      </div>
      <button class="primary full">Publish Trip</button>
    </form></div>`;
}
async function myTripsView() {
  const trips = await fetchMyTrips();
  return `<div class="section"><h3>Your announced trips</h3></div>
    <div class="grid g2">${trips.length ? trips.map(tripCard).join('') : '<div class="empty">Nothing announced yet.</div>'}</div>`;
}
async function verificationView() {
  const v = await fetchMyVerification();
  const statusBadge = v ? `<span class="badge ${v.status==='approved'?'success':v.status==='rejected'?'danger':'warning'}">${escapeHtml(titleCase(v.status))}</span>` : '<span class="badge neutral">Not submitted</span>';
  return `<div class="card"><h3>Verification status ${statusBadge}</h3>
    ${v && v.status === 'rejected' ? `<div class="review-feedback"><b>Why it was rejected</b><p>${escapeHtml(v.rejection_reason || 'The documents could not be approved. Please submit clearer or corrected information.')}</p></div>` : ''}
    ${!v || v.status === 'rejected' ? `
    <form id="kycForm" class="grid2">
      <label>ID or passport photo<input type="file" name="id_document" accept="image/*" required></label>
      <label>Selfie photo<input type="file" name="selfie" accept="image/*" required></label>
      <label>Next of kin name<input name="kin_name" required></label>
      <label>Next of kin phone<input name="kin_phone" required></label>
      <button class="primary full">Submit for Review</button>
    </form>` : '<p>Your documents are on file. An admin will review them shortly.</p>'}
  </div>`;
}

async function vehicleView() {
  const vehicles = await fetchMyVehicles();
  return `<div class="section"><h3>Your vehicles</h3></div>
    <div class="grid g2">${vehicles.length ? vehicles.map(v => {
      const status = v.review_status || (v.approved ? 'approved' : 'pending');
      return `<div class="card"><h3>${escapeHtml(v.make_model)}</h3><p>Plate: ${escapeHtml(v.plate_number || '—')}</p>
        <span class="badge ${status==='approved'?'success':status==='rejected'?'danger':'warning'}">${escapeHtml(titleCase(status))}</span>
        ${status === 'rejected' ? `<div class="review-feedback"><b>Why it was rejected</b><p>${escapeHtml(v.rejection_reason || 'Please correct the vehicle details or photos and submit a new vehicle.')}</p></div>` : ''}
      </div>`;
    }).join('') : '<div class="empty">No vehicles added yet.</div>'}</div>
    <div class="card"><h3>Add a vehicle</h3>
    <form id="vehicleForm" class="grid2">
      <label>Make & model<input name="make_model" required placeholder="Toyota Hilux"></label>
      <label>Plate number<input name="plate_number" required></label>
      <label class="full">Photos (you can select multiple)<input type="file" name="photos" accept="image/*" multiple required></label>
      <button class="primary full">Add Vehicle</button>
    </form></div>`;
}

async function matchesView(role) {
  if (role === 'runner') {
    const [trips, openReqs] = await Promise.all([fetchMyTrips(), fetchOpenRequests()]);
    const compatible = openReqs.filter(r => trips.some(t => t.from_city === r.from_city && t.to_city === r.to_city));
    return `<div class="grid g3">${compatible.length ? compatible.map(r => {
      const t = trips.find(t => t.from_city === r.from_city && t.to_city === r.to_city);
      return `<div class="card"><small>SMART MATCH</small><h3>${r.type}</h3><p>${r.from_city} → ${r.to_city}</p><strong>${money(r.estimated_value)}</strong>
        <button class="primary proposeMatch" data-trip="${t.id}" data-request="${r.id}">Propose Match</button></div>`;
    }).join('') : '<div class="empty">No compatible requests along your announced routes yet.</div>'}</div>`;
  }
}
async function earningsView() {
  const w = await fetchWallet();
  if (!w) return '<div class="empty">No wallet found.</div>';
  return `<div class="grid g4 stats">
    <div class="card stat"><span>Available</span><strong>${money(w.available_balance)}</strong></div>
    <div class="card stat"><span>Pending</span><strong>${money(w.pending_balance)}</strong></div>
    <div class="card stat"><span>Frozen</span><strong>${money(w.frozen_balance)}</strong></div>
    <div class="card stat"><span>RunScore</span><strong>${state.profile.run_score} (${state.profile.run_score_level})</strong></div>
  </div>
  <div class="section"><h3>Withdraw</h3></div>
  <div class="card"><form id="withdrawForm" class="grid2">
    <label>Amount<input type="number" name="amount" min="1" required></label>
    <label>Method<select name="method"><option value="orange_money">Orange Money</option><option value="myzaka">MyZaka</option><option value="bank_transfer">Bank transfer</option></select></label>
    <button class="primary full">Request Withdrawal</button>
  </form></div>`;
}

// ---------------------------------------------------------------------------
// VIEWS: ADMIN
// ---------------------------------------------------------------------------
async function adminHomeView() {
  const [pendingRunners, pendingVehicles, counts] = await Promise.all([
    fetchPendingVerifications(), fetchPendingVehicles(), fetchAdminCounts(),
  ]);
  return `<div class="hero"><small>ADMIN MODE</small><h2>RunWise operations centre</h2>
    <p>Review safety checks, support active orders, resolve disputes, and keep a permanent record of every admin decision.</p></div>
    <div class="grid g3">
      <div class="card stat"><span>Pending runner checks</span><strong>${pendingRunners.length}</strong></div>
      <div class="card stat"><span>Pending vehicle checks</span><strong>${pendingVehicles.length}</strong></div>
      <div class="card stat"><span>Open disputes</span><strong>${counts.disputes}</strong></div>
      <div class="card stat"><span>Registered users</span><strong>${counts.users}</strong></div>
      <div class="card stat"><span>Order rooms</span><strong>${counts.orders}</strong></div>
    </div>
    <div class="card admin-notice"><h3>Admin safety checklist</h3>
      <p>Open documents and vehicle photos before approving. For disputes, review the order timeline, messages, uploads and escrow record before selecting an outcome. Add a clear internal reason to every rejection or account restriction.</p>
    </div>`;
}

async function adminRunnersView() {
  const pending = await fetchPendingVerifications();
  if (!pending.length) return '<div class="empty card">No runner verifications waiting for review.</div>';
  const cardsHtml = await Promise.all(pending.map(async v => {
    const [idUrl, selfieUrl] = await Promise.all([signedUrl(v.id_document_url), signedUrl(v.selfie_url)]);
    return `<div class="card admin-review-card">
      <div class="review-card-head"><div><small>Submitted ${new Date(v.created_at).toLocaleString()}</small><h3>${escapeHtml(v.profiles?.full_name || 'Runner')}</h3></div><span class="badge warning">pending</span></div>
      <p><b>Next of kin:</b> ${escapeHtml(v.next_of_kin_name || '—')} · ${escapeHtml(v.next_of_kin_phone || '—')}</p>
      <div class="evidence-grid">
        ${idUrl ? `<a class="evidence-link" href="${idUrl}" target="_blank" rel="noopener">Open ID document</a>` : '<span class="evidence-missing">ID document missing</span>'}
        ${selfieUrl ? `<a class="evidence-link" href="${selfieUrl}" target="_blank" rel="noopener">Open selfie</a>` : '<span class="evidence-missing">Selfie missing</span>'}
      </div>
      <label>Internal review note / rejection reason
        <textarea class="reviewReason" data-kind="runner" data-id="${escapeHtml(v.id)}" rows="2" placeholder="Required when rejecting"></textarea>
      </label>
      <div class="review-actions">
        <button class="secondary reviewRunner" data-id="${escapeHtml(v.id)}" data-decision="rejected">Reject</button>
        <button class="primary reviewRunner" data-id="${escapeHtml(v.id)}" data-decision="approved">Approve runner</button>
      </div>
    </div>`;
  }));
  return `<div class="section"><h3>Identity checks</h3><p class="muted">Private documents use short-lived signed links and are visible only during this review.</p></div><div class="grid g2">${cardsHtml.join('')}</div>`;
}

async function adminVehiclesView() {
  const pending = await fetchPendingVehicles();
  if (!pending.length) return '<div class="empty card">No vehicles waiting for approval.</div>';
  const cards = await Promise.all(pending.map(async v => {
    const photoUrls = await Promise.all((v.photo_urls || []).map(signedUrl));
    return `<div class="card admin-review-card">
      <div class="review-card-head"><div><small>Submitted ${new Date(v.created_at).toLocaleString()}</small><h3>${escapeHtml(v.make_model)}</h3></div><span class="badge warning">pending</span></div>
      <p><b>Owner:</b> ${escapeHtml(v.profiles?.full_name || 'Runner')} · <b>Plate:</b> ${escapeHtml(v.plate_number || '—')}</p>
      <div class="vehicle-photo-grid">${photoUrls.filter(Boolean).map((url, index) => `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="Vehicle photo ${index + 1}"></a>`).join('') || '<span class="evidence-missing">No vehicle photos uploaded</span>'}</div>
      <label>Internal review note / rejection reason
        <textarea class="reviewReason" data-kind="vehicle" data-id="${escapeHtml(v.id)}" rows="2" placeholder="Required when rejecting"></textarea>
      </label>
      <div class="review-actions">
        <button class="secondary reviewVehicle" data-id="${escapeHtml(v.id)}" data-decision="rejected">Reject</button>
        <button class="primary reviewVehicle" data-id="${escapeHtml(v.id)}" data-decision="approved">Approve vehicle</button>
      </div>
    </div>`;
  }));
  return `<div class="section"><h3>Vehicle checks</h3><p class="muted">Open every photo and compare the make, model and plate before deciding.</p></div><div class="grid g2">${cards.join('')}</div>`;
}

async function adminDisputesView() {
  const disputes = await fetchAdminDisputes();
  if (!disputes.length) return '<div class="empty card">No disputes have been raised.</div>';
  return `<div class="section"><h3>Dispute case queue</h3><p class="muted">Open a case file to review the participants, route, messages, journey timeline, proof uploads and escrow before resolving.</p></div>
    <div class="admin-filter"><input class="adminFilter" data-target="disputeList" placeholder="Search reason, order ID or status"></div>
    <div id="disputeList" class="grid g2">${disputes.map(d => {
      const esc = d.order_rooms?.escrow_transactions;
      const isOpen = d.status === 'open';
      return `<div class="card admin-searchable" data-search="${escapeHtml([d.reason, d.order_room_id, d.status, esc?.status].join(' ').toLowerCase())}">
        <div class="review-card-head"><div><small>Case ${escapeHtml(d.id.slice(0, 8))}</small><h3>${escapeHtml(d.reason)}</h3></div><span class="badge ${isOpen ? 'danger' : 'success'}">${escapeHtml(d.status)}</span></div>
        <p>Order <code>${escapeHtml(d.order_room_id.slice(0, 8))}</code> · Escrow <b>${escapeHtml(esc?.status || '—')}</b> · Total <b>${money(esc?.total)}</b></p>
        <p><small>Raised ${new Date(d.created_at).toLocaleString()}</small></p>
        <button class="secondary openAdminCase" data-id="${escapeHtml(d.id)}" data-room="${escapeHtml(d.order_room_id)}">Open case file</button>
        <div id="adminCase-${escapeHtml(d.id)}" class="admin-case-host"></div>
        ${isOpen ? `<div class="dispute-resolution">
          <label>Resolution<select class="disputeOutcome" data-id="${escapeHtml(d.id)}">${DISPUTE_OUTCOMES.map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
          <input type="number" class="partialAmount hidden" data-id="${escapeHtml(d.id)}" min="0" step="0.01" placeholder="Runner amount for partial refund">
          <label>Decision note<textarea class="disputeNote" data-id="${escapeHtml(d.id)}" rows="3" placeholder="Explain the evidence reviewed and why this outcome is fair"></textarea></label>
          <button class="primary resolveDispute" data-id="${escapeHtml(d.id)}">Resolve dispute</button>
        </div>` : `<p><b>Resolution:</b> ${escapeHtml(d.resolution || 'Resolved')}</p>`}
      </div>`;
    }).join('')}</div>`;
}

async function adminOperationsView() {
  const [users, orders, transactions] = await Promise.all([
    fetchAdminUsers(), fetchAdminOrders(), fetchAdminTransactions(),
  ]);
  return `<div class="hero"><small>ADMIN OPERATIONS</small><h2>Find the record you need</h2><p>Search users, orders and financial ledger entries. Account restrictions require a reason and are written to the audit log.</p></div>
    <div class="section"><h3>Users</h3></div>
    <div class="admin-filter"><input class="adminFilter" data-target="adminUsers" placeholder="Search name, phone, role or user ID"></div>
    <div id="adminUsers" class="admin-table-wrap"><table class="admin-table"><thead><tr><th>User</th><th>Role</th><th>RunScore</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>
      ${users.map(u => `<tr class="admin-searchable" data-search="${escapeHtml([u.full_name,u.phone,u.role,u.id,u.run_score_level].join(' ').toLowerCase())}">
        <td><b>${escapeHtml(u.full_name)}</b><small>${escapeHtml(u.phone || 'No phone')}<br>${escapeHtml(u.id.slice(0, 8))}</small></td>
        <td>${escapeHtml(titleCase(u.role))}</td><td>${escapeHtml(u.run_score)} · ${escapeHtml(titleCase(u.run_score_level))}</td>
        <td>${u.suspended ? '<span class="badge danger">suspended</span>' : u.restricted ? '<span class="badge warning">restricted</span>' : '<span class="badge success">active</span>'}</td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
        <td><div class="table-actions">
          <button class="secondary adminAccountAction" data-id="${escapeHtml(u.id)}" data-restricted="${!!u.restricted}" data-suspended="${!!u.suspended}" data-action="restrict">${u.restricted ? 'Remove restriction' : 'Restrict'}</button>
          <button class="secondary adminAccountAction" data-id="${escapeHtml(u.id)}" data-restricted="${!!u.restricted}" data-suspended="${!!u.suspended}" data-action="suspend">${u.suspended ? 'Restore account' : 'Suspend'}</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table></div>
    <div class="section"><h3>Orders</h3></div>
    <div class="admin-filter"><input class="adminFilter" data-target="adminOrders" placeholder="Search order ID, customer, runner or status"></div>
    <div id="adminOrders" class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Runner</th><th>Escrow</th><th>Total</th><th>Created</th></tr></thead><tbody>
      ${orders.map(o => { const esc = o.escrow_transactions; return `<tr class="admin-searchable" data-search="${escapeHtml([o.id,o.customer?.full_name,o.runner?.full_name,esc?.status].join(' ').toLowerCase())}">
        <td><code>${escapeHtml(o.id.slice(0, 8))}</code></td><td>${escapeHtml(o.customer?.full_name || o.customer_id.slice(0, 8))}</td><td>${escapeHtml(o.runner?.full_name || o.runner_id.slice(0, 8))}</td>
        <td><span class="badge ${esc?.status === 'disputed' ? 'danger' : 'neutral'}">${escapeHtml(esc?.status || '—')}</span></td><td>${money(esc?.total)}</td><td>${new Date(o.created_at).toLocaleString()}</td>
      </tr>`; }).join('')}
    </tbody></table></div>
    <div class="section"><h3>Wallet transactions</h3></div>
    <div class="admin-filter"><input class="adminFilter" data-target="adminTransactions" placeholder="Search user, transaction type, reference or ID"></div>
    <div id="adminTransactions" class="admin-table-wrap"><table class="admin-table"><thead><tr><th>When</th><th>User / wallet</th><th>Type</th><th>Reference</th><th>Amount</th></tr></thead><tbody>
      ${transactions.map(t => `<tr class="admin-searchable" data-search="${escapeHtml([t.id,t.wallet?.profile?.full_name,t.wallet_id,t.type,t.reference].join(' ').toLowerCase())}">
        <td>${new Date(t.created_at).toLocaleString()}</td><td>${escapeHtml(t.wallet?.profile?.full_name || t.wallet?.owner_type || t.wallet_id.slice(0,8))}</td><td>${escapeHtml(titleCase(t.type))}</td>
        <td><code>${escapeHtml(t.reference || '—')}</code></td><td class="${t.amount < 0 ? 'amount-negative' : 'amount-positive'}">${t.amount < 0 ? '−' : '+'}${money(Math.abs(t.amount))}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
}

async function adminAuditView() {
  const entries = await fetchAdminAudit();
  return `<div class="section"><h3>Permanent admin audit log</h3><p class="muted">Every approval, rejection, dispute outcome and account restriction should appear here. Entries are read-only from this screen.</p></div>
    <div class="admin-filter"><input class="adminFilter" data-target="adminAudit" placeholder="Search action, admin, target or notes"></div>
    <div id="adminAudit" class="admin-table-wrap"><table class="admin-table"><thead><tr><th>When</th><th>Administrator</th><th>Action</th><th>Target</th><th>Notes</th></tr></thead><tbody>
      ${entries.map(e => `<tr class="admin-searchable" data-search="${escapeHtml([e.admin?.full_name,e.action,e.target_table,e.target_id,e.notes].join(' ').toLowerCase())}">
        <td>${new Date(e.created_at).toLocaleString()}</td><td>${escapeHtml(e.admin?.full_name || e.admin_id.slice(0, 8))}</td><td><b>${escapeHtml(titleCase(e.action))}</b></td>
        <td>${escapeHtml(e.target_table || '—')}<br><code>${escapeHtml(e.target_id ? e.target_id.slice(0, 8) : '—')}</code></td><td>${escapeHtml(e.notes || '—')}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
}

async function openAdminCase(disputeId, roomId, button) {
  const host = document.getElementById(`adminCase-${disputeId}`);
  if (!host) return;
  if (host.dataset.loaded === 'true') {
    host.classList.toggle('hidden');
    button.textContent = host.classList.contains('hidden') ? 'Open case file' : 'Hide case file';
    return;
  }
  setBusy(button, true, 'Loading case…');
  const [roomResult, messagesResult, milestonesResult, proofResult] = await Promise.all([
    sb.from('order_rooms').select('*, escrow_transactions(*)').eq('id', roomId).single(),
    sb.from('order_messages').select('*').eq('order_room_id', roomId).order('created_at', { ascending: true }),
    sb.from('journey_milestones').select('*').eq('order_room_id', roomId).order('created_at', { ascending: true }),
    sb.from('proof_uploads').select('*').eq('order_room_id', roomId).order('created_at', { ascending: true }),
  ]);
  const error = roomResult.error || messagesResult.error || milestonesResult.error || proofResult.error;
  if (error) {
    host.innerHTML = `<div class="load-error"><b>Case file did not load.</b><span>${escapeHtml(friendlyError(error))}</span></div>`;
    setBusy(button, false);
    return;
  }
  const room = roomResult.data;
  const ids = [...new Set([room.customer_id, room.runner_id, ...(messagesResult.data || []).map(m => m.sender_id)].filter(Boolean))];
  const [profilesResult, matchResult] = await Promise.all([
    sb.from('profiles').select('id, full_name, phone, run_score, run_score_level, restricted, suspended').in('id', ids),
    sb.from('matches').select('*, trips:trip_id(from_city, to_city, depart_date, depart_time), requests:request_id(type, from_city, to_city, estimated_value, details)').eq('id', room.match_id).maybeSingle(),
  ]);
  if (profilesResult.error || matchResult.error) {
    host.innerHTML = `<div class="load-error"><b>Case details did not load.</b><span>${escapeHtml(friendlyError(profilesResult.error || matchResult.error))}</span></div>`;
    setBusy(button, false);
    return;
  }
  const people = Object.fromEntries((profilesResult.data || []).map(p => [p.id, p]));
  const proof = await Promise.all((proofResult.data || []).map(async p => ({ ...p, signed_url: await signedUrl(p.file_url) })));
  const match = matchResult.data || {};
  const request = match.requests || {};
  const trip = match.trips || {};
  const customer = people[room.customer_id] || {};
  const runner = people[room.runner_id] || {};
  const esc = room.escrow_transactions || {};
  host.innerHTML = `<div class="admin-case-file">
    <div class="case-summary">
      <div><small>Route</small><b>${escapeHtml(request.from_city || trip.from_city || '—')} → ${escapeHtml(request.to_city || trip.to_city || '—')}</b><span>${escapeHtml(trip.depart_date || 'Date not set')} ${escapeHtml(trip.depart_time || '')}</span></div>
      <div><small>Request</small><b>${escapeHtml(titleCase(request.type || '—'))}</b><span>${money(request.estimated_value)} · ${escapeHtml(request.details || 'No details')}</span></div>
      <div><small>Escrow</small><b>${escapeHtml(esc.status || '—')}</b><span>Total ${money(esc.total)} · Runner fee ${money(esc.runner_fee)}</span></div>
    </div>
    <div class="grid g2">
      <div class="case-person"><small>Customer</small><b>${escapeHtml(customer.full_name || room.customer_id)}</b><span>${escapeHtml(customer.phone || 'No phone')} · RunScore ${escapeHtml(customer.run_score ?? '—')}</span><span>${customer.suspended ? 'Suspended' : customer.restricted ? 'Restricted' : 'Active'}</span></div>
      <div class="case-person"><small>Runner</small><b>${escapeHtml(runner.full_name || room.runner_id)}</b><span>${escapeHtml(runner.phone || 'No phone')} · RunScore ${escapeHtml(runner.run_score ?? '—')}</span><span>${runner.suspended ? 'Suspended' : runner.restricted ? 'Restricted' : 'Active'}</span></div>
    </div>
    <details open><summary>Journey timeline (${(milestonesResult.data || []).length})</summary>
      <div class="case-feed">${(milestonesResult.data || []).map(m => `<p><small>${new Date(m.created_at).toLocaleString()}</small><b>${escapeHtml(MILESTONE_LABELS[m.milestone] || titleCase(m.milestone))}</b><span>${escapeHtml(m.note || '')}</span></p>`).join('') || '<p class="muted">No milestones recorded.</p>'}</div>
    </details>
    <details><summary>Order messages (${(messagesResult.data || []).length})</summary>
      <div class="case-feed">${(messagesResult.data || []).map(m => `<p><small>${new Date(m.created_at).toLocaleString()} · ${escapeHtml(people[m.sender_id]?.full_name || m.sender_id.slice(0,8))}</small><span>${escapeHtml(m.message)}</span></p>`).join('') || '<p class="muted">No messages recorded.</p>'}</div>
    </details>
    <details><summary>Proof uploads (${proof.length})</summary>
      <div class="proof-grid">${proof.map(p => `<div><b>${escapeHtml(titleCase(p.stage))}</b><span>${escapeHtml(p.note || '')}${p.amount != null ? ' · ' + money(p.amount) : ''}</span>${p.signed_url ? `<a href="${p.signed_url}" target="_blank" rel="noopener">Open private upload</a>` : '<span>File unavailable</span>'}</div>`).join('') || '<p class="muted">No proof uploads recorded.</p>'}</div>
    </details>
  </div>`;
  host.dataset.loaded = 'true';
  host.classList.remove('hidden');
  button.textContent = 'Hide case file';
  setBusy(button, false);
}

async function adminSettingsView() {
  const s = await fetchSettings();
  if (!s) return '<div class="empty">Could not load settings.</div>';
  return `<div class="card"><h3>Fees (decimal — e.g. 0.12 = 12% of item/parcel value)</h3>
    <form id="settingsForm" class="grid2">
      <label>Runner fee<input type="number" step="0.01" name="runner_fee_pct" value="${s.runner_fee_pct}"></label>
      <label>Platform fee<input type="number" step="0.01" name="platform_fee_pct" value="${s.platform_fee_pct}"></label>
      <label>Protection fee<input type="number" step="0.01" name="protection_fee_pct" value="${s.protection_fee_pct}"></label>
      <label>Max shopping value (BWP)<input type="number" name="max_shopping_value" value="${s.max_shopping_value}"></label>
      <label>RunScore — Silver from<input type="number" name="runscore_silver_min" value="${s.runscore_silver_min}"></label>
      <label>RunScore — Gold from<input type="number" name="runscore_gold_min" value="${s.runscore_gold_min}"></label>
      <label>RunScore — Platinum from<input type="number" name="runscore_platinum_min" value="${s.runscore_platinum_min}"></label>
      <label>Proximity phone-reveal distance (meters)<input type="number" name="proximity_reveal_meters" value="${s.proximity_reveal_meters}"></label>
      <button class="primary full">Save Settings</button>
    </form>
    <p><small>Fee percentages apply to newly matched orders only — orders already in an Order Room keep the fee amounts calculated when they were matched.</small></p>
  </div>`;
}

async function adminLegalView() {
  const [docs, flags, counts] = await Promise.all([fetchLegalDocuments(), fetchComplianceFlags(), fetchAcceptanceCounts()]);
  const rows = LEGAL_DOCS.map(([type, label]) => {
    const versions = docs.filter(d => d.document_type === type);
    const published = versions.find(d => d.status === 'published');
    return `<div class="card">
      <h3>${label} <span class="badge ${published ? 'success' : 'danger'}">${published ? 'v' + published.version + ' published' : 'no published version'}</span></h3>
      <p><small>${counts[type] || 0} acceptance record(s) on file. ${versions.length} version(s) total.</small></p>
      ${published ? `<p><a href="#legal/${type}" target="_blank">View live document →</a></p>` : ''}
      <button class="secondary publishNewVersion" data-type="${type}" data-label="${label}">Publish New Version</button>
    </div>`;
  }).join('');

  return `<div class="section"><h3>Legal documents</h3></div>
    <div class="grid g2">${rows}</div>
    <div id="publishVersionForm"></div>

    <div class="section"><h3>Compliance flags</h3></div>
    <div class="card">
      ${flags.length ? flags.map(f => `<div class="order"><span><b>${f.flag_type}</b> — ${f.scope_type}${f.scope_value ? ': ' + f.scope_value : ''} ${f.notes ? '— ' + f.notes : ''}</span>
        <span class="badge ${f.active ? 'success' : 'neutral'}">${f.active ? 'active' : 'inactive'}</span>
        <button class="secondary toggleFlag" data-id="${f.id}" data-active="${f.active}">${f.active ? 'Deactivate' : 'Activate'}</button>
      </div>`).join('') : '<div class="empty">No compliance flags yet.</div>'}
    </div>
    <div class="card"><h3>Add a compliance flag</h3>
      <form id="flagForm" class="grid2">
        <label>Flag type<select name="flag_type">
          <option value="customs_declaration_required">customs_declaration_required</option>
          <option value="regulated_item_review_required">regulated_item_review_required</option>
          <option value="transport_permit_confirmation_required">transport_permit_confirmation_required</option>
          <option value="enhanced_kyc_required">enhanced_kyc_required</option>
          <option value="high_value_item_review_required">high_value_item_review_required</option>
          <option value="prohibited_item">prohibited_item</option>
          <option value="temporarily_restricted_by_law">temporarily_restricted_by_law</option>
          <option value="unsafe_route_warning">unsafe_route_warning</option>
        </select></label>
        <label>Scope<select name="scope_type"><option value="global">global</option><option value="country">country</option><option value="route">route</option><option value="item_type">item_type</option></select></label>
        <label class="full">Scope value (e.g. country code, item type — leave blank for global)<input name="scope_value"></label>
        <label class="full">Notes<input name="notes"></label>
        <button class="primary full">Add Flag</button>
      </form>
    </div>

    <div class="section"><h3>Export</h3></div>
    <div class="card"><button class="secondary" id="exportAcceptances">Export all acceptance records (CSV)</button></div>`;
}

function publishVersionFormHtml(type, label) {
  return `<div class="card"><h3>Publish new version — ${label}</h3>
    <form id="versionForm" class="grid2">
      <label>Version (e.g. 1.1)<input name="version" required></label>
      <label>Effective date (or leave as placeholder)<input name="effective_date" value="[EFFECTIVE DATE]"></label>
      <label class="full">Title<input name="title" value="${label}" required></label>
      <label class="full">Body (HTML)<textarea name="body_html" rows="10" placeholder="&lt;h2 id=&quot;section&quot;&gt;Heading&lt;/h2&gt;&lt;p&gt;...&lt;/p&gt;"></textarea></label>
      <div class="full legal-check"><label><input type="checkbox" name="is_material"> This is a material change — require active re-acceptance from users who already accepted the previous version</label></div>
      <button class="primary">Publish (archives previous version automatically)</button>
      <button type="button" class="secondary" id="cancelPublish">Cancel</button>
    </form></div>`;
}


// ---------------------------------------------------------------------------
async function ordersView() {
  const rooms = await fetchMyOrderRooms();
  if (!rooms.length) return '<div class="empty">No active orders yet. Accept a match to open an Order Room.</div>';
  return `<div class="grid g2">${rooms.map(r => {
    const esc = r.escrow_transactions;
    return `<div class="card"><h3>Order ${r.id.slice(0,8)}</h3>
      <p>Status: <span class="badge ${esc?.status==='released'?'success':'warning'}">${esc?.status||'—'}</span></p>
      <p>Total: ${money(esc?.total)}</p>
      <button class="primary openRoom" data-id="${r.id}">Open Order Room</button>
    </div>`;
  }).join('')}</div><div id="roomDetail"></div>`;
}

async function openOrderRoom(roomId) {
  state.openOrderRoom = roomId;
  const detailHost = $('#roomDetail');
  if (detailHost) detailHost.innerHTML = '<div class="loading-cards"><i></i><i></i></div>';
  const [roomResult, milestoneResult, messageResult] = await Promise.all([
    readWithRetry(() => sb.from('order_rooms').select('*, escrow_transactions(*)').eq('id', roomId).single()),
    readWithRetry(() => sb.from('journey_milestones').select('*').eq('order_room_id', roomId).order('created_at', { ascending: true })),
    readWithRetry(() => sb.from('order_messages').select('*').eq('order_room_id', roomId).order('created_at', { ascending: true })),
  ]);
  const loadError = roomResult.error || milestoneResult.error || messageResult.error;
  if (loadError) {
    if (detailHost) detailHost.innerHTML = `<div class="load-error"><b>Order details did not load.</b><span>${escapeHtml(friendlyError(loadError))}</span><button class="primary" id="retryRoom">Try again</button></div>`;
    if ($('#retryRoom')) $('#retryRoom').onclick = () => openOrderRoom(roomId);
    return;
  }
  const room = roomResult.data;
  const milestones = milestoneResult.data || [];
  const messages = messageResult.data || [];
  const [dispute, myRating] = await Promise.all([fetchDisputeForRoom(roomId), fetchMyRatingForRoom(roomId)]);
  const isCustomer = room.customer_id === state.profile.id;
  const esc = room.escrow_transactions;
  const isDisputed = esc?.status === 'disputed';
  const isActiveOrder = esc?.status && !['awaiting_funding', 'released', 'refunded', 'partially_refunded'].includes(esc.status);
  const isSettled = ['released', 'refunded', 'partially_refunded'].includes(esc?.status);
  const ratingAreas = isCustomer ? RATING_AREAS.runner : RATING_AREAS.customer;

  const detail = `<div class="order-room">
    <div>
      <div class="card">
        <h3>Journey timeline</h3>
        <div class="milestone-list">${milestones.length ? milestones.map(m => `<div class="step"><i>●</i><div><b>${MILESTONE_LABELS[m.milestone]||m.milestone}</b><small>${new Date(m.created_at).toLocaleString()}${m.note?' — '+m.note:''}</small></div></div>`).join('') : '<div class="empty">No milestones yet.</div>'}</div>
        ${!isCustomer && !isDisputed ? `<div class="section"><h3>Post a milestone</h3></div>
          <select id="milestoneSelect">${Object.entries(MILESTONE_LABELS).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}</select>
          <button class="secondary" id="postMilestone">Post</button>` : ''}
      </div>
      <div class="card">
        <h3>Order Room chat</h3>
        <div class="chat-box">${messages.length ? messages.map(m => `<div class="chat-msg"><b>${m.sender_id===state.profile.id?'You':'Them'}:</b> ${m.message}</div>`).join('') : '<div class="empty">No messages yet.</div>'}</div>
        <div class="chat-input"><input id="chatInput" placeholder="Type a message"><button class="primary" id="sendChat">Send</button></div>
      </div>
      ${isActiveOrder ? `<div class="card">
          <h3>Nearby contact</h3>
          <p><small>Share your location so we can reveal a phone number only once you and the other party are close by — for a safe handover.</small></p>
          <button class="secondary" id="shareLocation">Share My Location</button>
          <button class="secondary" id="checkNearby">Check Distance</button>
          <div id="nearbyResult"></div>
        </div>` : ''}
      ${dispute ? `<div class="card">
          <h3>Dispute <span class="badge ${dispute.status==='resolved'?'success':'danger'}">${dispute.status}</span></h3>
          <p><b>Reason:</b> ${dispute.reason}</p>
          ${dispute.status === 'resolved' ? `<p><b>Resolution:</b> ${dispute.resolution||'—'}</p>` : '<p>Escrow is frozen while an admin reviews this.</p>'}
        </div>`
        : isActiveOrder ? `<div class="card">
          <h3>Something wrong with this order?</h3>
          <form id="disputeForm">
            <label>Reason<select name="reason">${DISPUTE_REASONS.map(r => `<option value="${r}">${r}</option>`).join('')}</select></label>
            <label>Details<textarea name="details" rows="3" placeholder="What happened?"></textarea></label>
            <button class="secondary">Raise a Dispute</button>
          </form>
        </div>` : ''}
      ${isSettled ? `<div class="card">
          <h3>Rate ${isCustomer ? 'your runner' : 'your customer'}</h3>
          ${myRating ? `<p>You rated this order <b>${myRating.stars}/5</b>. Thank you!</p>` : `
          <form id="ratingForm">
            <label>Stars<select name="stars"><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Okay</option><option value="2">2 — Poor</option><option value="1">1 — Very poor</option></select></label>
            <label>What stood out?</label>
            <div class="pills">${ratingAreas.map(a => `<label style="display:inline-block;margin-right:10px;font-weight:400"><input type="checkbox" name="areas" value="${a}"> ${a}</label>`).join('')}</div>
            <label>Comment<textarea name="comment" rows="2"></textarea></label>
            <button class="primary">Submit Rating</button>
          </form>`}
        </div>` : ''}
    </div>
    <div>
      <div class="card">
        <h3>Escrow status</h3>
        <p>Status: <span class="badge ${isDisputed?'danger':'warning'}">${esc?.status}</span></p>
        <p>Item value: ${money(esc?.item_value)}<br>Runner fee: ${money(esc?.runner_fee)}<br>Platform fee: ${money(esc?.platform_fee)}<br>Protection fee: ${money(esc?.protection_fee)}</p>
        <p><b>Total: ${money(esc?.total)}</b></p>
        ${!isDisputed && isCustomer && esc?.status === 'awaiting_funding' ? `
          <div class="declaration-box">
            <div class="legal-check"><label><input type="checkbox" id="acceptPaymentsPolicy"> I have read the ${legalLinkHtml('payments_escrow', 'Payments and Escrow Policy')}.</label></div>
            <div class="legal-check"><label><input type="checkbox" id="acceptRefundsPolicy"> I have read the ${legalLinkHtml('refunds_cancellations', 'Refund and Cancellation Policy')}.</label></div>
          </div>
          <button class="primary" id="fundEscrow">Fund Escrow (demo payment)</button>` : ''}
        ${!isDisputed && isCustomer && ['funded','locked','purchase_authorised','shopping','collected','journey_active','delivery_pending'].includes(esc?.status) ? `<div class="section"><h3>Create delivery PIN</h3><p class="muted">Keep this PIN private. Enter it only after receiving the delivery.</p><form id="setPinForm"><label>4–6 digit PIN<input name="pin" inputmode="numeric" pattern="[0-9]{4,6}" minlength="4" maxlength="6" required></label><button class="secondary">Save PIN</button></form></div>` : ''}
        ${!isDisputed && isCustomer && isActiveOrder ? `
          <div class="section"><h3>Confirm delivery</h3></div>
          <form id="confirmDeliveryForm">
            <label>Delivery PIN<input name="pin" inputmode="numeric" pattern="[0-9]{4,6}" required></label>
            <label>Actual amount spent (optional, for shopping requests)<input type="number" name="spent" min="0" step="0.01"></label>
            <button class="primary">Confirm & Release Escrow</button>
          </form>` : ''}
      </div>
    </div>
  </div>`;
  if (!detailHost) return;
  detailHost.innerHTML = detail;
  bindOrderRoom(roomId, isCustomer);
}

function bindOrderRoom(roomId, isCustomer) {
  const pm = $('#postMilestone');
  if (pm) pm.onclick = async () => {
    const m = $('#milestoneSelect').value;
    const { error } = await sb.rpc('add_milestone', { p_order_room_id: roomId, p_milestone: m });
    if (error) toast(error.message); else { toast('Milestone posted'); openOrderRoom(roomId); }
  };
  const sc = $('#sendChat');
  if (sc) sc.onclick = async () => {
    const msg = $('#chatInput').value.trim();
    if (!msg) return;
    const { error } = await sb.from('order_messages').insert({ order_room_id: roomId, sender_id: state.profile.id, message: msg });
    if (error) toast(error.message); else openOrderRoom(roomId);
  };
  const fe = $('#fundEscrow');
  if (fe) fe.onclick = async () => {
    if (!$('#acceptPaymentsPolicy').checked || !$('#acceptRefundsPolicy').checked) {
      toast('Please accept the Payments and Refund policies before funding escrow.'); return;
    }
    await recordAcceptance('payments_escrow', 'escrow_funding', roomId);
    await recordAcceptance('refunds_cancellations', 'escrow_funding', roomId);
    const { error } = await sb.rpc('fund_escrow', { p_order_room_id: roomId, p_method: 'demo_card' });
    if (error) toast(error.message); else { toast('Escrow funded'); openOrderRoom(roomId); }
  };
  const pinForm = $('#setPinForm');
  if (pinForm) pinForm.onsubmit = async e => {
    e.preventDefault();
    const button = e.submitter;
    const pin = new FormData(e.currentTarget).get('pin');
    setBusy(button, true, 'Saving…');
    const { error } = await sb.rpc('set_delivery_pin', { p_order_room_id: roomId, p_pin: pin });
    if (error) { toast(friendlyError(error)); setBusy(button, false); }
    else { toast('Delivery PIN saved. Keep it private until delivery.'); openOrderRoom(roomId); }
  };
  const cd = $('#confirmDeliveryForm');
  if (cd) cd.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const { error } = await sb.rpc('confirm_delivery', { p_order_room_id: roomId, p_pin: f.get('pin'), p_actual_spent: f.get('spent') ? +f.get('spent') : null });
    if (error) toast(error.message); else { toast('Delivery confirmed. Escrow released.'); openOrderRoom(roomId); }
  };
  const df = $('#disputeForm');
  if (df) df.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const { error } = await sb.rpc('raise_dispute', { p_order_room_id: roomId, p_reason: f.get('reason'), p_evidence: { details: f.get('details') } });
    if (error) toast(error.message); else { toast('Dispute raised. Escrow is now frozen pending review.'); openOrderRoom(roomId); }
  };
  const rf = $('#ratingForm');
  if (rf) rf.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const areas = {};
    Array.from(e.target.querySelectorAll('input[name=areas]:checked')).forEach(c => areas[c.value] = true);
    const room = await sb.from('order_rooms').select('customer_id, runner_id').eq('id', roomId).single();
    const ratee_id = room.data.customer_id === state.profile.id ? room.data.runner_id : room.data.customer_id;
    const { error } = await sb.from('ratings').insert({
      order_room_id: roomId, rater_id: state.profile.id, ratee_id,
      stars: +f.get('stars'), areas, comment: f.get('comment'),
    });
    if (error) toast(error.message); else { toast('Thanks for rating this order.'); openOrderRoom(roomId); }
  };
  const sl = $('#shareLocation');
  if (sl) sl.onclick = async () => {
    try { await shareMyLocation(roomId); toast('Location shared.'); }
    catch (err) { toast(err.message); }
  };
  const cn = $('#checkNearby');
  if (cn) cn.onclick = async () => {
    const result = await checkNearbyContact(roomId);
    const box = $('#nearbyResult');
    if (!box) return;
    if (!result) { box.innerHTML = '<p class="empty">Could not check distance.</p>'; return; }
    if (!result.distance_meters && result.distance_meters !== 0) {
      box.innerHTML = '<p><small>Waiting for both parties to share their location.</small></p>';
    } else if (result.revealed) {
      box.innerHTML = `<p><b>You're close (${Math.round(result.distance_meters)}m away).</b><br>Contact number: <b>${result.phone || 'not on file'}</b></p>`;
    } else {
      box.innerHTML = `<p><small>Still ${Math.round(result.distance_meters)}m apart — get closer to reveal the contact number.</small></p>`;
    }
  };
}

// ---------------------------------------------------------------------------
// MODALS / FORMS
// ---------------------------------------------------------------------------
function openRequestModal(prefill = {}) {
  if (state.profile.restricted) return toast('Your account is restricted — you can\'t post new requests right now.');
  const modal = $('#requestModal');
  const form = $('#requestForm');
  form.reset();
  form.elements.type.value = prefill.type || 'parcel';
  form.elements.from_city.value = prefill.from_city || '';
  form.elements.to_city.value = prefill.to_city || '';
  form.elements.estimated_value.value = prefill.estimated_value ?? '';
  $('#requestDetailsCount').textContent = '0';
  $('#requestError').textContent = '';
  $('#crossBorderChecks').classList.add('hidden');
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  setTimeout(() => (prefill.from_city ? form.elements.estimated_value : form.elements.from_city).focus(), 0);
}

function closeRequestModal() {
  $('#requestModal').classList.add('hidden');
  document.body.classList.remove('modal-open');
}

async function submitRequest(payload) {
  const request = {
    id: newId(),
    ...payload,
    customer_id: state.profile.id,
  };
  const { error } = await idempotentWrite('requests', request);
  if (error) throw error;
  clearCache('my-requests:', 'open-requests');
  return request;
}

document.querySelectorAll('[data-close-request]').forEach(button => button.onclick = closeRequestModal);
$('#requestForm').elements.details.addEventListener('input', e => { $('#requestDetailsCount').textContent = e.target.value.length; });
$('#requestForm').onsubmit = async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const button = $('#submitRequestBtn');
  const values = new FormData(form);
  const payload = {
    type: values.get('type'),
    from_city: String(values.get('from_city') || '').trim(),
    to_city: String(values.get('to_city') || '').trim(),
    estimated_value: Number(values.get('estimated_value') || 0),
    from_landmark: String(values.get('from_landmark') || '').trim() || null,
    to_landmark: String(values.get('to_landmark') || '').trim() || null,
    details: String(values.get('details') || '').trim() || null,
    written_directions: String(values.get('written_directions') || '').trim() || null,
  };
  const isCrossBorder = !!values.get('cross_border');
  if (!REQUEST_TYPES.includes(payload.type)) return ($('#requestError').textContent = 'Choose a request type.');
  if (!payload.from_city || !payload.to_city) return ($('#requestError').textContent = 'Enter both the pickup and delivery city.');
  if (payload.from_city.toLowerCase() === payload.to_city.toLowerCase()) return ($('#requestError').textContent = 'Pickup and delivery cities must be different.');
  if (isCrossBorder && (!values.get('cb1') || !values.get('cb2'))) return ($('#requestError').textContent = 'Accept both cross-border declarations to continue.');
  $('#requestError').textContent = '';
  setBusy(button, true, 'Posting…');
  try {
    const request = await submitRequest(payload);
    await sb.from('legal_acceptances').insert({
      user_id: state.profile.id, document_type: 'request_declarations', document_version: '1.0',
      acceptance_context: 'request_creation', related_record_id: request.id, user_role: state.profile.active_role,
    });
    if (isCrossBorder) await sb.from('legal_acceptances').insert({
      user_id: state.profile.id, document_type: 'cross_border_declarations', document_version: '1.0',
      acceptance_context: 'cross_border_request', related_record_id: request.id, user_role: state.profile.active_role,
    });
    closeRequestModal();
    toast('Request posted. Runners on matching routes will see it.');
    state.page = 'requests';
    render();
  } catch (error) {
    $('#requestError').textContent = friendlyError(error, 'The request could not be posted.');
  } finally {
    setBusy(button, false);
  }
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#requestModal').classList.contains('hidden')) closeRequestModal(); });
$('#requestForm').elements.cross_border.addEventListener('change', e => {
  $('#crossBorderChecks').classList.toggle('hidden', !e.target.checked);
  $('#requestForm').querySelectorAll('[name=cb1],[name=cb2]').forEach(cb => { cb.required = e.target.checked; });
});

function bindPage() {
  document.querySelectorAll('.matchTrip').forEach(b => b.onclick = () => openRequestModal({ from_city: b.dataset.from, to_city: b.dataset.to }));
  document.querySelectorAll('.openRoom').forEach(b => b.onclick = () => openOrderRoom(b.dataset.id));
  document.querySelectorAll('.goVerification').forEach(b => b.onclick = () => { state.page = 'verification'; render(); });
  document.querySelectorAll('.goVehicle').forEach(b => b.onclick = () => { state.page = 'vehicle'; render(); });

  document.querySelectorAll('.acceptMatch').forEach(b => b.onclick = async () => {
    setBusy(b, true, 'Accepting…');
    const { data, error } = await sb.rpc('accept_match', { p_match_id: b.dataset.id });
    if (error) { toast(friendlyError(error)); setBusy(b, false); return; }
    clearCache('customer-matches:', 'my-requests:', 'rooms:', 'open-requests', 'open-trips');
    const result = Array.isArray(data) ? data[0] : data;
    toast(result?.match_status === 'confirmed' ? 'Offer accepted. Your Order Room is ready.' : 'Offer accepted. Waiting for the runner.');
    state.page = result?.match_status === 'confirmed' ? 'orders' : 'customerMatches';
    render();
  });
  document.querySelectorAll('.declineMatch').forEach(b => b.onclick = async () => {
    setBusy(b, true, 'Declining…');
    const { error } = await sb.rpc('decline_match', { p_match_id: b.dataset.id });
    if (error) { toast(friendlyError(error)); setBusy(b, false); return; }
    clearCache('customer-matches:');
    toast('Offer declined.');
    renderPage();
  });

  document.querySelectorAll('.proposeMatch').forEach(b => b.onclick = async () => {
    setBusy(b, true, 'Matching…');
    const trip_id = b.dataset.trip, request_id = b.dataset.request;
    const { error } = await sb.rpc('propose_match', { p_trip_id: trip_id, p_request_id: request_id });
    if (error) { toast(friendlyError(error)); setBusy(b, false); return; }
    clearCache('open-requests', 'my-requests:', 'rooms:', 'customer-matches:');
    toast('Offer sent. The customer can now accept or decline it.');
    render();
  });

  const tf = $('#tripForm');
  if (tf) {
    const checkCrossBorder = () => {
      const isIntl = tf.from_country.value.trim().toLowerCase() && tf.to_country.value.trim().toLowerCase()
        && tf.from_country.value.trim().toLowerCase() !== tf.to_country.value.trim().toLowerCase();
      $('#tripCrossBorderNote').classList.toggle('hidden', !isIntl);
      tf.querySelector('[name=cb1]').required = isIntl;
    };
    tf.from_country.onblur = checkCrossBorder;
    tf.to_country.onblur = checkCrossBorder;
    tf.onsubmit = async e => {
      e.preventDefault();
      if (state.profile.restricted) return toast('Your account is restricted — you can\'t announce new trips right now.');
      const button = e.submitter;
      setBusy(button, true, 'Publishing…');
      const f = new FormData(e.target);
      const isIntl = f.get('from_country').trim().toLowerCase() !== f.get('to_country').trim().toLowerCase();
      if (isIntl && !f.get('cb1')) { toast('Please confirm you\'ve read the Cross-Border Delivery Policy.'); setBusy(button, false); return; }
      const services = Array.from(e.target.services.selectedOptions).map(o => o.value);
      const stops = (f.get('stops') || '').split(',').map(s => s.trim()).filter(Boolean);
      const payload = {
        id: newId(),
        runner_id: state.profile.id,
        vehicle_id: f.get('vehicle_id'),
        from_country: f.get('from_country'), from_city: f.get('from_city'),
        to_country: f.get('to_country'), to_city: f.get('to_city'),
        from_landmark: f.get('from_landmark') || null, to_landmark: f.get('to_landmark') || null,
        written_directions: f.get('written_directions') || null,
        depart_date: f.get('depart_date'), depart_time: f.get('depart_time'),
        capacity_kg: +f.get('capacity_kg'), capacity_spaces: +f.get('capacity_spaces'),
        spaces_remaining: +f.get('capacity_spaces'), stops, services,
        potential_earnings: Math.round(+f.get('capacity_spaces') * 350),
        status: 'upcoming',
      };
      const { error } = await idempotentWrite('trips', payload);
      if (error) { toast(friendlyError(error)); setBusy(button, false); return; }
      await sb.from('legal_acceptances').insert({
        user_id: state.profile.id, document_type: 'trip_declarations', document_version: '1.0',
        acceptance_context: 'trip_creation', related_record_id: payload.id, user_role: state.profile.active_role,
      });
      if (isIntl) {
        await sb.from('legal_acceptances').insert({
          user_id: state.profile.id, document_type: 'cross_border_declarations', document_version: '1.0',
          acceptance_context: 'cross_border_trip', related_record_id: payload.id, user_role: state.profile.active_role,
        });
      }
      clearCache('my-trips:', 'open-trips');
      toast('Trip published.');
      state.page = 'mytrips'; render();
    };
  }

  const wf = $('#withdrawForm');
  if (wf) wf.onsubmit = async e => {
    e.preventDefault();
    const button = e.submitter;
    setBusy(button, true, 'Submitting…');
    const f = new FormData(e.target);
    const { error } = await sb.rpc('request_withdrawal', { p_amount: +f.get('amount'), p_method: f.get('method') });
    if (error) { toast(friendlyError(error)); setBusy(button, false); return; }
    clearCache('wallet:', 'wallet-tx:');
    toast('Withdrawal requested (demo — no real transfer occurs).');
    renderPage();
  };

  const kf = $('#kycForm');
  if (kf) kf.onsubmit = async e => {
    e.preventDefault();
    const button = e.submitter;
    setBusy(button, true, 'Uploading…');
    const f = new FormData(e.target);
    try {
      const idPath = await uploadToStorage(f.get('id_document'), 'kyc');
      const selfiePath = await uploadToStorage(f.get('selfie'), 'kyc');
      const { error } = await idempotentWrite('runner_verifications', {
        id: newId(), user_id: state.profile.id, id_document_url: idPath, selfie_url: selfiePath,
        next_of_kin_name: f.get('kin_name'), next_of_kin_phone: f.get('kin_phone'), status: 'pending',
      });
      if (error) throw error;
      clearCache('verification:', 'pending-verifications');
      toast('Submitted for review.');
      renderPage();
    } catch (err) { toast(friendlyError(err)); setBusy(button, false); }
  };

  const vf = $('#vehicleForm');
  if (vf) vf.onsubmit = async e => {
    e.preventDefault();
    const button = e.submitter;
    setBusy(button, true, 'Uploading…');
    const f = new FormData(e.target);
    try {
      const files = Array.from(e.target.photos.files);
      const paths = [];
      for (const file of files) paths.push(await uploadToStorage(file, 'vehicles'));
      const { error } = await idempotentWrite('vehicles', {
        id: newId(), user_id: state.profile.id, make_model: f.get('make_model'), plate_number: f.get('plate_number'),
        photo_urls: paths, approved: false, review_status: 'pending',
      });
      if (error) throw error;
      clearCache('vehicles:', 'pending-vehicles');
      toast('Vehicle submitted for approval.');
      renderPage();
    } catch (err) { toast(friendlyError(err)); setBusy(button, false); }
  };

  document.querySelectorAll('.reviewRunner').forEach(b => b.onclick = async () => {
    const reason = document.querySelector(`.reviewReason[data-kind="runner"][data-id="${b.dataset.id}"]`)?.value?.trim() || null;
    if (b.dataset.decision === 'rejected' && !reason) return toast('Add a clear rejection reason first.');
    setBusy(b, true, b.dataset.decision === 'approved' ? 'Approving…' : 'Rejecting…');
    const { error } = await sb.rpc('admin_review_runner', {
      p_verification_id: b.dataset.id, p_decision: b.dataset.decision, p_reason: reason,
    });
    if (error) { setBusy(b, false); return toast(friendlyError(error)); }
    clearCache('pending-verifications', 'verification:');
    toast(b.dataset.decision === 'approved' ? 'Runner approved.' : 'Runner rejected with a reason.');
    renderPage();
  });
  document.querySelectorAll('.reviewVehicle').forEach(b => b.onclick = async () => {
    const reason = document.querySelector(`.reviewReason[data-kind="vehicle"][data-id="${b.dataset.id}"]`)?.value?.trim() || null;
    if (b.dataset.decision === 'rejected' && !reason) return toast('Add a clear rejection reason first.');
    setBusy(b, true, b.dataset.decision === 'approved' ? 'Approving…' : 'Rejecting…');
    const { error } = await sb.rpc('admin_review_vehicle', {
      p_vehicle_id: b.dataset.id, p_decision: b.dataset.decision, p_reason: reason,
    });
    if (error) { setBusy(b, false); return toast(friendlyError(error)); }
    clearCache('pending-vehicles', 'vehicles:');
    toast(b.dataset.decision === 'approved' ? 'Vehicle approved.' : 'Vehicle rejected with a reason.');
    renderPage();
  });
  document.querySelectorAll('.openAdminCase').forEach(b => b.onclick = () => openAdminCase(b.dataset.id, b.dataset.room, b));
  document.querySelectorAll('.adminFilter').forEach(input => input.oninput = () => {
    const target = document.getElementById(input.dataset.target);
    if (!target) return;
    const query = input.value.trim().toLowerCase();
    target.querySelectorAll('.admin-searchable').forEach(row => {
      row.classList.toggle('hidden', query && !String(row.dataset.search || '').includes(query));
    });
  });
  document.querySelectorAll('.adminAccountAction').forEach(b => b.onclick = async () => {
    const currentlyRestricted = b.dataset.restricted === 'true';
    const currentlySuspended = b.dataset.suspended === 'true';
    const nextRestricted = b.dataset.action === 'restrict' ? !currentlyRestricted : currentlyRestricted;
    const nextSuspended = b.dataset.action === 'suspend' ? !currentlySuspended : currentlySuspended;
    const reason = window.prompt('Enter the internal reason for this account change. This will be saved in the audit log:');
    if (!reason || !reason.trim()) return;
    setBusy(b, true, 'Saving…');
    const { error } = await sb.rpc('admin_set_account_status', {
      p_user_id: b.dataset.id, p_restricted: nextRestricted, p_suspended: nextSuspended, p_note: reason.trim(),
    });
    if (error) { setBusy(b, false); return toast(friendlyError(error)); }
    toast('Account status updated and logged.');
    renderPage();
  });

  document.querySelectorAll('.disputeOutcome').forEach(sel => sel.onchange = () => {
    const amountInput = document.querySelector(`.partialAmount[data-id="${sel.dataset.id}"]`);
    if (amountInput) amountInput.classList.toggle('hidden', sel.value !== 'partial_refund');
  });
  document.querySelectorAll('.resolveDispute').forEach(b => b.onclick = async () => {
    const id = b.dataset.id;
    const outcome = document.querySelector(`.disputeOutcome[data-id="${id}"]`).value;
    const note = document.querySelector(`.disputeNote[data-id="${id}"]`).value;
    const amountEl = document.querySelector(`.partialAmount[data-id="${id}"]`);
    const runnerAmount = amountEl && amountEl.value ? +amountEl.value : null;
    if (!note.trim()) return toast('Please add a resolution note before resolving.');
    const { error } = await sb.rpc('resolve_dispute', {
      p_dispute_id: id, p_outcome: outcome, p_note: note, p_runner_amount: runnerAmount,
    });
    if (error) return toast(error.message);
    toast('Dispute resolved.'); renderPage();
  });

  const sf = $('#settingsForm');
  if (sf) sf.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const payload = {};
    for (const [k, v] of f.entries()) payload[k] = +v;
    payload.updated_by = state.profile.id;
    const { error } = await sb.from('platform_settings').update(payload).eq('id', 1);
    if (error) return toast(error.message);
    await sb.rpc('admin_log_event', { p_action: 'update_platform_settings', p_target_table: 'platform_settings', p_notes: 'Updated fees, thresholds or proximity settings' });
    toast('Settings saved.'); renderPage();
  };

  document.querySelectorAll('.publishNewVersion').forEach(b => b.onclick = () => {
    $('#publishVersionForm').innerHTML = publishVersionFormHtml(b.dataset.type, b.dataset.label);
    $('#versionForm').dataset.type = b.dataset.type;
    $('#cancelPublish').onclick = () => { $('#publishVersionForm').innerHTML = ''; };
    $('#versionForm').onsubmit = async ev => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      const { error } = await sb.from('legal_documents').insert({
        document_type: b.dataset.type, version: f.get('version'), title: f.get('title'),
        body_html: f.get('body_html'), effective_date: f.get('effective_date'),
        is_material: !!f.get('is_material'), status: 'published', published_at: new Date().toISOString(),
        created_by: state.profile.id,
      });
      if (error) return toast(error.message);
      await sb.rpc('admin_log_event', { p_action: 'publish_legal_document', p_target_table: 'legal_documents', p_notes: b.dataset.type + ' v' + f.get('version') });
      toast('New version published. The previous version has been archived.');
      renderPage();
    };
  });

  const flagForm = $('#flagForm');
  if (flagForm) flagForm.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const { error } = await sb.from('legal_compliance_flags').insert({
      flag_type: f.get('flag_type'), scope_type: f.get('scope_type'),
      scope_value: f.get('scope_value') || null, notes: f.get('notes') || null,
      created_by: state.profile.id,
    });
    if (error) return toast(error.message);
    await sb.rpc('admin_log_event', { p_action: 'add_compliance_flag', p_target_table: 'legal_compliance_flags', p_notes: f.get('flag_type') });
    toast('Compliance flag added.'); renderPage();
  };
  document.querySelectorAll('.toggleFlag').forEach(b => b.onclick = async () => {
    const nowActive = b.dataset.active === 'true';
    const { error } = await sb.from('legal_compliance_flags').update({ active: !nowActive }).eq('id', b.dataset.id);
    if (error) return toast(error.message);
    renderPage();
  });

  const exportBtn = $('#exportAcceptances');
  if (exportBtn) exportBtn.onclick = async () => {
    const { data, error } = await sb.from('legal_acceptances').select('*').order('created_at', { ascending: false }).limit(5000);
    if (error) return toast(error.message);
    if (!data.length) return toast('No acceptance records to export.');
    const headers = Object.keys(data[0]);
    const csv = [headers.join(',')].concat(
      data.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'runwise-legal-acceptances.csv'; a.click();
    URL.revokeObjectURL(url);
  };
}

// ---------------------------------------------------------------------------
// Initial route check — runs once when the script first loads, so opening
// index.html directly on a #legal/... link (e.g. from a new tab) shows the
// legal viewer immediately instead of waiting for a hash change event.
// ---------------------------------------------------------------------------
checkLegalRoute();

