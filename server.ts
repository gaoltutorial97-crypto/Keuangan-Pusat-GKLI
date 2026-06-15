
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import axios from 'axios';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, doc, query, where, addDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';


dotenv.config();

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
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

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

    const dayOfYear = Math.floor((todayRaw.getTime() - new Date(todayRaw.getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);

    const promptText = `Tuliskan pesan renungan pastoral singkat siap saji dan luar biasa untuk dikirim ke jemaat Gereja (Lutheran) melalui grup WhatsApp.
PENTING: Gaya bahasa harus SANGAT NATURAL, luwes, selayaknya bahasa manusia dan bahasa Indonesia yang baik dan benar (tidak kaku seperti terjemahan mesin).
DILARANG KERAS menggunakan kata-kata kaku bot/AI seperti "kesimpulannya", "pada dasarnya", "adapun", atau list berupa poin-poin (bullet). Mengalir saja seperti pendeta yang sedang menulis pesan otentik.
DILARANG KERAS menggunakan satupun emoji/emoticon dalam teks.
DILARANG KERAS menggunakan tanda baca asteris/bintang (*) atau format markdown (seperti **, _, #). Biarkan tulisan apa adanya berupa teks biasa namun berkualitas dan profesional.
PASTIKAN PENGGUNAAN KATA SELALU BERVARIASI DAN TIDAK IDENTIK DENGAN RENUNGAN SEBELUMNYA. Jangan menggunakan pola kalimat yang repetitif setiap kali generate.

URUTAN PEMBACAAN ALKITAB:
Hari ini adalah hari ke-${dayOfYear} dari 365. Berdasarkan jadwal pembacaan Alkitab kronologis satu tahun (mulai berurut dari Kejadian sampai Wahyu), tentukan SATU perikop/pasal yang jatuh pada hari ini, dan ambil 1 ayat bagian dari perikop tersebut sebagai teks renungan utama.

Kriteria Khusus Theologi:
1. Konteks: Tafsiran tidak boleh keluar dari konteks teks, historis, teologis, logis, dan penerapan hermeneutik dekat maupun jauh.
2. Teologi & Doktrin: Sepenuhnya berlandaskan Doktrin Lutheran Konservatif (Book of Concord), Apologetika Lutheran, biblis, dan memegang teguh pembedaan tajam antara Hukum Taurat (Law - yang menegur dosa) dan Injil (Gospel - yang menghidupkan dan memberi pengampunan Kristus).
3. Akademis Namun Praktis: Mengandung struktur yang jelas dan dalam (mengambil pandangan pakar ahli Lutheran tentang homiletika/khotbah), namun disajikan dengan bahasa pastoral yang mudah dan nyaman dipahami oleh pendeta dan jemaat awam.
4. Topikal & Solutif: Singgung fenomena viral/topik yang selalu menarik di masyarakat saat ini, gunakan sebagai titik temu untuk memberikan solusi dan penguatan bagi pergumulan konkrit jemaat.

Struktur (Gabungkan menjadi 1 tulisan utuh 3-4 paragraf yang mengalir tanpa sub-judul atau penomoran angka):
- Salam pembuka "Syalom Bapak/Ibu terkasih..." lalu cantumkan 1 ayat Alkitab yang terpilih hari ini.
- Refleksi mendalam yang menjawab tantangan masa kini berdasarkan Hukum Taurat dan Injil.
- Doa penutup yang sangat singkat menyatu di akhir tulisan (misal: "Mari kita berdoa... Amin.")`;

    let devotionContent = "";
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptText,
      });
      devotionContent = response.text || "";
    } catch (aiErr) {
      console.error("Gemini AI API Error in Cron Job:", aiErr);
      devotionContent = "Syalom Bapak/Ibu terkasih. \n\nMari senantiasa mengandalkan Tuhan dalam setiap langkah kehidupan kita hari ini. Tuhan Yesus memberkati.\n\nMari kita berdoa... Amin.";
    }

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

