import { daten, starten, beiAenderung, einheitVon, karteVon } from './daten.js';
import { pdfHolen, jspdfVorbereiten, teilen, dateiname, uebungAlsPdf } from './export.js';
import { SPIELPHASEN, SCHWERPUNKT_GRUPPEN, ALLE_SCHWERPUNKTE, FORMEN, ZAHLEN, ARTEN, ORTE, JUGENDEN, QUALITAETEN, TEILE, teilVon } from './kategorien.js';
import * as L from './logik.js';
import { lesen, schreiben, ABLAGE } from './speicher.js';
import {
  esc, enc, ico, istAdmin, sichtbar, alleKarten, alleEinheiten, karteSichtbar, einheitSichtbar, pdfVon,
  filter, filterSpeichern, filterLeeren, filterAktiv, passt, passtE, gemerkt, merkenUmschalten, merkKarten,
  sortierungSetzen, uebungenText, einheitenText, jugendText, zurueck, kachel, sucheLeiste, filterHinweis, listenKopf,
  uebungKarte, uebungsListe, abschnittKopf, einheitZeile, teileHtml, skizzenHtml, merkmaleZeilen, merkmaleHtml, chipsUebung,
  seiteLaedt, seiteFehlt, saisonVonEinheit, voll,
} from './ui.js';
import * as Admin from './admin.js';

const $inhalt = document.getElementById('inhalt');
let seitenTitel = '';
const titel = t => { seitenTitel = t; };

// ---------- Suche ----------
let suchCache = null;
function suchIndex() {
  if (!suchCache) {
    const u = new Map(), e = new Map();
    for (const x of daten.uebungen) if (voll(x)) u.set(x.id, L.suchIndexUebung(x));
    for (const x of daten.einheiten) if (voll(x)) e.set(x.id, L.suchIndexEinheit(x));
    suchCache = { u, e, schatz: L.wortschatz([...u.values(), ...e.values()]) };
  }
  return suchCache;
}
function suchTreffer(q) {
  const ix = suchIndex();
  const woerter = L.suchWoerter(q, ix.schatz);
  if (!woerter.length) return null;
  const tu = [], te = [];
  for (const u of alleKarten()) {
    if (!passt(u)) continue;
    const b = L.bewerte(ix.u.get(u.id) || L.suchIndexUebung(u), woerter);
    if (b) tu.push([u, b]);
  }
  for (const e of alleEinheiten()) {
    if (!passtE(e)) continue;
    const b = L.bewerte(ix.e.get(e.id) || L.suchIndexEinheit(e), woerter);
    if (b) te.push([e, b]);
  }
  tu.sort((a, b) => b[1].punkte - a[1].punkte || L.zuletzt(b[0]).localeCompare(L.zuletzt(a[0])));
  te.sort((a, b) => b[1].punkte - a[1].punkte || b[0].datum.localeCompare(a[0].datum));
  return { tu, te };
}
export function suchErgebnis(q) {
  const t = suchTreffer(q);
  if (!t) return '';
  const stellen = new Map(t.tu.map(([u, b]) => [u.id, b.stelle]));
  return `<section class="abschnitt">${abschnittKopf('Übungen', uebungenText(t.tu.length))}${uebungsListe(t.tu.map(x => x[0]), { leer: 'Keine passende Übung.', sortiert: true, stellen })}</section>
  <section class="abschnitt">${abschnittKopf('Einheiten', einheitenText(t.te.length))}${t.te.length ? `<div class="gruppe">${t.te.map(([e, b]) => einheitZeile(e, b.stelle)).join('')}</div>` : '<div class="leer">Keine passende Einheit.</div>'}</section>`;
}

// ---------- Start ----------
const hatSchwerpunkt = (u, s) => { const m = u.merkmale || {}; return m.hauptschwerpunkt === s || (m.schwerpunkte || []).includes(s); };
const einzelGruppe = g => g.punkte.length === 1 && g.punkte[0][0] === g.name;
function startKacheln() {
  const K = alleKarten().filter(passt);
  const n = pred => uebungenText(K.filter(pred).length);
  const leer = !alleKarten().length && daten.geladen
    ? (istAdmin() ? '<div class="leer">Noch nichts aufgenommen. Unter Prüfen liegen die Vorschläge bereit.</div>' : '<div class="leer">Hier ist noch nichts aufgenommen.</div>') : '';
  const abschnitt = (t, inhalt) => `<section class="abschnitt"><h2>${esc(t)}</h2><div class="raster">${inhalt}</div></section>`;
  return leer + abschnitt('Spielphasen', SPIELPHASEN.map(p => kachel(p, `#/liste/spielphase/${enc(p)}`, n(u => (u.merkmale?.spielphasen || []).includes(p)))).join(''))
    + abschnitt('Teil der Einheit', TEILE.map(t => kachel(t, `#/liste/teil/${enc(t)}`, n(u => L.teileVonKarte(u).includes(t)))).join(''))
    + abschnitt('Schwerpunkte', SCHWERPUNKT_GRUPPEN.map(g => einzelGruppe(g)
      ? kachel(g.name, `#/liste/schwerpunkt/${enc(g.name)}`, n(u => hatSchwerpunkt(u, g.name)))
      : kachel(g.name, `#/gruppe/${enc(g.name)}`, n(u => g.punkte.some(p => hatSchwerpunkt(u, p[0]))))).join(''))
    + abschnitt('Form', FORMEN.map(f => kachel(f, `#/liste/form/${enc(f)}`, n(u => u.form === f))).join(''))
    + abschnitt('Zahlenverhältnis', ZAHLEN.map(z => kachel(z, `#/liste/zahl/${enc(z)}`, n(u => (u.merkmale?.zahl || []).includes(z)))).join(''))
    + abschnitt('Art der Spielform', ARTEN.map(a => kachel(a, `#/liste/art/${enc(a)}`, n(u => u.merkmale?.artSpielform === a))).join(''))
    + abschnitt('Alle Übungen', kachel('Alle Übungen', '#/liste/alle/alle', uebungenText(K.length)));
}
function offlineHinweis() {
  if (!daten.ohneNetz || offlineWeg) return '';
  return `<div class="hinweis"><span class="ht">Keine Verbindung. Du siehst den gespeicherten Stand.</span><button type="button" class="hzu" data-offline-weg aria-label="Hinweis schließen">${ico.zu}</button></div>`;
}
let offlineWeg = false;
function seiteStart(q = '') {
  titel(q ? 'Suche' : '');
  sucheBasis = startKacheln;
  return `<div class="kopf"><h1>Trainingsbibliothek</h1>${sucheLeiste(q)}</div>${offlineHinweis()}${filterHinweis()}
  <div id="unter" class="unter-suche">${!daten.geladen ? seiteLaedt() : q ? suchErgebnis(q) : startKacheln()}</div>`;
}
let sucheBasis = null; // Inhalt unter dem Suchfeld, wenn nichts gesucht wird

