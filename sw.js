const CACHE_NAME = 'ironlog-static-v26';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=26',
  './cloud-config.js?v=26',
  './js/storage.js?v=26',
  './js/catalog-data.js?v=26',
  './js/helpers.js?v=26',
  './js/week.js?v=26',
  './js/exercises.js?v=26',
  './js/stats.js?v=26',
  './js/data.js?v=26',
  './js/cloud.js?v=26',
  './js/init.js?v=26',
  './manifest.webmanifest',
  './icons/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Never cache cross-origin requests (e.g. Supabase API responses) —
  // serving a stale encrypted profile offline would corrupt sync state.
  if (new URL(event.request.url).origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, {cache:'no-store'})
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request, {cache:'no-store'})
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
