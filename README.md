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
