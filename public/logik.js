// Reine Rechen-Hilfen ohne Bildschirm: Suche, Sortieren, Filter, Kalender, Hinweise.
// Wird von der App und von den Tests (node --test) benutzt.
import { teilVon } from './kategorien.js';

export const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const WT_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// ---------- Datum ----------
export function datumDE(iso) { const [y, m, d] = String(iso).split('-'); return `${d}.${m}.${y}`; }
export function wochentagNr(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay(); }
export function wochentag(iso) { return WOCHENTAGE[wochentagNr(iso)]; }
export function monatName(ym) { const [y, m] = ym.split('-'); return `${MONATE[+m - 1]} ${y}`; }

// ISO-Kalenderwoche
export function isoWoche(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d));
  const tag = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - tag);
  const jahrStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - jahrStart) / 86400000 + 1) / 7);
}

// Wochen eines Monats (Montag bis Sonntag), Tage außerhalb des Monats mit imMonat=false
export function kalender(ym) {
  const [y, m] = ym.split('-').map(Number);
  const erster = new Date(Date.UTC(y, m - 1, 1));
  const versatz = (erster.getUTCDay() + 6) % 7; // Montag = 0
  const start = new Date(Date.UTC(y, m - 1, 1 - versatz));
  const wochen = [];
  for (let w = 0; w < 6; w++) {
    const tage = [];
    for (let i = 0; i < 7; i++) {
      const t = new Date(start.getTime() + (w * 7 + i) * 86400000);
      const iso = t.toISOString().slice(0, 10);
      tage.push({ iso, tag: t.getUTCDate(), imMonat: t.getUTCMonth() === m - 1 });
    }
    if (w > 0 && !tage.some(t => t.imMonat)) break;
    const mo = tage[0].iso.split('-').map(Number);
    wochen.push({ kw: isoWoche(mo[0], mo[1], mo[2]), tage });
  }
  return wochen;
}

// ---------- Text vergleichbar machen ----------
// Kleinbuchstaben, ohne Akzente, „4 gegen 2“ = „4gg2“ = „4 gg 2“, „4 + 1“ = „4+1“
export function norm(s) {
  let t = String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
  t = t.replace(/[①-⑳]/g, ' ');
  t = t.replace(/\bvs\.?(?=\s|\d|$)/g, ' gg ').replace(/\bgg\.(?=\s|\d|$)/g, ' gg ');
  t = t.replace(/(\d)\s*(?:gegen|gg|vs)\s*(?=\d)/g, '$1gg');
  t = t.replace(/\bgegen\b/g, 'gg');
  t = t.replace(/(\d)\s*\+\s*(?=\d)/g, '$1+');
  return t.replace(/[^a-z0-9+]+/g, ' ').trim();
}

export function editAbstand(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let vor = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const akt = [i];
    let klein = i;
    for (let j = 1; j <= b.length; j++) {
      akt[j] = Math.min(vor[j] + 1, akt[j - 1] + 1, vor[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (akt[j] < klein) klein = akt[j];
    }
    if (klein > max) return max + 1;
    vor = akt;
  }
  return vor[b.length];
}

// Kommt das Suchwort im (normierten) Text vor? Zahlen nur am Wortanfang („4gg2“ trifft nicht „14gg2“).
function enthaelt(text, wort) {
  let i = text.indexOf(wort);
  while (i >= 0) {
    if (!/^\d/.test(wort) || i === 0 || !/\d/.test(text[i - 1])) return true;
    i = text.indexOf(wort, i + 1);
  }
  return false;
}

// ---------- Suche ----------
// Felder je Eintrag: [{ text, gewicht, zeige? }]. Treffer = alle Suchwörter kommen irgendwo vor.
export function suchIndexUebung(u) {
  const m = u.merkmale || {};
  const felder = [{ text: norm(u.titel), gewicht: 10 }];
  const titelSchon = new Set([norm(u.titel)]);
  for (const v of u.varianten || []) {
    const t = norm(v.titel);
    if (t && !titelSchon.has(t)) { titelSchon.add(t); felder.push({ text: t, gewicht: 6 }); }
  }
  felder.push({ text: norm([m.hauptschwerpunkt, ...(m.schwerpunkte || []), ...(m.spielphasen || []), u.form, m.artSpielform, ...(m.zahl || []), m.zahlText, ...(m.ort || [])].filter(Boolean).join(' ')), gewicht: 3 });
  for (const v of u.varianten || []) {
    for (const teil of v.teile || []) {
      for (const z of teil.zeilen || []) felder.push({ text: norm(z), gewicht: 1, zeige: z });
    }
  }
  return felder;
}

export function suchIndexEinheit(e) {
  const [y, mo] = e.datum.split('-');
  const felder = [
    { text: norm([datumDE(e.datum), e.datum, `${MONATE[+mo - 1]} ${y}`, wochentag(e.datum), e.saison, e.mannschaft, e.art === 'Trainingslager' ? 'Trainingslager' : ''].join(' ')), gewicht: 8 },
    { text: norm(e.schwerpunkt), gewicht: 6, zeige: e.schwerpunkt ? 'Schwerpunkt: ' + e.schwerpunkt : '' },
  ];
  for (const b of e.bausteine || []) if (b.titel) felder.push({ text: norm(b.titel), gewicht: 2, zeige: [b.label, b.titel].filter(Boolean).join(') ') });
  return felder;
}

// Wörter aller Texte (für „Tippfehler verzeihen“)
export function wortschatz(indizes) {
  const s = new Set();
  for (const felder of indizes) for (const f of felder) for (const w of f.text.split(' ')) if (w.length >= 4) s.add(w);
  return s;
}

// Suchwörter vorbereiten: jedes Wort mit seinen ähnlich geschriebenen Wörtern aus dem Wortschatz
export function suchWoerter(q, schatz) {
  // Datum „16.10.“ oder „16.10.2026“ bleibt zusammen
  const roh = String(q || '').trim();
  const datum = roh.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})?$/);
  if (datum) return [{ wort: norm(roh), varianten: [norm(roh)] }];
  return norm(roh).split(' ').filter(Boolean).map(wort => {
    const varianten = [wort];
    if (schatz && wort.length >= 5 && !/\d/.test(wort)) {
      const max = wort.length >= 8 ? 2 : 1;
      for (const w of schatz) if (w !== wort && w[0] === wort[0] && editAbstand(wort, w, max) <= max) varianten.push(w);
    }
    return { wort, varianten };
  });
}

