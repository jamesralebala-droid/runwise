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
const state = { session: null, profile: null, page: 'home', openOrderRoom: null, renderId: 0, bootId: 0 };

const menus = {
  customer: [['home', '⌂ Home'], ['trips', '🚗 Trip Marketplace'], ['requests', '📦 My Requests'],
             ['customerMatches', '🤝 Match Offers'], ['orders', '📍 My Orders'], ['wallet', '◈ Wallet']],
  runner:   [['runner', '⌂ Runner Home'], ['verification', '🪪 Verification'], ['vehicle', '🚙 My Vehicles'],
             ['announce', '✈ Announce Trip'], ['mytrips', '🚗 My Trips'],
             ['matches', '⚡ Smart Matches'], ['orders', '📍 My Orders'], ['earnings', '◈ Earnings']],
  admin:    [['admin', '⌂ Admin Home'], ['adminRunners', '🪪 Runner Approvals'], ['adminVehicles', '🚙 Vehicle Approvals']],
};
const titles = {
  home: 'Home', trips: 'Trip Marketplace', requests: 'My Requests', customerMatches: 'Match Offers', orders: 'My Orders', wallet: 'Wallet',
  runner: 'Runner Home', announce: 'Announce Trip', mytrips: 'My Trips', matches: 'Smart Matches', earnings: 'Earnings',
  verification: 'Runner Verification', vehicle: 'My Vehicles',
  admin: 'Admin Home', adminRunners: 'Runner Approvals', adminVehicles: 'Vehicle Approvals',
};
const REQUEST_TYPES = ['shopping', 'parcel', 'documents', 'medicine', 'gift', 'business_stock', 'large_cargo'];
const MILESTONE_LABELS = {
  heading_to_pickup: 'Heading to Pickup', collected: 'Collected', shopping_started: 'Shopping Started',
  shopping_complete: 'Shopping Complete', journey_started: 'Journey Started', border_reached: 'Border Reached',
  customs_processing: 'Customs Processing', border_cleared: 'Border Cleared', destination_reached: 'Destination Reached',
  out_for_delivery: 'Out for Delivery', delivered: 'Delivered', delayed: 'Delayed', personal_stop: 'Personal Stop',
  vehicle_breakdown: 'Vehicle Breakdown', emergency: 'Emergency',
};

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
  const { error } = await sb.auth.signUp({
    email: f.get('email'),
    password: f.get('password'),
    options: { data: { full_name: f.get('full_name'), role: f.get('role') } },
  });
  if (error) { $('#signupError').textContent = friendlyError(error, 'Could not create the account.'); setBusy(button, false); return; }
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
  state.bootId += 1;
  state.profile = null;
  $('#authScreen').classList.remove('hidden');
  $('#app').classList.add('hidden');
}

