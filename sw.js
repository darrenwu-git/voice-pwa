const CACHE_NAME = 'pippi-voice-v1.2.5';
const ASSETS = [
  './index.html?v=1.2.5',
  './src/style.css?v=1.2.5',
  './src/app.js?v=1.2.5',
  './src/utils.js?v=1.2.5',
  './src/events.js?v=1.2.5',
  './src/errors.js?v=1.2.5',
  './src/speech.js?v=1.2.5',
  './src/ai.js?v=1.2.5',
  './src/state.js?v=1.2.5',
  './manifest.json?v=1.2.5'
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
