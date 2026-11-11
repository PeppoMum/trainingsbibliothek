// Offline-Fähigkeit: App, Schrift, Firebase-Bausteine und der zuletzt geladene Grundbestand liegen auf dem Gerät.
// Skizzen werden beim ersten Ansehen gespeichert. Ohne Netz zeigt die App den gespeicherten Stand.
const CACHE = 'tb-v5';
const GERUEST = [
  './', 'index.html', 'app.css', 'app.js', 'ui.js', 'admin.js', 'logik.js', 'speicher.js', 'daten.js', 'kategorien.js', 'export.js',
  'firebase-config.js', 'manifest.webmanifest', 'icons/icon-192.png',
  'fonts/inter-latin-400-normal.woff2', 'fonts/inter-latin-600-normal.woff2', 'fonts/inter-latin-700-normal.woff2', 'fonts/inter-latin-800-normal.woff2',
  'lib/firebase/firebase-app.js', 'lib/firebase/firebase-auth.js', 'lib/firebase/firebase-firestore-lite.js',
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(GERUEST)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });

function merken(req, res) { if (res && res.ok) { const k = res.clone(); caches.open(CACHE).then(c => c.put(req, k)); } return res; }
// Zuerst aus dem Netz (mit Zeitgrenze, damit ein schwaches Netz nicht hängen lässt), sonst aus dem Speicher.
function netzZuerst(req, seite, ms = 4000) {
  return new Promise(resolve => {
    let fertig = false;
    const ausSpeicher = () => caches.match(req, { ignoreSearch: true }).then(r => r || (seite ? caches.match('index.html') : undefined));
    const t = setTimeout(() => { ausSpeicher().then(r => { if (r && !fertig) { fertig = true; resolve(r); } }); }, ms);
    fetch(req).then(res => { clearTimeout(t); merken(req, res); if (!fertig) { fertig = true; resolve(res); } })
      .catch(() => { clearTimeout(t); ausSpeicher().then(r => { if (!fertig) { fertig = true; resolve(r || Response.error()); } }); });
  });
}
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/__/')) return;
  // Skizzen ändern sich nie: zuerst aus dem Speicher
  if (url.pathname.includes('/skizzen/')) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => merken(e.request, res))));
    return;
  }
  e.respondWith(netzZuerst(e.request, e.request.mode === 'navigate'));
});
