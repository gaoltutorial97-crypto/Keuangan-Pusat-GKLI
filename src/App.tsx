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
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Church, Payment, User, AppSettings, TabType } from './types';
import { INITIAL_CHURCHES, DEFAULT_SETTINGS, SPREADSHEET_COLUMNS } from './constants';

export default function App() {
  // STATE NAVIGASI
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  // STATE USER & LOGIN
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('gkli_users');
      return saved ? JSON.parse(saved) : [{ username: 'kpt_gkli@yahoo.com', password: '@Reformasi1517', role: 'superadmin' }];
    } catch { return [{ username: 'kpt_gkli@yahoo.com', password: '@Reformasi1517', role: 'superadmin' }]; }
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showUserModal, setShowUserModal] = useState(false);
  const [formUser, setFormUser] = useState({ username: '', password: '' });

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

  const totalPemasukan = useMemo(() => payments
    .filter(p => p.periode === periodeAktif && p.jumlah > 0)
    .reduce((sum, item) => sum + item.jumlah, 0), [payments, periodeAktif]);
  
  const stats = useMemo(() => {
    let totalEstimasiTunggakan = 0;
    let totalMenunggak = 0;
    let totalLunas = 0;

    [dataAlaman, dataPelean, dataLaporanKeuangan].forEach((dataset, index) => {
      dataset.forEach(item => {
        if (item.status === 'Menunggak') {
          totalMenunggak++;
          totalEstimasiTunggakan += index === 0 ? 500000 : index === 1 ? 1000000 : 2000000;
        } else {
          totalLunas++;
        }
      });
    });
    return { totalEstimasiTunggakan, totalMenunggak, totalLunas };
  }, [dataAlaman, dataPelean, dataLaporanKeuangan]);

  // ==========================================
  // FUNGSI AKSI & TOMBOL
  // ==========================================
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
    if (!formUser.username || !formUser.password) return alert('Email dan Password wajib diisi!');
    if (users.find(u => u.username === formUser.username)) return alert('Email/Username sudah terdaftar!');
    setUsers([...users, { username: formUser.username, password: formUser.password, role: 'staff' }]);
    setShowUserModal(false);
    setFormUser({ username: '', password: '' });
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

  const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

  // ==========================================
  // RENDER COMPONENTS
  // ==========================================
  
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
           <div className="text-center border-b-2 border-black pb-4 mb-6">
              <h1 className="text-2xl font-bold">KANTOR PUSAT</h1>
              <h2 className="text-3xl font-bold text-blue-800">GEREJA KRISTEN LUTHER INDONESIA</h2>
              <p className="text-sm">Sihabonghabong, Kec. Parlilitan, Kab. Humbang Hasundutan, Prov. Sumatera Utara</p>
           </div>
           
           {printType === 'rekap' ? (
             <div>
               <h3 className="text-center text-xl font-bold underline mb-4">REKAPITULASI {printData.kategori.toUpperCase()}</h3>
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
                <div className="text-justify leading-relaxed">
                  <p>Salam sejahtera dalam Nama Tuhan Yesus Kristus!</p>
                  {printType === 'peringatan' ? (
                    <p className="mt-4">Berdasarkan catatan kas kami, kewajiban administrasi untuk <b>{printData.kategori.toUpperCase()}</b> periode <b>{printData.periode}</b> dari Jemaat {printData.nama} masih tercatat belum diselesaikan. Mohon kesediaannya untuk segera dikoordinasikan.</p>
                  ) : (
                    <p className="mt-4">Kami mengucapkan terima kasih atas persembahan sebesar <b>Rp {formatRupiah(printData.jumlah)}</b> untuk kategori <b>{printData.kategori.toUpperCase()}</b> periode <b>{printData.periode}</b>. Tuhan memberkati pelayanan kita.</p>
                  )}
                  <p className="mt-4">Demikian kami sampaikan, atas perhatiannya kami ucapkan terima kasih.</p>
                </div>
                <div className="flex justify-end mt-20">
                  <div className="text-center">
                    <p>Pucuk Pimpinan GKLI</p>
                    <p className="mb-20">Sekretaris Jenderal</p>
                    <p className="font-bold underline">Pdt. Tamris Malau, M.Th.</p>
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
          <div className="bg-blue-600 p-2 rounded-lg">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">{appSettings.title}</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">
              {currentUser?.role === 'superadmin' ? 'Admin Utama' : currentUser ? 'Staf Pengisi' : 'Tamu'}
            </p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          
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
              <span className="text-sm font-semibold">Masuk (Login)</span>
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 ml-64 min-h-screen flex flex-col">
        <header className="bg-white shadow-sm px-8 py-4 flex justify-between items-center sticky top-0 z-10 no-print">
          <h2 className="text-xl font-bold text-slate-800">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
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
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title={`Total Pemasukan (${periodeAktif})`} value={`Rp ${formatRupiah(totalPemasukan)}`} icon={<Save className="text-green-600" />} color="green" />
                    <StatCard title={`Estimasi Tunggakan (${periodeAktif})`} value={`Rp ${formatRupiah(stats.totalEstimasiTunggakan)}`} icon={<AlertTriangle className="text-red-600" />} color="red" />
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
                          <th className="px-6 py-4">WhatsApp</th>
                          {currentUser && <th className="px-6 py-4 text-center">Aksi</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {churches.map((church) => (
                          <tr key={church.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-slate-500 font-medium">{church.id}</td>
                            <td className="px-6 py-4 font-bold text-slate-800">{church.nama}</td>
                            <td className="px-6 py-4 text-slate-600">{church.resort}</td>
                            <td className="px-6 py-4 text-slate-600">{church.wa || '-'}</td>
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
                            {SPREADSHEET_COLUMNS[activeTab as keyof typeof SPREADSHEET_COLUMNS].map(col => (
                              <td key={col} className="p-0 border-r border-slate-100">
                                <input 
                                  type="text" 
                                  value={item.details[col] || ''}
                                  onChange={(e) => handleCellChange(item.id, activeTab as any, col, e.target.value)}
                                  disabled={!currentUser}
                                  className={`w-full h-full p-3 text-right outline-none focus:bg-blue-50 transition-colors ${!item.details[col] ? 'bg-red-50/30' : 'bg-transparent'}`}
                                  placeholder="-"
                                />
                              </td>
                            ))}
                            <td className="px-4 py-3 text-right font-bold text-blue-900 bg-blue-50/30">{formatRupiah(item.jumlah)}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center space-x-2">
                                <button 
                                  onClick={() => {
                                    const text = item.status === 'Menunggak' 
                                      ? `Syalom Jemaat ${item.nama}, mohon kesediaannya untuk menyelesaikan administrasi ${activeTab.toUpperCase()} periode ${periodeAktif}.`
                                      : `Syalom Jemaat ${item.nama}, terima kasih atas persembahan ${activeTab.toUpperCase()} sebesar Rp ${formatRupiah(item.jumlah)}.`;
                                    window.open(`https://wa.me/${item.wa}?text=${encodeURIComponent(text)}`, '_blank');
                                  }}
                                  className="text-green-600 hover:bg-green-50 p-1.5 rounded-lg"
                                >
                                  <MessageCircle size={16} />
                                </button>
                                <button 
                                  onClick={() => { setPrintData(item); setPrintType(item.status === 'Menunggak' ? 'peringatan' : 'terimakasih'); }}
                                  className="text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg"
                                >
                                  <Printer size={16} />
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
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl">
                    <h4 className="font-bold text-amber-800 mb-2 flex items-center"><AlertTriangle size={18} className="mr-2" /> Petunjuk Cetak PDF</h4>
                    <p className="text-sm text-amber-700 leading-relaxed">
                      Untuk menyimpan sebagai PDF, klik tombol <b>Cetak Rekapitulasi</b>, lalu pada jendela cetak yang muncul, pilih <b>"Save as PDF"</b> pada bagian Printer/Destination.
                    </p>
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
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* MODALS */}
      <Modal show={showLoginModal} onClose={() => setShowLoginModal(false)} title="Login Sistem">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username</label>
            <input 
              type="text" 
              value={loginForm.username} 
              onChange={e => setLoginForm({...loginForm, username: e.target.value})} 
              className="w-full border border-slate-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
            <input 
              type="password" 
              value={loginForm.password} 
              onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
              className="w-full border border-slate-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500" 
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">
            Masuk Sekarang
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

      <Modal show={showUserModal} onClose={() => setShowUserModal(false)} title="Tambah Akun Staf">
        <div className="space-y-4">
          <input type="text" value={formUser.username} onChange={e => setFormUser({...formUser, username: e.target.value})} className="w-full border p-3 rounded-lg" placeholder="Username" />
          <input type="text" value={formUser.password} onChange={e => setFormUser({...formUser, password: e.target.value})} className="w-full border p-3 rounded-lg" placeholder="Password" />
          <button onClick={handleSaveUser} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">Buat Akun</button>
        </div>
      </Modal>

      <Modal show={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="Pengaturan Tampilan" size="max-w-2xl">
        <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1 custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <SettingInput label="Judul Aplikasi" value={formSettings.title} onChange={v => setFormSettings({...formSettings, title: v})} />
            <SettingInput label="URL Logo" value={formSettings.logoUrl} onChange={v => setFormSettings({...formSettings, logoUrl: v})} />
            <SettingInput label="Menu Master Data" value={formSettings.menuMasterData} onChange={v => setFormSettings({...formSettings, menuMasterData: v})} />
            <SettingInput label="Menu Jemaat" value={formSettings.menuGereja} onChange={v => setFormSettings({...formSettings, menuGereja: v})} />
            <SettingInput label="Menu Periode" value={formSettings.menuPeriode} onChange={v => setFormSettings({...formSettings, menuPeriode: v})} />
            <SettingInput label="Menu Pembayaran" value={formSettings.menuPembayaran} onChange={v => setFormSettings({...formSettings, menuPembayaran: v})} />
            <SettingInput label="Menu Laporan" value={formSettings.menuLaporan} onChange={v => setFormSettings({...formSettings, menuLaporan: v})} />
            <SettingInput label="Menu Pelean" value={formSettings.menuPelean} onChange={v => setFormSettings({...formSettings, menuPelean: v})} />
            <SettingInput label="Menu Alaman" value={formSettings.menuAlaman} onChange={v => setFormSettings({...formSettings, menuAlaman: v})} />
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
