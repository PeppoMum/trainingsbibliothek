// Nur für Phil: Prüfen, Merkmale, Titel und Text, Zusammenlegen, Abtrennen, Ausblenden, Papierkorb, Einheit bearbeiten.
import { daten, einheitVon, karteVon, anmelden, abmelden, aendern, aendernMehrere, neueKennung } from './daten.js';
import { SPIELPHASEN, SCHWERPUNKT_GRUPPEN, ALLE_SCHWERPUNKTE, ZWEIKAMPF_UNTERPUNKTE, FORMEN, ZAHLEN, ARTEN, ORTE, JUGENDEN, QUALITAETEN } from './kategorien.js';
import * as L from './logik.js';
import {
  esc, enc, ico, istAdmin, voll, sichtbar, alleKarten, karteSichtbar, zurueck, uebungKarte, abschnittKopf,
  uebungenText, einheitenText, teileHtml, skizzenHtml, merkmaleHtml, seiteLaedt, seiteFehlt, jugendText,
} from './ui.js';

let app = {};
export function einrichten(a) { app = a; }
let seitenTitel = '';
export const titel = () => seitenTitel;

const sortDatum = (a, b) => a.datum.localeCompare(b.datum);
const vorschlagEinheiten = () => daten.einheiten.filter(e => voll(e) && e.status === 'vorschlag').sort(sortDatum);
export function zaehler() { return vorschlagEinheiten().length; }
const variantenSortiert = u => [...u.varianten].sort((a, b) => b.datum.localeCompare(a.datum));
const varKey = v => `${v.einheit}#${v.label}#${v.titel}`;
const kartenDerEinheit = e => [...new Set(e.bausteine.filter(b => b.karte).map(b => b.karte))].map(id => karteVon(id)).filter(voll);
const nurInEinheit = (u, eid) => u.varianten.every(v => v.einheit === eid);

function anmeldeHinweis() {
  if (!daten.geladen) return seiteLaedt();
  if (daten.modus !== 'firebase') return '';
  if (!daten.nutzer) return `<div class="kopf"><h1>Prüfen</h1></div><div class="karte"><p>Prüfen und Ändern kann nur Phil. Dafür einmal mit Google anmelden.</p><button type="button" class="knopf primaer" data-anmelden>Mit Google anmelden</button></div>`;
  if (!istAdmin()) return `<div class="kopf"><h1>Prüfen</h1></div><div class="karte"><p>Angemeldet als ${esc(daten.nutzer.email)}. Dieses Konto darf nichts ändern.</p><button type="button" class="knopf" data-abmelden>Abmelden</button></div>`;
  return '';
}

export function route(p, q) {
  seitenTitel = 'Prüfen';
  const h = anmeldeHinweis(); if (h) return h;
  if (p[0] === 'einheit' && p[2] === 'bearbeiten') return seiteEinheitBearbeiten(p[1]);
  if (p[0] === 'einheit') return null;
  if (p[0] === 'papierkorb') return seitePapierkorb();
  if (p[0] === 'bearbeiten') {
    if (p[2] === 'text') return seiteText(p[1], +p[3] || 0);
    if (p[2] === 'zusammenlegen') return seiteZusammenlegen(p[1], q.q || '');
    return seiteMerkmale(p[1]);
  }
  if (p[1] === 'offen') return seiteArbeitsliste(p[2]);
  if (p[1] === 'karte') return seitePruefKarte(p[2], p[3] || 'offen');
  if (p[1] === 'ganz') return app.seiteEinheitGanz(p[2], zurueck('Zurück'));
  if (p[1]) return seitePruefenEinheit(p[1]);
  return seitePruefen();
}

