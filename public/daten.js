// Datenzugriff.
// Grundbestand: stand/stand.json (wird jede Nacht und bei jedem Hochladen aus der Datenbank erzeugt).
// Dazu kommen aus der Datenbank nur die Einträge, die seitdem geändert wurden. So kostet ein App-Start
// nur wenige Lesezugriffe statt über 1.000.
// Vorschau (ohne Firebase-Zugangsdaten, zum Testen): Daten aus der Datei, Änderungen nur im Browser.
import { FIREBASE_CONFIG, ADMIN_HASHES } from './firebase-config.js';

const state = {
  modus: 'vorschau', geladen: false, einheiten: [], uebungen: [], nutzer: null, admin: false,
  fb: null, hoerer: new Set(), standZeit: 0, ohneNetz: false,
};
const index = { e: new Map(), u: new Map() };

export const daten = state;
export function beiAenderung(fn) { state.hoerer.add(fn); }
function melden() { state.hoerer.forEach(fn => fn()); }

// Einheit oder Karte nach Kennung; zusammengelegte Karten führen zur Karte, in der sie jetzt stecken.
export function einheitVon(id) { return index.e.get(id); }
export function karteVon(id, tiefe = 0) {
  const u = index.u.get(id);
  if (u && u.status === 'zusammengelegt' && u.ziel && tiefe < 5) return karteVon(u.ziel, tiefe + 1) || u;
  return u;
}

function setzen(einheiten, uebungen) {
  state.einheiten = einheiten; state.uebungen = uebungen;
  index.e = new Map(einheiten.map(e => [e.id, e]));
  index.u = new Map(uebungen.map(u => [u.id, u]));
}
function einsetzen(art, d) {
  const liste = art === 'e' ? state.einheiten : state.uebungen;
  const ix = art === 'e' ? index.e : index.u;
  const alt = ix.get(d.id);
  if (alt) { for (const k of Object.keys(alt)) delete alt[k]; Object.assign(alt, d); }
  else { liste.push(d); ix.set(d.id, d); }
}
function ohneZeitstempel(d) { const { geaendert, ...rest } = d; return rest; }

async function jsonHolen(url) {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

export async function starten() {
  const mitFirebase = !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey);
  const stand = await jsonHolen('stand/stand.json');
  if (mitFirebase) {
    state.modus = 'firebase';
    if (stand) {
      state.standZeit = stand.zeit || 0;
      setzen(stand.einheiten, stand.uebungen);
      state.geladen = true;
      melden();
    }
    try { await starteFirebase(); }
    catch (e) {
      state.ohneNetz = true;
      if (!state.geladen) throw e;
      melden();
    }
    return;
  }
  const basis = stand || await jsonHolen('daten/vorschlaege.json');
  if (!basis) throw new Error('Daten nicht gefunden');
  vorschauAnwenden(basis);
}

// ---------- Vorschau ----------
const VS_KEY = 'tb-vorschau-aenderungen';
const VS_NEU = 'tb-vorschau-neu';
function vsLesen(k) { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } }
function vsSchreiben(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* egal */ } }
function vorschauAnwenden(j) {
  const aend = vsLesen(VS_KEY), neu = vsLesen(VS_NEU);
  const einheiten = j.einheiten.map(e => ({ ...e, ...(aend['e:' + e.id] || {}) }));
  const uebungen = [...j.uebungen, ...Object.values(neu)].map(u => ({ ...u, ...(aend['u:' + u.id] || {}) }));
  setzen(einheiten, uebungen);
  state.nutzer = { email: 'Vorschau' }; state.admin = true; state.geladen = true;
  melden();
}
function vorschauSpeichern(liste) {
  const aend = vsLesen(VS_KEY), neu = vsLesen(VS_NEU);
  for (const [art, id, felder] of liste) {
    if (art === 'neu-u') { neu[id] = felder; continue; }
    const k = art + ':' + id; aend[k] = { ...(aend[k] || {}), ...felder };
  }
  vsSchreiben(VS_KEY, aend); vsSchreiben(VS_NEU, neu);
}

