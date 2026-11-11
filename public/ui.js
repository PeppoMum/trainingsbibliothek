// Gemeinsame Bausteine der Oberfläche: Hilfen, Zustand je Gerät (Filter, Merkliste, Sortierung) und wiederkehrende Teile.
import { daten, einheitVon, karteVon } from './daten.js';
import * as L from './logik.js';
import { lesen, schreiben, ABLAGE } from './speicher.js';
import { teilVon } from './kategorien.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const enc = encodeURIComponent;
const svg = (inhalt, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true"${extra}>${inhalt}</svg>`;
export const ico = {
  rechts: svg('<path d="M9 6l6 6-6 6"/>'),
  links: svg('<path d="M15 6l-6 6 6 6"/>'),
  suche: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  filter: svg('<path d="M4 6h16M7 12h10M10 18h4"/>'),
  seite: svg('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>'),
  teilen: svg('<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v7h14v-7"/>'),
  merken: svg('<path d="M7 4h10v16l-5-4-5 4z"/>'),
  gemerkt: svg('<path d="M7 4h10v16l-5-4-5 4z"/>', ' class="voll"'),
  zu: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  klappe: '<svg class="klappe" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5"/></svg>',
  haken: svg('<path d="M5 12l5 5 9-10"/>'),
};

// ---------- Sichtbarkeit ----------
export const istAdmin = () => daten.admin;
// Einträge im Grundbestand, die nicht aufgenommen sind, stehen dort nur als Kurzform ohne Inhalt.
export const voll = x => !!x && (Array.isArray(x.varianten) || Array.isArray(x.bausteine));
export const sichtbar = x => voll(x) && (istAdmin() ? x.status !== 'verworfen' && x.status !== 'zusammengelegt' : x.status === 'aufgenommen');
export const alleKarten = () => daten.uebungen.filter(sichtbar);
export const alleEinheiten = () => daten.einheiten.filter(sichtbar);
export const saisonVonEinheit = id => (einheitVon(id) || {}).saison || '';
export const pdfVon = e => e.pdf || `pdf/${e.id}.pdf`;
export function karteSichtbar(id) { const u = karteVon(id); return sichtbar(u) ? u : null; }
export function einheitSichtbar(id) { const e = einheitVon(id); return sichtbar(e) ? e : null; }

// ---------- Filter (bleibt auf dem Gerät gespeichert) ----------
export const filter = L.LEERER_FILTER();
{
  const gespeichert = lesen(ABLAGE.filter, {});
  for (const k of Object.keys(filter)) if (Array.isArray(gespeichert[k])) filter[k] = gespeichert[k].filter(x => typeof x === 'string');
}
export function filterSpeichern() { schreiben(ABLAGE.filter, filter); }
export function filterLeeren() { for (const k of Object.keys(filter)) filter[k] = []; filterSpeichern(); }
export const filterAktiv = () => L.filterAktiv(filter);
export const passt = u => L.passtFilter(u, filter, saisonVonEinheit);
export const passtE = e => L.passtFilterEinheit(e, filter, karteVon, saisonVonEinheit);

// ---------- Merkliste (je Gerät) ----------
const merk = new Set(lesen(ABLAGE.merkliste, []));
export const gemerkt = id => merk.has(id);
export function merkenUmschalten(id) { merk.has(id) ? merk.delete(id) : merk.add(id); schreiben(ABLAGE.merkliste, [...merk]); }
export function merkKarten() {
  const gesehen = new Set();
  return [...merk].map(id => karteSichtbar(id)).filter(u => u && !gesehen.has(u.id) && gesehen.add(u.id));
}
export const istGemerkt = u => merk.has(u.id) || [...merk].some(id => id !== u.id && karteVon(id) === u);

// ---------- Sortierung ----------
let sortierung = lesen(ABLAGE.sortierung, 'zuletzt');
if (!L.SORTIERUNGEN.some(s => s[0] === sortierung)) sortierung = 'zuletzt';
export const aktSortierung = () => sortierung;
export function sortierungSetzen(s) { sortierung = s; schreiben(ABLAGE.sortierung, s); }

// ---------- Kleine Teile ----------
export const anzahlText = (n, eins, mehr) => n === 1 ? `1 ${eins}` : `${n} ${mehr}`;
export const uebungenText = n => anzahlText(n, 'Übung', 'Übungen');
export const einheitenText = n => anzahlText(n, 'Einheit', 'Einheiten');
export function jugendText(j) { return j ? j + '-Jugend' : ''; }
// Lange Wörter sauber trennen (sonst schiebt „Standardsituationen“ am kleinen iPhone die Kachel breiter)
export function trennbar(t) { return esc(t).replace(/Standardsituationen/g, 'Standard&shy;situationen').replace(/Aufdrehbewegungen/g, 'Aufdreh&shy;bewegungen'); }

export function zurueck(text, href) {
  return href ? `<a class="zurueck" href="${href}">${ico.links}${esc(text)}</a>` : `<button type="button" class="zurueck" data-zurueck>${ico.links}${esc(text)}</button>`;
}
export function kachel(text, href, klein = '') {
  return `<a class="kachel" href="${href}"><span class="kt"><span>${trennbar(text)}</span>${klein ? `<small>${esc(klein)}</small>` : ''}</span>${ico.rechts}</a>`;
}
export function filterKnopf() {
  return `<a class="knopf filterknopf" href="#/filter" aria-label="Filter">${ico.filter}<span class="nur-gross">Filter</span>${filterAktiv() ? '<span class="punkt" aria-hidden="true"></span>' : ''}</a>`;
}
export function sucheLeiste(wert = '') {
  return `<form class="suche" data-suche role="search"><label>${ico.suche}<input type="search" name="q" data-suchfeld value="${esc(wert)}" placeholder="Übung oder Einheit suchen" aria-label="Suche" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false"></label>${filterKnopf()}</form>`;
}
export function filterHinweis() {
  if (!filterAktiv()) return '';
  const t = Object.entries(filter).flatMap(([k, v]) => v.map(x => k === 'jugend' ? jugendText(x) : x)).join(', ');
  return `<div class="hinweis"><span class="ht">Filter: ${esc(t)}</span><a class="hk" href="#/filter">Ändern</a><button type="button" class="hzu" data-filter-weg aria-label="Filter löschen">${ico.zu}</button></div>`;
}
export function sortSchalter() {
  return `<div class="umschalter sortieren" role="group" aria-label="Sortieren">${L.SORTIERUNGEN.map(([k, t]) => `<button type="button" data-sort="${k}" aria-pressed="${k === sortierung}">${t}</button>`).join('')}</div>`;
}
// Kopf einer Liste: Titel, Sortierung, Filter
export function listenKopf(titel, zurueckHtml, mitSort = true) {
  return `<div class="kopf">${zurueckHtml || ''}<div class="listenkopf"><h1>${esc(titel)}</h1>${mitSort ? sortSchalter() : ''}${filterKnopf()}</div></div>${filterHinweis()}`;
}

export function uebungUnter(u) {
  const v = L.letzteVariante(u);
  const n = u.varianten.length;
  return [u.form, v ? (n > 1 ? `${n}× eingesetzt · zuletzt ${L.datumDE(v.datum)}` : L.datumDE(v.datum)) : ''].filter(Boolean).join(' · ');
}
// Übung als Zeile (iPhone) bzw. Karte mit Skizze (iPad, Mac)
export function uebungKarte(u, { stelle = '', href, ende = '' } = {}) {
  const bild = L.ersteSkizze(u);
  const vorschlag = istAdmin() && u.status === 'vorschlag' ? ' <span class="chip warn">Vorschlag</span>' : '';
  return `<div class="ukarte"><a class="uk-link" href="${href || '#/uebung/' + enc(u.id)}">
    <span class="ubild">${bild ? `<img src="${esc(bild)}" alt="Skizze" loading="lazy" decoding="async">` : '<span class="ohne">Keine Skizze auf der Seite</span>'}</span>
    <span class="utext"><span class="t">${esc(u.titel)}${vorschlag}</span><span class="s">${esc(uebungUnter(u))}</span>${stelle ? `<span class="s stelle">${esc(L.stelleKuerzen(stelle))}</span>` : ''}</span>
    ${istGemerkt(u) ? `<span class="merk" role="img" aria-label="Gemerkt">${ico.gemerkt}</span>` : ''}<span class="pfeil">${ico.rechts}</span></a>${ende}</div>`;
}
export function uebungsListe(liste, { leer = 'Keine Übungen gefunden.', sortiert = false, stellen } = {}) {
  if (!liste.length) return `<div class="leer">${esc(leer)}</div>`;
  const l = sortiert ? liste : L.sortiere(liste, sortierung);
  return `<div class="uliste">${l.map(u => uebungKarte(u, { stelle: stellen ? stellen.get(u.id) : '' })).join('')}</div>`;
}
export function abschnittKopf(titel, zusatz = '') {
  return `<div class="abkopf"><h2>${esc(titel)}</h2>${zusatz ? `<span class="unter">${esc(zusatz)}</span>` : ''}</div>`;
}

export function einheitUnter(e) {
  return [e.mannschaft, e.spieler, e.schwerpunkt].filter(Boolean).join(' · ');
}
export function einheitZeile(e, stelle = '') {
  const vorschlag = istAdmin() && e.status === 'vorschlag' ? ' <span class="chip warn">Vorschlag</span>' : '';
  const lager = e.art === 'Trainingslager' ? '<span class="lagerpunkt" role="img" aria-label="Trainingslager"></span>' : '';
  return `<a class="zeile" href="#/einheit/${enc(e.id)}"><span class="txt"><span class="t">${lager}${L.WT_KURZ[L.wochentagNr(e.datum)]} ${L.datumDE(e.datum)}${e.nummer ? ' · ' + esc(e.nummer) : ''}${e.art === 'Trainingslager' ? ' · Trainingslager' : ''}${vorschlag}</span><span class="s">${esc(einheitUnter(e))}</span>${stelle ? `<span class="s stelle">${esc(L.stelleKuerzen(stelle))}</span>` : ''}</span>${ico.rechts}</a>`;
}

export function teileHtml(teile) {
  return (teile || []).map(t => {
    const z = t.zeilen || [];
    if (t.art === 'cp') return `<section class="karte"><h2>Coachingpunkte</h2><ul>${z.filter(x => !/^CP:?$/.test(x)).map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
    if (t.art === 'ablauf') return `<section class="karte"><h2>Ablauf</h2><ul>${z.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
    if (t.art === 'kasten') return `<section class="karte"><div class="kasten">${esc(z.join('\n'))}</div></section>`;
    return `<section class="karte"><p>${esc(z.join('\n'))}</p></section>`;
  }).join('');
}
export function skizzenHtml(sk) {
  if (!sk || !sk.length) return '<div class="keine-skizze">Keine Skizze auf der Seite</div>';
  return `<div class="skizzen">${sk.map(s => `<button type="button" class="skizze" data-gross="${esc(s)}" aria-label="Skizze vergrößern"><img src="${esc(s)}" alt="Skizze" decoding="async"></button>`).join('')}</div>`;
}
export function merkmaleZeilen(u) {
  const m = u.merkmale || {};
  const zk = (m.zweikampf || []).length ? ` (${m.zweikampf.join(', ')})` : '';
  return [
    ['Spielphase', (m.spielphasen || []).join(', ')],
    ['Haupt-Schwerpunkt', m.hauptschwerpunkt ? m.hauptschwerpunkt + (m.hauptschwerpunkt === '1 gegen 1 und Zweikampf' ? zk : '') : ''],
    ['Weitere', (m.schwerpunkte || []).map(s => s === '1 gegen 1 und Zweikampf' ? s + zk : s).join(', ')],
    ['Form', u.form],
    ['Zahlenverhältnis', [(m.zahl || []).join(', '), m.zahlText].filter(Boolean).join(' · ')],
    ['Art der Spielform', m.artSpielform],
    ['Ort', (m.ort || []).join(', ')],
  ].filter(z => z[1]);
}
export function merkmaleHtml(u) {
  return `<section class="karte"><h2>Merkmale</h2><dl class="merkmale">${merkmaleZeilen(u).map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></section>`;
}
export function chipsUebung(u) {
  const m = u.merkmale || {};
  return [...L.teileVonKarte(u), u.form, m.zahlText, ...(u.jugend || []).map(jugendText)].filter(Boolean).map(c => `<span class="chip">${esc(c)}</span>`).join('');
}
export function teilDerKarte(u) { return L.teileVonKarte(u); }
export { teilVon };

export function seiteLaedt() { return '<div class="laden" role="status">Lädt …</div>'; }
export function seiteFehlt() {
  if (!daten.geladen) return seiteLaedt();
  return `<div class="kopf">${zurueck('Start', '#/')}<h1>Nicht gefunden</h1></div><div class="leer">Diese Seite gibt es nicht oder sie ist nicht in der Bibliothek.</div>`;
}
