const CACHE_NAME = 'ironlog-static-v50';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=50',
  './firebase-config.js?v=50',
  './js/storage.js?v=50',
  './js/catalog-data.js?v=50',
  './js/helpers.js?v=50',
  './js/week.js?v=50',
  './js/exercises.js?v=50',
  './js/stats.js?v=50',
  './js/personal-best.js?v=50',
  './js/merge.js?v=50',
  './js/data.js?v=50',
  './js/firebase-cloud.js?v=50',
  './js/init.js?v=50',
  './data/strengthlevel-standards.json',
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
  // Never cache cross-origin Firebase requests.
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
