import { daten, starten, beiAenderung, anmelden, abmelden, aendern, aendernMehrere } from './daten.js';
import { SPIELPHASEN, SCHWERPUNKT_GRUPPEN, ALLE_SCHWERPUNKTE, ZWEIKAMPF_UNTERPUNKTE, FORMEN, ZAHLEN, ARTEN, ORTE, JUGENDEN, QUALITAETEN, TEILE, teilVon } from './kategorien.js';

const $inhalt = document.getElementById('inhalt');
const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// ---------- Hilfen ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = encodeURIComponent;
const ico = {
  rechts: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  links: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  suche: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  seite: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/></svg>',
};
function datumDE(iso) { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; }
function wochentag(iso) { return WOCHENTAGE[new Date(iso + 'T12:00:00').getDay()]; }
function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/gegen|gg/g, 'gg').replace(/[^a-z0-9ß]+/g, ' ').trim(); }
function jugendText(j) { return j ? j + '-Jugend' : ''; }

const istAdmin = () => daten.admin;
const sichtbar = x => istAdmin() ? x.status !== 'verworfen' : x.status === 'aufgenommen';
const einheitVon = id => daten.einheiten.find(e => e.id === id);
const uebungVon = id => daten.uebungen.find(u => u.id === id);

function letzteVariante(u) { return [...u.varianten].sort((a, b) => b.datum.localeCompare(a.datum))[0]; }
function teileVonKarte(u) { return [...new Set(u.varianten.map(v => teilVon(v.label)).filter(Boolean))]; }
function saisonVon(iso) { const e = einheitVon(iso); return e ? e.saison : ''; }
function saisonenVonKarte(u) { return [...new Set(u.varianten.map(v => (einheitVon(v.einheit) || {}).saison).filter(Boolean))]; }

// ---------- Filter (bleiben während der Sitzung erhalten) ----------
const filter = { jugend: [], saison: [], qualitaet: [], teil: [], form: [], zahl: [], art: [], ort: [] };
const filterAktiv = () => Object.values(filter).some(v => v.length);
function passtFilter(u) {
  const m = u.merkmale || {};
  const hat = (liste, werte) => !liste.length || liste.some(x => werte.includes(x));
  return hat(filter.jugend, u.jugend || []) && hat(filter.saison, saisonenVonKarte(u)) && hat(filter.qualitaet, [u.qualitaet])
    && hat(filter.teil, teileVonKarte(u)) && hat(filter.form, [u.form]) && hat(filter.zahl, m.zahl || [])
    && hat(filter.art, [m.artSpielform]) && hat(filter.ort, m.ort || []);
}

// ---------- Bausteine der Oberfläche ----------
function zurueck(text, href) {
  return href ? `<a class="zurueck" href="${href}">${ico.links}${esc(text)}</a>` : `<button type="button" class="zurueck" data-zurueck>${ico.links}${esc(text)}</button>`;
}
function kachel(text, href, klein = '') {
  return `<a class="kachel" href="${href}"><span>${esc(text)}${klein ? `<small>${esc(klein)}</small>` : ''}</span>${ico.rechts}</a>`;
}
function uebungZeile(u) {
  const v = letzteVariante(u);
  const n = u.varianten.length;
  const hs = u.merkmale?.hauptschwerpunkt;
  const sub = [hs, u.form, n > 1 ? `${n}× eingesetzt, zuletzt ${datumDE(v.datum)}` : datumDE(v.datum)].filter(Boolean).join(' · ');
  const vorschlag = istAdmin() && u.status === 'vorschlag' ? ' <span class="chip vorschlag">Vorschlag</span>' : '';
  return `<a class="zeile" href="#/uebung/${enc(u.id)}"><span class="txt"><span class="t">${esc(u.titel)}${vorschlag}</span><span class="s">${esc(sub)}</span></span>${ico.rechts}</a>`;
}
function uebungsListe(liste, leerText = 'Keine Übungen gefunden.') {
  if (!liste.length) return `<div class="leer">${esc(leerText)}</div>`;
  liste = [...liste].sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
  return `<div class="gruppe">${liste.map(uebungZeile).join('')}</div>`;
}
function einheitZeile(e) {
  const vorschlag = istAdmin() && e.status === 'vorschlag' ? ' <span class="chip vorschlag">Vorschlag</span>' : '';
  const sub = [e.mannschaft, e.nummer || e.spieler, e.schwerpunkt].filter(Boolean).join(' · ');
  return `<a class="zeile" href="#/einheit/${enc(e.id)}"><span class="txt"><span class="t">${datumDE(e.datum)}${e.art === 'Trainingslager' ? ' · Trainingslager' : ''}${vorschlag}</span><span class="s">${esc(sub)}</span></span>${ico.rechts}</a>`;
}
function sucheLeiste(wert = '') {
  return `<form class="suche" data-suche role="search"><label>${ico.suche}<input type="search" name="q" value="${esc(wert)}" placeholder="Übung oder Einheit suchen" aria-label="Suche" enterkeyhint="search"></label>
  <a class="knopf-icon" href="#/filter" aria-label="Filter">${ico.filter}${filterAktiv() ? '<span class="punkt"></span>' : ''}</a></form>`;
}
function filterHinweis() {
  if (!filterAktiv()) return '';
  const t = Object.entries(filter).flatMap(([k, v]) => v.map(x => k === 'jugend' ? x + '-Jugend' : x)).join(', ');
  return `<div class="info">Filter aktiv: ${esc(t)} · <a href="#/filter">ändern</a></div>`;
}

