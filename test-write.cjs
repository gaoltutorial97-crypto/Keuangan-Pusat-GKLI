const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
const config = require('./firebase-applet-config.json');

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function test() {
  try {
    await setDoc(doc(db, 'settings', 'whatsapp'), { status: 'test' });
    console.log('Success writing to settings/whatsapp');
  } catch (e) {
    console.error('Error:', e.message);
  }
}
test();