// ---------- Firebase ----------
async function starteFirebase() {
  const [{ initializeApp }, fs, au] = await Promise.all([
    import('./lib/firebase/firebase-app.js'),
    import('./lib/firebase/firebase-firestore-lite.js'),
    import('./lib/firebase/firebase-auth.js'),
  ]);
  const app = initializeApp({ ...FIREBASE_CONFIG });
  const db = fs.getFirestore(app);
  const auth = au.getAuth(app);
  state.fb = { fs, au, db, auth };
  au.onAuthStateChanged(auth, async u => {
    state.nutzer = u ? { email: u.email } : null;
    state.admin = await istAdminKonto(u);
    melden();
    if (state.admin) { try { await adminDatenLaden(); } catch { /* später erneut */ } }
  });
  au.getRedirectResult(auth).catch(() => {});
  await aenderungenLaden();
}

async function aenderungenLaden() {
  const { fs, db } = state.fb;
  for (const [name, art] of [['einheiten', 'e'], ['uebungen', 'u']]) {
    const ziel = fs.collection(db, name);
    const q = state.standZeit ? fs.query(ziel, fs.where('geaendert', '>', fs.Timestamp.fromMillis(state.standZeit))) : ziel;
    const snap = await fs.getDocs(q);
    snap.docs.forEach(d => einsetzen(art, ohneZeitstempel(d.data())));
  }
  state.geladen = true;
  state.ohneNetz = false;
  melden();
}

// Vorschläge, Papierkorb und Zusammengelegtes stehen nicht vollständig im Grundbestand: nur für Phil nachladen.
async function adminDatenLaden() {
  const { fs, db } = state.fb;
  for (const [name, art] of [['einheiten', 'e'], ['uebungen', 'u']]) {
    const snap = await fs.getDocs(fs.query(fs.collection(db, name), fs.where('status', 'in', ['vorschlag', 'verworfen', 'zusammengelegt'])));
    snap.docs.forEach(d => einsetzen(art, ohneZeitstempel(d.data())));
  }
  melden();
}

async function istAdminKonto(u) {
  if (!u || !u.email || !u.emailVerified) return false;
  try {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(u.email.toLowerCase()));
    const hex = [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
    return ADMIN_HASHES.includes(hex);
  } catch { return false; }
}

export async function anmelden() {
  if (state.modus !== 'firebase' || !state.fb) throw new Error('Keine Verbindung');
  const { au, auth } = state.fb;
  const p = new au.GoogleAuthProvider();
  try { await au.signInWithPopup(auth, p); }
  catch (e) {
    if (e && /popup/.test(e.code || '')) await au.signInWithRedirect(auth, p);
    else throw e;
  }
}
export async function abmelden() {
  if (state.modus !== 'firebase' || !state.fb) return;
  await state.fb.au.signOut(state.fb.auth);
}

// ---------- Ändern (nur Admin) ----------
// liste: [['e' | 'u', id, felder], …] ändert; ['neu-u', id, karte] legt eine neue Karte an.
// Klappt das Speichern nicht, wird alles zurückgenommen.
export async function aendernMehrere(liste) {
  const zurueck = [];
  for (const [art, id, felder] of liste) {
    if (art === 'neu-u') { einsetzen('u', { ...felder }); zurueck.push(() => { state.uebungen = state.uebungen.filter(u => u.id !== id); index.u.delete(id); }); continue; }
    const obj = art === 'e' ? index.e.get(id) : index.u.get(id);
    if (!obj) continue;
    const vorher = {};
    for (const k of Object.keys(felder)) vorher[k] = k in obj ? obj[k] : undefined;
    Object.assign(obj, felder);
    zurueck.push(() => { for (const [k, v] of Object.entries(vorher)) { if (v === undefined) delete obj[k]; else obj[k] = v; } });
  }
  melden();
  try {
    if (state.modus === 'firebase') {
      if (!state.fb) throw new Error('Keine Verbindung zur Datenbank');
      const { fs, db } = state.fb;
      const b = fs.writeBatch(db);
      for (const [art, id, felder] of liste) {
        if (art === 'neu-u') b.set(fs.doc(db, 'uebungen', id), { ...felder, geaendert: fs.serverTimestamp() });
        else b.update(fs.doc(db, art === 'e' ? 'einheiten' : 'uebungen', id), { ...felder, geaendert: fs.serverTimestamp() });
      }
      await b.commit();
    } else {
      vorschauSpeichern(liste);
    }
  } catch (e) {
    zurueck.reverse().forEach(f => f());
    melden();
    throw e;
  }
}
export function aendern(art, id, felder) { return aendernMehrere([[art, id, felder]]); }

export function neueKennung() {
  const z = new Uint8Array(5);
  crypto.getRandomValues(z);
  return 'u-' + [...z].map(x => x.toString(16).padStart(2, '0')).join('');
}
