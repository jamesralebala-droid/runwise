// ============================================================================
// RunWise — pata.js
// Pata (Botswana) checkout widget adapter — https://pay.pata.co.bw
//
// The widget is DORMANT until a merchant ID is configured:
//   window.PATA_MERCHANT_ID (from config.js) must be a real merchant id.
// Until then:
//   - RunWisePata.isConfigured() returns false
//   - the widget script is NEVER loaded
//   - the app keeps using the existing manual payment flow unchanged
//
// Once configured, open() lazily injects the Pata script (exactly the snippet
// from Pata: <script src="https://pay.pata.co.bw/widget.js"></script> plus a
// <div id="pata-checkout" data-merchant="...">), mounts it in a modal, and
// reports the result back through onSuccess/onError.
//
// NOTE: Pata's widget is not publicly documented yet (host not resolving at
// the time of writing). This adapter is defensive by design — it listens for
// the most common widget conventions (postMessage, custom DOM events, a
// window.PataCheckout global) and exposes a single normalizeResult() seam so
// that when Pata publishes its callback contract, only that function needs
// touching. If the script fails to load, onError is called immediately and
// the caller can fall back to the manual flow.
// ============================================================================
(() => {
  const DEFAULT_WIDGET_URL = 'https://pay.pata.co.bw/widget.js';
  const PLACEHOLDER = 'your-merchant-id';

  let scriptState = 'idle'; // 'idle' | 'loading' | 'loaded' | 'failed'
  let activeResolvers = null; // { onSuccess, onError }

  function merchantId() {
    const id = (window.PATA_MERCHANT_ID || '').trim();
    return id && id !== PLACEHOLDER ? id : '';
  }

  function isConfigured() {
    return !!merchantId();
  }

  // Seam: translate whatever the widget reports into a payment reference.
  // Pata's exact payload shape is unknown until the widget goes live. This
  // function tries the common shapes (transaction id, reference, id) and
  // falls back to the raw payload stringified.
  function normalizeResult(payload) {
    if (!payload) return null;
    const p = typeof payload === 'string' ? { raw: payload } : payload;
    const ref =
      p.transaction_id || p.transactionId || p.transaction_reference ||
      p.reference || p.reference_number || p.ref || p.id || p.order_id ||
      (p.data && (p.data.transaction_id || p.data.reference || p.data.id)) ||
      null;
    const amount =
      p.amount || (p.data && p.data.amount) || null;
    const ok = p.success === true || p.status === 'success' || p.status === 'paid' || p.status === 'completed' || p.paid === true || p.error === false;
    return { reference: ref ? String(ref) : null, amount, ok: !!ref || !!ok, raw: payload };
  }

  function dispatch(name, detail) {
    const container = document.getElementById('pata-checkout');
    if (!container) return;
    container.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }

  function settle(kind, payload) {
    if (!activeResolvers) return;
    const cb = kind === 'success' ? activeResolvers.onSuccess : activeResolvers.onError;
    activeResolvers = null;
    closeModal();
    if (cb) cb(payload);
    else if (kind === 'error') console.warn('RunWisePata error (no handler):', payload);
  }

  // -------------------------------------------------------------------------
  // Result detection. Wire all plausible channels once; each is idempotent.
  // -------------------------------------------------------------------------
  function wireResultChannels() {
    if (window.__runwisePataWired) return;
    window.__runwisePataWired = true;

    // Channel 1 — postMessage from the widget's origin (or any trusted page).
    window.addEventListener('message', (e) => {
      try {
        const origin = String(e.origin || '');
        const trusted = origin.includes('pata.co.bw') || origin.includes('pay.pata.co.bw');
        if (!trusted && !(e.data && e.data.__runwise)) return;
        if (!activeResolvers) return;
        const d = e.data && e.data.__runwise ? e.data.payload : e.data;
        if (!d) return;
        const normalized = normalizeResult(d);
        if (normalized && (normalized.ok || normalized.reference)) {
          if (d.status === 'error' || d.error || d.status === 'failed' || d.status === 'cancelled') {
            settle('error', { message: d.message || d.error || 'Payment was cancelled.', ...normalized });
          } else {
            settle('success', normalized);
          }
        }
      } catch (err) { console.warn('Pata message handler error:', err); }
    });

    // Channel 2 — custom DOM events dispatched on the #pata-checkout container.
    document.addEventListener('pata:success', (e) => {
      if (!activeResolvers) return;
      settle('success', normalizeResult(e.detail));
    });
    document.addEventListener('pata:error', (e) => {
      if (!activeResolvers) return;
      settle('error', { message: (e.detail && e.detail.message) || 'Payment was not completed.', ...normalizeResult(e.detail) });
    });
    document.addEventListener('pata:cancelled', (e) => {
      if (!activeResolvers) return;
      settle('error', { message: 'Payment was cancelled.', ...normalizeResult(e.detail) });
    });

    // Channel 3 — a window.PataCheckout global with callback hooks, if the
    // widget defines one. Pata may expose onSuccess/onError/onFailure.
    Object.defineProperty(window, 'PataCheckout', {
      configurable: true,
      set(v) {
        if (v && typeof v === 'object') {
          const prev = window.__runwisePataCheckoutValue;
          window.__runwisePataCheckoutValue = v;
          if (typeof v.onSuccess === 'function' && !v.__runwiseHooked) {
            v.__runwiseHooked = true;
            const orig = v.onSuccess.bind(v);
            v.onSuccess = (payload) => { orig(payload); settle('success', normalizeResult(payload)); };
            const origErr = v.onError || v.onFailure;
            if (typeof origErr === 'function') {
              v.onError = (payload) => { origErr(payload); settle('error', { message: payload && payload.message ? payload.message : 'Payment failed.', ...normalizeResult(payload) }); };
            }
          }
        }
        return prev; // not used, but keeps the setter honest
      },
      get() { return window.__runwisePataCheckoutValue; },
    });
  }

  // -------------------------------------------------------------------------
  // Script loading
  // -------------------------------------------------------------------------
  function loadWidgetScript() {
    return new Promise((resolve, reject) => {
      if (scriptState === 'loaded') return resolve();
      if (scriptState === 'loading') {
        // Wait for the in-flight load to settle.
        const t = setInterval(() => {
          if (scriptState === 'loaded') { clearInterval(t); resolve(); }
          if (scriptState === 'failed') { clearInterval(t); reject(new Error('Pata widget failed to load.')); }
        }, 100);
        setTimeout(() => { clearInterval(t); reject(new Error('Pata widget load timed out.')); }, 15000);
        return;
      }
      scriptState = 'loading';
      const s = document.createElement('script');
      s.src = window.PATA_WIDGET_URL || DEFAULT_WIDGET_URL;
      s.async = true;
      s.onload = () => { scriptState = 'loaded'; resolve(); };
      s.onerror = () => { scriptState = 'failed'; reject(new Error('Could not load the Pata widget. It may not be live yet — use the manual payment option instead.')); };
      document.head.appendChild(s);
    });
  }

  // -------------------------------------------------------------------------
  // Modal mount
  // -------------------------------------------------------------------------
  function closeModal() {
    const m = document.getElementById('runwisePataModal');
    if (m) m.remove();
  }

  function openModal() {
    closeModal();
    const m = document.createElement('div');
    m.id = 'runwisePataModal';
    m.className = 'modal';
    m.innerHTML = `
      <button class="modal-backdrop" type="button" aria-label="Close Pata checkout" data-close-pata></button>
      <div class="modal-panel" role="dialog" aria-modal="true" aria-label="Pay with Pata">
        <div class="modal-head">
          <div>
            <small>SECURE PAYMENT</small>
            <h2>Pay with Pata</h2>
            <p>Complete your payment in the Pata window below. We will update your order as soon as the payment is confirmed.</p>
          </div>
          <button class="icon-btn" type="button" aria-label="Close" data-close-pata>&times;</button>
        </div>
        <div id="pata-checkout" data-merchant="${merchantId()}"></div>
        <p class="muted" style="font-size:12px;margin-top:10px">Having trouble? <a href="#" data-pata-manual>Use the manual payment option instead</a>.</p>
      </div>`;
    document.body.appendChild(m);
    m.querySelectorAll('[data-close-pata]').forEach(el => el.onclick = (e) => {
      e.preventDefault();
      if (activeResolvers) settle('error', { message: 'Payment cancelled.' });
      else closeModal();
    });
    const manual = m.querySelector('[data-pata-manual]');
    if (manual) manual.onclick = (e) => { e.preventDefault(); settle('error', { message: '__manual__' }); };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  function open({ amount, reference, description, onSuccess, onError } = {}) {
    if (!isConfigured()) {
      if (onError) onError({ message: 'Pata is not configured yet. Use the manual payment option.' });
      return;
    }
    activeResolvers = { onSuccess, onError };
    wireResultChannels();
    openModal();

    const container = document.getElementById('pata-checkout');
    if (container) {
      container.setAttribute('data-merchant', merchantId());
      if (amount) container.setAttribute('data-amount', String(amount));
      if (reference) container.setAttribute('data-reference', String(reference));
      container.setAttribute('data-currency', 'BWP');
      if (description) container.setAttribute('data-description', String(description));
    }

    loadWidgetScript()
      .then(() => {
        // Widget loaded. If it exposes an imperative open (common), try it.
        try {
          const w = window.PataCheckout;
          if (w && typeof w.open === 'function') w.open();
        } catch (err) { console.warn('Pata imperative open failed:', err); }
      })
      .catch((err) => settle('error', { message: err.message }));
  }

  window.RunWisePata = { isConfigured, open, _normalizeResult: normalizeResult };
})();
