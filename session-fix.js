// RunWise session/logout reliability fix.
(() => {
  const button = document.getElementById('signOutBtn');
  if (!button) return;

  button.onclick = async () => {
    button.disabled = true;
    try {
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