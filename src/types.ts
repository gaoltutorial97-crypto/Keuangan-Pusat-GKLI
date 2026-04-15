export interface Church {
  id: string;
  nama: string;
  resort: string;
  wa: string;
}

export interface Payment {
  id: string;
  gerejaId: string;
  kategori: 'laporan' | 'pelean' | 'alaman';
  periode: string;
  details: Record<string, number>;
  jumlah: number;
  tanggal: string;
}

export interface User {
  username: string;
  password: string;
  role: 'superadmin' | 'staff';
}

export interface AppSettings {
  title: string;
  logoUrl: string;
  menuMasterData: string;
  menuGereja: string;
  menuPeriode: string;
  menuPembayaran: string;
  menuLaporan: string;
  menuPelean: string;
  menuAlaman: string;
  menuRekapJudul: string;
  menuRekapMenu: string;
  menuDownloadMenu: string;
}

export type TabType = 'dashboard' | 'gereja' | 'periode' | 'laporan' | 'pelean' | 'alaman' | 'download' | 'akun' | 'templates' | 'pengiriman' | 'penagihan' | 'sertifikat';
