// ============================================================================
// RunWise — app.js
// Talks to Supabase for real auth + persisted data. No localStorage mock data.
// ============================================================================
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = s => document.querySelector(s);
const money = n => 'P' + Number(n || 0).toLocaleString('en-BW');

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------
const state = { session: null, profile: null, page: 'home', openOrderRoom: null, legalMode: false };

const menus = {
  customer: [['home', '⌂ Home'], ['trips', '🚗 Trip Marketplace'], ['requests', '📦 My Requests'],
             ['orders', '📍 My Orders'], ['wallet', '◈ Wallet']],
  runner:   [['runner', '⌂ Runner Home'], ['verification', '🪪 Verification'], ['vehicle', '🚙 My Vehicles'],
             ['announce', '✈ Announce Trip'], ['mytrips', '🚗 My Trips'],
             ['matches', '⚡ Smart Matches'], ['orders', '📍 My Orders'], ['earnings', '◈ Earnings']],
  admin:    [['admin', '⌂ Admin Home'], ['adminRunners', '🪪 Runner Approvals'], ['adminVehicles', '🚙 Vehicle Approvals'], ['adminDisputes', '⚖ Disputes'], ['adminSettings', '⚙ Platform Settings'], ['adminLegal', '📜 Legal Documents']],
};
const titles = {
  home: 'Home', trips: 'Trip Marketplace', requests: 'My Requests', orders: 'My Orders', wallet: 'Wallet',
  runner: 'Runner Home', announce: 'Announce Trip', mytrips: 'My Trips', matches: 'Smart Matches', earnings: 'Earnings',
  verification: 'Runner Verification', vehicle: 'My Vehicles',
  admin: 'Admin Home', adminRunners: 'Runner Approvals', adminVehicles: 'Vehicle Approvals', adminDisputes: 'Disputes',
  adminSettings: 'Platform Settings', adminLegal: 'Legal Documents', newRequest: 'Post a Request',
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
  const f = new FormData(e.target);
  const { error } = await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
  if (error) $('#loginError').textContent = error.message;
};

$('#signupForm').onsubmit = async e => {
  e.preventDefault();
  $('#signupError').textContent = '';
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
  if (error) { $('#signupError').textContent = error.message; return; }
  if (data.session) {
    // No email confirmation required — we have a session now, record acceptance right away.
    state.profile = { id: data.user.id, active_role: f.get('role') };
    await recordAcceptance('terms', 'registration');
    await recordAcceptance('privacy', 'registration');
  }
  toast('Account created. Check your email to confirm, then log in.');
  $('#tabLogin').click();
};

$('#signOutBtn').onclick = async () => { await sb.auth.signOut(); };

// ---------------------------------------------------------------------------
// SESSION HANDLING
// ---------------------------------------------------------------------------
sb.auth.onAuthStateChange((_event, session) => {
  state.session = session;
  if (session) boot(); else showAuth();
});