function seiteGruppe(name) {
  const g = SCHWERPUNKT_GRUPPEN.find(x => x.name === name);
  if (!g) return seiteFehlt();
  titel(g.name);
  const K = alleKarten().filter(passt);
  return `${listenKopf(g.name, zurueck('Start', '#/'), false)}
  <div class="gruppe">${g.punkte.map(([p, erkl]) => {
    const n = K.filter(u => hatSchwerpunkt(u, p)).length;
    return `<a class="zeile" href="#/liste/schwerpunkt/${enc(p)}"><span class="txt"><span class="t">${esc(p)}</span><span class="s">${esc([erkl, uebungenText(n)].filter(Boolean).join(' · '))}</span></span>${ico.rechts}</a>`;
  }).join('')}</div>`;
}

function seiteListe(typ, wert) {
  if (!daten.geladen) return seiteLaedt();
  let K = alleKarten().filter(passt);
  if (typ === 'schwerpunkt') {
    titel(wert);
    const g = SCHWERPUNKT_GRUPPEN.find(x => x.punkte.some(p => p[0] === wert) && !einzelGruppe(x));
    const zur = g ? zurueck(g.name, `#/gruppe/${enc(g.name)}`) : zurueck('Start', '#/');
    const haupt = K.filter(u => u.merkmale?.hauptschwerpunkt === wert);
    const weitere = K.filter(u => u.merkmale?.hauptschwerpunkt !== wert && (u.merkmale?.schwerpunkte || []).includes(wert));
    const E = alleEinheiten().filter(e => (e.schwerpunkte || []).includes(wert)).filter(passtE).sort((a, b) => b.datum.localeCompare(a.datum));
    return `${listenKopf(wert, zur)}
    <section class="abschnitt">${abschnittKopf('Als Haupt-Schwerpunkt', uebungenText(haupt.length))}${uebungsListe(haupt)}</section>
    ${weitere.length ? `<section class="abschnitt">${abschnittKopf('Als weiterer Schwerpunkt', uebungenText(weitere.length))}${uebungsListe(weitere)}</section>` : ''}
    ${E.length ? `<section class="abschnitt">${abschnittKopf('Ganze Einheiten mit diesem Schwerpunkt', einheitenText(E.length))}<div class="gruppe">${E.map(e => einheitZeile(e)).join('')}</div></section>` : ''}`;
  }
  let t = wert;
  if (typ === 'spielphase') K = K.filter(u => (u.merkmale?.spielphasen || []).includes(wert));
  else if (typ === 'teil') K = K.filter(u => L.teileVonKarte(u).includes(wert));
  else if (typ === 'form') K = K.filter(u => u.form === wert);
  else if (typ === 'zahl') K = K.filter(u => (u.merkmale?.zahl || []).includes(wert));
  else if (typ === 'art') K = K.filter(u => u.merkmale?.artSpielform === wert);
  else if (typ === 'alle') t = 'Alle Übungen';
  else return seiteFehlt();
  titel(t);
  return `${listenKopf(t, zurueck('Start', '#/'))}<section class="abschnitt">${abschnittKopf('', uebungenText(K.length))}${uebungsListe(K)}</section>`;
}

