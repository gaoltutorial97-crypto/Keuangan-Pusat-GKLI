import { Church, AppSettings } from './types';

export const SPREADSHEET_COLUMNS = {
  laporan: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  pelean: ['Pendidikan', 'Ulang Tahun', 'PGI/LWF/UEM', 'Zending', 'Pensiun', 'Diakonia'],
  alaman: ['Almanak', 'Kalender', 'Evang. Edisi 1', 'Evang. Edisi 2', 'Evang. Edisi 3', 'Buku SKM', 'Buku Ende', 'Agenda Batak', 'Agenda Indonesia', 'Confesi Ausburg']
};

export const CATEGORY_LABELS: Record<string, string> = {
  laporan: 'Persembahan II',
  pelean: 'Persembahan Khusus (Namarboho)',
  alaman: 'Literatur'
};

export const DEFAULT_SETTINGS: AppSettings = {
  title: 'Keuangan GKLI',
  logoUrl: '',
  menuMasterData: 'Master Data',
  menuGereja: 'Data Gereja (Anggota)',
  menuPeriode: 'Periode Tahunan',
  menuPembayaran: 'Pembayaran & Tagihan',
  menuLaporan: 'Persembahan II',
  menuPelean: 'Persembahan Khusus (Namarboho)',
  menuAlaman: 'Literatur',
  menuRekapJudul: 'Laporan & Rekap',
  menuRekapMenu: 'Cetak Rekapitulasi',
  menuDownloadMenu: 'Download Excel/Word/PDF',
  googleSheetUrl: ''
};

