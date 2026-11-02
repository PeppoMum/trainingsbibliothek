// Spielt neue Vorschläge aus public/daten/vorschlaege.json in Firestore ein.
// Bestehende Einträge werden NIE überschrieben (Phils Änderungen bleiben erhalten).
// Läuft automatisch beim Hochladen über GitHub (Zugang über FIREBASE_SERVICE_ACCOUNT).
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const konto = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(konto) });
const db = getFirestore();
const daten = JSON.parse(readFileSync(new URL('../../public/daten/vorschlaege.json', import.meta.url)));

async function einspielen(sammlung, liste) {
  const vorhanden = new Set((await db.collection(sammlung).select().get()).docs.map(d => d.id));
  const neu = liste.filter(x => !vorhanden.has(x.id));
  for (let i = 0; i < neu.length; i += 400) {
    const b = db.batch();
    for (const x of neu.slice(i, i + 400)) b.create(db.collection(sammlung).doc(x.id), x);
    await b.commit();
  }
  console.log(`${sammlung}: ${neu.length} neu, ${vorhanden.size} schon vorhanden`);
}
await einspielen('einheiten', daten.einheiten);
await einspielen('uebungen', daten.uebungen);
