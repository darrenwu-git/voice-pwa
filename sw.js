import { VERSION, CACHE_NAME, ASSETS } from './src/config.js';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  const versionedAssets = ASSETS.map(url => `${url}?v=${VERSION}`);
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(versionedAssets)));
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
