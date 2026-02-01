const CACHE_NAME = 'pippi-voice-v1.0.2';
const ASSETS = [
  './',
  './index.html',
  './src/style.css',
  './src/app.js',
  './manifest.json',
  './public/icons/icon-192x192.png',
  './public/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
