const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

function normalizeChurchName(name) {
  if (!name) return '';
  return name.toUpperCase()
    .replace(/^GKLI\s+/, '')
    .replace(/[^A-Z0-9\s]/g, ' ') 
    .replace(/\s+/g, ' ')         
    .trim();
}

function normalizeResortName(r) {
  if (!r) return '-';
  const val = r.toUpperCase().replace(/^RESORT\s+/, '').replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return val || '-';
}

function getChurchIdentityKey(c) {
  if (c.type === 'resort') return `RESORT_${normalizeResortName(c.resort)}`;
  return `${normalizeResortName(c.resort)}_${normalizeChurchName(c.nama)}`;
}

async function check() {
  const ch = await getDocs(collection(db, 'churches'));
  const allChurches = ch.docs.map(d => ({id: d.id, ...d.data()}));
  
  const idToPrefId = {};
  const prefIdToAliases = {};

  allChurches.forEach(c => {
    const key = getChurchIdentityKey(c);
    const existingId = idToPrefId[key];
    if (!existingId) {
      idToPrefId[key] = c.id;
    }
  });

  console.log("Total churches:", allChurches.length);
  
  const targetId = 't6KiJ2GTR2XK92lnrKti';
  const c = allChurches.find(x => x.id === targetId);
  if(c) {
     console.log("Target ID exists in DB! Key:", getChurchIdentityKey(c));
  } else {
     console.log("Target ID DOES NOT EXIST in DB!");
  }
  process.exit();
}
check();