// ---------- Übersicht ----------
function hinweisListe() {
  const K = alleKarten();
  const namen = L.namenZaehlen(K);
  return K.map(u => [u, L.hinweiseFuer(u, namen)]);
}
function karteMitHinweis(art) {
  const l = hinweisListe().filter(([, h]) => h.includes(art)).map(([u]) => u);
  if (art === 'doppelt') return l.sort((a, b) => L.norm(a.titel).localeCompare(L.norm(b.titel)) || L.zuletzt(b).localeCompare(L.zuletzt(a)));
  return L.sortiere(l, 'zuletzt');
}
function seitePruefen() {
  const vs = vorschlagEinheiten();
  const liste = hinweisListe();
  const gesamt = liste.length;
  const angesehen = liste.filter(([u]) => u.geprueft).length;
  const anteil = gesamt ? Math.round(angesehen / gesamt * 100) : 0;
  const zahl = art => liste.filter(([, h]) => h.includes(art)).length;
  const korb = daten.uebungen.filter(u => voll(u) && u.status === 'verworfen').length + daten.einheiten.filter(e => voll(e) && e.status === 'verworfen').length;
  return `<div class="kopf"><h1>Prüfen</h1></div>
  ${daten.modus === 'vorschau' ? '<div class="hinweis"><span class="ht">Vorschau: Änderungen bleiben nur in diesem Browser.</span></div>' : ''}
  ${vs.length ? `<section class="abschnitt">${abschnittKopf('Neue Vorschläge', einheitenText(vs.length))}<div class="gruppe">${vs.map(e => {
    const n = e.bausteine.filter(b => b.art === 'uebung').length;
    return `<a class="zeile" href="#/pruefen/${enc(e.id)}"><span class="txt"><span class="t">${L.WT_KURZ[L.wochentagNr(e.datum)]} ${L.datumDE(e.datum)}${e.nummer ? ' · ' + esc(e.nummer) : ''}</span><span class="s">${esc([e.schwerpunkt, uebungenText(n)].filter(Boolean).join(' · '))}</span></span>${ico.rechts}</a>`;
  }).join('')}</div></section>` : ''}
  <section class="abschnitt">${abschnittKopf('Einordnung', `${angesehen} von ${gesamt} angesehen`)}
    <div class="fortschritt" role="progressbar" aria-valuemin="0" aria-valuemax="${gesamt}" aria-valuenow="${angesehen}" aria-label="Angesehen"><span style="width:${anteil}%"></span></div>
    <div class="gruppe">${L.HINWEISE.map(([art, text]) => {
      const n = zahl(art);
      return n ? `<a class="zeile" href="#/pruefen/offen/${art}"><span class="txt"><span class="t">${esc(text)}</span></span><span class="zahl">${n}</span>${ico.rechts}</a>` : '';
    }).join('') || '<div class="hinweiszeile">Alles eingeordnet.</div>'}</div>
  </section>
  <div class="gruppe"><a class="zeile" href="#/papierkorb"><span class="txt"><span class="t">Papierkorb</span></span><span class="zahl">${korb}</span>${ico.rechts}</a></div>
  ${daten.modus === 'firebase' ? `<button type="button" class="knopf" data-abmelden>Abmelden</button>` : ''}`;
}

function seiteArbeitsliste(art) {
  const h = L.HINWEISE.find(x => x[0] === art);
  if (!h) return seiteFehlt();
  seitenTitel = h[1];
  const K = karteMitHinweis(art);
  return `<div class="kopf">${zurueck('Prüfen', '#/pruefen')}<div class="listenkopf"><h1>${esc(h[1])}</h1><span class="unter">${uebungenText(K.length)}</span></div></div>
  ${K.length ? `<div class="uliste">${K.map(u => uebungKarte(u, { href: `#/pruefen/karte/${enc(u.id)}/${art}` })).join('')}</div>` : '<div class="leer">Nichts mehr offen.</div>'}`;
}

