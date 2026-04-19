import { Church, AppSettings } from './types';

export const SPREADSHEET_COLUMNS = {
  laporan: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  pelean: ['Pendidikan', 'Ulang Tahun', 'PGI/LWF/UEM', 'Zending', 'Pensiun', 'Diakonia'],
  alaman: ['Almanak', 'Kalender', 'Evang. Edisi 1', 'Evang. Edisi 2', 'Evang. Edisi 3', 'Buku SKM', 'Buku Ende']
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

const knownChurches: Church[] = [
  { id: '1', nama: 'Sp. Limun Medan', resort: 'Medan', wa: '' },
  { id: '2', nama: 'Pos PI Kuala Bekala', resort: 'Medan', wa: '' },
  { id: '3', nama: 'Pos PI. Namorambe', resort: 'Medan', wa: '' },
  { id: '4', nama: 'Pasar IV Marindal', resort: 'Pasar IV Marindal II', wa: '' },
  { id: '5', nama: 'Taman Sari', resort: 'Batu Bara', wa: '' },
  { id: '6', nama: 'Kuala Tanjung', resort: 'Batu Bara', wa: '' },
  { id: '7', nama: 'Karang Sari', resort: 'Pematang Siantar', wa: '' },
  { id: '8', nama: 'Hosiana Sibuntuon', resort: 'Simalungun', wa: '' },
  { id: '9', nama: 'Borno - Tambun Raya', resort: 'Simalungun', wa: '' },
  { id: '10', nama: 'Agave - Sinaman', resort: 'Simalungun', wa: '' },
  { id: '11', nama: 'Lumban Siagian', resort: 'Panggabean', wa: '' },
  { id: '12', nama: 'Pantis', resort: 'Pahae Julu', wa: '' },
  { id: '13', nama: 'Lontung Dolok', resort: 'Pahae Julu', wa: '' },
  { id: '14', nama: 'Tarutung Kota', resort: 'Tarutung Kota', wa: '' },
  { id: '15', nama: 'Sipoholon', resort: 'Tarutung Kota', wa: '' },
  { id: '16', nama: 'Pagar Batu', resort: 'Tarutung Kota', wa: '' },
  { id: '17', nama: 'Perumnas Silangkitang', resort: 'Tarutung Kota', wa: '' },
  { id: '18', nama: 'Sitamba', resort: 'Sitamba', wa: '' },
  { id: '19', nama: 'Pardamean', resort: 'Sitamba', wa: '' },
  { id: '20', nama: 'Banjar Pardomuan', resort: 'Sitamba', wa: '' },
  { id: '21', nama: 'Huta Raja', resort: 'Sitamba', wa: '' },
  { id: '22', nama: 'Simbontar', resort: 'Sitamba', wa: '' },
  { id: '23', nama: 'Lumban Holbung', resort: 'Lumban Holbung', wa: '' },
  { id: '24', nama: 'Silima Bahal', resort: 'Lumban Holbung', wa: '' },
  { id: '25', nama: 'Parrongitan', resort: 'Lumban Holbung', wa: '' },
  { id: '26', nama: 'Sihujur', resort: 'Lumban Holbung', wa: '' },
  { id: '27', nama: 'Pagar Sinondi', resort: 'Lumban Holbung', wa: '' },
  { id: '68', nama: 'Tapian Nauli', resort: 'Manduamas', wa: '' },
  { id: '69', nama: 'MuaraOre', resort: 'Manduamas', wa: '' },
  { id: '70', nama: 'Estomi', resort: 'Manduamas', wa: '' },
  { id: '71', nama: 'Sarmanauli', resort: 'Manduamas', wa: '' },
  { id: '72', nama: 'Afdeling VI', resort: 'Manduamas', wa: '' },
  { id: '73', nama: 'Bondar Sihudon', resort: 'Manduamas', wa: '' },
  { id: '74', nama: 'Pos PI Pagaran Baru', resort: 'Manduamas', wa: '' },
  { id: '78', nama: 'Kulim Duri', resort: 'Riau Daratan', wa: '' },
  { id: '79', nama: 'Bunut Perawang', resort: 'Perawang', wa: '' },
  { id: '80', nama: 'Pasar Minggu Kandis', resort: 'Perawang', wa: '' },
  { id: '81', nama: 'Judika Sukaramai', resort: 'Sukaramai', wa: '' },
  { id: '82', nama: 'Rogate Senamanenek', resort: 'Sukaramai', wa: '' },
  { id: '83', nama: 'Anugerah - Ramarama', resort: 'Sukaramai', wa: '' },
  { id: '84', nama: 'Filadelfia G. Makmur', resort: 'Sukaramai', wa: '' },
  { id: '85', nama: 'Estoihi Pabaso', resort: 'Sukaramai', wa: '' },
  { id: '86', nama: 'Pos P.I. Rantau Jaya', resort: 'Rantau Jaya', wa: '' },
  { id: '87', nama: 'Kuamang Kuning', resort: 'Kuamang Kuning', wa: '' },
  { id: '88', nama: 'Pos P.I. Suku Sanak HTI', resort: 'Kuamang Kuning', wa: '' },
  { id: '89', nama: 'Pranap', resort: 'Indragiri Hulu', wa: '' },
  { id: '90', nama: 'Pasir Putih', resort: 'Indragiri Hulu', wa: '' },
  { id: '91', nama: 'Lintas Timur', resort: 'Indragiri Hulu', wa: '' },
  { id: '92', nama: 'Rantau Jaya', resort: 'Indragiri Hulu', wa: '' },
  { id: '93', nama: 'Balo Kolam', resort: 'Jetun Naoya', wa: '' },
  { id: '94', nama: 'Batu Aji', resort: 'Batu Aji Batam', wa: '' },
  { id: '95', nama: 'Cibinong', resort: 'Jabodetabek', wa: '' },
  { id: '96', nama: 'Agave - Betumonga', resort: 'Mentawai', wa: '' },
  { id: '97', nama: 'Betesda - Taraet', resort: 'Taraet', wa: '' },
  { id: '98', nama: 'Hosanna - Bosua', resort: 'Bosua', wa: '' },
  { id: '99', nama: 'Maranatha - Gobi', resort: 'Bosua', wa: '' },
  { id: '100', nama: 'Petra - Katiet', resort: 'Sao', wa: '' },
  { id: '101', nama: 'Pniel - Sao', resort: 'Sao', wa: '' },
  { id: '102', nama: 'Emmaus - Nemnemleuleu', resort: 'Nemnemlelew', wa: '' },
  { id: '103', nama: 'Getsemane - Takuman', resort: 'Nemnemlelew', wa: '' },
  { id: '104', nama: 'Siloam - Silaoinan', resort: 'Saureinu', wa: '' },
  { id: '105', nama: 'Betlehem - Saureinu', resort: 'Saureinu', wa: '' },
  { id: '106', nama: 'Galilea - Matobe', resort: 'Saureinu', wa: '' },
  { id: '107', nama: 'Anugerah Tuapejat', resort: 'Saureinu', wa: '' },
  { id: '108', nama: 'Eben Ezer - Sumbul Julu', resort: 'Sumbul Dairi', wa: '' },
  { id: '109', nama: 'Juma Rambong', resort: 'Sumbul Dairi', wa: '' },
  { id: '110', nama: 'Gloria - Silencer', resort: 'Sumbul Dairi', wa: '' },
  { id: '111', nama: 'GKLI Tumandei Saibi', resort: 'Siberut Tengah', wa: '' },
  { id: '112', nama: 'GKLI Kinapat Totoet', resort: 'Siberut Tengah', wa: '' }
];

export const INITIAL_CHURCHES: Church[] = Array.from({ length: 112 }, (_, i) => {
  const id = (i + 1).toString();
  const existing = knownChurches.find(c => c.id === id);
  return existing || { id, nama: `Jemaat No. ${id}`, resort: '-', wa: '' };
});