// ---------- Übung ----------
const gewaehlteVariante = new Map();
const variantenSortiert = u => [...u.varianten].sort((a, b) => b.datum.localeCompare(a.datum));
function aktVariante(u) { const vs = variantenSortiert(u); return vs[Math.min(gewaehlteVariante.get(u.id) || 0, vs.length - 1)]; }
function seiteUebung(id) {
  const u = karteSichtbar(id);
  if (!u) return seiteFehlt();
  titel(u.titel);
  const vs = variantenSortiert(u);
  const vi = Math.min(gewaehlteVariante.get(u.id) || 0, vs.length - 1);
  const v = vs[vi];
  const status = istAdmin() && u.status === 'vorschlag' ? '<span class="chip warn">Vorschlag, noch nicht aufgenommen</span>' : '';
  const variantenWahl = vs.length > 1 ? `<section class="abschnitt"><h2>Eingesetzt (${vs.length}×)</h2><div class="varianten" role="group" aria-label="Einsatz wählen">${vs.map((x, i) => `<button type="button" data-variante="${esc(u.id)}|${i}" aria-pressed="${i === vi}">${L.datumDE(x.datum)}</button>`).join('')}</div>${v.titel !== u.titel ? `<div class="unter">Auf dieser Seite: ${esc(v.titel)}</div>` : ''}</section>` : '';
  const e = einheitSichtbar(v.einheit);
  const merk = gemerkt(u.id);
  return `<div class="kopf">${zurueck('Zurück')}<h1>${esc(u.titel)}</h1><div class="chips">${chipsUebung(u)}${status}</div>
    <div class="knopfreihe aktionen"><button type="button" class="knopf${merk ? ' an' : ''}" data-merken="${esc(u.id)}" aria-pressed="${merk}">${merk ? ico.gemerkt : ico.merken}${merk ? 'Gemerkt' : 'Merken'}</button>
    <button type="button" class="knopf" data-export="uebung|${esc(u.id)}">${ico.teilen}Exportieren</button>${istAdmin() ? `<a class="knopf" href="#/bearbeiten/${enc(u.id)}">Bearbeiten</a>` : ''}</div></div>
  ${variantenWahl}
  <div class="zweispaltig"><div class="abschnitt">${skizzenHtml(v.skizzen)}</div>
  <div class="abschnitt">${teileHtml(v.teile)}${merkmaleHtml(u)}
  ${e ? `<div class="gruppe"><a class="zeile" href="#/einheit/${enc(e.id)}"><span class="txt"><span class="t">Aus der Einheit vom ${L.datumDE(e.datum)}${v.label ? ' · ' + esc(v.label) : ''}</span><span class="s">${esc(e.schwerpunkt)}</span></span>${ico.rechts}</a></div>` : ''}
  </div></div>`;
}

// ---------- Einheit ----------
function bausteinZeile(b) {
  if (b.art === 'hinweis') return `<div class="hinweiszeile">${esc([b.titel, ...(b.zeilen || [])].join(' · '))}</div>`;
  const marke = `<span class="marke ${teilVon(b.label) === 'Hauptteil' ? 'h' : ''}">${esc(b.label || '–')}</span>`;
  const u = b.karte ? karteSichtbar(b.karte) : null;
  if (u) {
    return `<a class="zeile" href="#/uebung/${enc(u.id)}">${marke}<span class="txt"><span class="t">${esc(b.titel)}</span><span class="s">${esc([b.form, u.merkmale?.hauptschwerpunkt].filter(Boolean).join(' · '))}</span></span>${ico.rechts}</a>`;
  }
  return `<div class="zeile still">${marke}<span class="txt"><span class="t">${esc(b.titel)}</span><span class="s">${esc([b.form, 'nur Titel auf der Seite'].filter(Boolean).join(' · '))}</span></span></div>`;
}
function bausteinListe(e) {
  const out = [];
  let gruppe = null;
  const schliessen = () => { if (gruppe && gruppe.z.length) out.push(`<section class="abschnitt">${gruppe.t ? `<h2>${esc(gruppe.t)}</h2>` : ''}<div class="gruppe">${gruppe.z.join('')}</div></section>`); gruppe = null; };
  for (const b of e.bausteine) {
    if (b.art === 'abschnitt') { schliessen(); out.push(`<h2 class="zwischen">${esc(b.titel)}</h2>`); continue; }
    if (b.art === 'hinweis') { if (!gruppe) gruppe = { t: '', teil: null, z: [] }; gruppe.z.push(bausteinZeile(b)); continue; }
    const teil = teilVon(b.label) || 'Weitere';
    if (gruppe && gruppe.teil === null) { gruppe.teil = teil; gruppe.t = teil; }
    else if (!gruppe || gruppe.teil !== teil) { schliessen(); gruppe = { t: teil, teil, z: [] }; }
    gruppe.z.push(bausteinZeile(b));
  }
  schliessen();
  return out.join('');
}
export function einheitKopf(e, zurueckHtml) {
  const chips = [e.mannschaft, jugendText(e.jugend), e.spieler, e.nummer].filter(Boolean).map(c => `<span class="chip">${esc(c)}</span>`).join('')
    + (e.status === 'vorschlag' && istAdmin() ? '<span class="chip warn">Vorschlag</span>' : '');
  return `<div class="kopf">${zurueckHtml}<span class="unter">Saison ${esc(e.saison)} · ${L.wochentag(e.datum)}${e.art === 'Trainingslager' ? ' · Trainingslager' : ''}</span>
  <h1>${L.datumDE(e.datum)}</h1><div class="chips">${chips}</div>${e.schwerpunkt ? `<div class="sp-zeile"><span class="unter">Schwerpunkt</span> ${esc(e.schwerpunkt)}</div>` : ''}${(e.schwerpunkte || []).length ? `<div class="chips">${e.schwerpunkte.map(s => `<a class="chip ac" href="#/liste/schwerpunkt/${enc(s)}">${esc(s)}</a>`).join('')}</div>` : ''}</div>`;
}
function seiteEinheit(id) {
  const e = einheitSichtbar(id);
  if (!e) return seiteFehlt();
  titel(L.datumDE(e.datum));
  return `${einheitKopf(e, zurueck('Zurück'))}
  <div class="knopfreihe aktionen"><a class="knopf primaer" href="${esc(pdfVon(e))}" target="_blank" rel="noopener">${ico.seite}Ganze Einheit ansehen</a>
  <button type="button" class="knopf" data-export="einheit|${esc(e.id)}">${ico.teilen}Exportieren</button>${istAdmin() ? `<a class="knopf" href="#/einheit/${enc(e.id)}/bearbeiten">Bearbeiten</a>` : ''}</div>
  ${bausteinListe(e)}
  <details class="aufklappen" data-auf-merken="ganz"><summary>${ico.klappe}Ganze Trainingseinheit aufklappen</summary><div class="ganz abschnitt">${ganzInhalt(e)}</div></details>`;
}
export function seiteEinheitGanz(id, zurueckHtml) {
  const e = einheitVon(id);
  if (!e || !voll(e) || (!sichtbar(e) && !istAdmin())) return seiteFehlt();
  titel(L.datumDE(e.datum));
  return `${einheitKopf(e, zurueckHtml || zurueck('Zurück'))}<div class="ganz abschnitt">${ganzInhalt(e)}</div>`;
}
function ganzInhalt(e) {
  return e.bausteine.map(b => {
    if (b.art === 'abschnitt') return `<h2>${esc(b.titel)}</h2>`;
    if (b.art === 'hinweis') return `<div class="hinweiszeile kasten">${esc([b.titel, ...(b.zeilen || [])].join(' · '))}</div>`;
    const kopf = `<h3>${esc([b.label ? b.label + ')' : '', b.form, b.titel].filter(Boolean).join(' '))}</h3>`;
    const u = b.karte ? karteVon(b.karte) : null;
    const zeigen = u && voll(u) && (sichtbar(u) || (istAdmin() && u.status === 'vorschlag'));
    const v = zeigen ? u.varianten.find(x => x.einheit === e.id && x.label === b.label && x.titel === b.titel) || u.varianten.find(x => x.einheit === e.id) : null;
    if (!v) return `<div class="baustein">${kopf}<div class="unter">Nur Titel auf der Seite</div></div>`;
    return `<div class="baustein">${kopf}${skizzenHtml(v.skizzen)}${teileHtml(v.teile)}</div>`;
  }).join('');
}

