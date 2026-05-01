import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Church, Distribution, AppSettings } from './types';
import { SPREADSHEET_COLUMNS } from './constants';
import { Search, Save, CheckCircle2, ChevronRight, X } from 'lucide-react';

const StaffDistribusi = () => {
  const [churches, setChurches] = useState<Church[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [periodeAktif, setPeriodeAktif] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredChurches = useMemo(() => {
    return churches
      .filter(c => c.type !== 'agg-perorangan')
      .filter(c => {
        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        return c.nama.toLowerCase().includes(s) || c.resort.toLowerCase().includes(s);
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'resort' ? -1 : 1;
        return a.nama.localeCompare(b.nama);
      });
  }, [churches, searchTerm]);

  const handleInputChange = (col: string, val: string) => {
    const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
    setFormData(prev => ({ ...prev, [col]: isNaN(num) ? 0 : num }));
  };

  const handleSave = async () => {
    if (!selectedChurch) return;
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
      setSuccessMsg('Data distribusi berhasil disimpan!');
      setTimeout(() => setSuccessMsg(''), 3000);
      
    } catch (e: any) {
      alert('Gagal menyimpan: ' + e.message);
    } finally {
      setIsSaving(false);
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
              <h3 className="font-bold text-slate-700 mb-2">Pilih Jemaat atau Resort</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Cari nama jemaat atau resort..." 
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
                    Tidak ada jemaat yang cocok dengan pencarian.
                  </div>
                )}
              </div>
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

              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
              >
                <Save size={20} />
                {isSaving ? 'Menyimpan...' : 'Simpan Data Distribusi'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default StaffDistribusi;