// Wertung eines Eintrags; null = kein Treffer. stelle = Textzeile, in der etwas gefunden wurde (wenn nicht im Titel).
export function bewerte(felder, woerter) {
  if (!woerter.length) return null;
  let punkte = 0, stelle = '';
  for (const { varianten } of woerter) {
    let best = 0, bestFeld = null;
    for (const f of felder) {
      if (f.gewicht <= best) continue;
      if (varianten.some(v => enthaelt(f.text, v))) { best = f.gewicht; bestFeld = f; }
    }
    if (!best) return null;
    punkte += best;
    if (!stelle && bestFeld && bestFeld.zeige && best < 6) stelle = bestFeld.zeige;
  }
  return { punkte, stelle };
}

export function stelleKuerzen(text, max = 90) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

// ---------- Übungskarten ----------
export function letzteVariante(u) { return [...(u.varianten || [])].sort((a, b) => b.datum.localeCompare(a.datum))[0]; }
export function zuletzt(u) { const v = letzteVariante(u); return v ? v.datum : ''; }
export function teileVonKarte(u) { return [...new Set((u.varianten || []).map(v => teilVon(v.label)).filter(Boolean))]; }
export function ersteSkizze(u) {
  for (const v of [...(u.varianten || [])].sort((a, b) => b.datum.localeCompare(a.datum))) if ((v.skizzen || []).length) return v.skizzen[0];
  return '';
}

// Sortierschlüssel für „A bis Z“: Zeichen am Anfang (Klammern, Striche, Kreisziffern) zählen nicht
export function sortTitel(t) {
  return String(t || '').replace(/^[^A-Za-zÄÖÜäöüß0-9]+/, '').replace(/^Ohne Titel/i, '￿');
}
const vgl = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

export const SORTIERUNGEN = [['zuletzt', 'Zuletzt'], ['haeufig', 'Häufigste'], ['az', 'A bis Z']];
export function sortiere(liste, art) {
  const l = [...liste];
  if (art === 'az') return l.sort((a, b) => vgl.compare(sortTitel(a.titel), sortTitel(b.titel)));
  if (art === 'haeufig') return l.sort((a, b) => (b.varianten.length - a.varianten.length) || zuletzt(b).localeCompare(zuletzt(a)) || vgl.compare(a.titel, b.titel));
  return l.sort((a, b) => zuletzt(b).localeCompare(zuletzt(a)) || vgl.compare(sortTitel(a.titel), sortTitel(b.titel)));
}

// ---------- Filter ----------
export const LEERER_FILTER = () => ({ schwerpunkt: [], jugend: [], saison: [], qualitaet: [], teil: [], form: [], zahl: [], art: [], ort: [] });
export const FILTER_NUR_UEBUNG = ['teil', 'form', 'zahl', 'art', 'ort'];
export function filterAktiv(f) { return Object.values(f).some(v => v.length); }

export function passtFilter(u, f, saisonVonEinheit) {
  const m = u.merkmale || {};
  const hat = (liste, werte) => !liste.length || liste.some(x => werte.includes(x));
  const sw = [m.hauptschwerpunkt, ...(m.schwerpunkte || [])].filter(Boolean);
  const saisons = [...new Set((u.varianten || []).map(v => saisonVonEinheit(v.einheit)).filter(Boolean))];
  return hat(f.schwerpunkt, sw) && hat(f.jugend, u.jugend || []) && hat(f.saison, saisons) && hat(f.qualitaet, [u.qualitaet])
    && hat(f.teil, teileVonKarte(u)) && hat(f.form, [u.form]) && hat(f.zahl, m.zahl || [])
    && hat(f.art, [m.artSpielform]) && hat(f.ort, m.ort || []);
}