// ---------- Einheiten: Liste und Monat ----------
function standardOffen(gruppen) {
  const s = new Set();
  if (gruppen[0]) { s.add('s:' + gruppen[0].saison); if (gruppen[0].monate[0]) s.add('m:' + gruppen[0].monate[0].ym); }
  return s;
}
let offen = null;
function offenSet(gruppen) {
  if (!offen) { const g = lesen(ABLAGE.offen, null); offen = Array.isArray(g) ? new Set(g) : standardOffen(gruppen); }
  return offen;
}
// „Alles aufklappen“: alle Saisons offen, Monatsüberschriften fallen weg
const allesAuf = () => lesen(ABLAGE.allesAuf, false) === true;
function einheitenGefiltert() { return alleEinheiten().filter(passtE); }
function ansichtSchalter(akt) {
  return `<div class="umschalter ansicht" role="group" aria-label="Ansicht"><a href="#/einheiten/liste" aria-pressed="${akt === 'liste'}" role="button">Liste</a><a href="#/einheiten/monat" aria-pressed="${akt === 'monat'}" role="button">Monat</a></div>`;
}
function einheitenListe() {
  const gruppen = L.saisonGruppen(einheitenGefiltert());
  if (!gruppen.length) return `<div class="leer">${filterAktiv() ? 'Keine Einheit passt zum Filter.' : 'Noch keine Einheiten aufgenommen.'}</div>`;
  const o = offenSet(gruppen);
  const alles = allesAuf();
  return `<div class="saisons"><div class="alles-leiste"><button type="button" class="alles-knopf" data-alles-auf="${alles ? 'zu' : 'auf'}">${alles ? 'Alles zuklappen' : 'Alles aufklappen'}</button></div>${gruppen.map(g => {
    const sk = 's:' + g.saison, sAuf = o.has(sk);
    return `<div class="gruppe saison"><button type="button" class="klappzeile gross" data-auf="${esc(sk)}" aria-expanded="${sAuf}">${ico.klappe}<span class="txt"><span class="t">Saison ${esc(g.saison)}</span><span class="s">${esc([einheitenText(g.anzahl), g.mannschaften.join(', ')].filter(Boolean).join(' · '))}</span></span></button>
    ${!sAuf ? '' : alles ? g.monate.flatMap(m => m.einheiten).map(e => einheitZeile(e)).join('') : g.monate.map(m => {
      const mk = 'm:' + m.ym, mAuf = o.has(mk);
      return `<button type="button" class="klappzeile" data-auf="${esc(mk)}" aria-expanded="${mAuf}">${ico.klappe}<span class="txt"><span class="t">${esc(L.monatName(m.ym))}</span></span><span class="zahl">${m.einheiten.length}</span></button>${mAuf ? m.einheiten.map(e => einheitZeile(e)).join('') : ''}`;
    }).join('')}</div>`;
  }).join('')}</div>`;
}
const heuteIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function monatVerschieben(ym, n) { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); }
function saisonVonYm(ym) { const [y, m] = ym.split('-').map(Number); const a = m >= 7 ? y : y - 1; return `${a}/${String((a + 1) % 100).padStart(2, '0')}`; }
const monatAuf = new Set();
function einheitenMonat(ym) {
  const E = einheitenGefiltert();
  if (!/^\d{4}-\d{2}$/.test(ym || '')) {
    const heute = heuteIso().slice(0, 7);
    const monate = [...new Set(E.map(e => e.datum.slice(0, 7)))].sort().reverse();
    ym = monate.includes(heute) ? heute : (monate.find(m => m <= heute) || monate[0] || heute);
  }
  const proTag = new Map();
  for (const e of E) { if (!proTag.has(e.datum)) proTag.set(e.datum, []); proTag.get(e.datum).push(e); }
  const imMonat = E.filter(e => e.datum.startsWith(ym)).sort((a, b) => a.datum.localeCompare(b.datum) || a.id.localeCompare(b.id));
  const heute = heuteIso();
  const gruppen = L.saisonGruppen(E);
  const saison = saisonVonYm(ym);
  const seite = `<aside class="monat-seite">${gruppen.map(g => {
    const auf = g.saison === saison || monatAuf.has(g.saison);
    return `<div class="gruppe saison"><button type="button" class="klappzeile gross" data-monat-auf="${esc(g.saison)}" aria-expanded="${auf}">${ico.klappe}<span class="txt"><span class="t">Saison ${esc(g.saison)}</span><span class="s">${esc([einheitenText(g.anzahl), g.mannschaften.join(', ')].filter(Boolean).join(' · '))}</span></span></button>
    ${auf ? [...g.monate].reverse().map(m => `<a class="monatlink" href="#/einheiten/monat/${m.ym}"${m.ym === ym ? ' aria-current="true"' : ''}><span>${esc(L.monatName(m.ym).split(' ')[0])}</span><span class="zahl">${m.einheiten.length}</span></a>`).join('') : ''}</div>`;
  }).join('')}</aside>`;
  const wochen = L.kalender(ym);
  const kal = `<div class="kalender" role="grid" aria-label="${esc(L.monatName(ym))}">
    <div class="kal-zeile kal-kopf" role="row"><span class="kw">KW</span>${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(t => `<span>${t}</span>`).join('')}</div>
    ${wochen.map(w => `<div class="kal-zeile" role="row"><span class="kw">${w.kw}</span>${w.tage.map(t => {
      const l = t.imMonat ? (proTag.get(t.iso) || []) : [];
      const kl = ['tag', t.imMonat ? '' : 'aus', t.iso === heute ? 'heute' : '', l.length ? 'hat' : '', l.some(e => e.art === 'Trainingslager') ? 'lager' : ''].filter(Boolean).join(' ');
      return `<div class="${kl}" role="gridcell"><span class="nr">${t.tag}</span>${l.map(e => `<a class="block${e.art === 'Trainingslager' ? ' lager' : ''}" href="#/einheit/${enc(e.id)}" aria-label="${esc(`${L.wochentag(e.datum)} ${L.datumDE(e.datum)}, ${[e.mannschaft, e.schwerpunkt].filter(Boolean).join(', ')}`)}"><b>${esc([e.mannschaft, e.spieler].filter(Boolean).join(' · ') || 'Einheit')}</b><span>${esc(e.schwerpunkt || e.nummer || '')}</span></a>`).join('')}</div>`;
    }).join('')}</div>`).join('')}
  </div>`;
  return `<div class="monat">${seite}<div class="monat-haupt">
    <div class="monat-kopf"><a class="knopf rund" href="#/einheiten/monat/${monatVerschieben(ym, -1)}" aria-label="Voriger Monat">${ico.links}</a>
    <div class="mk-text"><span class="t">${esc(L.monatName(ym))}</span><span class="s">Saison ${esc(saison)} · ${einheitenText(imMonat.length)}</span></div>
    <a class="knopf rund" href="#/einheiten/monat/${monatVerschieben(ym, 1)}" aria-label="Nächster Monat">${ico.rechts}</a></div>
    ${kal}
    ${imMonat.length ? `<div class="gruppe monat-liste">${imMonat.map(e => einheitZeile(e)).join('')}</div>` : ''}
  </div></div>`;
}
function seiteEinheiten(ansicht, ym, q = '') {
  if (ansicht) schreiben(ABLAGE.ansicht, ansicht); else ansicht = lesen(ABLAGE.ansicht, 'liste');
  if (ansicht !== 'monat') ansicht = 'liste';
  titel(q ? 'Suche' : 'Einheiten');
  sucheBasis = () => ansicht === 'monat' ? einheitenMonat(ym) : einheitenListe();
  return `<div class="kopf"><div class="einheiten-kopf"><h1>Einheiten</h1>${sucheLeiste(q)}${ansichtSchalter(ansicht)}</div></div>${filterHinweis()}
  <div id="unter" class="unter-suche">${!daten.geladen ? seiteLaedt() : q ? suchErgebnis(q) : sucheBasis()}</div>`;
}

