import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  FileText, 
  Download, 
  Settings, 
  LogOut, 
  LogIn, 
  Plus, 
  Trash2, 
  Edit, 
  MessageCircle, 
  Printer, 
  Save, 
  X,
  Database,
  CheckCircle2,
  AlertTriangle,
  Award,
  ChevronRight,
  UserPlus,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Truck,
  Package,
  Share2,
  Archive,
  Search,
  GripVertical,
  Menu,
  Building,
  MapPin,
  Home,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { toJpeg } from 'html-to-image';
import { Church, Payment, User, AppSettings, TabType, Distribution } from './types';
import { INITIAL_CHURCHES, DEFAULT_SETTINGS, SPREADSHEET_COLUMNS, CATEGORY_LABELS } from './constants';
import { auth, db } from './firebase';
import { normalizeResortName, normalizeChurchName, getChurchIdentityKey, normalizePeriode } from './utils';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';

const TableCellInput = ({ 
  initialVal, 
  itemType, 
  onSave, 
  formatFn,
  align = 'right',
  customClasses = ''
}: {
  initialVal: number;
  itemType: string;
  onSave: (val: string) => void;
  formatFn: (val: number) => string;
  align?: 'right' | 'center' | 'left';
  customClasses?: string;
}) => {
  const [localVal, setLocalVal] = useState(initialVal === 0 ? '' : formatFn(initialVal));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalVal(initialVal === 0 ? '' : formatFn(initialVal));
    }
  }, [initialVal, isFocused, formatFn]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw === '') {
      setLocalVal('');
    } else {
      setLocalVal(formatFn(parseInt(raw)));
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    onSave(localVal);
  };

  const isZero = !localVal || localVal === '0';

  let defaultColorClasses = isZero 
    ? (itemType === 'resort' ? 'text-slate-400 font-bold' : 'text-red-400 font-medium') 
    : (itemType === 'resort' ? 'text-indigo-700 font-bold' : 'text-slate-700 font-bold');

  return (
    <input 
      type="text" 
      value={localVal}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
      className={`w-full py-3 outline-none bg-transparent font-mono data-value text-${align} ${customClasses || defaultColorClasses}`}
      placeholder="0"
    />
  );
};

function translateToRoman(num: number): string {
  if (num <= 0) return num.toString();
  const lookup: { [key: string]: number } = {
    M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1
  };
  let roman = '';
  for (let i in lookup) {
    while (num >= lookup[i]) {
      roman += i;
      num -= lookup[i];
    }
  }
  return roman;
}

function romanToNum(roman: string): number {
  const lookup: { [key: string]: number } = {
    I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000
  };
  let num = 0;
  for (let i = 0; i < roman.length; i++) {
    const current = lookup[roman[i].toUpperCase()];
    const next = lookup[roman[i+1]?.toUpperCase()];
    if (next && current < next) {
      num -= current;
    } else {
      num += current;
    }
  }
  return num || 0;
}

function getWilayahLevel(w: any): number {
  if (!w) return 9999;
  let s = String(w).trim().toUpperCase();
  if (!s) return 9999;
  
  // Strip common prefixes
  s = s.replace(/^WILAYAH\s+/i, '').replace(/^WIL\s*/i, '').replace(/^W\s*/i, '').trim();

  if (/^\d+$/.test(s)) return parseInt(s);
  if (/^[IVXLCDM]+$/.test(s)) return romanToNum(s);
  
  const digitMatch = s.match(/\d+/);
  if (digitMatch) return parseInt(digitMatch[0]);

  const romanMatch = s.match(/[IVXLCDM]+/);
  if (romanMatch) return romanToNum(romanMatch[0]);

  return 9999;
}

const RESORT_PRIORITY: Record<string, number> = {
  'Simpang Limun Medan': 1,
  'Persiapan Pasar IV Marindal II': 2,
  'Batu Bara': 3
};

function compareResorts(a: string, b: string): number {
  const normA = normalizeResortName(a);
  const normB = normalizeResortName(b);
  const pA = RESORT_PRIORITY[normA] || 999;
  const pB = RESORT_PRIORITY[normB] || 999;
  if (pA !== pB) return pA - pB;
  return normA.localeCompare(normB);
}

