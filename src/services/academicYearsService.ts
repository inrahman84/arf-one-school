import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from '../lib/documentStore';
import { db } from '../lib/backend';
import { auditService } from './auditService';

const COLLECTION = 'academicYears';
const CACHE_KEY = 'arf_academic_years_master_v2';
const ACTIVE_DOC_ID = '_active';
const ACTIVE_CACHE_KEY = 'arf_active_academic_year_v1';

/** Canonical format: four-digit start year and its immediate successor. */
export function normalizeAcademicYear(input: string): string | null {
  const match = /^(\d{4})\s*\/\s*(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (start < 2000 || start > 2099 || end !== start + 1) return null;
  return `${start}/${end}`;
}

export function sortedAcademicYears(years: string[]): string[] {
  return Array.from(new Set(years.map(normalizeAcademicYear).filter((v): v is string => Boolean(v))))
    .sort((a, b) => Number(b.slice(0, 4)) - Number(a.slice(0, 4)));
}

export interface AcademicYearsResult {
  years: string[];
  activeYear: string | null;
  /** False means only cached master + existing class periods may be shown. */
  connected: boolean;
  warning: string | null;
}

function readCachedYears(): string[] {
  try {
    const years = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    return Array.isArray(years) ? sortedAcademicYears(years.filter((year): year is string => typeof year === 'string')) : [];
  } catch {
    return [];
  }
}

function cachedActiveYear(): string | null {
  try {return normalizeAcademicYear(localStorage.getItem(ACTIVE_CACHE_KEY) || '');}
  catch {return null;}
}
function cacheActiveYear(year: string | null) {
  try {if(year)localStorage.setItem(ACTIVE_CACHE_KEY,year);else localStorage.removeItem(ACTIVE_CACHE_KEY);}catch{}
}
function cacheYears(years: string[]): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(sortedAcademicYears(years))); }
  catch { /* Caching is optional; Supabase remains authoritative. */ }
}

function friendlySupabaseError(error: unknown, action: string): string {
  const err = error as { code?: string; message?: string };
  const code = err?.code || '';
  if (code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
    return `Izin akses Supabase ditolak saat ${action}. Aturan untuk koleksi /academicYears belum aktif atau akun tidak memiliki otorisasi. Buka petunjuk konfigurasi Supabase dalam ZIP proyek.`;
  }
  if (code === 'unavailable' || code === 'failed-precondition' || err?.message?.includes('offline')) {
    return `Koneksi database belum tersedia saat ${action}. Periksa koneksi dan ID database Supabase, kemudian coba Muat Ulang.`;
  }
  return `Gagal ${action}. ${err?.message || 'Periksa konfigurasi dan izin Supabase.'}`;
}

