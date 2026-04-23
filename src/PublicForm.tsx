import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, serverTimestamp, addDoc, query, orderBy } from 'firebase/firestore';
import { Church, Payment, AppSettings } from './types';
import { DEFAULT_SETTINGS, SPREADSHEET_COLUMNS, CATEGORY_LABELS } from './constants';
import { normalizeResortName, getChurchIdentityKey, normalizePeriode } from './utils';
import { toJpeg } from 'html-to-image';
import { 
  CheckCircle2, 
  ChevronLeft, 
  Download, 
  Upload, 
  MapPin, 
  ShieldCheck,
  CreditCard,
  FileCheck2,
  History,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

const formatRupiah = (angka: number) => {
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(angka);
};

const compressImage = (file: File, maxWidth = 800): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export default function PublicForm() {
  const [allChurches, setAllChurches] = useState<Church[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  const [selectedResortKey, setSelectedResortKey] = useState(''); // Stores normalized key
  const [selectedChurchIdentity, setSelectedChurchIdentity] = useState(''); // Stores identity key (resortKey + churchKey)
  
  const [kategori, setKategori] = useState<'laporan' | 'pelean' | 'alaman'>('laporan');
  const [periode, setPeriode] = useState('Tahun 2026');
  const [details, setDetails] = useState<Record<string, number>>({});
  const [buktiText, setBuktiText] = useState('');
  const [buktiImage, setBuktiImage] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Group churches logic
  interface ChurchGroup {
    master: Church;
    aliases: string[];
    resortKey: string;
    idKey: string;
  }

  const churchGroups = useMemo(() => {
    const groups: Record<string, ChurchGroup> = {};

    allChurches.forEach(c => {
      const rKey = normalizeResortName(c.resort);
      const idKey = getChurchIdentityKey(c);
      
      const existing = groups[idKey];
      const hasGKLI = c.nama.toUpperCase().startsWith('GKLI');

      if (!existing) {
        groups[idKey] = { master: c, aliases: [c.id], resortKey: rKey, idKey };
      } else {
        existing.aliases.push(c.id);
        // Prefer GKLI for display
        if (hasGKLI && !existing.master.nama.toUpperCase().startsWith('GKLI')) {
          existing.master = c;
        }
      }
    });
    return groups;
  }, [allChurches]);

  const resorts = useMemo(() => {
    const rSet = new Map<string, string>(); // normKey -> display
    Object.values(churchGroups).forEach((g: ChurchGroup) => {
      if (g.resortKey && g.resortKey !== '-') {
        if (!rSet.has(g.resortKey)) {
          rSet.set(g.resortKey, normalizeResortName(g.master.resort));
        }
      }
    });
    return Array.from(rSet.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [churchGroups]);

  const filteredChurches = useMemo(() => {
    if (!selectedResortKey) return [];
    return Object.values(churchGroups)
      .filter((g: ChurchGroup) => g.resortKey === selectedResortKey)
      .sort((a: ChurchGroup, b: ChurchGroup) => {
        const nameA = a.master.nama.toLowerCase();
        const nameB = b.master.nama.toLowerCase();
        const isAPosPI = nameA.includes('pos pi');
        const isBPosPI = nameB.includes('pos pi');
        
        if (isAPosPI && !isBPosPI) return 1;
        if (!isAPosPI && isBPosPI) return -1;
        
        return nameA.localeCompare(nameB);
      });
  }, [selectedResortKey, churchGroups]);

  const [isPaymentsLoaded, setIsPaymentsLoaded] = useState(false);
  
  // Real-time Sync
  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'config'), (snap) => {
      if (snap.exists()) {
         const data = snap.data() as AppSettings;
         setAppSettings(data);
         if (data.periodeAktif && !periode) {
            setPeriode(data.periodeAktif);
         } else if (data.periodeAktif && periode === 'Tahun 2026') {
            setPeriode(data.periodeAktif);
         }
      }
    });

    const unsubChurches = onSnapshot(query(collection(db, 'churches'), orderBy('order', 'asc')), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Church));
      setAllChurches(data);
    });

    const unsubPayments = onSnapshot(collection(db, 'payments'), (snap) => {
      setPayments(snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Payment)));
      setIsPaymentsLoaded(true);
    });

    return () => {
      unsubSettings();
      unsubChurches();
      unsubPayments();
    };
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return alert("Maksimum 5MB.");
    try {
      const compressedBase64 = await compressImage(file);
      setBuktiImage(compressedBase64);
    } catch (err) {
      alert("Gagal memproses gambar.");
    }
  };

  const totalSumbangan = useMemo(() => {
    return Object.values(details).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
  }, [details]);

  const disabledColumns = useMemo(() => {
    const disabled: Record<string, boolean> = {};
    if (!selectedChurchIdentity) return disabled;
    
    const group = churchGroups[selectedChurchIdentity];
    if (!group) return disabled;

    // Filter payments for ANY alias ID of this jemaat
    const churchPayments = payments.filter(p => 
      group.aliases.includes(p.gerejaId) && 
      normalizePeriode(p.periode) === normalizePeriode(periode) && 
      p.kategori === kategori
    );
    
    churchPayments.forEach(p => {
      Object.entries(p.details || {}).forEach(([key, val]) => {
        if ((val as number) > 0) disabled[key] = true;
      });
    });
    return disabled;
  }, [payments, selectedChurchIdentity, periode, kategori, churchGroups]);

  const visibleColumns = useMemo(() => {
    // Show all columns so users can see which ones are already paid (Lunas)
    return SPREADSHEET_COLUMNS[kategori];
  }, [kategori]);

  // Logic to determine if a specific month input should be visually locked (disabled)
  const getIsColumnLocked = (colName: string) => {
    if (kategori !== 'laporan') return false;
    
    const allMonths = SPREADSHEET_COLUMNS['laporan'];
    const currentIndex = allMonths.indexOf(colName);
    if (currentIndex <= 0) return false;

    // Check if any previous month is neither paid nor filled
    for (let i = 0; i < currentIndex; i++) {
        const prevMonth = allMonths[i];
        const isPaid = disabledColumns[prevMonth];
        const isFilledNow = details[prevMonth] > 0;
        
        if (!isPaid && !isFilledNow) return true;
    }
    return false;
  };

  const handleDetailChange = (colName: string, value: string) => {
    if (getIsColumnLocked(colName)) {
      const monthNames: Record<string, string> = {
        'Jan': 'Januari', 'Feb': 'Februari', 'Mar': 'Maret', 'Apr': 'April',
        'Mei': 'Mei', 'Jun': 'Juni', 'Jul': 'Juli', 'Agu': 'Agustus',
        'Sep': 'September', 'Okt': 'Oktober', 'Nov': 'November', 'Des': 'Desember'
      };
      
      const allMonths = SPREADSHEET_COLUMNS['laporan'];
      const firstMissingIdx = allMonths.findIndex((m, idx) => idx < allMonths.indexOf(colName) && !disabledColumns[m] && !details[m]);
      const missingMonthName = monthNames[allMonths[firstMissingIdx]] || allMonths[firstMissingIdx];
      
      alert(`Peringatan: Setoran bulan ${missingMonthName} belum lunas/diisi. Mohon setor secara berurutan sesuai aturan pusat.`);
      return;
    }

    const numValue = parseInt(value.replace(/[^0-9]/g, '')) || 0;
    setDetails(prev => ({ ...prev, [colName]: numValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChurchIdentity) return alert('Silakan pilih nama jemaat Bapak/Ibu.');
    if (totalSumbangan <= 0) return alert('Silakan isi nominal setoran.');

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const group = churchGroups[selectedChurchIdentity];
      const church = group.master;
      const paymentData = {
        gerejaId: church.id, // Use master ID for submission
        periode: periode,
        kategori: kategori,
        details: details,
        jumlah: totalSumbangan,
        tanggal: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        receiptSent: false,
        buktiTransfer: buktiText,
        buktiTransferBase64: buktiImage
      };

      await addDoc(collection(db, 'payments'), paymentData);
      setSuccessData({ church, paymentData });
    } catch (err: any) {
      console.error("Firestore submission error:", err);
      let errorMsg = 'Gagal menyimpan data ke database. Silakan coba lagi.';
      if (err.message?.includes('permission-denied')) {
        errorMsg = 'Akses ditolak oleh pusat. Silakan hubungi admin kasir.';
      }
      setSubmitError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadReceipt = async () => {
    if (printRef.current) {
      const dataUrl = await toJpeg(printRef.current, { quality: 0.95, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `GKLI-Tanda-Terima-${Date.now()}.jpg`;
      link.href = dataUrl;
      link.click();
    }
  };

  const resetForm = () => {
    setSelectedResortKey('');
    setSelectedChurchIdentity('');
    setDetails({});
    setBuktiText('');
    setBuktiImage(null);
    setSuccessData(null);
    setSubmitError(null);
  };

  const getFormattedPaymentName = (cat: string, field: string) => {
    const monthMap: Record<string, string> = {
      'Jan': 'Januari', 'Feb': 'Februari', 'Mar': 'Maret', 'Apr': 'April',
      'Mei': 'Mei', 'Jun': 'Juni', 'Jul': 'Juli', 'Agu': 'Agustus',
      'Agt': 'Agustus', 'Sep': 'September', 'Okt': 'Oktober', 'Nov': 'November', 'Des': 'Desember'
    };
    if (cat === 'laporan') return `Persembahan II bulan ${monthMap[field] || field}`;
    return `${CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat} ${field}`;
  };

  const isSyncing = !allChurches.length || !isPaymentsLoaded;

  if (isSyncing && !successData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 font-medium animate-pulse">Menghubungkan ke database pusat...</p>
        </div>
      </div>
    );
  }

  if (successData) {
    const p = successData.paymentData;
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 font-sans text-slate-900">
        <div className="max-w-xl mx-auto">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-8 md:p-12 shadow-2xl rounded-[24px] border border-slate-200 mb-8 relative overflow-hidden" ref={printRef}>
            <div className="flex flex-col items-center mb-10 text-center">
              <img src={appSettings.logoUrl || "https://upload.wikimedia.org/wikipedia/commons/0/05/Logo_GKLI.png"} className="h-20 w-auto mb-4" alt="Logo" />
              <h2 className="text-xl font-black uppercase tracking-tight">{appSettings.title}</h2>
              <div className="h-1 w-16 bg-slate-900 my-4"></div>
              <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Tanda Terima Sementara</p>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-10 text-sm">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Penyetor</p>
                  <p className="font-bold">{successData.church.nama}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Tanggal</p>
                  <p className="font-bold">{today}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Kategori</p>
                  <p className="font-bold">{CATEGORY_LABELS[kategori as keyof typeof CATEGORY_LABELS]}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Periode</p>
                  <p className="font-bold">{periode}</p>
                </div>
            </div>

            <div className="space-y-3 mb-10 border-t border-slate-100 pt-8">
               {Object.entries(p.details).map(([key, val]) => (
                  (val as number) > 0 && (
                    <div key={key} className="flex justify-between items-center border-b border-slate-50 pb-2">
                       <span className="text-xs font-semibold text-slate-500 uppercase">{getFormattedPaymentName(p.kategori, key)}</span>
                       <span className="font-mono text-sm font-bold">Rp {formatRupiah(val as number)}</span>
                    </div>
                  )
               ))}
               <div className="flex justify-between items-baseline pt-4">
                  <span className="text-sm font-black uppercase">Total Setoran</span>
                  <span className="font-mono text-xl font-black text-emerald-600">Rp {formatRupiah(totalSumbangan)}</span>
               </div>
            </div>

            <div className="text-center pt-8">
                <div className="inline-block border-2 border-dashed border-slate-200 px-6 py-2 rounded-full mb-4">
                   <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 italic">SUCCESSFULLY SUBMITTED</span>
                </div>
                <p className="text-[9px] text-slate-400 font-mono italic">
                  ID: {Date.now()} | Terdaftar di Sistem Pusat GKLI
                </p>
            </div>
          </motion.div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={downloadReceipt} className="flex-1 h-14 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl">
              <Download size={20} /> Simpan Gambar Bukti
            </button>
            <button onClick={resetForm} className="sm:w-auto h-14 bg-white border border-slate-200 rounded-2xl px-8 font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all text-slate-600">
              <ChevronLeft size={20} /> Kembali
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 font-sans text-slate-900">
      <div className="max-w-xl mx-auto">
        
        <header className="mb-10 flex flex-col items-center">
          <img src={appSettings.logoUrl || "https://upload.wikimedia.org/wikipedia/commons/0/05/Logo_GKLI.png"} className="h-20 w-auto mb-4" alt="Logo" />
          <h1 className="text-2xl font-black tracking-tight text-center uppercase">{appSettings.title}</h1>
          <p className="text-slate-500 text-sm font-bold tracking-widest uppercase">Portal Penyetoran Jemaat</p>
        </header>

        <form onSubmit={handleSubmit} className="bg-white rounded-[32px] shadow-2xl border border-slate-200 p-6 md:p-10 space-y-8">
          
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3 block">1. Identitas Jemaat</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-slate-400 ml-1 uppercase">Pilih Resort</span>
                  <select 
                    value={selectedResortKey}
                    onChange={(e) => { 
                      setSelectedResortKey(e.target.value); 
                      setSelectedChurchIdentity(''); 
                      setDetails({}); 
                    }}
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">-- Pilih Resort --</option>
                    {resorts.map(([key, display]) => <option key={key} value={key}>{display}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-slate-400 ml-1 uppercase">Pilih Jemaat</span>
                  <select 
                    value={selectedChurchIdentity}
                    disabled={!selectedResortKey}
                    onChange={(e) => { 
                      setSelectedChurchIdentity(e.target.value); 
                      setDetails({}); 
                    }}
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                  >
                    <option value="">-- Pilih Jemaat --</option>
                    {filteredChurches.map(g => (
                      <option key={g.idKey} value={g.idKey}>{g.master.nama}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3 block">2. Kategori & Periode</label>
              <div className="grid grid-cols-2 gap-4">
                <select 
                  value={kategori}
                  onChange={(e: any) => { setKategori(e.target.value); setDetails({}); }}
                  className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="laporan">{appSettings.menuLaporan || "Persembahan II"}</option>
                  <option value="pelean">{appSettings.menuPelean || "Persembahan Khusus"}</option>
                  <option value="alaman">{appSettings.menuAlaman || "Literatur"}</option>
                </select>
                <select 
                  value={periode}
                  onChange={(e) => { setPeriode(e.target.value); setDetails({}); }}
                  className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  {(appSettings.periodeList || ['Tahun 2024', 'Tahun 2025', 'Tahun 2026']).map(p => (
                    <option key={p} value={p}>{p.replace(/Tahun\s+/i, '')}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3 block">3. Rincian Nominal</label>
              <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100">
                {!selectedChurchIdentity ? (
                   <div className="p-8 text-center bg-white rounded-2xl border border-slate-100">
                      <p className="text-[11px] font-bold text-slate-400 italic">Silakan pilih Resort & Jemaat terlebih dahulu.</p>
                   </div>
                ) : visibleColumns.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-100">
                    <History className="mx-auto text-slate-200 mb-2" size={32} />
                    <p className="text-[11px] font-bold text-slate-400 italic">Semua item sudah terbayar pada periode ini.</p>
                  </div>
                ) : (
                  visibleColumns.map(col => {
                    const isPaid = disabledColumns[col];
                    const isLocked = getIsColumnLocked(col);
                    
                    return (
                      <div key={col} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${isPaid ? 'bg-emerald-50/50' : (isLocked ? 'opacity-40 grayscale' : 'opacity-100')}`}>
                         <div className="flex items-center gap-2">
                           <span className={`text-[11px] font-bold uppercase ${isPaid ? 'text-emerald-700' : 'text-slate-600'}`}>{getFormattedPaymentName(kategori, col)}</span>
                           {isPaid && <span className="text-[8px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-black uppercase">Lunas/Terisi</span>}
                           {isLocked && !isPaid && <AlertCircle size={12} className="text-slate-400" />}
                         </div>
                         <div className="relative w-full sm:w-40 flex items-center">
                            <span className={`absolute left-3 text-[9px] font-black ${isPaid ? 'text-emerald-300' : 'text-slate-300'}`}>RP</span>
                            <input 
                              type="text" 
                              placeholder={isPaid ? "TERBAYAR" : "0"}
                              disabled={isPaid}
                              value={isPaid ? '' : (details[col] === undefined ? '' : formatRupiah(details[col]))}
                              onChange={(e) => handleDetailChange(col, e.target.value)}
                              onClick={() => {
                                if (isLocked) {
                                  // Call handle detail change with current value to trigger the alert
                                  handleDetailChange(col, details[col] === undefined ? '' : String(details[col]));
                                }
                              }}
                              className={`w-full h-10 border rounded-lg px-8 text-right font-mono font-bold text-xs outline-none transition-all ${isPaid ? 'bg-emerald-100/30 border-emerald-100 text-emerald-600 cursor-not-allowed placeholder:text-emerald-400' : (isLocked ? 'bg-slate-100 border-slate-300 text-slate-500 cursor-pointer placeholder:text-slate-400' : 'bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-emerald-500/20')}`}
                            />
                         </div>
                      </div>
                    );
                  })
                )}
                {visibleColumns.length > 0 && selectedChurchIdentity && (
                   <div className="p-4 bg-slate-900 rounded-b-2xl flex justify-between items-center text-white">
                      <span className="text-[10px] font-black tracking-widest uppercase">Total</span>
                      <span className="font-mono text-lg font-black tracking-tighter">Rp {formatRupiah(totalSumbangan)}</span>
                   </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3 block">4. Bukti & Catatan</label>
              <div className="space-y-4">
                 <label className={`w-full h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${buktiImage ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                    {buktiImage ? (
                      <div className="flex flex-col items-center gap-1">
                        <CheckCircle2 size={24} className="text-emerald-500" />
                        <span className="text-[10px] font-bold text-emerald-700">Bukti Terpilih</span>
                        <span className="text-[8px] text-emerald-500 uppercase">Klik untuk ganti</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Upload size={24} className="text-slate-300" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Upload Gambar Bukti</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                 </label>
                 <textarea 
                    value={buktiText}
                    onChange={e => setBuktiText(e.target.value)}
                    placeholder="Contoh: Transfer via BRI an. Panjaitan..."
                    className="w-full h-20 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-semibold text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                 />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {submitError && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-start gap-3">
                 <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                 <p className="text-xs font-bold text-red-800">{submitError}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            type="submit"
            disabled={isSubmitting || totalSumbangan <= 0}
            className={`w-full h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-4 transition-all ${isSubmitting || totalSumbangan <= 0 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 active:scale-95'}`}
          >
            {isSubmitting ? 'Mengirim Data...' : 'Kirim Sekarang'}
          </button>

          <footer className="pt-4 border-t border-slate-100 flex flex-col items-center gap-4 opacity-30 grayscale saturate-0">
             <div className="flex gap-4">
                <ShieldCheck size={16} />
                <CreditCard size={16} />
                <FileCheck2 size={16} />
             </div>
             <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.3em]">Build Verified Security - GKLI System</p>
          </footer>
        </form>
      </div>
    </div>
  );
}
