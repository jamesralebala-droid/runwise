// ============================================================================
// RunWise — payments.js
// Customer-facing Wallet & Payment Management System.
// Loaded AFTER app.js (see src/App.tsx script order). It wraps openOrderRoom
// to inject the checkout / payment instructions / verification status /
// receipt panel into order rooms, and replaces earningsView with the
// ledger-based runner wallet (available / pending / total earned /
// completed deliveries / settlements).
//
// The heavy rendering logic (paymentSectionHtml + helpers) lives in app.js
// next to the other data helpers; this file only wires DOM + RPC calls.
// ============================================================================
(() => {
  if (typeof window.openOrderRoom !== 'function' || typeof window.state === 'undefined') return;
  // `$`, `sb`, `state`, `money`, `escapeHtml`, `toast`, `setBusy`, `clearCache`,
  // `readWithRetry`, `friendlyError`, `uploadToStorage`, `renderPage`, `render`,
  // `paymentSectionHtml`, `paymentMethodName`, `paymentRecipient`,
  // `fetchMyOrderRooms` are all declared at app.js top-level in the shared
  // global scope, so they are available here without re-declaration.

  // -------------------------------------------------------------------------
  // Order-room payment panel injection
  // -------------------------------------------------------------------------
  let refreshTimer = null;

  async function fetchPaymentContext(roomId) {
    const [paymentResult, methodsResult, settingsResult, roomResult] = await Promise.all([
      readWithRetry(() => sb.from('payments').select('*').eq('order_room_id', roomId).order('created_at', { ascending: false }).limit(1).maybeSingle()),
      readWithRetry(() => sb.from('payment_methods').select('*').eq('is_active', true).order('sort_order')),
      readWithRetry(() => sb.from('platform_settings').select('payment_commission_pct').eq('id', 1).maybeSingle()),
      readWithRetry(() => sb.from('order_rooms').select('customer_id, runner_id, escrow_transactions(*)').eq('id', roomId).single()),
    ]);
    const room = roomResult.data;
    if (!room) return null;
    return {
      payment: paymentResult.data,
      methods: methodsResult.data || [],
      commissionPct: settingsResult.data?.payment_commission_pct ?? 0.15,
      room,
      esc: room.escrow_transactions,
      isCustomer: room.customer_id === state.profile.id,
      isDisputed: room.escrow_transactions?.status === 'disputed',
    };
  }

  function findEscrowCard(detailHost) {
    if (!detailHost) return null;
    return Array.from(detailHost.querySelectorAll('.card')).find(c =>
      c.querySelector('h3')?.textContent === 'Escrow status'
    ) || null;
  }

  function renderPanel(detailHost, escrowCard, ctx) {
    const html = paymentSectionHtml({
      payment: ctx.payment,
      methods: ctx.methods,
      esc: ctx.esc,
      isCustomer: ctx.isCustomer,
      isDisputed: ctx.isDisputed,
      commissionPct: ctx.commissionPct,
    });
    // Replace any previous panel
    detailHost.querySelectorAll('[data-payment-panel]').forEach(el => el.remove());
    if (!html) return;
    const wrap = document.createElement('div');
    wrap.dataset.paymentPanel = '1';
    wrap.innerHTML = html;
    escrowCard.insertAdjacentElement('afterend', wrap);
    bindPaymentPanel(ctx);
  }

  async function injectPaymentPanel(roomId) {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    const detailHost = document.getElementById('roomDetail');
    const escrowCard = findEscrowCard(detailHost);
    if (!detailHost || !escrowCard) return;

    // Remove the legacy demo "Fund Escrow" button + its policy checkboxes —
    // the real checkout flow replaces it.
    const fundBtn = document.getElementById('fundEscrow');
    if (fundBtn) {
      const box = document.getElementById('acceptPaymentsPolicy')?.closest('.declaration-box');
      if (box) box.remove();
      fundBtn.remove();
    }

    const ctx = await fetchPaymentContext(roomId);
    if (!ctx) return;
    renderPanel(detailHost, escrowCard, ctx);

    // Light polling so "awaiting verification" flips to the receipt without
    // the customer needing to refresh, and runners see status changes.
    refreshTimer = setInterval(async () => {
      const host = document.getElementById('roomDetail');
      const card = findEscrowCard(host);
      if (!host || !card || state.openOrderRoom !== roomId) {
        clearInterval(refreshTimer);
        refreshTimer = null;
        return;
      }
      const next = await fetchPaymentContext(roomId);
      if (!next) return;
      const nextHtml = paymentSectionHtml({
        payment: next.payment,
        methods: next.methods,
        esc: next.esc,
        isCustomer: next.isCustomer,
        isDisputed: next.isDisputed,
        commissionPct: next.commissionPct,
      });
      const existing = host.querySelector('[data-payment-panel]');
      if (!nextHtml && existing) { existing.remove(); return; }
      if (nextHtml && existing) {
        const wrap = document.createElement('div');
        wrap.dataset.paymentPanel = '1';
        wrap.innerHTML = nextHtml;
        existing.replaceWith(wrap);
        bindPaymentPanel(next);
      } else if (nextHtml && !existing) {
        renderPanel(host, card, next);
      }
    }, 12000);
  }

  // -------------------------------------------------------------------------
  // Payment panel interactions
  // -------------------------------------------------------------------------
  function bindPaymentPanel(ctx) {
    const feeInput = document.getElementById('deliveryFeeInput');
    if (feeInput) {
      const update = () => {
        const fee = Math.max(parseFloat(feeInput.value) || 0, 0);
        const commission = Math.round(fee * (Number(ctx.commissionPct) || 0.15) * 100) / 100;
        const runner = Math.max(fee - commission, 0);
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = money(val); };
        set('pbFee', fee);
        set('pbCommission', commission);
        set('pbTotal', fee);
        set('pbRunner', runner);
      };
      feeInput.addEventListener('input', update);
      update();
    }

    const createBtn = document.getElementById('createPaymentBtn');
    if (createBtn) {
      createBtn.onclick = async () => {
        const accepted = document.getElementById('acceptRecipientCheck');
        if (accepted && !accepted.checked) {
          toast('Please accept the payment recipient notice before continuing.');
          return;
        }
        const fee = parseFloat(document.getElementById('deliveryFeeInput')?.value);
        if (!fee || fee <= 0) { toast('Enter a valid delivery fee.'); return; }
        const method = document.getElementById('paymentMethodSelect')?.value || 'orange_money';
        setBusy(createBtn, true, 'Creating…');
        const { error } = await sb.rpc('create_order_payment', {
          p_order_room_id: ctx.room.id,
          p_delivery_fee: fee,
          p_payment_method: method,
        });
        if (error) { toast(friendlyError(error)); setBusy(createBtn, false); return; }
        clearCache('room-payment:');
        toast('Payment created. Follow the instructions below to complete your payment.');
        openOrderRoom(ctx.room.id);
      };
    }

    // Pay with Pata — only rendered when Pata is configured (see app.js
    // paymentSectionHtml). Creates the order payment as a 'pata' payment, then
    // hands over to the Pata checkout widget. On success the Pata transaction
    // reference is submitted automatically so the existing admin-verification
    // pipeline (verify -> escrow funded -> ledger) runs unchanged. If the
    // widget is unreachable (not live yet) the user is told to use the manual
    // flow, which remains fully available.
    const pataBtn = document.getElementById('pataPayBtn');
    if (pataBtn && window.RunWisePata) {
      pataBtn.onclick = async () => {
        const accepted = document.getElementById('acceptRecipientCheck');
        if (accepted && !accepted.checked) {
          toast('Please accept the payment recipient notice before continuing.');
          return;
        }
        const fee = parseFloat(document.getElementById('deliveryFeeInput')?.value);
        if (!fee || fee <= 0) { toast('Enter a valid delivery fee.'); return; }
        setBusy(pataBtn, true, 'Preparing…');
        const { error } = await sb.rpc('create_order_payment', {
          p_order_room_id: ctx.room.id,
          p_delivery_fee: fee,
          p_payment_method: 'pata',
        });
        if (error) { toast(friendlyError(error)); setBusy(pataBtn, false); return; }
        clearCache('room-payment:');
        // Re-fetch the payment so we can pass its order number as the widget
        // reference (that is what RunWise will reconcile against).
        const fresh = await fetchRoomPayment(ctx.room.id);
        setBusy(pataBtn, false);
        const orderNo = fresh?.order_no || ctx.room.id.slice(0, 8).toUpperCase();
        window.RunWisePata.open({
          amount: fee,
          reference: orderNo,
          description: `RunWise order ${orderNo}`,
          onSuccess: async (payload) => {
            const ref = payload && payload.reference;
            if (!ref) {
              toast('Payment received, but no transaction reference came back. Submit it manually below.');
              openOrderRoom(ctx.room.id);
              return;
            }
            const { error: refError } = await sb.rpc('submit_payment_reference', {
              p_payment_id: fresh?.id,
              p_reference_number: ref,
              p_amount_reported: Number(payload.amount) || fee,
              p_screenshot_url: null,
              p_paid_at: new Date().toISOString(),
              p_notes: 'Paid via Pata checkout',
            });
            if (refError) {
              toast('Payment received. We could not submit the reference automatically: ' + friendlyError(refError));
            } else {
              toast('Pata payment received. Status: PAYMENT VERIFICATION REQUIRED — RunWise will verify it shortly.');
            }
            openOrderRoom(ctx.room.id);
          },
          onError: (err) => {
            const msg = err && err.message === '__manual__'
              ? 'Pata closed. You can complete the payment manually below.'
              : (err && err.message) || 'Pata payment was not completed. Use the manual option below.';
            toast(msg);
            openOrderRoom(ctx.room.id);
          },
        });
      };
    }

    const refForm = document.getElementById('paymentReferenceForm');
    if (refForm) {
      refForm.onsubmit = async e => {
        e.preventDefault();
        const button = e.submitter;
        setBusy(button, true, 'Submitting…');
        const errBox = document.getElementById('paymentFormError');
        if (errBox) errBox.textContent = '';
        const f = new FormData(refForm);
        const reference = String(f.get('reference') || '').trim();
        if (!reference) {
          if (errBox) errBox.textContent = 'Please enter the Orange Money transaction/reference number.';
          setBusy(button, false);
          return;
        }
        let screenshotPath = null;
        const file = f.get('screenshot');
        if (file && file.size) {
          try {
            screenshotPath = await uploadToStorage(file, 'payment-proofs');
          } catch (err) {
            if (errBox) errBox.textContent = 'Screenshot upload failed: ' + friendlyError(err);
            setBusy(button, false);
            return;
          }
        }
        const paidAt = f.get('paid_at') ? new Date(f.get('paid_at')).toISOString() : null;
        const { error } = await sb.rpc('submit_payment_reference', {
          p_payment_id: ctx.payment.id,
          p_reference_number: reference,
          p_amount_reported: parseFloat(f.get('amount')) || null,
          p_screenshot_url: screenshotPath,
          p_paid_at: paidAt,
          p_notes: null,
        });
        if (error) {
          if (errBox) errBox.textContent = friendlyError(error);
          setBusy(button, false);
          return;
        }
        clearCache('room-payment:');
        toast('Payment details submitted. Status: PAYMENT VERIFICATION REQUIRED. RunWise will verify your payment shortly.');
        openOrderRoom(ctx.room.id);
      };
    }

    const printBtn = document.getElementById('printReceiptBtn');
    if (printBtn && ctx.payment) {
      printBtn.onclick = () => printReceipt(ctx);
    }
  }

  // -------------------------------------------------------------------------
  // Receipt printing (opens a clean printable window)
  // -------------------------------------------------------------------------
  function printReceipt(ctx) {
    const p = ctx.payment;
    if (!p) return;
    const methodName = paymentMethodName(ctx.methods, p.payment_method);
    const recipient = paymentRecipient(ctx.methods, p.payment_method, p.recipient_name);
    const w = window.open('', '_blank', 'width=520,height=720');
    if (!w) { toast('Allow pop-ups to print your receipt.'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8">
      <title>RunWise Receipt ${p.order_no}</title>
      <style>
        body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:32px auto;padding:24px;color:#16342b}
        .head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #123F34;padding-bottom:12px;margin-bottom:16px}
        .head b{font-size:22px;letter-spacing:1px}
        .head span{font-size:12px;color:#68756e}
        .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px dashed #e2e8e4;font-size:14px}
        .row b{font-weight:600}
        .total{font-size:17px;font-weight:700;background:#f3f8f5;padding:12px;border-radius:8px;margin:14px 0}
        .note{font-size:11.5px;color:#68756e;line-height:1.55;margin-top:16px;border-top:1px solid #e2e8e4;padding-top:12px}
        .actions{display:flex;gap:8px;margin-top:16px}
        .actions button{flex:1;padding:10px;border:none;border-radius:8px;font-weight:600;cursor:pointer}
        .print{background:#123F34;color:#fff}
        .close{background:#eef3ef;color:#16342b}
        @media print{.actions{display:none}}
      </style></head><body>
      <div class="head"><b>RUNWISE</b><span>Payment Receipt</span></div>
      <div class="row"><span>Order</span><b>${p.order_no}</b></div>
      <div class="row"><span>Amount paid</span><b>${money(p.amount_reported || p.total_amount)}</b></div>
      <div class="row"><span>Payment method</span><b>${methodName}</b></div>
      <div class="row"><span>Payment reference</span><b>${escapeHtml(p.reference_number || '—')}</b></div>
      <div class="row"><span>Payment status</span><b>PAID</b></div>
      <div class="row"><span>RunWise commission</span><b>${money(p.commission)}</b></div>
      <div class="row"><span>Runner allocation</span><b>${money(p.runner_earnings)}</b></div>
      <div class="total">Total paid: ${money(p.amount_reported || p.total_amount)}</div>
      <div class="note">Payment transparency: During the RunWise launch period, Orange Money payments may display <b>${recipient}</b> as the recipient while RunWise completes its official merchant/payment integration.</div>
      <div class="actions"><button class="print" onclick="window.print()">Print / Save PDF</button><button class="close" onclick="window.close()">Close</button></div>
      </body></html>`);
    w.document.close();
    w.focus();
  }

  // -------------------------------------------------------------------------
  // Wrap openOrderRoom: run the original renderer, then inject the panel.
  // -------------------------------------------------------------------------
  const originalOpenOrderRoom = window.openOrderRoom;
  window.openOrderRoom = async function (roomId) {
    const result = await originalOpenOrderRoom(roomId);
    try { await injectPaymentPanel(roomId); } catch (err) { console.warn('Payment panel injection failed:', err); }
    return result;
  };

  // -------------------------------------------------------------------------
  // My Orders list: show RW-XXXX order number + payment status per room.
  // -------------------------------------------------------------------------
  const originalOrdersView = window.ordersView;
  window.ordersView = async function () {
    const html = await originalOrdersView();
    try {
      const rooms = await fetchMyOrderRooms();
      if (!rooms.length) return html;
      const payments = await sb.from('payments')
        .select('order_no, order_room_id, status, total_amount')
        .in('order_room_id', rooms.map(r => r.id))
        .order('created_at', { ascending: false });
      const byRoom = {};
      (payments.data || []).forEach(p => { if (!byRoom[p.order_room_id]) byRoom[p.order_room_id] = p; });
      // Patch each card: prepend the order number and payment status line.
      return html.replace(/<div class="card"><h3>Order ([0-9a-f]{8})<\/h3>/g, (_, id) => {
        const room = rooms.find(r => r.id.startsWith(id));
        const p = room ? byRoom[room.id] : null;
        const payBadge = p
          ? `<p>Payment: <span class="badge ${p.status === 'paid' ? 'success' : p.status === 'rejected' ? 'danger' : 'warning'}">${escapeHtml(p.status === 'payment_verification_required' ? 'PAYMENT VERIFICATION REQUIRED' : p.status.toUpperCase())}</span> · ${escapeHtml(p.order_no)} · ${money(p.total_amount)}</p>`
          : '';
        return `<div class="card"><h3>Order ${id}</h3>${payBadge}`;
      });
    } catch (err) {
      console.warn('Payment badges not applied to orders list:', err);
      return html;
    }
  };

  // -------------------------------------------------------------------------
  // Runner earnings view: ledger-based wallet summary + settlements.
  // -------------------------------------------------------------------------
  window.earningsView = async function () {
    const summaryRes = await readWithRetry(() => sb.rpc('get_runner_wallet_summary', { p_runner_id: state.profile.id }));
    const summary = summaryRes.data;
    if (!summary) return '<div class="empty">Could not load your earnings.</div>';

    const settlementsRes = await readWithRetry(() => sb.from('settlements').select('*').eq('runner_id', state.profile.id).order('created_at', { ascending: false }).limit(30));
    const settlements = settlementsRes.data || [];

    const stat = (label, value, cls = '') => `<div class="card stat"><span>${label}</span><strong class="${cls}">${value}</strong></div>`;
    const rows = settlements.length
      ? settlements.map(s => `<div class="order">
          <span>${money(s.amount)} — <span class="badge ${s.status === 'paid' ? 'success' : s.status === 'rejected' ? 'danger' : 'warning'}">${escapeHtml(s.status.toUpperCase())}</span>${s.payment_method ? ' · ' + escapeHtml(s.payment_method.replace(/_/g, ' ')) : ''}${s.reference_number ? ' · Ref ' + escapeHtml(s.reference_number) : ''}</span>
          <span class="price">${s.paid_at ? new Date(s.paid_at).toLocaleDateString() : new Date(s.created_at).toLocaleDateString()}</span>
        </div>`).join('')
      : '<div class="empty">No settlements yet.</div>';

    return `<div class="grid g4 stats">
        ${stat('Available', money(summary.available), 'color:var(--success)')}
        ${stat('Pending', money(summary.pending))}
        ${stat('Total earned', money(summary.total_earned))}
        ${stat('Completed deliveries', summary.completed_deliveries)}
      </div>
      <div class="section"><h3>Request settlement</h3><p class="muted">Settlement requests are reviewed and paid out by RunWise. Available earnings are shown above.</p></div>
      <div class="card"><form id="settlementForm" class="grid2">
        <label>Amount<input type="number" name="amount" min="1" step="0.01" required></label>
        <label>Method<select name="method"><option value="orange_money">Orange Money</option><option value="myzaka">MyZaka</option><option value="bank_transfer">Bank transfer</option></select></label>
        <button class="primary full">Request Settlement</button>
      </form></div>
      <div class="section"><h3>Withdrawals & settlements</h3></div>
      <div class="card">${rows}</div>`;
  };

  // -------------------------------------------------------------------------
  // Admin settings: expose the payment commission rate (decimal, e.g. 0.15).
  // The settings form saves all named fields generically, so appending the
  // input is enough.
  // -------------------------------------------------------------------------
  const originalAdminSettingsView = window.adminSettingsView;
  window.adminSettingsView = async function () {
    const html = await originalAdminSettingsView();
    if (!html) return html;
    const commissionInput = `<label>Payment commission (decimal — e.g. 0.15 = 15% of delivery fee)<input type="number" step="0.01" min="0" max="1" name="payment_commission_pct" value=""></label>`;
    const marker = '<label>Max shopping value (BWP)';
    if (html.includes(marker)) {
      // Pre-fill from current settings by reading the row at render time.
      const settingsRes = await readWithRetry(() => sb.from('platform_settings').select('payment_commission_pct').eq('id', 1).maybeSingle());
      const current = settingsRes.data?.payment_commission_pct ?? 0.15;
      const filled = commissionInput.replace('value=""', `value="${current}"`);
      return html.replace(marker, filled + marker);
    }
    return html;
  };

  // Bind the settlement request form (bindPage runs before this module's
  // view replaces the content, so bind directly after render via delegation).
  document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!form || form.id !== 'settlementForm') return;
    e.preventDefault();
    const button = form.querySelector('button[type=submit], button.primary') || e.submitter;
    if (button) setBusy(button, true, 'Submitting…');
    const f = new FormData(form);
    const amount = parseFloat(f.get('amount'));
    const method = f.get('method') || 'orange_money';
    if (!amount || amount <= 0) {
      if (button) setBusy(button, false);
      toast('Enter a valid amount.');
      return;
    }
    const { error } = await sb.rpc('request_settlement', { p_amount: amount, p_method: method });
    if (button) setBusy(button, false);
    if (error) { toast(friendlyError(error)); return; }
    clearCache('settlements:');
    toast('Settlement requested. RunWise will review and pay it out.');
    renderPage();
  });

  // Also handle a "View earnings" shortcut if present anywhere.
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-page="earnings"]');
    if (el) { state.page = 'earnings'; render(); }
  });

  // Expose cleanup for logout — app.js calls this before signOut.
  window.__clearPaymentPolling = () => { if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } };
})();
