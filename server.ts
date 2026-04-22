
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import axios from 'axios';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase Config from file
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

// Constants
const SPREADSHEET_COLUMNS = {
  laporan: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  pelean: ['Pendidikan', 'Ulang Tahun', 'PGI/LWF/UEM', 'Zending', 'Pensiun', 'Diakonia'],
  alaman: ['Almanak', 'Kalender', 'Evang. Edisi 1', 'Evang. Edisi 2', 'Evang. Edisi 3', 'Buku SKM', 'Buku Ende', 'Agenda Batak', 'Agenda Indonesia', 'Confesi Ausburg']
};

const CATEGORY_LABELS = {
  laporan: 'Persembahan II',
  pelean: 'Persembahan Khusus (Namarboho)',
  alaman: 'Literatur'
};

const app = express();
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false, // Vite needs this disabled for dev
}));
app.use(express.json());

const PORT = 3000;

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

async function sendAutomatedReminders() {
  console.log('[CRON] Menjalankan Penagihan Otomatis...');
  
  // 0. Fetch Settings from Firestore
  let apiKey = process.env.WATZAP_API_KEY;
  let sender = process.env.WATZAP_SENDER;

  try {
    const settingsSnap = await getDocs(query(collection(db, 'settings')));
    const appSettings = settingsSnap.docs.find(d => d.id === 'app')?.data();
    if (appSettings?.watzapApiKey) apiKey = appSettings.watzapApiKey;
    if (appSettings?.watzapSender) sender = appSettings.watzapSender;
  } catch (err) {
    console.warn('[CRON] Gagal memuat setting dari Firestore, menggunakan Env.');
  }

  if (!apiKey || !sender) {
    console.warn('[CRON] WATZAP_API_KEY atau WATZAP_SENDER belum dikonfigurasi. Penagihan dibatalkan.');
    return;
  }

  try {
    const currentPeriod = new Date().getFullYear().toString();
    const currentMonthIdx = new Date().getMonth(); // 0-11
    
    // 1. Fetch Churches
    const churchSnap = await getDocs(collection(db, 'churches'));
    const churches = churchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    // 2. Fetch Payments for current period
    const paymentSnap = await getDocs(query(collection(db, 'payments'), where('periode', '==', currentPeriod)));
    const payments = paymentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    console.log(`[CRON] Memproses ${churches.length} jemaat untuk periode ${currentPeriod}`);

    for (const church of churches) {
      if (!church.wa) continue;

      const arrears: Record<string, string[]> = {};
      let hasArrears = false;

      Object.entries(SPREADSHEET_COLUMNS).forEach(([cat, cols]) => {
        const payment = payments.find(p => p.gerejaId === church.id && p.kategori === cat && p.periode === currentPeriod);
        let unpaid = cols.filter(col => !payment || !payment.details[col] || payment.details[col] === 0);
        
        // Smart Filter: Only include months up to current month for 'laporan'
        if (cat === 'laporan') {
          unpaid = unpaid.filter(col => {
            const monthIdx = SPREADSHEET_COLUMNS.laporan.indexOf(col);
            return monthIdx !== -1 && monthIdx <= currentMonthIdx;
          });
        }

        if (unpaid.length > 0) {
          arrears[cat] = unpaid;
          hasArrears = true;
        }
      });

      if (hasArrears) {
        const summaryLines: string[] = [];
        Object.entries(arrears).forEach(([cat, fields]) => {
          summaryLines.push(`*${(CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat).toUpperCase()}*:`);
          summaryLines.push(`  - ${fields.join(', ')}`);
        });

        const message = `Syalom Bapak/Ibu Majelis Jemaat *${church.nama}*, kami dari Kantor Pusat GKLI ingin mengingatkan secara otomatis terkait kewajiban persembahan periode ${currentPeriod} yang belum kami terima (Tunggakan):\n\n${summaryLines.join('\n')}\n\nMohon kerja samanya untuk segera melengkapi setoran tersebut. Terima kasih, Tuhan memberkati.`;

        // Send via Watzap (Using standard endpoint for session-based numbers)
        try {
          await axios.post('https://api.watzap.id/v1/send_message', {
            api_key: apiKey,
            number_key: sender,
            phone_no: church.wa,
            message: message
          });
          console.log(`[CRON] Terkirim via WA ke ${church.nama} (${church.wa})`);
        } catch (err: any) {
          console.error(`[CRON] Gagal mengirim ke ${church.nama}:`, err.response?.data || err.message);
        }
      }
    }
    console.log('[CRON] Selesai.');
  } catch (err) {
    console.error('[CRON] Error during processing:', err);
  }
}

// Global Cron Schedule: Tanggal 15 dan 30 jam 09:00 WIB
// Seconds Minutes Hours DayOfMonth Month DayOfWeek
cron.schedule('0 0 9 15,30 * *', () => {
  sendAutomatedReminders();
}, {
  timezone: "Asia/Jakarta"
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Manual Trigger for Testing (Requires Admin Auth ideally, but let's keep it simple for now)
app.post('/api/cron/trigger', async (req, res) => {
  // Simple check for a secret token if you want security
  // if (req.headers['x-cron-token'] !== process.env.CRON_TOKEN) return res.status(401).send();
  
  await sendAutomatedReminders();
  res.json({ message: 'Penagihan otomatis dipicu secara manual' });
});

// Vite Middleware setup
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

setupVite();