const knownChurches: any[] = [
  { id: '1', nama: 'Sp. Limun Medan', resort: 'Medan', wa: '', wilayah: '', order: 1 },
  { id: '2', nama: 'Pos PI Kuala Bekala', resort: 'Medan', wa: '', wilayah: '', order: 2 },
  { id: '3', nama: 'Pos PI. Namorambe', resort: 'Medan', wa: '', wilayah: '', order: 3 },
  { id: '4', nama: 'Pasar IV Marindal', resort: 'Pasar IV Marindal II', wa: '', wilayah: '', order: 4 },
  { id: '5', nama: 'Taman Sari', resort: 'Batu Bara', wa: '', wilayah: '', order: 5 },
  { id: '6', nama: 'Kuala Tanjung', resort: 'Batu Bara', wa: '', wilayah: '', order: 6 },
  { id: '7', nama: 'Karang Sari', resort: 'Pematang Siantar', wa: '', wilayah: '', order: 7 },
  { id: '8', nama: 'Hosiana Sibuntuon', resort: 'Simalungun', wa: '', wilayah: '', order: 8 },
  { id: '9', nama: 'Borno - Tambun Raya', resort: 'Simalungun', wa: '', wilayah: '', order: 9 },
  { id: '10', nama: 'Agave - Sinaman', resort: 'Simalungun', wa: '', wilayah: '', order: 10 },
  { id: '11', nama: 'Lumban Siagian', resort: 'Panggabean', wa: '', wilayah: '', order: 11 },
  { id: '12', nama: 'Pantis', resort: 'Pahae Julu', wa: '', wilayah: '', order: 12 },
  { id: '13', nama: 'Lontung Dolok', resort: 'Pahae Julu', wa: '', wilayah: '', order: 13 },
  { id: '14', nama: 'Tarutung Kota', resort: 'Tarutung Kota', wa: '', wilayah: '', order: 14 },
  { id: '15', nama: 'Sipoholon', resort: 'Tarutung Kota', wa: '', wilayah: '', order: 15 },
  { id: '16', nama: 'Pagar Batu', resort: 'Tarutung Kota', wa: '', wilayah: '', order: 16 },
  { id: '17', nama: 'Perumnas Silangkitang', resort: 'Tarutung Kota', wa: '', wilayah: '', order: 17 },
  { id: '18', nama: 'Sitamba', resort: 'Sitamba', wa: '', wilayah: '', order: 18 },
  { id: '19', nama: 'Pardamean', resort: 'Sitamba', wa: '', wilayah: '', order: 19 },
  { id: '20', nama: 'Banjar Pardomuan', resort: 'Sitamba', wa: '', wilayah: '', order: 20 },
  { id: '21', nama: 'Huta Raja', resort: 'Sitamba', wa: '', wilayah: '', order: 21 },
  { id: '22', nama: 'Simbontar', resort: 'Sitamba', wa: '', wilayah: '', order: 22 },
  { id: '23', nama: 'Lumban Holbung', resort: 'Lumban Holbung', wa: '', wilayah: '', order: 23 },
  { id: '24', nama: 'Silima Bahal', resort: 'Lumban Holbung', wa: '', wilayah: '', order: 24 },
  { id: '25', nama: 'Parrongitan', resort: 'Lumban Holbung', wa: '', wilayah: '', order: 25 },
  { id: '26', nama: 'Sihujur', resort: 'Lumban Holbung', wa: '', wilayah: '', order: 26 },
  { id: '27', nama: 'Pagar Sinondi', resort: 'Lumban Holbung', wa: '', wilayah: '', order: 27 },
  { id: '68', nama: 'Tapian Nauli', resort: 'Manduamas', wa: '', wilayah: '', order: 28 },
  { id: '69', nama: 'MuaraOre', resort: 'Manduamas', wa: '', wilayah: '', order: 29 },
  { id: '70', nama: 'Estomi', resort: 'Manduamas', wa: '', wilayah: '', order: 30 },
  { id: '71', nama: 'Sarmanauli', resort: 'Manduamas', wa: '', wilayah: '', order: 31 },
  { id: '72', nama: 'Afdeling VI', resort: 'Manduamas', wa: '', wilayah: '', order: 32 },
  { id: '73', nama: 'Bondar Sihudon', resort: 'Manduamas', wa: '', wilayah: '', order: 33 },
  { id: '74', nama: 'Pos PI Pagaran Baru', resort: 'Manduamas', wa: '', wilayah: '', order: 34 },
  { id: '78', nama: 'Kulim Duri', resort: 'Riau Daratan', wa: '', wilayah: '', order: 35 },
  { id: '79', nama: 'Bunut Perawang', resort: 'Perawang', wa: '', wilayah: '', order: 36 },
  { id: '80', nama: 'Pasar Minggu Kandis', resort: 'Perawang', wa: '', wilayah: '', order: 37 },
  { id: '81', nama: 'Judika Sukaramai', resort: 'Sukaramai', wa: '', wilayah: '', order: 38 },
  { id: '82', nama: 'Rogate Senamanenek', resort: 'Sukaramai', wa: '', wilayah: '', order: 39 },
  { id: '83', nama: 'Anugerah - Ramarama', resort: 'Sukaramai', wa: '', wilayah: '', order: 40 },
  { id: '84', nama: 'Filadelfia G. Makmur', resort: 'Sukaramai', wa: '', wilayah: '', order: 41 },
  { id: '85', nama: 'Estoihi Pabaso', resort: 'Sukaramai', wa: '', wilayah: '', order: 42 },
  { id: '86', nama: 'Pos P.I. Rantau Jaya', resort: 'Rantau Jaya', wa: '', wilayah: '', order: 43 },
  { id: '87', nama: 'Kuamang Kuning', resort: 'Kuamang Kuning', wa: '', wilayah: '', order: 44 },
  { id: '88', nama: 'Pos P.I. Suku Sanak HTI', resort: 'Kuamang Kuning', wa: '', wilayah: '', order: 45 },
  { id: '89', nama: 'Pranap', resort: 'Indragiri Hulu', wa: '', wilayah: '', order: 46 },
  { id: '90', nama: 'Pasir Putih', resort: 'Indragiri Hulu', wa: '', wilayah: '', order: 47 },
  { id: '91', nama: 'Lintas Timur', resort: 'Indragiri Hulu', wa: '', wilayah: '', order: 48 },
  { id: '92', nama: 'Rantau Jaya', resort: 'Indragiri Hulu', wa: '', wilayah: '', order: 49 },
  { id: '93', nama: 'Balo Kolam', resort: 'Jetun Naoya', wa: '', wilayah: '', order: 50 },
  { id: '94', nama: 'Batu Aji', resort: 'Batu Aji Batam', wa: '', wilayah: '', order: 51 },
  { id: '95', nama: 'Cibinong', resort: 'Jabodetabek', wa: '', wilayah: '', order: 52 },
  { id: '96', nama: 'Agave - Betumonga', resort: 'Mentawai', wa: '', wilayah: '', order: 53 },
  { id: '97', nama: 'Betesda - Taraet', resort: 'Taraet', wa: '', wilayah: '', order: 54 },
  { id: '98', nama: 'Hosanna - Bosua', resort: 'Bosua', wa: '', wilayah: '', order: 55 },
  { id: '99', nama: 'Maranatha - Gobi', resort: 'Bosua', wa: '', wilayah: '', order: 56 },
  { id: '100', nama: 'Petra - Katiet', resort: 'Sao', wa: '', wilayah: '', order: 57 },
  { id: '101', nama: 'Pniel - Sao', resort: 'Sao', wa: '', wilayah: '', order: 58 },
  { id: '102', nama: 'Emmaus - Nemnemleuleu', resort: 'Nemnemlelew', wa: '', wilayah: '', order: 59 },
  { id: '103', nama: 'Getsemane - Takuman', resort: 'Nemnemlelew', wa: '', wilayah: '', order: 60 },
  { id: '104', nama: 'Siloam - Silaoinan', resort: 'Saureinu', wa: '', wilayah: '', order: 61 },
  { id: '105', nama: 'Betlehem - Saureinu', resort: 'Saureinu', wa: '', wilayah: '', order: 62 },
  { id: '106', nama: 'Galilea - Matobe', resort: 'Saureinu', wa: '', wilayah: '', order: 63 },
  { id: '107', nama: 'Anugerah Tuapejat', resort: 'Saureinu', wa: '', wilayah: '', order: 64 },
  { id: '108', nama: 'Eben Ezer - Sumbul Julu', resort: 'Sumbul Dairi', wa: '', wilayah: '', order: 65 },
  { id: '109', nama: 'Juma Rambong', resort: 'Sumbul Dairi', wa: '', wilayah: '', order: 66 },
  { id: '110', nama: 'Gloria - Silencer', resort: 'Sumbul Dairi', wa: '', wilayah: '', order: 67 },
  { id: '111', nama: 'GKLI Tumandei Saibi', resort: 'Siberut Tengah', wa: '', wilayah: '', order: 68 },
  { id: '112', nama: 'GKLI Kinapat Totoet', resort: 'Siberut Tengah', wa: '', wilayah: '', order: 69 }
];

export const INITIAL_CHURCHES: Church[] = Array.from({ length: 112 }, (_, i) => {
  const id = (i + 1).toString();
  const existing = knownChurches.find(c => c.id === id);
  return existing || { id, nama: `Jemaat No. ${id}`, resort: '-', wilayah: '', wa: '', order: parseInt(id) };
});