export default function App() {
  const printRef = useRef<HTMLDivElement>(null);
  // STATE NAVIGASI
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  
  // STATE USER & LOGIN
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [isGatePassed, setIsGatePassed] = useState(() => {
    return sessionStorage.getItem('gkli_gate_passed') === 'true';
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [gateForm, setGateForm] = useState({ username: '', password: '' });
  const [showUserModal, setShowUserModal] = useState(false);
  const [formUser, setFormUser] = useState<User>({ username: '', password: '', role: 'staff' });
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // STATE PENGATURAN TAMPILAN
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [googleDriveToken, setGoogleDriveToken] = useState<string | null>(null);

  const initGoogleAuth = (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (googleDriveToken) return resolve(googleDriveToken);
      
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "761838534142-pq8hfkgkjf4gob9bv8uac67f12cvrd7n.apps.googleusercontent.com";
      if (!clientId) {
        alert("⚠️ VITE_GOOGLE_CLIENT_ID belum diatur.");
        return resolve(null);
      }
      
      // @ts-ignore
      if (typeof google === 'undefined') {
        alert("Gagal memuat layanan Google. Pastikan internet Anda lancar.");
        return resolve(null);
      }

      // @ts-ignore
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets',
        callback: (resp: any) => {
          if (resp.access_token) {
            setGoogleDriveToken(resp.access_token);
            resolve(resp.access_token);
          } else {
            resolve(null);
          }
        }
      });
      client.requestAccessToken();
    });
  };

  const handleDirectSync = async () => {
    const token = await initGoogleAuth();
    if (!token) return;

    let sheetId = appSettings.googleSpreadsheetId;
    const toastLabel = document.createElement('div');
    toastLabel.innerText = "Memproses Sinkronisasi ke Drive...";
    toastLabel.className = "fixed bottom-5 right-5 bg-blue-600 text-white px-4 py-2 rounded shadow-lg z-50 font-bold";
    document.body.appendChild(toastLabel);

    try {
       if (!sheetId) {
          const res = await fetch('https://www.googleapis.com/drive/v3/files', {
             method: 'POST',
             headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
             body: JSON.stringify({ name: 'Database Keuangan GKLI', mimeType: 'application/vnd.google-apps.spreadsheet' })
          });
          const file = await res.json();
          if (!res.ok) {
             throw new Error(file.error?.message || "Gagal membuat file Spreadsheet di Google Drive Anda.");
          }
          sheetId = file.id;
          const newSettings = { ...appSettings, googleSpreadsheetId: file.id };
          await setDoc(doc(db, 'settings', 'config'), newSettings);
          setAppSettings(newSettings);
       }

       const req = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
       });
       if (req.status === 404) {
           throw new Error("File Spreadsheet lama terhapus. Harap kosongkan ID Spreadsheet di Pengaturan agar dibuat baru.");
       }
       const sheetData = await req.json();
       const existingTitles = sheetData.sheets?.map((s:any) => s.properties.title) || [];
       
       const batchRequests: any[] = [];
       const sheetsToHide: number[] = [];
       sheetData.sheets?.forEach((s: any) => {
         if ((s.properties.title === "Jemaat" || s.properties.title === "Pembayaran") && !s.properties.hidden) {
           sheetsToHide.push(s.properties.sheetId);
         }
       });

       const dashTitle = "📊 DASHBOARD";
       const pLaporanTitle = "Lap. Persembahan II";
       const pKhususTitle = "Lap. Persembahan Khusus";
       const literaturTitle = "Lap. Literatur";

       const existingDash = sheetData.sheets?.find((s:any) => s.properties.title === dashTitle);
       if (existingDash) {
          batchRequests.push({ deleteSheet: { sheetId: existingDash.properties.sheetId } });
       }
       batchRequests.push({ addSheet: { properties: { title: dashTitle, index: 0, tabColor: { red: 0.1, green: 0.6, blue: 0.3 } }}});

       if (!existingTitles.includes("Jemaat")) batchRequests.push({ addSheet: { properties: { title: "Jemaat", hidden: true }}});
       if (!existingTitles.includes("Pembayaran")) batchRequests.push({ addSheet: { properties: { title: "Pembayaran", hidden: true }}});
       if (!existingTitles.includes(pLaporanTitle)) batchRequests.push({ addSheet: { properties: { title: pLaporanTitle }}});
       if (!existingTitles.includes(pKhususTitle)) batchRequests.push({ addSheet: { properties: { title: pKhususTitle }}});
       if (!existingTitles.includes(literaturTitle)) batchRequests.push({ addSheet: { properties: { title: literaturTitle }}});

       sheetsToHide.forEach(id => {
         batchRequests.push({
           updateSheetProperties: {
             properties: { sheetId: id, hidden: true },
             fields: "hidden"
           }
         });
       });

       if (batchRequests.length > 0) {
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
             method: 'POST',
             headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
             body: JSON.stringify({ requests: batchRequests })
          });
       }

       const jemaatHeaders = ["id", "order", "nama", "resort", "wilayah", "wa", "type"];
       const jemaatValues = [jemaatHeaders.map(h => h.toUpperCase())];
       churches.forEach(c => {
          jemaatValues.push(jemaatHeaders.map(h => c[h as keyof typeof c] || ""));
       });

       const paymentHeaders = ["id", "gerejaId", "kategori", "periode", "jumlah", "tanggal", "receiptSent", "receiptSentAt", "details"];
       const paymentValues = [paymentHeaders.map(h => h.toUpperCase())];
       payments.forEach(p => {
          paymentValues.push(paymentHeaders.map(h => {
             const val = p[h as keyof typeof p];
             return (h === 'details') ? JSON.stringify(val) : (val ?? "");
          }));
       });

       // GENERATE FORMATTED PROFESSIONAL SHEETS
       const sortedBaseChurches = [...churches].sort((a,b) => {
          const wA = getWilayahLevel(a.wilayah);
          const wB = getWilayahLevel(b.wilayah);
          if (wA !== wB) return wA - wB;
          const resA = a.resort || '';
          const resB = b.resort || '';
          const rComp = compareResorts(resA, resB);
          if (rComp !== 0) return rComp;
          if (a.type !== b.type) return a.type === 'resort' ? -1 : 1;
          return a.nama.localeCompare(b.nama);
       });

       const periodesToSync = periods || [periodeAktif];

       const buildReportRows = (
         category: 'laporan' | 'pelean' | 'alaman',
         churchesList: Church[]
       ) => {
         const cols = SPREADSHEET_COLUMNS[category];
         const headers = ["Nama Jemaat", "Resort", "Wilayah", "Tahun (Periode)", ...cols, "TOTAL (Rp)", "Terakhir Bayar"];
         if (category === 'laporan') headers.splice(4, 0, "STATUS");

         const rows: any[][] = [headers];

         periodesToSync.forEach(prd => {
           churchesList.forEach(c => {
             const targetIdentityKey = getChurchIdentityKey(c);
             const pList = payments.filter(p => {
               if ((p.kategori || '').toLowerCase() !== category) return false;
               if (normalizePeriode(p.periode) !== normalizePeriode(prd)) return false;
               const pChurch = allChurches.find(ach => ach.id === p.gerejaId);
               if (pChurch) return getChurchIdentityKey(pChurch) === targetIdentityKey;
               const aliases = churchAliasesMap[c.id] || [c.id];
               return aliases.includes(p.gerejaId);
             });

             let cDetails: Record<string, number> = {};
             pList.forEach(p => {
               if (p.details) Object.entries(p.details).forEach(([k,v]) => cDetails[k] = (cDetails[k]||0)+((v as number)||0));
             });

             const total = Object.values(cDetails).reduce((sum, v) => sum + (v||0), 0);

             let status = 'Menunggak';
             const curCols = cols.filter(col => (cDetails[col]||0)>0).length;
             if(curCols === cols.length) status = 'Lunas';
             else if(curCols > 0) status = 'Proses';

             let lastDate = "";
             if (pList.length > 0) {
                lastDate = pList.reduce((latest, curr) => {
                  if (!latest) return curr.tanggal;
                  if (!curr.tanggal) return latest;
                  return new Date(curr.tanggal) > new Date(latest) ? curr.tanggal : latest;
                }, "") as string || "";
             }

             const rowVals = [
               c.nama,
               c.resort || "",
               c.wilayah || "",
               prd
             ];
             if (category === 'laporan') rowVals.push(status);
             cols.forEach(col => rowVals.push(cDetails[col] || ""));
             rowVals.push(total || 0);
             rowVals.push(lastDate);

             rows.push(rowVals);
           });
         });
         return rows;
       };

       const lapLaporan = buildReportRows('laporan', sortedBaseChurches.filter(c => c.type !== 'resort'));
       const lapPelean = buildReportRows('pelean', sortedBaseChurches);
       const lapAlaman = buildReportRows('alaman', sortedBaseChurches);

       const updateData = [
          { range: "Jemaat!A1", values: jemaatValues },
          { range: "Pembayaran!A1", values: paymentValues },
          { range: `'${pLaporanTitle}'!A1`, values: lapLaporan },
          { range: `'${pKhususTitle}'!A1`, values: lapPelean },
          { range: `'${literaturTitle}'!A1`, values: lapAlaman }
       ];
       
       await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchClear`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ranges: ["Jemaat", "Pembayaran", `'${pLaporanTitle}'`, `'${pKhususTitle}'`, `'${literaturTitle}'`] })
       });

       const resUpdate = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: updateData })
       });
       
       if (!resUpdate.ok) {
           const errResp = await resUpdate.json();
           throw new Error(errResp.error?.message || "Unknown error saat mengupdate data ke sheet");
       }

       // 3. APPLY PROFESSIONAL FORMATTING (Frozen row, Bold dark header)
       try {
         const finalReq = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`, { headers: { 'Authorization': `Bearer ${token}` } });
         const finalSheetData = await finalReq.json();
         
         const formatRequests: any[] = [];
         finalSheetData.sheets?.forEach((s: any) => {
           const title = s.properties.title;
           const sid = s.properties.sheetId;
           
           if (title === pLaporanTitle || title === pKhususTitle || title === literaturTitle) {
             
             // Hapus banding (warna selang-seling) lama jika ada
             if (s.bandedRanges) {
               s.bandedRanges.forEach((br: any) => {
                 formatRequests.push({ deleteBanding: { bandedRangeId: br.bandedRangeId } });
               });
             }

             let colsCount = 19;
             if (title === pLaporanTitle) colsCount = 19;
             if (title === pKhususTitle) colsCount = 12;
             if (title === literaturTitle) colsCount = 16;

             // 1. Baris Pertama dibekukan (Frozen row)
             formatRequests.push({
               updateSheetProperties: {
                 properties: { sheetId: sid, gridProperties: { frozenRowCount: 1 } },
                 fields: "gridProperties.frozenRowCount"
               }
             });
             
             // 2. Format Header (Tebal, Latar Biru Gelap, Teks Putih, Tengah)
             formatRequests.push({
               repeatCell: {
                 range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colsCount },
                 cell: {
                   userEnteredFormat: {
                     backgroundColor: { red: 0.1, green: 0.16, blue: 0.23 }, // dark blue-slate
                     textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                     horizontalAlignment: "CENTER",
                     verticalAlignment: "MIDDLE"
                   }
                 },
                 fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
               }
             });

             // 3. Banding (warna selang-seling untuk baris data)
             formatRequests.push({
               addBanding: {
                 bandedRange: {
                   range: { sheetId: sid, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: colsCount },
                   rowProperties: {
                     firstBandColor: { red: 1, green: 1, blue: 1 },
                     secondBandColor: { red: 0.95, green: 0.96, blue: 0.98 }
                   }
                 }
               }
             });

             // 4. Border (Garis tabel) tipis
             formatRequests.push({
               updateBorders: {
                 range: { sheetId: sid, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: colsCount },
                 top: { style: "SOLID", width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
                 bottom: { style: "SOLID", width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
                 left: { style: "SOLID", width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
                 right: { style: "SOLID", width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
                 innerHorizontal: { style: "SOLID", width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
                 innerVertical: { style: "SOLID", width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } }
               }
             });

             // 5. Format Mata Uang (Currency)
             let curStart = 0; let curEnd = 0;
             if (title === pLaporanTitle) { curStart = 5; curEnd = 18; }
             if (title === pKhususTitle) { curStart = 4; curEnd = 11; }
             if (title === literaturTitle) { curStart = 14; curEnd = 15; }
             
             if (curStart < curEnd) {
               formatRequests.push({
                 repeatCell: {
                   range: { sheetId: sid, startRowIndex: 1, startColumnIndex: curStart, endColumnIndex: curEnd },
                   cell: {
                     userEnteredFormat: {
                       numberFormat: { type: "CURRENCY", pattern: "Rp#,##0" }
                     }
                   },
                   fields: "userEnteredFormat.numberFormat"
                 }
               });
             }

             // 7. Add Basic Filter (Dropdowns on Headers)
             formatRequests.push({
               setBasicFilter: {
                 filter: {
                   range: { sheetId: sid, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: colsCount }
                 }
               }
             });
             
           }
         });

         const dashSheet = finalSheetData.sheets?.find((s:any) => s.properties.title === dashTitle);
         
         if (dashSheet) {
           const dashId = dashSheet.properties.sheetId;

           const makeCell = (value: any, isFormula = false, format: any = {}) => ({
             userEnteredValue: isFormula ? { formulaValue: value } : (typeof value === 'number' ? { numberValue: value } : { stringValue: value }),
             userEnteredFormat: format
           });

           const dashRows: any[] = [];
           // R0-R2: Header
           dashRows.push({ values: [ makeCell("📊 EXECUTIVE DASHBOARD KEUANGAN GKLI", false, { backgroundColor: {red:0.05, green:0.1, blue:0.2}, textFormat: { bold: true, fontSize: 18, foregroundColor: {red:1, green:1, blue:1} }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" }) ] });
           dashRows.push({ values: [] });
           dashRows.push({ values: [] });
           
           // R3: Empty
           dashRows.push({ values: [] });

           // R4: Filter
           dashRows.push({
             values: [
               makeCell(""),
               makeCell("PILIH TAHUN :", false, { textFormat: { bold: true, fontSize: 12 }, horizontalAlignment: "RIGHT" }),
               {
                 userEnteredValue: { stringValue: periodeAktif },
                 userEnteredFormat: { backgroundColor: {red:0.9, green:0.95, blue:1}, textFormat: { bold: true, fontSize: 13 }, borders: { bottom: { style: "SOLID", width:2, color: {red:0.2, green:0.4, blue:0.8} } }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" },
                 dataValidation: { condition: { type: "ONE_OF_LIST", values: periodesToSync.map(p => ({ userEnteredValue: p })) }, showCustomUi: true, strict: true }
               },
               makeCell("  ⬅️ Ubah pilihan dropdown ini untuk memperbarui semua data dan grafik laporan di bawah ini.", false, { textFormat: { italic: true, foregroundColor: {red:0.4, green:0.4, blue:0.4} }, verticalAlignment: "MIDDLE" })
             ]
           });

           // R5: Informational Text for 2-way sync
           dashRows.push({
             values: [
               makeCell(""),
               makeCell("PENTING: Sheet laporan ini (Dashboard dan Rekap) DIBUAT OTOMATIS dari aplikasi web. JANGAN merubah nominal di sheet secara langsung karena akan tertimpa saat Anda menekan tombol Sync di aplikasi.", false, { textFormat: { bold: true, italic: true, fontSize: 9, foregroundColor: {red:0.8, green:0.1, blue:0.1} }, verticalAlignment: "MIDDLE" })
             ]
           });

           const statFormat = (bg: any) => ({ backgroundColor: bg, textFormat: { bold: true, fontSize: 10, foregroundColor: {red:1, green:1, blue:1} }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" });
           const valFormat = { numberFormat: { type: "CURRENCY", pattern: "Rp#,##0" }, textFormat: { bold: true, fontSize: 16 }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", borders: { bottom: { style: "SOLID", width: 1, color: {red:0.8, green:0.8, blue:0.8} }, left: {style: "SOLID", width: 1, color: {red:0.8, green:0.8, blue:0.8}}, right: {style: "SOLID", width: 1, color: {red:0.8, green:0.8, blue:0.8}} } };

           // R6: Stat Headers
           dashRows.push({
             values: [
               makeCell(""),
               makeCell("TOTAL PERSEMBAHAN II", false, statFormat({red:0.1, green:0.4, blue:0.7})), makeCell(""),
               makeCell("TOTAL PERS. KHUSUS", false, statFormat({red:0.8, green:0.4, blue:0.1})), makeCell(""),
               makeCell("TOTAL LITERATUR", false, statFormat({red:0.1, green:0.5, blue:0.3})), makeCell(""),
               makeCell("TOTAL KESELURUHAN", false, statFormat({red:0.2, green:0.2, blue:0.2})), makeCell("")
             ]
           });

           // R7: Stat Formulas
           dashRows.push({
             values: [
               makeCell(""),
               makeCell(`=SUMIFS('${pLaporanTitle}'!R:R, '${pLaporanTitle}'!D:D, C5)`, true, valFormat), makeCell(""),
               makeCell(`=SUMIFS('${pKhususTitle}'!K:K, '${pKhususTitle}'!D:D, C5)`, true, valFormat), makeCell(""),
               makeCell(`=SUMIFS('${literaturTitle}'!O:O, '${literaturTitle}'!D:D, C5)`, true, valFormat), makeCell(""),
               makeCell(`=B8+D8+F8`, true, Object.assign({}, valFormat, { backgroundColor: {red:0.95, green:0.95, blue:0.95} })), makeCell("")
             ]
           });

           // R8: Empty
           dashRows.push({ values: [] });

           // R9: Tables & Chart placeholders Headers
           dashRows.push({
             values: [
               makeCell(""),
               makeCell("Bulan", false, statFormat({red:0.3, green:0.3, blue:0.3})),
               makeCell("Persembahan II", false, statFormat({red:0.3, green:0.3, blue:0.3})),
               makeCell(""), makeCell(""), makeCell(""), makeCell(""),
               makeCell("Kategori", false, statFormat({red:0.3, green:0.3, blue:0.3})),
               makeCell("Total", false, statFormat({red:0.3, green:0.3, blue:0.3}))
             ]
           });

           const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
           const colLetters = ['F','G','H','I','J','K','L','M','N','O','P','Q']; // Jan is Col F (index 5) in Lap. Persembahan II
           const catNames = ['Persembahan II', 'Pers. Khusus', 'Literatur'];
           const catFormulas = ['=B8', '=D8', '=F8'];

           for (let i = 0; i < 12; i++) {
               const rowValues = [
                   makeCell(""),
                   makeCell(bulan[i], false, { borders: { bottom: {style:'SOLID', width:1, color: {red:0.8, green:0.8, blue:0.8}} }, verticalAlignment: "MIDDLE" }),
                   makeCell(`=SUMIFS('${pLaporanTitle}'!${colLetters[i]}:${colLetters[i]}, '${pLaporanTitle}'!D:D, $C$5)`, true, { numberFormat: { type: "CURRENCY", pattern: "Rp#,##0" }, borders: { bottom: {style:'SOLID', width:1, color: {red:0.8, green:0.8, blue:0.8}} }, verticalAlignment: "MIDDLE" })
               ];
               
               // Fill cols D, E, F, G with empty
               rowValues.push(makeCell("")); rowValues.push(makeCell("")); rowValues.push(makeCell("")); rowValues.push(makeCell(""));

               if (i < 3) {
                   rowValues.push(makeCell(catNames[i], false, { borders: { bottom: {style:'SOLID', width:1, color: {red:0.8, green:0.8, blue:0.8}} }, verticalAlignment: "MIDDLE" }));
                   rowValues.push(makeCell(catFormulas[i], true, { numberFormat: { type: "CURRENCY", pattern: "Rp#,##0" }, borders: { bottom: {style:'SOLID', width:1, color: {red:0.8, green:0.8, blue:0.8}} }, verticalAlignment: "MIDDLE" }));
               }

               dashRows.push({ values: rowValues });
           }

           formatRequests.push({
             updateCells: {
               range: { sheetId: dashId, startRowIndex: 0, startColumnIndex: 0 },
               rows: dashRows,
               fields: "userEnteredValue,userEnteredFormat,dataValidation"
             }
           });

           // Merges
           const merges = [
             { sheetId: dashId, startRowIndex: 0, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 9 }, // Header
             { sheetId: dashId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 3, endColumnIndex: 9 }, // Note Filter Info
             { sheetId: dashId, startRowIndex: 5, endRowIndex: 6, startColumnIndex: 1, endColumnIndex: 9 }, // Note Warning
             { sheetId: dashId, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 1, endColumnIndex: 3 }, // P2 Head
             { sheetId: dashId, startRowIndex: 7, endRowIndex: 8, startColumnIndex: 1, endColumnIndex: 3 }, // P2 Val
             { sheetId: dashId, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 3, endColumnIndex: 5 }, // PK Head
             { sheetId: dashId, startRowIndex: 7, endRowIndex: 8, startColumnIndex: 3, endColumnIndex: 5 }, // PK Val
             { sheetId: dashId, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 5, endColumnIndex: 7 }, // Lit Head
             { sheetId: dashId, startRowIndex: 7, endRowIndex: 8, startColumnIndex: 5, endColumnIndex: 7 }, // Lit Val
             { sheetId: dashId, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 7, endColumnIndex: 9 }, // Tot Head
             { sheetId: dashId, startRowIndex: 7, endRowIndex: 8, startColumnIndex: 7, endColumnIndex: 9 }, // Tot Val
           ];
           merges.forEach(m => formatRequests.push({ mergeCells: { range: m, mergeType: "MERGE_ALL" } }));

           // Column Widths
           formatRequests.push({ updateDimensionProperties: { range: { sheetId: dashId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 20 }, fields: "pixelSize" } });
           formatRequests.push({ updateDimensionProperties: { range: { sheetId: dashId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 }, properties: { pixelSize: 130 }, fields: "pixelSize" } });
           formatRequests.push({ updateDimensionProperties: { range: { sheetId: dashId, dimension: "COLUMNS", startIndex: 2, endIndex: 3 }, properties: { pixelSize: 150 }, fields: "pixelSize" } });
           formatRequests.push({ updateDimensionProperties: { range: { sheetId: dashId, dimension: "COLUMNS", startIndex: 3, endIndex: 4 }, properties: { pixelSize: 130 }, fields: "pixelSize" } });
           formatRequests.push({ updateDimensionProperties: { range: { sheetId: dashId, dimension: "COLUMNS", startIndex: 4, endIndex: 5 }, properties: { pixelSize: 150 }, fields: "pixelSize" } });
           formatRequests.push({ updateDimensionProperties: { range: { sheetId: dashId, dimension: "COLUMNS", startIndex: 5, endIndex: 6 }, properties: { pixelSize: 130 }, fields: "pixelSize" } });
           formatRequests.push({ updateDimensionProperties: { range: { sheetId: dashId, dimension: "COLUMNS", startIndex: 6, endIndex: 7 }, properties: { pixelSize: 150 }, fields: "pixelSize" } });
           formatRequests.push({ updateDimensionProperties: { range: { sheetId: dashId, dimension: "COLUMNS", startIndex: 7, endIndex: 8 }, properties: { pixelSize: 130 }, fields: "pixelSize" } });
           formatRequests.push({ updateDimensionProperties: { range: { sheetId: dashId, dimension: "COLUMNS", startIndex: 8, endIndex: 9 }, properties: { pixelSize: 150 }, fields: "pixelSize" } });

           // Hide Gridlines
           formatRequests.push({ updateSheetProperties: { properties: { sheetId: dashId, gridProperties: { hideGridlines: true } }, fields: "gridProperties.hideGridlines" } });

           // CHARTS
           // Chart 1: Monthly Line/Area Chart for Persembahan II
           // Position: D11 (index Row 10, Col 3)
           formatRequests.push({
             addChart: {
               chart: {
                 spec: {
                   title: "Tren Pendapatan Persembahan II per Bulan (Rp)",
                   basicChart: {
                     chartType: "AREA",
                     legendPosition: "NO_LEGEND",
                     axis: [ { position: "BOTTOM_AXIS" }, { position: "LEFT_AXIS" } ],
                     domains: [{ domain: { sourceRange: { sources: [{ sheetId: dashId, startRowIndex: 10, endRowIndex: 22, startColumnIndex: 1, endColumnIndex: 2 }] } } }],
                     series: [{ series: { sourceRange: { sources: [{ sheetId: dashId, startRowIndex: 10, endRowIndex: 22, startColumnIndex: 2, endColumnIndex: 3 }] } }, color: {red:0.1, green:0.4, blue:0.7} }]
                   }
                 },
                 position: { overlayPosition: { anchorCell: { sheetId: dashId, rowIndex: 9, columnIndex: 3 }, offsetXPixels: 15, offsetYPixels: 0, widthPixels: 550, heightPixels: 300 } }
               }
             }
           });

           // Chart 2: Category Pie Chart
           // Position: H15 (index Row 14, Col 7)
           formatRequests.push({
             addChart: {
               chart: {
                 spec: {
                   title: "Distribusi Kategori Total Pendapatan",
                   pieChart: {
                     legendPosition: "RIGHT_LEGEND",
                     domain: { sourceRange: { sources: [{ sheetId: dashId, startRowIndex: 10, endRowIndex: 13, startColumnIndex: 7, endColumnIndex: 8 }] } },
                     series: { sourceRange: { sources: [{ sheetId: dashId, startRowIndex: 10, endRowIndex: 13, startColumnIndex: 8, endColumnIndex: 9 }] } },
                     pieHole: 0.5
                   }
                 },
                 position: { overlayPosition: { anchorCell: { sheetId: dashId, rowIndex: 14, columnIndex: 7 }, offsetXPixels: 0, offsetYPixels: 10, widthPixels: 450, heightPixels: 240 } }
               }
             }
           });

         }

         if (formatRequests.length > 0) {
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
               method: 'POST',
               headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
               body: JSON.stringify({ requests: formatRequests })
            });
         }
       } catch (ignore) {
         // If formatting fails, ignore it to not ruin the success flow.
         console.error("Gagal melakukan formatting:", ignore);
       }

       toastLabel.remove();
       alert("✅ Sinkronisasi Berhasil!\nSheet Laporan profesional telah dibuat di Google Drive Anda.\n\nTips: Buka Google Sheet tersebut, lalu gunakan fitur 'Filter' pada kolom 'Tahun (Periode)' untuk memilih laporan per tahun dengan mudah!");

    } catch (e: any) {
        toastLabel.remove();
        alert("Gagal sinkronisasi: " + e.message);
    }
  };

  const handleDirectPull = async () => {
    const sheetId = appSettings.googleSpreadsheetId;
    if (!sheetId) {
       alert("Anda belum pernah melakukan Sinkronisasi. Lakukan Sinkronisasi minimal 1x agar ada data yang ditarik.");
       return;
    }

    const conf = window.confirm("PENTING!\nMenarik data dari Sheet akan MENIMPA SEMUA data saat ini dengan data dari Google Sheet.\nLanjutkan?");
    if (!conf) return;

    const token = await initGoogleAuth();
    if (!token) return;

    const toastLabel = document.createElement('div');
    toastLabel.innerText = "Mengunduh Data dari Drive...";
    toastLabel.className = "fixed bottom-5 right-5 bg-orange-600 text-white px-4 py-2 rounded shadow-lg z-50 font-bold";
    document.body.appendChild(toastLabel);

    try {
       const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?ranges=Jemaat&ranges=Pembayaran`, {
           headers: { 'Authorization': `Bearer ${token}` }
       });
       if (res.status === 404) throw new Error("File Spreadsheet tidak ditemukan di Google Drive Anda.");
       const data = await res.json();
       
       const jRows = data.valueRanges?.[0]?.values || [];
       const pRows = data.valueRanges?.[1]?.values || [];

       if (jRows.length <= 1 && pRows.length <= 1) {
           toastLabel.remove();
           alert("Data di Sheet masih kosong!");
           return;
       }

       const batch = writeBatch(db);

       churches.forEach(c => {
           batch.delete(doc(db, 'churches', c.id));
       });
       payments.forEach(p => {
           batch.delete(doc(db, 'payments', p.id));
       });

       if (jRows.length > 1) {
          const headers = jRows[0].map((h:string) => h.toLowerCase());
          for (let i=1; i<jRows.length; i++) {
             const row = jRows[i];
             const jemaatObj: any = {};
             headers.forEach((h:string, idx:number) => jemaatObj[h] = row[idx]);
             if (jemaatObj.id) {
                batch.set(doc(db, 'churches', jemaatObj.id.toString()), jemaatObj);
             }
          }
       }

       if (pRows.length > 1) {
          const headers = pRows[0].map((h:string) => h.toLowerCase());
          for (let i=1; i<pRows.length; i++) {
             const row = pRows[i];
             const payObj: any = {};
             headers.forEach((h:string, idx:number) => {
                let val = row[idx];
                if (h === 'details' && val && val.startsWith('{')) {
                   try { val = JSON.parse(val); } catch(ex){}
                }
                if (h === 'jumlah') val = Number(val) || 0;
                if (h === 'receiptsent') val = (val === 'TRUE' || val === 'true' || val === true);
                if (h === 'receiptsentat' && typeof val === 'undefined') val = null;
                payObj[h] = val;
             });
             if (payObj.id) {
                batch.set(doc(db, 'payments', payObj.id.toString()), payObj);
             }
          }
       }

       await batch.commit();
       toastLabel.remove();
       alert("✅ RESTORE BERHASIL! Data berhasil ditarik dari Google Sheet dan dipulihkan ke web.");
       
    } catch (e: any) {
        toastLabel.remove();
        alert("Gagal menarik data: " + e.message);
    }
  };
  const [formSettings, setFormSettings] = useState(DEFAULT_SETTINGS);

  // STATE DATA GEREJA & PEMBAYARAN
  const [allChurches, setAllChurches] = useState<Church[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);

  // STATE PERIODE TAHUN
  const [periods, setPeriods] = useState(['Tahun 2021', 'Tahun 2022', 'Tahun 2023', 'Tahun 2024', 'Tahun 2025', 'Tahun 2026']);
  const [periodeAktif, setPeriodeAktif] = useState('Tahun 2026');
  const [newPeriod, setNewPeriod] = useState('');

  // Mapping church identity keys to all their database IDs (aliases)
  const churchAliasesMap = useMemo(() => {
    const idToPrefId: Record<string, string> = {};
    const prefIdToAliases: Record<string, string[]> = {};

    // 1. Determine preferred ID for each identity key
    allChurches.forEach(c => {
      const key = getChurchIdentityKey(c);
      const hasGKLI = c.nama.toUpperCase().startsWith('GKLI');
      const existingId = idToPrefId[key];
      
      if (!existingId) {
        idToPrefId[key] = c.id;
      } else {
        const existingObj = allChurches.find(x => x.id === existingId);
        if (existingObj && hasGKLI && !existingObj.nama.toUpperCase().startsWith('GKLI')) {
          idToPrefId[key] = c.id;
        }
      }
    });

    // 2. Map every church to its preferred ID's alias list
    allChurches.forEach(c => {
      const key = getChurchIdentityKey(c);
      const prefId = idToPrefId[key];
      if (prefId) {
        if (!prefIdToAliases[prefId]) prefIdToAliases[prefId] = [];
        prefIdToAliases[prefId].push(c.id);
      }
    });

    return prefIdToAliases;
  }, [allChurches]);

  // REAL-TIME FIREBASE SYNC - Auth & Settings
  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AppSettings;
        setAppSettings(data);
        if (data.periodeList && data.periodeList.length > 0) {
          setPeriods(data.periodeList);
        }
        if (data.periodeAktif) {
          setPeriodeAktif(data.periodeAktif);
        }
      }
    });

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setIsInitialLoading(false);
        setCurrentUserProfile(null);
      }
    });

    return () => {
      unsubSettings();
      unsubAuth();
    };
  }, []);

  // REAL-TIME FIREBASE SYNC - Protected Data
  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    
    if (firebaseUser) {
      unsubProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          setCurrentUserProfile(docSnap.data() as User);
        } else {
          setCurrentUserProfile({ username: firebaseUser.email || '', role: 'staff', password: '' });
        }
        setIsInitialLoading(false);
      }, (error) => {
        console.warn("Profile sync restricted:", error.message);
        setIsInitialLoading(false);
      });
    }

    // 2. Listen to Churches (Public read allowed in rules)
    const unsubChurches = onSnapshot(query(collection(db, 'churches'), orderBy('order', 'asc')), async (snap) => {
      const allData = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Church));
      setAllChurches(allData);
      
      // Deduplicate: prefer "GKLI " prefixed names if double exists
      const filteredMap = new Map<string, Church>();
      const toDeleteIds = new Set<string>();
      allData.forEach(c => {
        const key = getChurchIdentityKey(c);
        const hasGKLI = c.nama.toUpperCase().startsWith('GKLI');
        const existing = filteredMap.get(key);
        if (!existing || (hasGKLI && !existing.nama.toUpperCase().startsWith('GKLI'))) {
          if (existing) toDeleteIds.add(existing.id);
          filteredMap.set(key, c);
        } else {
          toDeleteIds.add(c.id);
        }
      });

      const data = Array.from(filteredMap.values());
      
      // Also ensure resort headers are generated correctly
      const uniqueResortsMap = new Map<string, string>(); // normKey -> originalName
      data.forEach(c => {
        const normR = normalizeResortName(c.resort);
        if (normR && normR !== '-') uniqueResortsMap.set(normR, c.resort);
      });

      if (data.length > 0) setChurches(data);
      else if (isInitialLoading) setChurches(INITIAL_CHURCHES); 
      
      // Auto-clean duplicates
      if (toDeleteIds.size > 0 && currentUserProfile?.role === 'superadmin') {
         Array.from(toDeleteIds).forEach(id => {
            deleteDoc(doc(db, 'churches', id)).catch(() => {});
         });
      }
    }, (error) => console.warn("Churches access restricted:", error.message));

    let unsubPayments: (() => void) | undefined;
    let unsubDistributions: (() => void) | undefined;

    if (firebaseUser) {
      // 3. Listen to Payments
      unsubPayments = onSnapshot(collection(db, 'payments'), async (snap) => {
        const pList = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payment));
        setPayments(pList);
        
        // SELF-CLEANUP: Find and delete orphaned payments (payments pointing to a non-existent church ID)
        // Ensure churches are fully loaded first
        if (churches.length > 0 && currentUserProfile?.role === 'superadmin') {
          const validChurchIds = new Set(allChurches.map(c => c.id));
          const orphans = pList.filter(p => !validChurchIds.has(p.gerejaId));
          
          if (orphans.length > 0) {
            console.log(`Self-cleaning ${orphans.length} orphaned payments...`);
            for (const o of orphans) {
              try { await deleteDoc(doc(db, 'payments', o.id)); } catch(e) {}
            }
          }
        }
      }, (error) => console.warn("Payments access restricted:", error.message));

      // 4. Listen to Distributions
      unsubDistributions = onSnapshot(collection(db, 'distributions'), (snap) => {
        setDistributions(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Distribution)));
      }, (error) => console.warn("Distributions access restricted:", error.message));
    }

    return () => {
      if (unsubProfile) unsubProfile();
      unsubChurches();
      if (unsubPayments) unsubPayments();
      if (unsubDistributions) unsubDistributions();
    };
  }, [firebaseUser, isInitialLoading]);

  // REAL-TIME FIREBASE SYNC - Admin Only
  useEffect(() => {
    let unsubUsersList: (() => void) | undefined;
    
    if (firebaseUser) {
      unsubUsersList = onSnapshot(collection(db, 'users'), (snap) => {
        setUsers(snap.docs.map(doc => ({ ...doc.data() } as User)));
      }, (error) => {
        console.warn("User list restricted:", error.message);
      });
    }

    return () => unsubUsersList?.();
  }, [firebaseUser]);

  // STATE CETAK & DOWNLOAD
  const [printData, setPrintData] = useState<any>(null);
  const [printType, setPrintType] = useState<string | null>(null); 
  const [downloadKategori, setDownloadKategori] = useState<'laporan' | 'pelean' | 'alaman'>('laporan');

  // STATE MODAL LAINNYA
  const [showChurchModal, setShowChurchModal] = useState(false);
  const [formChurch, setFormChurch] = useState<Church>({ id: '', nama: '', resort: '', wilayah: '', wa: '', order: 1, type: 'jemaat' });
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [sortType, setSortType] = useState<'id' | 'nama' | 'resort' | 'wilayah' | 'order' | 'pos_pi'>('order');
  const [filterResort, setFilterResort] = useState('Semua Resort');
  const [filterWilayah, setFilterWilayah] = useState('Semua Wilayah');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCells, setSelectedCells] = useState<Record<string, string[]>>({}); // { gerejaId: [colName1, colName2] }
  const [billingSelections, setBillingSelections] = useState<Record<string, Record<string, string[]>>>({}); // { churchId: { category: [colNames] } }
  const [sessionUpdatedCells, setSessionUpdatedCells] = useState<Record<string, Record<string, string[]>>>({}); // { gerejaId: { kategori: [colName1, colName2] } }

  const canDragOrder = sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm;

  // STATE TEMPLATES
  const [templates, setTemplates] = useState(() => {
    const defaultTemplates = {
      kopSurat: '', // Base64 image
      stempelTerimaKasih: '', // Base64 image
      stempelTunggakan: '', // Base64 image
      suratTerimaKasih: `Terpujilah Allah Tuhan kita di dalam nama Yesus Kristus, sebagai kepala gereja, yang senantiasa menolong dan memberkati gereja-Nya.

Melalui surat ini kami mengucapkan terima kasih atas persembahan ke Kantor Pusat. Telah kami terima persembahan sebesar Rp [JUMLAH] dengan rincian sebagai berikut:
- Pembayaran [KATEGORI] - [PERIODE]

Demikianlah surat ini kami sampaikan. Tuhan memberkati dan menyertai kita.`,
      suratTunggakan: `Salam sejahtera dalam Nama Tuhan Yesus Kristus, Tuhan kita!

Berdasarkan catatan kas kami hingga tanggal [TANGGAL], kami mendapati bahwa kewajiban administrasi untuk [KATEGORI] pada periode [PERIODE] dari Jemaat [NAMA_JEMAAT] masih belum kami terima (menunggak).

Kami memohon kesediaan bapak/ibu Majelis Jemaat untuk dapat segera menyelesaikan kewajiban administrasi tersebut.

Demikianlah surat ini kami sampaikan. Tuhan memberkati dan menyertai kita.`
    };
    try {
      const saved = localStorage.getItem('gkli_templates');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultTemplates, ...parsed };
      }
      return defaultTemplates;
    } catch { return defaultTemplates; }
  });

  useEffect(() => { localStorage.setItem('gkli_templates', JSON.stringify(templates)); }, [templates]);

  // APPLY THEME
  useEffect(() => {
    if (appSettings.theme) {
      document.documentElement.setAttribute('data-theme', appSettings.theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [appSettings.theme]);

  const uniqueResortsOrdered = useMemo(() => {
    return Array.from(new Set(churches.map(c => normalizeResortName(c.resort)))).filter(r => r && r !== '-').sort(compareResorts);
  }, [churches]);

  const sortedChurches = useMemo(() => {
    let base = [...churches];
    
    // Normalize existing data for internal processing
    base = base.map(c => ({ ...c, resort: normalizeResortName(c.resort) }));

    // Auto-synthesize Resort entity document if missing to ensure fillable headers
    // After normalization, duplicates will merged naturally here
    const existingResorts = new Set(base.filter(c => c.type === 'resort').map(c => c.resort));
    const uniqueResortNames = Array.from(new Set(base.map(c => c.resort).filter(r => r && r !== '-')));
    
    uniqueResortNames.forEach(resName => {
      if (!existingResorts.has(resName)) {
        // Find the most common wilayah for this resort from member churches
        const members = base.filter(c => c.resort === resName && c.type !== 'resort' && c.wilayah);
        const wilayahCounts: Record<string, number> = {};
        members.forEach(m => {
          wilayahCounts[m.wilayah] = (wilayahCounts[m.wilayah] || 0) + 1;
        });
        const bestWilayah = Object.entries(wilayahCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || '';

        base.push({
          id: `virtual_resort_${resName.replace(/\s+/g, '_')}`,
          nama: `RESORT ${resName.replace(/^resort\s+/i, '').toUpperCase()}`,
          resort: resName,
          wilayah: bestWilayah,
          wa: '',
          type: 'resort',
          order: -1000,
          isSynthesized: true
        });
      }
    });

    let filtered = base;
    
    // De-duplicate any resort type entries that might have been normalized into the same name
    const finalBase: any[] = [];
    const seenResortHeaders = new Set<string>();
    filtered.forEach(item => {
      if (item.type === 'resort') {
        if (!seenResortHeaders.has(item.resort)) {
          seenResortHeaders.add(item.resort);
          finalBase.push(item);
        }
      } else {
        finalBase.push(item);
      }
    });
    filtered = finalBase;

    if (filterResort !== 'Semua Resort') {
      const normFilter = normalizeResortName(filterResort);
      filtered = filtered.filter(c => c.resort === normFilter);
    }
    if (filterWilayah !== 'Semua Wilayah') {
      filtered = filtered.filter(c => c.wilayah === filterWilayah);
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.nama.toLowerCase().includes(lower) || 
        c.resort.toLowerCase().includes(lower)
      );
    }

    return filtered.sort((a, b) => {
      // GLOBAL PRIORITY: Jemaat vs Pos PI (Pos PI goes to the absolute bottom)
      const isAPosPI = a.nama.toLowerCase().includes('pos pi');
      const isBPosPI = b.nama.toLowerCase().includes('pos pi');
      
      // If one is Pos PI and the other isn't, non-Pos PI always comes first
      if (isAPosPI && !isBPosPI) return 1;
      if (!isAPosPI && isBPosPI) return -1;

      // Both are same type (both Jemaat or both Pos PI), continue with normal sort
      // Prioritaskan grouping Wilayah jika sedang tidak filter resort tertentu
      if (filterResort === 'Semua Resort' && sortType === 'order') {
        const wA = getWilayahLevel(a.wilayah);
        const wB = getWilayahLevel(b.wilayah);
        if (wA !== wB) return wA - wB;
        
        const rComp = compareResorts(a.resort || '', b.resort || '');
        if (rComp !== 0) return rComp;
        
        if (a.type !== b.type) return a.type === 'resort' ? -1 : 1;
        return (a.order || 0) - (b.order || 0);
      }
      
      if (sortType === 'pos_pi') {
        const isAPosPI = a.nama.toLowerCase().includes('pos pi');
        const isBPosPI = b.nama.toLowerCase().includes('pos pi');
        if (isAPosPI && !isBPosPI) return -1;
        if (!isAPosPI && isBPosPI) return 1;
        return a.nama.localeCompare(b.nama);
      }
      
      if (sortType === 'nama') return a.nama.localeCompare(b.nama);
      if (sortType === 'resort') return a.resort.localeCompare(b.resort);
      if (sortType === 'wilayah') {
        const wA = getWilayahLevel(a.wilayah);
        const wB = getWilayahLevel(b.wilayah);
        if (wA !== wB) return wA - wB;
        return a.nama.localeCompare(b.nama);
      }
      if (sortType === 'order') return (a.order || 0) - (b.order || 0);
      return a.id.localeCompare(b.id);
    });
  }, [churches, sortType, filterResort, filterWilayah, searchTerm]);

  const displayGroupedChurches = useMemo(() => {
    const result: any[] = [];
    let currentWilayah = '';
    let resortRomanCounter = 0;
    let showingPosPIHeader = false;
    
    // Show Wilayah headers if we are not searching AND we are in 'order' or 'wilayah' sort mode
    const shouldShowHeaders = filterResort === 'Semua Resort' && !searchTerm && (sortType === 'order' || sortType === 'wilayah');

    sortedChurches.forEach((item) => {
      const isPosPI = item.nama.toLowerCase().includes('pos pi');
      
      if (shouldShowHeaders && isPosPI && !showingPosPIHeader) {
        showingPosPIHeader = true;
        result.push({
          id: 'header-pos-pi',
          type: 'group-header',
          name: 'DAFTAR POS PI',
          roman: ''
        });
        // Reset currentWilayah so if there's a wilayah change within Pos PI it shows up, 
        // though typically user wants them all under one header at the end.
        currentWilayah = 'pos-pi-section'; 
      }

      const itemWilayah = item.wilayah || 'Belum Ditentukan';
      if (shouldShowHeaders && !isPosPI && itemWilayah !== currentWilayah) {
        currentWilayah = itemWilayah;
        const wLevel = getWilayahLevel(currentWilayah);
        const roman = wLevel < 9999 ? translateToRoman(wLevel) : '?';
        result.push({
          id: `header-wilayah-${currentWilayah}`,
          type: 'group-header',
          name: currentWilayah,
          roman: roman
        });
      }
      
      if (item.type === 'resort') {
        resortRomanCounter++;
        result.push({
          ...item,
          resortRoman: translateToRoman(resortRomanCounter)
        });
      } else {
        result.push(item);
      }
    });
    return result;
  }, [sortedChurches, filterResort, searchTerm, sortType]);

  const uniqueResorts = useMemo(() => {
    const rs = Array.from(new Set(churches.map(c => normalizeResortName(c.resort)).filter(Boolean)));
    return ['Semua Resort', ...rs.sort(compareResorts)];
  }, [churches]);

  const uniqueWilayah = useMemo(() => {
    const ws = Array.from(new Set(churches.map(c => c.wilayah).filter(Boolean)));
    ws.sort((a, b) => getWilayahLevel(a) - getWilayahLevel(b));
    return ['Semua Wilayah', ...ws];
  }, [churches]);
  const getLaporanData = (kategori: 'laporan' | 'pelean' | 'alaman') => {
    const columns = SPREADSHEET_COLUMNS[kategori];
    let data = [...churches]; // Use base churches to avoid global sort interference
    
    // Apply filters matching the global ones
    if (filterResort !== 'Semua Resort') {
      const normFilter = normalizeResortName(filterResort);
      data = data.filter(c => normalizeResortName(c.resort) === normFilter);
    }
    if (filterWilayah !== 'Semua Wilayah') {
      data = data.filter(c => c.wilayah === filterWilayah);
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(c => 
        c.nama.toLowerCase().includes(lower) || 
        c.resort.toLowerCase().includes(lower)
      );
    }

    // Persembahan II (Laporan) tidak menampilkan Resort entity row
    if (kategori === 'laporan') {
      data = data.filter(c => c.type !== 'resort');
    }

    data.sort((a,b) => {
      // GLOBAL PRIORITY: Jemaat vs Pos PI (Pos PI goes to the absolute bottom)
      const isAPosPI = a.nama.toLowerCase().includes('pos pi');
      const isBPosPI = b.nama.toLowerCase().includes('pos pi');
      
      if (isAPosPI && !isBPosPI) return 1;
      if (!isAPosPI && isBPosPI) return -1;
      
      if (filterResort === 'Semua Resort' && sortType === 'order') {
        const wA = getWilayahLevel(a.wilayah);
        const wB = getWilayahLevel(b.wilayah);
        if (wA !== wB) return wA - wB;
        
        const rComp = compareResorts(a.resort || '', b.resort || '');
        if (rComp !== 0) return rComp;
        
        if (a.type !== b.type) return a.type === 'resort' ? -1 : 1;
        return (a.order || 0) - (b.order || 0);
      }

      const wA = getWilayahLevel(a.wilayah);
      const wB = getWilayahLevel(b.wilayah);
      if (wA !== wB) return wA - wB;
      
      const resA = a.resort || '';
      const resB = b.resort || '';
      const rComp = compareResorts(resA, resB);
      if (rComp !== 0) return rComp;
      
      // If one is a 'resort' type entry and other is church, resort goes first
      if (a.type !== b.type) return a.type === 'resort' ? -1 : 1;

      return a.nama.localeCompare(b.nama);
    });

    return data
      .map(gereja => {
        const targetIdentityKey = getChurchIdentityKey(gereja);
        
        // Find all payments that belong to this identity, regardless of which ID/alias was used
        const pembayaranList = payments.filter(p => {
          // 1. Check if category and period match
          if ((p.kategori || '').toLowerCase() !== kategori.toLowerCase()) return false;
          if (normalizePeriode(p.periode) !== normalizePeriode(periodeAktif)) return false;

          // 2. Check identity match
          // Look up the full church info for this payment's gerejaId to get its identity key
          const pChurch = allChurches.find(c => c.id === p.gerejaId);
          if (pChurch) {
            return getChurchIdentityKey(pChurch) === targetIdentityKey;
          }
          
          // Fallback: if church not found in current list, check if the ID itself is one of this church's known aliases
          const aliases = churchAliasesMap[gereja.id] || [gereja.id];
          return aliases.includes(p.gerejaId);
        });
        
        let combinedDetails: Record<string, number> = {};
        pembayaranList.forEach(p => {
          if (p.details) {
            Object.entries(p.details).forEach(([k, v]) => {
              combinedDetails[k] = (combinedDetails[k] || 0) + (v as number || 0);
            });
          }
        });

        let status = 'Menunggak';
        const filledColumnsCount = columns.filter(col => (combinedDetails[col] || 0) > 0).length;
        
        if (filledColumnsCount === columns.length) {
          status = 'Lunas';
        } else if (filledColumnsCount > 0) {
          status = 'Proses';
        }

        const combinedJumlah = Object.values(combinedDetails).reduce((sum, val) => sum + ((val as number) || 0), 0) as number;
        
        // Find latest date from all fragments
        let latestDate = null;
        if (pembayaranList.length > 0) {
          latestDate = pembayaranList.reduce((latest, current) => {
            if (!latest) return current.tanggal;
            if (!current.tanggal) return latest;
            return new Date(current.tanggal) > new Date(latest) ? current.tanggal : latest;
          }, null as string | null);
        }

        return {
          ...gereja,
          status: status,
          jumlah: combinedJumlah,
          tanggal: latestDate,
          details: combinedDetails,
          kategori: kategori,
          periode: periodeAktif
        };
      });
  };

  const dataAlaman = useMemo(() => getLaporanData('alaman'), [sortedChurches, payments, periodeAktif, churchAliasesMap]);
  const dataPelean = useMemo(() => getLaporanData('pelean'), [sortedChurches, payments, periodeAktif, churchAliasesMap]);
  const dataLaporanKeuangan = useMemo(() => getLaporanData('laporan'), [sortedChurches, payments, periodeAktif, churchAliasesMap]);

  const dataDistribusi = useMemo(() => {
    return sortedChurches.map(gereja => {
      const aliases = churchAliasesMap[gereja.id] || [gereja.id];
      const dist = distributions.find(d => 
        aliases.includes(d.gerejaId) && 
        normalizePeriode(d.periode) === normalizePeriode(periodeAktif)
      );
      return {
        ...gereja,
        details: dist ? dist.details : {},
        periode: periodeAktif
      };
    });
  }, [sortedChurches, distributions, periodeAktif, churchAliasesMap]);

  const lunasChurches = useMemo(() => {
    return churches.filter(church => {
      const isLaporanLunas = dataLaporanKeuangan.find(d => d.id === church.id)?.status === 'Lunas';
      const isPeleanLunas = dataPelean.find(d => d.id === church.id)?.status === 'Lunas';
      const isAlamanLunas = dataAlaman.find(d => d.id === church.id)?.status === 'Lunas';
      return isLaporanLunas && isPeleanLunas && isAlamanLunas;
    });
  }, [churches, dataLaporanKeuangan, dataPelean, dataAlaman]);

  const totalPemasukan = useMemo(() => {
    return payments
      .filter(p => {
        const church = allChurches.find(c => c.id === p.gerejaId);
        if (!church) return false;
        const matchResort = filterResort === 'Semua Resort' || normalizeResortName(church.resort) === normalizeResortName(filterResort);
        const matchWilayah = filterWilayah === 'Semua Wilayah' || church.wilayah === filterWilayah;
        return normalizePeriode(p.periode) === normalizePeriode(periodeAktif) && p.jumlah > 0 && matchResort && matchWilayah;
      })
      .reduce((sum, item) => sum + item.jumlah, 0);
  }, [payments, allChurches, periodeAktif, filterResort, filterWilayah]);

  const { pemasukanLaporan, pemasukanPelean, pemasukanAlaman } = useMemo(() => {
    let lap = 0, pel = 0, al = 0;
    payments.forEach(p => {
      const church = allChurches.find(c => c.id === p.gerejaId);
      if (!church) return;
      const matchResort = filterResort === 'Semua Resort' || normalizeResortName(church.resort) === normalizeResortName(filterResort);
      const matchWilayah = filterWilayah === 'Semua Wilayah' || church.wilayah === filterWilayah;
      
      if (normalizePeriode(p.periode) === normalizePeriode(periodeAktif) && p.jumlah > 0 && matchResort && matchWilayah) {
        if (p.kategori === 'laporan') lap += p.jumlah;
        else if (p.kategori === 'pelean') pel += p.jumlah;
        else if (p.kategori === 'alaman') al += p.jumlah;
      }
    });
    return { pemasukanLaporan: lap, pemasukanPelean: pel, pemasukanAlaman: al };
  }, [payments, allChurches, periodeAktif, filterResort, filterWilayah]);
  
  const stats = useMemo(() => {
    let totalMenunggak = 0;
    let totalLunas = 0;
    let totalProses = 0;

    [dataAlaman, dataPelean, dataLaporanKeuangan].forEach((dataset) => {
      dataset.filter(item => {
        const matchResort = filterResort === 'Semua Resort' || normalizeResortName(item.resort) === normalizeResortName(filterResort);
        const matchWilayah = filterWilayah === 'Semua Wilayah' || item.wilayah === filterWilayah;
        return matchResort && matchWilayah && item.type !== 'resort';
      }).forEach(item => {
        if (item.status === 'Menunggak') {
          totalMenunggak++;
        } else if (item.status === 'Lunas') {
          totalLunas++;
        } else {
          totalProses++;
        }
      });
    });

    const totalDistribusiItems = dataDistribusi.filter(item => {
      const matchResort = filterResort === 'Semua Resort' || normalizeResortName(item.resort) === normalizeResortName(filterResort);
      const matchWilayah = filterWilayah === 'Semua Wilayah' || item.wilayah === filterWilayah;
      return matchResort && matchWilayah && item.type !== 'resort';
    }).reduce((sum, item) => {
      const qty = Object.values(item.details).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
      return sum + qty;
    }, 0);

    return { totalMenunggak, totalLunas, totalProses, totalDistribusiItems };
  }, [dataAlaman, dataPelean, dataLaporanKeuangan, dataDistribusi, filterResort, filterWilayah]);

  const churchesWithArrears = useMemo(() => {
    const currentMonthIdx = new Date().getMonth(); // 0-11
    
    return churches
      .map(church => {
        const allPotentialArrears: Record<string, string[]> = {};
        let hasPotential = false;

        Object.entries(SPREADSHEET_COLUMNS).forEach(([cat, cols]) => {
          // Resort entities only follow Pelean (Special Offerings) and Alaman (Literature)
          if (church.type === 'resort' && cat === 'laporan') return;

          const aliases = churchAliasesMap[church.id] || [church.id];
          const pembayaranList = payments.filter(p => 
            aliases.includes(p.gerejaId) && 
            p.kategori === cat && 
            normalizePeriode(p.periode) === normalizePeriode(periodeAktif)
          );
          let combinedDetails: Record<string, number> = {};
          pembayaranList.forEach(p => {
             if (p.details) combinedDetails = { ...combinedDetails, ...p.details };
          });

          const unpaid = cols.filter(col => !combinedDetails[col] || combinedDetails[col] === 0);
          if (unpaid.length > 0) {
            allPotentialArrears[cat] = unpaid;
            hasPotential = true;
          }
        });

        if (!hasPotential) return null;

      // Smart Defaults for first time view of this church
      if (!billingSelections[church.id]) {
        const defaults: Record<string, string[]> = {};
        Object.entries(allPotentialArrears).forEach(([cat, cols]) => {
          if (cat === 'laporan') {
            // Only months up to current month
            defaults[cat] = cols.filter(col => {
              const monthIdx = SPREADSHEET_COLUMNS.laporan.indexOf(col);
              return monthIdx !== -1 && monthIdx <= currentMonthIdx;
            });
          } else {
            defaults[cat] = [...cols];
          }
        });
        
        // Use setTimeout to avoid side effect in useMemo
        setTimeout(() => {
          setBillingSelections(prev => ({ ...prev, [church.id]: defaults }));
        }, 0);
      }

      const activeArrears = billingSelections[church.id] || {};
      const hasActive = Object.values(activeArrears).some((cols: string[]) => cols.length > 0);

      return { 
        ...church, 
        allPotentialArrears, 
        activeArrears,
        hasActive
      };
    }).filter((c): c is (Church & { 
      allPotentialArrears: Record<string, string[]>, 
      activeArrears: Record<string, string[]>,
      hasActive: boolean 
    }) => c !== null);
  }, [churches, payments, periodeAktif, billingSelections, churchAliasesMap]);

  // ==========================================
  // FUNGSI AKSI & TOMBOL
  // ==========================================
  const handleGateLogin = () => {
    if (gateForm.username === 'GKLI180565' && gateForm.password === 'LUTHERAN') {
      setIsGatePassed(true);
      sessionStorage.setItem('gkli_gate_passed', 'true');
    } else {
      alert('Akses Ditolak: Username atau Password salah!');
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, loginForm.username, loginForm.password);
      setShowLoginModal(false);
      setLoginForm({ username: '', password: '' });
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed') {
        alert('KESALAHAN KONFIGURASI: Metode login Email/Password belum diaktifkan di Firebase Console.\n\nHarap ke: Firebase Console > Authentication > Sign-in method > Aktifkan "Email/Password".');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        alert('Login Gagal: Username atau Password salah.');
      } else {
        alert('Login Gagal: ' + error.message);
      }
    }
  };

  const handleRegisterInitialAdmin = async () => {
    if (users.length > 0) return alert("Hanya bisa dilakukan jika belum ada admin (Sistem Baru).");
    if (!loginForm.username || !loginForm.password) return alert("Isi Username dan Password di atas!");
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, loginForm.username, loginForm.password);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        username: loginForm.username,
        role: 'superadmin',
        password: '' // Optional, we use Firebase Auth
      });
      setShowLoginModal(false);
      setLoginForm({ username: '', password: '' });
      alert("Sukses! Akun Superadmin Pertama telah berhasil dibuat.");
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed') {
        alert('KESALAHAN KONFIGURASI: Metode login Email/Password belum diaktifkan di Firebase Console.');
      } else {
        alert('Gagal membuat akun: ' + error.message);
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleSaveUser = async () => {
    if (!formUser.username || !formUser.password) return alert('Username dan Password wajib diisi!');
    
    try {
      // 1. Create auth account
      const userCred = await createUserWithEmailAndPassword(auth, formUser.username, formUser.password);
      // 2. Store role in Firestore
      await setDoc(doc(db, 'users', userCred.user.uid), {
        username: formUser.username,
        role: formUser.role
      });
      setShowUserModal(false);
      setFormUser({ username: '', password: '', role: 'staff' });
      alert('Akun berhasil dibuat!');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (window.confirm(`Yakin ingin menghapus akses akun ini?`)) {
      await deleteDoc(doc(db, 'users', uid));
    }
  };

  const handleThemeChange = async (newTheme: string) => {
    if (currentUserProfile?.role !== 'superadmin') {
      alert("Hanya admin yang dapat mengganti tema!");
      return;
    }
    const updatedSettings = { ...appSettings, theme: newTheme as any };
    setAppSettings(updatedSettings); // Optimistic UI
    await setDoc(doc(db, 'settings', 'config'), updatedSettings);
  };

  const handleSaveSettings = async () => {
    if (currentUserProfile?.role !== 'superadmin') return;
    await setDoc(doc(db, 'settings', 'config'), formSettings);
    setShowSettingsModal(false);
  };

  const handleCellChange = async (gerejaId: string, kategori: 'laporan' | 'pelean' | 'alaman', field: string, value: string) => {
    if (!currentUserProfile) return; 

    let rawNum = parseInt(value.replace(/[^0-9]/g, ''));
    if (isNaN(rawNum)) rawNum = 0;

    const aliases = churchAliasesMap[gerejaId] || [gerejaId];
    const pembayaranList = payments.filter(p => 
      aliases.includes(p.gerejaId) && 
      p.kategori === kategori && 
      normalizePeriode(p.periode) === normalizePeriode(periodeAktif)
    );
    
    // Sum of all archived payments for this exact cell
    const sumArchived = pembayaranList.filter(p => p.receiptSent).reduce((sum, p) => sum + (p.details?.[field] || 0), 0);
    
    // Calculate what the unarchived portion needs to be to match the total the user typed
    const neededUnarchivedPart = rawNum - sumArchived;

    // Reject if they try to reduce total below what's permanently archived
    if (neededUnarchivedPart < 0) {
      alert(`Mohon Maaf, Anda tidak bisa mengetik total yang lebih kecil dari arsip permanen (Rp ${formatRupiah(sumArchived)}). Apabila ingin membatalkan arsip, silakan hubungi superadmin.`);
      return;
    }

    // Ignore event if value is exactly what's archived and there's no pending payment to update (no-op)
    // BUT if there IS a pending payment with a value, and they type exactly sumArchived, it means they erased the pending payment! So we must let it proceed (neededUnarchivedPart = 0)
    
    // Track session updates
    setSessionUpdatedCells(sess => {
      const churchSess = sess[gerejaId] || {};
      const catSess = churchSess[kategori] || [];
      if (!catSess.includes(field)) {
        return {
          ...sess,
          [gerejaId]: {
            ...churchSess,
            [kategori]: [...catSess, field]
          }
        };
      }
      return sess;
    });

    // Find if there is an unarchived 'pending' document we can write to
    const targetPayment = pembayaranList.find(p => !p.receiptSent);

    if (targetPayment) {
      // Use the neededUnarchivedPart for the pending receipt
      const updatedDetails = { ...targetPayment.details, [field]: neededUnarchivedPart };
      const updatedJumlah = Object.values(updatedDetails).reduce((sum: number, val: any) => sum + ((val as number) || 0), 0);
      await updateDoc(doc(db, 'payments', targetPayment.id), {
        details: updatedDetails,
        jumlah: updatedJumlah,
        tanggal: new Date().toISOString().split('T')[0]
      });
    } else {
      if (neededUnarchivedPart === 0) return; // Don't create new doc for 0
      
      // Create a brand new document using addDoc instead of deterministic ID
      // This allows multiple documents (archived vs unarchived) per church/category/period
      await addDoc(collection(db, 'payments'), {
        gerejaId, 
        kategori, 
        periode: periodeAktif,
        details: { [field]: neededUnarchivedPart },
        jumlah: neededUnarchivedPart,
        tanggal: new Date().toISOString().split('T')[0],
        receiptSent: false
      });
    }
  };

  const handleDistributionChange = async (gerejaId: string, field: string, value: string) => {
    if (!currentUserProfile) return; 

    let numValue = parseInt(value.replace(/[^0-9]/g, ''));
    if (isNaN(numValue)) numValue = 0;

    const aliases = churchAliasesMap[gerejaId] || [gerejaId];
    const existingDist = distributions.find(d => 
      aliases.includes(d.gerejaId) && 
      normalizePeriode(d.periode) === normalizePeriode(periodeAktif)
    );
    
    if (existingDist) {
      const updatedDetails = { ...existingDist.details, [field]: numValue };
      await updateDoc(doc(db, 'distributions', existingDist.id), {
        details: updatedDetails,
        tanggal: new Date().toISOString().split('T')[0]
      });
    } else {
      // Deterministic ID to prevent race conditions
      const stableId = `${gerejaId}_dist_${periodeAktif.replace(/\s+/g, '_')}`;
      await setDoc(doc(db, 'distributions', stableId), {
        gerejaId, 
        periode: periodeAktif,
        details: { [field]: numValue },
        tanggal: new Date().toISOString().split('T')[0]
      });
    }
  };

  const handleSaveChurch = async () => {
    if (currentUserProfile?.role !== 'superadmin') return;
    if (!formChurch.nama) return alert('Nama wajib diisi!');
    
    try {
      if (formChurch.id) {
        await updateDoc(doc(db, 'churches', formChurch.id), { ...formChurch });
      } else {
        await addDoc(collection(db, 'churches'), { 
          ...formChurch, 
          order: formChurch.order || (churches.length + 1) 
        });
      }
      setShowChurchModal(false);
    } catch (e: any) {
      alert("Error saving: " + e.message);
    }
  };

  const handleGenerateResortEntities = async () => {
    if (currentUserProfile?.role !== 'superadmin') return;
    
    const uniqueResortNames = Array.from(new Set(churches.map(c => c.resort))).filter(r => r && r !== '-');
    const existingResortEntries = churches.filter(c => c.type === 'resort');
    
    if (window.confirm(`Sistem akan membuat entitas pembayaran khusus untuk tiap resort (${uniqueResortNames.length} resort ditemukan). Lanjutkan?`)) {
      try {
        let addedCount = 0;
        for (const resortName of uniqueResortNames) {
          const expectedName = `Resort ${resortName}`;
          const alreadyExists = existingResortEntries.find(r => r.nama.toLowerCase() === expectedName.toLowerCase());
          
          if (!alreadyExists) {
            await addDoc(collection(db, 'churches'), {
              nama: expectedName,
              resort: resortName,
              wilayah: '',
              wa: '',
              type: 'resort',
              order: churches.length + addedCount + 1
            });
            addedCount++;
          }
        }
        
        if (addedCount > 0) {
          alert(`${addedCount} entitas Resort berhasil ditambahkan.`);
        } else {
          alert("Semua Resort sudah terdaftar sebagai entitas.");
        }
      } catch (err: any) {
        alert("Gagal: " + err.message);
      }
    }
  };

  const handleDeleteChurch = async (id: string) => {
    if (!currentUserProfile) return;
    if (window.confirm("Apakah Anda yakin ingin menghapus jemaat ini? Seluruh data pembayaran jemaat ini juga akan dihapus permanen.")) {
       try {
         await deleteDoc(doc(db, 'churches', id));
         // Also cleanup payments
         const toDelete = payments.filter(p => p.gerejaId === id);
         for (const p of toDelete) {
           await deleteDoc(doc(db, 'payments', p.id));
         }
       } catch (err: any) {
         alert("Gagal menghapus: " + err.message);
       }
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!currentUserProfile) return;
    const payment = payments.find(p => p.id === paymentId);
    if (payment?.receiptSent) {
      alert("Tidak dapat menghapus data yang sudah diarsipkan. Silakan buat entri baru untuk data terbaru.");
      return;
    }

    if (window.confirm("Apakah Anda yakin ingin menghapus data pembayaran ini secara permanen?")) {
      try {
        await deleteDoc(doc(db, 'payments', paymentId));
      } catch (err: any) {
        alert("Gagal menghapus pembayaran: " + err.message);
      }
    }
  };

  const handleMoveChurch = async (id: string, direction: 'up' | 'down') => {
    if (!currentUserProfile) return;
    const currentIndex = sortedChurches.findIndex(c => c.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedChurches.length) return;

    const currentChurch = sortedChurches[currentIndex];
    const targetChurch = sortedChurches[targetIndex];

    try {
      // Swap orders
      const currentOrder = currentChurch.order || 0;
      const targetOrder = targetChurch.order || 0;

      // Handle same order case fallback
      const finalCurrentOrder = currentOrder === targetOrder 
        ? (direction === 'up' ? targetOrder - 1 : targetOrder + 1)
        : targetOrder;
      
      const finalTargetOrder = currentOrder;

      await updateDoc(doc(db, 'churches', currentChurch.id), { order: finalCurrentOrder });
      await updateDoc(doc(db, 'churches', targetChurch.id), { order: finalTargetOrder });
    } catch (err: any) {
      alert("Gagal memindahkan: " + err.message);
    }
  };

  const handleReorderChurches = async (newOrder: any[]) => {
    if (!currentUserProfile || !canDragOrder) return;
    
    // Filter out headers before saving
    const churchesOnly = newOrder.filter(item => item.type !== 'group-header');
    
    // Extract the original order values of these items available in the UI
    // So that we only swap their existing order values, instead of overwriting global values
    const originalOrders = churchesOnly.map(c => c.order || 0).sort((a, b) => a - b);
    
    // Batch update order fields in Firestore
    const batch = writeBatch(db);
    churchesOnly.forEach((church, index) => {
      const newIdx = originalOrders[index];
      if (church.order !== newIdx && !church.isSynthesized) {
        batch.update(doc(db, 'churches', church.id), { order: newIdx });
      }
    });
    
    try {
      await batch.commit();
    } catch (err: any) {
      console.error("Reorder failed:", err);
      alert("Gagal memindahkan urutan: " + err.message);
    }
  };

  const handleMarkPaymentsAsSent = async (paymentIds: string[]) => {
    try {
      const maxNomorSurat = payments.reduce((max, p) => Math.max(max, p.nomorSurat || 1956), 1956);
      const nextNomorSurat = maxNomorSurat + 1;

      for (const id of paymentIds) {
        await updateDoc(doc(db, 'payments', id), { 
          receiptSent: true,
          receiptSentAt: new Date().toISOString(),
          nomorSurat: nextNomorSurat
        });
      }
    } catch (err: any) {
      console.error("Gagal update status pengiriman: ", err);
    }
  };

  const handleKirimWASpesifik = (item: any, colName: string) => {
    const val = item.details[colName] || 0;
    const catLabel = CATEGORY_LABELS[item.kategori] || item.kategori;
    const formattedName = getFormattedPaymentName(item.kategori, colName);
    let text = "";
    if (val > 0) {
      text = `Syalom Bapak/Ibu Majelis Jemaat ${item.nama}, kami dari Kantor Pusat GKLI mengucapkan terima kasih atas persembahan *${formattedName.toUpperCase()}* (${catLabel.toUpperCase()}) periode ${item.periode} sebesar *Rp ${formatRupiah(val)}*. Tuhan memberkati.`;
    } else {
      text = `Syalom Bapak/Ibu Majelis Jemaat ${item.nama}, dari Kantor Pusat GKLI ingin mengingatkan bahwa catatan kas kami untuk item *${formattedName.toUpperCase()}* (${catLabel.toUpperCase()}) periode ${item.periode} masih kosong (menunggak). Mohon agar dapat segera diselesaikan. Terima kasih, Tuhan memberkati.`;
    }
    window.open(`https://wa.me/${item.wa}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleKirimWABatch = (item: any) => {
    const selected = selectedCells[item.id] || [];
    if (selected.length === 0) return;

    const catLabel = CATEGORY_LABELS[item.kategori] || item.kategori;
    const details = selected.map(col => `- *${getFormattedPaymentName(item.kategori, col).toUpperCase()}*: Rp ${formatRupiah(item.details[col])}`).join('\n');
    const total = selected.reduce((sum, col) => sum + (item.details[col] || 0), 0);
    
    const text = `Syalom Bapak/Ibu Majelis Jemaat ${item.nama}, kami dari Kantor Pusat GKLI mengucapkan terima kasih atas persembahan (${catLabel.toUpperCase()}) periode ${item.periode} untuk item berikut:\n${details}\n\n*Total: Rp ${formatRupiah(total)}*\n\nKiranya Tuhan Yesus senantiasa memberkati pelayanan kita.`;
    
    window.open(`https://wa.me/${item.wa}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const toggleCellSelection = (gerejaId: string, colName: string) => {
    setSelectedCells(prev => {
      const current = prev[gerejaId] || [];
      if (current.includes(colName)) {
        return { ...prev, [gerejaId]: current.filter(c => c !== colName) };
      } else {
        return { ...prev, [gerejaId]: [...current, colName] };
      }
    });
  };

  const handlePrintBukti = (item: any, type: 'penerimaan' | 'tunggakan') => {
    const selected = selectedCells[item.id] || [];
    const columns = SPREADSHEET_COLUMNS[item.kategori as keyof typeof SPREADSHEET_COLUMNS];
    
    const dataToPrint = {
      ...item,
      printType: type,
      items: type === 'penerimaan' 
        ? (selected.length > 0 ? selected : columns.filter(c => (item.details[c] || 0) > 0))
        : columns.filter(c => !(item.details[c] || 0))
    };
    
    setPrintData(dataToPrint);
    setPrintType(type);
  };

  const handleKirimWA = (item: any, type: 'tagihan' | 'terimakasih') => {
    const catLabel = CATEGORY_LABELS[item.kategori] || item.kategori;
    const text = type === 'tagihan' 
      ? `Syalom Jemaat ${item.nama}, mohon kesediaannya untuk menyelesaikan administrasi ${catLabel.toUpperCase()} periode ${item.periode}.`
      : `Syalom Jemaat ${item.nama}, terima kasih atas persembahan ${catLabel.toUpperCase()} sebesar Rp ${formatRupiah(item.jumlah)}.`;
    window.open(`https://wa.me/${item.wa}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleBulkImport = async () => {
    if (!currentUserProfile) return;
    if (!bulkText.trim()) return;
    const lines = bulkText.split('\n');
    let addedCount = 0;
    
    for (const line of lines) {
      const cols = line.split('\t');
      if (cols.length > 0 && cols[0].trim() !== '') {
        const churchData: Omit<Church, 'id'> = {
          nama: cols[0].trim(),
          resort: cols[1] ? cols[1].trim() : '-',
          wilayah: cols[2] ? cols[2].trim() : '-',
          wa: cols[3] ? cols[3].trim() : '',
          order: churches.length + addedCount + 1
        };
        try {
          await addDoc(collection(db, 'churches'), churchData);
          addedCount++;
        } catch (err: any) {
          console.error("Import error line:", line, err);
        }
      }
    }
    
    setShowBulkModal(false);
    setBulkText('');
    alert(`${addedCount} data jemaat berhasil diimpor.`);
  };

  const handlePullMasterData = async () => {
    if (!currentUserProfile || currentUserProfile.role !== 'superadmin') return;
    
    const confirmImport = window.confirm(
      "Apakah Anda ingin menarik seluruh Data Jemaat Master (Data Default) ke Database Anda?\n\n" +
      "Langkah ini akan menyimpan seluruh daftar jemaat yang ada di sistem (Medan, Mentawai, dll.) ke akun Anda sehingga tersimpan permanen."
    );
    
    if (!confirmImport) return;

    try {
      let added = 0;
      // We only pull churches that have real names (not placeholders "Jemaat No. X")
      const masterList = INITIAL_CHURCHES.filter(c => !c.nama.startsWith('Jemaat No.'));
      const lastOrder = churches.length > 0 ? Math.max(...churches.map(c => c.order || 0)) : 0;
      
      for (const church of masterList) {
        // We use setDoc with its ID to prevent double entry if the ID somehow matches
        // prepending 'master_' to avoid conflicts with existing auto-ids
        await setDoc(doc(db, 'churches', `master_${church.id}`), {
          ...church,
          order: lastOrder + added + 1
        });
        added++;
      }
      
      alert(`✅ BERHASIL!\n\n${added} data jemaat master telah ditarik ke database Anda.`);
    } catch (err: any) {
      alert("Gagal menarik data: " + err.message);
    }
  };

  const syncToGoogleSheets = async (silent = false) => {
    if (!appSettings.googleSheetUrl) {
      if (!silent) alert("Silakan atur URL Google Apps Script di Pengaturan terlebih dahulu.");
      return;
    }

    if (!appSettings.googleSheetUrl.includes('/exec')) {
      if (!silent) alert("⚠️ URL TIDAK VALID\n\nSepertinya Anda memasukkan URL Editor. Harap masukkan URL hasil 'New Deployment' yang berakhiran dengan /exec");
      return;
    }
    
    if (!silent) {
      const confirmSync = window.confirm("Apakah Anda ingin mencadangkan seluruh data ke Google Sheet?");
      if (!confirmSync) return;
    }

    try {
      const data = {
        action: 'syncData',
        payload: {
          churches,
          payments,
          users: users.map(u => ({ username: u.username, role: u.role })),
          timestamp: new Date().toISOString()
        }
      };

      // Kita kirim sebagai text/plain untuk menghindari CORS preflight request
      await fetch(appSettings.googleSheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(data)
      });

      if (!silent) alert("🚀 INSTRUKSI SINKRONISASI TERKIRIM!\n\nData sedang diproses oleh Google. \n\nTips: Jika data belum muncul di Google Sheet, klik 'Edit Tampilan' lalu tekan tombol 'Cek Koneksi' untuk memastikan link Anda sudah benar.");
    } catch (error) {
      console.error("Sync Error:", error);
      if (!silent) alert("❌ KEGAGALAN SISTEM\n\nTidak dapat menghubungi server Google. Harap periksa koneksi internet Anda atau pastikan URL Apps Script belum kedaluwarsa.");
    }
  };

  const pullFromGoogleSheets = async () => {
    if (!appSettings.googleSheetUrl) {
      alert("Silakan atur URL Google Apps Script di Pengaturan terlebih dahulu.");
      return;
    }

    if (!appSettings.googleSheetUrl.includes('/exec')) {
      alert("⚠️ URL TIDAK VALID\n\nSepertinya Anda memasukkan URL Editor. Harap masukkan URL hasil 'New Deployment' yang berakhiran dengan /exec");
      return;
    }

    const confirmPull = window.confirm("PERINGATAN BAHAYA ⚠️\n\nMenarik data dari Google Sheet akan MENIMPA SERTA MENGHAPUS seluruh data Anda saat ini dan menggantinya dengan versi cadangan terakhir.\n\nApakah Anda sungguh-sungguh yakin ingin memulihkan (restore) data?");
    if (!confirmPull) return;

    try {
      // Create a URL object to carefully append the parameter to avoid ? vs & issues
      const cleanUrl = appSettings.googleSheetUrl.trim();
      const fetchUrl = cleanUrl + (cleanUrl.includes('?') ? '&' : '?') + 'action=pull&nocache=' + Date.now();

      const response = await fetch(fetchUrl, {
        cache: 'no-store'
      });
      let outputText = await response.text();
      console.log("Raw output from Google:", outputText);

      let data;
      try {
        data = JSON.parse(outputText);
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }
        if (typeof data === 'string') {
           data = JSON.parse(data);
        }
      } catch(e) {
        console.error("JSON Parsing failed completely:", e);
        return alert("Data dari Google Sheet tidak valid atau rusak.");
      }
      
      if (data.error) {
         return alert("Gagal memulihkan: " + data.error + "\n\nPastikan Anda sudah memperbarui Script Apps Anda dan menyimpannya.");
      }

      console.log("Ultimately Parsed Data:", data);

      if (!data || !data.churches || !data.payments) {
          console.log("Data structure unrecognized:", data);
          return alert("Format data cadangan tidak memiliki array churches atau payments.");
      }

      const totalItems = data.churches.length + data.payments.length;
      if (!window.confirm("Berdasarkan cadangan, ditemukan " + data.churches.length + " data gereja dan " + data.payments.length + " transaksi. Tekan 'OK' untuk memulai proses pemulihan (restore). Jangan tutup halaman sampai selesai!")) return;

      // 1. Delete all existing churches
      for (const c of churches) {
        await deleteDoc(doc(db, 'churches', c.id));
      }
      
      // 2. Delete all existing payments
      for (const p of payments) {
        await deleteDoc(doc(db, 'payments', p.id));
      }

      // 3. Restore records 1 by 1 precisely from the array to maintain exact sync order
      let restoredP = 0;
      let restoredC = 0;

      for (const c of data.churches) {
        // We setDoc using original ID to maintain exact reference and ordering structure
        await setDoc(doc(db, 'churches', c.id), c);
        restoredC++;
      }

      for (const p of data.payments) {
        await setDoc(doc(db, 'payments', p.id), p);
        restoredP++;
      }

      alert("🎉 RESTORE SELESAI!\n\nBerhasil memulihkan " + restoredC + " data jemaat dan " + restoredP + " data pembayaran. Halaman mungkin akan mengalami reload sendirinya.");
      
      // We might need to refresh manually to ensure state synchronization catches up safely
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (err: any) {
      console.error(err);
      alert("Terjadi kesalahan teknis saat mencoba menarik (pull) data.\nPastikan Anda sudah memperbarui Google Apps Script Anda!");
    }
  };

  const handleDownloadCurrentMenu = (format: 'excel' | 'word' | 'pdf') => {
    if (format === 'pdf') {
      if (['laporan', 'pelean', 'alaman'].includes(activeTab)) {
        setPrintData({ kategori: activeTab });
        setPrintType('rekap');
      } else {
        // Fallback to simple browser print with a small delay to ensure UI stability
        setTimeout(() => window.print(), 100);
      }
      return;
    }

    const title = appSettings.title.toUpperCase();
    const menuName = activeTab.toUpperCase();
    const date = new Date().toLocaleDateString('id-ID');
    const filename = `GKLI_${activeTab}_${periodeAktif}.${format === 'excel' ? 'csv' : 'doc'}`;

    if (format === 'word') {
      let htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${title}</title>
        <style>
          body { font-family: 'Times New Roman', serif; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { border: 1px solid black; padding: 8px; text-align: left; font-size: 10pt; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .header { text-align: center; margin-bottom: 20px; }
          .footer { margin-top: 30px; }
        </style>
        </head>
        <body>
          <div class="header">
            <h3>${title}</h3>
            <h4>LAPORAN: ${menuName}</h4>
            <p>Periode: ${periodeAktif} | Tanggal Unduh: ${date}</p>
          </div>
          <table>
      `;

      if (activeTab === 'gereja') {
        htmlContent += "<tr><th>NO</th><th>ID</th><th>NAMA JEMAAT</th><th>RESORT</th><th>WHATSAPP</th></tr>";
        churches.forEach((c, idx) => {
          htmlContent += `<tr><td>${idx + 1}</td><td>${c.id}</td><td>${c.nama}</td><td>${c.resort}</td><td>${c.wa}</td></tr>`;
        });
      } else if (['laporan', 'pelean', 'alaman'].includes(activeTab)) {
        const columns = SPREADSHEET_COLUMNS[activeTab as keyof typeof SPREADSHEET_COLUMNS];
        const data = getLaporanData(activeTab as any);
        htmlContent += `<tr><th>NO</th><th>NAMA JEMAAT</th><th>STATUS</th>${columns.map(c => `<th>${c}</th>`).join('')}<th>TOTAL</th></tr>`;
        data.forEach((item, idx) => {
          const detailCells = columns.map(col => `<td>Rp ${formatRupiah(item.details[col] || 0)}</td>`).join('');
          htmlContent += `<tr><td>${idx + 1}</td><td>${item.nama}</td><td>${item.status}</td>${detailCells}<td>Rp ${formatRupiah(item.jumlah)}</td></tr>`;
        });
      } else {
        htmlContent += "<tr><td>Data untuk menu ini belum dikonfigurasi untuk format Word. Silakan gunakan format Excel.</td></tr>";
      }

      htmlContent += `
          </table>
          <div class="footer">
            <p>Dicetak secara otomatis melalui Sistem Keuangan GKLI.</p>
          </div>
        </body>
        </html>
      `;

      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // EXCEL (CSV) SECTION
    let csvContent = "\uFEFF"; // BOM
    csvContent += `"${title}"\n`;
    csvContent += `"MENU: ${menuName}"\n`;
    csvContent += `"PERIODE: ${periodeAktif.toUpperCase()}"\n`;
    csvContent += `"TANGGAL UNDUH: ${date}"\n\n`;

    if (activeTab === 'gereja') {
      csvContent += "NO,ID,NAMA JEMAAT,RESORT,WHATSAPP\n";
      churches.forEach((c, idx) => {
        csvContent += `${idx + 1},${c.id},"${c.nama.replace(/"/g, '""')}","${c.resort.replace(/"/g, '""')}","${c.wa}"\n`;
      });
    } else if (['laporan', 'pelean', 'alaman'].includes(activeTab)) {
      const columns = SPREADSHEET_COLUMNS[activeTab as keyof typeof SPREADSHEET_COLUMNS];
      const data = getLaporanData(activeTab as any);
      const colTotals: Record<string, number> = {};
      columns.forEach(col => colTotals[col] = 0);
      let grandTotal = 0;

      csvContent += `NO,ID,NAMA JEMAAT,STATUS,${columns.join(',')},TOTAL (RP)\n`;
      data.forEach((item, idx) => {
        const detailValues = columns.map(col => {
          const val = item.details[col] || 0;
          colTotals[col] += val;
          return val;
        }).join(',');
        grandTotal += item.jumlah;
        csvContent += `${idx + 1},${item.id},"${item.nama.replace(/"/g, '""')}",${item.status},${detailValues},${item.jumlah}\n`;
      });
      const footerValues = columns.map(col => colTotals[col]).join(',');
      csvContent += `\n,,TOTAL KESELURUHAN,,${footerValues},${grandTotal}\n`;
    } else if (activeTab === 'penagihan') {
      csvContent += "NO,NAMA JEMAAT,RESORT,WHATSAPP,KATEGORI,ITEM TUNGGAKAN\n";
      churchesWithArrears.forEach((c, idx) => {
        Object.entries(c.arrears).forEach(([cat, fields]) => {
          csvContent += `${idx + 1},"${c.nama.replace(/"/g, '""')}","${c.resort.replace(/"/g, '""')}","${c.wa}","${CATEGORY_LABELS[cat] || cat}","${(fields as string[]).join('; ')}"\n`;
        });
      });
    } else if (activeTab === 'sertifikat') {
      csvContent += "NO,NAMA JEMAAT,RESORT,STATUS\n";
      lunasChurches.forEach((c, idx) => {
        csvContent += `${idx + 1},"${c.nama.replace(/"/g, '""')}","${c.resort.replace(/"/g, '""')}",Lunas 100%\n`;
      });
    } else if (activeTab === 'dashboard') {
      csvContent += "RINGKASAN DASHBOARD\n";
      csvContent += `KETERANGAN,NILAI\n`;
      csvContent += `Total Pemasukan ${periodeAktif},Rp ${formatRupiah(totalPemasukan)}\n`;
      csvContent += `Total Lunas,${formatRupiah(stats.totalLunas)} Jemaat\n`;
      csvContent += `Total Menunggak,${formatRupiah(stats.totalMenunggak)} Jemaat\n`;
      csvContent += `\nDAFTAR JEMAAT LUNAS SELURUHNYA\n`;
      lunasChurches.forEach(c => csvContent += `"${c.nama}" (Resort ${c.resort})\n`);
    } else {
      alert(`Fitur download untuk menu ${activeTab} belum tersedia.`);
      return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddPeriod = async () => {
    if (!currentUserProfile) return alert('Silakan login untuk menambah periode.');
    if (newPeriod.trim() !== '' && !periods.includes(newPeriod.trim())) {
      const updatedPeriods = [...periods, newPeriod.trim()];
      setPeriods(updatedPeriods);
      setNewPeriod('');
      
      const updatedSettings = { ...appSettings, periodeList: updatedPeriods };
      await setDoc(doc(db, 'settings', 'config'), updatedSettings);
    }
  };

  const formatRupiah = (angka: number) => {
    if (!angka || angka === 0) return '-';
    return new Intl.NumberFormat('id-ID').format(angka);
  };

  const terbilang = (angka: number): string => {
    const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
    if (angka < 12) return bilangan[angka];
    if (angka < 20) return terbilang(angka - 10) + ' Belas';
    if (angka < 100) return terbilang(Math.floor(angka / 10)) + ' Puluh ' + terbilang(angka % 10);
    if (angka < 200) return 'Seratus ' + terbilang(angka - 100);
    if (angka < 1000) return terbilang(Math.floor(angka / 100)) + ' Ratus ' + terbilang(angka % 100);
    if (angka < 2000) return 'Seribu ' + terbilang(angka - 1000);
    if (angka < 1000000) return terbilang(Math.floor(angka / 1000)) + ' Ribu ' + terbilang(angka % 1000);
    if (angka < 1000000000) return terbilang(Math.floor(angka / 1000000)) + ' Juta ' + terbilang(angka % 1000000);
    if (angka < 1000000000000) return terbilang(Math.floor(angka / 1000000000)) + ' Miliar ' + terbilang(angka % 1000000000);
    return '';
  };

  const formatInput = (angka: number) => {
    if (!angka || angka === 0) return '';
    return new Intl.NumberFormat('id-ID').format(angka);
  };

  const currentRomanMonth = useMemo(() => {
    const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return romanMonths[new Date().getMonth()];
  }, []);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

  const getNomorSurat = (item: any) => {
    const base = 1956;
    const maxNomorSurat = payments.reduce((max, p) => Math.max(max, p.nomorSurat || base), base);
    
    // For pending/preview letters, show what the NEXT number will be
    if (printType === 'penerimaan' || printType === 'tunggakan') return (maxNomorSurat + 1).toLocaleString('id-ID');

    // For archived letters, show the highest number among the grouped archived payments for that church & period
    if (item && item.id) {
      const aliases = churchAliasesMap[item.id] || [item.id];
      const churchArchivedPayments = payments.filter(p => 
        aliases.includes(p.gerejaId) && 
        normalizePeriode(p.periode) === normalizePeriode(item.periode || periodeAktif) && 
        p.receiptSent && p.nomorSurat
      );
      if (churchArchivedPayments.length > 0) {
        const highestChurchNomor = churchArchivedPayments.reduce((max, p) => Math.max(max, p.nomorSurat!), base);
        return highestChurchNomor.toLocaleString('id-ID');
      }
    }

    // Default fallback
    return (maxNomorSurat + 1).toLocaleString('id-ID');
  };

  const sortPaymentDetailsEntries = (cat: string, entries: [string, any][]) => {
    const monthOrder: Record<string, number> = {
      'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'Mei': 5, 'Jun': 6,
      'Jul': 7, 'Agu': 8, 'Agt': 8, 'Sep': 9, 'Okt': 10, 'Nov': 11, 'Des': 12
    };
    return entries.sort(([a], [b]) => {
      if (cat.toLowerCase() === 'laporan') {
        return (monthOrder[a] || 99) - (monthOrder[b] || 99);
      }
      return a.localeCompare(b);
    });
  };

  const getFormattedPaymentName = (cat: string, field: string) => {
    const monthMap: Record<string, string> = {
      'Jan': 'Januari', 'Feb': 'Februari', 'Mar': 'Maret', 'Apr': 'April',
      'Mei': 'Mei', 'Jun': 'Juni', 'Jul': 'Juli', 'Agu': 'Agustus',
      'Agt': 'Agustus', 'Sep': 'September', 'Okt': 'Oktober', 'Nov': 'November', 'Des': 'Desember'
    };

    const nCat = cat.toLowerCase();
    const nField = field.toLowerCase();

    // PERSEMBAHAN II (LAPORAN)
    if (nCat === 'laporan' || nCat === 'ii') {
      const month = monthMap[field] || field;
      return `Persembahan II bulan ${month} ${currentYear}`;
    }

    // PERSEMBAHAN KHUSUS (PELEAN)
    if (nCat === 'pelean' || nCat === 'khusus') {
      if (nField.includes('pendidikan')) return "Persembahan Dana Pendidikan";
      if (nField.includes('zending')) return "Persembahan Zending";
      return `Persembahan ${field}`;
    }

    // LITERATUR (ALAMAN)
    if (nCat === 'alaman' || nCat === 'literatur') {
      return field;
    }

    // DEFAULT FALLBACK
    const catLabel = CATEGORY_LABELS[cat] || cat;
    return `${catLabel} ${field}`;
  };

  // ==========================================
  // RENDER COMPONENTS
  // ==========================================
  
  if (!isGatePassed) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          <div className="bg-gold-600 p-8 text-center text-white">
            <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md overflow-hidden">
              {appSettings.logoUrl ? (
                <img src={appSettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <LayoutDashboard size={40} />
              )}
            </div>
            <h1 className="text-2xl font-bold">{appSettings.title}</h1>
            <p className="text-gold-100 mt-2">Akses Terbatas: Silakan Masuk</p>
          </div>
          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Users size={18} />
                  </span>
                  <input 
                    type="text" 
                    value={gateForm.username} 
                    onChange={e => setGateForm({...gateForm, username: e.target.value})} 
                    className="w-full border border-slate-200 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-gold-500 transition-all"
                    placeholder="Username Akses"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Password</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <LogIn size={18} />
                  </span>
                  <input 
                    type="password" 
                    value={gateForm.password} 
                    onChange={e => setGateForm({...gateForm, password: e.target.value})} 
                    className="w-full border border-slate-200 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-gold-500 transition-all"
                    placeholder="Password Akses"
                    onKeyDown={e => e.key === 'Enter' && handleGateLogin()}
                  />
                </div>
              </div>
            </div>
            <button 
              onClick={handleGateLogin} 
              className="w-full bg-gold-600 text-white py-4 rounded-xl font-bold hover:bg-gold-700 shadow-lg shadow-gold-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Buka Dashboard
            </button>
            <p className="text-center text-xs text-slate-400">
              Masukkan kredensial untuk melihat konten website
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (printType && printData) {
    // Print View Implementation (Simplified for brevity, but maintaining the core logic)
    return (
      <>
        <style>
          {`
            @media print {
              @page { size: portrait; margin: 0; }
              .no-print { display: none !important; }
              .print-preview-container {
                padding: 0 !important;
                margin: 0 !important;
                background-color: white !important;
              }
              #printable-page { 
                width: 100% !important; 
                margin: 0 !important; 
                padding: 1.5cm 2cm 1.5cm 2cm !important; 
                box-shadow: none !important;
                border: none !important;
              }
            }
            .print-preview-container {
              background-color: #f1f5f9;
              min-height: 100vh;
              padding: 60px 0;
            }
            #printable-page {
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
              background-color: white;
              padding: 2cm 2.54cm 2.54cm 2.54cm;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
              position: relative;
            }
          `}
        </style>
        <div className="no-print fixed top-0 left-0 right-0 bg-slate-900 text-white p-4 flex justify-between items-center z-50 shadow-xl">
          <div className="flex items-center gap-3">
             <div className="bg-gold-500 p-2 rounded-lg">
                <Printer size={20} className="text-slate-900" />
             </div>
             <h3 className="font-bold text-lg tracking-tight">Mode Siap Cetak (Potret)</h3>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setPrintType(null)} className="px-5 py-2.5 bg-slate-700 rounded-xl font-bold hover:bg-slate-600 transition-all">Kembali</button>
            <button 
              onClick={async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                const originalText = btn.innerHTML;
                btn.innerHTML = 'Memproses...';
                
                try {
                  const el = document.getElementById('printable-page');
                  if (el) {
                    // Force complete rendering and capture
                    const dataUrl = await toJpeg(el, { 
                      quality: 1, 
                      backgroundColor: '#ffffff',
                      pixelRatio: 2,
                      width: el.scrollWidth,
                      height: el.scrollHeight,
                      style: {
                        transform: 'scale(1)',
                        transformOrigin: 'top left',
                        margin: '0',
                        padding: '2cm 2.54cm 2.54cm 2.54cm',
                      }
                    });
                    const link = document.createElement('a');
                    link.download = `GKLI_${printData?.nama || 'Surat'}.jpg`;
                    link.href = dataUrl;
                    link.click();
                  }
                } catch (err) {
                  console.error(err);
                  alert("Gagal menyimpan gambar. Silakan coba lagi.");
                } finally {
                  btn.disabled = false;
                  btn.innerHTML = originalText;
                }
              }} 
              className="px-5 py-2.5 bg-emerald-600 rounded-xl font-bold hover:bg-emerald-500 flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
            >
              <Download size={18} /> Simpan JPG
            </button>
            <button 
              onClick={async (e) => {
                if (!printData?.wa) return alert("Nomor WA tidak tersedia pada data gereja ini.");
                
                const btn = e.currentTarget;
                btn.disabled = true;
                const originalText = btn.innerHTML;
                btn.innerHTML = 'Memproses...';

                try {
                  let rincianItems = '';
                  
                  if (printType === 'global-receipt') {
                    Object.entries(printData.updates || {}).forEach(([cat, fields]: [any, any]) => {
                      const catName = (cat === 'laporan' ? (appSettings.menuLaporan || 'Persembahan II') :
                                      cat === 'pelean' ? (appSettings.menuPelean || 'Persembahan Khusus') :
                                      (appSettings.menuAlaman || 'Literatur')).toUpperCase();
                      const catSum = fields.reduce((sum: number, f: string) => sum + (printData.allDetails?.[cat]?.[f] || 0), 0);
                      if (catSum > 0) {
                        rincianItems += `\n${catName} (Rp ${formatRupiah(catSum)}):`;
                        sortPaymentDetailsEntries(cat, fields.map((f: string) => [f, null])).forEach(([f]) => {
                          const val = printData.allDetails?.[cat]?.[f];
                          if (val > 0) {
                            rincianItems += `\n* ${getFormattedPaymentName(cat, f)} : Rp ${formatRupiah(val)}`;
                          }
                        });
                      }
                    });
                  } else if (printData.items) {
                    const catName = (printData.kategori === 'laporan' ? (appSettings.menuLaporan || 'Persembahan II') :
                                    printData.kategori === 'pelean' ? (appSettings.menuPelean || 'Persembahan Khusus') :
                                    (appSettings.menuAlaman || 'Literatur')).toUpperCase();
                    let catSum = 0;
                    printData.items.forEach((col: string) => catSum += (printData.details?.[col] || 0));
                    if (catSum > 0) {
                      rincianItems += `\n${catName} (Rp ${formatRupiah(catSum)}):`;
                      sortPaymentDetailsEntries(printData.kategori, printData.items.map((col: string) => [col, null])).forEach(([col]) => {
                        const val = printData.details?.[col] || 0;
                        if (val > 0) {
                          rincianItems += `\n* ${getFormattedPaymentName(printData.kategori, col)} : Rp ${formatRupiah(val)}`;
                        }
                      });
                    }
                  }

                  let waMessage = '';
                  const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                  const cleanPrintDataNama = printData?.nama ? printData.nama.replace(/^GKLI\s*/i, '') : '';
                  if (printType === 'global-arrears' || printType === 'tunggakan') {
                    waMessage = `Shalom Bapak/Ibu Majelis Jemaat *GKLI ${cleanPrintDataNama}* Resort *${printData?.resort}*, kami dari Kantor Pusat GKLI ingin mengingatkan terkait kewajiban persembahan yang belum kami terima (Tunggakan):\n${rincianItems}\n\nMohon kerja samanya untuk segera melengkapi setoran tersebut. Kiranya Tuhan Yesus memberkati.\n\nSalam dari Kantor Pusat GKLI,\n*Bendum GKLI*`;
                  } else {
                    waMessage = `Shalom Bapak/Ibu Majelis Jemaat *GKLI ${cleanPrintDataNama}* Resort *${printData?.resort}*, terima kasih telah mengirimkan persembahan ke Kantor Pusat, pada tanggal, ${todayStr} ke Rekening Kantor Pusat GKLI. Dengan rincian:\n${rincianItems}\n\n*TOTAL: Rp ${formatRupiah(printData?.total || printData?.jumlah || 0)}*\n\nDemikian kami sampaikan, Tuhan Yesus Kristus kepala Gereja memberkati kita.\n\nSalam dari Kantor Pusat GKLI,\n*Bendum GKLI*`;
                  }

                  window.open(`https://wa.me/${printData.wa.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(waMessage)}`, '_blank');
                  
                  if (printType === 'global-receipt' && printData.paymentIds && printData.paymentIds.length > 0) {
                    if (window.confirm("Apakah Anda ingin memindahkan data pembayaran ini ke arsip sekarang?")) {
                      await handleMarkPaymentsAsSent(printData.paymentIds);
                    }
                  }
                } catch (err) {
                  console.error(err);
                } finally {
                  btn.disabled = false;
                  btn.innerHTML = originalText;
                }
              }} 
              className="px-5 py-2.5 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
            >
              <Share2 size={18} /> Kirim WA
            </button>
            <button 
              onClick={() => window.print()} 
              className="px-5 py-2.5 bg-gold-600 rounded-xl font-bold hover:bg-gold-500 flex items-center gap-2 shadow-lg transition-all"
            >
              <Printer size={18} /> Cetak Sekarang
            </button>
            {printData.paymentIds && (
              <button 
                onClick={async (e) => {
                  const btn = e.currentTarget;
                  if (window.confirm("Pindahkan data ini ke menu Arsip?")) {
                    btn.disabled = true;
                    await handleMarkPaymentsAsSent(printData.paymentIds);
                    alert("Berhasil dipindahkan ke Arsip.");
                    setPrintType(null);
                  }
                }} 
                className="px-5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl font-bold hover:bg-slate-700 flex items-center gap-2 shadow-lg transition-all"
              >
                <Archive size={18} className="text-yellow-500" /> 
                <span className="text-yellow-500">Arsipkan Sekarang</span>
              </button>
            )}
          </div>
        </div>

        <div className="print-preview-container">
          <div id="printable-page" style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', paddingTop: '1.5cm', paddingBottom: '1.5cm', paddingLeft: '2cm', paddingRight: '2cm', color: 'black' }} ref={printRef}>
      <div className="print-section mt-0">
         {/* Header */}
         <div className="text-center mb-8 relative pt-0">
            {templates.kopSurat ? (
              <div className="border-b-[3px] border-black pb-4 text-center">
                <img src={templates.kopSurat} alt="Kop Surat" className="w-full max-w-4xl max-h-40 object-contain mx-auto" />
              </div>
            ) : (
              <div className="w-full border-b-[3px] border-black pb-4">
                <div className="flex items-center justify-between mb-2 gap-4">
                  <div className="w-32 h-32 flex items-center justify-center shrink-0 relative">
                     <div className="absolute inset-0 rounded-full border-[3px] border-blue-800 flex items-center justify-center bg-yellow-400 overflow-hidden shadow-sm">
                        <div className="w-20 h-20 rounded-full border-2 border-red-600 flex items-center justify-center bg-white">
                          <span className="text-2xl text-blue-800 font-serif font-black">GKLI</span>
                        </div>
                     </div>
                  </div>
                  <div className="flex-1 text-center font-serif leading-tight">
                     <h1 className="text-2xl md:text-[26px] font-medium uppercase tracking-widest text-black mb-1">KANTOR PUSAT</h1>
                     <h2 className="text-3xl md:text-[32px] font-bold text-blue-700 uppercase tracking-wider mb-1">GEREJA KRISTEN LUTHER INDONESIA</h2>
                     <h3 className="text-xl md:text-2xl italic text-red-600 font-bold mb-1">(INDONESIAN CHRISTIAN LUTHERAN CHURCH)</h3>
                     <p className="text-[12px] font-bold text-blue-800 tracking-wide mt-1">DIDIRIKAN: 18 MEI 1965, AKTE NOTARIS NOMOR 30</p>
                     <p className="text-[12px] font-bold text-blue-800 tracking-wide">S. K. DEP. AGAMA RI: Dp/II/137/1967, NOMOR 148 TAHUN 1988 TANGGAL 2-7-1988</p>
                  </div>
                  <div className="w-32 shrink-0"></div>
                </div>
                <div className="text-center font-serif text-[12px] leading-tight mb-2 tracking-wide text-black">
                  <p>Sihabonghabong, Kec. Parlilitan, Kab. Humbang Hasundutan, Prov. Sumatera Utara, 22456 e-mail : kpt_gkli@yahoo.com</p>
                  <p>Bank BNI KLN Doloksanggul, No. Rek. :0061254308-BRI Parlilitan Rek.7796-01-003362-53-4</p>
                </div>
                <div className="border-t-[3px] border-black pb-[1px]"></div>
                <div className="border-t-[1px] border-black pt-[3px] mb-6">
                   <p className="text-center text-red-600 font-bold text-[16px] tracking-wider transform scale-y-110">ANGGOTA PERSEKUTUAN GEREJA-GEREJA DI INDONESIA (PGI)</p>
                </div>
              </div>
            )}
           </div>
           
           {printType === 'rekap' ? (
             <div>
               <h3 className="text-center text-xl font-bold underline mb-4">REKAPITULASI {(CATEGORY_LABELS[printData.kategori] || printData.kategori).toUpperCase()}</h3>
               <p className="text-center mb-6">PERIODE: {periodeAktif}</p>
               <table className="w-full border-collapse border border-black text-sm">
                 <thead>
                   <tr className="bg-gray-100">
                     <th className="border border-black p-2">NO</th>
                     <th className="border border-black p-2">NAMA JEMAAT</th>
                     <th className="border border-black p-2">RESORT</th>
                     <th className="border border-black p-2">STATUS</th>
                     <th className="border border-black p-2">TOTAL (Rp)</th>
                   </tr>
                 </thead>
                 <tbody>
                   {getLaporanData(printData.kategori).map((item, idx) => (
                     <tr key={item.id}>
                       <td className="border border-black p-2 text-center">{idx + 1}</td>
                       <td className="border border-black p-2 font-bold">{item.nama}</td>
                       <td className="border border-black p-2">{item.resort}</td>
                       <td className="border border-black p-2 text-center">{item.status}</td>
                       <td className="border border-black p-2 text-right">{formatRupiah(item.jumlah)}</td>
                     </tr>
                   ))}
                 </tbody>
                </table>
              </div>
            ) : (printType === 'penerimaan' || printType === 'tunggakan' || printType === 'global-receipt' || printType === 'global-arrears' || printType === 'terimakasih') ? (
              <div className="space-y-6 text-[15px]">
                <div className="flex justify-between items-start leading-relaxed -mt-4 mb-4">
                  <div className="flex-1">
                    <table className="w-full text-left max-w-sm">
                      <tbody>
                        <tr><td className="w-16">Nomor</td><td className="w-4">:</td><td>{getNomorSurat(printData)}/{printType.includes('arrears') || printType === 'tunggakan' ? 'P.10' : 'E.12'}/{currentRomanMonth}/{currentYear}</td></tr>
                        <tr><td>Lamp</td><td>:</td><td>-</td></tr>
                        <tr><td>Hal</td><td>:</td><td><b>{printType.includes('arrears') || printType === 'tunggakan' ? 'Pemberitahuan Tunggakan Administrasi' : 'Ucapan Terimakasih'}</b></td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="text-left w-64 pt-0">
                    <p className="text-right mb-0">Sihabonghabong, {today}</p>
                    <div className="mt-6">
                      <p className="mb-0">Kepada, Yth.</p>
                      <p className="font-extrabold italic mb-0">Majelis Jemaat {printData.nama.startsWith('GKLI') ? '' : 'GKLI '}{printData.nama}</p>
                      <p className="mb-0">Resort {printData.resort}</p>
                    </div>
                  </div>
                </div>
                
                <div className="text-justify leading-relaxed">
                  <p>Salam sejahtera dalam Nama Tuhan Yesus Kristus!</p>
                  <br/>
                  <p>
                    {printType.includes('arrears') || printType === 'tunggakan'
                      ? `Berdasarkan catatan kas kami hingga tanggal ${today}, kami mendapati bahwa kewajiban administrasi periode ${printData.periode} dari Jemaat bapak/ibu hingga saat ini masih belum kami terima (menunggak) dengan rincian sebagai berikut:`
                      : `Terpujilah Allah Tuhan kita di dalam nama Yesus Kristus, sebagai kepala gereja, yang senantiasa menolong dan memberkati gereja-Nya.`
                    }
                  </p>
                  
                  {(!printType.includes('arrears') && printType !== 'tunggakan') && (
                    <p className="mt-4">
                      Melalui surat ini kami juga mengucapkan banyak terima kasih kepada bapak/ibu Majelis Jemaat/Resort yang telah setia memberikan persembahan ke Kantor Pusat, pada tanggal {today} telah diterima sebanyak <span className="font-bold">Rp. {formatRupiah(printData.total || printData.jumlah || 0)},-</span> <span className="font-bold italic">({terbilang(printData.total || printData.jumlah || 0).trim().replace(/\s+/g, ' ')} Rupiah)</span> dengan rincian, sebagai berikut:
                    </p>
                  )}
                </div>

                <div className="pl-8 pr-12 my-6">
                  {printType === 'global-arrears' ? (
                    <div className="space-y-4">
                      <p className="font-bold underline mb-2">❖ <u>Daftar Item Belum Terbayar:</u></p>
                      {Object.entries(printData.details || {}).map(([cat, fields]: [any, any]) => {
                        if (fields.length === 0) return null;
                        return (
                          <div key={cat} className="ml-4 mb-3">
                            <h4 className="font-bold text-[14px] uppercase mb-1">{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat}:</h4>
                            <ul className="list-disc pl-5 text-[15px]">
                              {fields.map((f: string) => (
                                <li key={f}>{f}</li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <table className="w-full border-collapse">
                      <tbody>
                        {printType === 'global-receipt' ? (
                          (() => {
                            let count = 0;
                            const sortedEntries = Object.entries(printData.updates || {}).sort(([catA], [catB]) => {
                              const order: Record<string, number> = { 'laporan': 1, 'pelean': 2, 'alaman': 3 };
                              return (order[catA] || 9) - (order[catB] || 9);
                            });

                            const monthOrder: Record<string, number> = {
                              'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'Mei': 5, 'Jun': 6,
                              'Jul': 7, 'Agu': 8, 'Agt': 8, 'Sep': 9, 'Okt': 10, 'Nov': 11, 'Des': 12
                            };

                            return sortedEntries.flatMap(([cat, fields]: [any, any]) => {
                              const sortedFields = [...fields].sort((a: string, b: string) => {
                                if (cat === 'laporan') {
                                  return (monthOrder[a] || 0) - (monthOrder[b] || 0);
                                }
                                return a.localeCompare(b);
                              });
                              
                              return sortedFields.map((f: string) => {
                                const val = printData.allDetails?.[cat]?.[f] || 0;
                                if (val <= 0) return null;
                                count++;
                                return (
                                  <tr key={cat+f}>
                                    <td className="w-5 align-top text-left text-sm">{count}.</td>
                                    <td className="text-[15px]">{getFormattedPaymentName(cat, f)}</td>
                                    <td className="w-12 text-left text-[15px]">Rp.</td>
                                    <td className="w-32 text-right text-[15px]">{formatRupiah(val)},-</td>
                                  </tr>
                                );
                              });
                            });
                          })()
                        ) : (
                          sortPaymentDetailsEntries(printData.kategori, (printData.items || []).map((col: string) => [col, null])).map(([col], idx) => {
                            const val = printData.details?.[col] || 0;
                            if (val <= 0) return null;
                            return (
                              <tr key={col}>
                                <td className="w-5 align-top text-left text-sm">{idx + 1}.</td>
                                <td className="text-[15px]">{getFormattedPaymentName(printData.kategori, col)}</td>
                                <td className="w-12 text-left text-[15px]">Rp.</td>
                                <td className="w-32 text-right text-[15px]">{formatRupiah(val)},-</td>
                               </tr>
                             );
                           })
                        )}
                        {(printType !== 'tunggakan' && printType !== 'global-arrears') && (
                          <tr className="border-t border-black">
                            <td className="font-bold pt-1 text-center tracking-widest uppercase">Jumlah</td>
                            <td></td>
                            <td className="font-bold pt-1 text-left text-[16px]">Rp.</td>
                            <td className="font-bold pt-1 text-right text-[16px] tracking-tight">{formatRupiah(printData.total || printData.jumlah || 0)},-</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
                
                <p className="text-justify leading-relaxed mt-4">
                  {printType.includes('arrears') || printType === 'tunggakan'
                    ? "Kami memohon kesediaan bapak/ibu Majelis Jemaat untuk dapat segera menyelesaikan kewajiban administrasi tersebut demi kelancaran pelayanan gereja kita bersama."
                    : "Demikianlah kami sampaikan, kiranya kasih setia Allah senantiasa memberkati setiap pelayanan kita, Tuhan memberkati dan menyertai kita."
                  }
                </p>
                
                <div className="flex justify-end mt-2 print:mt-2 relative w-full mb-12">
                  <div className="text-left w-72 relative z-10">
                    <p className="mb-0 text-[14px]">Teriring Salam dan Doa</p>
                    <p className="mb-0 leading-tight text-[14px]">Pucuk Pimpinan GKLI</p>
                    <p className="mb-0 leading-tight text-[14px]">A.n. Bishop</p>
                    <div className="relative h-4 my-1 pointer-events-none -ml-16">
                      {(printType.includes('arrears') || printType === 'tunggakan') ? (
                         templates.stempelTunggakan && (
                          <img 
                            src={templates.stempelTunggakan} 
                            alt="Stempel & Tanda Tangan" 
                            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-40 w-auto max-w-none object-contain mix-blend-multiply opacity-90 scale-125 pt-2"
                          />
                         )
                      ) : (
                        templates.stempelTerimaKasih && (
                          <img 
                            src={templates.stempelTerimaKasih} 
                            alt="Stempel & Tanda Tangan" 
                            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-40 w-auto max-w-none object-contain mix-blend-multiply opacity-90 scale-125 pt-2"
                          />
                        )
                      )}
                    </div>
                    <p className="font-bold underline text-center relative z-20 leading-tight text-[15px] mt-6">Pdt. Lamris Malau, M.Th.</p>
                    <p className="text-center relative z-20 leading-none text-[13px]">Sekretaris Jenderal</p>
                  </div>
                </div>
                
                {(!printType.includes('arrears') && printType !== 'tunggakan') && (
                  <div className="mt-16 text-sm leading-tight pb-8">
                    <p>Tembusan:</p>
                    <ol className="list-decimal pl-5">
                      <li>Kepada Bishop sebagai laporan.</li>
                      <li>Arsip</li>
                    </ol>
                  </div>
                )}

                <div className="fixed bottom-0 left-0 w-full text-center text-[8.5px] pb-4 leading-tight hidden print:block">
                  Bishop: Pdt. Jon Albert Saragih, M.Th. Hp. 081376987167 – Email: jon.albert98@yahoo.com – Sekjen: Pdt. Lamris Malau, M.Th. Hp. 085278577148 – Email: lamrismalau29@gmail.com
                </div>
              </div>
            ) : null}
        </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
      {/* MOBILE OVERLAY */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`w-64 bg-slate-900 text-white flex flex-col fixed h-full z-[100] shadow-2xl no-print border-r border-white/5 transition-transform duration-300 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex flex-col border-b border-white/5 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex justify-between items-center lg:block">
            <div className="flex items-center space-x-4 mb-0 lg:mb-2 group cursor-pointer">
              <div className="bg-emerald-600 p-1 rounded-full shadow-lg shadow-emerald-900/40 flex items-center justify-center w-14 h-14 flex-shrink-0 group-hover:scale-110 transition-transform border-4 border-slate-800">
                {appSettings.logoUrl ? (
                  <img src={appSettings.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <div className="bg-white rounded-full p-2">
                    <ShieldCheck size={24} className="text-emerald-600" />
                  </div>
                )}
              </div>
              <div className="overflow-hidden">
                <h1 className="text-lg font-extrabold leading-tight tracking-tight text-white group-hover:text-gold-400 transition-colors uppercase">Keuangan GKLI</h1>
                <div className="flex items-center space-x-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest truncate">
                    AUTHORIZED ADMIN
                  </p>
                </div>
              </div>
            </div>
            <button className="lg:hidden p-2 text-white/50 hover:text-white" onClick={() => setMobileSidebarOpen(false)}>
              <X size={24} />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          <NavItem active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setMobileSidebarOpen(false); }} icon={<LayoutDashboard size={20} />} label="Dashboard Ringkasan" />
          
          <NavHeader label={appSettings.menuMasterData} />
          <NavItem active={activeTab === 'gereja'} onClick={() => { setActiveTab('gereja'); setMobileSidebarOpen(false); }} icon={<Users size={20} />} label={appSettings.menuGereja} />
          <NavItem active={activeTab === 'periode'} onClick={() => { setActiveTab('periode'); setMobileSidebarOpen(false); }} icon={<Calendar size={20} />} label={appSettings.menuPeriode} />

          <NavHeader label={appSettings.menuPembayaran} />
          <NavItem active={activeTab === 'laporan'} onClick={() => { setActiveTab('laporan'); setMobileSidebarOpen(false); }} icon={<FileText size={20} />} label={appSettings.menuLaporan} />
          <NavItem active={activeTab === 'pelean'} onClick={() => { setActiveTab('pelean'); setMobileSidebarOpen(false); }} icon={<FileText size={20} />} label={appSettings.menuPelean} />
          <NavItem active={activeTab === 'alaman'} onClick={() => { setActiveTab('alaman'); setMobileSidebarOpen(false); }} icon={<FileText size={20} />} label={appSettings.menuAlaman} />
          <NavItem active={activeTab === 'distribusi'} onClick={() => { setActiveTab('distribusi'); setMobileSidebarOpen(false); }} icon={<Truck size={20} />} label="Distribusi Literatur" />

          <NavHeader label={appSettings.menuRekapJudul} />
          <NavItem active={activeTab === 'pengiriman'} onClick={() => { setActiveTab('pengiriman'); setMobileSidebarOpen(false); }} icon={<MessageCircle size={20} />} label="Pusat Terima Kasih" />
          <NavItem active={activeTab === 'arsip'} onClick={() => { setActiveTab('arsip'); setMobileSidebarOpen(false); }} icon={<Archive size={20} />} label="Arsip Tanda Terima" />
          <NavItem active={activeTab === 'penagihan'} onClick={() => { setActiveTab('penagihan'); setMobileSidebarOpen(false); }} icon={<AlertTriangle size={20} />} label="Pusat Penagihan" />
          <NavItem active={activeTab === 'sertifikat'} onClick={() => { setActiveTab('sertifikat'); setMobileSidebarOpen(false); }} icon={<Award size={20} />} label="Apresiasi Jemaat" />
          <NavItem active={activeTab === 'download'} onClick={() => { setActiveTab('download'); setMobileSidebarOpen(false); }} icon={<Download size={20} />} label={appSettings.menuDownloadMenu} />

          {currentUserProfile?.role === 'superadmin' && (
            <>
              <NavHeader label="Pengaturan Sistem" />
              <NavItem active={activeTab === 'templates'} onClick={() => { setActiveTab('templates'); setMobileSidebarOpen(false); }} icon={<FileText size={20} className="text-yellow-500" />} label="Manajemen Template" className="text-yellow-500" />
              <NavItem active={false} onClick={() => { setFormSettings(appSettings); setShowSettingsModal(true); setMobileSidebarOpen(false); }} icon={<Settings size={20} className="text-yellow-500" />} label="Edit Tampilan" className="text-yellow-500" />
              <NavItem active={activeTab === 'akun'} onClick={() => { setActiveTab('akun'); setMobileSidebarOpen(false); }} icon={<UserPlus size={20} className="text-yellow-500" />} label="Manajemen Akun" className="text-yellow-500" />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          {currentUserProfile ? (
            <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-red-400 hover:bg-slate-800 transition-colors">
              <LogOut size={20} />
              <span className="text-sm font-semibold">Keluar ({currentUserProfile.role})</span>
            </button>
          ) : (
            <button onClick={() => setShowLoginModal(true)} className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-green-400 hover:bg-slate-800 transition-colors bg-slate-800/50">
              <LogIn size={20} />
              <span className="text-sm font-semibold">Login Admin</span>
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 lg:ml-64 min-h-screen flex flex-col w-full overflow-hidden">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 py-4 flex justify-between items-center sticky top-0 z-10 no-print">
          <div className="flex items-center space-x-3 lg:space-x-6">
            <button 
              className="lg:hidden p-2 text-slate-800 hover:bg-slate-100 rounded-lg"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <div className="flex flex-col">
              <h2 className="judul-h2 uppercase !text-sm lg:!text-xl truncate max-w-[150px] lg:max-w-none">{activeTab.toUpperCase()}</h2>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <div className="w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full bg-gold-500 animate-pulse"></div>
                <p className="text-[7px] lg:text-[9px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">Online</p>
              </div>
            </div>
            <div className="hidden lg:block h-8 w-px bg-slate-200"></div>
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
              <HeaderDownloadBtn onClick={() => handleDownloadCurrentMenu('excel')} icon={<Download size={14} />} label="Excel" color="text-green-600" />
              {currentUserProfile?.role === 'superadmin' && (
                <HeaderDownloadBtn onClick={() => handleDownloadCurrentMenu('word')} icon={<FileText size={14} />} label="Word" color="text-gold-600" />
              )}
              <HeaderDownloadBtn onClick={() => handleDownloadCurrentMenu('pdf')} icon={<Printer size={14} />} label="PDF" color="text-red-600" />
            </div>
          </div>
          <div className="flex items-center space-x-2 lg:space-x-4">
            {currentUserProfile?.role === 'superadmin' && (
              <div className="hidden lg:flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 lg:px-3 py-1 lg:py-1.5 shadow-sm">
                <span className="text-[10px] lg:text-xs text-slate-500 font-bold mr-2 uppercase">Tema:</span>
                <select 
                  value={appSettings.theme || 'default'} 
                  onChange={(e) => handleThemeChange(e.target.value)}
                  className="bg-transparent text-[10px] lg:text-sm font-bold text-indigo-600 outline-none cursor-pointer"
                >
                  <option value="default">Default Emas</option>
                  <option value="ocean">Samudra Biru</option>
                  <option value="nature">Alam Hijau</option>
                  <option value="monochrome">Monokrom</option>
                </select>
              </div>
            )}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 lg:px-3 py-1 lg:py-1.5">
              <span className="hidden sm:inline text-[10px] lg:text-xs text-slate-500 font-bold mr-2 uppercase">Periode:</span>
              <select 
                value={periodeAktif} 
                onChange={async (e) => {
                  const val = e.target.value;
                  setPeriodeAktif(val);
                  if (currentUserProfile?.role === 'superadmin') {
                    const updatedSettings = { ...appSettings, periodeAktif: val };
                    setAppSettings(updatedSettings);
                    await setDoc(doc(db, 'settings', 'config'), updatedSettings);
                  }
                }}
                className="bg-transparent text-[10px] lg:text-sm font-bold text-gold-700 outline-none cursor-pointer"
              >
                {periods.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </header>

        <div className="p-8 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'pengiriman' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="judul-h3">Pusat Terima Kasih & Konfirmasi</h3>
                        <p className="subjudul mt-1">Kirim ucapan terima kasih untuk setoran yang sudah masuk pada periode {periodeAktif}.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {[...churches]
                        .sort((a, b) => (a.nama || '').localeCompare(b.nama || ''))
                        .map(church => {
                        const aliases = churchAliasesMap[church.id] || [church.id];
                        const pendingPayments = payments.filter(p => aliases.includes(p.gerejaId) && normalizePeriode(p.periode) === normalizePeriode(periodeAktif) && p.jumlah > 0 && !p.receiptSent);
                        if (pendingPayments.length === 0) return null;

                        const totalJumlah = pendingPayments.reduce((sum, p) => sum + p.jumlah, 0);

                        return (
                          <div key={church.id} className="border border-green-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow bg-green-50/10">
                            <div className="bg-green-50 p-4 border-b border-green-100 flex justify-between items-center">
                              <div>
                                <h4 className="font-bold text-slate-800">
                                  {church.type === 'resort' && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded mr-2 align-middle uppercase tracking-tighter">Resort</span>}
                                  {church.nama}
                                </h4>
                                <p className="text-[10px] text-slate-500">Resort {church.resort}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                                  Siap Kirim
                                </div>
                                {currentUserProfile?.role === 'superadmin' && (
                                  <button 
                                    onClick={async () => {
                                      if (window.confirm(`Hapus SEMUA data setoran ini untuk ${church.nama}? Data akan terhapus dari log terima kasih.`)) {
                                        try {
                                          for (const p of pendingPayments) {
                                            await deleteDoc(doc(db, 'payments', p.id));
                                          }
                                        } catch (err: any) {
                                          alert("Error: " + err.message);
                                        }
                                      }
                                    }}
                                    className="bg-red-50 text-red-500 p-1.5 rounded-full hover:bg-red-100 transition-colors border border-red-100"
                                    title="Hapus Data Ini"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="p-4 flex flex-col md:flex-row gap-4">
                              <div className="flex-1 bg-white p-3 rounded-lg border border-green-50">
                                <div className="space-y-4">
                                  {pendingPayments.map(p => (
                                    <div key={p.id}>
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-slate-700 text-sm">{(CATEGORY_LABELS[p.kategori as keyof typeof CATEGORY_LABELS] || p.kategori).toUpperCase()}</span>
                                        <span className="angka-keuangan text-green-600 text-sm">Rp {formatRupiah(p.jumlah)}</span>
                                      </div>
                                      <div className="pl-4 space-y-1 mt-2">
                                        {sortPaymentDetailsEntries(p.kategori, Object.entries(p.details || {})).map(([key, val]) => (
                                          (val as number) > 0 && (
                                            <div key={key} className="flex justify-between text-slate-500 text-xs">
                                              <span>- {getFormattedPaymentName(p.kategori, key)}</span>
                                              <span>Rp {formatRupiah(val as number)}</span>
                                            </div>
                                          )
                                        ))}
                                      </div>
                                      {(p.buktiTransfer || p.buktiTransferBase64) && (
                                        <div className="mt-3 ml-4 p-2 bg-slate-50 border border-slate-200 rounded text-[10px]">
                                          {p.buktiTransfer && <p className="text-slate-600 font-medium whitespace-pre-wrap"><span className="font-bold">Catatan:</span> {p.buktiTransfer}</p>}
                                          {p.buktiTransferBase64 && (
                                            <button 
                                              onClick={() => {
                                                const w = window.open("");
                                                w?.document.write(`<html><body style="margin:0;display:flex;justify-content:center;background:#000;"><img src="${p.buktiTransferBase64}" style="max-height:100vh;max-width:100vw;object-fit:contain;"/></body></html>`);
                                              }}
                                              className="mt-2 text-indigo-600 font-bold underline hover:text-indigo-800"
                                            >
                                              Lihat Lampiran Gambar Transfer
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="flex flex-col justify-center space-y-2 min-w-[200px]">
                                <button 
                                  onClick={async () => {
                                    let rincian = '';
                                    pendingPayments.forEach(p => {
                                      const catName = (p.kategori === 'laporan' ? (appSettings.menuLaporan || 'Persembahan II') :
                                                      p.kategori === 'pelean' ? (appSettings.menuPelean || 'Persembahan Khusus') :
                                                      (appSettings.menuAlaman || 'Literatur')).toUpperCase();
                                      let catSum = 0;
                                      Object.values(p.details || {}).forEach(val => catSum += ((val as number) || 0));
                                      if (catSum > 0) {
                                        rincian += `\n${catName} (Rp ${formatRupiah(catSum)}):`;
                                        sortPaymentDetailsEntries(p.kategori, Object.entries(p.details || {})).forEach(([key, val]) => {
                                          if ((val as number) > 0) {
                                            rincian += `\n* ${getFormattedPaymentName(p.kategori, key)} : Rp ${formatRupiah(val as number)}`;
                                          }
                                        });
                                      }
                                    });
                                    
                                    const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                                    const cleanChurchNama = church.nama ? church.nama.replace(/^GKLI\s*/i, '') : '';
                                    const text = `Shalom Bapak/Ibu Majelis Jemaat *GKLI ${cleanChurchNama}* Resort *${church.resort}*, terima kasih telah mengirimkan persembahan ke Kantor Pusat, pada tanggal, ${todayStr} ke Rekening Kantor Pusat GKLI. Dengan rincian:\n${rincian}\n\n*TOTAL: Rp ${formatRupiah(totalJumlah)}*\n\nDemikian kami sampaikan, Tuhan Yesus Kristus kepala Gereja memberkati kita.\n\nSalam dari Kantor Pusat GKLI,\nBendum,\n\n\n*Pdt. Jeprianto Marbun, S.Th*`;
                                    
                                    if (church.wa) {
                                      window.open(`https://wa.me/${church.wa.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                                    } else {
                                      alert(`Nomor WhatsApp untuk jemaat ${church.nama} belum tersedia.`);
                                    }
                                    
                                    if (window.confirm("Apakah Anda ingin memindahkan data ini ke arsip?")) {
                                      await handleMarkPaymentsAsSent(pendingPayments.map(p => p.id));
                                    }
                                  }}
                                  className="flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
                                >
                                  <MessageCircle size={16} /> <span>Kirim & Arsipkan</span>
                                </button>
                                <button 
                                  onClick={async () => {
                                    setPrintData({
                                      ...church,
                                      periode: periodeAktif,
                                      kategori: "Gabungan",
                                      jumlah: totalJumlah,
                                      total: totalJumlah,
                                      allDetails: pendingPayments.reduce((acc, p) => ({ ...acc, [p.kategori]: p.details }), {}),
                                      updates: pendingPayments.reduce((acc, p) => ({ ...acc, [p.kategori]: Object.keys(p.details) }), {}),
                                      paymentIds: pendingPayments.map(p => p.id) 
                                    });
                                    setPrintType('global-receipt');
                                  }}
                                  className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-black hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                                >
                                  <Printer size={16} /> <span>Cetak & Pindahkan</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'arsip' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="judul-h3">Arsip Tanda Terima</h3>
                        <p className="subjudul mt-1">Daftar ucapan terima kasih yang sudah dikirim atau dipindahkan ke arsip pada periode {periodeAktif}.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {[...churches]
                        .sort((a, b) => (a.nama || '').localeCompare(b.nama || ''))
                        .map(church => {
                        const aliases = churchAliasesMap[church.id] || [church.id];
                        const sentPayments = payments.filter(p => aliases.includes(p.gerejaId) && normalizePeriode(p.periode) === normalizePeriode(periodeAktif) && p.jumlah > 0 && p.receiptSent);
                        if (sentPayments.length === 0) return null;

                        return (
                          <div key={church.id} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow bg-slate-50">
                            <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
                              <div>
                                <h4 className="font-bold text-slate-800">
                                  {church.type === 'resort' && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded mr-2 align-middle uppercase tracking-tighter">Resort</span>}
                                  {church.nama}
                                </h4>
                                <p className="text-xs text-slate-500">Resort {church.resort}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
                                  <Archive size={10} /> Terarsip
                                </div>
                                {currentUserProfile?.role === 'superadmin' && (
                                  <button 
                                    onClick={async () => {
                                      if (window.confirm(`Hapus SEMUA data di arsip untuk ${church.nama}? Data akan dihapus permanen dari sistem.`)) {
                                        try {
                                          for (const p of sentPayments) {
                                            await deleteDoc(doc(db, 'payments', p.id));
                                          }
                                        } catch (err: any) {
                                          alert("Error: " + err.message);
                                        }
                                      }
                                    }}
                                    className="bg-red-50 text-red-500 p-1.5 rounded-full hover:bg-red-100 transition-colors border border-red-100"
                                    title="Hapus Semua Data Arsip Ini"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="p-4 flex flex-col md:flex-row gap-4">
                              <div className="flex-1 bg-white p-3 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Histori Setoran:</p>
                                <div className="space-y-2">
                                  {sentPayments.map(p => (
                                    <div key={p.id} className="text-xs border-b border-slate-50 pb-2 mb-2 last:border-0 last:mb-0 last:pb-0">
                                      <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center space-x-2">
                                          <span className="font-bold text-slate-700">{(CATEGORY_LABELS[p.kategori as keyof typeof CATEGORY_LABELS] || p.kategori).toUpperCase()}</span>
                                          <button onClick={() => handleDeletePayment(p.id)} className="text-red-400 hover:text-red-600 transition-colors p-0.5 rounded" title="Hapus Data">
                                            <Trash2 size={12} />
                                          </button>
                                          {p.buktiTransferBase64 && (
                                            <button 
                                              onClick={() => {
                                                const w = window.open("");
                                                w?.document.write(`<html><body style="margin:0;display:flex;justify-content:center;background:#000;"><img src="${p.buktiTransferBase64}" style="max-height:100vh;max-width:100vw;object-fit:contain;"/></body></html>`);
                                              }}
                                              className="text-indigo-500 hover:text-indigo-700 font-bold ml-2 underline text-[9px]"
                                            >
                                              Lihat Lampiran
                                            </button>
                                          )}
                                        </div>
                                        <span className="text-slate-500 italic text-[10px] ml-2">Dikirim: {p.receiptSentAt ? new Date(p.receiptSentAt).toLocaleDateString('id-ID') : '-'}</span>
                                        <span className="text-green-600 font-bold ml-auto">Rp {formatRupiah(p.jumlah)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="flex flex-col justify-center space-y-2 min-w-[200px]">
                                <button 
                                  onClick={() => {
                                    const total = sentPayments.reduce((sum, p) => sum + p.jumlah, 0);
                                    let rincian = "";
                                    sentPayments.forEach(p => {
                                      const catName = (p.kategori === 'laporan' ? (appSettings.menuLaporan || 'Persembahan II') :
                                                      p.kategori === 'pelean' ? (appSettings.menuPelean || 'Persembahan Khusus') :
                                                      (appSettings.menuAlaman || 'Literatur')).toUpperCase();
                                      let catSum = 0;
                                      Object.values(p.details || {}).forEach(val => catSum += ((val as number) || 0));
                                      if (catSum > 0) {
                                        rincian += `\n${catName} (Rp ${formatRupiah(catSum)}):`;
                                        sortPaymentDetailsEntries(p.kategori, Object.entries(p.details || {})).forEach(([key, val]) => {
                                          if ((val as number) > 0) {
                                            rincian += `\n* ${getFormattedPaymentName(p.kategori, key)} : Rp ${formatRupiah(val as number)}`;
                                          }
                                        });
                                      }
                                    });
                                    
                                    const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                                    const cleanChurchNama = church.nama ? church.nama.replace(/^GKLI\s*/i, '') : '';
                                    const text = `Shalom Bapak/Ibu Majelis Jemaat *GKLI ${cleanChurchNama}* Resort *${church.resort}*, terima kasih telah mengirimkan persembahan ke Kantor Pusat, pada tanggal, ${todayStr} ke Rekening Kantor Pusat GKLI. Dengan rincian:\n${rincian}\n\n*TOTAL: Rp ${formatRupiah(total)}*\n\nDemikian kami sampaikan, Tuhan Yesus Kristus kepala Gereja memberkati kita.\n\nSalam dari Kantor Pusat GKLI,\nBendum,\n\n\n*Pdt. Jeprianto Marbun, S.Th*`;
                                    if (church.wa) {
                                      window.open(`https://wa.me/${church.wa.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                                    } else {
                                      alert(`Nomor WhatsApp untuk jemaat ${church.nama} belum tersedia.`);
                                    }
                                  }}
                                  className="flex items-center justify-center space-x-2 bg-slate-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-700 transition-colors"
                                >
                                  <MessageCircle size={16} /> <span>Kirim Ulang WA</span>
                                </button>
                                <button 
                                  onClick={() => {
                                    const latest = sentPayments[0];
                                    const totalAmount = sentPayments.reduce((sum, p) => sum + p.jumlah, 0);
                                    setPrintData({
                                      ...church,
                                      periode: periodeAktif,
                                      kategori: latest.kategori,
                                      jumlah: latest.jumlah,
                                      total: totalAmount,
                                      allDetails: sentPayments.reduce((acc, p) => ({ ...acc, [p.kategori]: p.details }), {}),
                                      updates: sentPayments.reduce((acc, p) => ({ ...acc, [p.kategori]: Object.keys(p.details) }), {})
                                    });
                                    setPrintType('global-receipt');
                                  }}
                                  className="flex items-center justify-center space-x-2 bg-amber-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-amber-700 transition-colors"
                                >
                                  <Printer size={16} /> <span>Lihat/Download Ulang</span>
                                </button>
                                <button 
                                  onClick={async () => {
                                    if (window.confirm("Keluarkan dari arsip? Data akan kembali ke menu 'Pusat Terima Kasih'.")) {
                                      try {
                                        for (const p of sentPayments) {
                                          await updateDoc(doc(db, 'payments', p.id), { 
                                            receiptSent: false,
                                            receiptSentAt: null
                                          });
                                        }
                                      } catch (err) {
                                        console.error(err);
                                      }
                                    }
                                  }}
                                  className="text-[10px] text-slate-400 hover:text-red-500 transition-colors font-bold uppercase mt-1 text-center"
                                >
                                  Kembalikan ke Pending
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'penagihan' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="font-bold text-lg">Pusat Penagihan Tunggakan</h3>
                        <p className="text-sm text-slate-500">Daftar jemaat yang memiliki tunggakan (belum lunas) pada periode {periodeAktif}. Anda dapat memilih item mana yang ingin ditagih.</p>
                      </div>
                      <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-700 min-w-[300px]">
                        <div className="flex items-center justify-between mb-2">
                           <h4 className="text-xs font-bold text-green-400 uppercase tracking-widest flex items-center">
                              <Calendar size={14} className="mr-1" /> Penagihan Otomatis
                           </h4>
                           <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs">AKTIF</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mb-3 leading-tight">
                           Sistem akan mengirim pesan WA penagihan otomatis setiap tanggal <b>15</b> & <b>30</b> jam 09:00 WIB melalui Watzap.id.
                        </p>
                        <button 
                           onClick={async () => {
                              if (!appSettings.watzapApiKey) return alert("Mohon konfigurasi API Key Watzap di Pengaturan terlebih dahulu.");
                              if (window.confirm("Kirim tagihan ke seluruh jemaat yang menunggak sekarang?")) {
                                 try {
                                    const res = await fetch('/api/cron/trigger', { method: 'POST' });
                                    const data = await res.json();
                                    alert(data.message || "Proses dimulai di latar belakang.");
                                 } catch (err) {
                                    alert("Gagal memicu penagihan otomatis.");
                                 }
                              }
                           }}
                           className="w-full bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-2"
                        >
                           <Share2 size={12} /> Jalankan Penagihan Sekarang
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {churchesWithArrears.map(church => {
                        const summaryLines: string[] = [];
                        Object.entries(church.activeArrears).forEach(([cat, fields]) => {
                          const f = fields as string[];
                          if (f.length > 0) {
                            const catName = (cat === 'laporan' ? (appSettings.menuLaporan || 'Persembahan II') :
                                            cat === 'pelean' ? (appSettings.menuPelean || 'Persembahan Khusus') :
                                            (appSettings.menuAlaman || 'Literatur')).toUpperCase();
                            summaryLines.push(`*${catName}*:`);
                            f.forEach(item => {
                              summaryLines.push(`* ${item}`);
                            });
                          }
                        });

                        return (
                          <div key={church.id} className="border border-red-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow bg-red-50/5">
                            <div className="bg-red-50 p-4 border-b border-red-100 flex justify-between items-center">
                              <div>
                                <h4 className="font-bold text-slate-800">{church.nama}</h4>
                                <p className="text-xs text-slate-500">Resort {church.resort}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {!church.hasActive && <span className="text-[10px] text-red-500 italic font-bold">Item Tagihan Kosong</span>}
                                <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                                  Tunggakan Terdeteksi
                                </div>
                              </div>
                            </div>
                            <div className="p-4 flex flex-col lg:flex-row gap-6">
                              <div className="flex-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                                  <span>Pilih Item Untuk Ditagih:</span>
                                  <span className="text-slate-300 normal-case font-normal">(Centang yang ingin dimasukkan ke pesan WA)</span>
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {Object.entries(church.allPotentialArrears).map(([cat, fields]) => (
                                    <div key={cat} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                      <h5 className="text-[11px] font-bold text-slate-800 border-b border-slate-50 pb-1 mb-2">{(CATEGORY_LABELS[cat] || cat).toUpperCase()}</h5>
                                      <div className="flex flex-wrap gap-2">
                                        {(fields as string[]).map(field => {
                                          const isSelected = church.activeArrears[cat]?.includes(field);
                                          return (
                                            <button
                                              key={field}
                                              onClick={() => {
                                                setBillingSelections(prev => {
                                                  const churchSels = prev[church.id] ? { ...prev[church.id] } : {};
                                                  const catSels = [...(churchSels[cat] || [])];
                                                  if (isSelected) {
                                                    churchSels[cat] = catSels.filter(f => f !== field);
                                                  } else {
                                                    churchSels[cat] = [...catSels, field];
                                                  }
                                                  return { ...prev, [church.id]: churchSels };
                                                });
                                              }}
                                              className={`text-[10px] px-2 py-1 rounded-md border transition-all flex items-center gap-1.5 ${
                                                isSelected 
                                                ? 'bg-red-600 border-red-600 text-white font-bold shadow-sm' 
                                                : 'bg-white border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-500'
                                              }`}
                                            >
                                              <div className={`w-2.5 h-2.5 rounded-sm border flex items-center justify-center ${isSelected ? 'bg-white border-white' : 'bg-slate-50 border-slate-300'}`}>
                                                {isSelected && <div className="w-1.5 h-1.5 bg-red-600 rounded-px" />}
                                              </div>
                                              {field}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              <div className="flex flex-col justify-center space-y-3 min-w-[200px] border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                   <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Status Penagihan:</p>
                                   <p className="text-[11px] text-slate-700">
                                      {summaryLines.length > 0 ? `${summaryLines.length} kategori dipilih` : 'Belum ada item dipilih'}
                                   </p>
                                </div>
                                <button 
                                  disabled={!church.hasActive}
                                  onClick={() => {
                                    const cleanChurchNama = church.nama ? church.nama.replace(/^GKLI\s*/i, '') : '';
                                    const text = `Shalom Bapak/Ibu Majelis Jemaat *GKLI ${cleanChurchNama}* Resort *${church.resort}*, kami dari Kantor Pusat GKLI ingin mengingatkan terkait kewajiban persembahan periode ${periodeAktif} yang belum kami terima (Tunggakan):\n\n${summaryLines.join('\n')}\n\nMohon kerja samanya untuk segera melengkapi setoran tersebut. Kiranya Tuhan Yesus memberkati.\n\nSalam dari Kantor Pusat GKLI,\nBendum,\n\n\n*Pdt. Jeprianto Marbun, S.Th*`;
                                    if (church.wa) {
                                      window.open(`https://wa.me/${church.wa.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                                    } else {
                                      alert(`Nomor WhatsApp untuk jemaat ${church.nama} belum tersedia.`);
                                    }
                                  }}
                                  className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-lg ${
                                    church.hasActive 
                                    ? 'bg-green-600 text-white hover:bg-green-700 hover:scale-[1.02] shadow-green-500/20' 
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                  }`}
                                >
                                  <MessageCircle size={18} /> <span>Tagih via WA</span>
                                </button>
                                <button 
                                  onClick={() => {
                                    setPrintData({
                                      nama: church.nama,
                                      resort: church.resort,
                                      periode: periodeAktif,
                                      kategori: 'Gabungan',
                                      details: church.activeArrears,
                                      total: 0
                                    });
                                    setPrintType('global-arrears');
                                  }}
                                  className="flex items-center justify-center space-x-2 bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
                                >
                                  <Printer size={16} /> <span>Cetak Surat</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center no-print">
                    <div className="flex flex-wrap gap-4 items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200 pr-4">Filter Dashboard:</span>
                      <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                        <span className="text-[9px] font-bold text-gold-600 uppercase">Resort</span>
                        <select value={filterResort} onChange={(e) => setFilterResort(e.target.value)} className="bg-transparent text-[11px] font-bold text-slate-700 outline-none">
                          {uniqueResorts.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                        <span className="text-[9px] font-bold text-gold-600 uppercase">Wilayah</span>
                        <select value={filterWilayah} onChange={(e) => setFilterWilayah(e.target.value)} className="bg-transparent text-[11px] font-bold text-slate-700 outline-none">
                          {uniqueWilayah.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        const baseUrl = window.location.origin + window.location.pathname;
                        const url = `${baseUrl}?f=s`;
                        navigator.clipboard.writeText(url);
                        alert(`Link Formulir Jemaat disalin ke clipboard:\n\n${url}\n\nKirimkan link ini ke jemaat untuk melakukan penyetoran langsung.`);
                      }}
                      className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-bold text-xs hover:bg-indigo-100 transition-colors border border-indigo-200"
                    >
                      <Share2 size={14} /> Salin Link Form Jemaat
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard 
                      title="Total Arus Kas" 
                      value={`Rp ${formatRupiah(totalPemasukan)}`} 
                      icon={<TrendingUp size={24} />} 
                      color="gold" 
                      subtitle={periodeAktif}
                    />
                    <StatCard 
                      title="Laporan (Persembahan II)" 
                      value={`Rp ${formatRupiah(pemasukanLaporan)}`} 
                      icon={<FileText size={24} />} 
                      color="emerald" 
                      subtitle="PEMASUKAN LAPORAN"
                    />
                     <StatCard 
                      title="Pelean (Persembahan Khusus)" 
                      value={`Rp ${formatRupiah(pemasukanPelean)}`} 
                      icon={<Award size={24} />} 
                      color="blue" 
                      subtitle="PEMASUKAN KHUSUS"
                    />
                    <StatCard 
                      title="Alaman (Literatur)" 
                      value={`Rp ${formatRupiah(pemasukanAlaman)}`} 
                      icon={<BookOpen size={24} />} 
                      color="indigo" 
                      subtitle="PEMASUKAN LITERATUR"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <StatCard 
                      title="Data Terverifikasi" 
                      value={`${formatRupiah(stats.totalLunas)}`} 
                      icon={<CheckCircle2 size={24} />} 
                      color="gold" 
                      subtitle="LUNAS"
                    />
                     <StatCard 
                      title="Distribusi Literatur" 
                      value={`${formatRupiah(stats.totalDistribusiItems)}`} 
                      icon={<Package size={24} />} 
                      color="gold" 
                      subtitle="TOTAL UNIT"
                    />
                    <StatCard 
                      title="Antrean Tunggakan" 
                      value={`${formatRupiah(stats.totalMenunggak)}`} 
                      icon={<AlertCircle size={24} />} 
                      color="red" 
                      subtitle="ACTION REQUIRED"
                    />
                  </div>


                  
                  <div className="bg-gold-50 border border-gold-200 rounded-xl p-6 flex items-start space-x-4">
                    <div className="bg-gold-100 p-3 rounded-full">
                      <AlertTriangle className="text-gold-600" size={24} />
                    </div>
                    <div>
                      <h3 className="judul-h2 text-gold-800 mb-1">
                        {currentUserProfile ? `Akses ${currentUserProfile.role === 'superadmin' ? 'Admin' : 'Staf'} Aktif` : "Akses Terbatas (Tamu)"}
                      </h3>
                      <p className="subjudul !text-gold-700 leading-relaxed">
                        {currentUserProfile 
                          ? `Anda masuk sebagai ${currentUserProfile.role === 'superadmin' ? 'Administrator Utama' : 'Staf Pengisi Data'}. Anda dapat mengelola data keuangan dan jemaat secara real-time.`
                          : "Silakan login untuk mendapatkan akses penuh dalam mengelola data keuangan dan administrasi GKLI."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'sertifikat' && (
                <div className="space-y-8">
                  <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-8 text-white shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gold-600/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-600/10 rounded-full blur-3xl -ml-32 -mb-32"></div>
                    
                    <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center space-x-6">
                        <div className="bg-gradient-to-br from-gold-300 to-gold-600 p-4 rounded-2xl shadow-xl shadow-gold-500/20">
                          <Award size={40} className="text-white" />
                        </div>
                        <div>
                          <h2 className="judul-h1 text-white uppercase tracking-tighter">Prestasi Administrasi</h2>
                          <p className="text-slate-400 font-medium text-sm lg:text-base">Penghargaan untuk Jemaat dengan kedisiplinan setoran 100% pada periode {periodeAktif}</p>
                        </div>
                      </div>
                      <div className="hidden lg:block text-right">
                        <p className="text-4xl font-black text-white/10 italic">GKLI PRESTIGE</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                      <h3 className="judul-h3">Jemaat Berprestasi (Lunas Seluruhnya)</h3>
                    </div>
                    <div className="p-6">
                      {lunasChurches.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Award size={32} className="text-slate-300" />
                          </div>
                          <p className="text-slate-500">Belum ada jemaat yang lunas seluruhnya untuk periode ini.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {lunasChurches.map(church => (
                            <div key={church.id} className="border border-slate-200 rounded-xl p-5 hover:border-yellow-400 hover:shadow-md transition-all group">
                              <div className="flex justify-between items-start mb-4">
                                <div className="bg-yellow-50 p-2 rounded-lg text-yellow-600">
                                  <Award size={24} />
                                </div>
                                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Lunas 100%</span>
                              </div>
                              <h4 className="font-bold text-slate-800 mb-1">{church.nama}</h4>
                              <p className="text-xs text-slate-500 mb-4">Resort {church.resort}</p>
                              <button 
                                onClick={() => {
                                  setPrintData({ ...church, periode: periodeAktif });
                                  setPrintType('sertifikat');
                                }}
                                className="w-full flex items-center justify-center space-x-2 bg-slate-900 text-white py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors"
                              >
                                <Printer size={16} />
                                <span>Cetak Sertifikat</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'gereja' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                      <h3 className="font-bold text-lg">Daftar Jemaat</h3>
                      <div className="flex flex-wrap items-center gap-3">
                        {currentUserProfile && (
                          <div className="flex gap-2">
                             {currentUserProfile.role === 'superadmin' && (
                              <div className="flex gap-2">
                                <button 
                                  onClick={handlePullMasterData} 
                                  className="flex items-center space-x-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors shadow-lg shadow-slate-500/10"
                                  title="Tarik data jemaat yang sudah saya sediakan sebelumnya"
                                >
                                  <Database size={16} /> <span>Tarik Master</span>
                                </button>
                                <button 
                                  onClick={handleGenerateResortEntities} 
                                  className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/10"
                                  title="Membuat entitas pembayaran khusus untuk tiap resort"
                                >
                                  <Users size={16} /> <span>Resort Otomatis</span>
                                </button>
                              </div>
                            )}
                            <button onClick={() => setShowBulkModal(true)} className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/10">
                              <Plus size={16} /> <span>Import</span>
                            </button>
                            <button onClick={() => { setFormChurch({ id: '', nama: '', resort: '', wilayah: '', wa: '', order: churches.length + 1, type: 'jemaat' }); setShowChurchModal(true); }} className="flex items-center space-x-2 bg-gold-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gold-700 transition-colors shadow-lg shadow-gold-500/10">
                              <Plus size={16} /> <span>Tambah</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Sort:</span>
                        <select value={sortType} onChange={(e) => setSortType(e.target.value as any)} className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full">
                          <option value="order">Posisi</option>
                          <option value="nama">Nama (A-Z)</option>
                          <option value="resort">Resort</option>
                          <option value="wilayah">Wilayah</option>
                          <option value="pos_pi">Pos PI</option>
                        </select>
                      </div>
                      <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Resort:</span>
                        <select value={filterResort} onChange={(e) => setFilterResort(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full">
                          {uniqueResorts.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Wil:</span>
                        <select value={filterWilayah} onChange={(e) => setFilterWilayah(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full">
                          {uniqueWilayah.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2 md:col-span-1 flex items-center justify-center space-x-2 bg-gold-50 text-gold-700 border border-gold-200 rounded-lg px-3 py-2 text-[10px] font-bold">
                        TOTAL: {formatRupiah(sortedChurches.length)} 
                      </div>
                    </div>

                    {/* SEARCH BAR */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="Cari nama jemaat atau resort..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gold-500 focus:bg-white transition-all"
                      />
                      {searchTerm && (
                        <button 
                          onClick={() => setSearchTerm('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-50 border-b border-slate-100">
                    <StatCard 
                      title="Jumlah Resort" 
                      value={`${uniqueResorts.length > 1 ? uniqueResorts.length - 1 : 0}`} 
                      icon={<Building size={16} />} 
                      color="blue" 
                    />
                    <StatCard 
                      title="Jumlah Wilayah" 
                      value={`${uniqueWilayah.length > 1 ? uniqueWilayah.length - 1 : 0}`} 
                      icon={<MapPin size={16} />} 
                      color="indigo" 
                    />
                    <StatCard 
                      title="Jumlah Pos PI" 
                      value={`${churches.filter(c => c.type !== 'resort' && c.nama.toLowerCase().includes('pos pi')).length}`} 
                      icon={<Home size={16} />} 
                      color="emerald" 
                    />
                    <StatCard 
                      title="Total Jemaat" 
                      value={`${churches.filter(c => c.type !== 'resort').length}`} 
                      icon={<Users size={16} />} 
                      color="violet" 
                      subtitle="TERMASUK POS PI"
                    />
                  </div>

                  <div className="overflow-x-auto custom-scrollbar max-h-[70vh]">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-[#1e293b] text-white uppercase text-[10px] font-bold tracking-wider sticky top-0 z-50 border-b border-slate-700">
                        <tr>
                          {canDragOrder && (
                            <th className="px-2 py-4 border-b border-slate-700 w-8"></th>
                          )}
                          <th className="px-6 py-4 border-b border-slate-700 w-16 text-center">No</th>
                          <th className="px-6 py-4 border-b border-slate-700">Nama Jemaat</th>
                          <th className="px-6 py-4 border-b border-slate-700">Resort</th>
                          <th className="px-6 py-4 border-b border-slate-700">Wilayah</th>
                          {currentUserProfile?.role === 'superadmin' && <th className="px-6 py-4 border-b border-slate-700">WhatsApp</th>}
                          {currentUserProfile && <th className="px-6 py-4 border-b border-slate-700 text-center">Aksi</th>}
                        </tr>
                      </thead>
                      <Reorder.Group 
                        axis="y" 
                        values={displayGroupedChurches} 
                        onReorder={handleReorderChurches} 
                        as="tbody" 
                        className="divide-y divide-slate-100"
                      >
                        {(() => {
                          let rowCounterGereja = 0;
                          return displayGroupedChurches.map((item, idx) => {
                            if (item.type === 'group-header') {
                              return (
                                <tr key={item.id} className="bg-slate-800 text-white font-bold border-b border-slate-700 sticky top-[48px] z-10 shadow-sm">
                                  {canDragOrder && <td className="px-2 py-3"></td>}
                                  <td className="px-6 py-2.5 text-center text-[10px] font-mono text-slate-400"></td>
                                  <td colSpan={5} className="px-6 py-2.5 uppercase tracking-[0.2em] text-[10px] font-black">
                                    {item.roman ? `${item.roman}. ` : ''}{item.name.toUpperCase()}
                                  </td>
                                </tr>
                              );
                            }

                            const church = item as Church & { resortRoman?: string };
                            
                            // If it's a Resort entry, treat it as a sub-header instead of a numbered row
                            if (church.type === 'resort') {
                              return (
                                <tr key={church.id} className="bg-slate-100 font-bold border-b border-slate-200">
                                  {canDragOrder && <td className="px-2 py-3"></td>}
                                  <td className="px-6 py-2 text-center"></td>
                                  <td colSpan={5} className="px-6 py-2 text-[11px] font-black text-slate-700 uppercase tracking-wider">
                                    {church.resortRoman}. {church.nama}
                                  </td>
                                </tr>
                              );
                            }

                            rowCounterGereja++;
                            return (
                              <Reorder.Item 
                                key={church.id} 
                                value={church} 
                                as="tr" 
                                className="hover:bg-slate-50 transition-colors group cursor-move"
                                dragListener={canDragOrder}
                              >
                                {canDragOrder && (
                                  <td className="px-2 py-4">
                                    <div 
                                      className="text-slate-300 hover:text-gold-500 transition-all ml-2"
                                      title="Tarik untuk urutkan"
                                    >
                                      <GripVertical size={18} />
                                    </div>
                                  </td>
                                )}
                                <td className="px-6 py-4 text-slate-400 font-mono text-xs text-center">{rowCounterGereja}</td>
                                <td className="px-6 py-4 font-bold text-slate-800">
                                  {String(church.type) === 'resort' && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded mr-2 align-middle uppercase tracking-tighter">RESORT</span>}
                                  {church.nama}
                                </td>
                                <td className="px-6 py-4 text-slate-600 font-medium">
                                  <span className="bg-slate-100 px-2 py-0.5 rounded-md text-[10px]">{church.resort}</span>
                                </td>
                                <td className="px-6 py-4 text-slate-600 font-medium">
                                  <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md text-[10px] border border-amber-100">{church.wilayah || '-'}</span>
                                </td>
                                {currentUserProfile?.role === 'superadmin' && <td className="px-6 py-4 text-slate-500 text-xs font-mono">{church.wa || '-'}</td>}
                                {currentUserProfile && (
                                  <td className="px-6 py-4 text-center">
                                    <div className="flex justify-center flex-wrap gap-1">
                                      <button onClick={() => { setFormChurch(church); setShowChurchModal(true); }} className="text-gold-600 hover:text-gold-800 p-2 rounded-lg hover:bg-gold-50" title="Edit">
                                        <Edit size={16} />
                                      </button>
                                      {currentUserProfile.role === 'superadmin' && (
                                        <button onClick={() => handleDeleteChurch(church.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50" title="Hapus">
                                          <Trash2 size={16} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </Reorder.Item>
                            );
                          });
                        })()}
                      </Reorder.Group>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'periode' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-6">Tambah Periode Baru</h3>
                    <div className="space-y-4">
                      <input 
                        type="text" 
                        value={newPeriod} 
                        onChange={e => setNewPeriod(e.target.value)} 
                        placeholder="Contoh: Tahun 2027" 
                        className="w-full border border-slate-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-gold-500" 
                        disabled={!currentUserProfile}
                      />
                      <button 
                        disabled={!currentUserProfile || !newPeriod.trim()} 
                        onClick={handleAddPeriod} 
                        className="w-full bg-gold-600 text-white py-3 rounded-lg font-bold hover:bg-gold-700 disabled:opacity-50 transition-colors shadow-lg shadow-gold-500/10"
                      >
                        Tambah Periode
                      </button>
                    </div>
                  </div>
                  <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-6">Daftar Periode</h3>
                    <div className="space-y-3">
                      {periods.map(p => (
                        <div key={p} className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100">
                          <span className="font-bold text-slate-700">{p}</span>
                          {p === periodeAktif ? (
                            <span className="text-[10px] bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold border border-green-200">AKTIF</span>
                          ) : (
                            <button onClick={() => setPeriodeAktif(p)} className="text-xs text-blue-600 font-bold hover:underline">Aktifkan</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'distribusi' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">Distribusi Literatur</h3>
                      <p className="text-xs text-slate-500">Catatan jumlah pengiriman Almanak, Kalender, dan Buku ({periodeAktif})</p>
                    </div>
                    <div className="flex gap-3">
                       <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                        <span className="text-[9px] font-bold text-slate-400 capitalize">Resort:</span>
                        <select value={filterResort} onChange={(e) => setFilterResort(e.target.value)} className="bg-transparent text-[10px] font-bold text-slate-700 outline-none">
                          {uniqueResorts.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                        <span className="text-[9px] font-bold text-slate-400 capitalize">Wilayah:</span>
                        <select value={filterWilayah} onChange={(e) => setFilterWilayah(e.target.value)} className="bg-transparent text-[10px] font-bold text-slate-700 outline-none">
                          {uniqueWilayah.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                        <input 
                          type="text" 
                          placeholder="Cari..." 
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-7 pr-4 py-1 bg-white border border-slate-200 rounded-lg text-[10px] outline-none focus:ring-1 focus:ring-gold-500 min-w-[150px]"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-auto custom-scrollbar max-h-[70vh]">
                    <p className="p-4 bg-slate-50 text-[10px] text-slate-500 italic font-medium">INFO: Kolom ini untuk angka (Jumlah Barang). Pembayaran diatur di menu Literatur.</p>
                    <table className="w-full text-xs text-left border-collapse min-w-[1000px]">
                      <thead className="bg-[#1e293b] text-white uppercase text-[10px] font-black tracking-widest sticky top-0 z-50 border-b border-slate-700">
                        <tr>
                          {sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm && (
                            <th className="px-1 py-4 border-b border-slate-700 sticky left-0 bg-[#1e293b] z-[60] w-8"></th>
                          )}
                          <th className="px-4 py-4 border-b border-slate-700 sticky left-0 bg-[#1e293b] z-50 w-12 text-center" style={{ left: sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm ? '32px' : '0' }}>No</th>
                          <th className="px-4 py-4 border-b border-slate-700 sticky left-12 bg-[#1e293b] z-50 w-48" style={{ left: sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm ? '80px' : '48px' }}>Nama Jemaat</th>
                          <th className="px-4 py-4 border-b border-slate-700 text-center w-24">Resort</th>
                          {SPREADSHEET_COLUMNS.alaman.map(col => (
                            <th key={col} className="px-2 py-4 border-b border-slate-700 text-center w-24 tracking-tighter leading-tight italic font-serif opacity-80">{col}</th>
                          ))}
                          <th className="px-4 py-4 border-b border-slate-700 text-center w-24 bg-gold-600 text-white font-black tracking-normal">TOTAL QTY</th>
                        </tr>
                      </thead>
                      <Reorder.Group 
                        axis="y" 
                        values={(() => {
                          const filtered = dataDistribusi;
                          const result: any[] = [];
                          let currentWilayah = '';
                          let currentResort = '';
                          let resRomanCount = 0;
                          let showingPosPIHeader = false;
                          filtered.forEach(item => {
                            const isPosPI = item.nama.toLowerCase().includes('pos pi');
                            if (isPosPI && !searchTerm) {
                              if (!showingPosPIHeader) {
                                showingPosPIHeader = true;
                                result.push({ id: 'h-dist-pospi', type: 'group-header', name: 'DAFTAR POS PI', roman: '' });
                              }
                              result.push(item);
                              return;
                            }

                            if (item.wilayah !== currentWilayah && filterResort === 'Semua Resort' && !searchTerm) {
                              currentWilayah = item.wilayah || 'Belum Ditentukan';
                              currentResort = ''; // Reset resort header tracking for new wilayah
                            }

                            if (item.resort !== currentResort && filterResort === 'Semua Resort' && !searchTerm) {
                              currentResort = item.resort;
                              resRomanCount++;
                              const roman = translateToRoman(resRomanCount);
                              result.push({ id: `h-dist-${currentWilayah}-${currentResort}`, type: 'group-header', name: currentResort, roman: roman });
                            }
                            result.push(item);
                          });
                          return result;
                        })()} 
                        onReorder={handleReorderChurches} 
                        as="tbody" 
                        className="divide-y divide-slate-100"
                      >
                        {(() => {
                            const result: any[] = [];
                            let currentWilayah = '';
                            let currentResort = '';
                            let resRomanCount = 0;
                            let showingPosPIHeader = false;
                            
                            dataDistribusi.forEach(item => {
                              if (!searchTerm && item.nama.toLowerCase().includes('pos pi')) {
                                if (!showingPosPIHeader) {
                                  showingPosPIHeader = true;
                                  result.push({ 
                                    id: 'v-dist-pospi-header', 
                                    type: 'resort', 
                                    nama: 'DAFTAR POS PI', 
                                    resort: 'POS PI', 
                                    romanPrefix: '', 
                                    details: {}, 
                                    status: '' 
                                  });
                                }
                                result.push(item);
                                return;
                              }

                              if (item.wilayah !== currentWilayah && filterResort === 'Semua Resort' && !searchTerm) {
                                currentWilayah = item.wilayah || 'Belum Ditentukan';
                                currentResort = '';
                              }

                              if (item.resort !== currentResort && filterResort === 'Semua Resort' && !searchTerm) {
                                currentResort = item.resort;
                                resRomanCount++;
                                const roman = translateToRoman(resRomanCount);
                                result.push({ ...item, romanPrefix: roman });
                              } else {
                                if (item.type !== 'resort' || searchTerm || filterResort !== 'Semua Resort') {
                                  result.push(item);
                                }
                              }
                            });

                            let rowCounter = 0;
                            return result.map((item, idxx) => {
                              if (!item.romanPrefix) {
                                rowCounter++;
                              }
                              const totalQty = Object.values(item.details).reduce((sum: number, v: any) => sum + (Number(v) || 0), 0);
                              return (
                                <Reorder.Item 
                                  key={item.id} 
                                  value={item} 
                                  as="tr" 
                                  className={`hover:bg-slate-50 transition-colors group ${item.romanPrefix ? 'bg-slate-50/80 font-black' : ''}`}
                                  dragListener={canDragOrder}
                                >
                                  {canDragOrder && (
                                    <td className="px-1 py-3 sticky left-0 bg-inherit z-20 border-r border-slate-100 cursor-move">
                                      <GripVertical size={14} className="text-slate-300" />
                                    </td>
                                  )}
                                  <td className={`px-4 py-3 sticky z-20 text-center border-r border-slate-100 ${item.romanPrefix ? 'font-black text-slate-500 text-xs bg-slate-50/90' : 'bg-white group-hover:bg-slate-50'}`} style={{ left: canDragOrder ? '32px' : '0' }}>
                                    {item.romanPrefix ? '' : rowCounter}
                                  </td>
                                  <td className={`px-4 py-3 sticky z-20 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${item.romanPrefix ? 'bg-slate-50/90' : 'bg-white group-hover:bg-slate-50'}`} style={{ left: canDragOrder ? '80px' : '48px' }}>
                                    <div className={`flex items-center gap-2 ${item.romanPrefix ? 'font-black text-indigo-950 uppercase text-[10px] tracking-widest' : 'font-medium text-slate-700'}`}>
                                      {item.romanPrefix ? `${item.romanPrefix}. ${item.nama}` : item.nama}
                                    </div>
                                  </td>
                                  <td className={`px-4 py-3 text-center text-[10px] ${item.romanPrefix ? 'font-black text-indigo-900 bg-slate-50/90' : 'text-slate-500 bg-white group-hover:bg-slate-50'}`}>{item.resort}</td>
                                  {SPREADSHEET_COLUMNS.alaman.map(col => {
                                    const val = item.details[col] || 0;
                                    return (
                                      <td key={col} className={`p-0 border-r border-slate-100 relative z-10 hover:z-20 ${item.romanPrefix ? 'bg-indigo-50/30' : ''}`}>
                                        {currentUserProfile ? (
                                          <TableCellInput
                                            initialVal={val}
                                            itemType={item.romanPrefix ? 'resort' : ''}
                                            onSave={(newVal) => handleDistributionChange(item.id, col, newVal)}
                                            formatFn={formatInput}
                                            align="center"
                                            customClasses={`px-2 font-bold transition-all focus:bg-indigo-50/50 cursor-text ${!val ? (item.romanPrefix ? 'text-slate-400' : 'text-slate-300') : 'text-gold-700'}`}
                                          />
                                        ) : (
                                          <div className={`w-full py-3 text-center font-mono ${!val ? 'text-slate-300' : 'text-gold-700 font-bold'}`}>
                                            {formatInput(val)}
                                          </div>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className={`px-4 py-3 text-center !font-black !font-mono text-slate-900 min-w-[100px] ${item.romanPrefix ? 'bg-indigo-50/50' : 'bg-slate-50'}`}>{formatInput(totalQty as number)}</td>
                                </Reorder.Item>
                              );
                            });
                        })()}
                      </Reorder.Group>
                    </table>
                  </div>
                </div>
              )}

              {(activeTab === 'laporan' || activeTab === 'pelean' || activeTab === 'alaman') && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                        <h3 className="judul-h3">{appSettings[`menu${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}` as keyof AppSettings]}</h3>
                    <div className="flex gap-3">
                       <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                        <span className="text-[9px] font-bold text-slate-400 capitalize">Resort:</span>
                        <select value={filterResort} onChange={(e) => setFilterResort(e.target.value)} className="bg-transparent text-[10px] font-bold text-slate-700 outline-none">
                          {uniqueResorts.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                        <span className="text-[9px] font-bold text-slate-400 capitalize">Wilayah:</span>
                        <select value={filterWilayah} onChange={(e) => setFilterWilayah(e.target.value)} className="bg-transparent text-[10px] font-bold text-slate-700 outline-none">
                          {uniqueWilayah.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                        <input 
                          type="text" 
                          placeholder="Cari..." 
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-7 pr-4 py-1 bg-white border border-slate-200 rounded-lg text-[10px] outline-none focus:ring-1 focus:ring-gold-500 min-w-[150px]"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-auto custom-scrollbar max-h-[70vh]">
                    <table className="w-full text-xs text-left border-collapse min-w-[1200px]">
                      <thead className="bg-[#1e293b] text-white uppercase text-[10px] font-black tracking-[0.2em] sticky top-0 z-50 border-b border-slate-700">
                        <tr>
                          {canDragOrder && (
                            <th className="px-1 py-4 border-b border-slate-700 sticky left-0 bg-[#1e293b] z-[60] w-8"></th>
                          )}
                          <th className="px-4 py-4 border-b border-slate-700 sticky left-0 bg-[#1e293b] z-50 w-12 text-center" style={{ left: canDragOrder ? '32px' : '0' }}>No</th>
                          <th className="px-4 py-4 border-b border-slate-700 sticky left-12 bg-[#1e293b] z-50 w-48" style={{ left: canDragOrder ? '80px' : '48px' }}>Nama Jemaat</th>
                          <th className="px-4 py-4 border-b border-slate-700 text-center w-24">Resort</th>
                          <th className="px-4 py-4 border-b border-slate-700 text-center w-24">Wilayah</th>
                          <th className="px-4 py-4 border-b border-slate-700 text-center w-24">Status</th>
                          {SPREADSHEET_COLUMNS[activeTab as keyof typeof SPREADSHEET_COLUMNS].map(col => (
                            <th key={col} className="px-2 py-4 border-b border-slate-700 text-center w-24 tracking-tighter leading-tight italic font-serif opacity-80">{col}</th>
                          ))}
                          <th className="px-4 py-4 border-b border-slate-700 text-right bg-gold-600 text-white w-32 font-black tracking-tighter">TOTAL (RP)</th>
                          <th className="px-4 py-4 border-b border-slate-700 text-center w-24">AKSI</th>
                        </tr>
                      </thead>
                      <Reorder.Group 
                        axis="y" 
                        values={(() => {
                          const baseData = getLaporanData(activeTab as any);
                          const result: any[] = [];
                          let currentWilayah = '';
                          let currentResort = '';
                          let resRomanCount = 0;
                          let showingPosPIHeader = false;
                          
                          baseData.forEach(item => {
                            const isPosPI = item.nama.toLowerCase().includes('pos pi');
                            
                            // Pos PI Header Logic (Suppress others)
                            if (isPosPI && !searchTerm) {
                              if (!showingPosPIHeader) {
                                showingPosPIHeader = true;
                                result.push({ 
                                  id: `h-pos-pi-${activeTab}`, 
                                  type: 'group-header', 
                                  name: 'DAFTAR POS PI', 
                                  roman: '' 
                                });
                              }
                              result.push(item);
                              return;
                            }

                            // Wilayah Header (Only for Laporan/Pelean)
                            if ((activeTab === 'laporan' || activeTab === 'pelean') && !searchTerm) {
                              const itemWilayah = item.wilayah || 'Belum Ditentukan';
                              if (itemWilayah !== currentWilayah) {
                                currentWilayah = itemWilayah;
                                const wLevel = getWilayahLevel(currentWilayah);
                                const roman = wLevel < 9999 ? translateToRoman(wLevel) : '';
                                result.push({ 
                                  id: `h-wilayah-${activeTab}-${currentWilayah}`, 
                                  type: 'group-header', 
                                  name: isPosPI ? 'POS PI' : currentWilayah, 
                                  roman: roman 
                                });
                                currentResort = ''; // Reset resort when wilayah changes to ensure header shows up
                              }
                            }

                            // Resort Header
                            if (filterResort === 'Semua Resort' && !searchTerm) {
                              if (item.resort !== currentResort) {
                                currentResort = item.resort;
                                resRomanCount++;
                                const roman = translateToRoman(resRomanCount);
                                result.push({ 
                                  id: `h-resort-${activeTab}-${currentWilayah}-${currentResort}`, 
                                  type: 'group-header', 
                                  name: currentResort, 
                                  roman: roman 
                                });
                              }
                            }
                            result.push(item);
                          });
                          return result;
                        })()} 
                        onReorder={(newOrder) => handleReorderChurches(newOrder as any)} 
                        as="tbody" 
                        className="divide-y divide-slate-100"
                      >
                        {(() => {
                            const baseData = getLaporanData(activeTab as any);
                            const result: any[] = [];
                            let currentWilayah = '';
                            let currentResort = '';
                            let resRomanCount = 0;
                            let showingPosPIHeader = false;
                            
                            baseData.forEach(item => {
                              const isPosPI = item.nama.toLowerCase().includes('pos pi');
                              
                              if (!searchTerm) {
                                // Pos PI header row
                                if (isPosPI) {
                                  if (!showingPosPIHeader) {
                                    showingPosPIHeader = true;
                                    result.push({ 
                                      id: `v-h-pos-pi-${activeTab}`, 
                                      type: 'wilayah-header', 
                                      nama: 'DAFTAR POS PI',
                                      romanPrefix: ''
                                    });
                                  }
                                  result.push(item);
                                  return;
                                }

                                // Wilayah header row
                                if (activeTab === 'laporan' || activeTab === 'pelean') {
                                  const itemWilayah = item.wilayah || 'Belum Ditentukan';
                                  if (itemWilayah !== currentWilayah) {
                                    currentWilayah = itemWilayah;
                                    const wLevel = getWilayahLevel(currentWilayah);
                                    const roman = (wLevel < 9999 && wLevel > 0) ? translateToRoman(wLevel) : '';
                                    result.push({ 
                                      id: `v-h-wilayah-${activeTab}-${currentWilayah}`, 
                                      type: 'wilayah-header',
                                      nama: currentWilayah.toUpperCase(),
                                      romanPrefix: roman
                                    });
                                    currentResort = '';
                                  }
                                }

                                // Resort header row
                                if (filterResort === 'Semua Resort' && item.resort !== currentResort) {
                                  currentResort = item.resort;
                                  resRomanCount++;
                                  const roman = translateToRoman(resRomanCount);
                                  result.push({ ...item, romanPrefix: roman });
                                  return;
                                }
                              }
                              
                              if (item.type !== 'resort' || searchTerm || filterResort !== 'Semua Resort') {
                                result.push(item);
                              }
                            });

                            let rowCounterFin = 0;
                            return result.map((item, idx3) => {
                              const isHeader = item.type === 'resort' || item.type === 'wilayah-header';
                              if (item.type === 'resort') {
                                rowCounterFin = 0; // Reset numbering for each new Resort
                              }
                              if (!isHeader) {
                                rowCounterFin++;
                              }
                              
                              if (item.type === 'wilayah-header') {
                                return (
                                  <tr key={item.id} className="bg-slate-800 text-white font-bold border-b border-slate-700 sticky top-0 z-40 shadow-sm">
                                    {canDragOrder && <td className="px-1 py-4 sticky left-0 bg-slate-800 z-50"></td>}
                                    <td className="px-4 py-4 sticky left-0 bg-slate-800 z-50 text-center" style={{ left: canDragOrder ? '32px' : '0' }}></td>
                                    <td colSpan={6 + SPREADSHEET_COLUMNS[activeTab as keyof typeof SPREADSHEET_COLUMNS].length} className="px-4 py-4 uppercase tracking-[0.2em] text-[10px] font-black">
                                      {item.romanPrefix ? `${item.romanPrefix}. ` : ''}{item.nama}
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <Reorder.Item 
                                  key={item.id} 
                                  value={item} 
                                  as="tr" 
                                  className={`hover:bg-slate-50 transition-colors group ${item.type === 'resort' ? 'bg-slate-50/90 font-black border-b border-slate-200' : ''}`}
                                  dragListener={canDragOrder}
                                >
                                  {canDragOrder && (
                                    <td className="px-1 py-3 sticky left-0 bg-inherit z-20 border-r border-slate-100 cursor-move">
                                      <GripVertical size={14} className="text-slate-300" />
                                    </td>
                                  )}
                                  <td className={`px-4 py-3 sticky z-20 text-center border-r border-slate-100 ${item.type === 'resort' ? 'font-black text-slate-500 text-xs bg-slate-50/90' : 'bg-white group-hover:bg-slate-50'}`} style={{ left: canDragOrder ? '32px' : '0' }}>
                                    {item.type === 'resort' ? '' : rowCounterFin}
                                  </td>
                                  <td className={`px-4 py-3 sticky z-20 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${item.type === 'resort' ? 'bg-slate-50/90' : 'bg-white group-hover:bg-slate-50'}`} style={{ left: canDragOrder ? '80px' : '48px' }}>
                                    <div className={`flex items-center gap-2 ${item.type === 'resort' ? 'font-black text-indigo-950 uppercase text-[10px] tracking-widest' : ''}`}>
                                      {item.type === 'resort' ? `${item.romanPrefix}. ${item.nama}` : item.nama}
                                    </div>
                                  </td>
                                  <td className={`px-4 py-3 text-center text-[10px] ${item.type === 'resort' ? 'font-black text-indigo-900 bg-slate-50/90' : 'text-slate-500 bg-white group-hover:bg-slate-50'}`}>{item.resort}</td>
                                  <td className={`px-4 py-3 text-center text-[10px] ${item.type === 'resort' ? 'font-black text-gold-700 bg-slate-50/90' : 'text-slate-500 bg-white group-hover:bg-slate-50'}`}>{item.wilayah || '-'}</td>
                                  <td className={`px-4 py-3 text-center ${item.type === 'resort' ? 'bg-slate-50/90' : 'bg-white group-hover:bg-slate-50'}`}>
                                    {item.type !== 'resort' && item.status && (
                                      <span className={`px-2 py-1 rounded-full text-[9px] font-bold ${item.status === 'Lunas' ? 'bg-green-100 text-green-700' : item.status === 'Proses' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                        {item.status.toUpperCase()}
                                      </span>
                                    )}
                                  </td>
                                  {SPREADSHEET_COLUMNS[activeTab as keyof typeof SPREADSHEET_COLUMNS].map(col => {
                                    const val = item.details[col] || 0;
                                    const isSelected = (selectedCells[item.id] || []).includes(col);
                                    return (
                                      <td key={col} className="p-0 border-r border-slate-100 relative group min-w-[120px] z-10 hover:z-20">
                                        <div className="flex items-center h-full px-2">
                                          {val > 0 && (
                                            <div className="mr-1">
                                              <input 
                                                type="checkbox" 
                                                checked={isSelected}
                                                onChange={() => toggleCellSelection(item.id, col)}
                                                className="w-3 h-3 cursor-pointer text-gold-600 focus:ring-gold-500 rounded"
                                                title="Pilih untuk pesan gabungan"
                                              />
                                            </div>
                                          )}
                                          <div className="flex-1 relative flex items-center">
                                            {currentUserProfile ? (
                                              <TableCellInput
                                                initialVal={val}
                                                itemType={item.type}
                                                onSave={(newVal) => handleCellChange(item.id, activeTab as any, col, newVal)}
                                                formatFn={activeTab === 'alaman' ? (v) => formatInput(v) : (v) => formatRupiah(v)}
                                              />
                                            ) : (
                                              <div className={`w-full py-3 text-right font-mono data-value ${!val ? (item.type === 'resort' ? 'text-slate-300' : 'text-red-300') : 'text-slate-700 font-bold'}`}>
                                                {activeTab === 'alaman' ? formatInput(val) : formatRupiah(val)}
                                              </div>
                                            )}
                                            
                                            {/* Tombol WA Khusus */}
                                            {item.type !== 'resort' && (
                                              <button 
                                                onClick={() => handleKirimWASpesifik(item, col)}
                                                className="ml-2 p-1 rounded-full text-slate-300 hover:text-green-600 hover:bg-green-50 transition-colors"
                                                title={val > 0 ? "Kirim WA Terima Kasih" : "Kirim WA Tagihan"}
                                              >
                                                <MessageCircle size={14} />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  })}
                                  <td className="px-4 py-3 text-right font-bold font-mono text-gold-900 bg-gold-50/20 border-l border-gold-100 min-w-[140px]">{formatRupiah(item.jumlah)}</td>
                                  <td className="px-4 py-3 text-center">
                                    {item.type !== 'resort' && (
                                      <div className="flex flex-col items-center space-y-1">
                                      <div className="flex justify-center space-x-1">
                                        <button 
                                          onClick={() => handleKirimWA(item, item.status === 'Menunggak' ? 'tagihan' : 'terimakasih')}
                                          className="text-green-600 hover:bg-green-50 p-1 rounded-lg"
                                          title="WA Cepat"
                                        >
                                          <MessageCircle size={14} />
                                        </button>
                                        <button 
                                          onClick={() => { setPrintData(item); setPrintType(item.status === 'Menunggak' ? 'peringatan' : 'terimakasih'); }}
                                          className="text-slate-600 hover:bg-slate-100 p-1 rounded-lg"
                                          title="Cetak Surat"
                                        >
                                          <Printer size={14} />
                                        </button>
                                      </div>
                                      {(selectedCells[item.id] || []).length > 0 && (
                                        <div className="flex space-x-1">
                                          <button 
                                            onClick={() => handleKirimWABatch(item)}
                                            className="bg-emerald-600 text-white p-1 rounded text-[9px] font-bold"
                                            title="Kirim WA Gabungan"
                                          >
                                            WA Gabung
                                          </button>
                                          <button 
                                            onClick={() => handlePrintBukti(item, 'penerimaan')}
                                            className="bg-gold-600 text-white p-1 rounded text-[9px] font-bold"
                                            title="Cetak Bukti Penerimaan"
                                          >
                                            Bukti
                                          </button>
                                        </div>
                                      )}
                                      <button 
                                        onClick={() => handlePrintBukti(item, 'tunggakan')}
                                        className="text-[9px] text-red-600 font-bold hover:underline"
                                      >
                                        Bukti Tunggakan
                                      </button>
                                    </div>
                                    )}
                                  </td>
                                </Reorder.Item>
                              );
                            });
                        })()}
                      </Reorder.Group>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'download' && (
                <div className="max-w-4xl mx-auto space-y-8">
                  <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-6">Ekspor Laporan Keuangan</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                      <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-700">Pilih Kategori Laporan:</label>
                        <select 
                          value={downloadKategori} 
                          onChange={(e) => setDownloadKategori(e.target.value as any)}
                          className="w-full border border-slate-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-gold-500 bg-slate-50 font-bold"
                        >
                          <option value="laporan">{appSettings.menuLaporan}</option>
                          <option value="pelean">{appSettings.menuPelean}</option>
                          <option value="alaman">{appSettings.menuAlaman}</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-3">
                        <button onClick={() => { setPrintData({ kategori: downloadKategori }); setPrintType('rekap'); }} className="flex items-center justify-center space-x-3 bg-gold-600 text-white py-3 rounded-lg font-bold hover:bg-gold-700 transition-transform hover:scale-[1.02] shadow-lg shadow-gold-500/20">
                          <Printer size={20} /> <span>Cetak Rekapitulasi</span>
                        </button>
                        <button onClick={() => alert('Fitur download CSV sedang disiapkan')} className="flex items-center justify-center space-x-3 bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition-transform hover:scale-[1.02] shadow-lg shadow-emerald-500/20">
                          <Download size={20} /> <span>Download Excel (CSV)</span>
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={syncToGoogleSheets} className="flex items-center justify-center space-x-3 bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition-transform hover:scale-[1.02]">
                            <Database size={20} className="text-green-400" /> <span>Sinkron via Script</span>
                          </button>
                          <button onClick={pullFromGoogleSheets} className="flex items-center justify-center space-x-3 bg-red-900 text-white py-3 rounded-lg font-bold hover:bg-red-800 transition-transform hover:scale-[1.02]">
                            <Download size={20} className="text-red-400" /> <span>Tarik via Script</span>
                          </button>
                        </div>
                        
                        <div className="mt-6 border-t border-slate-200 pt-6">
                            <h4 className="font-bold text-blue-800 mb-2 flex items-center"><Database size={18} className="mr-2" /> Sinkronisasi Google Drive Langsung (Otomatis)</h4>
                            <p className="text-sm text-slate-600 mb-4">
                                Sinkronisasi otomatis ke akun Google Drive Anda tanpa perlu menulis Apps Script.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <button onClick={handleDirectSync} className="flex items-center justify-center space-x-3 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-transform hover:scale-[1.02] shadow-lg shadow-blue-500/20">
                                <Database size={20} /> <span>Sync ke Drive</span>
                              </button>
                              <button onClick={handleDirectPull} className="flex items-center justify-center space-x-3 bg-orange-600 text-white py-3 rounded-lg font-bold hover:bg-orange-700 transition-transform hover:scale-[1.02] shadow-lg shadow-orange-500/20">
                                <Download size={20} /> <span>Tarik dari Drive</span>
                              </button>
                            </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl">
                    <h4 className="font-bold text-amber-800 mb-2 flex items-center"><AlertTriangle size={18} className="mr-2" /> Petunjuk Cetak PDF</h4>
                    <p className="text-sm text-amber-700 leading-relaxed">
                      Untuk menyimpan sebagai PDF, klik tombol <b>Cetak Rekapitulasi</b>, lalu pada jendela cetak yang muncul, pilih <b>"Save as PDF"</b> pada bagian Printer/Destination.
                    </p>
                  </div>

                  <div className="bg-slate-900 p-8 rounded-xl text-white">
                    <h4 className="font-bold text-lg mb-4 flex items-center"><Database size={20} className="mr-2 text-green-400" /> Cara Menggunakan Google Sheets sebagai Database</h4>
                    <div className="space-y-4 text-slate-300 text-sm">
                      <p>1. Buat Google Sheet baru.</p>
                      <p>2. Klik <b>Extensions &gt; Apps Script</b>.</p>
                      <p>3. Hapus semua kode yang ada dan paste kode di bawah ini <b>(Update: Mendukung Tarik Data Penuh)</b>:</p>
                      <pre className="bg-slate-800 p-4 rounded text-xs overflow-x-auto text-green-400">
{`function doGet(e) {
  var action = e.parameter ? e.parameter.action : null;
  var output = ContentService.createTextOutput();
  
  if (action === 'pull') {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var jemaatSheet = ss.getSheetByName("Jemaat");
    var trxSheet = ss.getSheetByName("Pembayaran");
    
    var jemaatData = [];
    if (jemaatSheet && jemaatSheet.getLastRow() > 1) {
       var jRows = jemaatSheet.getDataRange().getValues();
       var headers = jRows[0];
       for (var i=1; i<jRows.length; i++) {
          var obj = {};
          for (var j=0; j<headers.length; j++) obj[headers[j]] = jRows[i][j];
          if (obj.id) jemaatData.push(obj);
       }
    }
    
    var trxData = [];
    if (trxSheet && trxSheet.getLastRow() > 1) {
       var tRows = trxSheet.getDataRange().getValues();
       var headers = tRows[0];
       for (var i=1; i<tRows.length; i++) {
          var obj = {};
          for (var j=0; j<headers.length; j++) {
             var val = tRows[i][j];
             if (headers[j] === 'details' && typeof val === 'string' && val.indexOf('{') === 0) {
                try { val = JSON.parse(val); } catch(ex){}
             }
             obj[headers[j]] = val;
          }
          if (obj.id) trxData.push(obj);
       }
    }
    
    var result = { churches: jemaatData, payments: trxData };
    output.setContent(JSON.stringify(result));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  }
  
  output.setContent("✅ API Keuangan GKLI Aktif! (Format Kolom Maju/Mundur)");
  output.setMimeType(ContentService.MimeType.TEXT);
  return output;
}

function doPost(e) {
  try {
    var contents = e.postData.contents;
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Sinkronisasi Jemaat
    if (data.payload && data.payload.churches) {
      var sheet = ss.getSheetByName("Jemaat") || ss.insertSheet("Jemaat");
      sheet.clear();
      var churches = data.payload.churches;
      if (churches.length > 0) {
        var headers = ["id", "order", "nama", "resort", "wilayah", "wa", "type"];
        var rows = [headers];
        for (var i=0; i<churches.length; i++) {
           var row = [];
           for (var j=0; j<headers.length; j++) row.push(churches[i][headers[j]] || "");
           rows.push(row);
        }
        sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
      }
    }
    
    // Sinkronisasi Pembayaran
    if (data.payload && data.payload.payments) {
      var sheet = ss.getSheetByName("Pembayaran") || ss.insertSheet("Pembayaran");
      sheet.clear();
      var payments = data.payload.payments;
      if (payments.length > 0) {
        var headers = ["id", "gerejaId", "kategori", "periode", "jumlah", "tanggal", "receiptSent", "receiptSentAt", "details"];
        var rows = [headers];
        for (var i=0; i<payments.length; i++) {
           var row = [];
           for (var j=0; j<headers.length; j++) {
              var val = payments[i][headers[j]];
              if (headers[j] === 'details') val = JSON.stringify(val);
              row.push(val !== undefined && val !== null ? val : "");
           }
           rows.push(row);
        }
        sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
      }
    }
    
    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.message).setMimeType(ContentService.MimeType.TEXT);
  }
}`}
                      </pre>
                      <p>4. Klik <b>Deploy &gt; New Deployment</b>.</p>
                      <p>5. Pilih type <b>Web App</b>.</p>
                      <p>6. **PENTING**: Set 'Execute as' to <b>'Me'</b> dan 'Who has access' to <b>'Anyone'</b>.</p>
                      <p>7. Salin URL Web App (akhiran /exec) ke menu <b>Edit Tampilan</b>.</p>
                      <p className="text-amber-400 italic text-[11px]">* Jika Anda mengupdate kode script, Anda wajib melakukan 'Deploy &gt; New Deployment' lagi.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'akun' && currentUserProfile?.role === 'superadmin' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg">Manajemen Akun Cloud</h3>
                    <button onClick={() => { setFormUser({ username: '', password: '', role: 'staff' }); setShowUserModal(true); }} className="flex items-center space-x-2 bg-gold-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gold-700 transition-colors shadow-lg shadow-gold-500/10">
                      <UserPlus size={16} /> <span>Tambah Akun</span>
                    </button>
                  </div>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="px-6 py-4">Username (Email)</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map((user) => (
                        <tr key={user.username}>
                          <td className="px-6 py-4 font-bold">{user.username}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[9px] font-bold ${user.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {user.role.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {user.username !== 'kpt_gkli@yahoo.com' && (
                              <button onClick={() => handleDeleteUser(user.username)} className="text-red-500 hover:bg-red-50 p-2 rounded-full">
                                <Trash2 size={18} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'templates' && currentUserProfile?.role === 'superadmin' && (
                <div className="space-y-8">
                  <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-6">Manajemen Template Surat</h3>
                    
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Upload Kop Surat (Gambar)</label>
                        <div className="flex items-center space-x-4">
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setTemplates({ ...templates, kopSurat: reader.result as string });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gold-50 file:text-gold-700 hover:file:bg-gold-100"
                          />
                          {templates.kopSurat && (
                            <button onClick={() => setTemplates({ ...templates, kopSurat: '' })} className="text-red-600 text-xs font-bold hover:underline">Hapus Kop</button>
                          )}
                        </div>
                        {templates.kopSurat && (
                          <div className="mt-4 p-2 border border-slate-100 rounded-lg bg-slate-50">
                            <p className="text-[10px] text-slate-400 mb-1">Pratinjau Kop:</p>
                            <img src={templates.kopSurat} alt="Kop Surat" className="max-h-20" />
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Format Resmi (Stempel/TTD) Terima Kasih</label>
                          <div className="flex items-center space-x-4">
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setTemplates({ ...templates, stempelTerimaKasih: reader.result as string });
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                            />
                            {templates.stempelTerimaKasih && (
                              <button onClick={() => setTemplates({ ...templates, stempelTerimaKasih: '' })} className="text-red-600 text-xs font-bold hover:underline">Hapus</button>
                            )}
                          </div>
                          {templates.stempelTerimaKasih && (
                            <div className="mt-4 p-2 border border-slate-100 rounded-lg bg-slate-50">
                              <img src={templates.stempelTerimaKasih} alt="Stempel Terima Kasih" className="max-h-20" />
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Format Resmi (Stempel/TTD) Tunggakan</label>
                          <div className="flex items-center space-x-4">
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setTemplates({ ...templates, stempelTunggakan: reader.result as string });
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                            />
                            {templates.stempelTunggakan && (
                              <button onClick={() => setTemplates({ ...templates, stempelTunggakan: '' })} className="text-red-600 text-xs font-bold hover:underline">Hapus</button>
                            )}
                          </div>
                          {templates.stempelTunggakan && (
                            <div className="mt-4 p-2 border border-slate-100 rounded-lg bg-slate-50">
                              <img src={templates.stempelTunggakan} alt="Stempel Tunggakan" className="max-h-20" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700">Template Surat Terima Kasih</label>
                          <textarea 
                            value={templates.suratTerimaKasih}
                            onChange={(e) => setTemplates({ ...templates, suratTerimaKasih: e.target.value })}
                            className="w-full h-64 border border-slate-200 rounded-lg p-4 text-sm outline-none focus:ring-2 focus:ring-gold-500 font-serif"
                          ></textarea>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700">Template Surat Tunggakan</label>
                          <textarea 
                            value={templates.suratTunggakan}
                            onChange={(e) => setTemplates({ ...templates, suratTunggakan: e.target.value })}
                            className="w-full h-64 border border-slate-200 rounded-lg p-4 text-sm outline-none focus:ring-2 focus:ring-gold-500 font-serif"
                          ></textarea>
                        </div>
                      </div>

                      <div className="bg-gold-50 p-4 rounded-lg border border-gold-100">
                        <h4 className="font-bold text-gold-800 text-xs mb-2 uppercase">Daftar Placeholder (Kode Otomatis)</h4>
                        <p className="text-[11px] text-gold-700 leading-relaxed">
                          Gunakan kode di bawah ini dalam teks surat agar sistem mengisi data secara otomatis:
                          <br /><b>[NAMA_JEMAAT]</b> : Nama gereja
                          <br /><b>[RESORT]</b> : Nama resort
                          <br /><b>[JUMLAH]</b> : Total uang yang disetor
                          <br /><b>[KATEGORI]</b> : Jenis setoran (Laporan/Pelean/Alaman)
                          <br /><b>[PERIODE]</b> : Tahun/Bulan setoran
                          <br /><b>[TANGGAL]</b> : Tanggal hari ini
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* MODALS */}
      <Modal show={showLoginModal} onClose={() => setShowLoginModal(false)} title="Login Admin / Staf">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username Admin</label>
            <input 
              type="text" 
              value={loginForm.username} 
              onChange={e => setLoginForm({...loginForm, username: e.target.value})} 
              className="w-full border border-slate-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-gold-500" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password Admin</label>
            <input 
              type="password" 
              value={loginForm.password} 
              onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
              className="w-full border border-slate-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-gold-500" 
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <button onClick={handleLogin} className="w-full bg-gold-600 text-white py-3 rounded-lg font-bold hover:bg-gold-700 shadow-lg shadow-gold-500/20 transition-all">
            Masuk Sebagai Admin
          </button>
          
          {users.length === 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-[10px] text-yellow-800 mb-2 font-bold uppercase tracking-widest text-center">Inisialisasi Sistem</p>
              <p className="text-xs text-yellow-700 mb-4 text-center">Belum ada akun admin di database. Silakan isi form di atas lalu klik tombol di bawah untuk membuat akun Superadmin pertama.</p>
              <button 
                onClick={handleRegisterInitialAdmin}
                className="w-full bg-yellow-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-yellow-700 transition-all"
              >
                Buat Akun Admin Pertama
              </button>
            </div>
          )}
        </div>
      </Modal>

      <Modal show={showChurchModal} onClose={() => setShowChurchModal(false)} title={formChurch.id ? 'Edit Data' : 'Tambah Data'}>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipe Entitas</label>
            <select 
              value={formChurch.type || 'jemaat'} 
              onChange={e => setFormChurch({...formChurch, type: e.target.value as any})}
              className="w-full border border-slate-200 p-3 rounded-lg outline-none focus:ring-2 focus:ring-gold-500 bg-white"
            >
              <option value="jemaat">Jemaat (Anggota)</option>
              <option value="resort">Pusat / Resort</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{formChurch.type === 'resort' ? 'Nama Resort' : 'Nama Jemaat'}</label>
            <input type="text" value={formChurch.nama} onChange={e => setFormChurch({...formChurch, nama: e.target.value})} className="w-full border border-slate-200 p-3 rounded-lg outline-none focus:ring-2 focus:ring-gold-500" placeholder={formChurch.type === 'resort' ? 'Contoh: RESORT MEDAN' : 'Nama Jemaat'} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Resort</label>
              <input type="text" value={formChurch.resort} onChange={e => setFormChurch({...formChurch, resort: e.target.value})} className="w-full border border-slate-200 p-3 rounded-lg outline-none focus:ring-2 focus:ring-gold-500" placeholder="Resort" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Wilayah</label>
              <input type="text" value={formChurch.wilayah} onChange={e => setFormChurch({...formChurch, wilayah: e.target.value})} className="w-full border border-slate-200 p-3 rounded-lg outline-none focus:ring-2 focus:ring-gold-500" placeholder="Wilayah" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. WA (628...)</label>
              <input type="text" value={formChurch.wa} onChange={e => setFormChurch({...formChurch, wa: e.target.value})} className="w-full border border-slate-200 p-3 rounded-lg outline-none focus:ring-2 focus:ring-gold-500" placeholder="628..." />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Posisi Urutan</label>
              <input type="number" value={formChurch.order} onChange={e => setFormChurch({...formChurch, order: parseInt(e.target.value) || 0})} className="w-full border border-slate-200 p-3 rounded-lg outline-none focus:ring-2 focus:ring-gold-500" placeholder="Posisi" />
            </div>
          </div>
          <button onClick={handleSaveChurch} className="w-full bg-gold-600 text-white py-3 rounded-lg font-bold hover:bg-gold-700 shadow-lg shadow-gold-500/20 transition-all">Simpan Data Jemaat</button>
        </div>
      </Modal>

      <Modal show={showBulkModal} onClose={() => setShowBulkModal(false)} title="Import Massal Jemaat">
        <div className="space-y-4">
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-[10px] text-amber-800 leading-relaxed font-medium">
            <p className="font-bold mb-1 uppercase tracking-wider">Format Import (Tab-Delimited):</p>
            <p>Nama Jemaat [TAB] Resort [TAB] Wilayah [TAB] No WA</p>
            <p className="mt-1">* Copy data dari Excel mulai dari kolom Nama sampai WA.</p>
          </div>
          <textarea 
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Paste data dari Excel di sini..."
            className="w-full h-48 border border-slate-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-gold-500 text-sm font-mono"
          ></textarea>
          <button onClick={handleBulkImport} className="w-full bg-gold-600 text-white py-3 rounded-lg font-bold hover:bg-gold-700 shadow-xl shadow-gold-500/10 transition-all">Import Sekarang</button>
        </div>
      </Modal>

      <Modal show={showUserModal} onClose={() => setShowUserModal(false)} title="Tambah Akun Baru">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username</label>
            <input type="text" value={formUser.username} onChange={e => setFormUser({...formUser, username: e.target.value})} className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-gold-500" placeholder="Username" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
            <input type="text" value={formUser.password} onChange={e => setFormUser({...formUser, password: e.target.value})} className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-gold-500" placeholder="Password" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pilih Peran (Role)</label>
            <select 
              value={formUser.role} 
              onChange={e => setFormUser({...formUser, role: e.target.value as 'superadmin' | 'staff'})}
              className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-gold-500 bg-white"
            >
              <option value="staff">Staff (Hanya Akses Dashboard)</option>
              <option value="superadmin">Admin (Akses Kelola & Edit Data)</option>
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              * Staff digunakan untuk login perlindungan pertama (pengunjung).
              <br />* Admin digunakan untuk membantu mengelola dan mengedit data.
            </p>
          </div>
          <button onClick={handleSaveUser} className="w-full bg-gold-600 text-white py-3 rounded-lg font-bold hover:bg-gold-700 transition-colors shadow-lg shadow-gold-500/20">Buat Akun Sekarang</button>
        </div>
      </Modal>

      <Modal show={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="Pengaturan Tampilan" size="max-w-2xl">
        <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1 custom-scrollbar">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-sm font-bold text-slate-700 mb-2">Ganti Logo Aplikasi</label>
            <div className="flex items-center space-x-4">
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setFormSettings({ ...formSettings, logoUrl: reader.result as string });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                              className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gold-50 file:text-gold-700 hover:file:bg-gold-100"
                            />
                            {formSettings.logoUrl && (
                <button onClick={() => setFormSettings({ ...formSettings, logoUrl: '' })} className="text-red-600 text-xs font-bold hover:underline">Hapus Logo</button>
              )}
            </div>
            {formSettings.logoUrl && (
              <div className="mt-4 p-2 border border-slate-100 rounded-lg bg-white w-20 h-20 flex items-center justify-center overflow-hidden">
                <img src={formSettings.logoUrl} alt="Pratinjau Logo" className="max-w-full max-h-full object-contain" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SettingInput label="Judul Aplikasi" value={formSettings.title} onChange={v => setFormSettings({...formSettings, title: v})} />
            
            <div className="flex flex-col mb-4">
              <label className="block text-sm font-bold text-slate-700 mb-2">Tema Aplikasi</label>
              <select 
                value={formSettings.theme || 'default'} 
                onChange={e => setFormSettings({...formSettings, theme: e.target.value as any})}
                className="w-full border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-gold-500 py-3 px-4 bg-slate-50 text-sm font-bold text-slate-800"
              >
                <option value="default">Default Emas (Mewah)</option>
                <option value="ocean">Samudra Biru (Profesional)</option>
                <option value="nature">Alam Hijau (Sejuk)</option>
                <option value="monochrome">Monokrom (Klasik/Minimalis)</option>
              </select>
            </div>

            <SettingInput label="Menu Master Data" value={formSettings.menuMasterData} onChange={v => setFormSettings({...formSettings, menuMasterData: v})} />
            <SettingInput label="Menu Jemaat" value={formSettings.menuGereja} onChange={v => setFormSettings({...formSettings, menuGereja: v})} />
            <SettingInput label="Menu Periode" value={formSettings.menuPeriode} onChange={v => setFormSettings({...formSettings, menuPeriode: v})} />
            <SettingInput label="Menu Pembayaran" value={formSettings.menuPembayaran} onChange={v => setFormSettings({...formSettings, menuPembayaran: v})} />
            <SettingInput label="Menu Laporan" value={formSettings.menuLaporan} onChange={v => setFormSettings({...formSettings, menuLaporan: v})} />
            <SettingInput label="Menu Pelean" value={formSettings.menuPelean} onChange={v => setFormSettings({...formSettings, menuPelean: v})} />
            <SettingInput label="Menu Alaman" value={formSettings.menuAlaman} onChange={v => setFormSettings({...formSettings, menuAlaman: v})} />
          </div>

          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h4 className="font-bold text-green-400 mb-4 flex items-center"><MessageCircle size={18} className="mr-2" /> Integrasi Penagihan Otomatis (Watzap.id)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <SettingInput 
                label="Watzap API Key" 
                value={formSettings.watzapApiKey || ''} 
                onChange={v => setFormSettings({...formSettings, watzapApiKey: v})} 
              />
              <SettingInput 
                label="Watzap Sender Number (Device Key)" 
                value={formSettings.watzapSender || ''} 
                onChange={v => setFormSettings({...formSettings, watzapSender: v})} 
              />
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed italic">
              * Digunakan untuk pengiriman tagihan otomatis setiap tanggal 15 & 30. Pastikan Device di Watzap.id dalam status Connected.
            </p>
          </div>

          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h4 className="font-bold text-green-400 mb-4 flex items-center"><Database size={18} className="mr-2" /> Integrasi Database Cloud</h4>
            
            <div className="space-y-4">
              <div className="bg-blue-900/30 p-4 rounded-lg border border-blue-800/50">
                 <h5 className="text-blue-400 font-bold mb-2 flex items-center text-sm">Sinkronisasi Google Drive Otomatis (Baru)</h5>
                 <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                   Client ID sudah ditanam (otomatis). Klik tombol 'Sync ke Drive' atau 'Tarik dari Drive' untuk langsung menghubungkan ke Google Drive Anda.
                 </p>
                 <div className="bg-amber-900/40 p-3 rounded border border-amber-800/50 mb-3 space-y-3">
                   <div>
                     <p className="text-xs text-amber-400 font-bold mb-1">⚠️ Solusi Error 400: redirect_uri_mismatch</p>
                     <p className="text-xs text-amber-200">
                       Jika Anda melihat error ini saat login Google, buka kembali <b>Google Cloud Console</b> Anda, cari Client ID Anda, lalu pada bagian <b>Authorized JavaScript origins (Asal JavaScript yang diizinkan)</b> tambahkan URL berikut:
                     </p>
                     <code className="text-[10px] text-green-400 select-all p-1 bg-black/50 rounded block mt-2 mb-1">https://keuangan-pusat-gkli.vercel.app</code>
                     <code className="text-[10px] text-green-400 select-all p-1 bg-black/50 rounded block">{window.location.origin}</code>
                   </div>
                   <div className="border-t border-amber-800/50 pt-3">
                     <p className="text-xs text-amber-400 font-bold mb-1">⚠️ Solusi Error 403: access_denied</p>
                     <p className="text-xs text-amber-200">
                       Aplikasi Anda di Google Cloud Console masih dalam status <b>Testing</b>. Oleh karena itu, hanya email yang terdaftar sebagai <b>Test users</b> yang bisa login.
                       <br/>
                       Berdasarkan gambar tampilan Google yang baru Anda kirimkan, silakan perhatikan menu di sebelah kiri, klik menu <b>Audience</b> (tepat di bawah tulisan Branding). Di halaman tersebut, cari bagian <b>Test users</b>, klik <b>ADD USERS</b> dan masukkan email Anda (<span className="font-bold">lutheranchurch.priangaol@gmail.com</span>).
                       <br/>
                       <i>Atau</i>, pada halaman yang sama, pastikan status aplikasi (Publishing status) Anda pindah dari <b>Testing</b> menjadi <b>Production</b>.
                     </p>
                   </div>
                   <div className="border-t border-amber-800/50 pt-3">
                     <p className="text-xs text-amber-400 font-bold mb-1">⚠️ Solusi Peringatan: "Google belum memverifikasi aplikasi ini"</p>
                     <p className="text-xs text-amber-200">
                       Peringatan ini <b>wajar</b> muncul karena ini adalah aplikasi pribadi yang mengakses Google Drive Anda dan belum diajukan ke Google untuk verifikasi publik.
                       <br/>
                       <br/>
                       <b>Cara melewatinya:</b><br/>
                       1. Klik tulisan <b>"Lanjutan"</b> (atau "Advanced") di pojok kiri bawah layar Google tersebut.<br/>
                       2. Lalu klik tautan <b>"Buka ..."</b> (atau "Go to ... (unsafe)") yang muncul di bagian paling bawah.
                     </p>
                   </div>
                   <div className="border-t border-amber-800/50 pt-3">
                     <p className="text-xs text-amber-400 font-bold mb-1">⚠️ Solusi Error API Belum Aktif (Drive / Sheets API)</p>
                     <p className="text-xs text-amber-200">
                       Jika Anda mendapati error <b>"Google Sheets API has not been used..."</b> atau <b>"Google Drive API has not been used..."</b>, itu berarti layanannya belum diaktifkan.
                       <br/>
                       <b>Cara paling mudah mengatasinya:</b><br/>
                       1. <b>Salin (Copy) link tautan</b> yang berawalan <code className="text-[10px] bg-black/30 p-0.5 rounded">https://console.developers.google.com/...</code> yang tertera di dalam pesan error tersebut.<br/>
                       2. <b>Buka tab baru</b> di browser Anda, <b>Tempel (Paste)</b> link tersebut lalu tekan Enter.<br/>
                       3. Di halaman Google Cloud yang terbuka, klik tombol biru bertuliskan <b>"ENABLE" (AKTIFKAN)</b>.<br/>
                       4. <b>Sangat Penting:</b> Setelah mengaktifkan, <b>tunggu sekitar 3-5 menit</b> agar sistem Google mendata perubahan tersebut. Setelah itu, baru klik tombol <b>"Sync ke Drive"</b> lagi di aplikasi ini.
                     </p>
                   </div>
                 </div>
                 <p className="text-xs text-amber-500 font-bold italic mb-3">
                   * Anda tidak perlu memasang Apps script lagi.
                 </p>
                 {formSettings.googleSpreadsheetId && (
                   <div className="mt-3 bg-slate-800/80 p-3 rounded border border-slate-700/50 flex flex-col space-y-2">
                     <p className="text-[10px] text-slate-400">Sheet ID Tertaut:</p>
                     <code className="text-xs text-blue-300 break-all">{formSettings.googleSpreadsheetId}</code>
                     <button 
                       type="button"
                       onClick={() => setFormSettings({...formSettings, googleSpreadsheetId: ''})}
                       className="text-white bg-red-600/80 hover:bg-red-600 px-3 py-1.5 rounded text-[10px] font-bold w-max"
                     >
                       Putuskan Tautan Spreadsheet
                     </button>
                   </div>
                 )}
              </div>
              <div className="border-t border-slate-800 pt-4">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Opsional: URL Google Sheets Apps Script (Cara Lama)</label>
                <div className="flex space-x-2">
                  <input 
                    type="text" 
                    value={formSettings.googleSheetUrl} 
                    onChange={v => setFormSettings({...formSettings, googleSheetUrl: v.target.value})} 
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none font-mono text-green-400"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (!formSettings.googleSheetUrl) return alert("Masukkan URL terlebih dahulu");
                      if (!formSettings.googleSheetUrl.includes('/exec')) return alert("⚠️ URL Salah!\n\nHarap gunakan URL hasil Deploy yang berakhiran /exec");
                      window.open(formSettings.googleSheetUrl, '_blank');
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg text-xs font-bold transition-colors"
                  >
                    Cek Koneksi
                  </button>
                </div>
              </div>
              
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  <span className="text-green-500 font-bold">CARA TES:</span> Klik tombol <b>Cek Koneksi</b>. Jika muncul tulisan "API Aktif", berarti link sudah benar. Jika muncul "doGet not found", berarti Anda salah melakukan Deploy.
                </p>
              </div>
            </div>
          </div>

          <button onClick={handleSaveSettings} className="w-full bg-gold-600 text-white py-3 rounded-lg font-bold hover:bg-gold-700 shadow-lg shadow-gold-500/20 transition-all transform hover:scale-[1.01]">Simpan Pengaturan</button>
        </div>
      </Modal>
    </div>
  );
}

// ============= SUB-COMPONENTS =============

function NavItem({ active, onClick, icon, label, className = "" }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, className?: string }) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${
        active 
          ? 'bg-gold-500 text-white shadow-lg shadow-gold-900/40 font-bold' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      } ${className}`}
    >
      <span className={`${active ? 'text-white' : 'text-slate-500 group-hover:text-gold-400'} transition-colors`}>
        {icon}
      </span>
      <span className="text-sm font-medium tracking-tight">{label}</span>
      {active && (
        <motion.div 
          layoutId="activeNavIndicator" 
          className="absolute left-0 w-1 h-6 bg-white rounded-r-full" 
          initial={false}
        />
      )}
      {active && <ChevronRight size={14} className="ml-auto opacity-50" />}
    </button>
  );
}

function NavHeader({ label }: { label: string }) {
  return <p className="text-[10px] text-slate-500 uppercase font-black mt-8 mb-2 px-4 tracking-[0.15em] opacity-80">{label}</p>;
}

function HeaderDownloadBtn({ onClick, icon, label, color }: { onClick: () => void, icon: React.ReactNode, label: string, color: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center space-x-1 hover:bg-white px-2 py-1.5 rounded-md text-[10px] font-bold transition-all ${color} hover:shadow-sm`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function StatCard({ title, value, icon, color, subtitle }: { title: string, value: string, icon: React.ReactNode, color: 'green' | 'red' | 'blue' | 'gold' | 'indigo' | 'emerald' | 'violet', subtitle?: string }) {
  const themes = {
    green: 'from-emerald-500 to-teal-600 shadow-emerald-200/50 text-emerald-600 bg-emerald-50',
    red: 'from-orange-500 to-red-600 shadow-red-200/50 text-red-600 bg-red-50',
    blue: 'from-blue-500 to-blue-600 shadow-blue-200/50 text-blue-600 bg-blue-50',
    gold: 'from-gold-400 to-gold-600 shadow-gold-200/50 text-gold-600 bg-gold-50',
    indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-200/50 text-indigo-600 bg-indigo-50',
    emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-200/50 text-emerald-600 bg-emerald-50',
    violet: 'from-violet-500 to-violet-600 shadow-violet-200/50 text-violet-600 bg-violet-50'
  };
  
  const theme = themes[color] || themes.gold;
  const gradient = theme.split(' shadow')[0];
  const textColor = theme.split(' text')[1]?.split(' bg')[0] || '';
  const bgColor = theme.split(' bg')[1] || '';
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition-all">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-xl ${textColor} ${bgColor}`}>
            {icon}
          </div>
          {subtitle && (
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full uppercase tracking-wider">
              {subtitle}
            </span>
          )}
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1 opacity-80">{title}</p>
        <p className="text-2xl angka-keuangan text-slate-900">
          {value}
        </p>
      </div>
      <div className={`h-1 bg-gradient-to-r ${gradient}`}></div>
    </div>
  );
}

function Modal({ show, onClose, title, children, size = "max-w-md" }: { show: boolean, onClose: () => void, title: string, children: React.ReactNode, size?: string }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`bg-white rounded-2xl shadow-2xl w-full ${size} overflow-hidden`}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-lg text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function SettingInput({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>
      <input 
        type="text" 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-gold-500" 
      />
    </div>
  );
}
