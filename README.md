# Trainingsbibliothek

App für iPhone, iPad und Mac (läuft im Browser, auf dem Startbildschirm ablegbar). Kostenlos bei Firebase.

- Ansehen: jeder mit dem Link, ohne Anmeldung. Sichtbar ist nur, was Phil aufgenommen hat.
- Ändern: nur Phil nach Anmeldung mit Google (Vorschläge prüfen, Merkmale und Qualität ändern).
- Skizzen: die nachgezeichneten Skizzen aus der Digitalisierung (SVG in `public/skizzen/`).

## Aufbau

- `public/` – die App (ohne Bauschritt). `firebase-config.js` enthält die Firebase-Werte und das Admin-Konto.
- `public/daten/vorschlaege.json` – neue Einheiten und Übungskarten als Vorschläge (wird nicht mit hochgeladen, nur eingespielt).
- `firestore.rules` – Ansehen für alle, Ändern nur Admin (E-Mail eintragen).
- `.github/workflows/hochladen.yml` – lädt bei jedem Push auf `main` die App hoch und spielt neue Vorschläge ein. Braucht das Secret `FIREBASE_SERVICE_ACCOUNT`.
- `werkzeug/` – Aufbereitung der digitalisierten Seiten:
  1. `parse_seiten.py <ordner mit seite.html je Einheit> roh.json`
  2. `baue_daten.py roh.json einheiten.json`
  3. `karten.py einheiten.json public` → `public/daten/vorschlaege.json` und `public/skizzen/`
  Quellen der Seiten: `/mnt/project-files/digitalisiert/quellen/satz_quellen_html_svg.tgz` (Ordner `arbeit/<saison>/<datum>/`).
- `werkzeug/einspielen/einspielen.mjs` – legt nur neue Einträge in Firestore an, überschreibt nie Phils Änderungen.

## Lokal ansehen (Vorschau ohne Firebase)

`cd public && python3 -m http.server 8765` und http://localhost:8765 öffnen. Änderungen bleiben dann nur im Browser.

## Stand

- 02.11.2026: Saison 2026/27 aufbereitet (32 Einheiten, 65 Übungskarten, 111 Einsätze). Merkmale sind Vorschläge, Phil prüft jede Einheit unter „Prüfen“.
- 02.11.2026: Alle älteren Saisons (2020/21 bis 2025/26) eingespielt: 344 Einheiten, 624 neue Karten, 44 Karten aus 2026/27 um ältere Varianten ergänzt. Auf Phils Wunsch direkt „aufgenommen“ (ohne Einzelprüfung). Merkmale per Stichwort vorgeschlagen (`werkzeug/merkmale_auto.py`), Phil kann sie jederzeit ändern.
  Ablauf: `sammle_alle.py` (Quellseiten) → `zuordnung.py` (Abgleich mit den fertigen PDFs, Datum = PDF-Name) → `alle_einheiten.py` (Korrekturen aus den PDFs, Torwarttraining raus) → `karten_alle.py` (Karten über alle Saisons).
  Neu: Einheiten haben das Feld `schwerpunkte` (aus der SP-Zeile, auf der Einheit-Seite änderbar) und lassen sich danach filtern.
- 03.11.2026: Neuer Menüpunkt „Listen“ mit den Schwerpunktlisten U13 (Stand Juli 2026) und U14/U15 (Stand Juli 2024) als PDF in `public/listen/` (nur abgelegt, kein Abgleich mit Einheiten). Neu „Exportieren“ bei Einheit (gibt das fertige PDF weiter), Übung (erzeugt ein A4-Blatt mit Merkmalen, Skizze, Ablauf, Coachingpunkten; `public/export.js`, jsPDF 2.5.1 liegt in `public/lib/`) und Schwerpunktliste. Am iPhone/Mac öffnet sich das Teilen-Fenster, sonst Download. Neue Liste: PDF nach `public/listen/` und Eintrag in `LISTEN` in `app.js`.