// ---------- Seiten ----------
function seiteStart() {
  const U = daten.uebungen.filter(sichtbar);
  const anzahl = (pred) => U.filter(pred).length;
  const zahlTxt = n => n === 1 ? '1 Übung' : `${n} Übungen`;
  const leerHinweis = !U.length ? (istAdmin()
    ? `<div class="info">Noch nichts aufgenommen. Unter <a href="#/pruefen">Prüfen</a> liegen die Vorschläge bereit.</div>`
    : `<div class="leer">Hier ist noch nichts aufgenommen.</div>`) : '';
  return `<div class="kopf"><h1>Trainingsbibliothek</h1>${sucheLeiste()}</div>${filterHinweis()}${leerHinweis}
  <section class="abschnitt"><h2>Spielphasen</h2><div class="raster-2">
    ${SPIELPHASEN.map(p => kachel(p, `#/liste/spielphase/${enc(p)}`, zahlTxt(anzahl(u => (u.merkmale?.spielphasen || []).includes(p))))).join('')}
  </div></section>
  <section class="abschnitt"><h2>Schwerpunkte</h2><div class="raster-2">
    ${SCHWERPUNKT_GRUPPEN.map(g => g.punkte.length === 1 && g.punkte[0][0] === g.name
      ? kachel(g.name, `#/liste/schwerpunkt/${enc(g.name)}`, zahlTxt(anzahl(u => hatSchwerpunkt(u, g.name))))
      : kachel(g.name, `#/gruppe/${enc(g.name)}`, zahlTxt(anzahl(u => g.punkte.some(p => hatSchwerpunkt(u, p[0])))))).join('')}
  </div></section>
  <section class="abschnitt"><h2>Form</h2><div class="raster-2">${FORMEN.map(f => kachel(f, `#/liste/form/${enc(f)}`, zahlTxt(anzahl(u => u.form === f)))).join('')}</div></section>
  <section class="abschnitt"><h2>Zahlenverhältnis</h2><div class="raster-2">${ZAHLEN.map(z => kachel(z, `#/liste/zahl/${enc(z)}`, zahlTxt(anzahl(u => (u.merkmale?.zahl || []).includes(z))))).join('')}</div></section>
  <section class="abschnitt"><h2>Art der Spielform</h2><div class="raster-2">${ARTEN.map(a => kachel(a, `#/liste/art/${enc(a)}`, zahlTxt(anzahl(u => u.merkmale?.artSpielform === a)))).join('')}</div></section>
  <section class="abschnitt"><h2>Alle Übungen</h2><div class="raster-2">${kachel('Von A bis Z', '#/liste/alle/alle', zahlTxt(U.length))}</div></section>`;
}
function hatSchwerpunkt(u, s) { const m = u.merkmale || {}; return m.hauptschwerpunkt === s || (m.schwerpunkte || []).includes(s); }

function seiteGruppe(name) {
  const g = SCHWERPUNKT_GRUPPEN.find(x => x.name === name);
  if (!g) return seiteFehlt();
  const U = daten.uebungen.filter(sichtbar).filter(passtFilter);
  return `<div class="kopf">${zurueck('Start', '#/')}<div class="kopfzeile"><h1>${esc(g.name)}</h1><a class="knopf-icon" href="#/filter" aria-label="Filter">${ico.filter}${filterAktiv() ? '<span class="punkt"></span>' : ''}</a></div></div>${filterHinweis()}
  <div class="gruppe">${g.punkte.map(([p, erkl]) => {
    const n = U.filter(u => hatSchwerpunkt(u, p)).length;
    return `<a class="zeile" href="#/liste/schwerpunkt/${enc(p)}"><span class="txt"><span class="t">${esc(p)}</span><span class="s">${esc([erkl, n === 1 ? '1 Übung' : n + ' Übungen'].filter(Boolean).join(' · '))}</span></span>${ico.rechts}</a>`;
  }).join('')}</div>`;
}

function seiteListe(typ, wert) {
  let U = daten.uebungen.filter(sichtbar).filter(passtFilter);
  let titel = wert, zurueckHref = '#/';
  if (typ === 'spielphase') U = U.filter(u => (u.merkmale?.spielphasen || []).includes(wert));
  else if (typ === 'schwerpunkt') {
    const haupt = U.filter(u => u.merkmale?.hauptschwerpunkt === wert);
    const weitere = U.filter(u => u.merkmale?.hauptschwerpunkt !== wert && (u.merkmale?.schwerpunkte || []).includes(wert));
    const g = SCHWERPUNKT_GRUPPEN.find(x => x.punkte.some(p => p[0] === wert));
    if (g && !(g.punkte.length === 1 && g.punkte[0][0] === g.name)) zurueckHref = `#/gruppe/${enc(g.name)}`;
    return `<div class="kopf">${zurueck(g && zurueckHref !== '#/' ? g.name : 'Start', zurueckHref)}<div class="kopfzeile"><h1>${esc(wert)}</h1><a class="knopf-icon" href="#/filter" aria-label="Filter">${ico.filter}${filterAktiv() ? '<span class="punkt"></span>' : ''}</a></div></div>${filterHinweis()}
    <section class="abschnitt"><h2>Als Haupt-Schwerpunkt</h2>${uebungsListe(haupt)}</section>
    ${weitere.length ? `<section class="abschnitt"><h2>Als weiterer Schwerpunkt</h2>${uebungsListe(weitere)}</section>` : ''}`;
  }
  else if (typ === 'form') U = U.filter(u => u.form === wert);
  else if (typ === 'zahl') U = U.filter(u => (u.merkmale?.zahl || []).includes(wert));
  else if (typ === 'art') U = U.filter(u => u.merkmale?.artSpielform === wert);
  else if (typ === 'alle') titel = 'Alle Übungen';
  return `<div class="kopf">${zurueck('Start', zurueckHref)}<div class="kopfzeile"><h1>${esc(titel)}</h1><a class="knopf-icon" href="#/filter" aria-label="Filter">${ico.filter}${filterAktiv() ? '<span class="punkt"></span>' : ''}</a></div></div>${filterHinweis()}${uebungsListe(U)}`;
}

