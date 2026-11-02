// Offline-Fähigkeit: App-Gerüst und Skizzen werden auf dem Gerät gespeichert.
const CACHE = 'tb-v1';
const GERUEST = ['./', 'index.html', 'app.css', 'app.js', 'daten.js', 'kategorien.js', 'firebase-config.js', 'manifest.webmanifest', 'icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(GERUEST)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/__/')) return;
  // Skizzen: zuerst aus dem Speicher (ändern sich nie). Rest: zuerst aus dem Netz, sonst aus dem Speicher.
  if (url.pathname.includes('/skizzen/')) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const k = res.clone(); caches.open(CACHE).then(c => c.put(e.request, k)); return res; })));
    return;
  }
  e.respondWith(fetch(e.request).then(res => { const k = res.clone(); caches.open(CACHE).then(c => c.put(e.request, k)); return res; }).catch(() => caches.match(e.request)));
});
