// Firebase-Werte aus der Firebase-Konsole (Projekteinstellungen → Allgemein → Meine Apps → firebaseConfig).
// Diese Werte sind nicht geheim. Ist apiKey leer, läuft die App als Vorschau mit den Daten aus daten/vorschlaege.json.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAMfL9cV_7JU84ioX3KPLkEzBRilC34q64',
  authDomain: 'trainingsbibliothek.firebaseapp.com',
  projectId: 'trainingsbibliothek',
  storageBucket: 'trainingsbibliothek.firebasestorage.app',
  messagingSenderId: '589982230527',
  appId: '1:589982230527:web:fbb0bea6ff75e94003a9ca',
};

// Wer ändern darf: Prüfsumme (SHA-256, hexadezimal) der E-Mail-Adresse in Kleinbuchstaben, damit die Adresse
// nicht öffentlich im Code steht. Muss mit firestore.rules übereinstimmen.
// Neue Prüfsumme: python3 -c "import hashlib;print(hashlib.sha256('adresse@beispiel.de'.encode()).hexdigest())"
export const ADMIN_HASHES = ['c34b232ece26bb21d6de23a4a8e117de9f99cc6c76bfb004d9d71023b6cc7b6a'];
