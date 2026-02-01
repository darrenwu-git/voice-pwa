const CACHE_NAME = 'pippi-voice-v1.1.7';
const ASSETS = [
  './',
  './index.html',
  './test.html',
  './src/style.css?v=1.1.7',
  './src/app.js?v=1.1.7',
  './src/utils.js?v=1.1.7',
  './src/events.js?v=1.1.7',
  './src/errors.js?v=1.1.7',
  './src/speech.js?v=1.1.7',
  './src/ai.js?v=1.1.7',
  './manifest.json',
  './sw.js?v=1.1.7',
  './public/icons/icon-192x192.png',
  './public/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))));
});

self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((res) => res || fetch(event.request)));
});
