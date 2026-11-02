// Sortierung nach Entwurf 3 (Stand 02.11.2026). Änderungen hier wirken überall in der App.

export const SPIELPHASEN = ['Spiel mit dem Ball', 'Spiel gegen den Ball', 'Umschaltspiel', 'Standardsituationen'];

// Überschriften über den Schwerpunkten. Jeder Schwerpunkt kann Unterpunkte haben (nur zur Erklärung).
export const SCHWERPUNKT_GRUPPEN = [
  { name: 'Technik', punkte: [
    ['Passspiel', 'Druckpässe, schnelles Passspiel'],
    ['Ballan- und -mitnahme', 'First Touch, erster Kontakt'],
    ['Dribbling', ''],
    ['Finten', ''],
    ['Aufdrehbewegungen', ''],
    ['Flugbälle', ''],
    ['Volley', ''],
    ['Kopfball', ''],
    ['Ball Mastery', ''],
    ['Vororientierung', 'Spielübersicht vor dem ersten Kontakt'],
    ['Basistechniken allgemein', ''],
  ]},
  { name: 'Taktik', punkte: [
    ['Zusammenspiel', 'Spiel über Dritte, Doppelpass, Steil-Klatsch, Hinterlaufen, Kreuzen, Blank spielen, enger Raum'],
    ['Pressing', 'Gegenpressing, situatives Pressing'],
    ['Spieleröffnung', ''],
    ['Spielverlagerung', 'Diagonalität im Ballbesitz'],
    ['Spiel in die Tiefe', 'Schnittstellenbälle'],
    ['Korridorspiel', 'Tiefe, Halbraum, Zentrum, vertikal, horizontal'],
    ['Umschaltverhalten', ''],
    ['Verteidigen in der Gruppe', 'Defensivverhalten im Zentrum, überlappendes Verteidigen, Abwehrdreieck'],
    ['Kreieren von Torchancen', 'Nachbar von Torschuss'],
    ['Raumaufteilung', ''],
  ]},
  { name: '1 gegen 1 und Zweikampf', punkte: [
    ['1 gegen 1 und Zweikampf', 'offensiv oder defensiv, nah oder fern, frontal oder seitlich, Gegner im Rücken, eindrehende Spitze, nachrückender Gegenspieler'],
  ]},
  { name: 'Torschuss', punkte: [
    ['Torschuss', ''],
    ['Kreieren von Torchancen', 'steht auch unter Taktik'],
  ]},
  { name: 'Athletik', punkte: [
    ['Schnelligkeit', ''],
    ['Kraft, Stabilität und Beweglichkeit', 'Kraftausdauer, HIIT'],
    ['Koordination', ''],
    ['Wahrnehmung und Kognition', 'Handlungsschnelligkeit, Life-Kinetik, Reaktionsspiele'],
  ]},
];

export const ALLE_SCHWERPUNKTE = [...new Set(SCHWERPUNKT_GRUPPEN.flatMap(g => g.punkte.map(p => p[0])))];

export const ZWEIKAMPF_UNTERPUNKTE = ['offensiv', 'defensiv', 'nah', 'fern', 'frontal', 'seitlich', 'Gegner im Rücken', 'eindrehende Spitze', 'nachrückender Gegenspieler'];

export const FORMEN = ['Übungsform', 'Spielform'];
export const ZAHLEN = ['Gleichzahl', 'Überzahl', 'Unterzahl'];
export const ARTEN = ['Rondo', 'ohne feste Richtung', 'mit fester Richtung', 'Chaos', 'Spaß und Wettkampf'];
export const ORTE = ['Zentrum', 'Halbraum', 'Flügel'];
export const JUGENDEN = [['E', 'U10/U11'], ['D', 'U12/U13'], ['C', 'U14/U15']];
export const QUALITAETEN = ['niedrig', 'mittel', 'hoch'];
export const TEILE = ['Aktivierung', 'Hauptteil', 'Abschlussspiel'];

export function teilVon(label) {
  if (!label) return '';
  if (/^AS$|^S$/.test(label)) return 'Abschlussspiel';
  if (/^A/.test(label)) return 'Aktivierung';
  if (/^H/.test(label)) return 'Hauptteil';
  return '';
}
