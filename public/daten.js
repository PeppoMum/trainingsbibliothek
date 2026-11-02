// Datenzugriff. Zwei Betriebsarten:
// - Firebase: Daten liegen in Firestore, ansehen darf jeder, ändern nur der eingetragene Admin.
// - Vorschau: ohne Firebase-Zugangsdaten (lokal zum Testen). Daten aus daten/vorschlaege.json, Änderungen nur im Browser.
import { FIREBASE_CONFIG, ADMIN_EMAILS } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.0.2/';
const state = { modus: 'vorschau', einheiten: [], uebungen: [], nutzer: null, admin: false, fb: null, hoerer: new Set() };

export const daten = state;
export function beiAenderung(fn) { state.hoerer.add(fn); }
function melden() { state.hoerer.forEach(fn => fn()); }

export async function starten() {
  if (FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey) {
    state.modus = 'firebase';
    await starteFirebase();
  } else {
    await starteVorschau();
  }
}

// ---------- Vorschau ----------
const VS_KEY = 'tb-vorschau-aenderungen';
async function starteVorschau() {
  const r = await fetch('daten/vorschlaege.json', { cache: 'no-store' });
  const j = await r.json();
  let aend = {};
  try { aend = JSON.parse(localStorage.getItem(VS_KEY) || '{}'); } catch { aend = {}; }
  state.einheiten = j.einheiten.map(e => ({ ...e, ...(aend['e:' + e.id] || {}) }));
  state.uebungen = j.uebungen.map(u => ({ ...u, ...(aend['u:' + u.id] || {}) }));
  state.nutzer = { email: 'vorschau' }; state.admin = true;
  melden();
}
function vorschauSpeichern(art, id, felder) {
  let aend = {};
  try { aend = JSON.parse(localStorage.getItem(VS_KEY) || '{}'); } catch { aend = {}; }
  const k = art + ':' + id; aend[k] = { ...(aend[k] || {}), ...felder };
  try { localStorage.setItem(VS_KEY, JSON.stringify(aend)); } catch { /* egal */ }
}

// ---------- Firebase ----------
async function starteFirebase() {
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(SDK + 'firebase-app.js'), import(SDK + 'firebase-firestore.js'), import(SDK + 'firebase-auth.js'),
  ]);
  const cfg = { ...FIREBASE_CONFIG };
  // Anmeldung über die eigene Adresse laufen lassen (wichtig für Safari/iPhone)
  if (/\.(web\.app|firebaseapp\.com)$/.test(location.hostname)) cfg.authDomain = location.hostname;
  const app = initializeApp(cfg);
  let db;
  try {
    db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch { db = fs.getFirestore(app); }
  const auth = au.getAuth(app);
  state.fb = { fs, au, db, auth };
  try { await au.getRedirectResult(auth); } catch { /* egal */ }
  au.onAuthStateChanged(auth, u => {
    state.nutzer = u ? { email: u.email } : null;
    state.admin = !!(u && u.email && ADMIN_EMAILS.map(x => x.toLowerCase()).includes(u.email.toLowerCase()));
    melden();
  });
  fs.onSnapshot(fs.collection(db, 'einheiten'), snap => { state.einheiten = snap.docs.map(d => d.data()); melden(); });
  fs.onSnapshot(fs.collection(db, 'uebungen'), snap => { state.uebungen = snap.docs.map(d => d.data()); melden(); });
}

export async function anmelden() {
  if (state.modus !== 'firebase') return;
  const { au, auth } = state.fb;
  const p = new au.GoogleAuthProvider();
  try { await au.signInWithPopup(auth, p); }
  catch (e) {
    if (e && /popup/.test(e.code || '')) await au.signInWithRedirect(auth, p);
    else throw e;
  }
}
export async function abmelden() {
  if (state.modus !== 'firebase') return;
  await state.fb.au.signOut(state.fb.auth);
}

// Felder einer Einheit oder Übung ändern (nur Admin)
export async function aendern(art, id, felder) {
  const liste = art === 'e' ? state.einheiten : state.uebungen;
  const obj = liste.find(x => x.id === id);
  if (obj) Object.assign(obj, felder);
  if (state.modus === 'firebase') {
    const { fs, db } = state.fb;
    await fs.updateDoc(fs.doc(db, art === 'e' ? 'einheiten' : 'uebungen', id), felder);
  } else {
    vorschauSpeichern(art, id, felder);
  }
  melden();
}

// Mehrere Änderungen auf einmal (z. B. Einheit mit ihren Übungen aufnehmen)
export async function aendernMehrere(liste) {
  for (const [art, id, felder] of liste) {
    const l = art === 'e' ? state.einheiten : state.uebungen;
    const obj = l.find(x => x.id === id); if (obj) Object.assign(obj, felder);
  }
  if (state.modus === 'firebase') {
    const { fs, db } = state.fb;
    const b = fs.writeBatch(db);
    for (const [art, id, felder] of liste) b.update(fs.doc(db, art === 'e' ? 'einheiten' : 'uebungen', id), felder);
    await b.commit();
  } else {
    for (const [art, id, felder] of liste) vorschauSpeichern(art, id, felder);
  }
  melden();
}