function seitePruefKarte(id, art) {
  const u = karteSichtbar(id);
  if (!u) return seiteFehlt();
  seitenTitel = u.titel;
  const liste = karteMitHinweis(art);
  const pos = liste.findIndex(x => x.id === u.id);
  const namen = L.namenZaehlen(alleKarten());
  const hinweise = L.hinweiseFuer(u, namen).filter(x => x !== 'offen').map(x => (L.HINWEISE.find(y => y[0] === x) || [])[1]).filter(Boolean);
  const v = variantenSortiert(u)[0];
  const gleich = alleKarten().filter(x => x.id !== u.id && L.norm(x.titel) === L.norm(u.titel));
  return `<div class="kopf">${zurueck(L.HINWEISE.find(x => x[0] === art)?.[1] || 'Prüfen', `#/pruefen/offen/${art}`)}
    ${pos >= 0 ? `<span class="unter">${pos + 1} von ${liste.length}</span>` : ''}
    <h1>${esc(u.titel)}</h1>
    <div class="chips">${hinweise.map(t => `<span class="chip warn">${esc(t)}</span>`).join('')}${u.geprueft ? `<span class="chip ac">${ico.haken}Angesehen</span>` : ''}</div>
    <div class="knopfreihe aktionen"><a class="knopf" href="#/bearbeiten/${enc(u.id)}">Merkmale</a><a class="knopf" href="#/bearbeiten/${enc(u.id)}/text/0">Titel und Text</a><a class="knopf" href="#/bearbeiten/${enc(u.id)}/zusammenlegen">Zusammenlegen</a></div></div>
  ${gleich.length ? `<section class="abschnitt">${abschnittKopf('Gleicher Name', uebungenText(gleich.length))}<div class="uliste">${gleich.map(x => uebungKarte(x, { ende: `<button type="button" class="knopf klein" data-zusammen="${esc(u.id)}|${esc(x.id)}">Hierher holen</button>` })).join('')}</div></section>` : ''}
  <div class="zweispaltig"><div class="abschnitt">${skizzenHtml(v.skizzen)}</div>
  <div class="abschnitt">${teileHtml(v.teile)}${merkmaleHtml(u)}
  <div class="unter">${esc([`${u.varianten.length}× eingesetzt`, `zuletzt ${L.datumDE(v.datum)}`, `Qualität ${u.qualitaet}`, (u.jugend || []).map(jugendText).join(', ')].filter(Boolean).join(' · '))}</div></div></div>
  <div class="fuss-leiste"><button type="button" class="knopf" data-weiter="${esc(u.id)}|${esc(art)}|0">Überspringen</button><button type="button" class="knopf primaer" data-weiter="${esc(u.id)}|${esc(art)}|1">${ico.haken}Angesehen, weiter</button></div>`;
}

// ---------- Neue Vorschläge (ganze Einheit) ----------
const abgewaehlt = new Map(); // Einheit → Karten ohne Haken
function seitePruefenEinheit(id) {
  const e = einheitVon(id);
  if (!voll(e)) return seiteFehlt();
  seitenTitel = L.datumDE(e.datum);
  const aus = abgewaehlt.get(e.id) || new Set();
  const zeile = u => {
    const m = u.merkmale || {};
    const schon = u.status === 'aufgenommen';
    const s = [m.hauptschwerpunkt || 'Haupt-Schwerpunkt fehlt', ...(m.schwerpunkte || [])].join(', ');
    const anderswo = u.varianten.filter(v => v.einheit !== e.id).length;
    return `<div class="zeile pruefzeile">
      <input type="checkbox" ${schon ? 'checked disabled' : aus.has(u.id) ? '' : 'checked'} data-haken="${esc(e.id)}|${esc(u.id)}" aria-label="${esc(u.titel)} aufnehmen">
      <span class="txt"><span class="t">${esc(u.titel)}${schon ? ' <span class="chip">schon aufgenommen</span>' : ''}</span>
      <span class="s">${esc([u.form, s].filter(Boolean).join(' · '))}</span>
      ${anderswo ? `<span class="s">Auch an ${anderswo} anderen Tag${anderswo > 1 ? 'en' : ''}, als eine Karte zusammengefasst</span>` : ''}
      <span class="knopfreihe"><a class="knopf klein" href="#/uebung/${enc(u.id)}">Ansehen</a><a class="knopf klein" href="#/bearbeiten/${enc(u.id)}">Merkmale</a></span></span></div>`;
  };
  const karten = kartenDerEinheit(e).filter(u => u.status !== 'verworfen');
  return `${app.einheitKopf(e, zurueck('Prüfen', '#/pruefen'))}
  <section class="abschnitt"><h2>Übungen dieser Einheit</h2><div class="gruppe">${karten.map(zeile).join('') || '<div class="hinweiszeile">Keine Übungen mit Inhalt</div>'}</div></section>
  <a class="knopf breit" href="#/pruefen/ganz/${enc(e.id)}">${ico.seite}Ganze Trainingseinheit ansehen</a>
  <section class="abschnitt"><h2>Qualität</h2>${qualitaetWahl('e', e)}</section>
  <div class="knopfreihe"><button type="button" class="knopf gefahr" data-verwerfen="${esc(e.id)}">Verwerfen</button><button type="button" class="knopf primaer" data-aufnehmen="${esc(e.id)}">Aufnehmen</button></div>`;
}
function qualitaetWahl(art, obj) {
  return `<div class="umschalter breit" role="group" aria-label="Qualität">${QUALITAETEN.map(q => `<button type="button" data-qualitaet="${art}|${esc(obj.id)}|${q}" aria-pressed="${obj.qualitaet === q}">${q}</button>`).join('')}</div>`;
}
document.addEventListener('change', ev => {
  const h = ev.target.closest && ev.target.closest('[data-haken]'); if (!h) return;
  const [eid, uid] = h.dataset.haken.split('|');
  if (!abgewaehlt.has(eid)) abgewaehlt.set(eid, new Set());
  const s = abgewaehlt.get(eid);
  h.checked ? s.delete(uid) : s.add(uid);
});

// ---------- Merkmale ändern ----------
const offeneGruppen = new Set();
export function toggle(d) {
  if (d.matches('details[data-gruppe]')) d.open ? offeneGruppen.add(d.dataset.gruppe) : offeneGruppen.delete(d.dataset.gruppe);
}
function seiteMerkmale(id) {
  const u = karteVon(id);
  if (!voll(u) || u.status === 'verworfen') return seiteFehlt();
  seitenTitel = u.titel;
  const m = u.merkmale || {};
  const knoepfe = (feld, werte, aktiv, mehrfach) => `<div class="wahl">${werte.map(w => `<button type="button" data-merkmal="${esc(u.id)}|${feld}|${esc(w)}|${mehrfach ? 1 : 0}" aria-pressed="${(Array.isArray(aktiv) ? aktiv : [aktiv]).includes(w)}">${esc(w)}</button>`).join('')}</div>`;
  const gruppe = (t, key, wert, inhalt) => `<details class="filter-zeile" data-gruppe="${key}"${offeneGruppen.has(key) ? ' open' : ''}><summary>${ico.klappe}<span class="txt"><span class="t">${esc(t)}</span><span class="s${wert ? ' gewaehlt' : ''}">${esc(wert || 'nichts gewählt')}</span></span></summary><div class="filter-inhalt">${inhalt}</div></details>`;
  const swGruppen = (feld, aktiv, mehrfach) => SCHWERPUNKT_GRUPPEN.map(g => `<div class="filter-unter"><h3>${esc(g.name)}</h3>${knoepfe(feld, [...new Set(g.punkte.map(p => p[0]))], aktiv, mehrfach)}</div>`).join('');
  const zk = m.hauptschwerpunkt === '1 gegen 1 und Zweikampf' || (m.schwerpunkte || []).includes('1 gegen 1 und Zweikampf');
  const vs = variantenSortiert(u);
  return `<div class="kopf">${zurueck('Zurück')}<h1>${esc(u.titel)}</h1>
    <div class="knopfreihe aktionen"><a class="knopf" href="#/bearbeiten/${enc(u.id)}/text/0">Titel und Text</a><a class="knopf" href="#/bearbeiten/${enc(u.id)}/zusammenlegen">Zusammenlegen</a><button type="button" class="knopf gefahr" data-ausblenden="u|${esc(u.id)}">Ausblenden</button></div></div>
  <div class="gruppe filter-liste">
  ${gruppe('Spielphase', 'spielphasen', (m.spielphasen || []).join(', '), knoepfe('spielphasen', SPIELPHASEN, m.spielphasen || [], true))}
  ${gruppe('Haupt-Schwerpunkt', 'haupt', m.hauptschwerpunkt, swGruppen('hauptschwerpunkt', m.hauptschwerpunkt || '', false))}
  ${gruppe('Weitere Schwerpunkte', 'weitere', (m.schwerpunkte || []).join(', '), swGruppen('schwerpunkte', m.schwerpunkte || [], true))}
  ${zk ? gruppe('1 gegen 1 genauer', 'zweikampf', (m.zweikampf || []).join(', '), knoepfe('zweikampf', ZWEIKAMPF_UNTERPUNKTE, m.zweikampf || [], true)) : ''}
  ${gruppe('Form', 'form', u.form, knoepfe('form', FORMEN, u.form, false))}
  ${gruppe('Zahlenverhältnis', 'zahl', [(m.zahl || []).join(', '), m.zahlText].filter(Boolean).join(' · '), knoepfe('zahl', ZAHLEN, m.zahl || [], true))}
  ${u.form === 'Spielform' ? gruppe('Art der Spielform', 'art', m.artSpielform, knoepfe('artSpielform', ARTEN, m.artSpielform || '', false)) : ''}
  ${gruppe('Ort', 'ort', (m.ort || []).join(', '), knoepfe('ort', ORTE, m.ort || [], true))}
  ${gruppe('Jugend', 'jugend', (u.jugend || []).map(jugendText).join(', '), knoepfe('jugend', JUGENDEN.map(j => j[0]), u.jugend || [], true))}
  ${gruppe('Qualität', 'qualitaet', u.qualitaet, qualitaetWahl('u', u))}
  </div>
  <div class="gruppe"><button type="button" class="zeile" data-geprueft="${esc(u.id)}" aria-pressed="${!!u.geprueft}"><span class="haken-feld${u.geprueft ? ' an' : ''}">${u.geprueft ? ico.haken : ''}</span><span class="txt"><span class="t">Von mir angesehen</span></span></button></div>
  <section class="abschnitt">${abschnittKopf('Einsätze', `${vs.length}×`)}<div class="gruppe">${vs.map((v, i) => `<div class="zeile still"><span class="txt"><span class="t">${L.datumDE(v.datum)}${v.label ? ' · ' + esc(v.label) : ''}</span><span class="s">${esc(v.titel)}</span></span>
    <span class="knopfreihe eng"><a class="knopf klein" href="#/bearbeiten/${enc(u.id)}/text/${i}">Text</a>${vs.length > 1 ? `<button type="button" class="knopf klein" data-abtrennen="${esc(u.id)}|${i}">Abtrennen</button>` : ''}</span></div>`).join('')}</div></section>
  <button type="button" class="knopf primaer breit" data-zurueck>Fertig</button>`;
}

// ---------- Titel und Text ----------
const TEIL_NAMEN = { ablauf: 'Ablauf', cp: 'Coachingpunkte', kasten: 'Kasten', text: 'Text' };
function seiteText(id, i) {
  const u = karteVon(id);
  if (!voll(u)) return seiteFehlt();
  seitenTitel = u.titel;
  const vs = variantenSortiert(u);
  const v = vs[Math.min(Math.max(i, 0), vs.length - 1)];
  const vi = vs.indexOf(v);
  return `<div class="kopf">${zurueck('Zurück')}<h1>Titel und Text</h1></div>
  ${vs.length > 1 ? `<div class="varianten" role="group" aria-label="Einsatz wählen">${vs.map((x, j) => `<a href="#/bearbeiten/${enc(u.id)}/text/${j}" role="button" aria-pressed="${j === vi}">${L.datumDE(x.datum)}</a>`).join('')}</div>` : ''}
  <form class="formular" data-textform="${esc(u.id)}|${vi}">
    <label class="feld"><span>Titel der Karte</span><input name="titel" value="${esc(u.titel)}" required></label>
    <label class="feld"><span>Titel auf der Seite vom ${L.datumDE(v.datum)}</span><input name="vtitel" value="${esc(v.titel)}"></label>
    ${(v.teile || []).map((t, k) => `<label class="feld"><span>${esc(TEIL_NAMEN[t.art] || 'Text')}</span><textarea name="teil-${k}" rows="${Math.min(14, Math.max(3, (t.zeilen || []).join('\n').split('\n').length + 1))}">${esc((t.zeilen || []).join('\n'))}</textarea></label>`).join('')}
    <div class="knopfreihe"><button type="button" class="knopf" data-zurueck>Abbrechen</button><button type="submit" class="knopf primaer">Speichern</button></div>
  </form>`;
}
document.addEventListener('submit', async ev => {
  const f = ev.target;
  if (f.dataset.textform) {
    ev.preventDefault();
    const [id, vi] = f.dataset.textform.split('|');
    const u = karteVon(id); if (!u) return;
    const v = variantenSortiert(u)[+vi];
    const neuV = { ...v, titel: f.vtitel.value.trim() || v.titel, teile: (v.teile || []).map((t, k) => ({ ...t, zeilen: L.zeilenAusText(f.elements['teil-' + k].value) })) };
    const varianten = u.varianten.map(x => x === v ? neuV : x);
    const liste = [['u', u.id, { titel: f.titel.value.trim() || u.titel, varianten }]];
    const e = einheitVon(v.einheit);
    if (voll(e) && neuV.titel !== v.titel) {
      liste.push(['e', e.id, { bausteine: e.bausteine.map(b => b.karte && karteVon(b.karte) === u && b.label === v.label && b.titel === v.titel ? { ...b, titel: neuV.titel } : b) }]);
    }
    f.querySelector('[type=submit]').disabled = true;
    if (await speichere(() => aendernMehrere(liste))) history.back();
    else f.querySelector('[type=submit]').disabled = false;
  }
  if (f.dataset.einheitform) {
    ev.preventDefault();
    const e = einheitVon(f.dataset.einheitform); if (!e) return;
    const datum = f.datum.value || e.datum;
    const felder = { datum, saison: saisonVonDatum(datum), mannschaft: f.mannschaft.value.trim(), spieler: f.spieler.value.trim(), nummer: f.nummer.value.trim(), schwerpunkt: f.schwerpunkt.value.trim(), art: f.art.value };
    const liste = [['e', e.id, felder]];
    if (datum !== e.datum) {
      for (const u of daten.uebungen.filter(x => voll(x) && x.varianten.some(v => v.einheit === e.id))) {
        liste.push(['u', u.id, { varianten: u.varianten.map(v => v.einheit === e.id ? { ...v, datum } : v) }]);
      }
    }
    f.querySelector('[type=submit]').disabled = true;
    if (await speichere(() => aendernMehrere(liste))) history.back();
    else f.querySelector('[type=submit]').disabled = false;
  }
});
function saisonVonDatum(iso) { const [y, m] = iso.split('-').map(Number); const a = m >= 7 ? y : y - 1; return `${a}/${String((a + 1) % 100).padStart(2, '0')}`; }

// ---------- Zusammenlegen ----------
function kandidaten(u, q) {
  const andere = alleKarten().filter(x => x.id !== u.id);
  if (q.trim()) {
    const w = L.suchWoerter(q, null);
    return andere.map(x => [x, L.bewerte(L.suchIndexUebung(x), w)]).filter(x => x[1]).sort((a, b) => b[1].punkte - a[1].punkte).slice(0, 40).map(x => x[0]);
  }
  return andere.map(x => [x, L.aehnlichkeit(u, x)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 30).map(x => x[0]);
}
function kandidatenHtml(u, q) {
  const l = kandidaten(u, q);
  return l.length ? `<div class="uliste">${l.map(x => uebungKarte(x, { ende: `<button type="button" class="knopf klein" data-zusammen="${esc(u.id)}|${esc(x.id)}">Hierher holen</button>` })).join('')}</div>` : '<div class="leer">Keine passende Karte.</div>';
}
function seiteZusammenlegen(id, q) {
  const u = karteSichtbar(id);
  if (!u) return seiteFehlt();
  seitenTitel = 'Zusammenlegen';
  return `<div class="kopf">${zurueck('Zurück')}<h1>Zusammenlegen</h1></div>
  <section class="abschnitt"><h2>Diese Karte behält Titel und Merkmale</h2><div class="uliste">${uebungKarte(u)}</div></section>
  <section class="abschnitt"><h2>Andere Karte hierher holen</h2>
  <form class="suche" data-zl-form><label>${ico.suche}<input type="search" name="q" data-zl-suche="${esc(u.id)}" value="${esc(q)}" placeholder="Karte suchen" aria-label="Karte suchen" autocomplete="off"></label></form>
  <div id="zl-liste">${kandidatenHtml(u, q)}</div></section>`;
}
document.addEventListener('input', ev => {
  const f = ev.target; if (!f.matches || !f.matches('[data-zl-suche]')) return;
  const u = karteVon(f.dataset.zlSuche); if (!u) return;
  history.replaceState(null, '', `#/bearbeiten/${enc(u.id)}/zusammenlegen${f.value.trim() ? '?q=' + enc(f.value) : ''}`);
  document.getElementById('zl-liste').innerHTML = kandidatenHtml(u, f.value);
});
document.addEventListener('submit', ev => { if (ev.target.matches('[data-zl-form]')) { ev.preventDefault(); ev.target.q.blur(); } });