async function boot(session = state.session) {
  const bootId = ++state.bootId;
  let profile = null;
  let lastError = null;
  for (let attempt = 0; attempt < 5 && !profile; attempt += 1) {
    const result = await readWithRetry(() => sb.from('profiles').select('id, full_name, role, active_role, run_score, run_score_level, rating_sum, rating_count, created_at').eq('id', session.user.id).maybeSingle(), 2);
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
  $('#authScreen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  state.page = profile.active_role === 'runner' ? 'runner' : 'home';
  render();
}

// ---------------------------------------------------------------------------
// DATA HELPERS
// ---------------------------------------------------------------------------
async function fetchOpenTrips() {
  return cachedRead('open-trips', () => sb.from('trips').select('*, profiles:runner_id(full_name, rating_sum, rating_count)').order('depart_date', { ascending: true }).limit(30));
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
  return cachedRead('pending-vehicles', () => sb.from('vehicles').select('*, profiles:user_id(full_name)').eq('approved', false).order('created_at', { ascending: true }));
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

// ---------------------------------------------------------------------------
// RENDER: SHELL
// ---------------------------------------------------------------------------
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
    $('#modeBtn').onclick = async () => {
      setBusy($('#modeBtn'), true, 'Switching…');
      const { error } = await sb.from('profiles').update({ active_role: nextRole }).eq('id', state.profile.id);
      if (error) { toast(friendlyError(error)); setBusy($('#modeBtn'), false); return; }
      state.profile.active_role = nextRole;
      state.page = nextRole === 'runner' ? 'runner' : nextRole === 'admin' ? 'admin' : 'home';
      render();
    };
  } else {
    $('#modeBtn').textContent = role === 'runner' ? 'Switch to Customer' : 'Switch to Runner';
    $('#modeBtn').onclick = async () => {
      const newRole = role === 'runner' ? 'customer' : 'runner';
      setBusy($('#modeBtn'), true, 'Switching…');
      const { error } = await sb.from('profiles').update({ active_role: newRole }).eq('id', state.profile.id);
      if (error) { toast(friendlyError(error)); setBusy($('#modeBtn'), false); return; }
      state.profile.active_role = newRole;
      state.page = newRole === 'runner' ? 'runner' : 'home';
      render();
    };
  }

  $('#primaryAction').classList.toggle('hidden', role === 'admin');
  $('#primaryAction').textContent = role === 'runner' ? '+ Announce Trip' : '+ Post Request';
  $('#primaryAction').onclick = () => role === 'runner' ? (state.page = 'announce', render()) : openRequestModal();

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
  c.innerHTML = html;
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
      <label class="full">Services offered<select name="services" multiple size="4">${REQUEST_TYPES.map(t=>`<option value="${t}">${t.replace('_',' ')}</option>`).join('')}</select></label>
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
  const [pendingRunners, pendingVehicles] = await Promise.all([fetchPendingVerifications(), fetchPendingVehicles()]);
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
    const [idUrl, selfieUrl] = await Promise.all([signedUrl(v.id_document_url), signedUrl(v.selfie_url)]);
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

// ---------------------------------------------------------------------------
// VIEWS: ORDER ROOM (shared)
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
  const isCustomer = room.customer_id === state.profile.id;
  const esc = room.escrow_transactions;

  const detail = `<div class="order-room">
    <div>
      <div class="card">
        <h3>Journey timeline</h3>
        <div class="milestone-list">${milestones.length ? milestones.map(m => `<div class="step"><i>●</i><div><b>${MILESTONE_LABELS[m.milestone]||m.milestone}</b><small>${new Date(m.created_at).toLocaleString()}${m.note?' — '+m.note:''}</small></div></div>`).join('') : '<div class="empty">No milestones yet.</div>'}</div>
        ${!isCustomer ? `<div class="section"><h3>Post a milestone</h3></div>
          <select id="milestoneSelect">${Object.entries(MILESTONE_LABELS).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}</select>
          <button class="secondary" id="postMilestone">Post</button>` : ''}
      </div>
      <div class="card">
        <h3>Order Room chat</h3>
        <div class="chat-box">${messages.length ? messages.map(m => `<div class="chat-msg"><b>${m.sender_id===state.profile.id?'You':'Them'}:</b> ${m.message}</div>`).join('') : '<div class="empty">No messages yet.</div>'}</div>
        <div class="chat-input"><input id="chatInput" placeholder="Type a message"><button class="primary" id="sendChat">Send</button></div>
      </div>
    </div>
    <div>
      <div class="card">
        <h3>Escrow status</h3>
        <p>Status: <span class="badge warning">${esc?.status}</span></p>
        <p>Item value: ${money(esc?.item_value)}<br>Runner fee: ${money(esc?.runner_fee)}<br>Platform fee: ${money(esc?.platform_fee)}<br>Protection fee: ${money(esc?.protection_fee)}</p>
        <p><b>Total: ${money(esc?.total)}</b></p>
        ${isCustomer && esc?.status === 'awaiting_funding' ? `<button class="primary" id="fundEscrow">Fund Escrow (demo payment)</button>` : ''}
        ${isCustomer && ['funded','locked','purchase_authorised','shopping','collected','journey_active','delivery_pending'].includes(esc?.status) ? `<div class="section"><h3>Create delivery PIN</h3><p class="muted">Keep this PIN private. Enter it only after receiving the delivery.</p><form id="setPinForm"><label>4–6 digit PIN<input name="pin" inputmode="numeric" pattern="[0-9]{4,6}" minlength="4" maxlength="6" required></label><button class="secondary">Save PIN</button></form></div>` : ''}
        ${isCustomer && esc?.status && esc.status !== 'released' && esc.status !== 'awaiting_funding' ? `
          <div class="section"><h3>Confirm delivery</h3></div>
          <form id="confirmDeliveryForm">
            <label>Delivery PIN<input name="pin" required></label>
            <label>Actual amount spent (optional, for shopping requests)<input type="number" name="spent"></label>
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
}

// ---------------------------------------------------------------------------
// MODALS / FORMS
// ---------------------------------------------------------------------------
function openRequestModal(prefill = {}) {
  const modal = $('#requestModal');
  const form = $('#requestForm');
  form.reset();
  form.elements.type.value = prefill.type || 'parcel';
  form.elements.from_city.value = prefill.from_city || '';
  form.elements.to_city.value = prefill.to_city || '';
  form.elements.estimated_value.value = prefill.estimated_value ?? '';
  $('#requestDetailsCount').textContent = '0';
  $('#requestError').textContent = '';
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
  toast('Request posted. Runners on matching routes will see it.');
  state.page = 'requests'; render();
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
    details: String(values.get('details') || '').trim() || null,
  };
  if (!REQUEST_TYPES.includes(payload.type)) return ($('#requestError').textContent = 'Choose a request type.');
  if (!payload.from_city || !payload.to_city) return ($('#requestError').textContent = 'Enter both the pickup and delivery city.');
  if (payload.from_city.toLowerCase() === payload.to_city.toLowerCase()) return ($('#requestError').textContent = 'Pickup and delivery cities must be different.');
  $('#requestError').textContent = '';
  setBusy(button, true, 'Posting…');
  try {
    await submitRequest(payload);
    closeRequestModal();
  } catch (error) {
    $('#requestError').textContent = friendlyError(error, 'The request could not be posted.');
  } finally {
    setBusy(button, false);
  }
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#requestModal').classList.contains('hidden')) closeRequestModal(); });

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
  if (tf) tf.onsubmit = async e => {
    e.preventDefault();
    const button = e.submitter;
    setBusy(button, true, 'Publishing…');
    const f = new FormData(e.target);
    const services = Array.from(e.target.services.selectedOptions).map(o => o.value);
    const stops = (f.get('stops') || '').split(',').map(s => s.trim()).filter(Boolean);
    const payload = {
      id: newId(),
      runner_id: state.profile.id,
      vehicle_id: f.get('vehicle_id'),
      from_country: f.get('from_country'), from_city: f.get('from_city'),
      to_country: f.get('to_country'), to_city: f.get('to_city'),
      depart_date: f.get('depart_date'), depart_time: f.get('depart_time'),
      capacity_kg: +f.get('capacity_kg'), capacity_spaces: +f.get('capacity_spaces'),
      spaces_remaining: +f.get('capacity_spaces'), stops, services,
      potential_earnings: Math.round(+f.get('capacity_spaces') * 350),
      status: 'upcoming',
    };
    const { error } = await idempotentWrite('trips', payload);
    if (error) { toast(friendlyError(error)); setBusy(button, false); return; }
    clearCache('my-trips:', 'open-trips');
    toast('Trip published.');
    state.page = 'mytrips'; render();
  };

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
        photo_urls: paths, approved: false,
      });
      if (error) throw error;
      clearCache('vehicles:', 'pending-vehicles');
      toast('Vehicle submitted for approval.');
      renderPage();
    } catch (err) { toast(friendlyError(err)); setBusy(button, false); }
  };

  document.querySelectorAll('.approveRunner').forEach(b => b.onclick = async () => {
    const { error } = await sb.from('runner_verifications').update({ status: 'approved', reviewed_by: state.profile.id, reviewed_at: new Date().toISOString() }).eq('id', b.dataset.id);
    if (error) return toast(friendlyError(error));
    await sb.from('admin_audit_log').insert({ admin_id: state.profile.id, action: 'approve_runner_verification', target_table: 'runner_verifications', target_id: b.dataset.id });
    clearCache('pending-verifications', 'verification:');
    toast('Runner approved.'); renderPage();
  });
  document.querySelectorAll('.rejectRunner').forEach(b => b.onclick = async () => {
    const { error } = await sb.from('runner_verifications').update({ status: 'rejected', reviewed_by: state.profile.id, reviewed_at: new Date().toISOString() }).eq('id', b.dataset.id);
    if (error) return toast(friendlyError(error));
    await sb.from('admin_audit_log').insert({ admin_id: state.profile.id, action: 'reject_runner_verification', target_table: 'runner_verifications', target_id: b.dataset.id });
    clearCache('pending-verifications', 'verification:');
    toast('Runner rejected.'); renderPage();
  });
  document.querySelectorAll('.approveVehicle').forEach(b => b.onclick = async () => {
    const { error } = await sb.from('vehicles').update({ approved: true }).eq('id', b.dataset.id);
    if (error) return toast(friendlyError(error));
    await sb.from('admin_audit_log').insert({ admin_id: state.profile.id, action: 'approve_vehicle', target_table: 'vehicles', target_id: b.dataset.id });
    clearCache('pending-vehicles', 'vehicles:');
    toast('Vehicle approved.'); renderPage();
  });
}
