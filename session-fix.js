// RunWise session/logout reliability fix + password recovery routing guard.
(() => {
  const RECOVERY_KEY = 'runwise_password_recovery';
  const recoveryActive = () => sessionStorage.getItem(RECOVERY_KEY) === '1';

  const showRecovery = () => {
    if (!recoveryActive()) return false;
    const auth = document.getElementById('authScreen');
    const app = document.getElementById('app');
    const login = document.getElementById('loginForm');
    const signup = document.getElementById('signupForm');
    const reset = document.getElementById('resetForm');
    const recovery = document.getElementById('recoveryForm');
    const suspended = document.getElementById('suspendedScreen');

    if (auth) auth.classList.remove('hidden');
    if (app) app.classList.add('hidden');
    if (suspended) suspended.classList.add('hidden');
    if (login) login.classList.add('hidden');
    if (signup) signup.classList.add('hidden');
    if (reset) reset.classList.add('hidden');
    if (recovery) recovery.classList.remove('hidden');
    return true;
  };

  // Supabase creates a temporary authenticated session during password recovery.
  // Prevent that session from being treated as a normal login until the password
  // has actually been updated successfully.
  if (typeof window.boot === 'function') {
    const originalBoot = window.boot;
    window.boot = async (...args) => {
      if (showRecovery()) return;
      return originalBoot(...args);
    };
  }

  if (typeof window.showAuth === 'function') {
    const originalShowAuth = window.showAuth;
    window.showAuth = async (...args) => {
      if (showRecovery()) return;
      return originalShowAuth(...args);
    };
  }

  // Re-assert recovery UI for auth events such as SIGNED_IN / INITIAL_SESSION /
  // USER_UPDATED that can otherwise race with PASSWORD_RECOVERY and open Home.
  if (window.__sb?.auth?.onAuthStateChange) {
    window.__sb.auth.onAuthStateChange(() => {
      if (recoveryActive()) {
        setTimeout(showRecovery, 0);
        setTimeout(showRecovery, 50);
      }
    });
  }

  // Clear the recovery guard only after app.js reports a successful password update.
  const recoverySuccess = document.getElementById('recoverySuccess');
  if (recoverySuccess) {
    const clearOnSuccess = () => {
      const visible = !recoverySuccess.classList.contains('hidden');
      if (visible && /updated successfully/i.test(recoverySuccess.textContent || '')) {
        sessionStorage.removeItem(RECOVERY_KEY);
      }
    };
    new MutationObserver(clearOnSuccess).observe(recoverySuccess, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
    });
    clearOnSuccess();
  }

  // If this page loaded from a recovery link, keep the recovery screen mounted
  // immediately, even if another auth callback fired first.
  if (recoveryActive()) {
    showRecovery();
    setTimeout(showRecovery, 0);
  }

  const button = document.getElementById('signOutBtn');
  if (!button) return;

  button.onclick = async () => {
    button.disabled = true;
    try {
      sessionStorage.removeItem(RECOVERY_KEY);
      if (typeof clearCache === 'function') clearCache();
      if (typeof state !== 'undefined') {
        state.session = null;
        state.profile = null;
        state.page = 'home';
        state.bootId += 1;
        state.renderId += 1;
      }

      const app = document.getElementById('app');
      const auth = document.getElementById('authScreen');
      if (app) app.classList.add('hidden');
      if (auth) auth.classList.remove('hidden');

      const result = await sb.auth.signOut();
      if (result?.error) throw result.error;

      if (typeof showAuth === 'function') await showAuth();
    } catch (error) {
      if (typeof toast === 'function') toast(typeof friendlyError === 'function' ? friendlyError(error, 'Could not sign out.') : 'Could not sign out.');
      const app = document.getElementById('app');
      if (app) app.classList.remove('hidden');
    } finally {
      button.disabled = false;
    }
  };
})();
