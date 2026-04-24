export interface Church {
  id: string;
  nama: string;
  resort: string;
  wilayah: string;
  wa: string;
  order?: number;
  type?: 'jemaat' | 'resort'; // Tambahkan tipe untuk membedakan Jemaat dan Resort
  isSynthesized?: boolean;
  isVirtual?: boolean;
}

export interface Payment {
  id: string;
  gerejaId: string;
  kategori: 'laporan' | 'pelean' | 'alaman';
  periode: string;
  details: Record<string, number>;
  jumlah: number;
  tanggal: string;
  receiptSent?: boolean;
  receiptSentAt?: string;
  buktiTransfer?: string;
  buktiTransferBase64?: string;
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
  googleSheetUrl: string;
  googleSpreadsheetId?: string;
  watzapApiKey?: string;
  watzapSender?: string;
  theme?: 'default' | 'ocean' | 'nature' | 'monochrome';
  periodeList?: string[];
  periodeAktif?: string;
}

export interface Distribution {
  id: string;
  gerejaId: string;
  periode: string;
  details: Record<string, number>;
  tanggal: string;
}

export type TabType = 'dashboard' | 'gereja' | 'periode' | 'laporan' | 'pelean' | 'alaman' | 'distribusi' | 'download' | 'akun' | 'templates' | 'pengiriman' | 'penagihan' | 'sertifikat' | 'arsip';