async function zusammenlegen(zielId, quelleId) {
  const ziel = karteVon(zielId), quelle = karteVon(quelleId);
  if (!voll(ziel) || !voll(quelle) || ziel === quelle) return;
  if (!confirm(`„${quelle.titel}“ in diese Karte holen? Die Einsätze wandern zu „${ziel.titel}“, die andere Karte verschwindet aus der Bibliothek.`)) return;
  const da = new Set(ziel.varianten.map(varKey));
  const varianten = [...ziel.varianten, ...quelle.varianten.filter(v => !da.has(varKey(v)))].sort(sortDatum);
  const jugend = [...new Set([...(ziel.jugend || []), ...(quelle.jugend || [])])].sort();
  const liste = [['u', ziel.id, { varianten, jugend }], ['u', quelle.id, { status: 'zusammengelegt', ziel: ziel.id, vorher: quelle.status }]];
  for (const e of daten.einheiten.filter(x => voll(x) && x.bausteine.some(b => b.karte === quelle.id))) {
    liste.push(['e', e.id, { bausteine: e.bausteine.map(b => b.karte === quelle.id ? { ...b, karte: ziel.id } : b) }]);
  }
  if (await speichere(() => aendernMehrere(liste))) app.neuZeichnen(false);
}

async function abtrennen(id, i) {
  const u = karteVon(id); if (!voll(u) || u.varianten.length < 2) return;
  const v = variantenSortiert(u)[i]; if (!v) return;
  if (!confirm(`Den Einsatz vom ${L.datumDE(v.datum)} („${v.titel}“) als eigene Karte ablegen?`)) return;
  const neuId = neueKennung();
  const karte = { id: neuId, titel: v.titel || u.titel, form: u.form, merkmale: JSON.parse(JSON.stringify(u.merkmale || {})), jugend: [...(u.jugend || [])], qualitaet: u.qualitaet, status: u.status, varianten: [v] };
  const liste = [['neu-u', neuId, karte], ['u', u.id, { varianten: u.varianten.filter(x => x !== v) }]];
  const e = einheitVon(v.einheit);
  if (voll(e)) liste.push(['e', e.id, { bausteine: e.bausteine.map(b => b.karte && karteVon(b.karte) === u && b.label === v.label && b.titel === v.titel ? { ...b, karte: neuId } : b) }]);
  if (await speichere(() => aendernMehrere(liste))) app.geheZu(`#/bearbeiten/${enc(neuId)}`);
}

