// Spielt public/daten/vorschlaege.json in Firestore ein.
// - Neue Einheiten und Karten werden angelegt.
// - Bestehende Karten bekommen nur fehlende Varianten (gleiche Übung an weiteren Tagen) und Jugend-Stempel dazu.
// - Bestehende Einheiten bekommen nur das Feld „schwerpunkte“, wenn es noch fehlt.
// Phils Änderungen (Merkmale, Status, Qualität, Titel) werden NIE überschrieben.
// Läuft automatisch beim Hochladen über GitHub (Zugang über FIREBASE_SERVICE_ACCOUNT).
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const konto = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(konto) });
const db = getFirestore();
const daten = JSON.parse(readFileSync(new URL('../../public/daten/vorschlaege.json', import.meta.url)));

const varKey = v => `${v.einheit}#${v.label}#${v.titel}`;

async function schreiben(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    for (const [art, ref, x] of ops.slice(i, i + 400)) art === 'neu' ? b.create(ref, x) : b.update(ref, x);
    await b.commit();
  }
}

async function einheiten() {
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

async function uebungen() {
  const vorhanden = new Map((await db.collection('uebungen').get()).docs.map(d => [d.id, d.data()]));
  const ops = []; let neu = 0, erg = 0;
  for (const u of daten.uebungen) {
    const ref = db.collection('uebungen').doc(u.id);
    const alt = vorhanden.get(u.id);
    if (!alt) { ops.push(['neu', ref, u]); neu++; continue; }
    const da = new Set((alt.varianten || []).map(varKey));
    const fehlt = u.varianten.filter(v => !da.has(varKey(v)));
    const jugend = [...new Set([...(alt.jugend || []), ...(u.jugend || [])])].sort();
    if (fehlt.length || jugend.length !== (alt.jugend || []).length) {
      const varianten = [...(alt.varianten || []), ...fehlt].sort((a, b) => a.datum.localeCompare(b.datum));
      ops.push(['upd', ref, { varianten, jugend }]); erg++;
    }
  }
  await schreiben(ops);
  console.log(`uebungen: ${neu} neu, ${erg} um Varianten ergänzt, ${vorhanden.size} waren schon da`);
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

await einheiten();
await uebungen();
await einmaligAufnehmen();
