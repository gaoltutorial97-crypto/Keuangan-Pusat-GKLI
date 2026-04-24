import { Church } from './types';

export function normalizeResortName(name: string): string {
  if (!name) return '';
  // Convert to upper, remove any punctuation/extra symbols, normalize spaces
  let n = name.toUpperCase()
    .replace(/^RESORT\s+/, '')
    .replace(/[^A-Z0-9\s]/g, ' ') // Strip punctuation
    .replace(/\s+/g, ' ')         // Normalize multiple spaces
    .trim();
  
  // Specific fixes
  if (n === 'SIMPANG LIMUM MEDAN') return 'SIMPANG LIMUN MEDAN';
  if (n === 'PASAR IV MARINDAL II' || n === 'PERSIAPAN PASAR IV MARINDAL II') return 'PERSIAPAN PASAR IV MARINDAL II';
  
  return n;
}

export function normalizeChurchName(name: string): string {
  if (!name) return '';
  return name.toUpperCase()
    .replace(/^GKLI\s+/, '')
    .replace(/[^A-Z0-9\s]/g, ' ') // Strip punctuation
    .replace(/\s+/g, ' ')         // Normalize multiple spaces
    .trim();
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
  // Convert "Tahun 2026" or "2026" to "2026" by stripping everything but numbers
  return p.replace(/[^0-9]/g, '').trim();
}