function sucheTreffer(q) {
  const w = norm(q).split(' ').filter(Boolean);
  if (!w.length) return { U: [], E: [] };
  const passt = text => { const t = norm(text); return w.every(x => t.includes(x)); };
  const U = daten.uebungen.filter(sichtbar).filter(passtFilter).filter(u => passt([
    u.titel, u.form, JSON.stringify(u.merkmale || {}),
    ...u.varianten.flatMap(v => [v.titel, ...v.teile.flatMap(t => t.zeilen)]),
  ].join(' ')));
  const E = daten.einheiten.filter(sichtbar).filter(e => passt([datumDE(e.datum), e.datum, e.schwerpunkt, e.mannschaft, e.saison, ...e.bausteine.map(b => b.titel)].join(' ')));
  return { U, E };
}
function seiteSuche(q) {
  const { U, E } = sucheTreffer(q);
  return `<div class="kopf">${zurueck('Start', '#/')}<h1>Suche</h1>${sucheLeiste(q)}</div>${filterHinweis()}
  <section class="abschnitt"><h2>Übungen (${U.length})</h2>${uebungsListe(U, 'Keine passende Übung.')}</section>
  <section class="abschnitt"><h2>Einheiten (${E.length})</h2>${E.length ? `<div class="gruppe">${E.sort((a, b) => b.datum.localeCompare(a.datum)).map(einheitZeile).join('')}</div>` : '<div class="leer">Keine passende Einheit.</div>'}</section>`;
}