// Helper: Normalized phone matching
async function findChurchAndArrearsByPhone(phone: string, activeYear: string = '2026') {
  try {
    const rawNum = phone.replace(/[^0-9]/g, '');
    let norm = rawNum;
    if (rawNum.startsWith('62')) norm = rawNum.slice(2);
    else if (rawNum.startsWith('0')) norm = rawNum.slice(1);
    
    if (!norm) return null;
    
    // Fetch all churches
    const churchSnap = await getDocs(collection(db, 'churches'));
    const churches = churchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    const matchedChurch = churches.find(c => {
      const waClean = (c.wa || '').replace(/[^0-9]/g, '');
      const waPendetaClean = (c.waPendeta || '').replace(/[^0-9]/g, '');
      
      const checkMatch = (str: string) => {
        if (!str) return false;
        let cStr = str;
        if (str.startsWith('62')) cStr = str.slice(2);
        else if (str.startsWith('0')) cStr = str.slice(1);
        return cStr.includes(norm) || norm.includes(cStr);
      };
      
      return checkMatch(waClean) || checkMatch(waPendetaClean);
    });
    
    if (!matchedChurch) return null;
    
    // Fetch payments for matched church
    const paymentSnap = await getDocs(query(collection(db, 'payments'), where('gerejaId', '==', matchedChurch.id), where('periode', '==', activeYear)));
    const payments = paymentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    const arrears: Record<string, string[]> = {};
    let totalArrearsSum = 0;
    const currentMonthIdx = new Date().getMonth();
    
    Object.entries(SPREADSHEET_COLUMNS).forEach(([cat, cols]) => {
      const payment = payments.find(p => p.kategori === cat);
      let unpaid = cols.filter(col => !payment || !payment.details[col] || payment.details[col] === 0);
      
      if (cat === 'laporan') {
        unpaid = unpaid.filter(col => {
          const monthIdx = SPREADSHEET_COLUMNS.laporan.indexOf(col);
          return monthIdx !== -1 && monthIdx <= currentMonthIdx;
        });
      }
      
      if (unpaid.length > 0) {
        arrears[cat] = unpaid;
        const rate = cat === 'laporan' ? 100000 : (cat === 'pelean' ? 75000 : 50000);
        totalArrearsSum += unpaid.length * rate;
      }
    });
    
    return {
      church: matchedChurch,
      arrears,
      estimatedTotal: totalArrearsSum,
    };
  } catch (error) {
    console.error('Error finding church by phone:', error);
    return null;
  }
}

// Format Phone to JID helper
function formatPhoneToJid(phone: string) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  }
  return cleaned + '@s.whatsapp.net';
}

