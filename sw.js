const CACHE_NAME = 'pippi-voice-v1.2.1';
const ASSETS = [
  './index.html?v=1.2.1',
  './src/style.css?v=1.2.1',
  './src/app.js?v=1.2.1',
  './src/utils.js?v=1.2.1',
  './src/events.js?v=1.2.1',
  './src/errors.js?v=1.2.1',
  './src/speech.js?v=1.2.1',
  './src/ai.js?v=1.2.1',
  './manifest.json?v=1.2.1'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Cleaning old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
