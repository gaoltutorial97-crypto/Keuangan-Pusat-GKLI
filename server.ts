
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import axios from 'axios';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, doc, query, where } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
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

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateAndSendDailyDevotion() {
  console.log('[CRON] Men-generate Renungan Harian...');
  // Check timezone / date
  const todayRaw = new Date();
  const dateStr = todayRaw.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
  
  try {
    // 0. Fetch Settings from Firestore
    let apiKey = process.env.WATZAP_API_KEY;
    let sender = process.env.WATZAP_SENDER;
    let groupId = '';

    const settingsSnap = await getDocs(query(collection(db, 'settings')));
    const appSettings = settingsSnap.docs.find(d => d.id === 'config')?.data();
    if (appSettings?.watzapApiKey) apiKey = appSettings.watzapApiKey;
    if (appSettings?.watzapSender) sender = appSettings.watzapSender;
    if (appSettings?.watzapGroupId) groupId = appSettings.watzapGroupId;

    const promptText = `Tuliskan pesan renungan pastoral singkat untuk dikirim ke jemaat Gereja (Lutheran) melalui grup WhatsApp.
PENTING: Gaya bahasa harus SANGAT NATURAL, luwes, selayaknya bahasa manusia dan bahasa Indonesia yang baik dan benar (tidak kaku seperti terjemahan mesin).
DILARANG KERAS menggunakan kata-kata kaku bot/AI seperti "kesimpulannya", "pada dasarnya", "adapun", atau list berupa poin-poin (bullet). Mengalir saja seperti pendeta yang sedang menulis pesan otentik.
DILARANG KERAS menggunakan satupun emoji/emoticon dalam teks.
DILARANG KERAS menggunakan tanda baca asteris/bintang (*) atau format markdown (seperti **, _, #). Biarkan tulisan apa adanya berupa teks biasa namun berkualitas dan profesional.

Kriteria Khusus:
1. Tidak keluar dari konteks teks, historis, teologis, logis, dan pastoral.
2. Berdasarkan Doktrin Lutheran Konservatif, Biblis, Apologetika Lutheran, serta pembedaan yang jelas antara Hukum Taurat (teguran dosa) dan Injil (pengampunan Kristus) - Law and Gospel.
3. Tafsir yang dalam namun mudah dipahami oleh jemaat Lutheran awam.
4. Kaitkan dengan topik yang sedang relevan/viral/menarik saat ini di masyarakat, untuk menjadi solusi dan penguatan bagi pergumulan jemaat.

Struktur (Gabungkan menjadi 3-4 paragraf saja):
1. Salam pembuka "Syalom Bapak/Ibu terkasih..." lalu letakkan 1 ayat Alkitab pendek yang sesuai.
2. Refleksi yang menjawab tantangan masa kini dengan kebenaran Firman Tuhan.
3. Doa penutup yang sangat singkat (misal: "Mari kita berdoa... Amin.")`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptText,
    });

    const devotionContent = response.text;
    if (!devotionContent) throw new Error("Gagal generate renungan dari Gemini");

    // Save to Firestore for display in UI Dashboard
    await setDoc(doc(db, 'devotions', dateStr), {
      date: dateStr,
      content: devotionContent,
      createdAt: new Date().toISOString()
    });

    console.log(`[CRON] Renungan berhasil disimpan untuk tanggal ${dateStr}`);

    // Send to Watzap if configured
    if (apiKey && sender && groupId) {
      // Assuming user inputs Watzap Group ID, Watzap uses 'group_id' in a specific endpoint or phone_no 
      // We'll try the group message endpoint if it contains a dash (typical WA group ID usually contains a dash or just use send_message_group)
      let endpoint = 'https://api.watzap.id/v1/send_message_group';
      let payload: any = {
        api_key: apiKey,
        number_key: sender,
        message: devotionContent
      };
      
      if (groupId.includes('-') || groupId.length > 15) {
         payload.group_id = groupId;
      } else {
         // Fallback to normal message if it looks like a normal phone number
         endpoint = 'https://api.watzap.id/v1/send_message';
         payload.phone_no = groupId;
      }

      await axios.post(endpoint, payload);
      console.log(`[CRON] Renungan terkirim ke WhatsApp Group/Nomor ${groupId}`);
    } else {
      console.warn('[CRON] Watzap Group ID/API Key tidak lengkap. Tidak dikirim ke WA.');
    }
    
    return devotionContent;
  } catch (err: any) {
    console.error('[CRON] Gagal memproses renungan harian:', err.message);
    throw err;
  }
}

async function sendAutomatedReminders() {
  console.log('[CRON] Menjalankan Penagihan Otomatis...');
  
  // 0. Fetch Settings from Firestore
  let apiKey = process.env.WATZAP_API_KEY;
  let sender = process.env.WATZAP_SENDER;

  try {
    const settingsSnap = await getDocs(query(collection(db, 'settings')));
    const appSettings = settingsSnap.docs.find(d => d.id === 'config')?.data();
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

// Jadwal Renungan Harian (Setiap Hari Jam 06:00 WIB)
cron.schedule('0 0 6 * * *', () => {
  generateAndSendDailyDevotion();
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

app.post('/api/cron/devotion', async (req, res) => {
  try {
    const content = await generateAndSendDailyDevotion();
    res.json({ message: 'Renungan Harian berhasil di-generate', content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
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
