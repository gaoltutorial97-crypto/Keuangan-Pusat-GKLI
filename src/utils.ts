import { Church, FirestoreErrorInfo } from './types';
import { Auth } from 'firebase/auth';

export function normalizeResortName(name: string): string {
  if (!name) return '';
  // Convert to upper, remove "RESORT" prefix, replace non-alphanumeric with underscore for a robust KEY
  let n = name.toUpperCase()
    .replace(/^RESORT\s+/, '')
    .replace(/[^A-Z0-9]+/g, '_') // Replace sequences of special chars with a single underscore
    .replace(/^_+|_+$/g, '') // Trim underscores from ends
    .trim();
  
  if (n === 'SIMPANGLIMUMMEDAN' || n === 'SIMPANG_LIMUN_MEDAN' || n === 'SIMPANGLIMUNMEDAN') return 'SIMPANG_LIMUN_MEDAN';
  if (n.includes('MARINDAL')) return 'MARINDAL';
  
  return n;
}

export function cleanResortName(name: string): string {
  if (!name) return '';
  // Remove "RESORT" prefix and clean up extra spaces
  let n = name.replace(/^RESORT\s+/i, '').trim();
  
  // If it's a normalized key (contains underscores but no spaces), convert underscores to spaces
  if (n.includes('_') && !n.includes(' ')) {
    n = n.replace(/_/g, ' ');
  }

  // Capitalize each word properly
  return n.split(/\s+/).map(word => {
    if (word.length === 0) return '';
    // Special case for Roman numerals (I, II, III, IV, V)
    if (/^[IVXLCDM]+$/i.test(word)) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

export function normalizeChurchName(name: string): string {
  if (!name) return '';
  return name.toUpperCase()
    .replace(/^GKLI\s+/, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
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

export function formatRupiah(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num);
}

export function handleFirestoreError(
  error: any,
  operationType: FirestoreErrorInfo['operationType'],
  path: string | null,
  auth: Auth
): FirestoreErrorInfo {
  const user = auth.currentUser;
  
  const info: FirestoreErrorInfo = {
    error: error.message || String(error),
    operationType,
    path,
    authInfo: {
      userId: user?.uid || 'anonymous',
      email: user?.email || 'none',
      emailVerified: user?.emailVerified || false,
      isAnonymous: user?.isAnonymous || true,
      providerInfo: user?.providerData.map(p => ({
        providerId: p.providerId,
        displayName: p.displayName || '',
        email: p.email || ''
      })) || []
    }
  };

  console.error("Firestore Error Detailed:", info);
  return info;
}