async function showAuth() {
  if (state.legalMode) return; // legal viewer takes priority over the auth screen
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

async function boot() {
  const { data: profile, error } = await sb.from('profiles').select('*').eq('id', state.session.user.id).single();
  if (error) { toast('Could not load profile: ' + error.message); return; }

  if (profile.suspended) {
    $('#authScreen').classList.add('hidden');
    $('#app').classList.add('hidden');
    showSuspendedScreen();
    return;
  }

  state.profile = profile;

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
  const { data: trips, error } = await sb.from('trips').select('*').order('depart_date', { ascending: true }).limit(30);
  if (error) { toast(error.message); return []; }
  const runnerIds = [...new Set(trips.map(t => t.runner_id))];
  if (runnerIds.length) {
    const { data: profiles } = await sb.from('public_profiles').select('*').in('id', runnerIds);
    const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    trips.forEach(t => t.profiles = byId[t.runner_id]);
  }
  return trips;
}
async function fetchMyRequests() {
  const { data, error } = await sb.from('requests').select('*').eq('customer_id', state.profile.id).order('created_at', { ascending: false });
  if (error) { toast(error.message); return []; }
  return data;
}
async function fetchMyTrips() {
  const { data, error } = await sb.from('trips').select('*').eq('runner_id', state.profile.id).order('created_at', { ascending: false });
  if (error) { toast(error.message); return []; }
  return data;
}
async function fetchOpenRequests() {
  const { data, error } = await sb.from('requests').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(30);
  if (error) { toast(error.message); return []; }
  return data;
}
async function fetchMyOrderRooms() {
  const col = state.profile.active_role === 'runner' ? 'runner_id' : 'customer_id';
  const { data, error } = await sb.from('order_rooms').select('*, escrow_transactions(*)').eq(col, state.profile.id).order('created_at', { ascending: false });
  if (error) { toast(error.message); return []; }
  return data;
}
async function fetchWallet() {
  const { data, error } = await sb.from('wallets').select('*').eq('user_id', state.profile.id).single();
  if (error) { toast(error.message); return null; }
  return data;
}
async function fetchWalletTx(walletId) {
  const { data } = await sb.from('wallet_transactions').select('*').eq('wallet_id', walletId).order('created_at', { ascending: false }).limit(20);
  return data || [];
}
async function fetchMyVerification() {
  const { data } = await sb.from('runner_verifications').select('*').eq('user_id', state.profile.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data;
}
async function fetchMyVehicles() {
  const { data, error } = await sb.from('vehicles').select('*').eq('user_id', state.profile.id).order('created_at', { ascending: false });
  if (error) { toast(error.message); return []; }
  return data;
}
async function fetchPendingVerifications() {
  const { data, error } = await sb.from('runner_verifications').select('*, profiles:user_id(full_name)').eq('status', 'pending').order('created_at', { ascending: true });
  if (error) { toast(error.message); return []; }
  return data;
}
async function fetchPendingVehicles() {
  const { data, error } = await sb.from('vehicles').select('*, profiles:user_id(full_name)').eq('approved', false).order('created_at', { ascending: true });
  if (error) { toast(error.message); return []; }
  return data;
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
  await sb.from('profiles').update({ active_role: newRole }).eq('id', state.profile.id);
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
  c.innerHTML = '<p class="loading">Loading…</p>';
  const role = state.profile.active_role;
  let html = '';
  if (role === 'admin') {
    if (state.page === 'adminRunners') html = await adminRunnersView();
    else if (state.page === 'adminVehicles') html = await adminVehiclesView();
    else if (state.page === 'adminDisputes') html = await adminDisputesView();
    else if (state.page === 'adminSettings') html = await adminSettingsView();
    else if (state.page === 'adminLegal') html = await adminLegalView();
    else html = await adminHomeView();
  } else if (role === 'runner') {
    if (state.page === 'verification') html = await verificationView();
    else if (state.page === 'vehicle') html = await vehicleView();
    else if (state.page === 'announce') html = announceView();
    else if (state.page === 'mytrips') html = await myTripsView();
    else if (state.page === 'matches') html = await matchesView('runner');
    else if (state.page === 'orders') html = await ordersView();
    else if (state.page === 'earnings') html = await earningsView();
    else html = await runnerHomeView();
  } else {
    if (state.page === 'trips') html = await tripsView();
    else if (state.page === 'requests') html = await requestsView();
    else if (state.page === 'newRequest') html = requestFormView();
    else if (state.page === 'orders') html = await ordersView();
    else if (state.page === 'wallet') html = await walletView();
    else html = await homeView();
  }
  c.innerHTML = (state.profile.restricted ? `<div class="card" style="border-color:var(--danger);background:var(--danger-bg)">
      <b>Your account is restricted.</b> You can still manage existing orders, chat, and receive payouts,
      but you can't post new requests or announce new trips. Contact RunWise support if you think this is a mistake.
    </div>` : '') + html;
  bindPage();
}

// ---------------------------------------------------------------------------
// VIEWS: CUSTOMER
// ---------------------------------------------------------------------------
function tripCard(t) {
  const runnerName = t.profiles?.full_name || 'Runner';
  const rating = t.profiles?.rating_count ? (t.profiles.rating_sum / t.profiles.rating_count).toFixed(1) : '—';
  return `<div class="card trip-card">
    <div><span class="badge success">${t.status.replace('_',' ')}</span>
      <h3>${t.from_city} → ${t.to_city}</h3>
      <p>${t.depart_date} • ${t.depart_time} • ${runnerName} • ★ ${rating}</p>
      <div class="pills">${(t.services||[]).map(s=>`<span>${s}</span>`).join('')}<span>${t.capacity_kg} kg</span><span>${t.spaces_remaining}/${t.capacity_spaces} spaces</span></div>
    </div>
    <div class="price"><small>Potential earnings</small><strong>${money(t.potential_earnings)}</strong>
      <button class="secondary matchTrip" data-id="${t.id}">Match a Request</button>
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
    <div class="card">${reqs.length ? reqs.map(r => `<div class="order"><b>${r.type}</b> ${r.from_city} → ${r.to_city} — ${money(r.estimated_value)} <span class="badge ${r.status==='open'?'warning':'success'}">${r.status}</span></div>`).join('') : '<div class="empty">No requests yet.</div>'}</div>`;
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
function announceView() {
  return `<div class="card"><h3>Announce your journey</h3>
    <form id="tripForm" class="grid2">
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
  const statusBadge = v ? `<span class="badge ${v.status==='approved'?'success':v.status==='rejected'?'danger':'warning'}">${v.status}</span>` : '<span class="badge neutral">Not submitted</span>';
  return `<div class="card"><h3>Verification status ${statusBadge}</h3>
    ${v && v.status === 'rejected' ? '<p>Your last submission was rejected. You can submit again below.</p>' : ''}
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
    <div class="grid g2">${vehicles.length ? vehicles.map(v => `<div class="card"><h3>${v.make_model}</h3><p>Plate: ${v.plate_number||'—'}</p><span class="badge ${v.approved?'success':'warning'}">${v.approved?'Approved':'Pending approval'}</span></div>`).join('') : '<div class="empty">No vehicles added yet.</div>'}</div>
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
    const trips = await fetchMyTrips();
    const openReqs = await fetchOpenRequests();
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
  const pendingRunners = await fetchPendingVerifications();
  const pendingVehicles = await fetchPendingVehicles();
  return `<div class="hero"><small>ADMIN MODE</small><h2>Platform overview</h2>
    <p>Approvals waiting on you right now.</p></div>
    <div class="grid g2">
      <div class="card stat"><span>Pending runner verifications</span><strong>${pendingRunners.length}</strong></div>
      <div class="card stat"><span>Pending vehicle approvals</span><strong>${pendingVehicles.length}</strong></div>
    </div>`;
}

async function adminRunnersView() {
  const pending = await fetchPendingVerifications();
  if (!pending.length) return '<div class="empty">No runner verifications waiting for review.</div>';
  const cardsHtml = await Promise.all(pending.map(async v => {
    const idUrl = await signedUrl(v.id_document_url);
    const selfieUrl = await signedUrl(v.selfie_url);
    return `<div class="card">
      <h3>${v.profiles?.full_name || 'Runner'}</h3>
      <p>Next of kin: ${v.next_of_kin_name} — ${v.next_of_kin_phone}</p>
      <div class="grid g2">
        ${idUrl ? `<div><small>ID document</small><br><a href="${idUrl}" target="_blank">View</a></div>` : ''}
        ${selfieUrl ? `<div><small>Selfie</small><br><a href="${selfieUrl}" target="_blank">View</a></div>` : ''}
      </div>
      <button class="primary approveRunner" data-id="${v.id}" data-user="${v.user_id}">Approve</button>
      <button class="secondary rejectRunner" data-id="${v.id}">Reject</button>
    </div>`;
  }));
  return `<div class="grid g2">${cardsHtml.join('')}</div>`;
}

async function adminVehiclesView() {
  const pending = await fetchPendingVehicles();
  if (!pending.length) return '<div class="empty">No vehicles waiting for approval.</div>';
  return `<div class="grid g2">${pending.map(v => `<div class="card">
    <h3>${v.make_model}</h3>
    <p>Owner: ${v.profiles?.full_name || 'Runner'} • Plate: ${v.plate_number||'—'}</p>
    <p>${(v.photo_urls||[]).length} photo(s) uploaded</p>
    <button class="primary approveVehicle" data-id="${v.id}">Approve</button>
  </div>`).join('')}</div>`;
}

async function adminDisputesView() {
  const disputes = await fetchOpenDisputes();
  if (!disputes.length) return '<div class="empty">No open disputes.</div>';
  return `<div class="grid g2">${disputes.map(d => {
    const esc = d.order_rooms?.escrow_transactions;
    return `<div class="card">
      <h3>${d.reason}</h3>
      <p>Order ${d.order_room_id.slice(0,8)} • Escrow: <span class="badge danger">${esc?.status}</span> • Total: ${money(esc?.total)}</p>
      <p><small>Raised ${new Date(d.created_at).toLocaleString()}</small></p>
      <label>Resolution
        <select class="disputeOutcome" data-id="${d.id}">${DISPUTE_OUTCOMES.map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}</select>
      </label>
      <input type="number" class="partialAmount hidden" data-id="${d.id}" placeholder="Runner amount for partial refund">
      <textarea class="disputeNote" data-id="${d.id}" placeholder="Resolution note"></textarea>
      <button class="primary resolveDispute" data-id="${d.id}">Resolve</button>
    </div>`;
  }).join('')}</div>`;
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
  const { data: room } = await sb.from('order_rooms').select('*, escrow_transactions(*)').eq('id', roomId).single();
  const { data: milestones } = await sb.from('journey_milestones').select('*').eq('order_room_id', roomId).order('created_at', { ascending: true });
  const { data: messages } = await sb.from('order_messages').select('*').eq('order_room_id', roomId).order('created_at', { ascending: true });
  const dispute = await fetchDisputeForRoom(roomId);
  const myRating = await fetchMyRatingForRoom(roomId);
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
        ${!isDisputed && esc?.status === 'funded' ? `<button class="secondary" id="setPin">Set Delivery PIN</button>` : ''}
        ${!isDisputed && isCustomer && isActiveOrder ? `
          <div class="section"><h3>Confirm delivery</h3></div>
          <form id="confirmDeliveryForm">
            <label>Delivery PIN<input name="pin" required></label>
            <label>Actual amount spent (optional, for shopping requests)<input type="number" name="spent"></label>
            <button class="primary">Confirm & Release Escrow</button>
          </form>` : ''}
      </div>
    </div>
  </div>`;
  $('#roomDetail').innerHTML = detail;
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
  const sp = $('#setPin');
  if (sp) sp.onclick = async () => {
    const pin = prompt('Set a 4-6 digit delivery PIN for this order:');
    if (!pin) return;
    const { error } = await sb.rpc('set_delivery_pin', { p_order_room_id: roomId, p_pin: pin });
    if (error) toast(error.message); else toast('Delivery PIN set. Share it with the customer securely.');
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
function openRequestModal() {
  if (state.profile.restricted) return toast('Your account is restricted — you can\'t post new requests right now.');
  state.page = 'newRequest';
  render();
}

function requestFormView() {
  return `<div class="card"><h3>Post a request</h3>
    <form id="requestForm" class="grid2">
      <label>Request type<select name="type">${REQUEST_TYPES.map(t => `<option value="${t}">${t.replace('_',' ')}</option>`).join('')}</select></label>
      <label>Estimated value (BWP)<input type="number" name="estimated_value" value="300" required></label>
      <label>From city<input name="from_city" required></label>
      <label>To city<input name="to_city" required></label>
      <label>Landmark near pickup (optional)<input name="from_landmark" placeholder="e.g. next to the clinic"></label>
      <label>Landmark near drop-off (optional)<input name="to_landmark" placeholder="e.g. blue gate, cattle post"></label>
      <label class="full">Details<textarea name="details" rows="2"></textarea></label>
      <label class="full">Written directions (optional — useful if the location won't show on a map)<textarea name="written_directions" rows="2"></textarea></label>
      <div class="full legal-check"><label><input type="checkbox" name="cross_border"> This is a cross-border request (pickup and drop-off are in different countries)</label></div>

      <div class="full declaration-box">
        <div class="legal-check"><label><input type="checkbox" name="d1" required> I have accurately described the item, quantity, and value.</label></div>
        <div class="legal-check"><label><input type="checkbox" name="d2" required> I own the item, or have legal authority to send it.</label></div>
        <div class="legal-check"><label><input type="checkbox" name="d3" required> The item is not prohibited or unlawfully restricted (see the ${legalLinkHtml('prohibited_items', 'Prohibited and Restricted Items Policy')}).</label></div>
        <div class="legal-check"><label><input type="checkbox" name="d4" required> The item is packaged safely and appropriately.</label></div>
        <div id="crossBorderChecks" class="hidden">
          <div class="legal-check"><label><input type="checkbox" name="cb1"> I understand that customs duties, taxes, inspections, delays, seizure, and documentation requirements may apply. See the ${legalLinkHtml('cross_border', 'Cross-Border Delivery Policy')}.</label></div>
          <div class="legal-check"><label><input type="checkbox" name="cb2"> I accept responsibility for truthful customs information and lawful import and export of the item.</label></div>
        </div>
      </div>
      <button class="primary full">Post Request</button>
    </form></div>`;
}

async function submitRequest(payload) {
  // Superseded by the #requestForm submit handler in bindPage(), which also
  // records the required legal declarations. Kept as a thin fallback in case
  // anything still calls it directly.
  const { error } = await sb.from('requests').insert({ ...payload, customer_id: state.profile.id });
  if (error) return toast(error.message);
  toast('Request posted. Runners on matching routes will see it.');
  state.page = 'requests'; render();
}

function bindPage() {
  document.querySelectorAll('.matchTrip').forEach(b => b.onclick = () => openRequestModal());
  document.querySelectorAll('.openRoom').forEach(b => b.onclick = () => openOrderRoom(b.dataset.id));

  const rqf = $('#requestForm');
  if (rqf) {
    rqf.querySelector('[name=cross_border]').onchange = e => {
      $('#crossBorderChecks').classList.toggle('hidden', !e.target.checked);
      rqf.querySelectorAll('[name=cb1],[name=cb2]').forEach(cb => cb.required = e.target.checked);
    };
    rqf.onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const isCrossBorder = !!f.get('cross_border');
      if (isCrossBorder && (!f.get('cb1') || !f.get('cb2'))) {
        toast('Please accept the cross-border declarations to continue.'); return;
      }
      const payload = {
        type: f.get('type'), estimated_value: +f.get('estimated_value'),
        from_city: f.get('from_city'), to_city: f.get('to_city'),
        from_landmark: f.get('from_landmark') || null, to_landmark: f.get('to_landmark') || null,
        details: f.get('details'), written_directions: f.get('written_directions') || null,
      };
      const { data: inserted, error } = await sb.from('requests').insert({ ...payload, customer_id: state.profile.id }).select().single();
      if (error) return toast(error.message);
      await sb.from('legal_acceptances').insert({
        user_id: state.profile.id, document_type: 'request_declarations', document_version: '1.0',
        acceptance_context: 'request_creation', related_record_id: inserted.id, user_role: state.profile.active_role,
      });
      if (isCrossBorder) {
        await sb.from('legal_acceptances').insert({
          user_id: state.profile.id, document_type: 'cross_border_declarations', document_version: '1.0',
          acceptance_context: 'cross_border_request', related_record_id: inserted.id, user_role: state.profile.active_role,
        });
      }
      toast('Request posted. Runners on matching routes will see it.');
      state.page = 'requests'; render();
    };
  }

  document.querySelectorAll('.proposeMatch').forEach(b => b.onclick = async () => {
    const trip_id = b.dataset.trip, request_id = b.dataset.request;
    const { data: req } = await sb.from('requests').select('customer_id').eq('id', request_id).single();
    const { data: match, error } = await sb.from('matches').insert({
      trip_id, request_id, runner_id: state.profile.id, customer_id: req.customer_id, status: 'proposed',
    }).select().single();
    if (error) return toast(error.message);
    const { error: acceptErr } = await sb.rpc('accept_match', { p_match_id: match.id });
    if (acceptErr) return toast(acceptErr.message);
    toast('Match proposed and accepted on your side. Waiting for the customer to accept.');
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
      const f = new FormData(e.target);
      const isIntl = f.get('from_country').trim().toLowerCase() !== f.get('to_country').trim().toLowerCase();
      if (isIntl && !f.get('cb1')) { toast('Please confirm you\'ve read the Cross-Border Delivery Policy.'); return; }
      const services = Array.from(e.target.services.selectedOptions).map(o => o.value);
      const stops = (f.get('stops') || '').split(',').map(s => s.trim()).filter(Boolean);
      const payload = {
        runner_id: state.profile.id,
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
      const { data: inserted, error } = await sb.from('trips').insert(payload).select().single();
      if (error) return toast(error.message);
      await sb.from('legal_acceptances').insert({
        user_id: state.profile.id, document_type: 'trip_declarations', document_version: '1.0',
        acceptance_context: 'trip_creation', related_record_id: inserted.id, user_role: state.profile.active_role,
      });
      if (isIntl) {
        await sb.from('legal_acceptances').insert({
          user_id: state.profile.id, document_type: 'cross_border_declarations', document_version: '1.0',
          acceptance_context: 'cross_border_request', related_record_id: inserted.id, user_role: state.profile.active_role,
        });
      }
      toast('Trip published.');
      state.page = 'mytrips'; render();
    };
  }

  const wf = $('#withdrawForm');
  if (wf) wf.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const { error } = await sb.rpc('request_withdrawal', { p_amount: +f.get('amount'), p_method: f.get('method') });
    if (error) return toast(error.message);
    toast('Withdrawal requested (demo — no real transfer occurs).');
    renderPage();
  };

  const kf = $('#kycForm');
  if (kf) kf.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const idPath = await uploadToStorage(f.get('id_document'), 'kyc');
      const selfiePath = await uploadToStorage(f.get('selfie'), 'kyc');
      const { error } = await sb.from('runner_verifications').insert({
        user_id: state.profile.id, id_document_url: idPath, selfie_url: selfiePath,
        next_of_kin_name: f.get('kin_name'), next_of_kin_phone: f.get('kin_phone'), status: 'pending',
      });
      if (error) throw error;
      toast('Submitted for review.');
      renderPage();
    } catch (err) { toast(err.message); }
  };

  const vf = $('#vehicleForm');
  if (vf) vf.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const files = Array.from(e.target.photos.files);
      const paths = [];
      for (const file of files) paths.push(await uploadToStorage(file, 'vehicles'));
      const { error } = await sb.from('vehicles').insert({
        user_id: state.profile.id, make_model: f.get('make_model'), plate_number: f.get('plate_number'),
        photo_urls: paths, approved: false,
      });
      if (error) throw error;
      toast('Vehicle submitted for approval.');
      renderPage();
    } catch (err) { toast(err.message); }
  };

  document.querySelectorAll('.approveRunner').forEach(b => b.onclick = async () => {
    const { error } = await sb.from('runner_verifications').update({ status: 'approved', reviewed_by: state.profile.id, reviewed_at: new Date().toISOString() }).eq('id', b.dataset.id);
    if (error) return toast(error.message);
    await sb.from('admin_audit_log').insert({ admin_id: state.profile.id, action: 'approve_runner_verification', target_table: 'runner_verifications', target_id: b.dataset.id });
    toast('Runner approved.'); renderPage();
  });
  document.querySelectorAll('.rejectRunner').forEach(b => b.onclick = async () => {
    const { error } = await sb.from('runner_verifications').update({ status: 'rejected', reviewed_by: state.profile.id, reviewed_at: new Date().toISOString() }).eq('id', b.dataset.id);
    if (error) return toast(error.message);
    await sb.from('admin_audit_log').insert({ admin_id: state.profile.id, action: 'reject_runner_verification', target_table: 'runner_verifications', target_id: b.dataset.id });
    toast('Runner rejected.'); renderPage();
  });
  document.querySelectorAll('.approveVehicle').forEach(b => b.onclick = async () => {
    const { error } = await sb.from('vehicles').update({ approved: true }).eq('id', b.dataset.id);
    if (error) return toast(error.message);
    await sb.from('admin_audit_log').insert({ admin_id: state.profile.id, action: 'approve_vehicle', target_table: 'vehicles', target_id: b.dataset.id });
    toast('Vehicle approved.'); renderPage();
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
