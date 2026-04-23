import { Church } from './types';

export function normalizeResortName(name: string): string {
  if (!name) return '';
  let n = name.trim();
  // Strip "RESORT " prefix case-insensitive
  n = n.replace(/^RESORT\s+/i, '');
  
  // Specific fixes based on user feedback
  const up = n.toUpperCase();
  if (up === 'SIMPANG LIMUM MEDAN') return 'Simpang Limun Medan';
  if (up === 'PASAR IV MARINDAL II' || up === 'PERSIAPAN PASAR IV MARINDAL II') return 'Persiapan Pasar IV Marindal II';
  
  // Consistent Title Case for others
  return n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function normalizeChurchName(name: string): string {
  if (!name) return '';
  return name.toUpperCase().replace(/^GKLI\s+/, '').trim();
}

/**
 * Creates a unique identity key for a church based on normalized resort and name.
 * This is the "Master Key" used for deduplication and cross-alias payment tracking.
 */
export function getChurchIdentityKey(church: Church): string {
  const normResort = normalizeResortName(church.resort);
  const normName = normalizeChurchName(church.nama);
  return `${normResort}_${normName}`;
}

export function normalizePeriode(p: string): string {
  if (!p) return '';
  // Convert "Tahun 2026" or "2026" both to "2026"
  return p.replace(/Tahun\s+/i, '').trim();
}