// ---------- Papierkorb ----------
function seitePapierkorb() {
  seitenTitel = 'Papierkorb';
  const K = daten.uebungen.filter(u => voll(u) && u.status === 'verworfen').sort((a, b) => L.zuletzt(b).localeCompare(L.zuletzt(a)));
  const E = daten.einheiten.filter(e => voll(e) && e.status === 'verworfen').sort((a, b) => b.datum.localeCompare(a.datum));
  const knopf = (art, id) => `<button type="button" class="knopf klein" data-zurueckholen="${art}|${esc(id)}">Zurückholen</button>`;
  return `<div class="kopf">${zurueck('Prüfen', '#/pruefen')}<h1>Papierkorb</h1></div>
  ${!K.length && !E.length ? '<div class="leer">Der Papierkorb ist leer.</div>' : ''}
  ${K.length ? `<section class="abschnitt">${abschnittKopf('Übungen', uebungenText(K.length))}<div class="gruppe">${K.map(u => `<div class="zeile still"><span class="txt"><span class="t">${esc(u.titel)}</span><span class="s">${esc([u.form, L.datumDE(L.zuletzt(u))].filter(Boolean).join(' · '))}</span></span>${knopf('u', u.id)}</div>`).join('')}</div></section>` : ''}
  ${E.length ? `<section class="abschnitt">${abschnittKopf('Einheiten', einheitenText(E.length))}<div class="gruppe">${E.map(e => `<div class="zeile still"><span class="txt"><span class="t">${L.datumDE(e.datum)}</span><span class="s">${esc([e.mannschaft, e.schwerpunkt].filter(Boolean).join(' · '))}</span></span>${knopf('e', e.id)}</div>`).join('')}</div></section>` : ''}`;
}