// ---------- Merkliste ----------
function seiteMerkliste() {
  titel('Merkliste');
  if (!daten.geladen) return seiteLaedt();
  const K = merkKarten();
  return `<div class="kopf"><div class="listenkopf"><h1>Merkliste</h1><span class="unter">${uebungenText(K.length)}</span></div></div>
  ${K.length ? `<div class="uliste merkliste">${K.map(u => uebungKarte(u, { ende: `<button type="button" class="merk-weg" data-merk-weg="${esc(u.id)}" aria-label="Aus der Merkliste nehmen">${ico.gemerkt}</button>` })).join('')}</div>`
    : '<div class="leer">Noch nichts gemerkt. Auf einer Übung „Merken“ tippen, dann erscheint sie hier.</div>'}`;
}

// ---------- Listen (Schwerpunktlisten als PDF) ----------
const LISTEN = [
  { id: 'u13', titel: 'Schwerpunkte U13', jugend: 'D-Jugend', stand: 'Juli 2026', pdf: 'listen/schwerpunkte-u13.pdf' },
  { id: 'u14-u15', titel: 'Schwerpunkte U14/U15', jugend: 'C-Jugend', stand: 'Juli 2024', pdf: 'listen/schwerpunkte-u14-u15.pdf' },
];
function seiteListen() {
  titel('Listen');
  return `<div class="kopf"><h1>Schwerpunktlisten</h1></div>
  <div class="gruppe listen">${LISTEN.map(l => `<div class="listenzeile"><a class="zeile" href="${esc(l.pdf)}" target="_blank" rel="noopener"><span class="pdf-marke">${ico.seite}</span><span class="txt"><span class="t">${esc(l.titel)}</span><span class="s">${esc(l.jugend)} · Stand ${esc(l.stand)}</span></span></a><button type="button" class="knopf rund" data-export="liste|${esc(l.id)}" aria-label="${esc(l.titel)} exportieren">${ico.teilen}</button></div>`).join('')}</div>`;
}

