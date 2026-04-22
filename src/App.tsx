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
  GripVertical
} from 'lucide-react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { toJpeg } from 'html-to-image';
import { Church, Payment, User, AppSettings, TabType, Distribution } from './types';
import { INITIAL_CHURCHES, DEFAULT_SETTINGS, SPREADSHEET_COLUMNS, CATEGORY_LABELS } from './constants';
import { db, auth } from './firebase';
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

export default function App() {
  const printRef = useRef<HTMLDivElement>(null);
  // STATE NAVIGASI
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
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
  const [formSettings, setFormSettings] = useState(DEFAULT_SETTINGS);

  // STATE DATA GEREJA & PEMBAYARAN
  const [churches, setChurches] = useState<Church[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);

  // STATE PERIODE TAHUN
  const [periods, setPeriods] = useState(['Tahun 2021', 'Tahun 2022', 'Tahun 2023', 'Tahun 2024', 'Tahun 2025', 'Tahun 2026']);
  const [periodeAktif, setPeriodeAktif] = useState('Tahun 2026');
  const [newPeriod, setNewPeriod] = useState('');

  // REAL-TIME FIREBASE SYNC - Auth & Settings
  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'config'), (docSnap) => {
      if (docSnap.exists()) setAppSettings(docSnap.data() as AppSettings);
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

    // 2. Listen to Churches
    const unsubChurches = onSnapshot(query(collection(db, 'churches'), orderBy('order', 'asc')), (snap) => {
      const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Church));
      if (data.length > 0) setChurches(data);
      else if (isInitialLoading) setChurches(INITIAL_CHURCHES); 
    }, (error) => console.warn("Churches access restricted:", error.message));

    // 3. Listen to Payments
    const unsubPayments = onSnapshot(collection(db, 'payments'), (snap) => {
      setPayments(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payment)));
    }, (error) => console.warn("Payments access restricted:", error.message));

    // 4. Listen to Distributions
    const unsubDistributions = onSnapshot(collection(db, 'distributions'), (snap) => {
      setDistributions(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Distribution)));
    }, (error) => console.warn("Distributions access restricted:", error.message));

    return () => {
      if (unsubProfile) unsubProfile();
      unsubChurches();
      unsubPayments();
      unsubDistributions();
    };
  }, [firebaseUser, isInitialLoading]);

  // REAL-TIME FIREBASE SYNC - Admin Only
  useEffect(() => {
    const unsubUsersList = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ ...doc.data() } as User)));
    }, (error) => {
      console.warn("User list restricted:", error.message);
    });

    return () => unsubUsersList();
  }, []);

  // STATE CETAK & DOWNLOAD
  const [printData, setPrintData] = useState<any>(null);
  const [printType, setPrintType] = useState<string | null>(null); 
  const [downloadKategori, setDownloadKategori] = useState<'laporan' | 'pelean' | 'alaman'>('laporan');

  // STATE MODAL LAINNYA
  const [showChurchModal, setShowChurchModal] = useState(false);
  const [formChurch, setFormChurch] = useState<Church>({ id: '', nama: '', resort: '', wilayah: '', wa: '', order: 1 });
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [sortType, setSortType] = useState<'id' | 'nama' | 'resort' | 'wilayah' | 'order'>('order');
  const [filterResort, setFilterResort] = useState('Semua Resort');
  const [filterWilayah, setFilterWilayah] = useState('Semua Wilayah');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCells, setSelectedCells] = useState<Record<string, string[]>>({}); // { gerejaId: [colName1, colName2] }
  const [billingSelections, setBillingSelections] = useState<Record<string, Record<string, string[]>>>({}); // { churchId: { category: [colNames] } }
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

  const sortedChurches = useMemo(() => {
    let filtered = [...churches];
    if (filterResort !== 'Semua Resort') {
      filtered = filtered.filter(c => c.resort === filterResort);
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
      if (sortType === 'nama') return a.nama.localeCompare(b.nama);
      if (sortType === 'resort') return a.resort.localeCompare(b.resort);
      if (sortType === 'wilayah') return (a.wilayah || '').localeCompare(b.wilayah || '');
      if (sortType === 'order') return (a.order || 0) - (b.order || 0);
      return a.id.localeCompare(b.id);
    });
  }, [churches, sortType, filterResort, filterWilayah]);

  const uniqueResorts = useMemo(() => {
    return ['Semua Resort', ...Array.from(new Set(churches.map(c => c.resort))).sort()];
  }, [churches]);

  const uniqueWilayah = useMemo(() => {
    return ['Semua Wilayah', ...Array.from(new Set(churches.map(c => c.wilayah).filter(Boolean))).sort()];
  }, [churches]);
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

  const dataDistribusi = useMemo(() => {
    const columns = SPREADSHEET_COLUMNS.alaman;
    return churches.map(gereja => {
      const dist = distributions.find(d => d.gerejaId === gereja.id && d.periode === periodeAktif);
      return {
        ...gereja,
        details: dist ? dist.details : {},
        periode: periodeAktif
      };
    });
  }, [churches, distributions, periodeAktif]);

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
        const church = churches.find(c => c.id === p.gerejaId);
        if (!church) return false;
        const matchResort = filterResort === 'Semua Resort' || church.resort === filterResort;
        const matchWilayah = filterWilayah === 'Semua Wilayah' || church.wilayah === filterWilayah;
        return p.periode === periodeAktif && p.jumlah > 0 && matchResort && matchWilayah;
      })
      .reduce((sum, item) => sum + item.jumlah, 0);
  }, [payments, churches, periodeAktif, filterResort, filterWilayah]);
  
  const stats = useMemo(() => {
    let totalMenunggak = 0;
    let totalLunas = 0;

    [dataAlaman, dataPelean, dataLaporanKeuangan].forEach((dataset) => {
      dataset.filter(item => {
        const matchResort = filterResort === 'Semua Resort' || item.resort === filterResort;
        const matchWilayah = filterWilayah === 'Semua Wilayah' || item.wilayah === filterWilayah;
        return matchResort && matchWilayah;
      }).forEach(item => {
        if (item.status === 'Menunggak') {
          totalMenunggak++;
        } else {
          totalLunas++;
        }
      });
    });

    const totalDistribusiItems = dataDistribusi.filter(item => {
      const matchResort = filterResort === 'Semua Resort' || item.resort === filterResort;
      const matchWilayah = filterWilayah === 'Semua Wilayah' || item.wilayah === filterWilayah;
      return matchResort && matchWilayah;
    }).reduce((sum, item) => {
      const qty = Object.values(item.details).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
      return sum + qty;
    }, 0);

    return { totalMenunggak, totalLunas, totalDistribusiItems };
  }, [dataAlaman, dataPelean, dataLaporanKeuangan, dataDistribusi, filterResort, filterWilayah]);

  const churchesWithArrears = useMemo(() => {
    const currentMonthIdx = new Date().getMonth(); // 0-11
    
    return churches.map(church => {
      const allPotentialArrears: Record<string, string[]> = {};
      let hasPotential = false;

      Object.entries(SPREADSHEET_COLUMNS).forEach(([cat, cols]) => {
        const payment = payments.find(p => p.gerejaId === church.id && p.kategori === cat && p.periode === periodeAktif);
        const unpaid = cols.filter(col => !payment || !payment.details[col] || payment.details[col] === 0);
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
  }, [churches, payments, periodeAktif, billingSelections]);

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

  const handleSaveSettings = async () => {
    if (currentUserProfile?.role !== 'superadmin') return;
    await setDoc(doc(db, 'settings', 'config'), formSettings);
    setShowSettingsModal(false);
  };

  const handleCellChange = async (gerejaId: string, kategori: 'laporan' | 'pelean' | 'alaman', field: string, value: string) => {
    if (!currentUserProfile) return; 

    let numValue = parseInt(value.replace(/[^0-9]/g, ''));
    if (isNaN(numValue)) numValue = 0;

    const existingPayment = payments.find(p => p.gerejaId === gerejaId && p.kategori === kategori && p.periode === periodeAktif);
    
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

    if (existingPayment) {
      const updatedDetails = { ...existingPayment.details, [field]: numValue };
      const updatedJumlah = Object.values(updatedDetails).reduce((sum: number, val: number) => sum + (val || 0), 0);
      await updateDoc(doc(db, 'payments', existingPayment.id), {
        details: updatedDetails,
        jumlah: updatedJumlah,
        tanggal: new Date().toISOString().split('T')[0]
      });
    } else {
      // Deterministic ID to prevent race conditions during fast typing
      const stableId = `${gerejaId}_${kategori}_${periodeAktif.replace(/\s+/g, '_')}`;
      await setDoc(doc(db, 'payments', stableId), {
        gerejaId, 
        kategori, 
        periode: periodeAktif,
        details: { [field]: numValue },
        jumlah: numValue,
        tanggal: new Date().toISOString().split('T')[0]
      });
    }
  };

  const handleDistributionChange = async (gerejaId: string, field: string, value: string) => {
    if (!currentUserProfile) return; 

    let numValue = parseInt(value.replace(/[^0-9]/g, ''));
    if (isNaN(numValue)) numValue = 0;

    const existingDist = distributions.find(d => d.gerejaId === gerejaId && d.periode === periodeAktif);
    
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

  const handleReorderChurches = async (newOrder: Church[]) => {
    if (!currentUserProfile || sortType !== 'order') return;
    
    // Batch update order fields in Firestore
    const batch = writeBatch(db);
    newOrder.forEach((church, index) => {
      const newIdx = index + 1;
      // We only update if the order has actually changed to save quota
      if (church.order !== newIdx) {
        batch.update(doc(db, 'churches', church.id), { order: newIdx });
      }
    });
    
    try {
      await batch.commit();
    } catch (err: any) {
      console.error("Reorder failed:", err);
    }
  };

  const handleMarkPaymentsAsSent = async (paymentIds: string[]) => {
    try {
      for (const id of paymentIds) {
        await updateDoc(doc(db, 'payments', id), { 
          receiptSent: true,
          receiptSentAt: new Date().toISOString()
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

  const syncToGoogleSheets = async () => {
    if (!appSettings.googleSheetUrl) {
      alert("Silakan atur URL Google Apps Script di Pengaturan terlebih dahulu.");
      return;
    }

    if (!appSettings.googleSheetUrl.includes('/exec')) {
      alert("⚠️ URL TIDAK VALID\n\nSepertinya Anda memasukkan URL Editor. Harap masukkan URL hasil 'New Deployment' yang berakhiran dengan /exec");
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

      // Kita kirim sebagai text/plain untuk menghindari CORS preflight request
      await fetch(appSettings.googleSheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(data)
      });

      alert("🚀 INSTRUKSI SINKRONISASI TERKIRIM!\n\nData sedang diproses oleh Google. \n\nTips: Jika data belum muncul di Google Sheet, klik 'Edit Tampilan' lalu tekan tombol 'Cek Koneksi' untuk memastikan link Anda sudah benar.");
    } catch (error) {
      console.error("Sync Error:", error);
      alert("❌ KEGAGALAN SISTEM\n\nTidak dapat menghubungi server Google. Harap periksa koneksi internet Anda atau pastikan URL Apps Script belum kedaluwarsa.");
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
    if (!currentUserProfile) return alert('Silakan login untuk menambah periode.');
    if (newPeriod.trim() !== '' && !periods.includes(newPeriod.trim())) {
      setPeriods([...periods, newPeriod.trim()]);
      setNewPeriod('');
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
    // Find index in sorted payments
    const sorted = [...payments].sort((a, b) => {
      const ta = (a as any).createdAt?.seconds || 0;
      const tb = (b as any).createdAt?.seconds || 0;
      return ta - tb;
    });
    const index = sorted.findIndex(p => p.id === item.id);
    const base = 1956;
    const currentNum = index >= 0 ? base + index : base;
    return currentNum.toLocaleString('id-ID');
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
              #printable-page { 
                width: 100% !important; 
                margin: 0 !important; 
                padding: 1.5cm !important; 
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
                const btn = e.currentTarget;
                btn.disabled = true;
                const originalText = btn.innerHTML;
                btn.innerHTML = 'Memproses...';

                try {
                  const el = document.getElementById('printable-page');
                  if (el) {
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
                    
                    const waMessage = `Halo Majelis Jemaat GKLI ${printData?.nama}. Terlampir Surat Ucapan Terima Kasih periode ${printData?.periode || periodeAktif}. Terima kasih.`;
                    window.open(`https://wa.me/${printData.wa}?text=${encodeURIComponent(waMessage)}`, '_blank');
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
          <div id="printable-page" className="font-serif text-black" ref={printRef}>
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
                   <p className="text-center text-red-600 font-bold text-[16px] tracking-wider font-sans transform scale-y-110">ANGGOTA PERSEKUTUAN GEREJA-GEREJA DI INDONESIA (PGI)</p>
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
                <div className="flex justify-between items-start leading-relaxed font-sans -mt-4 mb-4">
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
                            return Object.entries(printData.updates || {}).flatMap(([cat, fields]: [any, any]) => (
                              fields.map((f: string) => {
                                const val = printData.allDetails?.[cat]?.[f] || 0;
                                if (val <= 0) return null;
                                count++;
                                return (
                                  <tr key={cat+f}>
                                    <td className="w-5 align-top text-left font-sans text-sm">{count}.</td>
                                    <td className="text-[15px] font-sans">{getFormattedPaymentName(cat, f)}</td>
                                    <td className="w-12 text-left text-[15px] font-sans">Rp.</td>
                                    <td className="w-32 text-right text-[15px] font-sans">{formatRupiah(val)},-</td>
                                  </tr>
                                );
                              })
                            ));
                          })()
                        ) : (
                          (printData.items || []).map((col: string, idx: number) => {
                            const val = printData.details?.[col] || 0;
                            if (val <= 0) return null;
                            return (
                              <tr key={col}>
                                <td className="w-5 align-top text-left font-sans text-sm">{idx + 1}.</td>
                                <td className="text-[15px] font-sans">{getFormattedPaymentName(printData.kategori, col)}</td>
                                <td className="w-12 text-left text-[15px] font-sans">Rp.</td>
                                <td className="w-32 text-right text-[15px] font-sans">{formatRupiah(val)},-</td>
                               </tr>
                             );
                           })
                        )}
                        {(printType !== 'tunggakan' && printType !== 'global-arrears') && (
                          <tr className="border-t border-black">
                            <td className="font-bold pt-1 text-center font-sans tracking-widest uppercase">Jumlah</td>
                            <td></td>
                            <td className="font-bold pt-1 text-left text-[16px] font-sans">Rp.</td>
                            <td className="font-bold pt-1 text-right text-[16px] font-sans tracking-tight">{formatRupiah(printData.total || printData.jumlah || 0)},-</td>
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

                <div className="fixed bottom-0 left-0 w-full text-center text-[8.5px] pb-4 font-sans leading-tight hidden print:block">
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
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full z-20 shadow-2xl no-print border-r border-white/5">
        <div className="p-8 flex flex-col border-b border-white/5">
          <div className="flex items-center space-x-4 mb-6 group cursor-pointer">
            <div className="bg-gradient-to-br from-gold-400 to-gold-600 p-2.5 rounded-2xl shadow-lg shadow-gold-500/20 flex items-center justify-center w-12 h-12 flex-shrink-0 group-hover:rotate-12 transition-transform">
              {appSettings.logoUrl ? (
                <img src={appSettings.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <ShieldCheck size={28} className="text-white" />
              )}
            </div>
            <div className="overflow-hidden">
              <h1 className="text-xl font-black leading-none tracking-tight text-white mb-1 truncate group-hover:text-gold-400 transition-colors">{appSettings.title}</h1>
              <div className="flex items-center space-x-1">
                <div className={`w-1.5 h-1.5 rounded-full ${currentUserProfile ? 'bg-gold-400 shadow-[0_0_8px_rgba(212,175,55,0.6)]' : 'bg-slate-500'}`}></div>
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest truncate">
                  {currentUserProfile?.role === 'superadmin' ? 'Authorized Admin' : currentUserProfile ? 'Staff Access' : 'Public Mode'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard Ringkasan" />
          
          <NavHeader label={appSettings.menuMasterData} />
          <NavItem active={activeTab === 'gereja'} onClick={() => setActiveTab('gereja')} icon={<Users size={20} />} label={appSettings.menuGereja} />
          <NavItem active={activeTab === 'periode'} onClick={() => setActiveTab('periode')} icon={<Calendar size={20} />} label={appSettings.menuPeriode} />

          <NavHeader label={appSettings.menuPembayaran} />
          <NavItem active={activeTab === 'laporan'} onClick={() => setActiveTab('laporan')} icon={<FileText size={20} />} label={appSettings.menuLaporan} />
          <NavItem active={activeTab === 'pelean'} onClick={() => setActiveTab('pelean')} icon={<FileText size={20} />} label={appSettings.menuPelean} />
          <NavItem active={activeTab === 'alaman'} onClick={() => setActiveTab('alaman')} icon={<FileText size={20} />} label={appSettings.menuAlaman} />
          <NavItem active={activeTab === 'distribusi'} onClick={() => setActiveTab('distribusi')} icon={<Truck size={20} />} label="Distribusi Literatur" />

          <NavHeader label={appSettings.menuRekapJudul} />
          <NavItem active={activeTab === 'pengiriman'} onClick={() => setActiveTab('pengiriman')} icon={<MessageCircle size={20} />} label="Pusat Terima Kasih" />
          <NavItem active={activeTab === 'arsip'} onClick={() => setActiveTab('arsip')} icon={<Archive size={20} />} label="Arsip Tanda Terima" />
          <NavItem active={activeTab === 'penagihan'} onClick={() => setActiveTab('penagihan')} icon={<AlertTriangle size={20} />} label="Pusat Penagihan" />
          <NavItem active={activeTab === 'sertifikat'} onClick={() => setActiveTab('sertifikat')} icon={<Award size={20} />} label="Apresiasi Jemaat" />
          <NavItem active={activeTab === 'download'} onClick={() => setActiveTab('download')} icon={<Download size={20} />} label={appSettings.menuDownloadMenu} />

          {currentUserProfile?.role === 'superadmin' && (
            <>
              <NavHeader label="Pengaturan Sistem" />
              <NavItem active={activeTab === 'templates'} onClick={() => setActiveTab('templates')} icon={<FileText size={20} className="text-yellow-500" />} label="Manajemen Template" className="text-yellow-500" />
              <NavItem active={false} onClick={() => { setFormSettings(appSettings); setShowSettingsModal(true); }} icon={<Settings size={20} className="text-yellow-500" />} label="Edit Tampilan" className="text-yellow-500" />
              <NavItem active={activeTab === 'akun'} onClick={() => setActiveTab('akun')} icon={<UserPlus size={20} className="text-yellow-500" />} label="Manajemen Akun" className="text-yellow-500" />
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
      <main className="flex-1 ml-64 min-h-screen flex flex-col">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10 no-print">
          <div className="flex items-center space-x-6">
            <div className="flex flex-col">
              <h2 className="text-xl font-black text-slate-800 tracking-tight">{activeTab.toUpperCase()}</h2>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-pulse"></div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Live System Online</p>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
              <HeaderDownloadBtn onClick={() => handleDownloadCurrentMenu('excel')} icon={<Download size={14} />} label="Excel" color="text-green-600" />
              {currentUserProfile?.role === 'superadmin' && (
                <HeaderDownloadBtn onClick={() => handleDownloadCurrentMenu('word')} icon={<FileText size={14} />} label="Word" color="text-gold-600" />
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
                className="bg-transparent text-sm font-bold text-gold-700 outline-none cursor-pointer"
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
                        <h3 className="font-bold text-lg">Pusat Terima Kasih & Konfirmasi</h3>
                        <p className="text-sm text-slate-500">Kirim ucapan terima kasih untuk setoran yang sudah masuk pada periode {periodeAktif}.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {churches.map(church => {
                        const paymentsForChurch = payments.filter(p => p.gerejaId === church.id && p.periode === periodeAktif && p.jumlah > 0 && !p.receiptSent);
                        if (paymentsForChurch.length === 0) return null;

                        return (
                          <div key={church.id} className="border border-green-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow bg-green-50/10">
                            <div className="bg-green-50 p-4 border-b border-green-100 flex justify-between items-center">
                              <div>
                                <h4 className="font-bold text-slate-800">{church.nama}</h4>
                                <p className="text-xs text-slate-500">Resort {church.resort}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                                  Belum Terkirim
                                </div>
                                {currentUserProfile?.role === 'superadmin' && (
                                  <button 
                                    onClick={async () => {
                                      if (window.confirm(`Hapus SEMUA data setoran ${church.nama} yang belum terkirim? Data akan dihapus permanen dari sistem.`)) {
                                        try {
                                          for (const p of paymentsForChurch) {
                                            await deleteDoc(doc(db, 'payments', p.id));
                                          }
                                        } catch (err: any) {
                                          alert("Error: " + err.message);
                                        }
                                      }
                                    }}
                                    className="bg-red-50 text-red-500 p-1.5 rounded-full hover:bg-red-100 transition-colors border border-red-100"
                                    title="Hapus Semua Data Ini"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="p-4 flex flex-col md:flex-row gap-4">
                              <div className="flex-1 bg-white p-3 rounded-lg border border-green-50">
                                <p className="text-[10px] font-bold text-green-400 uppercase mb-2">Rincian Setoran:</p>
                                <div className="space-y-2">
                                  {paymentsForChurch.map(p => (
                                    <div key={p.id} className="text-xs border-b border-slate-100 pb-2 mb-2">
                                      <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center space-x-2">
                                          <span className="font-bold text-slate-700">{(CATEGORY_LABELS[p.kategori as keyof typeof CATEGORY_LABELS] || p.kategori).toUpperCase()}</span>
                                          <button onClick={() => handleDeletePayment(p.id)} className="text-red-400 hover:text-red-600 transition-colors p-0.5 rounded" title="Hapus Data">
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                        <span className="text-green-600 font-bold">Rp {formatRupiah(p.jumlah)}</span>
                                      </div>
                                      <div className="pl-4 space-y-1">
                                        {Object.entries(p.details || {}).map(([key, val]) => (
                                          (val as number) > 0 && (
                                            <div key={key} className="flex justify-between text-slate-500">
                                              <span>- {getFormattedPaymentName(p.kategori, key)}</span>
                                              <span>Rp {formatRupiah(val as number)}</span>
                                            </div>
                                          )
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="flex flex-col justify-center space-y-2 min-w-[200px]">
                                <button 
                                  onClick={async () => {
                                    const total = paymentsForChurch.reduce((sum, p) => sum + p.jumlah, 0);
                                    let rincian = "";
                                    paymentsForChurch.forEach(p => {
                                      rincian += `\n*${(CATEGORY_LABELS[p.kategori as keyof typeof CATEGORY_LABELS] || p.kategori).toUpperCase()}* (Rp ${formatRupiah(p.jumlah)}):`;
                                      Object.entries(p.details || {}).forEach(([key, val]) => {
                                        if ((val as number) > 0) {
                                          rincian += `\n- ${getFormattedPaymentName(p.kategori, key)} : Rp ${formatRupiah(val as number)}`;
                                        }
                                      });
                                    });
                                    const text = `Syalom Bapak/Ibu Majelis Jemaat *${church.nama}* (Resort ${church.resort}), kami dari Kantor Pusat GKLI mengucapkan **terima kasih banyak** atas persembahan/setoran periode ${periodeAktif}.\n\nRincian yang diterima:${rincian}\n\n*TOTAL: Rp ${formatRupiah(total)}*\n\nKiranya Tuhan Yesus senantiasa memberkati pelayanan kita bersama. Anda juga dapat meminta cetak PDF resmi dari bukti ini kepada kami.`;
                                    window.open(`https://wa.me/${church.wa}?text=${encodeURIComponent(text)}`, '_blank');
                                    
                                    // Pindahkan ke arsip
                                    if (window.confirm("Apakah Anda ingin memindahkan data ini ke arsip (pemberitahuan terkirim)?")) {
                                      await handleMarkPaymentsAsSent(paymentsForChurch.map(p => p.id));
                                    }
                                  }}
                                  className="flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
                                >
                                  <MessageCircle size={16} /> <span>Kirim & Arsipkan</span>
                                </button>
                                <button 
                                  onClick={async () => {
                                    const latest = paymentsForChurch[0];
                                    const totalAmount = paymentsForChurch.reduce((sum, p) => sum + p.jumlah, 0);
                                    setPrintData({
                                      ...church,
                                      periode: periodeAktif,
                                      kategori: latest.kategori,
                                      jumlah: latest.jumlah,
                                      total: totalAmount,
                                      allDetails: paymentsForChurch.reduce((acc, p) => ({ ...acc, [p.kategori]: p.details }), {}),
                                      updates: paymentsForChurch.reduce((acc, p) => ({ ...acc, [p.kategori]: Object.keys(p.details) }), {}),
                                      paymentIds: paymentsForChurch.map(p => p.id) // Carry IDs for marking
                                    });
                                    setPrintType('global-receipt');
                                  }}
                                  className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
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
                        <h3 className="font-bold text-lg">Arsip Tanda Terima</h3>
                        <p className="text-sm text-slate-500">Daftar ucapan terima kasih yang sudah dikirim atau dipindahkan ke arsip pada periode {periodeAktif}.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {churches.map(church => {
                        const sentPayments = payments.filter(p => p.gerejaId === church.id && p.periode === periodeAktif && p.jumlah > 0 && p.receiptSent);
                        if (sentPayments.length === 0) return null;

                        return (
                          <div key={church.id} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow bg-slate-50">
                            <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
                              <div>
                                <h4 className="font-bold text-slate-800">{church.nama}</h4>
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
                                      rincian += `\n*${(CATEGORY_LABELS[p.kategori as keyof typeof CATEGORY_LABELS] || p.kategori).toUpperCase()}* (Rp ${formatRupiah(p.jumlah)}):`;
                                      Object.entries(p.details || {}).forEach(([key, val]) => {
                                        if ((val as number) > 0) {
                                          rincian += `\n- ${getFormattedPaymentName(p.kategori, key)} : Rp ${formatRupiah(val as number)}`;
                                        }
                                      });
                                    });
                                    const text = `Syalom Bapak/Ibu Majelis Jemaat *${church.nama}* (Resort ${church.resort}), berikut kami kirimkan ulang rincian tanda terima periode ${periodeAktif}.\n\nRincian:${rincian}\n\n*TOTAL: Rp ${formatRupiah(total)}*\n\nTerima kasih, Tuhan memberkati.`;
                                    window.open(`https://wa.me/${church.wa}?text=${encodeURIComponent(text)}`, '_blank');
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
                            summaryLines.push(`*${(CATEGORY_LABELS[cat] || cat).toUpperCase()}*:`);
                            summaryLines.push(`  - ${f.join(', ')}`);
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
                                    const text = `Syalom Bapak/Ibu Majelis Jemaat ${church.nama}, kami dari Kantor Pusat GKLI ingin mengingatkan terkait kewajiban persembahan periode ${periodeAktif} yang belum kami terima (Tunggakan):\n\n${summaryLines.join('\n')}\n\nMohon kerja samanya untuk segera melengkapi setoran tersebut. Kiranya Tuhan Yesus memberkati.`;
                                    window.open(`https://wa.me/${church.wa}?text=${encodeURIComponent(text)}`, '_blank');
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
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center no-print">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard 
                      title="Total Arus Kas" 
                      value={`Rp ${formatRupiah(totalPemasukan)}`} 
                      icon={<TrendingUp size={24} />} 
                      color="gold" 
                      subtitle={periodeAktif}
                    />
                    <StatCard 
                      title="Data Terverifikasi" 
                      value={`${stats.totalLunas}`} 
                      icon={<CheckCircle2 size={24} />} 
                      color="gold" 
                      subtitle="LUNAS"
                    />
                     <StatCard 
                      title="Distribusi Literatur" 
                      value={`${stats.totalDistribusiItems}`} 
                      icon={<Package size={24} />} 
                      color="gold" 
                      subtitle="TOTAL UNIT"
                    />
                    <StatCard 
                      title="Antrean Tunggakan" 
                      value={`${stats.totalMenunggak}`} 
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
                      <h3 className="font-bold text-gold-800 mb-1">
                        {currentUserProfile ? `Akses ${currentUserProfile.role === 'superadmin' ? 'Admin' : 'Staf'} Aktif` : "Akses Terbatas (Tamu)"}
                      </h3>
                      <p className="text-sm text-gold-700 leading-relaxed">
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
                          <h2 className="text-3xl font-black tracking-tight uppercase">Prestasi Administrasi</h2>
                          <p className="text-slate-400 font-medium">Penghargaan untuk Jemaat dengan kedisiplinan setoran 100% pada periode {periodeAktif}</p>
                        </div>
                      </div>
                      <div className="hidden lg:block text-right">
                        <p className="text-4xl font-black text-white/10 italic">GKLI PRESTIGE</p>
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
                  <div className="p-6 border-b border-slate-100 space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                      <h3 className="font-bold text-lg">Daftar Jemaat</h3>
                      <div className="flex flex-wrap items-center gap-3">
                        {currentUserProfile && (
                          <div className="flex gap-2">
                             {currentUserProfile.role === 'superadmin' && (
                              <button 
                                onClick={handlePullMasterData} 
                                className="flex items-center space-x-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors shadow-lg shadow-slate-500/10"
                                title="Tarik data jemaat yang sudah saya sediakan sebelumnya"
                              >
                                <Database size={16} /> <span>Tarik Master</span>
                              </button>
                            )}
                            <button onClick={() => setShowBulkModal(true)} className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/10">
                              <Plus size={16} /> <span>Import</span>
                            </button>
                            <button onClick={() => { setFormChurch({ id: '', nama: '', resort: '', wilayah: '', wa: '', order: churches.length + 1 }); setShowChurchModal(true); }} className="flex items-center space-x-2 bg-gold-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gold-700 transition-colors shadow-lg shadow-gold-500/10">
                              <Plus size={16} /> <span>Tambah</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Sort:</span>
                        <select value={sortType} onChange={(e) => setSortType(e.target.value as any)} className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full">
                          <option value="order">Posisi (Manual)</option>
                          <option value="nama">Nama (A-Z)</option>
                          <option value="resort">Resort</option>
                          <option value="wilayah">Wilayah</option>
                        </select>
                      </div>
                      <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Resort:</span>
                        <select value={filterResort} onChange={(e) => setFilterResort(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full">
                          {uniqueResorts.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Wilayah:</span>
                        <select value={filterWilayah} onChange={(e) => setFilterWilayah(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full">
                          {uniqueWilayah.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center justify-center space-x-2 bg-gold-50 text-gold-700 border border-gold-200 rounded-lg px-3 py-2 text-[10px] font-bold">
                        TOTAL: {sortedChurches.length} JEMAAT
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

                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-[#1e293b] text-white uppercase text-[10px] font-bold tracking-wider border-b border-slate-700">
                        <tr>
                          <th className="px-2 py-4 border-b border-slate-700 w-8"></th>
                          <th className="px-6 py-4 border-b border-slate-700">Posisi</th>
                          <th className="px-6 py-4 border-b border-slate-700">Nama Jemaat</th>
                          <th className="px-6 py-4 border-b border-slate-700">Resort</th>
                          <th className="px-6 py-4 border-b border-slate-700">Wilayah</th>
                          {currentUserProfile?.role === 'superadmin' && <th className="px-6 py-4 border-b border-slate-700">WhatsApp</th>}
                          {currentUserProfile && <th className="px-6 py-4 border-b border-slate-700 text-center">Aksi</th>}
                        </tr>
                      </thead>
                      <Reorder.Group 
                        axis="y" 
                        values={sortedChurches} 
                        onReorder={handleReorderChurches} 
                        as="tbody" 
                        className="divide-y divide-slate-100"
                      >
                        {sortedChurches.map((church, idx) => (
                          <Reorder.Item 
                            key={church.id} 
                            value={church} 
                            as="tr" 
                            className="hover:bg-slate-50 transition-colors group cursor-move"
                            dragListener={sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm}
                          >
                            <td className="px-2 py-4">
                              {sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm && (
                                <div 
                                  className="text-slate-300 hover:text-gold-500 transition-all ml-2"
                                  title="Tarik untuk urutkan"
                                >
                                  <GripVertical size={18} />
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-slate-400 font-mono text-xs">#{church.order || church.id}</td>
                            <td className="px-6 py-4 font-bold text-slate-800">{church.nama}</td>
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
                                    <button onClick={() => handleDeleteChurch(church.id)} className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50" title="Hapus">
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </Reorder.Item>
                        ))}
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
                      <thead className="bg-[#1e293b] text-white uppercase text-[10px] font-bold sticky top-0 z-10 border-b border-slate-700">
                        <tr>
                          {sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm && (
                            <th className="px-1 py-4 border-b border-slate-700 sticky left-0 bg-[#1e293b] z-30 w-8"></th>
                          )}
                          <th className="px-4 py-4 border-b border-slate-700 sticky left-0 bg-[#1e293b] z-20 w-12 text-center" style={{ left: sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm ? '32px' : '0' }}>No</th>
                          <th className="px-4 py-4 border-b border-slate-700 sticky left-12 bg-[#1e293b] z-20 w-48" style={{ left: sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm ? '80px' : '48px' }}>Nama Jemaat</th>
                          <th className="px-4 py-4 border-b border-slate-700 text-center w-24">Resort</th>
                          {SPREADSHEET_COLUMNS.alaman.map(col => (
                            <th key={col} className="px-2 py-4 border-b border-slate-700 text-center w-24 tracking-tighter leading-tight italic font-serif opacity-80">{col}</th>
                          ))}
                          <th className="px-4 py-4 border-b border-slate-700 text-center w-24 bg-gold-600 text-white">TOTAL QTY</th>
                        </tr>
                      </thead>
                      <Reorder.Group 
                        axis="y" 
                        values={dataDistribusi.filter(item => {
                          const matchResort = filterResort === 'Semua Resort' || item.resort === filterResort;
                          const matchWilayah = filterWilayah === 'Semua Wilayah' || item.wilayah === filterWilayah;
                          const matchSearch = !searchTerm.trim() || 
                                           item.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                           item.resort.toLowerCase().includes(searchTerm.toLowerCase());
                          return matchResort && matchWilayah && matchSearch;
                        })} 
                        onReorder={(newOrder) => handleReorderChurches(newOrder as any)} 
                        as="tbody" 
                        className="divide-y divide-slate-100"
                      >
                        {dataDistribusi.filter(item => {
                          const matchResort = filterResort === 'Semua Resort' || item.resort === filterResort;
                          const matchWilayah = filterWilayah === 'Semua Wilayah' || item.wilayah === filterWilayah;
                          const matchSearch = !searchTerm.trim() || 
                                           item.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                           item.resort.toLowerCase().includes(searchTerm.toLowerCase());
                          return matchResort && matchWilayah && matchSearch;
                        }).map((item, idx) => {
                          const totalQty = Object.values(item.details).reduce((sum: number, v: any) => sum + (Number(v) || 0), 0);
                          return (
                            <Reorder.Item 
                              key={item.id} 
                              value={item} 
                              as="tr" 
                              className="hover:bg-slate-50 transition-colors group"
                              dragListener={sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm}
                            >
                              {sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm && (
                                <td className="px-1 py-3 sticky left-0 bg-white z-20 border-r border-slate-100 cursor-move">
                                  <GripVertical size={14} className="text-slate-300" />
                                </td>
                              )}
                              <td className="px-4 py-3 sticky bg-white z-10 text-center border-r border-slate-100" style={{ left: sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm ? '32px' : '0' }}>{idx + 1}</td>
                              <td className="px-4 py-3 sticky bg-white z-10 font-bold border-r border-slate-100" style={{ left: sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm ? '80px' : '48px' }}>{item.nama}</td>
                              <td className="px-4 py-3 text-center text-[10px] text-slate-500">{item.resort}</td>
                              {SPREADSHEET_COLUMNS.alaman.map(col => {
                                const val = item.details[col] || 0;
                                return (
                                  <td key={col} className="p-0 border-r border-slate-100">
                                    {currentUserProfile ? (
                                      <input 
                                        type="text" 
                                        value={val === 0 ? '' : val}
                                        onChange={(e) => handleDistributionChange(item.id, col, e.target.value)}
                                        className={`w-full py-3 px-2 text-center outline-none bg-transparent font-mono font-bold ${!val ? 'text-slate-300' : 'text-gold-700'}`}
                                        placeholder="0"
                                      />
                                    ) : (
                                      <div className={`w-full py-3 text-center font-mono ${!val ? 'text-slate-300' : 'text-gold-700 font-bold'}`}>
                                        {val || '-'}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-center font-black font-mono text-slate-900 bg-slate-50 min-w-[100px]">{totalQty}</td>
                            </Reorder.Item>
                          );
                        })}
                      </Reorder.Group>
                    </table>
                  </div>
                </div>
              )}

              {(activeTab === 'laporan' || activeTab === 'pelean' || activeTab === 'alaman') && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h3 className="font-bold text-lg">{appSettings[`menu${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}` as keyof AppSettings]}</h3>
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
                      <thead className="bg-[#1e293b] text-white uppercase text-[10px] font-bold sticky top-0 z-10 border-b border-slate-700">
                        <tr>
                          {sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm && (
                            <th className="px-1 py-4 border-b border-slate-700 sticky left-0 bg-[#1e293b] z-30 w-8"></th>
                          )}
                          <th className="px-4 py-4 border-b border-slate-700 sticky left-0 bg-[#1e293b] z-20 w-12 text-center" style={{ left: sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm ? '32px' : '0' }}>No</th>
                          <th className="px-4 py-4 border-b border-slate-700 sticky left-12 bg-[#1e293b] z-20 w-48" style={{ left: sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm ? '80px' : '48px' }}>Nama Jemaat</th>
                          <th className="px-4 py-4 border-b border-slate-700 text-center w-24">Resort</th>
                          <th className="px-4 py-4 border-b border-slate-700 text-center w-24">Wilayah</th>
                          <th className="px-4 py-4 border-b border-slate-700 text-center w-24">Status</th>
                          {SPREADSHEET_COLUMNS[activeTab as keyof typeof SPREADSHEET_COLUMNS].map(col => (
                            <th key={col} className="px-2 py-4 border-b border-slate-700 text-center w-24 tracking-tighter leading-tight italic font-serif opacity-80">{col}</th>
                          ))}
                          <th className="px-4 py-4 border-b border-slate-700 text-right bg-gold-600 text-white w-32 font-black">TOTAL (RP)</th>
                          <th className="px-4 py-4 border-b border-slate-700 text-center w-24">AKSI</th>
                        </tr>
                      </thead>
                      <Reorder.Group 
                        axis="y" 
                        values={getLaporanData(activeTab as any).filter(item => {
                          const matchResort = filterResort === 'Semua Resort' || item.resort === filterResort;
                          const matchWilayah = filterWilayah === 'Semua Wilayah' || item.wilayah === filterWilayah;
                          const matchSearch = !searchTerm.trim() || 
                                           item.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                           item.resort.toLowerCase().includes(searchTerm.toLowerCase());
                          return matchResort && matchWilayah && matchSearch;
                        })} 
                        onReorder={(newOrder) => handleReorderChurches(newOrder as any)} 
                        as="tbody" 
                        className="divide-y divide-slate-100"
                      >
                        {getLaporanData(activeTab as any).filter(item => {
                          const matchResort = filterResort === 'Semua Resort' || item.resort === filterResort;
                          const matchWilayah = filterWilayah === 'Semua Wilayah' || item.wilayah === filterWilayah;
                          const matchSearch = !searchTerm.trim() || 
                                           item.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                           item.resort.toLowerCase().includes(searchTerm.toLowerCase());
                          return matchResort && matchWilayah && matchSearch;
                        }).map((item, idx) => (
                          <Reorder.Item 
                            key={item.id} 
                            value={item} 
                            as="tr" 
                            className="hover:bg-slate-50 transition-colors group"
                            dragListener={sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm}
                          >
                            {sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm && (
                              <td className="px-1 py-3 sticky left-0 bg-white z-20 border-r border-slate-100 cursor-move">
                                <GripVertical size={14} className="text-slate-300" />
                              </td>
                            )}
                            <td className="px-4 py-3 sticky bg-white z-10 text-center border-r border-slate-100" style={{ left: sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm ? '32px' : '0' }}>{idx + 1}</td>
                            <td className="px-4 py-3 sticky bg-white z-10 font-bold border-r border-slate-100" style={{ left: sortType === 'order' && filterResort === 'Semua Resort' && filterWilayah === 'Semua Wilayah' && !searchTerm ? '80px' : '48px' }}>{item.nama}</td>
                            <td className="px-4 py-3 text-center text-[10px] text-slate-500">{item.resort}</td>
                            <td className="px-4 py-3 text-center text-[10px] text-slate-500 font-bold text-gold-600">{item.wilayah || '-'}</td>
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
                                          className="w-3 h-3 cursor-pointer text-gold-600 focus:ring-gold-500 rounded"
                                          title="Pilih untuk pesan gabungan"
                                        />
                                      </div>
                                    )}
                                    <div className="flex-1 relative flex items-center">
                                      {currentUserProfile?.role === 'superadmin' ? (
                                        <input 
                                          type="text" 
                                          value={val === 0 ? '' : formatInput(val)}
                                          onChange={(e) => handleCellChange(item.id, activeTab as any, col, e.target.value)}
                                          className={`w-full py-3 text-right outline-none bg-transparent font-mono data-value ${!val ? 'text-red-400 font-medium' : 'text-slate-700 font-bold'}`}
                                          placeholder="0"
                                        />
                                      ) : (
                                        <div className={`w-full py-3 text-right font-mono data-value ${!val ? 'text-red-300' : 'text-slate-700 font-bold'}`}>
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
                            <td className="px-4 py-3 text-right font-bold font-mono text-gold-900 bg-gold-50/20 border-l border-gold-100 min-w-[140px]">{formatRupiah(item.jumlah)}</td>
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
                            </td>
                          </Reorder.Item>
                        ))}
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

      <Modal show={showChurchModal} onClose={() => setShowChurchModal(false)} title={formChurch.id ? 'Edit Jemaat' : 'Tambah Jemaat'}>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nama Jemaat</label>
            <input type="text" value={formChurch.nama} onChange={e => setFormChurch({...formChurch, nama: e.target.value})} className="w-full border border-slate-200 p-3 rounded-lg outline-none focus:ring-2 focus:ring-gold-500" placeholder="Nama Jemaat" />
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
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">URL Web App Google Sheets (Apps Script)</label>
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
          ? 'bg-gold-500 text-white shadow-lg shadow-gold-900/40 font-semibold' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      } ${className}`}
    >
      <span className={`${active ? 'text-white' : 'text-slate-500 group-hover:text-gold-400'} transition-colors`}>
        {icon}
      </span>
      <span className="text-sm">{label}</span>
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

function StatCard({ title, value, icon, color, subtitle }: { title: string, value: string, icon: React.ReactNode, color: 'green' | 'red' | 'blue' | 'gold', subtitle?: string }) {
  const themes = {
    green: 'from-emerald-500 to-teal-600 shadow-emerald-200/50 text-emerald-600 bg-emerald-50',
    red: 'from-orange-500 to-red-600 shadow-red-200/50 text-red-600 bg-red-50',
    blue: 'from-gold-500 to-amber-600 shadow-gold-200/50 text-gold-600 bg-gold-50',
    gold: 'from-gold-400 to-gold-600 shadow-gold-200/50 text-gold-600 bg-gold-50'
  };
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition-all">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-xl ${themes[color].split(' shadow')[1].split(' bg')[1]} ${themes[color].split(' text')[1].split(' bg')[0]}`}>
            {icon}
          </div>
          {subtitle && (
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full uppercase tracking-wider">
              {subtitle}
            </span>
          )}
        </div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-2xl font-mono font-bold text-slate-900 tracking-tight">
          {value}
        </p>
      </div>
      <div className={`h-1 bg-gradient-to-r ${themes[color].split(' shadow')[0]}`}></div>
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
        className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-gold-500" 
      />
    </div>
  );
}
