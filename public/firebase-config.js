// Wird nach der Einrichtung mit den Werten aus der Firebase-Konsole gefüllt
// (Projekteinstellungen → Allgemein → Meine Apps → firebaseConfig). Diese Werte sind nicht geheim.
// Solange apiKey leer ist, läuft die App in der Vorschau mit den Daten aus daten/vorschlaege.json.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAMfL9cV_7JU84ioX3KPLkEzBRilC34q64',
  authDomain: 'trainingsbibliothek.firebaseapp.com',
  projectId: 'trainingsbibliothek',
  storageBucket: 'trainingsbibliothek.firebasestorage.app',
  messagingSenderId: '589982230527',
  appId: '1:589982230527:web:fbb0bea6ff75e94003a9ca',
};

// Wer ändern darf (Google-Konto). Muss mit firestore.rules übereinstimmen.
export const ADMIN_EMAILS = [];
