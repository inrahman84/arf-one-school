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
      // Bersihkan seluruh subkoleksi terkait: rombel, PTK, aset, dan prasarana
      const subcollections = ['classes', 'staff', 'assets', 'facilities'];
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
      handleSupabaseError(error, OperationType.DELETE, path);
    }
  }
};
