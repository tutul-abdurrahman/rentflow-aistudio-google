import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './theme/tokens.css';
import './theme/print.css';
// Screen 22 print rules. Must stay after print.css (the 04/21 sheet rules);
// it is loaded last in the app entry so it never weakens those.
import './theme/print-summary.css';

/**
 * The hosting platform injects a RELATIVE /_service-worker.js registration,
 * which 404s on subpaths (/settings/, /bills/) because it resolves against the
 * current path. Registering the no-op worker ourselves with an ABSOLUTE path
 * fixes that. Production-only, feature-detected, and error-swallowing — it can
 * never break the app.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/_service-worker.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
