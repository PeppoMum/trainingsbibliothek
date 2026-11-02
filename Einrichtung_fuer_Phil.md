# Trainingsbibliothek – einmalige Einrichtung

Stand 02.11.2026. Alles kostenlos. Kein Zahlungsmittel hinterlegen.

## 1. GitHub-Speicher anlegen

1. Auf github.com anmelden, oben rechts „+“ → „New repository“.
2. Name: `trainingsbibliothek`
3. „Private“ auswählen.
4. Sonst nichts ankreuzen (keine README, keine .gitignore) → „Create repository“.
5. Mir Bescheid geben. Den Rest dort mache ich.

## 2. Firebase-Projekt anlegen

1. console.firebase.google.com öffnen, mit deinem Google-Konto anmelden.
2. „Projekt erstellen“, Name: `Trainingsbibliothek`. Google Analytics ausschalten. Erstellen.
3. Tarif bleibt „Spark“ (kostenlos). Nicht auf „Blaze“ wechseln.

## 3. Datenbank einschalten

1. Links „Build“ (bzw. „Erstellen“) → „Firestore Database“ → „Datenbank erstellen“.
2. Standort: `europe-west3 (Frankfurt)`.
3. „Im Produktionsmodus starten“ → „Erstellen“.

## 4. Anmeldung einschalten (nur damit du ändern kannst)

1. Links „Authentication“ → „Jetzt starten“ → Reiter „Sign-in method“.
2. „Google“ aktivieren, deine E-Mail als Support-Adresse wählen, speichern.

## 5. Web-App registrieren

1. Zahnrad oben links → „Projekteinstellungen“ → Reiter „Allgemein“.
2. Unten bei „Meine Apps“ auf das Symbol `</>` klicken.
3. Name: `Trainingsbibliothek`. Häkchen bei „Firebase Hosting“ setzen. „App registrieren“.
4. Es erscheint ein Block `const firebaseConfig = { ... }`. Diesen Block kopieren und mir schicken. Er ist nicht geheim.

## 6. Schlüssel für das automatische Hochladen

Damit GitHub die App selbst bei Firebase hochladen kann:

1. Projekteinstellungen → Reiter „Dienstkonten“ → „Neuen privaten Schlüssel generieren“. Es wird eine Datei heruntergeladen.
2. Auf GitHub im Speicher `trainingsbibliothek`: „Settings“ → „Secrets and variables“ → „Actions“ → „New repository secret“.
3. Name: `FIREBASE_SERVICE_ACCOUNT`. Bei „Secret“ den kompletten Inhalt der heruntergeladenen Datei einfügen (Datei mit TextEdit öffnen, alles kopieren). Speichern.
4. Die Datei danach vom Mac löschen. **Diese Datei bitte nie an mich oder jemand anderen schicken.**

Danach mir Bescheid geben.
