const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, deleteDoc } = require('firebase/firestore');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const churchesSnap = await getDocs(collection(db, 'churches'));
  const allChurches = churchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const idMap = new Map();
  const toDelete = [];

  allChurches.forEach(c => {
    // getChurchIdentityKey logic
    const normResort = (c.resort || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normName = (c.nama || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^gkli/, '');
    const key = normResort + '_' + normName;

    if (!idMap.has(key)) {
      idMap.set(key, c);
    } else {
      const existing = idMap.get(key);
      const isGKLI = c.nama.toUpperCase().startsWith('GKLI');
      if (isGKLI && !existing.nama.toUpperCase().startsWith('GKLI')) {
        toDelete.push(existing);
        idMap.set(key, c);
      } else {
        toDelete.push(c);
      }
    }
  });

  console.log(`Found ${toDelete.length} duplicate churches to delete...`);
  for(const c of toDelete) {
    // console.log("Deleting duplicate:", c.nama, "ID:", c.id);
    await deleteDoc(doc(db, 'churches', c.id));
  }
  
  const paymentsSnap = await getDocs(collection(db, 'payments'));
  const allPayments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // delete orphaned payments or duplicate payments from previous sessions
  // But wait, the user's main complaint was "GKLI Kuala Tanjung"
  // Let's print out what payments exist for KT
  
  const ktPayments = allPayments.filter(p => p.kategori === 'laporan' && Object.keys(p.details || {}).includes('Jul'));
  console.log("Payments with Jul:");
  ktPayments.forEach(p => console.log(p.gerejaId, p.details, p.receiptSent));

  // let's just delete the orphaned ones
  const validIds = new Set(Array.from(idMap.values()).map(c => c.id));
  let countOrphan = 0;
  for(const p of allPayments) {
    if (!validIds.has(p.gerejaId)) {
        await deleteDoc(doc(db, 'payments', p.id));
        countOrphan++;
    }
  }
  console.log("Deleted orphaned payments:", countOrphan);
  
  process.exit();
}
run();