// ---------- Filter ----------
const filterOffen = new Set();
function seiteFilter() {
  titel('Filter');
  const saisons = [...new Set(daten.einheiten.filter(sichtbar).map(e => e.saison))].sort().reverse();
  const knoepfe = (key, werte, anzeige) => `<div class="wahl">${werte.map(w => `<button type="button" data-filter="${key}|${esc(w)}" aria-pressed="${filter[key].includes(w)}">${esc(anzeige(w))}</button>`).join('')}</div>`;
  const gruppe = (t, key, werte, anzeige = x => x, inhalt) => {
    const gew = filter[key];
    return `<details class="filter-zeile" data-fkey="${key}"${filterOffen.has(key) ? ' open' : ''}><summary>${ico.klappe}<span class="txt"><span class="t">${esc(t)}</span><span class="s${gew.length ? ' gewaehlt' : ''}">${esc(gew.length ? gew.map(anzeige).join(', ') : 'Alle')}</span></span></summary>
    <div class="filter-inhalt">${inhalt || knoepfe(key, werte, anzeige)}</div></details>`;
  };
  const swInhalt = SCHWERPUNKT_GRUPPEN.map(g => `<div class="filter-unter"><h3>${esc(g.name)}</h3>${knoepfe('schwerpunkt', [...new Set(g.punkte.map(p => p[0]))], x => x)}</div>`).join('');
  const treffer = alleKarten().filter(passt).length;
  const tE = alleEinheiten().filter(passtE).length;
  return `<div class="kopf kopf-zu"><h1>Filter</h1><button type="button" class="knopf rund zu" data-zurueck aria-label="Schließen">${ico.zu}</button></div>
  <div class="gruppe filter-liste">
  ${gruppe('Schwerpunkt', 'schwerpunkt', ALLE_SCHWERPUNKTE, x => x, swInhalt)}
  ${gruppe('Teil der Einheit', 'teil', TEILE)}
  ${gruppe('Form', 'form', FORMEN)}
  ${gruppe('Zahlenverhältnis', 'zahl', ZAHLEN)}
  ${gruppe('Art der Spielform', 'art', ARTEN)}
  ${gruppe('Ort', 'ort', ORTE)}
  ${gruppe('Jugend', 'jugend', JUGENDEN.map(j => j[0]), w => `${w}-Jugend (${JUGENDEN.find(j => j[0] === w)[1]})`)}
  ${gruppe('Saison', 'saison', saisons)}
  ${gruppe('Qualität', 'qualitaet', QUALITAETEN)}
  </div>
  <div class="filter-fuss"><button type="button" class="knopf" data-filter-zurueck${filterAktiv() ? '' : ' disabled'}>Zurücksetzen</button><button type="button" class="knopf primaer" data-zurueck>${uebungenText(treffer)} · ${einheitenText(tE)}</button></div>`;
}

