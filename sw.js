const CACHE_NAME = 'ahorro-v5';
const ASSETS = ['/ahorro-casa/','/ahorro-casa/index.html','/ahorro-casa/style.css','/ahorro-casa/app.js','/ahorro-casa/firebase-sync.js','/ahorro-casa/manifest.json'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(n => Promise.all(n.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE_NAME).then(cache => cache.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
