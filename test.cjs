const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  const ps = await getDocs(collection(db, 'payments'));
  let found = 0;
  for(const d of ps.docs) {
    const p = d.data();
    if(p.kategori === 'laporan' && (p.jumlah > 0 || Object.keys(p.details || {}).length > 0)) {
       console.log(d.id, "=>", p.gerejaId, p.kategori, p.periode, p.details);
       found++;
    }
  }
  console.log("Total laporan payments:", found);
  process.exit();
}
check();
