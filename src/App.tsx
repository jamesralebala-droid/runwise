import { useEffect, useRef } from 'react';

// Globals shared with the vanilla RunWise scripts (loaded via <script> tags).
declare global {
  interface Window {
    RUNWISE_BASE?: string;
    RunWiseNotificationSystem?: {
      init(): void;
    };
  }
}

// Brand identity is rendered inline (mark + wordmark) so it is always crisp:
// webfonts apply to HTML text and inline SVG paths never fall back to Arial.

// The existing RunWise SPA (app.js) expects this exact HTML structure in the DOM.
// We render it once on mount and never re-render, because app.js takes over
// DOM manipulation from that point. React will not touch the DOM after mount.
const APP_HTML = `<!-- TOAST -->
<div id="toast" class="toast" role="status" aria-live="polite"></div>

<!-- AUTH SCREEN -->
<div id="authScreen" class="auth-wrap">
  <p class="tag">Botswana &bull; South Africa &bull; Zimbabwe &bull; Zambia</p>
  <div class="auth-brand">
    <svg class="auth-mark" viewBox="112 30 204 108" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <g fill="#123F34" transform="translate(234 83) scale(0.9373) translate(-85.950 36.000)"><path d="M20.6 0L7 0L7-72L37.4-72Q38.5-72 40.2-71.9Q42-71.9 43.4-71.6Q49.9-70.6 54-67.4Q58.1-64.1 60.1-59.2Q62-54.2 62-48.2Q62-39.2 57.5-32.7Q53-26.3 43.4-24.8L37.4-24.4L20.6-24.4L20.6 0M63 0L47.6 0L33.4-29.3L47.4-32L63 0M20.6-59.3L20.6-37.1L36.8-37.1Q37.9-37.1 39.1-37.2Q40.4-37.3 41.4-37.6Q44.2-38.4 45.7-40.1Q47.2-41.9 47.7-44.1Q48.3-46.2 48.3-48.2Q48.3-50.2 47.7-52.3Q47.2-54.5 45.7-56.3Q44.2-58.1 41.4-58.8Q40.4-59.1 39.1-59.2Q37.9-59.3 36.8-59.3"/></g>
      <g fill="#A9802F" transform="translate(234 83) scale(0.9373) translate(-85.950 36.000)"><path d="M102.5 0L89.1 0L68-72L82.3-72L95.8-22.5L109.3-71.9L123.6-72L137.1-22.5L150.6-72L164.9-72L143.8 0L130.4 0L116.5-48.6"/></g>
      <g stroke="#123F34" stroke-width="8" stroke-linecap="round" fill="none">
        <path d="M118 60 L150 60"/>
        <path d="M126 78 L150 78"/>
        <path d="M118 96 L150 96"/>
      </g>
    </svg>
    <span class="auth-wordmark">RUN<span>WISE</span></span>
    <span class="auth-tagline">Your Cart. Our Run.</span>
  </div>
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
      <svg class="brand-mark" viewBox="112 30 204 108" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <g fill="#F2EFE5" transform="translate(234 83) scale(0.9373) translate(-85.950 36.000)"><path d="M20.6 0L7 0L7-72L37.4-72Q38.5-72 40.2-71.9Q42-71.9 43.4-71.6Q49.9-70.6 54-67.4Q58.1-64.1 60.1-59.2Q62-54.2 62-48.2Q62-39.2 57.5-32.7Q53-26.3 43.4-24.8L37.4-24.4L20.6-24.4L20.6 0M63 0L47.6 0L33.4-29.3L47.4-32L63 0M20.6-59.3L20.6-37.1L36.8-37.1Q37.9-37.1 39.1-37.2Q40.4-37.3 41.4-37.6Q44.2-38.4 45.7-40.1Q47.2-41.9 47.7-44.1Q48.3-46.2 48.3-48.2Q48.3-50.2 47.7-52.3Q47.2-54.5 45.7-56.3Q44.2-58.1 41.4-58.8Q40.4-59.1 39.1-59.2Q37.9-59.3 36.8-59.3"/></g>
      <g fill="#E0BE6A" transform="translate(234 83) scale(0.9373) translate(-85.950 36.000)"><path d="M102.5 0L89.1 0L68-72L82.3-72L95.8-22.5L109.3-71.9L123.6-72L137.1-22.5L150.6-72L164.9-72L143.8 0L130.4 0L116.5-48.6"/></g>
      <g stroke="#F2EFE5" stroke-width="8" stroke-linecap="round" fill="none">
        <path d="M118 60 L150 60"/>
        <path d="M126 78 L150 78"/>
        <path d="M118 96 L150 96"/>
      </g>
    </svg>
      <span class="brand-text">
        <strong>RUNWISE</strong>
        <span>Your Cart. Our Run.</span>
      </span>
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

    // Load the existing RunWise JS files in order. They live beside the built
    // index.html, so resolve them against the Vite base — this keeps the app
    // working on any deploy path (Vercel root domain or GitHub Pages subpath).
    const scriptBase = import.meta.env.BASE_URL || '/';
    window.RUNWISE_BASE = scriptBase;

    // Base-aware favicon (RunWise mark) so /app is branded on any deploy path.
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/svg+xml';
    favicon.href = scriptBase + 'runwise-mark.svg';
    document.head.appendChild(favicon);
    const scripts = ['config.js', 'app.js', 'legal-v11.js', 'session-fix.js', 'notification-system.js', 'pata.js', 'payments.js'];
    let loaded = 0;
    scripts.forEach((src) => {
      const s = document.createElement('script');
      s.src = scriptBase + src;
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
