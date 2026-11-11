// Kleine Ablage im Browser je Gerät: Merkliste, Filter, Sortierung, auf- und zugeklappte Saisons.
// Klappt das Speichern nicht (privates Fenster), läuft die App trotzdem.
export function lesen(schluessel, ersatz) {
  try {
    const roh = localStorage.getItem(schluessel);
    return roh == null ? ersatz : JSON.parse(roh);
  } catch { return ersatz; }
}
export function schreiben(schluessel, wert) {
  try { localStorage.setItem(schluessel, JSON.stringify(wert)); } catch { /* ohne Ablage weiter */ }
}

export const ABLAGE = {
  merkliste: 'tb-merkliste',
  filter: 'tb-filter',
  sortierung: 'tb-sortierung',
  offen: 'tb-offen',
  ansicht: 'tb-ansicht',
};