export const academicYearsService = {
  /** Loads the Supabase master, falling back to a local read-only snapshot, never blocking the classroom page. */
  async loadAcademicYears(): Promise<AcademicYearsResult> {
    try {
      const [snapshot, activeRecord] = await Promise.all([
        getDocs(collection(db, COLLECTION)),
        getDoc(doc(db,COLLECTION,ACTIVE_DOC_ID))
      ]);
      const years = sortedAcademicYears(snapshot.docs
        .filter(d=>d.id !== ACTIVE_DOC_ID)
        .map(d=>String(d.data().label || d.id.replace('-', '/'))));
      const candidate = activeRecord.exists()
        ? normalizeAcademicYear(String(activeRecord.data().activeYear||'')) : null;
      const activeYear = candidate && years.includes(candidate) ? candidate : null;
      cacheYears(years);
      cacheActiveYear(activeYear);
      return { years, activeYear, connected: true, warning: null };
    } catch (error) {
      console.warn('Master tahun ajaran gagal disinkronkan:', error);
      return {
        years: readCachedYears(),
        activeYear: cachedActiveYear(),
        connected: false,
        warning: friendlySupabaseError(error, 'membaca Master Tahun Ajaran')
      };
    }
  },

  /** One central pointer guarantees at most one selected academic year for new input. */
  async activateAcademicYear(value: string): Promise<string> {
    const label = normalizeAcademicYear(value);
    if(!label)throw new Error('Tahun ajaran tidak valid.');
    try {
      const master=await getDoc(doc(db,COLLECTION,label.replace('/','-')));
      if(!master.exists())throw new Error('Aktivasi hanya dapat dilakukan pada tahun ajaran yang sudah ada di Master.');
      await setDoc(doc(db,COLLECTION,ACTIVE_DOC_ID),{
        activeYear:label,
        updatedAt:new Date().toISOString()
      });
      cacheActiveYear(label);
      void auditService.log('ACTIVATE_ACADEMIC_YEAR','AcademicYear',ACTIVE_DOC_ID,undefined,
        `Mengaktifkan Tahun Ajaran ${label} untuk pengisian data`).catch(console.warn);
      return label;
    } catch(error) {
      if(error instanceof Error && error.message.includes('Aktivasi hanya'))throw error;
      throw new Error(friendlySupabaseError(error,`mengaktifkan tahun ajaran ${label}`));
    }
  },

  async addAcademicYear(value: string): Promise<string> {
    const label = normalizeAcademicYear(value);
    if (!label) throw new Error('Format tahun ajaran harus YYYY/YYYY+1, misalnya 2027/2028.');
    const id = label.replace('/', '-');
    try {
      await setDoc(doc(db, COLLECTION, id), {
        label,
        startYear: Number(label.slice(0, 4)),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      cacheYears([...readCachedYears(), label]);
      await auditService.log('SAVE_ACADEMIC_YEAR', 'AcademicYear', id, undefined, `Menambahkan tahun ajaran ${label}`);
      return label;
    } catch (error) {
      throw new Error(friendlySupabaseError(error, `menyimpan ${label}`));
    }
  },

  /**
   * Only removes a master record, NEVER historical classroom/student records.
   * Checks all school class subcollections on Supabase immediately before deletion;
   * a failed dependency check fails closed. For strict concurrency protection,
   * enforce this invariant in a trusted backend as well.
   */
  async deleteAcademicYear(value: string): Promise<void> {
    const label = normalizeAcademicYear(value);
    if (!label) throw new Error('Tahun ajaran tidak valid.');
    const id = label.replace('/', '-');
    try {
      const active = await getDoc(doc(db,COLLECTION,ACTIVE_DOC_ID));
      if(normalizeAcademicYear(String(active.data().activeYear||''))===label) {
        throw new Error(`Tahun ajaran ${label} sedang aktif. Aktifkan tahun lain sebelum menghapusnya.`);
      }
      const schoolsSnapshot = await getDocs(collection(db, 'schools'));
      let usedBy = 0;
      for (const school of schoolsSnapshot.docs) {
        const classSnapshot = await getDocs(collection(db, 'schools', school.id, 'classes'));
        usedBy += classSnapshot.docs.filter(item =>
          normalizeAcademicYear(String(item.data().academic_year || '').replace(/-/g, '/')) === label
        ).length;
      }
      if (usedBy > 0) {
        throw new Error(`Tahun ajaran ${label} masih digunakan oleh ${usedBy} rombel. Hapus tidak diizinkan untuk melindungi riwayat peserta didik.`);
      }
    } catch (error) {
      if (error instanceof Error && (error.message.includes('masih digunakan') || error.message.includes('sedang aktif'))) throw error;
      throw new Error(friendlySupabaseError(error, `memeriksa keterkaitan rombel ${label}`));
    }

    try {
      await deleteDoc(doc(db, COLLECTION, id));
      cacheYears(readCachedYears().filter(year => year !== label));
      await auditService.log('DELETE_ACADEMIC_YEAR', 'AcademicYear', id, undefined, `Menghapus master tahun ajaran ${label} (tanpa data rombel)`);
    } catch (error) {
      throw new Error(friendlySupabaseError(error, `menghapus tahun ajaran ${label}`));
    }
  }
};
