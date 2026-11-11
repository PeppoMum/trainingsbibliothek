// 1. Spielt public/daten/vorschlaege.json in Firestore ein.
//    - Neue Einheiten und Karten werden angelegt.
//    - Bestehende Karten bekommen nur fehlende Einsätze (gleiche Übung an weiteren Tagen) und Jugend-Stempel dazu.
//      Ist eine Karte inzwischen in eine andere gelegt worden, landen neue Einsätze bei der anderen Karte.
//      Ein Einsatz, den es schon irgendwo gibt (z. B. abgetrennt), wird nicht noch einmal angelegt.
//    - Bestehende Einheiten bekommen nur das Feld „schwerpunkte“, wenn es noch fehlt.
//    Phils Änderungen (Merkmale, Status, Qualität, Titel, Texte) werden NIE überschrieben.
// 2. Schreibt den Grundbestand public/stand/stand.json, den die App beim Start lädt.
//    Danach fragt die App die Datenbank nur noch nach Einträgen, die seitdem geändert wurden.
//
// Umgebung: FIREBASE_SERVICE_ACCOUNT (Zugang), NUR_STAND=1 (nur Grundbestand, nichts einspielen),
// STAND_URL (veröffentlichter Grundbestand; wenn gesetzt und seitdem nichts geändert wurde: weiter=false).
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { standAus } from './stand.mjs';

const konto = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(konto) });
const db = getFirestore();
const ausgabe = (k, v) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); };

const einsatzKey = v => v.label ? `${v.einheit}#${v.label}` : `${v.einheit}##${v.titel}`;

async function schreiben(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    for (const [art, ref, x] of ops.slice(i, i + 400)) art === 'neu' ? b.create(ref, x) : b.update(ref, x);
    await b.commit();
  }
}

async function einheiten(daten) {
  const vorhanden = new Map((await db.collection('einheiten').get()).docs.map(d => [d.id, d.data()]));
  const ops = []; let neu = 0, erg = 0;
  for (const e of daten.einheiten) {
    const ref = db.collection('einheiten').doc(e.id);
    const alt = vorhanden.get(e.id);
    if (!alt) { ops.push(['neu', ref, e]); neu++; }
    else if (!('schwerpunkte' in alt) && e.schwerpunkte) { ops.push(['upd', ref, { schwerpunkte: e.schwerpunkte }]); erg++; }
  }
  await schreiben(ops);
  console.log(`einheiten: ${neu} neu, ${erg} um Schwerpunkte ergänzt, ${vorhanden.size} waren schon da`);
}

async function uebungen(daten) {
  const vorhanden = new Map((await db.collection('uebungen').get()).docs.map(d => [d.id, d.data()]));
  const ueberall = new Set();
  for (const u of vorhanden.values()) for (const v of u.varianten || []) ueberall.add(einsatzKey(v));
  const ziel = id => { let u = vorhanden.get(id), n = 0; while (u && u.status === 'zusammengelegt' && u.ziel && vorhanden.has(u.ziel) && n++ < 5) { id = u.ziel; u = vorhanden.get(id); } return id; };
  const geaendert = new Set();
  const ops = []; let neu = 0;
  for (const u of daten.uebungen) {
    if (!vorhanden.has(u.id)) { ops.push(['neu', db.collection('uebungen').doc(u.id), u]); neu++; u.varianten.forEach(v => ueberall.add(einsatzKey(v))); continue; }
    const zid = ziel(u.id);
    const alt = vorhanden.get(zid);
    const fehlt = u.varianten.filter(v => !ueberall.has(einsatzKey(v)));
    const jugend = [...new Set([...(alt.jugend || []), ...(u.jugend || [])])].sort();
    if (fehlt.length || jugend.length !== (alt.jugend || []).length) {
      fehlt.forEach(v => ueberall.add(einsatzKey(v)));
      alt.varianten = [...(alt.varianten || []), ...fehlt].sort((a, b) => a.datum.localeCompare(b.datum));
      alt.jugend = jugend;
      geaendert.add(zid);
    }
  }
  for (const id of geaendert) { const a = vorhanden.get(id); ops.push(['upd', db.collection('uebungen').doc(id), { varianten: a.varianten, jugend: a.jugend }]); }
  await schreiben(ops);
  console.log(`uebungen: ${neu} neu, ${geaendert.size} um Einsätze ergänzt, ${vorhanden.size} waren schon da`);
}

// Einmalig (Phil, 02.11.2026): alle noch offenen Vorschläge aus 2026/27 aufnehmen. Verworfenes bleibt verworfen.
async function einmaligAufnehmen() {
  const marke = db.doc('meta/aufnehmen-2026-27');
  if ((await marke.get()).exists) return;
  const ops = [];
  for (const s of ['einheiten', 'uebungen']) {
    const snap = await db.collection(s).where('status', '==', 'vorschlag').get();
    snap.docs.forEach(d => ops.push(['upd', d.ref, { status: 'aufgenommen' }]));
  }
  await schreiben(ops);
  await marke.set({ erledigt: new Date().toISOString(), anzahl: ops.length });
  console.log(`einmalig aufgenommen: ${ops.length}`);
}

// Wurde seit dem veröffentlichten Grundbestand etwas geändert?
async function seitStandGeaendert(url) {
  let zeit = 0;
  try { const r = await fetch(url, { cache: 'no-store' }); if (r.ok) zeit = (await r.json()).zeit || 0; } catch { /* dann neu schreiben */ }
  if (!zeit) return true;
  for (const s of ['einheiten', 'uebungen']) {
    const n = (await db.collection(s).where('geaendert', '>', Timestamp.fromMillis(zeit)).count().get()).data().count;
    if (n) return true;
  }
  return false;
}

async function standSchreiben() {
  const zeit = Date.now() - 10 * 60 * 1000; // Puffer gegen abweichende Uhren
  const [e, u] = await Promise.all(['einheiten', 'uebungen'].map(async s => (await db.collection(s).get()).docs.map(d => ({ ...d.data(), id: d.id }))));
  const stand = standAus(e, u, zeit);
  mkdirSync(new URL('../../public/stand/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../../public/stand/stand.json', import.meta.url), JSON.stringify(stand));
  console.log(`Grundbestand: ${stand.einheiten.length} Einheiten, ${stand.uebungen.length} Karten`);
}

if (process.env.STAND_URL && process.env.NUR_STAND && !(await seitStandGeaendert(process.env.STAND_URL))) {
  console.log('Seit dem letzten Grundbestand nichts geändert.');
  ausgabe('weiter', 'false');
  process.exit(0);
}
if (!process.env.NUR_STAND) {
  const daten = JSON.parse(readFileSync(new URL('../../public/daten/vorschlaege.json', import.meta.url)));
  await einheiten(daten);
  await uebungen(daten);
  await einmaligAufnehmen();
}
await standSchreiben();
ausgabe('weiter', 'true');