// Einheit passt, wenn ihre eigenen Angaben passen und – falls Übungs-Filter gesetzt sind – mindestens eine ihrer Übungen passt.
export function passtFilterEinheit(e, f, karteVon, saisonVonEinheit) {
  const hat = (liste, werte) => !liste.length || liste.some(x => werte.includes(x));
  if (!hat(f.saison, [e.saison]) || !hat(f.jugend, [e.jugend]) || !hat(f.qualitaet, [e.qualitaet])) return false;
  if (f.schwerpunkt.length && !f.schwerpunkt.some(s => (e.schwerpunkte || []).includes(s))) {
    // Schwerpunkt passt auch, wenn eine Übung der Einheit ihn hat
    const karten = (e.bausteine || []).map(b => b.karte && karteVon(b.karte)).filter(Boolean);
    if (!karten.some(u => hat(f.schwerpunkt, [u.merkmale?.hauptschwerpunkt, ...(u.merkmale?.schwerpunkte || [])].filter(Boolean)))) return false;
  }
  if (FILTER_NUR_UEBUNG.some(k => f[k].length)) {
    const nur = { ...LEERER_FILTER() };
    FILTER_NUR_UEBUNG.forEach(k => { nur[k] = f[k]; });
    const karten = (e.bausteine || []).map(b => b.karte && karteVon(b.karte)).filter(Boolean);
    if (!karten.some(u => passtFilter(u, nur, saisonVonEinheit))) return false;
  }
  return true;
}

// ---------- Saisons und Monate ----------
export function saisonGruppen(einheiten) {
  const s = new Map();
  for (const e of einheiten) {
    if (!s.has(e.saison)) s.set(e.saison, new Map());
    const ym = e.datum.slice(0, 7);
    const mm = s.get(e.saison);
    if (!mm.has(ym)) mm.set(ym, []);
    mm.get(ym).push(e);
  }
  return [...s.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([saison, mm]) => ({
    saison,
    anzahl: [...mm.values()].reduce((n, l) => n + l.length, 0),
    mannschaften: [...new Set([...mm.values()].flat().map(e => e.mannschaft).filter(Boolean))].sort(vgl.compare),
    monate: [...mm.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([ym, l]) => ({ ym, einheiten: l.sort((a, b) => b.datum.localeCompare(a.datum) || b.id.localeCompare(a.id)) })),
  }));
}

// ---------- Hinweise für das Prüfen ----------
export const HINWEISE = [
  ['offen', 'Noch nicht angesehen'],
  ['doppelt', 'Name mehrfach vergeben'],
  ['titel', 'Titel unklar'],
  ['haupt', 'Ohne Haupt-Schwerpunkt'],
  ['art', 'Spielform ohne Art'],
  ['phase', 'Ohne Spielphase'],
  ['skizze', 'Ohne Skizze'],
  ['text', 'Ohne Text'],
  ['vorschlag', 'Noch Vorschlag'],
];
export function titelUnklar(t) {
  const s = String(t || '').trim();
  return !s || /^ohne titel/i.test(s) || !/^[A-Za-zÄÖÜäöü0-9]/.test(s) || s.length < 5 || /^[A-ZÄÖÜ]{2,4}$/.test(s) || /\)$/.test(s) && !s.includes('(');
}
export function hinweiseFuer(u, namenZaehler) {
  const m = u.merkmale || {};
  const h = [];
  if (!u.geprueft) h.push('offen');
  if ((namenZaehler.get(norm(u.titel)) || 0) > 1) h.push('doppelt');
  if (titelUnklar(u.titel)) h.push('titel');
  if (!m.hauptschwerpunkt) h.push('haupt');
  if (u.form === 'Spielform' && !m.artSpielform) h.push('art');
  if (!(m.spielphasen || []).length) h.push('phase');
  if (!ersteSkizze(u)) h.push('skizze');
  if (!(u.varianten || []).some(v => (v.teile || []).some(t => (t.zeilen || []).length))) h.push('text');
  if (u.status === 'vorschlag') h.push('vorschlag');
  return h;
}
export function namenZaehlen(karten) {
  const z = new Map();
  for (const u of karten) { const k = norm(u.titel); z.set(k, (z.get(k) || 0) + 1); }
  return z;
}

// Ähnliche Karten zum Zusammenlegen: gleiche Titelwörter
export function aehnlichkeit(a, b) {
  const wa = new Set(norm(a.titel).split(' ').filter(w => w.length > 1));
  const wb = new Set(norm(b.titel).split(' ').filter(w => w.length > 1));
  if (!wa.size || !wb.size) return 0;
  let gleich = 0; for (const w of wa) if (wb.has(w)) gleich++;
  return gleich / (wa.size + wb.size - gleich);
}

// ---------- Bearbeiten ----------
// Zeilen aus dem Textfeld: eine Zeile = ein Punkt; Zeilen mit „↳“ gehören zum Punkt davor.
export function zeilenAusText(text) {
  const out = [];
  for (const roh of String(text).split('\n')) {
    const z = roh.trim();
    if (!z) continue;
    if (z.startsWith('↳') && out.length) out[out.length - 1] += '\n' + z; else out.push(z);
  }
  return out;
}
