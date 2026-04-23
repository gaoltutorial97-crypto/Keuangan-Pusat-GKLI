import { Church } from './types';

export function normalizeResortName(name: string): string {
  if (!name) return '';
  let n = name.trim().toUpperCase();
  // Strip "RESORT " prefix
  n = n.replace(/^RESORT\s+/, '');
  
  // Specific fixes
  if (n === 'SIMPANG LIMUM MEDAN') return 'SIMPANG LIMUN MEDAN';
  if (n === 'PASAR IV MARINDAL II' || n === 'PERSIAPAN PASAR IV MARINDAL II') return 'PERSIAPAN PASAR IV MARINDAL II';
  
  return n;
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
