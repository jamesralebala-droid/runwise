import { useEffect, useRef } from 'react';

// The existing RunWise SPA (app.js) expects this exact HTML structure in the DOM.
// We render it once on mount and never re-render, because app.js takes over
// DOM manipulation from that point. React will not touch the DOM after mount.
const APP_HTML = `<!-- TOAST -->
<div id="toast" class="toast" role="status" aria-live="polite"></div>

<!-- AUTH SCREEN -->
<div id="authScreen" class="auth-wrap">
  <p class="tag">Botswana &bull; South Africa &bull; Zimbabwe &bull; Zambia</p>
  <h1>RunWise</h1>
  <div class="auth-tabs">
    <button id="tabLogin" class="active">Log in</button>
    <button id="tabSignup">Sign up</button>
  </div>

  <form id="loginForm">
    <div class="field"><label>Email</label><input type="email" name="email" required></div>
    <div class="field"><label>Password</label><input type="password" name="password" required></div>
    <div class="forgot-row"><button type="button" id="forgotBtn" class="forgot-btn">Forgot password?</button></div>
    <button class="primary" style="width:100%">Log in</button>
    <div class="error-msg" id="loginError"></div>
  </form>

  <div id="resetForm" class="hidden">
    <p class="reset-intro">Enter your email address and we&apos;ll send you a link to reset your password.</p>
    <div class="field"><label>Email</label><input type="email" id="resetEmail" required></div>
    <button class="primary" id="sendResetBtn" style="width:100%">Send reset link</button>
    <button type="button" id="backToLoginBtn" class="secondary" style="width:100%;margin-top:8px">&larr; Back to login</button>
    <div class="error-msg" id="resetError"></div>
    <div class="success-msg hidden" id="resetSuccess"></div>
  </div>

  <div id="recoveryForm" class="hidden">
    <p class="reset-intro">Choose a new password for your RunWise account.</p>
    <div class="field"><label>New password (min 6 characters)</label><input type="password" id="recoveryPassword" required minlength="6"></div>
    <div class="field"><label>Confirm new password</label><input type="password" id="recoveryConfirm" required minlength="6"></div>
    <button class="primary" id="recoverySubmitBtn" style="width:100%">Update password</button>
    <div class="error-msg" id="recoveryError"></div>
    <div class="success-msg hidden" id="recoverySuccess"></div>
  </div>

  <form id="signupForm" class="hidden">
    <div class="field"><label>Full name</label><input type="text" name="full_name" required></div>
    <div class="field"><label>Email</label><input type="email" name="email" required></div>
    <div class="field"><label>Password (min 6 characters)</label><input type="password" name="password" required minlength="6"></div>
    <div class="field">
      <label>I want to sign up as</label>
      <div class="role-pick">
        <button type="button" data-role="customer" class="active">Customer</button>
        <button type="button" data-role="runner">Runner</button>
      </div>
      <input type="hidden" name="role" value="customer">
    </div>
    <div class="field legal-check">
      <label><input type="checkbox" name="accept_terms" required><span>I have read and agree to the <a href="#legal/terms" target="_blank" class="legal-link">RunWise Terms and Conditions</a>.</span></label>
    </div>
    <div class="field legal-check">
      <label><input type="checkbox" name="accept_privacy" required><span>I have read and acknowledge the <a href="#legal/privacy" target="_blank" class="legal-link">RunWise Privacy Policy</a>.</span></label>
    </div>
    <button class="primary" style="width:100%">Create account</button>
    <div class="error-msg" id="signupError"></div>
  </form>
</div>

<!-- LEGAL DOCUMENT VIEWER -->
<div id="legalScreen" class="hidden">
  <div class="legal-shell">
    <div class="legal-topbar">
      <button id="legalBack" class="secondary">&larr; Back</button>
      <button id="legalPrint" class="secondary">Print / Save as PDF</button>
    </div>
    <div class="legal-body">
      <div class="legal-toc" id="legalToc"></div>
      <div class="legal-doc" id="legalDoc"></div>
    </div>
  </div>
</div>

<!-- MAIN APP -->
<div id="app" class="hidden">
  <aside class="sidebar">
    <div class="brand">
      <img src="runwise-logo.svg" alt="RunWise">
      <div><strong>RunWise</strong><span>Your Cart. Our Run.</span></div>
    </div>
    <nav id="nav"></nav>
    <button id="modeBtn" class="mode"></button>
    <button id="signOutBtn" class="signout">Sign out</button>
  </aside>
  <main>
    <header class="topbar">
      <div><small id="portalName"></small><h1 id="pageTitle"></h1></div>
      <div class="actions">
        <button id="primaryAction" class="primary"></button>
      </div>
    </header>
    <section id="content"></section>
  </main>
</div>

<!-- POST REQUEST MODAL -->
<div id="requestModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="requestModalTitle">
  <button class="modal-backdrop" type="button" aria-label="Close request form" data-close-request></button>
  <div class="modal-panel">
    <div class="modal-head">
      <div>
        <small>NEW RUNWISE REQUEST</small>
        <h2 id="requestModalTitle">What should a runner carry?</h2>
        <p>Give runners enough detail to understand the job and match your route.</p>
      </div>
      <button class="icon-btn" type="button" aria-label="Close" data-close-request>&times;</button>
    </div>

    <form id="requestForm">
      <fieldset class="request-types">
        <legend>Choose a request type</legend>
        <label><input type="radio" name="type" value="shopping" required><span><b>&#x1F6CD; Shopping</b><small>Buy items for me</small></span></label>
        <label><input type="radio" name="type" value="parcel"><span><b>&#x1F4E6; Parcel</b><small>Carry a package</small></span></label>
        <label><input type="radio" name="type" value="documents"><span><b>&#x1F4C4; Documents</b><small>Deliver paperwork</small></span></label>
        <label><input type="radio" name="type" value="medicine"><span><b>&#x1F48A; Medicine</b><small>Collect medicine</small></span></label>
        <label><input type="radio" name="type" value="gift"><span><b>&#x1F381; Gift</b><small>Send a gift</small></span></label>
        <label><input type="radio" name="type" value="business_stock"><span><b>&#x1F3EA; Business stock</b><small>Move shop supplies</small></span></label>
        <label><input type="radio" name="type" value="large_cargo"><span><b>&#x1F69A; Large cargo</b><small>Carry a bulky load</small></span></label>
      </fieldset>

      <div class="route-fields">
        <label>Pickup city
          <input name="from_city" list="runwiseCities" autocomplete="address-level2" placeholder="e.g. Gaborone" required>
        </label>
        <div class="route-arrow" aria-hidden="true">&rarr;</div>
        <label>Delivery city
          <input name="to_city" list="runwiseCities" autocomplete="address-level2" placeholder="e.g. Serowe" required>
        </label>
      </div>

      <div class="grid2 request-details">
        <label>Estimated item value (BWP)
          <input type="number" name="estimated_value" min="0" step="0.01" inputmode="decimal" placeholder="e.g. 300" required>
          <small>Enter 0 if the item is already paid for.</small>
        </label>
        <label>What must the runner know?
          <textarea name="details" maxlength="500" rows="4" placeholder="Items, size, quantity, collection instructions or deadline"></textarea>
          <small><span id="requestDetailsCount">0</span>/500 characters</small>
        </label>
      </div>

      <div class="grid2 request-details">
        <label>Pickup landmark (optional)
          <input name="from_landmark" placeholder="e.g. next to the clinic">
        </label>
        <label>Drop-off landmark (optional)
          <input name="to_landmark" placeholder="e.g. blue gate">
        </label>
        <label class="full">Written directions (optional)
          <textarea name="written_directions" rows="2" placeholder="Helpful directions if the location is difficult to map"></textarea>
        </label>
      </div>

      <div class="declaration-box request-declarations">
        <div class="legal-check"><label><input type="checkbox" name="d1" required><span>I have accurately described the item, quantity, and value.</span></label></div>
        <div class="legal-check"><label><input type="checkbox" name="d2" required><span>I own the item, or have legal authority to send it.</span></label></div>
        <div class="legal-check"><label><input type="checkbox" name="d3" required><span>The item is not prohibited or unlawfully restricted. See the <a href="#legal/prohibited_items" target="_blank" class="legal-link">Prohibited and Restricted Items Policy</a>.</span></label></div>
        <div class="legal-check"><label><input type="checkbox" name="d4" required><span>The item is packaged safely and appropriately.</span></label></div>
        <div class="legal-check"><label><input type="checkbox" name="cross_border"><span>This is a cross-border request.</span></label></div>
        <div id="crossBorderChecks" class="hidden">
          <div class="legal-check"><label><input type="checkbox" name="cb1"><span>I understand that customs duties, taxes, inspections, delays, seizure, and documentation requirements may apply. See the <a href="#legal/cross_border" target="_blank" class="legal-link">Cross-Border Delivery Policy</a>.</span></label></div>
          <div class="legal-check"><label><input type="checkbox" name="cb2"><span>I accept responsibility for truthful customs information and lawful import and export of the item.</span></label></div>
        </div>
      </div>

      <div id="requestError" class="form-error" role="alert"></div>
      <div class="modal-actions">
        <button class="secondary" type="button" data-close-request>Cancel</button>
        <button id="submitRequestBtn" class="primary" type="submit">Post Request</button>
      </div>
    </form>
  </div>
</div>

<datalist id="runwiseCities">
  <option value="Gaborone"><option value="Francistown"><option value="Maun"><option value="Serowe">
  <option value="Mahalapye"><option value="Palapye"><option value="Lobatse"><option value="Kanye">
  <option value="Molepolole"><option value="Kasane"><option value="Tlokweng"><option value="Ramotswa">
  <option value="Johannesburg"><option value="Pretoria"><option value="Polokwane"><option value="Cape Town">
  <option value="Harare"><option value="Bulawayo"><option value="Lusaka"><option value="Livingstone">
</datalist>`;

function App() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Load the existing RunWise JS files in order
    const scripts = ['config.js', 'app.js', 'legal-v11.js', 'session-fix.js', 'notification-system.js'];
    let loaded = 0;
    scripts.forEach((src) => {
      const s = document.createElement('script');
      s.src = '/' + src;
      s.onload = () => {
        loaded++;
        if (loaded === scripts.length) {
          document.dispatchEvent(new Event('runwise-ready'));
          // Initialize notifications after a short delay to let everything settle
          setTimeout(() => {
            if (window.RunWiseNotificationSystem) {
              window.RunWiseNotificationSystem.init();
              // Re-init after auth is ready (listen for session)
            }
          }, 500);
        }
      };
      s.onerror = () => {
        console.error('Failed to load script:', src);
      };
      document.body.appendChild(s);
    });
  }, []);

  return (
    <div
      id="runwise-shell"
      dangerouslySetInnerHTML={{ __html: APP_HTML }}
      style={{ all: 'initial' }}
    />
  );
}

export default App;
