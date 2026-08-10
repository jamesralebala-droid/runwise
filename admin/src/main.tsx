import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

// GitHub Pages has no SPA fallback, so direct hits on client-side routes
// (e.g. /admin/waitlist) are served the site's root 404.html, which stashes
// the intended URL in sessionStorage and bounces to the admin entry point.
// Restore that URL before the router reads window.location so wouter renders
// the right route.
try {
  const redirect = sessionStorage.getItem('runwiseAdminRedirect');
  if (redirect) {
    sessionStorage.removeItem('runwiseAdminRedirect');
    window.history.replaceState(null, '', redirect);
  }
} catch {
  // sessionStorage unavailable (private mode) — start at the dashboard
}

createRoot(document.getElementById('root')!).render(<App />);
