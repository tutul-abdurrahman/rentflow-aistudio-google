/*
 * RentFlow — no-op service worker.
 *
 * The hosting platform injects a RELATIVE /_service-worker.js registration,
 * which 404s on subpaths (/settings/, /bills/) because it resolves against the
 * current path. Shipping this file lets the absolute registration in
 * src/main.tsx resolve on every route.
 *
 * Intentionally inert: no fetch handler, no caching, no offline behavior.
 * The app must behave exactly as it does with no worker at all.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});