// ---------- Navigation ----------
let bereich = 'start';
let aktHash = location.hash || '#/';
let vorwaerts = false;
let schritte = 0; // Schritte innerhalb der App, damit „Zurück“ die App nicht verlässt
const scrollMerk = new Map();
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function hashTeile(hash = location.hash) {
  const h = hash.replace(/^#/, '') || '/';
  const i = h.indexOf('?');
  const pfad = i >= 0 ? h.slice(0, i) : h;
  const dec = x => { try { return decodeURIComponent(x); } catch { return x; } };
  const p = pfad.split('/').filter(Boolean).map(dec);
  const q = {};
  if (i >= 0) for (const teil of h.slice(i + 1).split('&')) { if (!teil) continue; const j = teil.indexOf('='); q[dec(j < 0 ? teil : teil.slice(0, j))] = dec(j < 0 ? '' : teil.slice(j + 1)); }
  return { pfad, p, q };
}
export function geheZu(hash, ersetzen = false) {
  vorwaerts = true;
  if (ersetzen) { history.replaceState(null, '', hash); neuZeichnen(true); }
  else if (location.hash === hash) neuZeichnen(true);
  else location.hash = hash;
}

function route() {
  const { p, q } = hashTeile();
  sucheBasis = null;
  seitenTitel = '';
  let html;
  const b = p[0] || '';
  if (!p.length) { html = seiteStart(); bereich = 'start'; }
  else if (b === 'suche') { html = seiteStart(q.q || ''); bereich = 'start'; }
  else if (b === 'gruppe') { html = seiteGruppe(p.slice(1).join('/')); bereich = 'start'; }
  else if (b === 'liste') { html = seiteListe(p[1], p.slice(2).join('/')); bereich = 'start'; }
  else if (b === 'uebung') html = seiteUebung(p[1]);
  else if (b === 'einheit' && p[2] === 'ganz') html = seiteEinheitGanz(p[1]);
  else if (b === 'einheit' && p[2]) { html = Admin.route(p, q); bereich = 'pruefen'; }
  else if (b === 'einheit') { html = seiteEinheit(p[1]); if (bereich !== 'start' && bereich !== 'merkliste') bereich = 'einheiten'; }
  else if (b === 'einheiten') { html = seiteEinheiten(p[1], p[2], q.q || ''); bereich = 'einheiten'; }
  else if (b === 'merkliste') { html = seiteMerkliste(); bereich = 'merkliste'; }
  else if (b === 'listen') { html = seiteListen(); bereich = 'listen'; }
  else if (b === 'filter') html = seiteFilter();
  else if (b === 'pruefen' || b === 'bearbeiten' || b === 'papierkorb') { html = Admin.route(p, q); bereich = 'pruefen'; }
  else html = seiteFehlt();
  if (html == null) html = seiteFehlt();
  $inhalt.innerHTML = html;
  const t = seitenTitel || Admin.titel();
  document.title = t ? `${t} · Trainingsbibliothek` : 'Trainingsbibliothek';
  document.querySelectorAll('[data-nav]').forEach(a => { const an = a.dataset.nav === bereich; a.classList.toggle('aktiv', an); an ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  const z = document.getElementById('pruef-zaehler');
  const n = istAdmin() ? Admin.zaehler() : 0;
  z.hidden = !n; z.textContent = n || '';
  exportVorbereiten();
}
let aufgeschoben = false;
export function neuZeichnen(oben = false) {
  const akt = document.activeElement;
  if (!oben && akt && $inhalt.contains(akt) && akt.matches('input:not([type=checkbox]), textarea, select')) {
    // Während getippt wird nicht alles neu aufbauen
    if (akt.matches('[data-suchfeld]')) { const unter = document.getElementById('unter'); if (unter && akt.value.trim()) unter.innerHTML = suchErgebnis(akt.value); else aufgeschoben = true; }
    else aufgeschoben = true;
    return;
  }
  const y = window.scrollY;
  route();
  if (oben) { window.scrollTo(0, 0); $inhalt.focus({ preventScroll: true }); } else window.scrollTo(0, y);
}
document.addEventListener('focusout', () => { if (aufgeschoben) setTimeout(() => { const a = document.activeElement; if (aufgeschoben && !(a && $inhalt.contains(a) && a.matches('input, textarea, select'))) { aufgeschoben = false; neuZeichnen(false); } }, 0); });

window.addEventListener('scroll', () => { scrollMerk.set(aktHash, window.scrollY); }, { passive: true });
window.addEventListener('hashchange', () => {
  vollbildZu(false);
  const neu = location.hash || '#/';
  const vor = vorwaerts;
  vorwaerts = false;
  schritte = vor ? schritte + 1 : Math.max(0, schritte - 1);
  aktHash = neu;
  route();
  if (vor) { window.scrollTo(0, 0); $inhalt.focus({ preventScroll: true }); }
  else { const y = scrollMerk.get(neu) || 0; window.scrollTo(0, y); requestAnimationFrame(() => window.scrollTo(0, y)); }
});
window.addEventListener('popstate', () => { vollbildZu(false); });

// ---------- Großansicht der Skizze ----------
const $vb = document.getElementById('vollbild');
function vollbildAuf(src) { $vb.querySelector('img').src = src; $vb.hidden = false; history.pushState({ vollbild: true }, '', location.href); $vb.querySelector('.vollbild-zu').focus(); }
function vollbildZu(zurueckGehen = true) {
  if ($vb.hidden) return;
  $vb.hidden = true;
  if (zurueckGehen && history.state && history.state.vollbild) history.back();
}
$vb.addEventListener('click', ev => { if (ev.target === $vb || ev.target.closest('.vollbild-zu')) vollbildZu(); });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$vb.hidden) vollbildZu(); });

// ---------- Exportieren ----------
function exportZiel(wert) {
  const [art, id] = wert.split('|');
  if (art === 'einheit') { const e = einheitVon(id); return e && { pdf: pdfVon(e), name: dateiname(`Training ${L.datumDE(e.datum)}${e.nummer ? ' ' + e.nummer : ''}`) }; }
  if (art === 'liste') { const l = LISTEN.find(x => x.id === id); return l && { pdf: l.pdf, name: dateiname(`${l.titel} (Stand ${l.stand})`) }; }
  if (art === 'uebung') return { uebung: karteVon(id) };
  return null;
}
function exportVorbereiten() {
  document.querySelectorAll('[data-export]').forEach(b => {
    const z = exportZiel(b.dataset.export);
    if (z && z.pdf) pdfHolen(z.pdf).catch(() => {});
    if (z && z.uebung) jspdfVorbereiten().catch(() => {});
  });
}
async function exportieren(knopf, wert) {
  const z = exportZiel(wert); if (!z) return;
  const alt = knopf.innerHTML;
  knopf.disabled = true;
  try {
    if (z.pdf) { await teilen(await pdfHolen(z.pdf), z.name); return; }
    const u = z.uebung; if (!u) return;
    if (knopf.classList.contains('knopf') && !knopf.classList.contains('rund')) knopf.innerHTML = `${ico.teilen}Wird erstellt …`;
    const v = aktVariante(u);
    const e = einheitVon(v.einheit);
    const blob = await uebungAlsPdf({
      titel: u.titel,
      herkunft: e ? [`Aus der Einheit vom ${L.datumDE(e.datum)}`, v.label, e.mannschaft].filter(Boolean).join(' · ') : '',
      merkmale: [['Teil der Einheit', L.teileVonKarte(u).join(', ')], ...merkmaleZeilen(u), ['Jugend', (u.jugend || []).map(jugendText).join(', ')]],
      skizzen: v.skizzen || [],
      teile: v.teile || [],
    });
    knopf.innerHTML = alt;
    await teilen(blob, dateiname(`${u.titel}${e ? ' ' + L.datumDE(e.datum) : ''}`));
  } catch (err) {
    alert('Exportieren hat nicht geklappt: ' + (err.message || err));
  } finally {
    knopf.innerHTML = alt; knopf.disabled = false;
  }
}

