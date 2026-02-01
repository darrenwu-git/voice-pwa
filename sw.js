const CACHE_NAME = 'pippi-voice-v1.3.1';
const ASSETS = [
  './index.html?v=1.3.1',
  './src/style.css?v=1.3.1',
  './src/app.js?v=1.3.1',
  './src/utils.js?v=1.3.1',
  './src/events.js?v=1.3.1',
  './src/errors.js?v=1.3.1',
  './src/speech.js?v=1.3.1',
  './src/ai.js?v=1.3.1',
  './src/state.js?v=1.3.1',
  './manifest.json?v=1.3.1'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k))))
  ).then(() => self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then((res) => res || fetch(event.request)));
});
