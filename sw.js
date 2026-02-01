// Pippi Service Worker v1.4.8
import { VERSION, CACHE_NAME, ASSETS } from './src/config.js';

self.addEventListener('install', (event) => {
  console.log('[SW] Installing v' + VERSION);
  self.skipWaiting();
  const versionedAssets = ASSETS.map(url => `${url}?v=${VERSION}`);
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(versionedAssets)));
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v' + VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Cleaning old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    // 導航時強制抓最新 HTML，若失敗才用快取
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