// ---------- Ereignisse ----------
document.addEventListener('click', ev => {
  const a = ev.target.closest('a[href^="#"]');
  if (a && !ev.defaultPrevented) vorwaerts = true;
}, true);
document.addEventListener('submit', ev => {
  const f = ev.target.closest('[data-suche]'); if (!f) return;
  ev.preventDefault();
  f.q.blur();
});
// Suche schon beim Tippen
document.addEventListener('input', ev => {
  const feld = ev.target;
  if (!feld.matches || !feld.matches('[data-suchfeld]')) return;
  const q = feld.value;
  const { p } = hashTeile();
  const basis = p[0] === 'einheiten' ? '#/' + p.map(enc).join('/') : '#/suche';
  const leerHash = p[0] === 'einheiten' ? basis : '#/';
  const ziel = q.trim() ? `${basis}?q=${enc(q)}` : leerHash;
  const istSuche = location.hash.includes('?q=') || p[0] === 'suche';
  if (!istSuche && q.trim()) { history.pushState(null, '', ziel); schritte++; } else history.replaceState(null, '', ziel);
  aktHash = location.hash;
  const unter = document.getElementById('unter');
  if (unter) unter.innerHTML = q.trim() ? suchErgebnis(q) : (sucheBasis ? sucheBasis() : '');
  document.title = q.trim() ? 'Suche · Trainingsbibliothek' : (p[0] === 'einheiten' ? 'Einheiten · Trainingsbibliothek' : 'Trainingsbibliothek');
});
document.addEventListener('toggle', ev => {
  const d = ev.target; if (!d.matches) return;
  if (d.matches('details[data-fkey]')) d.open ? filterOffen.add(d.dataset.fkey) : filterOffen.delete(d.dataset.fkey);
  Admin.toggle(d);
}, true);

document.addEventListener('click', async ev => {
  const t = ev.target.closest('button, a'); if (!t) return;
  const d = t.dataset;
  if (d.export) { exportieren(t, d.export); return; }
  if ('zurueck' in d) { if (schritte > 0) history.back(); else geheZu('#/', true); return; }
  if (d.gross) { vollbildAuf(d.gross); return; }
  if (d.variante) { const [id, i] = d.variante.split('|'); gewaehlteVariante.set(id, +i); neuZeichnen(false); return; }
  if (d.filter) { const [k, w] = d.filter.split('|'); const i = filter[k].indexOf(w); i >= 0 ? filter[k].splice(i, 1) : filter[k].push(w); filterSpeichern(); neuZeichnen(false); return; }
  if ('filterZurueck' in d) { filterLeeren(); neuZeichnen(false); return; }
  if ('filterWeg' in d) { filterLeeren(); neuZeichnen(false); return; }
  if ('offlineWeg' in d) { offlineWeg = true; neuZeichnen(false); return; }
  if (d.sort) { sortierungSetzen(d.sort); neuZeichnen(false); return; }
  if (d.auf) {
    const o = offen || new Set();
    o.has(d.auf) ? o.delete(d.auf) : o.add(d.auf);
    offen = o; schreiben(ABLAGE.offen, [...o]); neuZeichnen(false); return;
  }
  if (d.allesAuf) {
    const auf = d.allesAuf === 'auf';
    offen = new Set(auf ? L.saisonGruppen(einheitenGefiltert()).map(g => 's:' + g.saison) : []);
    schreiben(ABLAGE.offen, [...offen]); schreiben(ABLAGE.allesAuf, auf); neuZeichnen(false); return;
  }
  if (d.monatAuf) { monatAuf.has(d.monatAuf) ? monatAuf.delete(d.monatAuf) : monatAuf.add(d.monatAuf); neuZeichnen(false); return; }
  if (d.merken) { merkenUmschalten(d.merken); neuZeichnen(false); return; }
  if (d.merkWeg) { merkenUmschalten(d.merkWeg); neuZeichnen(false); return; }
  await Admin.klick(t, d);
});

// ---------- Start ----------
Admin.einrichten({ geheZu, neuZeichnen, einheitKopf, seiteEinheitGanz });
beiAenderung(() => { suchCache = null; neuZeichnen(false); });
route();
starten().catch(e => { $inhalt.innerHTML = `<div class="kopf"><h1>Trainingsbibliothek</h1></div><div class="leer">Die Daten konnten nicht geladen werden. Bitte später noch einmal öffnen. (${esc(e.message || e)})</div>`; });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
