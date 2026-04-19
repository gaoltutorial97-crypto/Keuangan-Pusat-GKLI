import React, { useState, useEffect, useMemo } from 'react';
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
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Church, Payment, User, AppSettings, TabType } from './types';
import { INITIAL_CHURCHES, DEFAULT_SETTINGS, SPREADSHEET_COLUMNS, CATEGORY_LABELS } from './constants';

export default function App() {
  // STATE NAVIGASI
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  // STATE USER & LOGIN
  const [users, setUsers] = useState<User[]>(() => {
    const mandatoryUsers: User[] = [
      { username: 'kpt_gkli@yahoo.com', password: '@Reformasi1517', role: 'superadmin' },
      { username: 'GKLI180565', password: 'LUTHERAN', role: 'staff' }
    ];
    try {
      const saved = localStorage.getItem('gkli_users');
      if (saved) {
        const parsed = JSON.parse(saved) as User[];
        // Filter out mandatory users from saved list to avoid duplicates, then combine
        const filteredParsed = parsed.filter(u => !mandatoryUsers.some(m => m.username === u.username));
        return [...mandatoryUsers, ...filteredParsed];
      }
      return mandatoryUsers;
    } catch { return mandatoryUsers; }
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isGatePassed, setIsGatePassed] = useState(() => {
    return sessionStorage.getItem('gkli_gate_passed') === 'true';
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [gateForm, setGateForm] = useState({ username: '', password: '' });
  const [showUserModal, setShowUserModal] = useState(false);
  const [formUser, setFormUser] = useState<User>({ username: '', password: '', role: 'staff' });

  // STATE PENGATURAN TAMPILAN
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('gkli_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [formSettings, setFormSettings] = useState(DEFAULT_SETTINGS);

  // STATE DATA GEREJA & PEMBAYARAN
  const [churches, setChurches] = useState<Church[]>(() => {
    try {
      const saved = localStorage.getItem('gkli_churches');
      return saved ? JSON.parse(saved) : INITIAL_CHURCHES;
    } catch { return INITIAL_CHURCHES; }
  });
  const [payments, setPayments] = useState<Payment[]>(() => {
    try {
      const saved = localStorage.getItem('gkli_payments');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // EFEK AUTO SAVE KE BROWSER
  useEffect(() => { localStorage.setItem('gkli_users', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('gkli_churches', JSON.stringify(churches)); }, [churches]);
  useEffect(() => { localStorage.setItem('gkli_payments', JSON.stringify(payments)); }, [payments]);
  useEffect(() => { localStorage.setItem('gkli_settings', JSON.stringify(appSettings)); }, [appSettings]);

  // STATE PERIODE TAHUN
  const [periods, setPeriods] = useState(['Tahun 2021', 'Tahun 2022', 'Tahun 2023', 'Tahun 2024', 'Tahun 2025', 'Tahun 2026']);
  const [periodeAktif, setPeriodeAktif] = useState('Tahun 2026');
  const [newPeriod, setNewPeriod] = useState('');

  // STATE CETAK & DOWNLOAD
  const [printData, setPrintData] = useState<any>(null);
  const [printType, setPrintType] = useState<string | null>(null); 
  const [downloadKategori, setDownloadKategori] = useState<'laporan' | 'pelean' | 'alaman'>('laporan');

  // STATE MODAL LAINNYA
  const [showChurchModal, setShowChurchModal] = useState(false);
  const [formChurch, setFormChurch] = useState<Church>({ id: '', nama: '', resort: '', wa: '' });
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [selectedCells, setSelectedCells] = useState<Record<string, string[]>>({}); // { gerejaId: [colName1, colName2] }
  const [sessionUpdatedCells, setSessionUpdatedCells] = useState<Record<string, Record<string, string[]>>>({}); // { gerejaId: { kategori: [colName1, colName2] } }

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

  // ==========================================
  // FUNGSI PERHITUNGAN LAPORAN
  // ==========================================
  const getLaporanData = (kategori: 'laporan' | 'pelean' | 'alaman') => {
    const columns = SPREADSHEET_COLUMNS[kategori];
    return churches.map(gereja => {
      const pembayaran = payments.find(p => p.gerejaId === gereja.id && p.kategori === kategori && p.periode === periodeAktif);
      
      let isLunas = false;
      if (pembayaran && pembayaran.details) {
        isLunas = columns.every(col => (pembayaran.details[col] || 0) > 0);
      }

      return {
        ...gereja,
        status: isLunas ? 'Lunas' : 'Menunggak',
        jumlah: pembayaran ? pembayaran.jumlah : 0,
        tanggal: pembayaran ? pembayaran.tanggal : null,
        details: pembayaran && pembayaran.details ? pembayaran.details : {},
        kategori: kategori,
        periode: periodeAktif
      };
    });
  };

  const dataAlaman = useMemo(() => getLaporanData('alaman'), [churches, payments, periodeAktif]);
  const dataPelean = useMemo(() => getLaporanData('pelean'), [churches, payments, periodeAktif]);
  const dataLaporanKeuangan = useMemo(() => getLaporanData('laporan'), [churches, payments, periodeAktif]);

  const lunasChurches = useMemo(() => {
    return churches.filter(church => {
      const isLaporanLunas = dataLaporanKeuangan.find(d => d.id === church.id)?.status === 'Lunas';
      const isPeleanLunas = dataPelean.find(d => d.id === church.id)?.status === 'Lunas';
      const isAlamanLunas = dataAlaman.find(d => d.id === church.id)?.status === 'Lunas';
      return isLaporanLunas && isPeleanLunas && isAlamanLunas;
    });
  }, [churches, dataLaporanKeuangan, dataPelean, dataAlaman]);

  const totalPemasukan = useMemo(() => payments
    .filter(p => p.periode === periodeAktif && p.jumlah > 0)
    .reduce((sum, item) => sum + item.jumlah, 0), [payments, periodeAktif]);
  
  const stats = useMemo(() => {
    let totalMenunggak = 0;
    let totalLunas = 0;

    [dataAlaman, dataPelean, dataLaporanKeuangan].forEach((dataset) => {
      dataset.forEach(item => {
        if (item.status === 'Menunggak') {
          totalMenunggak++;
        } else {
          totalLunas++;
        }
      });
    });
    return { totalMenunggak, totalLunas };
  }, [dataAlaman, dataPelean, dataLaporanKeuangan]);

  const churchesWithArrears = useMemo(() => {
    return churches.map(church => {
      const arrears: Record<string, string[]> = {};
      let hasArrears = false;

      Object.entries(SPREADSHEET_COLUMNS).forEach(([cat, cols]) => {
        const payment = payments.find(p => p.gerejaId === church.id && p.kategori === cat && p.periode === periodeAktif);
        const unpaid = cols.filter(col => !payment || !payment.details[col] || payment.details[col] === 0);
        if (unpaid.length > 0) {
          arrears[cat] = unpaid;
          hasArrears = true;
        }
      });

      return hasArrears ? { ...church, arrears } : null;
    }).filter((c): c is (Church & { arrears: Record<string, string[]> }) => c !== null);
  }, [churches, payments, periodeAktif]);

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

  const handleLogin = () => {
    const foundUser = users.find(u => u.username === loginForm.username && u.password === loginForm.password);
    if (foundUser) {
      setCurrentUser(foundUser);
      setShowLoginModal(false);
      setLoginForm({ username: '', password: '' });
    } else {
      alert('Email atau Password salah!');
    }
  };

  const handleSaveUser = () => {
    if (!formUser.username || !formUser.password) return alert('Username dan Password wajib diisi!');
    
    setUsers(prev => {
      const exists = prev.findIndex(u => u.username === formUser.username);
      if (exists !== -1) {
        const updated = [...prev];
        updated[exists] = { ...formUser };
        return updated;
      }
      return [...prev, { ...formUser }];
    });
    
    setShowUserModal(false);
    setFormUser({ username: '', password: '', role: 'staff' });
    alert('Akun berhasil disimpan!');
  };

  const handleDeleteUser = (username: string) => {
    if (username === 'kpt_gkli@yahoo.com') return alert('Akun utama tidak dapat dihapus!');
    if (window.confirm(`Yakin ingin menghapus akses akun ${username}?`)) {
      setUsers(users.filter(u => u.username !== username));
    }
  };

  const handleSaveSettings = () => {
    if (currentUser?.role !== 'superadmin') return;
    setAppSettings(formSettings);
    setShowSettingsModal(false);
  };

  const handleCellChange = (gerejaId: string, kategori: 'laporan' | 'pelean' | 'alaman', field: string, value: string) => {
    if (!currentUser) return; 

    let numValue = parseInt(value.replace(/[^0-9]/g, ''));
    if (isNaN(numValue)) numValue = 0;

    setPayments(prev => {
      const existingIdx = prev.findIndex(p => p.gerejaId === gerejaId && p.kategori === kategori && p.periode === periodeAktif);
      
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

      if (existingIdx >= 0) {
        const updated = [...prev];
        const payment = { ...updated[existingIdx] };
        payment.details = { ...payment.details, [field]: numValue };
        payment.jumlah = Object.values(payment.details).reduce((sum: number, val: number) => sum + (val || 0), 0);
        payment.tanggal = new Date().toISOString().split('T')[0];
        updated[existingIdx] = payment;
        return updated;
      } else {
        return [...prev, {
          id: 'P-' + Math.floor(Math.random() * 100000),
          gerejaId, kategori, periode: periodeAktif,
          details: { [field]: numValue },
          jumlah: numValue,
          tanggal: new Date().toISOString().split('T')[0]
        }];
      }
    });
  };

  const handleSaveChurch = () => {
    if (!currentUser) return;
    if (!formChurch.nama) return alert('Nama wajib diisi!');
    if (formChurch.id) {
      setChurches(churches.map(c => c.id === formChurch.id ? formChurch : c));
    } else {
      const newId = (churches.length + 1).toString();
      setChurches([...churches, { ...formChurch, id: newId }]);
    }
    setShowChurchModal(false);
    setFormChurch({ id: '', nama: '', resort: '', wa: '' });
  };

  const handleKirimWASpesifik = (item: any, colName: string) => {
    const val = item.details[colName] || 0;
    const catLabel = CATEGORY_LABELS[item.kategori] || item.kategori;
    let text = "";
    if (val > 0) {
      text = `Syalom Bapak/Ibu Majelis Jemaat ${item.nama}, kami dari Kantor Pusat GKLI mengucapkan terima kasih atas persembahan *${colName.toUpperCase()}* (${catLabel.toUpperCase()}) periode ${item.periode} sebesar *Rp ${formatRupiah(val)}*. Tuhan memberkati.`;
    } else {
      text = `Syalom Bapak/Ibu Majelis Jemaat ${item.nama}, dari Kantor Pusat GKLI ingin mengingatkan bahwa catatan kas kami untuk item *${colName.toUpperCase()}* (${catLabel.toUpperCase()}) periode ${item.periode} masih kosong (menunggak). Mohon agar dapat segera diselesaikan. Terima kasih, Tuhan memberkati.`;
    }
    window.open(`https://wa.me/${item.wa}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleKirimWABatch = (item: any) => {
    const selected = selectedCells[item.id] || [];
    if (selected.length === 0) return;

    const catLabel = CATEGORY_LABELS[item.kategori] || item.kategori;
    const details = selected.map(col => `- *${col.toUpperCase()}*: Rp ${formatRupiah(item.details[col])}`).join('\n');
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

  const handleBulkImport = () => {
    if (!currentUser) return;
    if (!bulkText.trim()) return;
    const lines = bulkText.split('\n');
    const newChurches = [...churches];
    lines.forEach(line => {
      const cols = line.split('\t');
      if (cols.length > 0 && cols[0].trim() !== '') {
        const newId = (newChurches.length + 1).toString();
        newChurches.push({
          id: newId,
          nama: cols[0].trim(),
          resort: cols[1] ? cols[1].trim() : '-',
          wa: cols[2] ? cols[2].trim() : ''
        });
      }
    });
    setChurches(newChurches);
    setShowBulkModal(false);
    setBulkText('');
  };

  const syncToGoogleSheets = async () => {
    if (!appSettings.googleSheetUrl) {
      alert("Silakan atur URL Google Apps Script di Pengaturan terlebih dahulu.");
      return;
    }
    
    const confirmSync = window.confirm("Apakah Anda ingin mencadangkan seluruh data ke Google Sheet?");
    if (!confirmSync) return;

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

      // Kita menghapus header 'Content-Type': 'application/json' karena sering memicu error CORS 
      // pada fetch mode 'no-cors'. Google Apps Script tetap bisa membaca body-nya.
      await fetch(appSettings.googleSheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(data)
      });

      alert("Data berhasil dikirim ke antrean Google Sheet!\n\nCatatan: Karena alasan keamanan browser, kami tidak bisa memastikan data sudah masuk atau belum secara otomatis. Silakan periksa Spreadsheet Anda.");
    } catch (error) {
      console.error("Sync Error:", error);
      alert("Gagal menghubungi Google Sheet.\n\nTips: Pastikan URL diakhiri dengan '/exec' dan Apps Script sudah dideploy dengan akses 'Anyone'.");
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
      csvContent += `Total Pemasukan ${periodeAktif},Rp ${totalPemasukan}\n`;
      csvContent += `Total Lunas,${stats.totalLunas} Jemaat\n`;
      csvContent += `Total Menunggak,${stats.totalMenunggak} Jemaat\n`;
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

  const handleAddPeriod = () => {
    if (!currentUser) return alert('Silakan login untuk menambah periode.');
    if (newPeriod.trim() !== '' && !periods.includes(newPeriod.trim())) {
      setPeriods([...periods, newPeriod.trim()]);
      setNewPeriod('');
    }
  };

  const formatRupiah = (angka: number) => {
    if (!angka || angka === 0) return '-';
    return new Intl.NumberFormat('id-ID').format(angka);
  };

  const formatInput = (angka: number) => {
    if (!angka || angka === 0) return '';
    return new Intl.NumberFormat('id-ID').format(angka);
  };

  const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

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
          <div className="bg-blue-600 p-8 text-center text-white">
            <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md overflow-hidden">
              {appSettings.logoUrl ? (
                <img src={appSettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <LayoutDashboard size={40} />
              )}
            </div>
            <h1 className="text-2xl font-bold">{appSettings.title}</h1>
            <p className="text-blue-100 mt-2">Akses Terbatas: Silakan Masuk</p>
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
                    className="w-full border border-slate-200 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
                    className="w-full border border-slate-200 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Password Akses"
                    onKeyDown={e => e.key === 'Enter' && handleGateLogin()}
                  />
                </div>
              </div>
            </div>
            <button 
              onClick={handleGateLogin} 
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
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
      <div className="min-h-screen bg-white p-10 font-serif">
        <div className="no-print fixed top-0 left-0 right-0 bg-slate-900 text-white p-4 flex justify-between items-center z-50">
          <h3 className="font-bold">Mode Siap Cetak</h3>
          <div className="flex gap-2">
            <button onClick={() => setPrintType(null)} className="px-4 py-2 bg-slate-700 rounded">Kembali</button>
            <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 rounded">Cetak Sekarang</button>
          </div>
        </div>
        <div className="print-section mt-16">
           {/* Header */}
           <div className="text-center border-b-4 border-double border-black pb-4 mb-6">
              {templates.kopSurat ? (
                <img src={templates.kopSurat} alt="Kop Surat" className="w-full mx-auto" />
              ) : (
                <div className="flex items-center justify-center space-x-6">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-[10px] italic overflow-hidden">
                    {appSettings.logoUrl ? (
                      <img src={appSettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      "Logo GKLI"
                    )}
                  </div>
                  <div className="text-center">
                    <h1 className="text-xl font-bold">KANTOR PUSAT</h1>
                    <h2 className="text-3xl font-bold text-blue-800">GEREJA KRISTEN LUTHER INDONESIA</h2>
                    <p className="text-red-600 font-bold italic">(INDONESIAN CHRISTIAN LUTHERAN CHURCH)</p>
                    <p className="text-[10px] font-bold mt-1">DIDIRIKAN: 18 MEI 1965, AKTE NOTARIS NOMOR 30</p>
                    <p className="text-[10px] font-bold">S. K. DEP. AGAMA RI: Dp/II/137/1967, NOMOR 148 TAHUN 1988 TANGGAL 2-7-1988</p>
                    <p className="text-[10px] mt-1">Sihabonghabong, Kec. Parlilitan, Kab. Humbang Hasundutan, Prov. Sumatera Utara, 22456</p>
                    <p className="text-[10px] font-bold text-red-600 mt-1 uppercase tracking-widest">Anggota Persekutuan Gereja-Gereja di Indonesia (PGI)</p>
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
            ) : printType === 'penerimaan' || printType === 'tunggakan' || printType === 'global-receipt' || printType === 'global-arrears' ? (
             <div className="space-y-6">
                <div className="flex justify-between">
                  <div>
                    <p>Nomor: {printType === 'tunggakan' || printType === 'global-arrears' ? '1.953/P.10' : '1.952/E.12'}/IV/2026</p>
                    <p>Hal: <b>{printType === 'tunggakan' || printType === 'global-arrears' ? 'Bukti Tunggakan Administrasi' : printType === 'global-receipt' ? 'Bukti Penerimaan Gabungan' : 'Bukti Penerimaan Setoran'}</b></p>
                  </div>
                  <div className="text-right">
                    <p>Sihabonghabong, {today}</p>
                    <p className="mt-4">Kepada Yth,</p>
                    <p className="font-bold">{printData.nama}</p>
                    <p>Resort {printData.resort}</p>
                  </div>
                </div>
                <div className="text-justify leading-relaxed">
                  <p>Salam sejahtera dalam Nama Tuhan Yesus Kristus!</p>
                  <p className="mt-4">
                    {printType === 'tunggakan' || printType === 'global-arrears'
                      ? `Berdasarkan catatan kas kami hingga tanggal ${today}, berikut adalah rincian tunggakan administrasi periode ${printData.periode} yang belum kami terima:`
                      : `Kami mengucapkan terima kasih atas persembahan periode ${printData.periode} yang telah kami terima dengan rincian sebagai berikut:`
                    }
                  </p>
                  <div className="pl-8 my-4">
                    {printType === 'global-receipt' ? (
                      <div className="space-y-4">
                        {Object.entries(printData.updates).map(([cat, fields]: [any, any]) => (
                          <div key={cat} className="border border-black p-4 rounded">
                            <h4 className="font-bold border-b border-black mb-2 uppercase">{CATEGORY_LABELS[cat] || cat}</h4>
                            <table className="w-full">
                              <tbody>
                                {fields.map((f: string) => (
                                  <tr key={f}>
                                    <td>{f}</td>
                                    <td className="text-right">{formatRupiah(printData.allDetails[cat]?.[f] || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    ) : printType === 'global-arrears' ? (
                      <div className="space-y-4">
                        {Object.entries(printData.details).map(([cat, fields]: [any, any]) => (
                          <div key={cat} className="border border-black p-4 rounded">
                            <h4 className="font-bold border-b border-black mb-2 uppercase">{CATEGORY_LABELS[cat] || cat}</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {fields.map((f: string) => (
                                <div key={f} className="flex items-center space-x-2">
                                  <div className="w-2 h-2 bg-black rounded-full"></div>
                                  <span>{f}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <table className="w-full border-collapse border border-black">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-black p-2 text-left">Item Persembahan</th>
                            <th className="border border-black p-2 text-right">Jumlah (Rp)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {printData.items.map((col: string) => (
                            <tr key={col}>
                              <td className="border border-black p-2">{col}</td>
                              <td className="border border-black p-2 text-right">{formatRupiah(printData.details[col] || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  {printType !== 'global-arrears' && (
                    <div className="flex justify-between font-bold text-lg border-t-2 border-black pt-2">
                      <span>TOTAL KESELURUHAN</span>
                      <span>Rp {formatRupiah(printData.total)}</span>
                    </div>
                  )}
                  <p className="mt-6">
                    {printType === 'tunggakan' || printType === 'global-arrears'
                      ? "Kami memohon kesediaan bapak/ibu Majelis Jemaat untuk dapat segera menyelesaikan kewajiban administrasi tersebut. Tuhan memberkati."
                      : "Kiranya Tuhan Yesus senantiasa memberkati pelayanan kita."
                    }
                  </p>
                </div>
                <div className="flex justify-end mt-20">
                  <div className="text-center">
                    {((printType === 'peringatan' || printType === 'tunggakan' || printType === 'global-arrears') && templates.stempelTunggakan) || 
                     ((printType === 'terimakasih' || printType === 'penerimaan' || printType === 'global-receipt') && templates.stempelTerimaKasih) ? (
                      <img 
                        src={(printType === 'peringatan' || printType === 'tunggakan' || printType === 'global-arrears') ? templates.stempelTunggakan : templates.stempelTerimaKasih} 
                        alt="Stempel & Tanda Tangan" 
                        className="max-h-64 mx-auto"
                      />
                    ) : (
                      <>
                        <p>Teriring Salam dan Doa</p>
                        <p>Pucuk Pimpinan GKLI</p>
                        <p className="mb-4">A.n. Bishop</p>
                        <div className="h-24"></div>
                        <p className="font-bold underline">Pdt. Lamris Malau, M.Th.</p>
                        <p>Sekretaris Jenderal</p>
                      </>
                    )}
                  </div>
                </div>
             </div>
           ) : (
             <div className="space-y-6">
                <div className="flex justify-between">
                  <div>
                    <p>Nomor: {printType === 'peringatan' ? '1.953/P.10' : '1.952/E.12'}/IV/2026</p>
                    <p>Hal: <b>{printType === 'peringatan' ? 'Peringatan Administrasi' : 'Ucapan Terimakasih'}</b></p>
                  </div>
                  <div className="text-right">
                    <p>Sihabonghabong, {today}</p>
                    <p className="mt-4">Kepada Yth,</p>
                    <p className="font-bold">{printData.nama}</p>
                    <p>Resort {printData.resort}</p>
                  </div>
                </div>
                <div className="text-justify leading-relaxed whitespace-pre-wrap">
                  <p>Salam sejahtera dalam Nama Tuhan Yesus Kristus!</p>
                  <div className="mt-4">
                    {(printType === 'peringatan' ? templates.suratTunggakan : templates.suratTerimaKasih)
                      .replace('[NAMA_JEMAAT]', printData.nama)
                      .replace('[RESORT]', printData.resort)
                      .replace('[JUMLAH]', formatRupiah(printData.jumlah))
                      .replace('[KATEGORI]', (CATEGORY_LABELS[printData.kategori] || printData.kategori).toUpperCase())
                      .replace('[PERIODE]', printData.periode)
                      .replace('[TANGGAL]', today)
                    }
                  </div>
                </div>
                <div className="flex justify-end mt-20">
                  <div className="text-center">
                    {((printType === 'peringatan' || printType === 'tunggakan' || printType === 'global-arrears') && templates.stempelTunggakan) || 
                     ((printType === 'terimakasih' || printType === 'penerimaan' || printType === 'global-receipt') && templates.stempelTerimaKasih) ? (
                      <img 
                        src={(printType === 'peringatan' || printType === 'tunggakan' || printType === 'global-arrears') ? templates.stempelTunggakan : templates.stempelTerimaKasih} 
                        alt="Stempel & Tanda Tangan" 
                        className="max-h-64 mx-auto"
                      />
                    ) : (
                      <>
                        <p>Teriring Salam dan Doa</p>
                        <p>Pucuk Pimpinan GKLI</p>
                        <p className="mb-4">A.n. Bishop</p>
                        <div className="h-24"></div>
                        <p className="font-bold underline">Pdt. Lamris Malau, M.Th.</p>
                        <p>Sekretaris Jenderal</p>
                      </>
                    )}
                  </div>
                </div>
             </div>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full z-20 shadow-xl no-print">
        <div className="p-6 flex items-center space-x-3 border-b border-slate-800">
          <div className="bg-blue-600 p-2 rounded-lg overflow-hidden flex items-center justify-center w-10 h-10">
            {appSettings.logoUrl ? (
              <img src={appSettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <LayoutDashboard size={24} />
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">{appSettings.title}</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">
              {currentUser?.role === 'superadmin' ? 'Admin Utama' : 'Staf Pengisi'}
            </p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem active={activeTab === 'pengiriman'} onClick={() => setActiveTab('pengiriman')} icon={<MessageCircle size={20} className="text-green-500" />} label="Pusat Pengiriman" className="text-green-500 font-bold" />
          <NavItem active={activeTab === 'penagihan'} onClick={() => setActiveTab('penagihan')} icon={<AlertTriangle size={20} className="text-red-500" />} label="Pusat Penagihan" className="text-red-500 font-bold" />
          <NavItem active={activeTab === 'sertifikat'} onClick={() => setActiveTab('sertifikat')} icon={<Award size={20} className="text-yellow-500" />} label="Sertifikat Penghargaan" className="text-yellow-500 font-bold" />
          
          <NavHeader label={appSettings.menuMasterData} />
          <NavItem active={activeTab === 'gereja'} onClick={() => setActiveTab('gereja')} icon={<Users size={20} />} label={appSettings.menuGereja} />
          <NavItem active={activeTab === 'periode'} onClick={() => setActiveTab('periode')} icon={<Calendar size={20} />} label={appSettings.menuPeriode} />

          <NavHeader label={appSettings.menuPembayaran} />
          <NavItem active={activeTab === 'laporan'} onClick={() => setActiveTab('laporan')} icon={<FileText size={20} />} label={appSettings.menuLaporan} />
          <NavItem active={activeTab === 'pelean'} onClick={() => setActiveTab('pelean')} icon={<FileText size={20} />} label={appSettings.menuPelean} />
          <NavItem active={activeTab === 'alaman'} onClick={() => setActiveTab('alaman')} icon={<FileText size={20} />} label={appSettings.menuAlaman} />

          <NavHeader label={appSettings.menuRekapJudul} />
          <NavItem active={activeTab === 'download'} onClick={() => setActiveTab('download')} icon={<Download size={20} />} label={appSettings.menuDownloadMenu} />

          {currentUser?.role === 'superadmin' && (
            <>
              <NavHeader label="Pengaturan Sistem" />
              <NavItem active={activeTab === 'templates'} onClick={() => setActiveTab('templates')} icon={<FileText size={20} className="text-yellow-500" />} label="Manajemen Template" className="text-yellow-500" />
              <NavItem active={false} onClick={() => { setFormSettings(appSettings); setShowSettingsModal(true); }} icon={<Settings size={20} className="text-yellow-500" />} label="Edit Tampilan" className="text-yellow-500" />
              <NavItem active={activeTab === 'akun'} onClick={() => setActiveTab('akun')} icon={<UserPlus size={20} className="text-yellow-500" />} label="Manajemen Akun" className="text-yellow-500" />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          {currentUser ? (
            <button onClick={() => setCurrentUser(null)} className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-red-400 hover:bg-slate-800 transition-colors">
              <LogOut size={20} />
              <span className="text-sm font-semibold">Keluar</span>
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
      <main className="flex-1 ml-64 min-h-screen flex flex-col">
        <header className="bg-white shadow-sm px-8 py-4 flex justify-between items-center sticky top-0 z-10 no-print">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-slate-800">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
              <HeaderDownloadBtn onClick={() => handleDownloadCurrentMenu('excel')} icon={<Download size={14} />} label="Excel" color="text-green-600" />
              {currentUser?.role === 'superadmin' && (
                <HeaderDownloadBtn onClick={() => handleDownloadCurrentMenu('word')} icon={<FileText size={14} />} label="Word" color="text-blue-600" />
              )}
              <HeaderDownloadBtn onClick={() => handleDownloadCurrentMenu('pdf')} icon={<Printer size={14} />} label="PDF" color="text-red-600" />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <span className="text-xs text-slate-500 font-bold mr-2">PERIODE AKTIF:</span>
              <select 
                value={periodeAktif} 
                onChange={(e) => setPeriodeAktif(e.target.value)}
                className="bg-transparent text-sm font-bold text-blue-700 outline-none cursor-pointer"
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
              {activeTab === 'penagihan' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="font-bold text-lg">Pusat Penagihan Tunggakan</h3>
                        <p className="text-sm text-slate-500">Daftar jemaat yang memiliki tunggakan (belum lunas) pada periode {periodeAktif}.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {churchesWithArrears.map(church => {
                        const summaryLines: string[] = [];
                        Object.entries(church.arrears).forEach(([cat, fields]) => {
                          const f = fields as string[];
                          summaryLines.push(`*${(CATEGORY_LABELS[cat] || cat).toUpperCase()}*:`);
                          summaryLines.push(`  - ${f.join(', ')}`);
                        });

                        return (
                          <div key={church.id} className="border border-red-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow bg-red-50/10">
                            <div className="bg-red-50 p-4 border-b border-red-100 flex justify-between items-center">
                              <div>
                                <h4 className="font-bold text-slate-800">{church.nama}</h4>
                                <p className="text-xs text-slate-500">Resort {church.resort}</p>
                              </div>
                              <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                                Ada Tunggakan
                              </div>
                            </div>
                            <div className="p-4 flex flex-col md:flex-row gap-4">
                              <div className="flex-1 bg-white p-3 rounded-lg border border-red-50">
                                <p className="text-[10px] font-bold text-red-400 uppercase mb-2">Daftar Item Belum Terbayar:</p>
                                <div className="text-xs text-slate-600 space-y-2">
                                  {Object.entries(church.arrears).map(([cat, fields]) => (
                                    <div key={cat}>
                                      <span className="font-bold text-slate-800">{(CATEGORY_LABELS[cat] || cat).toUpperCase()}:</span>
                                      <p className="pl-2 text-red-600">{(fields as string[]).join(', ')}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="flex flex-col justify-center space-y-2 min-w-[150px]">
                                <button 
                                  onClick={() => {
                                    const text = `Syalom Bapak/Ibu Majelis Jemaat ${church.nama}, kami dari Kantor Pusat GKLI ingin mengingatkan terkait kewajiban persembahan periode ${periodeAktif} yang belum kami terima (Tunggakan):\n\n${summaryLines.join('\n')}\n\nMohon kerja samanya untuk segera melengkapi setoran tersebut. Kiranya Tuhan Yesus memberkati.`;
                                    window.open(`https://wa.me/${church.wa}?text=${encodeURIComponent(text)}`, '_blank');
                                  }}
                                  className="flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
                                >
                                  <MessageCircle size={16} /> <span>Tagih via WA</span>
                                </button>
                                <button 
                                  onClick={() => {
                                    setPrintData({
                                      nama: church.nama,
                                      resort: church.resort,
                                      periode: periodeAktif,
                                      kategori: 'Gabungan',
                                      details: church.arrears,
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

              {activeTab === 'pengiriman' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="font-bold text-lg">Pusat Pengiriman Terima Kasih</h3>
                        <p className="text-sm text-slate-500">Daftar jemaat yang baru saja melakukan pembayaran di sesi ini.</p>
                      </div>
                      <button 
                        onClick={() => setSessionUpdatedCells({})}
                        className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg border border-red-100 transition-colors"
                      >
                        Bersihkan Daftar Baru
                      </button>
                    </div>

                    {Object.keys(sessionUpdatedCells).length === 0 ? (
                      <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <MessageCircle size={48} className="mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500 font-medium">Belum ada data pembayaran baru yang diisi di sesi ini.</p>
                        <p className="text-xs text-slate-400 mt-2">Silakan isi angka pada menu Laporan, Pelean, atau Almanak terlebih dahulu.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-6">
                        {Object.entries(sessionUpdatedCells).map(([gerejaId, updates]) => {
                          const church = churches.find(c => c.id === gerejaId);
                          if (!church) return null;

                          let totalGabungan = 0;
                          const summaryLines: string[] = [];

                          Object.entries(updates).forEach(([cat, fields]) => {
                            const payment = payments.find(p => p.gerejaId === gerejaId && p.kategori === cat && p.periode === periodeAktif);
                            if (payment) {
                              summaryLines.push(`*${(CATEGORY_LABELS[cat] || cat).toUpperCase()}*:`);
                              fields.forEach(f => {
                                const val = payment.details[f] || 0;
                                totalGabungan += val;
                                summaryLines.push(`- ${f}: Rp ${formatRupiah(val)}`);
                              });
                            }
                          });

                          return (
                            <div key={gerejaId} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                              <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                                <div>
                                  <h4 className="font-bold text-slate-800">{church.nama}</h4>
                                  <p className="text-xs text-slate-500">Resort {church.resort}</p>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Total Baru</p>
                                  <p className="font-bold text-blue-600">Rp {formatRupiah(totalGabungan)}</p>
                                  <button 
                                    onClick={() => {
                                      const newSess = { ...sessionUpdatedCells };
                                      delete newSess[gerejaId];
                                      setSessionUpdatedCells(newSess);
                                    }}
                                    className="text-[10px] text-red-500 hover:underline mt-1"
                                  >
                                    Hapus dari Daftar
                                  </button>
                                </div>
                              </div>
                              <div className="p-4 flex flex-col md:flex-row gap-4">
                                  <div className="flex-1 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Rincian Pembayaran Baru:</p>
                                    <div className="text-xs text-slate-600 space-y-1">
                                      {Object.entries(updates).map(([cat, fields]) => (
                                        <div key={cat} className="mb-2">
                                          <p className="font-bold text-slate-800">{(CATEGORY_LABELS[cat] || cat).toUpperCase()}</p>
                                          <p className="pl-2">{(fields as string[]).join(', ')}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                <div className="flex flex-col justify-center space-y-2 min-w-[150px]">
                                  <button 
                                    onClick={() => {
                                      const text = `Syalom Bapak/Ibu Majelis Jemaat ${church.nama}, kami dari Kantor Pusat GKLI mengucapkan terima kasih atas persembahan periode ${periodeAktif} yang baru saja kami terima:\n\n${summaryLines.join('\n')}\n\n*Total Keseluruhan: Rp ${formatRupiah(totalGabungan)}*\n\nKiranya Tuhan Yesus senantiasa memberkati pelayanan kita.`;
                                      window.open(`https://wa.me/${church.wa}?text=${encodeURIComponent(text)}`, '_blank');
                                    }}
                                    className="flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
                                  >
                                    <MessageCircle size={16} /> <span>Kirim WA</span>
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const allDetails: any = {};
                                      payments.filter(p => p.gerejaId === gerejaId && p.periode === periodeAktif).forEach(p => {
                                        allDetails[p.kategori] = p.details;
                                      });
                                      setPrintData({
                                        nama: church.nama,
                                        resort: church.resort,
                                        periode: periodeAktif,
                                        updates,
                                        allDetails,
                                        total: totalGabungan
                                      });
                                      setPrintType('global-receipt');
                                    }}
                                    className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                                  >
                                    <Printer size={16} /> <span>Cetak Bukti</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <StatCard title={`Total Pemasukan (${periodeAktif})`} value={`Rp ${formatRupiah(totalPemasukan)}`} icon={<Save className="text-green-600" />} color="green" />
                    <StatCard title="Status Laporan" value={`${stats.totalLunas} Lunas / ${stats.totalMenunggak} Nunggak`} icon={<CheckCircle2 className="text-blue-600" />} color="blue" />
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 flex items-start space-x-4">
                    <div className="bg-blue-100 p-3 rounded-full">
                      <AlertTriangle className="text-blue-600" size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-blue-800 mb-1">
                        {currentUser ? `Akses ${currentUser.role === 'superadmin' ? 'Admin' : 'Staf'} Aktif` : "Akses Terbatas (Tamu)"}
                      </h3>
                      <p className="text-sm text-blue-700 leading-relaxed">
                        {currentUser 
                          ? `Anda masuk sebagai ${currentUser.role === 'superadmin' ? 'Administrator Utama' : 'Staf Pengisi Data'}. Anda dapat mengelola data keuangan dan jemaat.`
                          : "Silakan login untuk mendapatkan akses penuh dalam mengelola data keuangan dan administrasi GKLI."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'sertifikat' && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-yellow-500 to-amber-600 p-8 rounded-2xl text-white shadow-lg">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                        <Award size={32} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">Apresiasi Prestasi Penyetoran</h2>
                        <p className="text-yellow-100">Daftar jemaat yang telah menyelesaikan seluruh kewajiban administrasi periode {periodeAktif}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                      <h3 className="font-bold text-lg">Jemaat Berprestasi (Lunas Seluruhnya)</h3>
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
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg">Daftar Jemaat</h3>
                    {currentUser && (
                      <div className="flex gap-2">
                        <button onClick={() => setShowBulkModal(true)} className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">
                          <Plus size={16} /> <span>Import Massal</span>
                        </button>
                        <button onClick={() => { setFormChurch({ id: '', nama: '', resort: '', wa: '' }); setShowChurchModal(true); }} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                          <Plus size={16} /> <span>Tambah Jemaat</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                        <tr>
                          <th className="px-6 py-4">No</th>
                          <th className="px-6 py-4">Nama Jemaat</th>
                          <th className="px-6 py-4">Resort</th>
                          {currentUser?.role === 'superadmin' && <th className="px-6 py-4">WhatsApp</th>}
                          {currentUser && <th className="px-6 py-4 text-center">Aksi</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {churches.map((church) => (
                          <tr key={church.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-slate-500 font-medium">{church.id}</td>
                            <td className="px-6 py-4 font-bold text-slate-800">{church.nama}</td>
                            <td className="px-6 py-4 text-slate-600">{church.resort}</td>
                            {currentUser?.role === 'superadmin' && <td className="px-6 py-4 text-slate-600">{church.wa || '-'}</td>}
                            {currentUser && (
                              <td className="px-6 py-4 text-center">
                                <button onClick={() => { setFormChurch(church); setShowChurchModal(true); }} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50">
                                  <Edit size={18} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
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
                        className="w-full border border-slate-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500" 
                        disabled={!currentUser}
                      />
                      <button 
                        disabled={!currentUser || !newPeriod.trim()} 
                        onClick={handleAddPeriod} 
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
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

              {(activeTab === 'laporan' || activeTab === 'pelean' || activeTab === 'alaman') && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-lg">{appSettings[`menu${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}` as keyof AppSettings]}</h3>
                  </div>
                  <div className="overflow-auto custom-scrollbar max-h-[70vh]">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-4 border-b border-slate-200 sticky left-0 bg-slate-50 z-20 w-12 text-center">No</th>
                          <th className="px-4 py-4 border-b border-slate-200 sticky left-12 bg-slate-50 z-20 w-48">Nama Jemaat</th>
                          <th className="px-4 py-4 border-b border-slate-200 text-center w-24">Status</th>
                          {SPREADSHEET_COLUMNS[activeTab as keyof typeof SPREADSHEET_COLUMNS].map(col => (
                            <th key={col} className="px-2 py-4 border-b border-slate-200 text-center w-24">{col}</th>
                          ))}
                          <th className="px-4 py-4 border-b border-slate-200 text-right bg-blue-50 text-blue-900 w-32">Total (Rp)</th>
                          <th className="px-4 py-4 border-b border-slate-200 text-center w-24">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {getLaporanData(activeTab as any).map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 sticky left-0 bg-white z-10 text-center border-r border-slate-100">{item.id}</td>
                            <td className="px-4 py-3 sticky left-12 bg-white z-10 font-bold border-r border-slate-100">{item.nama}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-[9px] font-bold ${item.status === 'Lunas' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {item.status.toUpperCase()}
                              </span>
                            </td>
                            {SPREADSHEET_COLUMNS[activeTab as keyof typeof SPREADSHEET_COLUMNS].map(col => {
                              const val = item.details[col] || 0;
                              const isSelected = (selectedCells[item.id] || []).includes(col);
                              return (
                                <td key={col} className="p-0 border-r border-slate-100 relative group min-w-[120px]">
                                  <div className="flex items-center h-full px-2">
                                    {val > 0 && (
                                      <div className="mr-1">
                                        <input 
                                          type="checkbox" 
                                          checked={isSelected}
                                          onChange={() => toggleCellSelection(item.id, col)}
                                          className="w-3 h-3 cursor-pointer"
                                          title="Pilih untuk pesan gabungan"
                                        />
                                      </div>
                                    )}
                                    <div className="flex-1 relative flex items-center">
                                      {currentUser ? (
                                        <input 
                                          type="text" 
                                          value={formatInput(val)}
                                          onChange={(e) => handleCellChange(item.id, activeTab as any, col, e.target.value)}
                                          className={`w-full py-3 text-right outline-none bg-transparent font-medium ${!val ? 'text-red-400' : 'text-slate-700'}`}
                                          placeholder="0"
                                        />
                                      ) : (
                                        <div className={`w-full py-3 text-right font-medium ${!val ? 'text-red-300' : 'text-slate-700'}`}>
                                          {val || '-'}
                                        </div>
                                      )}
                                      
                                      {/* Tombol WA Khusus */}
                                      <button 
                                        onClick={() => handleKirimWASpesifik(item, col)}
                                        className="ml-2 p-1 rounded-full text-slate-300 hover:text-green-600 hover:bg-green-50 transition-colors"
                                        title={val > 0 ? "Kirim WA Terima Kasih" : "Kirim WA Tagihan"}
                                      >
                                        <MessageCircle size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-right font-bold text-blue-900 bg-blue-50/30">{formatRupiah(item.jumlah)}</td>
                            <td className="px-4 py-3 text-center">
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
                                      className="bg-green-600 text-white p-1 rounded text-[9px] font-bold"
                                      title="Kirim WA Gabungan"
                                    >
                                      WA Gabung
                                    </button>
                                    <button 
                                      onClick={() => handlePrintBukti(item, 'penerimaan')}
                                      className="bg-blue-600 text-white p-1 rounded text-[9px] font-bold"
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
                            </td>
                          </tr>
                        ))}
                      </tbody>
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
                          className="w-full border border-slate-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-bold"
                        >
                          <option value="laporan">{appSettings.menuLaporan}</option>
                          <option value="pelean">{appSettings.menuPelean}</option>
                          <option value="alaman">{appSettings.menuAlaman}</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-3">
                        <button onClick={() => { setPrintData({ kategori: downloadKategori }); setPrintType('rekap'); }} className="flex items-center justify-center space-x-3 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-transform hover:scale-[1.02]">
                          <Printer size={20} /> <span>Cetak Rekapitulasi</span>
                        </button>
                        <button onClick={() => alert('Fitur download CSV sedang disiapkan')} className="flex items-center justify-center space-x-3 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-transform hover:scale-[1.02]">
                          <Download size={20} /> <span>Download Excel (CSV)</span>
                        </button>
                        <button onClick={syncToGoogleSheets} className="flex items-center justify-center space-x-3 bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition-transform hover:scale-[1.02]">
                          <Database size={20} className="text-green-400" /> <span>Sinkron ke Google Sheet</span>
                        </button>
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
                      <p>3. Hapus semua kode yang ada dan paste kode di bawah ini:</p>
                      <pre className="bg-slate-800 p-4 rounded text-xs overflow-x-auto text-green-400">
{`function doGet() {
  return ContentService.createTextOutput("✅ API Keuangan GKLI Aktif!")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    var contents = e.postData.contents;
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("FullBackup") || ss.insertSheet("FullBackup");
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Tanggal", "Aksi", "Data"]);
    }
    
    sheet.appendRow([new Date(), data.action, JSON.stringify(data.payload)]);
    
    return ContentService.createTextOutput("Success")
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.message)
      .setMimeType(ContentService.MimeType.TEXT);
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

              {activeTab === 'akun' && currentUser?.role === 'superadmin' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg">Manajemen Pengguna</h3>
                    <button onClick={() => { setFormUser({ username: '', password: '' }); setShowUserModal(true); }} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                      <UserPlus size={16} /> <span>Tambah Akun</span>
                    </button>
                  </div>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="px-6 py-4">Username</th>
                        <th className="px-6 py-4">Password</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map((user) => (
                        <tr key={user.username}>
                          <td className="px-6 py-4 font-bold">{user.username}</td>
                          <td className="px-6 py-4 font-mono text-xs">{user.password}</td>
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

              {activeTab === 'templates' && currentUser?.role === 'superadmin' && (
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
                            className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
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
                              className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
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
                            className="w-full h-64 border border-slate-200 rounded-lg p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-serif"
                          ></textarea>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700">Template Surat Tunggakan</label>
                          <textarea 
                            value={templates.suratTunggakan}
                            onChange={(e) => setTemplates({ ...templates, suratTunggakan: e.target.value })}
                            className="w-full h-64 border border-slate-200 rounded-lg p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-serif"
                          ></textarea>
                        </div>
                      </div>

                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <h4 className="font-bold text-blue-800 text-xs mb-2 uppercase">Daftar Placeholder (Kode Otomatis)</h4>
                        <p className="text-[11px] text-blue-700 leading-relaxed">
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
              className="w-full border border-slate-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password Admin</label>
            <input 
              type="password" 
              value={loginForm.password} 
              onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
              className="w-full border border-slate-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500" 
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">
            Masuk Sebagai Admin
          </button>
        </div>
      </Modal>

      <Modal show={showChurchModal} onClose={() => setShowChurchModal(false)} title={formChurch.id ? 'Edit Jemaat' : 'Tambah Jemaat'}>
        <div className="space-y-4">
          <input type="text" value={formChurch.nama} onChange={e => setFormChurch({...formChurch, nama: e.target.value})} className="w-full border p-3 rounded-lg" placeholder="Nama Jemaat" />
          <input type="text" value={formChurch.resort} onChange={e => setFormChurch({...formChurch, resort: e.target.value})} className="w-full border p-3 rounded-lg" placeholder="Resort" />
          <input type="text" value={formChurch.wa} onChange={e => setFormChurch({...formChurch, wa: e.target.value})} className="w-full border p-3 rounded-lg" placeholder="No. WA (628...)" />
          <button onClick={handleSaveChurch} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">Simpan Data</button>
        </div>
      </Modal>

      <Modal show={showBulkModal} onClose={() => setShowBulkModal(false)} title="Import Massal Jemaat">
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Format: Nama Jemaat [TAB] Resort [TAB] No WA. Pisahkan tiap baris untuk jemaat berbeda.</p>
          <textarea 
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Paste data dari Excel di sini..."
            className="w-full h-48 border border-slate-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500"
          ></textarea>
          <button onClick={handleBulkImport} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700">Import Sekarang</button>
        </div>
      </Modal>

      <Modal show={showUserModal} onClose={() => setShowUserModal(false)} title="Tambah Akun Baru">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username</label>
            <input type="text" value={formUser.username} onChange={e => setFormUser({...formUser, username: e.target.value})} className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Username" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
            <input type="text" value={formUser.password} onChange={e => setFormUser({...formUser, password: e.target.value})} className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Password" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pilih Peran (Role)</label>
            <select 
              value={formUser.role} 
              onChange={e => setFormUser({...formUser, role: e.target.value as 'superadmin' | 'staff'})}
              className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="staff">Staff (Hanya Akses Dashboard)</option>
              <option value="superadmin">Admin (Akses Kelola & Edit Data)</option>
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              * Staff digunakan untuk login perlindungan pertama (pengunjung).
              <br />* Admin digunakan untuk membantu mengelola dan mengedit data.
            </p>
          </div>
          <button onClick={handleSaveUser} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors">Buat Akun Sekarang</button>
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
                className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
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
            <SettingInput label="Menu Master Data" value={formSettings.menuMasterData} onChange={v => setFormSettings({...formSettings, menuMasterData: v})} />
            <SettingInput label="Menu Jemaat" value={formSettings.menuGereja} onChange={v => setFormSettings({...formSettings, menuGereja: v})} />
            <SettingInput label="Menu Periode" value={formSettings.menuPeriode} onChange={v => setFormSettings({...formSettings, menuPeriode: v})} />
            <SettingInput label="Menu Pembayaran" value={formSettings.menuPembayaran} onChange={v => setFormSettings({...formSettings, menuPembayaran: v})} />
            <SettingInput label="Menu Laporan" value={formSettings.menuLaporan} onChange={v => setFormSettings({...formSettings, menuLaporan: v})} />
            <SettingInput label="Menu Pelean" value={formSettings.menuPelean} onChange={v => setFormSettings({...formSettings, menuPelean: v})} />
            <SettingInput label="Menu Alaman" value={formSettings.menuAlaman} onChange={v => setFormSettings({...formSettings, menuAlaman: v})} />
          </div>

          <div className="bg-green-50 p-4 rounded-xl border border-green-200">
            <h4 className="font-bold text-green-800 mb-2 flex items-center"><Database size={18} className="mr-2" /> Integrasi Database Cloud</h4>
            <SettingInput 
              label="URL Web App Google Sheets (Apps Script)" 
              value={formSettings.googleSheetUrl} 
              onChange={v => setFormSettings({...formSettings, googleSheetUrl: v})} 
            />
            <p className="text-[10px] text-green-700 mt-2 leading-relaxed">
              * Paste URL yang didapat setelah melakukan "Deploy as Web App" pada Google Apps Script di Google Sheet Anda.
              <br />* Fitur ini memungkinkan Anda menyimpan database secara online agar data dapat diakses dari perangkat lain.
            </p>
          </div>

          <button onClick={handleSaveSettings} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">Simpan Pengaturan</button>
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
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'} ${className}`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
      {active && <motion.div layoutId="activeNav" className="ml-auto"><ChevronRight size={14} /></motion.div>}
    </button>
  );
}

function NavHeader({ label }: { label: string }) {
  return <p className="text-[10px] text-slate-500 uppercase font-bold mt-6 mb-2 px-4 tracking-widest">{label}</p>;
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

function StatCard({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: 'green' | 'red' | 'blue' }) {
  const colors = {
    green: 'border-green-500 bg-green-50/30',
    red: 'border-red-500 bg-red-50/30',
    blue: 'border-blue-500 bg-blue-50/30'
  };
  return (
    <div className={`bg-white rounded-2xl shadow-sm p-6 border-l-4 ${colors[color]} flex items-center justify-between`}>
      <div>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-black text-slate-800">{value}</p>
      </div>
      <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100">
        {icon}
      </div>
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
        <div className="p-6">
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
        className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
      />
    </div>
  );
}
