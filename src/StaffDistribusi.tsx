import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Church, Distribution, AppSettings } from './types';
import { SPREADSHEET_COLUMNS } from './constants';
import { Search, Save, CheckCircle2, ChevronRight, X, Building, Users, User, FileText, Printer, FileDown, Send } from 'lucide-react';
import { normalizeResortName } from './utils';

const StaffDistribusi = () => {
  const [churches, setChurches] = useState<Church[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [periodeAktif, setPeriodeAktif] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<'jemaat'|'resort'|'perorangan'|'laporan'>('jemaat');
  const [selectedChurch, setSelectedChurch] = useState<Church | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    // Fetch settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        const s = docSnap.data() as AppSettings;
        setSettings(s);
        if (s.periodeAktif) setPeriodeAktif(s.periodeAktif);
      }
    });

    // Fetch Churches
    const unsubChurches = onSnapshot(collection(db, 'churches'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Church));
      setChurches(data);
    });

    return () => {
      unsubSettings();
      unsubChurches();
    };
  }, []);

  useEffect(() => {
    if (!periodeAktif) return;
    const unsubDist = onSnapshot(collection(db, 'distributions'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Distribution));
      setDistributions(data);
    });
    return () => unsubDist();
  }, [periodeAktif]);

  // When church is selected, load existing distribution if any
  useEffect(() => {
    if (selectedChurch && periodeAktif) {
      const existingDist = distributions.find(d => 
        d.gerejaId === selectedChurch.id && 
        d.periode.trim().toLowerCase() === periodeAktif.trim().toLowerCase()
      );
      
      if (existingDist && existingDist.details) {
        setFormData(existingDist.details);
      } else {
        setFormData({});
      }
      setSuccessMsg('');
    }
  }, [selectedChurch, periodeAktif, distributions]);

  const synthesizedChurches = useMemo(() => {
    let base = [...churches];
    base = base.map(c => ({ ...c, resort: normalizeResortName(c.resort) }));
    const existingResorts = new Set(base.filter(c => c.type === 'resort').map(c => c.resort));
    const uniqueResortNames = Array.from(new Set(base.map(c => c.resort).filter(r => r && r !== '-')));
    
    uniqueResortNames.forEach(resName => {
      if (!existingResorts.has(resName)) {
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
          isSynthesized: true,
          order: 0
        });
      }
    });

    // Handle duplicates
    const finalBase: Church[] = [];
    const seenResortHeaders = new Set<string>();
    base.forEach(item => {
      if (item.type === 'resort') {
        const rName = normalizeResortName(item.resort);
        if (seenResortHeaders.has(rName)) return; // Skip duplicates
        seenResortHeaders.add(rName);
      }
      finalBase.push(item);
    });

    return finalBase;
  }, [churches]);

  const filteredChurches = useMemo(() => {
    return synthesizedChurches
      .filter(c => {
        if (selectedTab === 'jemaat') return c.type !== 'resort' && c.type !== 'perorangan' && c.type !== 'agg-perorangan';
        if (selectedTab === 'resort') return c.type === 'resort';
        if (selectedTab === 'perorangan') return c.type === 'perorangan';
        return false;
      })
      .filter(c => {
        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        return c.nama.toLowerCase().includes(s) || c.resort.toLowerCase().includes(s);
      })
      .sort((a, b) => {
        return a.nama.localeCompare(b.nama);
      });
  }, [synthesizedChurches, searchTerm, selectedTab]);

  const handleInputChange = (col: string, val: string) => {
    const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
    setFormData(prev => ({ ...prev, [col]: isNaN(num) ? 0 : num }));
  };

  const handleSave = async (showSuccessAlert = true): Promise<boolean> => {
    if (!selectedChurch) return false;
    setIsSaving(true);
    try {
      const existingDist = distributions.find(d => 
        d.gerejaId === selectedChurch.id && 
        d.periode.trim().toLowerCase() === periodeAktif.trim().toLowerCase()
      );

      if (existingDist) {
        await updateDoc(doc(db, 'distributions', existingDist.id), {
          details: formData,
          tanggal: new Date().toISOString().split('T')[0]
        });
      } else {
        const docId = `${selectedChurch.id}_dist_${periodeAktif.replace(/\s+/g, '_')}`;
        await setDoc(doc(db, 'distributions', docId), {
          gerejaId: selectedChurch.id,
          periode: periodeAktif,
          details: formData,
          tanggal: new Date().toISOString().split('T')[0]
        });
      }
      if (showSuccessAlert) {
        setSuccessMsg('Data distribusi berhasil disimpan!');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
      return true;
    } catch (e: any) {
      alert('Gagal menyimpan: ' + e.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndKirimWA = async () => {
    if (!selectedChurch) return;
    const success = await handleSave(false);
    if (!success) return;

    let rincian = '';
    let totalItems = 0;
    SPREADSHEET_COLUMNS.alaman.forEach(col => {
      const val = formData[col] || 0;
      if (val > 0) {
        rincian += `\n- *${col}* : ${val} eks`;
        totalItems += val;
      }
    });

    if (totalItems === 0) {
      alert('Tanda terima tidak dapat dikirim karena nilai distribusi kosong.');
      return;
    }

    const typeLabel = selectedChurch.type === 'resort' ? 'Pusat/Resort' : selectedChurch.type === 'perorangan' ? 'Bapak/Ibu/Sdr/i' : 'Majelis Jemaat GKLI';
    const cleanChurchName = selectedChurch.nama.replace(/^GKLI\s*/i, '');
    let locationSuffix = '';
    
    if (selectedChurch.type !== 'resort' && selectedChurch.type !== 'perorangan' && selectedChurch.type !== 'agg-perorangan' && selectedChurch.resort) {
      locationSuffix = ` Resort *${selectedChurch.resort}*`;
    }

    const waMessage = `Shalom ${typeLabel} *${cleanChurchName}*${locationSuffix},

Puji Syukur kepada Tuhan, kami dari tim Pusat Distribusi GKLI menyampaikan bahwa literatur untuk periode *${periodeAktif}* telah diterima dan didistribusikan dengan rincian sebagai berikut:
${rincian}

*Total: ${totalItems} eksemplar*

Demikian tanda bukti penerimaan literatur ini kami sampaikan. Kiranya literatur ini dapat diberkati dan menjadi wadah berkat untuk pertumbuhan dan kemuliaan nama Tuhan.

Tuhan Yesus Kristus, Kepala Gereja memberkati kita sekalian.

Salam kami,
*Staf Pengiriman Literatur GKLI*`;

    if (selectedChurch.wa || selectedChurch.waPendeta) {
      if (selectedChurch.wa) {
        let waNum1 = selectedChurch.wa.replace(/[^0-9]/g, '');
        if (waNum1.startsWith('0')) waNum1 = '62' + waNum1.substring(1);
        window.open(`https://wa.me/${waNum1}?text=${encodeURIComponent(waMessage)}`, '_blank');
      }
      if (selectedChurch.waPendeta) {
        let waNum2 = selectedChurch.waPendeta.replace(/[^0-9]/g, '');
        if (waNum2.startsWith('0')) waNum2 = '62' + waNum2.substring(1);
        window.open(`https://wa.me/${waNum2}?text=${encodeURIComponent(waMessage)}`, '_blank');
      }
      setSuccessMsg('Tersimpan & Membuka WhatsApp...');
    } else {
      alert('Data tersimpan. Namun nomor WhatsApp tidak tersedia. Pesan:\n\n' + waMessage);
      setSuccessMsg('Data distribusi berhasil disimpan!');
    }
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDownloadLaporan = (format: 'excel' | 'word') => {
    const title = settings?.title || 'GKLI';
    const menuName = 'DISTRIBUSI LITERATUR';
    const date = new Date().toLocaleDateString('id-ID');
    const filename = `GKLI_Distribusi_${periodeAktif}.${format === 'excel' ? 'csv' : 'doc'}`;

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
        </style>
        </head>
        <body>
          <div class="header">
            <h3>${title}</h3>
            <h4>LAPORAN: ${menuName}</h4>
            <p>Periode: ${periodeAktif} | Tanggal Unduh: ${date}</p>
          </div>
          <table>
            <tr><th>NO</th><th>NAMA LENGKAP</th><th>TIPE</th>${SPREADSHEET_COLUMNS.alaman.map(c => `<th>${c}</th>`).join('')}</tr>
      `;

      let idx = 1;
      synthesizedChurches.forEach(c => {
        const dist = distributions.find(d => d.gerejaId === c.id && d.periode.trim().toLowerCase() === periodeAktif.trim().toLowerCase());
        if (!dist || !dist.details || Object.keys(dist.details).length === 0) return;
        const hasValue = SPREADSHEET_COLUMNS.alaman.some(col => dist.details[col] > 0);
        if (!hasValue) return;

        const typeLabel = c.type === 'resort' ? 'Resort' : c.type === 'perorangan' ? 'Perorangan' : 'Jemaat';
        const nameLabel = c.type === 'resort' ? `PUSAT/RESORT: ${c.nama}` : c.nama;
        const detailCells = SPREADSHEET_COLUMNS.alaman.map(col => `<td>${dist.details[col] || '-'}</td>`).join('');
        htmlContent += `<tr><td>${idx++}</td><td>${nameLabel}</td><td>${typeLabel}</td>${detailCells}</tr>`;
      });

      htmlContent += `
          </table>
        </body></html>
      `;
      const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      let csvContent = "NO,NAMA LENGKAP,TIPE," + SPREADSHEET_COLUMNS.alaman.join(',') + "\n";
      let idx = 1;
      synthesizedChurches.forEach(c => {
        const dist = distributions.find(d => d.gerejaId === c.id && d.periode.trim().toLowerCase() === periodeAktif.trim().toLowerCase());
        if (!dist || !dist.details || Object.keys(dist.details).length === 0) return;
        const hasValue = SPREADSHEET_COLUMNS.alaman.some(col => dist.details[col] > 0);
        if (!hasValue) return;

        const typeLabel = c.type === 'resort' ? 'Resort' : c.type === 'perorangan' ? 'Perorangan' : 'Jemaat';
        const nameLabel = c.type === 'resort' ? `PUSAT/RESORT: ${c.nama}` : c.nama;
        const detailCells = SPREADSHEET_COLUMNS.alaman.map(col => dist.details[col] || '0').join(',');
        csvContent += `${idx++},"${nameLabel.replace(/"/g, '""')}","${typeLabel}",${detailCells}\n`;
      });
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Form Distribusi Literatur</h1>
          <p className="text-slate-500 mt-1">Staf Pengiriman Literatur GKLI</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold uppercase rounded-full">
              Periode Aktif: {periodeAktif || 'Loading...'}
            </span>
            <a href="/" className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold uppercase rounded-full hover:bg-slate-200 transition-colors">
              Ke Dashboard Utama
            </a>
          </div>
        </div>

        {/* Form Body */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          
          {!selectedChurch ? (
            <div className="space-y-4">
              
              <div className="grid grid-cols-2 sm:grid-cols-4 p-1 gap-1 bg-slate-100 rounded-xl">
                <button 
                  onClick={() => setSelectedTab('jemaat')}
                  className={`flex-1 py-2 text-sm font-bold flex bg-transparent items-center justify-center gap-2 rounded-lg transition-all ${selectedTab === 'jemaat' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Building size={16} /> Jemaat
                </button>
                <button 
                  onClick={() => setSelectedTab('resort')}
                  className={`flex-1 py-2 text-sm font-bold flex bg-transparent items-center justify-center gap-2 rounded-lg transition-all ${selectedTab === 'resort' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Users size={16} /> Resort
                </button>
                <button 
                  onClick={() => setSelectedTab('perorangan')}
                  className={`flex-1 py-2 text-sm font-bold flex bg-transparent items-center justify-center gap-2 rounded-lg transition-all ${selectedTab === 'perorangan' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <User size={16} /> Perorangan
                </button>
                <button 
                  onClick={() => setSelectedTab('laporan')}
                  className={`flex-1 py-2 text-sm font-bold flex bg-transparent items-center justify-center gap-2 rounded-lg transition-all ${selectedTab === 'laporan' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <FileText size={16} /> Laporan
                </button>
              </div>

              {selectedTab === 'laporan' ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-indigo-50 border border-indigo-100 rounded-xl mb-4 gap-4">
                    <div>
                      <h3 className="font-bold text-indigo-900">Laporan Keseluruhan</h3>
                      <p className="text-sm text-indigo-700 mt-1">Data distribusi literatur periode {periodeAktif}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <button onClick={() => handleDownloadLaporan('word')} className="flex items-center justify-center gap-2 bg-white text-indigo-600 px-3 py-2 border border-indigo-200 rounded-lg font-bold hover:bg-indigo-50 shadow-sm transition-all text-xs">
                        <FileText size={16} /> Word
                      </button>
                      <button onClick={() => handleDownloadLaporan('excel')} className="flex items-center justify-center gap-2 bg-white text-emerald-600 px-3 py-2 border border-emerald-200 rounded-lg font-bold hover:bg-emerald-50 shadow-sm transition-all text-xs">
                        <FileDown size={16} /> Excel
                      </button>
                      <button onClick={() => window.print()} className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-3 py-2 border border-indigo-600 rounded-lg font-bold hover:bg-indigo-700 shadow-sm transition-all text-xs">
                        <Printer size={16} /> PDF/Cetak
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-[60vh] border border-slate-200 rounded-xl print:max-h-none print:border-none">
                    <table className="w-full text-sm text-left min-w-[700px]">
                      <thead className="bg-slate-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 font-bold text-slate-700">Nama Lengkap</th>
                          <th className="px-4 py-3 font-bold text-slate-700">Tipe</th>
                          {SPREADSHEET_COLUMNS.alaman.map(col => (
                            <th key={col} className="px-4 py-3 font-bold text-slate-700 text-center whitespace-nowrap">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {synthesizedChurches.map(c => {
                          const dist = distributions.find(d => d.gerejaId === c.id && d.periode.trim().toLowerCase() === periodeAktif.trim().toLowerCase());
                          if (!dist || !dist.details || Object.keys(dist.details).length === 0) return null;
                          
                          // Check if have any values > 0
                          const hasValue = SPREADSHEET_COLUMNS.alaman.some(col => dist.details[col] > 0);
                          if (!hasValue) return null;

                          return (
                            <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-bold text-slate-800">{c.type === 'resort' ? `PUSAT/RESORT: ${c.nama}` : c.nama}</div>
                                {c.type !== 'perorangan' && c.type !== 'agg-perorangan' && (
                                  <div className="text-xs text-slate-500">{c.resort}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 capitalize text-xs">
                                <span className={`px-2 py-1 rounded-md font-bold ${c.type === 'resort' ? 'bg-indigo-100 text-indigo-700' : c.type === 'perorangan' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {c.type === 'resort' ? 'Resort' : c.type === 'perorangan' ? 'Perorangan' : 'Jemaat'}
                                </span>
                              </td>
                              {SPREADSHEET_COLUMNS.alaman.map(col => (
                                <td key={col} className={`px-4 py-3 text-center font-mono ${dist.details[col] > 0 ? 'text-slate-900 font-bold' : 'text-slate-300'}`}>
                                  {dist.details[col] || '-'}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder={`Cari nama ${selectedTab}...`}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                    />
                    {searchTerm && (
                      <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto space-y-2 mt-4 custom-scrollbar pr-2">
                    {filteredChurches.map(c => (
                      <button 
                        key={c.id} 
                        onClick={() => setSelectedChurch(c)}
                        className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all flex justify-between items-center group"
                      >
                        <div>
                          <div className="font-bold text-slate-800 group-hover:text-indigo-800">
                            {c.type === 'resort' ? `PUSAT/RESORT: ${c.nama}` : c.nama}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex gap-2">
                            <span className="bg-slate-100 px-2 py-0.5 rounded">{c.resort}</span>
                            {c.wilayah && <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded">{c.wilayah}</span>}
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-500" />
                      </button>
                    ))}
                    {filteredChurches.length === 0 && (
                      <div className="text-center p-8 text-slate-400 italic">
                        Tidak ada {selectedTab} yang cocok dengan pencarian.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <button onClick={() => setSelectedChurch(null)} className="text-xs text-indigo-600 font-bold hover:underline mb-2 flex items-center gap-1">
                    « Kembali ke pencarian
                  </button>
                  <h2 className="text-xl font-black text-slate-800">
                    {selectedChurch.type === 'resort' ? `PUSAT/RESORT: ${selectedChurch.nama}` : selectedChurch.nama}
                  </h2>
                  <p className="text-sm text-slate-500">{selectedChurch.resort} • {selectedChurch.wilayah}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SPREADSHEET_COLUMNS.alaman.map(col => (
                  <div key={col} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                    <label className="font-bold text-slate-700 text-sm">{col}</label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formData[col] || ''}
                      onChange={(e) => handleInputChange(col, e.target.value)}
                      placeholder="0"
                      className="w-24 text-right bg-white border border-slate-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>
                ))}
              </div>

              {successMsg && (
                <div className="bg-green-50 text-green-700 p-3 rounded-lg border border-green-200 text-sm font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} /> {successMsg}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => handleSave(true)}
                  disabled={isSaving}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl shadow-sm transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  <Save size={20} />
                  {isSaving ? 'Menyimpan...' : 'Simpan Saja'}
                </button>
                <button 
                  onClick={handleSaveAndKirimWA}
                  disabled={isSaving}
                  className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-600/20 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  <Send size={20} />
                  {isSaving ? 'Menyimpan...' : 'Simpan & Kirim WA'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default StaffDistribusi;