// 4. Send Message (saves log and optional relay)
app.post('/api/send-message', async (req, res) => {
  try {
    const { phone_no, message } = req.body;
    if (!phone_no || !message) return res.status(400).json({ error: 'Phone number and message are required' });
    
    let sendStatus = 'failed';
    
    const messageLog = {
      phone: phone_no,
      message,
      type: 'outgoing',
      status: sendStatus,
      timestamp: new Date().toISOString()
    };
    
    await addDoc(collection(db, 'whatsapp_messages'), messageLog);
    
    // If real Watzap setup exists, try sending (Legacy Fallback)
    const snap = await getDocs(query(collection(db, 'settings')));
    const config = snap.docs.find(d => d.id === 'config')?.data();
    if (config?.watzapApiKey && config?.watzapSender) {
      try {
        await axios.post('https://api.watzap.id/v1/send_message', {
          api_key: config.watzapApiKey,
          number_key: config.watzapSender,
          phone_no: phone_no,
          message: message
        });
        sendStatus = 'sent';
      } catch (axErr: any) {
        console.warn('Watzap endpoint call failed, logged message locally: ', axErr.message);
      }
    }
    
    res.json({ success: true, log: messageLog });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Send Bulk Broadcast
app.post('/api/send-bulk', async (req, res) => {
  try {
    const { recipients, messageTemplate } = req.body;
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients array is required' });
    }
    
    const sentLogs = [];
    const baseTemplate = messageTemplate || "Halo {{nama}}, kami mengingatkan perihal persembahan GKLI.";
    
    for (const item of recipients) {
      let formattedMsg = baseTemplate
        .replace(/\{\{nama\}\}/g, item.nama || item.name || "Bapak/Ibu")
        .replace(/\{\{nominal\}\}/g, item.nominal ? item.nominal.toString() : '0')
        .replace(/\{\{jatuh_tempo\}\}/g, item.jatuh_tempo || item.dueDate || "akhir bulan");
      
      let sendStatus = 'failed';
      const targetPhone = item.wa || item.phone;
      
      const messageLog = {
        phone: targetPhone,
        message: formattedMsg,
        type: 'outgoing',
        status: sendStatus,
        timestamp: new Date().toISOString()
      };
      
      await addDoc(collection(db, 'whatsapp_messages'), messageLog);
      sentLogs.push(messageLog);
    }
    
    res.json({ success: true, total: recipients.length, logs: sentLogs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Get Chat Messages
app.get('/api/messages', async (req, res) => {
  try {
    const snap = await getDocs(collection(db, 'whatsapp_messages'));
    const messages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    // Sort in code by timestamp
    messages.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(messages.slice(0, 100)); // limit 100
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Get Debtors list calculated dynamically from db
app.get('/api/debtors', async (req, res) => {
  try {
    const currentPeriod = new Date().getFullYear().toString();
    const churchSnap = await getDocs(collection(db, 'churches'));
    const churches = churchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    const paymentSnap = await getDocs(query(collection(db, 'payments'), where('periode', '==', currentPeriod)));
    const payments = paymentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    const currentMonthIdx = new Date().getMonth();
    const listDebtors: any[] = [];
    
    for (const church of churches) {
      const arrears: Record<string, string[]> = {};
      let totalSum = 0;
      let hasArrears = false;

      Object.entries(SPREADSHEET_COLUMNS).forEach(([cat, cols]) => {
        const p = payments.find(pay => pay.gerejaId === church.id && pay.kategori === cat);
        let unpaid = cols.filter(col => !p || !p.details[col] || p.details[col] === 0);
        
        if (cat === 'laporan') {
          unpaid = unpaid.filter(col => {
            const mIdx = SPREADSHEET_COLUMNS.laporan.indexOf(col);
            return mIdx !== -1 && mIdx <= currentMonthIdx;
          });
        }
        
        if (unpaid.length > 0) {
          arrears[cat] = unpaid;
          hasArrears = true;
          // estimate Rp 100.000, 75.000, 50.000
          const rate = cat === 'laporan' ? 100000 : (cat === 'pelean' ? 75000 : 50000);
          totalSum += unpaid.length * rate;
        }
      });
      
      if (hasArrears) {
        listDebtors.push({
          id: church.id,
          nama: church.nama,
          resort: church.resort,
          wa: church.wa || '',
          waPendeta: church.waPendeta || '',
          estimatedArrears: totalSum,
          details: arrears,
          lastCheck: new Date().toISOString()
        });
      }
    }
    
    res.json(listDebtors);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Enable saving custom debtors
app.post('/api/debtors', async (req, res) => {
  try {
    const data = req.body;
    await setDoc(doc(db, 'custom_debtors', data.id || new Date().getTime().toString()), data);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Finance external system updates webhook
app.post('/api/webhook/finance', async (req, res) => {
  try {
    const payload = req.body;
    console.log('[WEBHOOK] Webhook finance received: ', payload);
    
    // Save to message log for simulation
    const alertMsg = {
      phone: payload.wa || '+62-GKLI-SYSTEM',
      message: `🔔 Webhook System Update: Tagihan baru divalidasi sebesar Rp${payload.amount || payload.nominal || '0'} untuk ${payload.nama || 'Instansi'}. Status: Menunggu Setoran.`,
      type: 'incoming_webhook',
      status: 'processed',
      timestamp: new Date().toISOString()
    };
    
    await addDoc(collection(db, 'whatsapp_messages'), alertMsg);
    res.json({ success: true, received: true, log: alertMsg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
    const distPath = path.join(process.cwd(), 'dist');
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