// ---------- Einheit bearbeiten ----------
function seiteEinheitBearbeiten(id) {
  const e = einheitVon(id);
  if (!voll(e) || e.status === 'verworfen') return seiteFehlt();
  seitenTitel = L.datumDE(e.datum);
  const akt = e.schwerpunkte || [];
  return `<div class="kopf">${zurueck('Zurück')}<h1>Einheit bearbeiten</h1></div>
  <form class="formular" data-einheitform="${esc(e.id)}">
    <div class="feldreihe"><label class="feld"><span>Datum</span><input type="date" name="datum" value="${esc(e.datum)}" required></label>
    <label class="feld"><span>Art</span><select name="art">${['Training', 'Trainingslager'].map(a => `<option${e.art === a ? ' selected' : ''}>${a}</option>`).join('')}</select></label></div>
    <div class="feldreihe"><label class="feld"><span>Mannschaft</span><input name="mannschaft" value="${esc(e.mannschaft)}"></label>
    <label class="feld"><span>Spieler</span><input name="spieler" value="${esc(e.spieler)}" placeholder="z. B. 11 + 1"></label></div>
    <label class="feld"><span>Zusatz</span><input name="nummer" value="${esc(e.nummer)}" placeholder="z. B. 2. Einheit"></label>
    <label class="feld"><span>Schwerpunkt (wie auf der Seite)</span><input name="schwerpunkt" value="${esc(e.schwerpunkt)}"></label>
    <div class="knopfreihe"><button type="submit" class="knopf primaer">Speichern</button></div>
  </form>
  <div class="gruppe filter-liste">
    <details class="filter-zeile" data-gruppe="e-sp"${offeneGruppen.has('e-sp') ? ' open' : ''}><summary>${ico.klappe}<span class="txt"><span class="t">Schwerpunkt für den Filter</span><span class="s${akt.length ? ' gewaehlt' : ''}">${esc(akt.join(', ') || 'nichts gewählt')}</span></span></summary>
    <div class="filter-inhalt">${SCHWERPUNKT_GRUPPEN.map(g => `<div class="filter-unter"><h3>${esc(g.name)}</h3><div class="wahl">${[...new Set(g.punkte.map(p => p[0]))].map(w => `<button type="button" data-esp="${esc(e.id)}|${esc(w)}" aria-pressed="${akt.includes(w)}">${esc(w)}</button>`).join('')}</div></div>`).join('')}</div></details>
    <details class="filter-zeile" data-gruppe="e-q"${offeneGruppen.has('e-q') ? ' open' : ''}><summary>${ico.klappe}<span class="txt"><span class="t">Qualität</span><span class="s gewaehlt">${esc(e.qualitaet)}</span></span></summary><div class="filter-inhalt">${qualitaetWahl('e', e)}</div></details>
  </div>
  <button type="button" class="knopf gefahr breit" data-ausblenden="e|${esc(e.id)}">Aus der Bibliothek nehmen</button>`;
}

