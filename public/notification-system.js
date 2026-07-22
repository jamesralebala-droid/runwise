// ============================================================================
// RunWise — Notification System
// Branded sounds, in-app notifications, push subscriptions
// ============================================================================

// ---------------------------------------------------------------------------
// 1. RUNWISE BRANDED SOUND SYSTEM (Web Audio API)
// ---------------------------------------------------------------------------
const RunWiseSounds = (() => {
  let ctx = null;
  let enabled = true;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Helper: play a tone with envelope
  function tone(freq, duration, type = 'sine', volume = 0.3, delay = 0) {
    const c = getCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime + delay);
    g.gain.setValueAtTime(volume, c.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + delay + duration);
    o.connect(g);
    g.connect(c.destination);
    o.start(c.currentTime + delay);
    o.stop(c.currentTime + delay + duration);
  }

  // Helper: noise burst
  function noise(duration, volume = 0.15, delay = 0) {
    const c = getCtx();
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const g = c.createGain();
    g.gain.setValueAtTime(volume, c.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + delay + duration);
    src.connect(g);
    g.connect(c.destination);
    src.start(c.currentTime + delay);
  }

  // Helper: footstep
  function footstep(delay = 0, volume = 0.12) {
    noise(0.06, volume, delay);
    tone(200, 0.05, 'sine', volume * 0.5, delay);
  }

  // Helper: chime (positive)
  function chime(delay = 0, volume = 0.2) {
    tone(880, 0.4, 'sine', volume, delay);
    tone(1318, 0.5, 'sine', volume * 0.7, delay + 0.05);
    tone(1760, 0.6, 'sine', volume * 0.4, delay + 0.1);
  }

  // Helper: short ding
  function ding(delay = 0, volume = 0.2) {
    tone(1047, 0.3, 'sine', volume, delay);
    tone(1568, 0.35, 'sine', volume * 0.6, delay + 0.04);
  }

  // Helper: pop/ping (soft)
  function pop(delay = 0, volume = 0.15) {
    tone(1200, 0.1, 'sine', volume, delay);
    tone(1600, 0.08, 'sine', volume * 0.5, delay + 0.02);
  }

  // Helper: whoosh
  function whoosh(delay = 0, volume = 0.1) {
    const c = getCtx();
    const bufferSize = c.sampleRate * 0.2;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.sin((i / bufferSize) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env * 0.15;
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2000, c.currentTime + delay);
    f.frequency.exponentialRampToValueAtTime(200, c.currentTime + delay + 0.2);
    const g = c.createGain();
    g.gain.setValueAtTime(volume, c.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + delay + 0.25);
    src.connect(f);
    f.connect(g);
    g.connect(c.destination);
    src.start(c.currentTime + delay);
  }

  // Helper: alert tone (urgent/serious)
  function alertTone(delay = 0, volume = 0.25) {
    for (let i = 0; i < 3; i++) {
      tone(440, 0.15, 'square', volume * 0.8, delay + i * 0.3);
      tone(554, 0.15, 'square', volume * 0.6, delay + i * 0.3 + 0.05);
    }
  }

  // =====================================================================
  // PUBLIC SOUND TRIGGERS
  // =====================================================================

  const sounds = {
    // 1. RUNWISE MATCH SIGNATURE — footsteps approaching → positive chime
    match(delay = 0) {
      if (!enabled) return;
      try {
        footstep(delay, 0.12);
        footstep(delay + 0.25, 0.1);
        footstep(delay + 0.45, 0.08);
        footstep(delay + 0.6, 0.06);
        chime(delay + 0.75, 0.25);
      } catch (e) { /* audio not supported */ }
    },

    // 2. JOB CONFIRMED — faster footsteps → satisfying ding
    confirmed(delay = 0) {
      if (!enabled) return;
      try {
        footstep(delay, 0.1);
        footstep(delay + 0.15, 0.08);
        footstep(delay + 0.3, 0.06);
        ding(delay + 0.4, 0.25);
      } catch (e) {}
    },

    // 3. TRIP ANNOUNCED — short movement whoosh
    tripAnnounced(delay = 0) {
      if (!enabled) return;
      try { whoosh(delay, 0.12); } catch (e) {}
    },

    // 4. NEW MESSAGE — soft pop/ping
    newMessage(delay = 0) {
      if (!enabled) return;
      try { pop(delay, 0.15); } catch (e) {}
    },

    // 5. PAYMENT / ESCROW FUNDED — subtle secure coin/chime
    payment(delay = 0) {
      if (!enabled) return;
      try {
        tone(1568, 0.15, 'sine', 0.15, delay);
        tone(1976, 0.2, 'sine', 0.1, delay + 0.05);
        tone(2637, 0.3, 'sine', 0.08, delay + 0.1);
      } catch (e) {}
    },

    // 6. JOURNEY STARTED — short movement whoosh
    journeyStarted(delay = 0) {
      if (!enabled) return;
      try { whoosh(delay, 0.15); } catch (e) {}
    },

    // 7. APPROACHING PICKUP/DELIVERY — two quick footsteps → ping
    approaching(delay = 0) {
      if (!enabled) return;
      try {
        footstep(delay, 0.1);
        footstep(delay + 0.12, 0.08);
        tone(1318, 0.2, 'sine', 0.18, delay + 0.2);
      } catch (e) {}
    },

    // 8. DELIVERY COMPLETED — positive arrival/victory sound
    deliveryCompleted(delay = 0) {
      if (!enabled) return;
      try {
        tone(1047, 0.2, 'triangle', 0.2, delay);
        tone(1318, 0.25, 'triangle', 0.18, delay + 0.1);
        tone(1568, 0.3, 'triangle', 0.15, delay + 0.2);
        tone(2093, 0.5, 'sine', 0.22, delay + 0.3);
      } catch (e) {}
    },

    // 9. URGENT / DISPUTE — serious alert tone (no playful elements)
    urgent(delay = 0) {
      if (!enabled) return;
      try { alertTone(delay, 0.25); } catch (e) {}
    },
  };

  function setEnabled(val) {
    enabled = val;
    // Try to resume audio context on enable
    if (enabled && ctx && ctx.state === 'suspended') ctx.resume();
  }

  function isEnabled() { return enabled; }

  return { ...sounds, setEnabled, isEnabled };
})();

