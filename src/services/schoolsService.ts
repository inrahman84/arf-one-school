import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc
} from '../lib/documentStore';
import { db, handleSupabaseError, OperationType } from '../lib/backend';
import { School } from '../types';
import { auditService } from './auditService';

export const schoolsService = {
  async getSchools(): Promise<School[]> {
    const path = 'schools';
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ school_id: d.id, ...d.data() })) as School[];
    } catch (error) {
      handleSupabaseError(error, OperationType.LIST, path);
    }
  },

  async getSchoolById(schoolId: string): Promise<School | null> {
    const path = `schools/${schoolId}`;
    try {
      const snap = await getDoc(doc(db, 'schools', schoolId));
      if (!snap.exists()) return null;
      return { school_id: snap.id, ...snap.data() } as School;
    } catch (error) {
      handleSupabaseError(error, OperationType.GET, path);
    }
  },

  async saveSchool(school: Omit<School, 'created_at' | 'updated_at'> & { created_at?: string }): Promise<void> {
    const path = `schools/${school.school_id}`;
    try {
      const now = new Date().toISOString();
      const payload: School = {
        ...school,
        created_at: school.created_at || now,
        updated_at: now
      };
      await setDoc(doc(db, 'schools', school.school_id), payload, { merge: true });
      await auditService.log('SAVE_SCHOOL', 'School', school.school_id, school.school_id, `Menyimpan data sekolah: ${school.school_name}`);
    } catch (error) {
      handleSupabaseError(error, OperationType.WRITE, path);
    }
  },

  async deleteSchool(schoolId: string): Promise<void> {
    const path = `schools/${schoolId}`;
    try {
      // Prevent accidental destruction of permanent asset histories, including archived drafts.
      // ARF-STD-AST-001 requires ledger retention even after loss or disposal.
      const assetRegister = await getDocs(collection(db,'schools',schoolId,'assets'));
      if(!assetRegister.empty) {
        throw new Error('Sekolah masih memiliki register inventaris. Data aset dan riwayat tidak boleh dihapus. Proses mutasi/arsip dan persetujuan terlebih dahulu.');
      }
      // Other school subcollections retain the pre-existing cleanup behavior.
      const subcollections = ['classes', 'staff', 'facilities'];
      for (const sub of subcollections) {
        try {
          const subSnap = await getDocs(collection(db, 'schools', schoolId, sub));
          if (!subSnap.empty) {
            const batchDeletes = subSnap.docs.map(d => deleteDoc(d.ref));
            await Promise.all(batchDeletes);
          }
        } catch (subErr) {
          console.warn(`Peringatan pembersihan subkoleksi ${sub} sekolah ${schoolId}:`, subErr);
        }
      }

      await deleteDoc(doc(db, 'schools', schoolId));
      await auditService.log('DELETE_SCHOOL', 'School', schoolId, schoolId, `Menghapus data sekolah: ${schoolId}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Sekolah masih memiliki register inventaris')) throw error;
      handleSupabaseError(error, OperationType.DELETE, path);
    }
  }
};