// ---------- Aktionen ----------
async function speichere(fn) {
  try { await fn(); return true; } catch (e) { alert('Speichern hat nicht geklappt: ' + (e.message || e)); return false; }
}
async function merkmalUmschalten(spec) {
  const [id, feld, wert, mehrfach] = spec.split('|');
  const u = karteVon(id); if (!voll(u)) return;
  if (feld === 'form') return speichere(() => aendern('u', u.id, { form: wert }));
  if (feld === 'jugend') {
    const l = [...(u.jugend || [])]; const i = l.indexOf(wert); i >= 0 ? l.splice(i, 1) : l.push(wert);
    return speichere(() => aendern('u', u.id, { jugend: l.sort() }));
  }
  const m = JSON.parse(JSON.stringify(u.merkmale || {}));
  if (mehrfach === '1') { const l = [...(m[feld] || [])]; const i = l.indexOf(wert); i >= 0 ? l.splice(i, 1) : l.push(wert); m[feld] = l; }
  else m[feld] = m[feld] === wert ? '' : wert;
  if (feld === 'hauptschwerpunkt' && m.hauptschwerpunkt) m.schwerpunkte = (m.schwerpunkte || []).filter(s => s !== m.hauptschwerpunkt);
  if (feld === 'schwerpunkte' && m.schwerpunkte.includes(m.hauptschwerpunkt)) m.hauptschwerpunkt = '';
  return speichere(() => aendern('u', u.id, { merkmale: m }));
}
async function qualitaetSetzen(art, id, q) {
  if (art === 'u') return speichere(() => aendern('u', id, { qualitaet: q }));
  const e = einheitVon(id); if (!voll(e)) return;
  // Karten, die nur in dieser Einheit vorkommen, bekommen dieselbe Qualität
  const nur = kartenDerEinheit(e).filter(u => nurInEinheit(u, e.id) && u.qualitaet !== q);
  return speichere(() => aendernMehrere([['e', id, { qualitaet: q }], ...nur.map(u => ['u', u.id, { qualitaet: q }])]));
}
async function aufnehmen(eid) {
  const e = einheitVon(eid); if (!voll(e)) return;
  const aus = abgewaehlt.get(eid) || new Set();
  const karten = kartenDerEinheit(e).filter(u => u.status === 'vorschlag');
  const an = karten.filter(u => !aus.has(u.id));
  const weg = karten.filter(u => aus.has(u.id) && nurInEinheit(u, eid));
  const ohneHaupt = an.filter(u => !u.merkmale?.hauptschwerpunkt);
  if (ohneHaupt.length && !confirm(`Bei ${ohneHaupt.map(u => '„' + u.titel + '“').join(', ')} fehlt der Haupt-Schwerpunkt. Trotzdem aufnehmen?`)) return;
  if (weg.length && !confirm(`${weg.map(u => '„' + u.titel + '“').join(', ')} ohne Haken: in den Papierkorb legen?`)) return;
  const ok = await speichere(() => aendernMehrere([
    ['e', e.id, { status: 'aufgenommen' }],
    ...an.map(u => ['u', u.id, { status: 'aufgenommen', geprueft: true }]),
    ...weg.map(u => ['u', u.id, { status: 'verworfen', vorher: 'vorschlag' }]),
  ]));
  if (!ok) return;
  abgewaehlt.delete(eid);
  const naechste = vorschlagEinheiten()[0];
  app.geheZu(naechste ? '#/pruefen/' + enc(naechste.id) : '#/pruefen', true);
}
async function verwerfen(eid) {
  const e = einheitVon(eid); if (!voll(e)) return;
  if (!confirm('Diese Einheit verwerfen? Sie landet im Papierkorb.')) return;
  const nur = kartenDerEinheit(e).filter(u => u.status === 'vorschlag' && nurInEinheit(u, e.id));
  if (await speichere(() => aendernMehrere([['e', e.id, { status: 'verworfen', vorher: e.status }], ...nur.map(u => ['u', u.id, { status: 'verworfen', vorher: u.status }])]))) app.geheZu('#/pruefen', true);
}
async function weiter(id, art, angesehen) {
  const liste = karteMitHinweis(art);
  const i = liste.findIndex(x => x.id === id);
  const naechste = liste.slice(i + 1).find(x => x.id !== id) || (art === 'offen' ? liste.find(x => x.id !== id) : null);
  if (angesehen && !(await speichere(() => aendern('u', id, { geprueft: true })))) return;
  app.geheZu(naechste ? `#/pruefen/karte/${enc(naechste.id)}/${art}` : `#/pruefen/offen/${art}`, true);
}