// ---------------------------------------------------------------------------
// 2. NOTIFICATION UI — add bell icon, badge, dropdown to the DOM
// ---------------------------------------------------------------------------
function initNotificationUI() {
  // Add notification bell to the topbar actions
  const actions = document.querySelector('.topbar .actions');
  if (!actions || document.getElementById('notifBell')) return;

  const bell = document.createElement('button');
  bell.id = 'notifBell';
  bell.className = 'notif-bell';
  bell.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span id="notifBadge" class="notif-badge hidden">0</span>';
  bell.title = 'Notifications';
  actions.prepend(bell);

  // Notification dropdown panel
  const panel = document.createElement('div');
  panel.id = 'notifPanel';
  panel.className = 'notif-panel hidden';
  panel.innerHTML = `<div class="notif-panel-head">
    <h3>Notifications</h3>
    <button id="notifMarkAllRead" class="notif-action-btn">Mark all read</button>
  </div>
  <div id="notifList" class="notif-list"><div class="notif-empty">No notifications yet</div></div>
  <div class="notif-panel-foot">
    <label class="notif-toggle"><input type="checkbox" id="notifSoundToggle" checked> <span>Sound</span></label>
    <label class="notif-toggle"><input type="checkbox" id="notifPushToggle" checked> <span>Push</span></label>
  </div>`;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Notifications');
  document.body.appendChild(panel);

  // Push permission prompt
  const prompt = document.createElement('div');
  prompt.id = 'notifPushPrompt';
  prompt.className = 'notif-push-prompt hidden';
  prompt.innerHTML = `<div class="notif-push-prompt-content">
    <h3>Stay in the loop</h3>
    <p>Allow RunWise notifications so we can alert you when a matching trip, job, offer, or delivery update comes up.</p>
    <div class="notif-push-prompt-actions">
      <button id="notifEnablePush" class="primary">Enable notifications</button>
      <button id="notifMaybeLater" class="secondary">Maybe later</button>
    </div>
  </div>`;
  document.body.appendChild(prompt);

  // Settings panel (accessed from bell menu)
  const settingsOverlay = document.createElement('div');
  settingsOverlay.id = 'notifSettingsOverlay';
  settingsOverlay.className = 'modal hidden';
  settingsOverlay.innerHTML = `<div class="modal-backdrop" id="notifSettingsClose"></div>
  <div class="modal-panel" style="max-width:420px">
    <div class="modal-head"><div><h2>Notification Settings</h2></div><button class="icon-btn" id="notifSettingsCloseBtn">&times;</button></div>
    <div class="notif-settings-body">
      <label class="notif-settings-row"><span><b>Sound alerts</b><small>Play sounds for matches, messages, and updates</small></span>
        <input type="checkbox" id="notifSettingsSound" checked></label>
      <label class="notif-settings-row"><span><b>Push notifications</b><small>Receive notifications when RunWise is closed</small></span>
        <input type="checkbox" id="notifSettingsPush" checked></label>
      <div class="notif-settings-actions">
        <button id="notifSettingsSave" class="primary">Save</button>
        <button id="notifSettingsCancel" class="secondary">Cancel</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(settingsOverlay);

  // Add CSS
  const style = document.createElement('style');
  style.textContent = getNotificationStyles();
  document.head.appendChild(style);
}

function getNotificationStyles() {
  return `
/* ---- Notification Bell ---- */
.notif-bell {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  color: var(--charcoal, #242826);
  transition: background 0.2s;
  line-height: 1;
}
.notif-bell:hover { background: rgba(0,0,0,0.06); }
.notif-badge {
  position: absolute;
  top: 0;
  right: 0;
  background: var(--danger, #b3402f);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  pointer-events: none;
  animation: notif-badge-pop 0.3s ease;
}
@keyframes notif-badge-pop {
  0% { transform: scale(0.5); }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

/* ---- Notification Panel ---- */
.notif-panel {
  position: fixed;
  top: 60px;
  right: 16px;
  width: 380px;
  max-height: 520px;
  background: #fff;
  border-radius: var(--radius, 14px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line, #e2ded2);
}
@media (max-width: 480px) {
  .notif-panel { right: 8px; left: 8px; width: auto; top: 54px; }
}
.notif-panel.hidden { display: none; }
.notif-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line, #e2ded2);
}
.notif-panel-head h3 { margin: 0; font-size: 15px; font-weight: 600; }
.notif-action-btn {
  background: none;
  border: none;
  color: var(--green, #123F34);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}
.notif-action-btn:hover { background: rgba(18,63,52,0.08); }
.notif-list {
  flex: 1;
  overflow-y: auto;
  max-height: 380px;
}
.notif-item {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line, #e2ded2);
  cursor: pointer;
  transition: background 0.15s;
}
.notif-item:hover { background: #f9f8f4; }
.notif-item.unread { background: #f0f5f2; }
.notif-item.unread:hover { background: #e8efe9; }
.notif-item-icon {
  font-size: 20px;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ivory, #F7F2E8);
  border-radius: 50%;
}
.notif-item-body { flex: 1; min-width: 0; }
.notif-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--charcoal, #242826);
  margin-bottom: 2px;
}
.notif-item-desc {
  font-size: 12px;
  color: #68756e;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.notif-item-time {
  font-size: 10px;
  color: #a0a9a3;
  margin-top: 4px;
}
.notif-empty {
  padding: 32px 16px;
  text-align: center;
  color: #a0a9a3;
  font-size: 13px;
}
.notif-panel-foot {
  display: flex;
  gap: 12px;
  padding: 10px 16px;
  border-top: 1px solid var(--line, #e2ded2);
  background: #fafaf8;
}
.notif-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #68756e;
  cursor: pointer;
}
.notif-toggle input { margin: 0; }

/* ---- Push Permission Prompt ---- */
.notif-push-prompt {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 340px;
  z-index: 1002;
  animation: notif-slide-up 0.3s ease;
}
@keyframes notif-slide-up {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.notif-push-prompt.hidden { display: none; }
.notif-push-prompt-content {
  background: #fff;
  border-radius: var(--radius, 14px);
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  border: 1px solid var(--line, #e2ded2);
}
.notif-push-prompt h3 {
  margin: 0 0 6px;
  font-size: 16px;
  color: var(--green, #123F34);
}
.notif-push-prompt p {
  margin: 0 0 16px;
  font-size: 13px;
  color: #68756e;
  line-height: 1.5;
}
.notif-push-prompt-actions {
  display: flex;
  gap: 8px;
}
.notif-push-prompt-actions .primary {
  flex: 1;
}
.notif-push-prompt-actions .secondary {
  flex-shrink: 0;
}

/* ---- Notification Settings Modal ---- */
.notif-settings-body {
  padding: 16px;
}
.notif-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--line, #e2ded2);
  cursor: pointer;
}
.notif-settings-row:last-of-type { border-bottom: none; }
.notif-settings-row b { display: block; font-size: 14px; }
.notif-settings-row small { display: block; font-size: 12px; color: #68756e; margin-top: 2px; }
.notif-settings-row input[type=checkbox] {
  width: 20px;
  height: 20px;
  accent-color: var(--green, #123F34);
}
.notif-settings-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--line, #e2ded2);
}
.notif-settings-actions .primary { flex: 1; }
`;
}

// ---------------------------------------------------------------------------
// 3. NOTIFICATION STATE
// ---------------------------------------------------------------------------
const NotifState = {
  notifications: [],
  unreadCount: 0,
  channel: null,
  pushSubscribed: false,
  preferences: { sound_enabled: true, push_enabled: true },
  initialized: false,
  pushPromptShown: false,
};

// ---------------------------------------------------------------------------
// 4. NOTIFICATION DATA — icons per type
// ---------------------------------------------------------------------------
const NOTIF_ICONS = {
  match_found: '🏃',
  offer_proposed: '🤝',
  offer_accepted: '✅',
  job_confirmed: '📦',
  new_message: '💬',
  payment_funded: '◈',
  pickup_ready: '📍',
  journey_started: '🚀',
  approaching_delivery: '📬',
  delivery_completed: '🎉',
  dispute_raised: '⚖️',
  dispute_resolved: '⚖️',
  rating_received: '⭐',
  verification_approved: '🪪',
  verification_rejected: '🪪',
  withdrawal_processed: '◈',
  trip_match: '🏃',
};

const NOTIF_SOUNDS = {
  match_found: 'match',
  offer_proposed: 'newMessage',
  offer_accepted: 'confirmed',
  job_confirmed: 'confirmed',
  new_message: 'newMessage',
  payment_funded: 'payment',
  pickup_ready: 'approaching',
  journey_started: 'journeyStarted',
  approaching_delivery: 'approaching',
  delivery_completed: 'deliveryCompleted',
  dispute_raised: 'urgent',
  dispute_resolved: 'confirmed',
  rating_received: 'newMessage',
  withdrawal_processed: 'payment',
};

// High priority types get browser push notifications
const HIGH_PRIORITY_TYPES = new Set([
  'match_found', 'offer_proposed', 'offer_accepted', 'job_confirmed',
  'payment_funded', 'pickup_ready', 'approaching_delivery',
  'delivery_completed', 'dispute_raised', 'dispute_resolved',
]);

// ---------------------------------------------------------------------------
// 5. FORMATTING HELPERS
// ---------------------------------------------------------------------------
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  return days + 'd ago';
}

// ---------------------------------------------------------------------------
// 6. SUPABASE REALTIME SUBSCRIPTION
// ---------------------------------------------------------------------------
function subscribeToNotifications(userId) {
  if (NotifState.channel) {
    NotifState.channel.unsubscribe();
    NotifState.channel = null;
  }

  if (!window.sb) return;

  // Subscribe to notification_history inserts for this user via Supabase Realtime
  NotifState.channel = sb.channel('notifications-' + userId, {
    config: { broadcast: { self: false } },
  });

  // The notification-history-changes filter uses postgres_changes
  // We subscribe to INSERT events on the notification_history table
  NotifState.channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notification_history',
      filter: 'user_id=eq.' + userId,
    },
    (payload) => {
      if (payload.new) {
        addNotification(payload.new);
      }
    }
  );

  NotifState.channel.subscribe();
}

// ---------------------------------------------------------------------------
// 7. ADD NOTIFICATION (from realtime event or poll)
// ---------------------------------------------------------------------------
function addNotification(notif) {
  // Deduplicate by id
  if (NotifState.notifications.some(n => n.id === notif.id)) return;

  NotifState.notifications.unshift(notif);
  if (!notif.is_read) {
    NotifState.unreadCount += 1;
    updateBadge();
  }

  // Play sound if enabled
  const soundName = NOTIF_SOUNDS[notif.type];
  if (soundName && NotifState.preferences.sound_enabled && RunWiseSounds[soundName]) {
    RunWiseSounds[soundName]();
  }

  // Send browser push if:
  // - Push is enabled
  // - The page is hidden/backgrounded (document.hidden)
  // - This is a high-priority notification type
  if (NotifState.preferences.push_enabled && document.hidden && HIGH_PRIORITY_TYPES.has(notif.type)) {
    sendBrowserPush(notif);
  }

  // Update the panel if it's open
  if (!$('#notifPanel').classList.contains('hidden')) {
    renderNotificationList();
  }
}

// ---------------------------------------------------------------------------
// 8. RENDER NOTIFICATION LIST
// ---------------------------------------------------------------------------
function renderNotificationList() {
  const list = $('#notifList');
  if (!list) return;

  if (!NotifState.notifications.length) {
    list.innerHTML = '<div class="notif-empty">No notifications yet</div>';
    return;
  }

  list.innerHTML = NotifState.notifications.map(n => {
    const icon = NOTIF_ICONS[n.type] || '🔔';
    const className = 'notif-item' + (n.is_read ? '' : ' unread');
    return `<div class="${className}" data-id="${n.id}" data-type="${n.type}" data-data='${escapeAttr(JSON.stringify(n.data || {}))}'>
      <div class="notif-item-icon">${icon}</div>
      <div class="notif-item-body">
        <div class="notif-item-title">${escapeHtml(n.title)}</div>
        <div class="notif-item-desc">${escapeHtml(n.description)}</div>
        <div class="notif-item-time">${timeAgo(n.created_at)}</div>
      </div>
    </div>`;
  }).join('');

  // Click handlers for notification items
  list.querySelectorAll('.notif-item').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.id;
      const data = safeJsonParse(el.dataset.data, {});
      markNotificationRead(id);
      navigateFromNotification(el.dataset.type, data);
    };
  });
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// ---------------------------------------------------------------------------
// 9. NAVIGATE FROM NOTIFICATION
// ---------------------------------------------------------------------------
function navigateFromNotification(type, data) {
  if (!window.state) return;

  // Navigate to the relevant view based on notification type
  if (data.order_room_id) {
    state.openOrderRoom = data.order_room_id;
    openOrderRoom(data.order_room_id);
    closeNotifPanel();
    return;
  }

  if (type === 'match_found' || type === 'offer_proposed') {
    const role = state.profile?.active_role;
    if (role === 'runner') {
      state.page = 'matches';
    } else {
      state.page = 'customerMatches';
    }
    if (window.render) { render(); }
    closeNotifPanel();
    return;
  }

  if (type === 'job_confirmed' || type === 'offer_accepted' || type === 'pickup_ready' ||
      type === 'journey_started' || type === 'approaching_delivery' || type === 'delivery_completed' ||
      type === 'dispute_raised' || type === 'dispute_resolved') {
    state.page = 'orders';
    if (window.render) { render(); }
    closeNotifPanel();
    return;
  }

  if (type === 'payment_funded' || type === 'withdrawal_processed') {
    state.page = 'wallet';
    if (window.render) { render(); }
    closeNotifPanel();
    return;
  }

  if (type === 'new_message') {
    state.page = 'orders';
    if (window.render) { render(); }
    closeNotifPanel();
    return;
  }

  if (type === 'verification_approved' || type === 'verification_rejected') {
    state.page = 'verification';
    if (window.render) { render(); }
    closeNotifPanel();
    return;
  }

  closeNotifPanel();
}

// ---------------------------------------------------------------------------
// 10. MARK READ
// ---------------------------------------------------------------------------
async function markNotificationRead(id) {
  const notif = NotifState.notifications.find(n => n.id === id);
  if (!notif || notif.is_read) return;

  notif.is_read = true;
  NotifState.unreadCount = Math.max(0, NotifState.unreadCount - 1);
  updateBadge();

  // Update in database
  try {
    await sb.from('notification_history').update({ is_read: true }).eq('id', id);
  } catch (e) { /* ignore */ }

  // Re-render if panel is open
  if (!$('#notifPanel').classList.contains('hidden')) {
    renderNotificationList();
  }
}

async function markAllNotificationsRead() {
  if (!NotifState.notifications.length) return;

  NotifState.notifications.forEach(n => n.is_read = true);
  NotifState.unreadCount = 0;
  updateBadge();

  try {
    await sb.rpc('mark_all_notifications_read');
  } catch (e) {
    // Fallback: update each
    try {
      const ids = NotifState.notifications.map(n => n.id);
      await sb.from('notification_history').update({ is_read: true }).in('id', ids);
    } catch (e2) { /* ignore */ }
  }

  if (!$('#notifPanel').classList.contains('hidden')) {
    renderNotificationList();
  }
}

// ---------------------------------------------------------------------------
// 11. UPDATE BADGE
// ---------------------------------------------------------------------------
function updateBadge() {
  const badge = $('#notifBadge');
  if (!badge) return;
  if (NotifState.unreadCount > 0) {
    badge.textContent = NotifState.unreadCount > 99 ? '99+' : String(NotifState.unreadCount);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  // Update page title with unread count
  if (NotifState.unreadCount > 0) {
    document.title = `(${NotifState.unreadCount}) RunWise`;
  } else {
    document.title = 'RunWise — Your Cart. Our Run.';
  }
}

// ---------------------------------------------------------------------------
// 12. TOGGLE NOTIFICATION PANEL
// ---------------------------------------------------------------------------
function toggleNotifPanel() {
  const panel = $('#notifPanel');
  if (panel.classList.contains('hidden')) {
    openNotifPanel();
  } else {
    closeNotifPanel();
  }
}

function openNotifPanel() {
  const panel = $('#notifPanel');
  panel.classList.remove('hidden');
  renderNotificationList();
  // Load fresh data
  loadNotifications();
}

function closeNotifPanel() {
  const panel = $('#notifPanel');
  panel.classList.add('hidden');
}

// ---------------------------------------------------------------------------
// 13. LOAD NOTIFICATIONS FROM DATABASE
// ---------------------------------------------------------------------------
async function loadNotifications() {
  try {
    const { data, error } = await sb.from('notification_history')
      .select('*')
      .eq('user_id', state.profile.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Merge with existing (new items from realtime)
    const existingIds = new Set(NotifState.notifications.map(n => n.id));
    const newItems = (data || []).filter(n => !existingIds.has(n.id));

    NotifState.notifications = [...newItems, ...NotifState.notifications].slice(0, 50);
    NotifState.unreadCount = NotifState.notifications.filter(n => !n.is_read).length;
    updateBadge();

    if (!$('#notifPanel').classList.contains('hidden')) {
      renderNotificationList();
    }
  } catch (e) {
    console.error('Failed to load notifications:', e);
  }
}

// ---------------------------------------------------------------------------
// 14. BROWSER PUSH — service worker registration
// ---------------------------------------------------------------------------
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.register('/notification-worker.js');
    return registration;
  } catch (e) {
    console.warn('Service worker registration failed:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 15. SUBSCRIBE TO PUSH
// ---------------------------------------------------------------------------
async function subscribeToPush() {
  if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await registerServiceWorker();
    if (!registration) return false;

    // Get the VAPID public key — this should be set via your Supabase project
    const vapidKey = window.VAPID_PUBLIC_KEY || null;
    if (!vapidKey) {
      console.warn('VAPID public key not configured. Push subscriptions will use a placeholder. Configure VAPID keys in your hosting provider or Supabase Edge Functions.');
      return false;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    // Store subscription in the database
    const subJson = subscription.toJSON();
    const { error } = await sb.from('push_subscriptions').upsert({
      user_id: state.profile.id,
      endpoint: subJson.endpoint,
      p256dh_key: subJson.keys.p256dh,
      auth_key: subJson.keys.auth,
      user_agent: navigator.userAgent,
    }, { onConflict: 'user_id,endpoint' });

    if (error) throw error;

    NotifState.pushSubscribed = true;
    return true;
  } catch (e) {
    console.warn('Push subscription failed:', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 16. UNSUBSCRIBE FROM PUSH
// ---------------------------------------------------------------------------
async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const subJson = subscription.toJSON();
      await sb.from('push_subscriptions')
        .delete()
        .eq('user_id', state.profile.id)
        .eq('endpoint', subJson.endpoint);
      await subscription.unsubscribe();
    }
    NotifState.pushSubscribed = false;
    return true;
  } catch (e) {
    console.warn('Push unsubscription failed:', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 17. SEND BROWSER PUSH (local — triggers Notification API for active tab)
// ---------------------------------------------------------------------------
function sendBrowserPush(notif) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const icon = NOTIF_ICONS[notif.type] || '🔔';
  const title = `${icon} ${notif.title}`;

  try {
    const n = new Notification(title, {
      body: notif.description,
      icon: '/runwise-logo.svg',
      badge: '/runwise-logo.svg',
      tag: 'runwise-' + notif.id,
      data: notif.data || {},
      requireInteraction: HIGH_PRIORITY_TYPES.has(notif.type),
    });

    n.onclick = (event) => {
      event.preventDefault();
      window.focus();
      n.close();
      navigateFromNotification(notif.type, notif.data || {});
    };
  } catch (e) {
    // Notification API not available
  }
}

// ---------------------------------------------------------------------------
// 18. VAPID KEY HELPER (url-safe base64 to Uint8Array)
// ---------------------------------------------------------------------------
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ---------------------------------------------------------------------------
// 19. LOAD PREFERENCES
// ---------------------------------------------------------------------------
async function loadNotificationPreferences() {
  try {
    const { data, error } = await sb.from('notification_preferences')
      .select('*')
      .eq('user_id', state.profile.id)
      .maybeSingle();

    if (data) {
      NotifState.preferences = {
        sound_enabled: data.sound_enabled !== false,
        push_enabled: data.push_enabled !== false,
      };
    }

    // Update UI toggles
    const soundToggle = $('#notifSoundToggle');
    const pushToggle = $('#notifPushToggle');
    if (soundToggle) soundToggle.checked = NotifState.preferences.sound_enabled;
    if (pushToggle) pushToggle.checked = NotifState.preferences.push_enabled;

    RunWiseSounds.setEnabled(NotifState.preferences.sound_enabled);
  } catch (e) {
    console.warn('Failed to load notification preferences:', e);
  }
}

async function saveNotificationPreferences(prefs) {
  NotifState.preferences = { ...NotifState.preferences, ...prefs };

  try {
    await sb.from('notification_preferences').upsert({
      user_id: state.profile.id,
      sound_enabled: NotifState.preferences.sound_enabled,
      push_enabled: NotifState.preferences.push_enabled,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Failed to save notification preferences:', e);
  }

  RunWiseSounds.setEnabled(NotifState.preferences.sound_enabled);
}

// ---------------------------------------------------------------------------
// 20. CHECK AND SHOW PUSH PERMISSION PROMPT
// ---------------------------------------------------------------------------
function checkPushPermissionPrompt() {
  if (NotifState.pushPromptShown) return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') return;
  if (Notification.permission === 'denied') return;

  // Only show after meaningful interaction (after user has logged in and done something)
  // We'll use a simple heuristic: not on first page load, wait for some navigation
  const prompt = $('#notifPushPrompt');
  if (prompt) {
    setTimeout(() => {
      prompt.classList.remove('hidden');
      NotifState.pushPromptShown = true;
    }, 30000); // Show after 30 seconds of being logged in (gives user time to interact)
  }
}

// ---------------------------------------------------------------------------
// 21. QUICK NOTIFICATION TRIGGER (called from app.js events)
// ---------------------------------------------------------------------------
async function triggerNotification(userId, type, title, description, data = {}, highPriority = false) {
  try {
    await sb.rpc('insert_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_description: description,
      p_data: data,
      p_high_priority: highPriority,
    });
  } catch (e) {
    console.warn('Failed to insert notification:', e);
  }
}

// Convenience wrapper — used when current user's action affects another user
async function notifyUser(userId, type, title, description, data = {}) {
  const isHighPriority = HIGH_PRIORITY_TYPES.has(type);
  // Deduplicate: don't send if the exact same notification was sent in the last 60 seconds
  const recent = NotifState.notifications.filter(n =>
    n.type === type &&
    n.user_id === userId &&
    (n.data?.order_room_id === data.order_room_id ||
     n.data?.match_id === data.match_id) &&
    Date.now() - new Date(n.created_at).getTime() < 60000
  );
  if (recent.length > 0) return;

  await triggerNotification(userId, type, title, description, data, isHighPriority);
}

// ---------------------------------------------------------------------------
// 22. HANDLE MESSAGE FROM SERVICE WORKER (navigation clicks)
// ---------------------------------------------------------------------------
function listenForServiceWorkerMessages() {
  if (!navigator.serviceWorker) return;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NOTIFICATION_CLICK') {
      navigateFromNotification(
        event.data.data?.type,
        event.data.data || {}
      );
    }
  });
}

// ---------------------------------------------------------------------------
// 23. BIND UI EVENTS
// ---------------------------------------------------------------------------
function bindNotificationUI() {
  // Bell click
  const bell = $('#notifBell');
  if (bell) bell.onclick = toggleNotifPanel;

  // Mark all read
  const markAll = $('#notifMarkAllRead');
  if (markAll) markAll.onclick = markAllNotificationsRead;

  // Sound toggle in panel
  const soundToggle = $('#notifSoundToggle');
  if (soundToggle) {
    soundToggle.onchange = () => {
      saveNotificationPreferences({ sound_enabled: soundToggle.checked });
    };
  }

  // Push toggle in panel
  const pushToggle = $('#notifPushToggle');
  if (pushToggle) {
    pushToggle.onchange = async () => {
      const enabled = pushToggle.checked;
      if (enabled && !NotifState.pushSubscribed) {
        const success = await subscribeToPush();
        if (!success) {
          // If push couldn't be subscribed, uncheck
          pushToggle.checked = false;
        }
      } else if (!enabled && NotifState.pushSubscribed) {
        await unsubscribeFromPush();
      }
      saveNotificationPreferences({ push_enabled: pushToggle.checked });
    };
  }

  // Push permission prompt
  const enablePush = $('#notifEnablePush');
  if (enablePush) {
    enablePush.onclick = async () => {
      const prompt = $('#notifPushPrompt');
      if (prompt) prompt.classList.add('hidden');

      if (!('Notification' in window)) {
        toast('Push notifications are not supported in this browser.');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const success = await subscribeToPush();
        if (success) {
          NotifState.preferences.push_enabled = true;
          const pt = $('#notifPushToggle');
          if (pt) pt.checked = true;
          saveNotificationPreferences({ push_enabled: true });
          toast('RunWise notifications enabled!');
        } else {
          toast('Could not subscribe to push notifications. Try again later.');
        }
      } else {
        toast('Notification permission denied. You can enable it later in your browser settings.');
      }
    };
  }

  const maybeLater = $('#notifMaybeLater');
  if (maybeLater) {
    maybeLater.onclick = () => {
      const prompt = $('#notifPushPrompt');
      if (prompt) prompt.classList.add('hidden');
    };
  }

  // Close panel on outside click
  document.addEventListener('click', (e) => {
    const panel = $('#notifPanel');
    const bell = $('#notifBell');
    if (!panel.classList.contains('hidden') &&
        !panel.contains(e.target) &&
        bell && !bell.contains(e.target)) {
      closeNotifPanel();
    }
  });
}

// ---------------------------------------------------------------------------
// 24. INITIALIZATION
// ---------------------------------------------------------------------------
async function initNotifications() {
  if (NotifState.initialized) return;
  NotifState.initialized = true;

  // Create UI elements
  initNotificationUI();

  // Register service worker
  if ('serviceWorker' in navigator) {
    registerServiceWorker();
    listenForServiceWorkerMessages();
  }

  // Wait for state to be ready
  if (!window.state?.profile?.id) {
    // Not logged in yet — the system will be initialized after auth
    return;
  }

  await initAuthenticatedNotifications();
}

async function initAuthenticatedNotifications() {
  const userId = state.profile.id;
  if (!userId) return;

  // Subscribe to realtime notifications
  subscribeToNotifications(userId);

  // Load preferences
  await loadNotificationPreferences();

  // Load existing notifications
  await loadNotifications();

  // Bind UI events
  bindNotificationUI();

  // Check push permission prompt (after a delay)
  checkPushPermissionPrompt();
}

// Export for app.js to call
window.RunWiseNotificationSystem = {
  init: initNotifications,
  initAuthenticated: initAuthenticatedNotifications,
  trigger: triggerNotification,
  notifyUser: notifyUser,
  loadNotifications,
  markRead: markNotificationRead,
  markAllRead: markAllNotificationsRead,
  subscribeToPush,
  unsubscribeFromPush,
  sounds: RunWiseSounds,
  preferences: NotifState.preferences,
  unreadCount: () => NotifState.unreadCount,
};
