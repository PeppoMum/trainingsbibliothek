// Rechen-Hilfen: Suche, Sortierung, Kalender, Filter, Prüf-Hinweise
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../public/logik.js';
import { standAus } from '../werkzeug/einspielen/stand.mjs';

const karte = (titel, extra = {}) => ({ id: titel, titel, form: 'Spielform', status: 'aufgenommen', qualitaet: 'hoch', jugend: ['D'], merkmale: { hauptschwerpunkt: 'Passspiel', schwerpunkte: [], spielphasen: ['Spiel mit dem Ball'], zahl: [] }, varianten: [{ einheit: '2026-10-02', datum: '2026-10-02', label: 'H1', titel, skizzen: ['s.svg'], teile: [{ art: 'ablauf', zeilen: ['Ablauf'] }] }], ...extra });

test('Schreibweisen von „4 gegen 2“ werden gleich behandelt', () => {
  for (const s of ['4 gegen 2', '4gegen2', '4 gg 2', '4vs2', '4 gg. 2']) assert.equal(L.norm(s), '4gg2', s);
  assert.equal(L.norm('4 + 1'), '4+1');
  assert.equal(L.norm('Ballan- und -mitnahme'), 'ballan und mitnahme');
});

test('Zahlen treffen nur am Wortanfang', () => {
  const a = L.suchIndexUebung(karte('4 gegen 2 Rondo'));
  const b = L.suchIndexUebung(karte('14 gegen 2'));
  const w = L.suchWoerter('4 gegen 2', null);
  assert.ok(L.bewerte(a, w));
  assert.equal(L.bewerte(b, w), null);
});

test('Titel zählt mehr als Text, Tippfehler werden verziehen', () => {
  const t = L.suchIndexUebung(karte('Doppelpass im Zentrum'));
  const x = L.suchIndexUebung(karte('Rondo', { varianten: [{ einheit: 'e', datum: '2026-01-01', label: 'A1', titel: 'Rondo', teile: [{ art: 'ablauf', zeilen: ['danach Doppelpass spielen'] }] }] }));
  const schatz = L.wortschatz([t, x]);
  const w = L.suchWoerter('doppelpas', schatz);
  const pt = L.bewerte(t, w), px = L.bewerte(x, w);
  assert.ok(pt && px && pt.punkte > px.punkte);
  assert.equal(px.stelle, 'danach Doppelpass spielen');
});

test('A bis Z ohne Zeichen am Anfang, „Ohne Titel“ zuletzt', () => {
  const l = L.sortiere([karte('Ohne Titel'), karte('(Zocken)'), karte('Abschluss'), karte('① Rondo')], 'az').map(k => k.titel);
  assert.deepEqual(l, ['Abschluss', '① Rondo', '(Zocken)', 'Ohne Titel']);
});

test('Kalender Oktober 2026 beginnt in KW 40 am Donnerstag', () => {
  const w = L.kalender('2026-10');
  assert.equal(w[0].kw, 40);
  assert.equal(w[0].tage.findIndex(t => t.iso === '2026-10-01'), 3);
  assert.equal(w.length, 5);
  assert.equal(L.isoWoche(2027, 1, 1), 53);
});

test('Saisons und Monate, neueste zuerst', () => {
  const g = L.saisonGruppen([{ id: 'a', datum: '2026-10-02', saison: '2026/27', mannschaft: 'U13' }, { id: 'b', datum: '2026-09-01', saison: '2026/27', mannschaft: 'U13' }, { id: 'c', datum: '2025-03-01', saison: '2024/25', mannschaft: 'U12' }]);
  assert.deepEqual(g.map(x => x.saison), ['2026/27', '2024/25']);
  assert.deepEqual(g[0].monate.map(m => m.ym), ['2026-10', '2026-09']);
});

test('Einheit passt zum Übungs-Filter, wenn eine ihrer Übungen passt', () => {
  const k = karte('Rondo', { merkmale: { hauptschwerpunkt: 'Pressing', artSpielform: 'Rondo' } });
  const e = { id: '2026-10-02', saison: '2026/27', jugend: 'D', qualitaet: 'hoch', schwerpunkte: [], bausteine: [{ karte: 'Rondo' }] };
  const f = { ...L.LEERER_FILTER(), art: ['Rondo'], schwerpunkt: ['Pressing'] };
  assert.ok(L.passtFilterEinheit(e, f, id => (id === 'Rondo' ? k : null), () => '2026/27'));
  assert.ok(!L.passtFilterEinheit(e, { ...f, art: ['Chaos'] }, id => (id === 'Rondo' ? k : null), () => '2026/27'));
});

test('Prüf-Hinweise', () => {
  const k = karte('XY', { merkmale: {}, varianten: [{ einheit: 'e', datum: '2026-01-01', label: 'H1', titel: 'XY', teile: [] }] });
  const h = L.hinweiseFuer(k, L.namenZaehlen([k, karte('XY')]));
  for (const x of ['offen', 'doppelt', 'titel', 'haupt', 'art', 'phase', 'skizze', 'text']) assert.ok(h.includes(x), x);
});

test('Text bearbeiten: Zeilen mit ↳ gehören zum Punkt davor', () => {
  assert.deepEqual(L.zeilenAusText('Erster Punkt\n↳ Zusatz\n\nZweiter'), ['Erster Punkt\n↳ Zusatz', 'Zweiter']);
});

test('Grundbestand: nur Aufgenommenes vollständig', () => {
  const s = standAus([{ id: 'e1', status: 'aufgenommen', datum: 'x', geaendert: 1 }, { id: 'e2', status: 'vorschlag', datum: 'y' }],
    [{ id: 'u1', status: 'zusammengelegt', ziel: 'u2', titel: 'a' }], 5);
  assert.deepEqual(s, { zeit: 5, einheiten: [{ id: 'e1', status: 'aufgenommen', datum: 'x' }, { id: 'e2', status: 'vorschlag' }], uebungen: [{ id: 'u1', status: 'zusammengelegt', ziel: 'u2' }] });
});
