/* Read the Heat — Service Worker
   Network-first with offline fallback. */

var CACHE = 'rth-offline-v1';

var PRECACHE = [
  './index.html',
  './activity.html',
  './acclimatization.html',
  './clothing.html',
  './heat-index.html',
  './measurement.html',
  './methodology.html',
  './temp-humidity.html',
  './wbgt.html',
  './shared.css',
  './shared.js',
  './lang-link.js',
  './lang-switch.js',
  './manifest.json',
  './images/read-the-heat-logo-transparent.png',
  './images/uic-public-health-logo.png',
  './images/favicon-32.png',
  './images/apple-touch-icon.png',
  './images/icon-192.png',
  './images/icon-512.png'
];

/* Install: pre-cache key pages */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* Activate: delete old caches */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* Fetch: network first, cache fallback */
self.addEventListener('fetch', function (e) {
  var req = e.request;

  /* Skip non-GET, cross-origin, .php, analytics */
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('.php')) return;
  if (/\/(data)\//i.test(url.pathname)) return;

  e.respondWith(
    fetch(req).then(function (res) {
      /* Cache a copy of successful same-origin page/asset responses */
      if (res.ok && url.origin === location.origin) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (cached) {
        return cached || new Response('You are offline.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});