export async function klick(t, d) {
  if ('anmelden' in d) { try { await anmelden(); } catch (e) { alert('Anmeldung hat nicht geklappt: ' + (e.message || e)); } return; }
  if ('abmelden' in d) { await abmelden(); return; }
  if (!istAdmin()) return;
  if (d.merkmal) { await merkmalUmschalten(d.merkmal); return; }
  if (d.qualitaet) { const [art, id, q] = d.qualitaet.split('|'); await qualitaetSetzen(art, id, q); return; }
  if (d.esp) {
    const [id, w] = d.esp.split('|'); const e = einheitVon(id); if (!voll(e)) return;
    const l = [...(e.schwerpunkte || [])]; const i = l.indexOf(w); i >= 0 ? l.splice(i, 1) : l.push(w);
    await speichere(() => aendern('e', id, { schwerpunkte: l })); return;
  }
  if (d.geprueft) { const u = karteVon(d.geprueft); if (voll(u)) await speichere(() => aendern('u', u.id, { geprueft: !u.geprueft })); return; }
  if (d.weiter) { const [id, art, an] = d.weiter.split('|'); await weiter(id, art, an === '1'); return; }
  if (d.aufnehmen) { await aufnehmen(d.aufnehmen); return; }
  if (d.verwerfen) { await verwerfen(d.verwerfen); return; }
  if (d.zusammen) { const [ziel, quelle] = d.zusammen.split('|'); await zusammenlegen(ziel, quelle); return; }
  if (d.abtrennen) { const [id, i] = d.abtrennen.split('|'); await abtrennen(id, +i); return; }
  if (d.ausblenden) {
    const [art, id] = d.ausblenden.split('|');
    const x = art === 'e' ? einheitVon(id) : karteVon(id); if (!voll(x)) return;
    const name = art === 'e' ? `die Einheit vom ${L.datumDE(x.datum)}` : `„${x.titel}“`;
    if (!confirm(`${name[0].toUpperCase() + name.slice(1)} aus der Bibliothek nehmen? Im Papierkorb lässt sich das zurückholen.`)) return;
    if (await speichere(() => aendern(art, x.id, { status: 'verworfen', vorher: x.status }))) app.geheZu('#/pruefen', true);
    return;
  }
  if (d.zurueckholen) {
    const [art, id] = d.zurueckholen.split('|');
    const x = art === 'e' ? einheitVon(id) : karteVon(id); if (!voll(x)) return;
    await speichere(() => aendern(art, x.id, { status: x.vorher || 'vorschlag', vorher: null }));
  }
}