function teileHtml(teile) {
  return teile.map(t => {
    const z = t.zeilen || [];
    if (t.art === 'cp') return `<section class="karte"><h2>Coachingpunkte</h2><ul>${z.filter(x => !/^CP:?$/.test(x)).map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
    if (t.art === 'ablauf') return `<section class="karte"><h2>Ablauf</h2><ul>${z.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
    if (t.art === 'kasten') return `<section class="karte"><div class="kasten">${esc(z.join('\n'))}</div></section>`;
    return `<section class="karte"><p>${esc(z.join('\n'))}</p></section>`;
  }).join('');
}
function skizzenHtml(sk) {
  if (!sk || !sk.length) return '<div class="keine-skizze">Keine Skizze auf der Seite</div>';
  return `<div class="skizzen">${sk.map(s => `<button type="button" class="skizze" data-gross="${esc(s)}" aria-label="Skizze vergrößern"><img src="${esc(s)}" alt="Skizze" loading="lazy"></button>`).join('')}</div>`;
}
function merkmaleHtml(u) {
  const m = u.merkmale || {};
  const zeilen = [
    ['Spielphase', (m.spielphasen || []).join(', ')],
    ['Haupt-Schwerpunkt', m.hauptschwerpunkt + ((m.zweikampf || []).length && m.hauptschwerpunkt === '1 gegen 1 und Zweikampf' ? ` (${m.zweikampf.join(', ')})` : '')],
    ['Weitere', (m.schwerpunkte || []).map(s => s === '1 gegen 1 und Zweikampf' && (m.zweikampf || []).length ? `${s} (${m.zweikampf.join(', ')})` : s).join(', ')],
    ['Form', u.form],
    ['Zahlenverhältnis', [(m.zahl || []).join(', '), m.zahlText].filter(Boolean).join(' · ')],
    ['Art der Spielform', m.artSpielform],
    ['Ort', (m.ort || []).join(', ')],
  ].filter(z => z[1]);
  return `<section class="karte"><h2>Merkmale</h2><dl class="merkmale">${zeilen.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></section>`;
}

const gewaehlteVariante = {};
function seiteUebung(id) {
  const u = uebungVon(id);
  if (!u || !sichtbar(u)) return seiteFehlt();
  const vs = [...u.varianten].sort((a, b) => b.datum.localeCompare(a.datum));
  const vi = Math.min(gewaehlteVariante[id] || 0, vs.length - 1);
  const v = vs[vi];
  const chips = [...teileVonKarte(u), ...(u.jugend || []).map(jugendText), 'Qualität ' + u.qualitaet].map(c => `<span class="chip">${esc(c)}</span>`).join('')
    + (u.status === 'vorschlag' ? '<span class="chip vorschlag">Vorschlag, noch nicht aufgenommen</span>' : '');
  const variantenWahl = vs.length > 1 ? `<section class="abschnitt"><h2>Eingesetzt (${vs.length}×)</h2><div class="varianten" role="group" aria-label="Variante wählen">${vs.map((x, i) => `<button type="button" data-variante="${i}" aria-pressed="${i === vi}">${datumDE(x.datum)}</button>`).join('')}</div>${v.titel !== u.titel ? `<div class="unter">Auf dieser Seite: ${esc(v.titel)}</div>` : ''}</section>` : '';
  const e = einheitVon(v.einheit);
  return `<div class="kopf"><div class="kopfzeile">${zurueck('Zurück')}${istAdmin() ? `<a class="knopf" href="#/bearbeiten/${enc(u.id)}">Bearbeiten</a>` : ''}</div>
    <h1>${esc(u.titel)}</h1><div class="chips">${chips}</div></div>
  ${variantenWahl}
  <div class="uebung-layout"><div class="abschnitt">${skizzenHtml(v.skizzen)}</div>
  <div class="abschnitt">${teileHtml(v.teile)}${merkmaleHtml(u)}
  ${e ? `<a class="zeile karte" style="flex-direction:row" href="#/einheit/${enc(e.id)}"><span class="txt"><span class="t">Aus der Einheit vom ${datumDE(e.datum)}${v.label ? ' · ' + esc(v.label) : ''}</span><span class="s">${esc(e.schwerpunkt)}</span></span>${ico.rechts}</a>` : ''}
  </div></div>`;
}

function bausteinZeile(b) {
  if (b.art === 'hinweis') return `<div class="hinweiszeile">${esc([b.titel, ...(b.zeilen || [])].join(' · '))}</div>`;
  const marke = `<span class="marke ${teilVon(b.label) === 'Hauptteil' ? 'h' : ''}">${esc(b.label || '–')}</span>`;
  const sub = b.form || '';
  const u = b.karte ? uebungVon(b.karte) : null;
  if (u && sichtbar(u)) {
    const hs = u.merkmale?.hauptschwerpunkt;
    return `<a class="zeile" href="#/uebung/${enc(u.id)}">${marke}<span class="txt"><span class="t">${esc(b.titel)}</span><span class="s">${esc([sub, hs].filter(Boolean).join(' · '))}</span></span>${ico.rechts}</a>`;
  }
  return `<div class="zeile" style="cursor:default">${marke}<span class="txt"><span class="t">${esc(b.titel)}</span><span class="s">${esc(sub ? sub + ' · nur Titel auf der Seite' : 'nur Titel auf der Seite')}</span></span></div>`;
}
function bausteinListe(e) {
  // Gruppen: „Teil 1/2“ (Trainingslager) als Zwischenüberschrift, darunter nach Aktivierung, Hauptteil, Abschlussspiel
  const out = [];
  let gruppe = null;
  const schliessen = () => { if (gruppe && gruppe.z.length) out.push(`<section class="abschnitt">${gruppe.t ? `<h2>${esc(gruppe.t)}</h2>` : ''}<div class="gruppe">${gruppe.z.join('')}</div></section>`); gruppe = null; };
  for (const b of e.bausteine) {
    if (b.art === 'abschnitt') { schliessen(); out.push(`<h2 style="font-size:17px;margin-top:6px">${esc(b.titel)}</h2>`); continue; }
    if (b.art === 'hinweis') { if (!gruppe) gruppe = { t: '', teil: null, z: [] }; gruppe.z.push(bausteinZeile(b)); continue; }
    const teil = teilVon(b.label) || 'Weitere';
    if (gruppe && gruppe.teil === null) { gruppe.teil = teil; gruppe.t = teil; }
    else if (!gruppe || gruppe.teil !== teil) { schliessen(); gruppe = { t: teil, teil, z: [] }; }
    gruppe.z.push(bausteinZeile(b));
  }
  schliessen();
  return out.join('');
}

function einheitKopf(e, zurueckText, zurueckHref) {
  const chips = [e.mannschaft, jugendText(e.jugend), e.spieler, e.nummer, 'Qualität ' + e.qualitaet].filter(Boolean).map(c => `<span class="chip">${esc(c)}</span>`).join('')
    + (e.status === 'vorschlag' && istAdmin() ? '<span class="chip vorschlag">Vorschlag</span>' : '');
  return `<div class="kopf">${zurueck(zurueckText, zurueckHref)}<span class="unter">Saison ${esc(e.saison)} · ${wochentag(e.datum)}${e.art === 'Trainingslager' ? ' · Trainingslager' : ''}</span>
  <h1>${datumDE(e.datum)}</h1><div class="chips">${chips}</div>${e.schwerpunkt ? `<span><span class="unter" style="font-size:14px">Schwerpunkt</span> · ${esc(e.schwerpunkt)}</span>` : ''}</div>`;
}
function qualitaetWahl(art, obj) {
  return `<section class="abschnitt"><h2>Qualität ändern</h2><div class="wahl klein" role="group" aria-label="Qualität">${QUALITAETEN.map(q => `<button type="button" data-qualitaet="${art}|${esc(obj.id)}|${q}" aria-pressed="${obj.qualitaet === q}">${q}</button>`).join('')}</div></section>`;
}

function seiteEinheit(id) {
  const e = einheitVon(id);
  if (!e || !sichtbar(e)) return seiteFehlt();
  return `${einheitKopf(e, 'Einheiten', '#/einheiten')}${bausteinListe(e)}
  <a class="knopf breit" href="#/einheit/${enc(e.id)}/ganz">${ico.seite}Ganze Trainingseinheit ansehen</a>
  ${istAdmin() ? qualitaetWahl('e', e) : ''}`;
}

function seiteEinheitGanz(id) {
  const e = einheitVon(id);
  if (!e || !sichtbar(e)) return seiteFehlt();
  const teile = e.bausteine.map(b => {
    if (b.art === 'abschnitt') return `<h2>${esc(b.titel)}</h2>`;
    if (b.art === 'hinweis') return `<div class="info">${esc([b.titel, ...(b.zeilen || [])].join(' · '))}</div>`;
    const kopf = `<h3>${esc([b.label ? b.label + ')' : '', b.form, b.titel].filter(Boolean).join(' '))}</h3>`;
    const u = b.karte ? uebungVon(b.karte) : null;
    const v = u ? u.varianten.find(x => x.einheit === e.id && x.label === b.label && x.titel === b.titel) || u.varianten.find(x => x.einheit === e.id) : null;
    if (!v) return `<div class="baustein">${kopf}<div class="unter">Nur Titel auf der Seite</div></div>`;
    return `<div class="baustein">${kopf}${skizzenHtml(v.skizzen)}${teileHtml(v.teile)}</div>`;
  }).join('');
  return `${einheitKopf(e, 'Einheit', `#/einheit/${enc(e.id)}`)}<div class="ganz abschnitt">${teile}</div>`;
}

function seiteEinheiten() {
  const E = daten.einheiten.filter(sichtbar).filter(e => !filter.saison.length || filter.saison.includes(e.saison)).filter(e => !filter.jugend.length || filter.jugend.includes(e.jugend)).filter(e => !filter.qualitaet.length || filter.qualitaet.includes(e.qualitaet));
  const saisons = [...new Set(E.map(e => e.saison))].sort().reverse();
  return `<div class="kopf"><h1>Einheiten</h1>${sucheLeiste()}</div>${filterHinweis()}
  ${E.length ? saisons.map(s => `<section class="abschnitt"><h2>Saison ${esc(s)}</h2><div class="gruppe">${E.filter(e => e.saison === s).sort((a, b) => b.datum.localeCompare(a.datum)).map(einheitZeile).join('')}</div></section>`).join('') : '<div class="leer">Noch keine Einheiten aufgenommen.</div>'}`;
}

function seiteFilter() {
  const saisons = [...new Set(daten.einheiten.map(e => e.saison))].sort();
  const gruppe = (titel, key, werte, anzeige = x => x) => `<section class="filter-gruppe"><h2>${esc(titel)}</h2><div class="wahl" role="group" aria-label="${esc(titel)}">${werte.map(w => `<button type="button" data-filter="${key}|${esc(w)}" aria-pressed="${filter[key].includes(w)}">${esc(anzeige(w))}</button>`).join('')}</div></section>`;
  return `<div class="kopf"><div class="kopfzeile">${zurueck('Zurück')}<button type="button" class="knopf" data-filter-zurueck>Zurücksetzen</button></div><h1>Filter</h1></div>
  ${gruppe('Jugend', 'jugend', JUGENDEN.map(j => j[0]), w => `${w} (${JUGENDEN.find(j => j[0] === w)[1]})`)}
  ${gruppe('Saison', 'saison', saisons)}
  ${gruppe('Qualität', 'qualitaet', QUALITAETEN)}
  ${gruppe('Teil der Einheit', 'teil', TEILE)}
  ${gruppe('Form', 'form', FORMEN)}
  ${gruppe('Zahlenverhältnis', 'zahl', ZAHLEN)}
  ${gruppe('Art der Spielform', 'art', ARTEN)}
  ${gruppe('Ort', 'ort', ORTE)}
  <button type="button" class="knopf primaer breit" data-zurueck>Treffer anzeigen</button>`;
}

// ---------- Prüfen und Bearbeiten (nur Phil) ----------
function anmeldeHinweis() {
  if (daten.modus !== 'firebase') return '';
  if (!daten.nutzer) return `<div class="kopf"><h1>Prüfen</h1></div><div class="karte"><p>Vorschläge prüfen und aufnehmen kann nur Phil. Dafür einmal mit Google anmelden.</p><button type="button" class="knopf primaer" data-anmelden>Mit Google anmelden</button></div>`;
  if (!istAdmin()) return `<div class="kopf"><h1>Prüfen</h1></div><div class="karte"><p>Angemeldet als ${esc(daten.nutzer.email)}. Dieses Konto darf nichts ändern.</p><button type="button" class="knopf" data-abmelden>Abmelden</button></div>`;
  return '';
}
function seitePruefen() {
  const h = anmeldeHinweis(); if (h) return h;
  const offen = daten.einheiten.filter(e => e.status === 'vorschlag').sort((a, b) => a.datum.localeCompare(b.datum));
  const fertig = daten.einheiten.filter(e => e.status === 'aufgenommen').length;
  return `<div class="kopf"><h1>Prüfen</h1><span class="unter">${offen.length} Einheiten warten, ${fertig} aufgenommen${daten.modus === 'vorschau' ? ' · Vorschau ohne Firebase, Änderungen bleiben nur in diesem Browser' : ''}</span></div>
  ${offen.length ? `<div class="gruppe">${offen.map(einheitZeilePruefen).join('')}</div>` : '<div class="info ok">Alles geprüft. Neue Vorschläge erscheinen hier, sobald neue Seiten verarbeitet sind.</div>'}
  ${daten.modus === 'firebase' ? `<button type="button" class="knopf" data-abmelden>Abmelden (${esc(daten.nutzer.email)})</button>` : ''}`;
}
function einheitZeilePruefen(e) {
  const n = e.bausteine.filter(b => b.art === 'uebung').length;
  return `<a class="zeile" href="#/pruefen/${enc(e.id)}"><span class="txt"><span class="t">${datumDE(e.datum)}${e.nummer ? ' · ' + esc(e.nummer) : ''}</span><span class="s">${esc([e.schwerpunkt, n + ' Übungen'].join(' · '))}</span></span>${ico.rechts}</a>`;
}
function seitePruefenEinheit(id) {
  const h = anmeldeHinweis(); if (h) return h;
  const e = einheitVon(id); if (!e) return seiteFehlt();
  const karten = [...new Set(e.bausteine.filter(b => b.karte).map(b => b.karte))].map(uebungVon).filter(Boolean);
  const zeile = u => {
    const m = u.merkmale || {};
    const schon = u.status === 'aufgenommen';
    const s = [m.hauptschwerpunkt || 'Haupt-Schwerpunkt fehlt', ...(m.schwerpunkte || [])].join(', ');
    const anderswo = u.varianten.filter(v => v.einheit !== e.id).length;
    return `<div class="zeile" style="align-items:flex-start">
      <input type="checkbox" ${schon ? 'checked disabled' : 'checked'} data-karte="${esc(u.id)}" aria-label="${esc(u.titel)} aufnehmen" style="width:22px;height:22px;margin-top:2px;accent-color:var(--ac)">
      <span class="txt"><span class="t">${esc(u.titel)}${schon ? ' <span class="chip">schon aufgenommen</span>' : ''}</span>
      <span class="s">${esc([u.form, s].join(' · '))}</span>
      ${anderswo ? `<span class="s">Auch an ${anderswo} anderen Tag${anderswo > 1 ? 'en' : ''}, als eine Karte zusammengefasst</span>` : ''}
      <span class="knopfreihe" style="margin-top:6px"><a class="knopf" style="height:34px;font-size:13px" href="#/uebung/${enc(u.id)}">Ansehen</a><a class="knopf" style="height:34px;font-size:13px" href="#/bearbeiten/${enc(u.id)}">Merkmale ändern</a></span></span></div>`;
  };
  return `${einheitKopf(e, 'Prüfen', '#/pruefen')}
  <div class="info">Datum aus der handschriftlichen Überschrift. Angehakte Übungen werden mit der Einheit aufgenommen.</div>
  <section class="abschnitt"><h2>Übungen dieser Einheit</h2><div class="gruppe">${karten.map(zeile).join('') || '<div class="hinweiszeile">Keine Übungen mit Inhalt</div>'}</div></section>
  <a class="knopf breit" href="#/einheit/${enc(e.id)}/ganz">${ico.seite}Ganze Trainingseinheit ansehen</a>
  ${qualitaetWahl('e', e)}
  <div class="knopfreihe"><button type="button" class="knopf primaer" data-aufnehmen="${esc(e.id)}">Aufnehmen</button></div>
  <button type="button" class="knopf gefahr breit" data-verwerfen="${esc(e.id)}">Einheit verwerfen</button>`;
}

function seiteBearbeiten(id) {
  const h = anmeldeHinweis(); if (h) return h;
  const u = uebungVon(id); if (!u) return seiteFehlt();
  const m = u.merkmale || {};
  const wahl = (titel, feld, werte, aktiv, mehrfach = true) => `<section class="filter-gruppe"><h2>${esc(titel)}</h2><div class="wahl klein" role="group" aria-label="${esc(titel)}">${werte.map(w => `<button type="button" data-merkmal="${feld}|${esc(w)}|${mehrfach ? 1 : 0}" aria-pressed="${(Array.isArray(aktiv) ? aktiv : [aktiv]).includes(w)}">${esc(w)}</button>`).join('')}</div></section>`;
  return `<div class="kopf">${zurueck('Zurück')}<h1>${esc(u.titel)}</h1><span class="unter">Merkmale ändern. Jede Änderung wird sofort gespeichert.</span></div>
  ${wahl('Spielphase', 'spielphasen', SPIELPHASEN, m.spielphasen || [])}
  ${wahl('Haupt-Schwerpunkt', 'hauptschwerpunkt', ALLE_SCHWERPUNKTE, m.hauptschwerpunkt || '', false)}
  ${wahl('Weitere Schwerpunkte', 'schwerpunkte', ALLE_SCHWERPUNKTE, m.schwerpunkte || [])}
  ${wahl('1 gegen 1: genauer', 'zweikampf', ZWEIKAMPF_UNTERPUNKTE, m.zweikampf || [])}
  ${wahl('Form', 'form', FORMEN, u.form, false)}
  ${wahl('Zahlenverhältnis', 'zahl', ZAHLEN, m.zahl || [])}
  ${u.form === 'Spielform' ? wahl('Art der Spielform', 'artSpielform', ARTEN, m.artSpielform || '', false) : ''}
  ${wahl('Ort (nur wenn klar erkennbar)', 'ort', ORTE, m.ort || [])}
  ${wahl('Jugend', 'jugend', JUGENDEN.map(j => j[0]), u.jugend || [])}
  ${qualitaetWahl('u', u)}
  <button type="button" class="knopf primaer breit" data-zurueck>Fertig</button>`;
}

function seiteFehlt() { return `<div class="kopf">${zurueck('Start', '#/')}<h1>Nicht gefunden</h1></div><div class="leer">Diese Seite gibt es nicht oder sie ist noch nicht aufgenommen.</div>`; }

// ---------- Router ----------
function route() {
  const h = decodeURIComponent(location.hash.replace(/^#/, '') || '/');
  const [pfad, query] = h.split('?');
  const p = pfad.split('/').filter(Boolean);
  const q = new URLSearchParams(query || '');
  let html, nav = 'start';
  if (!p.length) html = seiteStart();
  else if (p[0] === 'suche') html = seiteSuche(q.get('q') || '');
  else if (p[0] === 'gruppe') html = seiteGruppe(p.slice(1).join('/'));
  else if (p[0] === 'liste') html = seiteListe(p[1], p.slice(2).join('/'));
  else if (p[0] === 'uebung') html = seiteUebung(p[1]);
  else if (p[0] === 'einheit' && p[2] === 'ganz') { html = seiteEinheitGanz(p[1]); nav = 'einheiten'; }
  else if (p[0] === 'einheit') { html = seiteEinheit(p[1]); nav = 'einheiten'; }
  else if (p[0] === 'einheiten') { html = seiteEinheiten(); nav = 'einheiten'; }
  else if (p[0] === 'filter') html = seiteFilter();
  else if (p[0] === 'pruefen' && p[1]) { html = seitePruefenEinheit(p[1]); nav = 'pruefen'; }
  else if (p[0] === 'pruefen') { html = seitePruefen(); nav = 'pruefen'; }
  else if (p[0] === 'bearbeiten') { html = seiteBearbeiten(p[1]); nav = 'pruefen'; }
  else html = seiteFehlt();
  $inhalt.innerHTML = html;
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('aktiv', a.dataset.nav === nav));
  const z = document.getElementById('pruef-zaehler');
  const offen = istAdmin() ? daten.einheiten.filter(e => e.status === 'vorschlag').length : 0;
  z.hidden = !offen; z.textContent = offen;
}
let letzterHash = null;
function neuZeichnen(scrollOben) {
  const y = window.scrollY;
  route();
  if (scrollOben) { window.scrollTo(0, 0); $inhalt.focus({ preventScroll: true }); } else window.scrollTo(0, y);
}
window.addEventListener('hashchange', () => { neuZeichnen(location.hash !== letzterHash); letzterHash = location.hash; });

// ---------- Ereignisse ----------
document.addEventListener('submit', ev => {
  const f = ev.target.closest('[data-suche]'); if (!f) return;
  ev.preventDefault();
  const q = f.q.value.trim();
  location.hash = q ? '#/suche?q=' + enc(q) : '#/';
});
document.addEventListener('click', async ev => {
  const t = ev.target.closest('button, a'); if (!t) return;
  const d = t.dataset;
  if ('zurueck' in d) { if (history.length > 1) history.back(); else location.hash = '#/'; return; }
  if (d.gross) { const vb = document.getElementById('vollbild'); vb.querySelector('img').src = d.gross; vb.hidden = false; return; }
  if (t.classList.contains('vollbild-zu')) { document.getElementById('vollbild').hidden = true; return; }
  if (d.variante !== undefined) { const id = location.hash.split('/')[2]; gewaehlteVariante[decodeURIComponent(id)] = +d.variante; neuZeichnen(false); return; }
  if (d.filter) { const [k, w] = d.filter.split('|'); const i = filter[k].indexOf(w); i >= 0 ? filter[k].splice(i, 1) : filter[k].push(w); neuZeichnen(false); return; }
  if ('filterZurueck' in d) { Object.keys(filter).forEach(k => filter[k] = []); neuZeichnen(false); return; }
  if ('anmelden' in d) { try { await anmelden(); } catch (e) { alert('Anmeldung hat nicht geklappt: ' + (e.message || e)); } return; }
  if ('abmelden' in d) { await abmelden(); return; }
  if (d.qualitaet) { const [art, id, q] = d.qualitaet.split('|'); await speichere(() => aendern(art, id, { qualitaet: q })); return; }
  if (d.merkmal) { await merkmalUmschalten(d.merkmal); return; }
  if (d.aufnehmen) { await aufnehmen(d.aufnehmen); return; }
  if (d.verwerfen) {
    if (!confirm('Diese Einheit verwerfen? Sie erscheint dann nicht mehr unter Prüfen.')) return;
    const e = einheitVon(d.verwerfen);
    const nurHier = [...new Set(e.bausteine.filter(b => b.karte).map(b => b.karte))].map(uebungVon).filter(u => u && u.status === 'vorschlag' && u.varianten.every(v => v.einheit === e.id));
    await speichere(() => aendernMehrere([['e', e.id, { status: 'verworfen' }], ...nurHier.map(u => ['u', u.id, { status: 'verworfen' }])]));
    location.hash = '#/pruefen'; return;
  }
});
document.getElementById('vollbild').addEventListener('click', ev => { if (ev.target.id === 'vollbild' || ev.target.closest('.vollbild-zu')) ev.currentTarget.hidden = true; });

async function speichere(fn) {
  try { await fn(); } catch (e) { alert('Speichern hat nicht geklappt: ' + (e.message || e)); }
}
async function merkmalUmschalten(spec) {
  const [feld, wert, mehrfach] = spec.split('|');
  const id = decodeURIComponent(location.hash.split('/')[2]);
  const u = uebungVon(id); if (!u) return;
  if (feld === 'form') return speichere(() => aendern('u', id, { form: wert }));
  if (feld === 'jugend') {
    const l = [...(u.jugend || [])]; const i = l.indexOf(wert); i >= 0 ? l.splice(i, 1) : l.push(wert);
    return speichere(() => aendern('u', id, { jugend: l.sort() }));
  }
  const m = { ...(u.merkmale || {}) };
  if (mehrfach === '1') { const l = [...(m[feld] || [])]; const i = l.indexOf(wert); i >= 0 ? l.splice(i, 1) : l.push(wert); m[feld] = l; }
  else m[feld] = m[feld] === wert ? '' : wert;
  if (feld === 'hauptschwerpunkt' && m.hauptschwerpunkt) m.schwerpunkte = (m.schwerpunkte || []).filter(s => s !== m.hauptschwerpunkt);
  return speichere(() => aendern('u', id, { merkmale: m }));
}
async function aufnehmen(eid) {
  const e = einheitVon(eid);
  const haken = [...document.querySelectorAll('[data-karte]')];
  const an = haken.filter(h => h.checked && !h.disabled).map(h => h.dataset.karte);
  const ohneHaupt = an.map(uebungVon).filter(u => u && !u.merkmale?.hauptschwerpunkt);
  if (ohneHaupt.length && !confirm(`Bei ${ohneHaupt.map(u => '„' + u.titel + '“').join(', ')} fehlt der Haupt-Schwerpunkt. Trotzdem aufnehmen?`)) return;
  await speichere(() => aendernMehrere([['e', e.id, { status: 'aufgenommen' }], ...an.map(id => ['u', id, { status: 'aufgenommen' }])]));
  const naechste = daten.einheiten.filter(x => x.status === 'vorschlag').sort((a, b) => a.datum.localeCompare(b.datum))[0];
  location.hash = naechste ? '#/pruefen/' + enc(naechste.id) : '#/pruefen';
}

// ---------- Start ----------
beiAenderung(() => neuZeichnen(false));
starten().catch(e => { $inhalt.innerHTML = `<div class="kopf"><h1>Trainingsbibliothek</h1></div><div class="info">Die Daten konnten nicht geladen werden. Bitte später noch einmal öffnen. (${esc(e.message || e)})</div>`; });
letzterHash = location.hash;
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
