import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc
} from '../lib/documentStore';
import { db, handleSupabaseError, OperationType } from '../lib/backend';
import { Region } from '../types';
import { auditService } from './auditService';

export const regionsService = {
  async getRegions(): Promise<Region[]> {
    const path = 'regions';
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Region[];
    } catch (error) {
      handleSupabaseError(error, OperationType.LIST, path);
    }
  },

  async saveRegion(region: Omit<Region, 'createdAt' | 'updatedAt'> & { createdAt?: string }): Promise<void> {
    const path = `regions/${region.id}`;
    try {
      const now = new Date().toISOString();
      const payload: Region = {
        ...region,
        createdAt: region.createdAt || now,
        updatedAt: now
      };
      await setDoc(doc(db, 'regions', region.id), payload, { merge: true });
      await auditService.log('SAVE_REGION', 'Region', region.id, undefined, `Menyimpan wilayah: ${region.name}`);
    } catch (error) {
      handleSupabaseError(error, OperationType.WRITE, path);
    }
  },

  async updateRegionStatus(regionId: string, status: 'active' | 'inactive'): Promise<void> {
    const path = `regions/${regionId}`;
    try {
      await updateDoc(doc(db, 'regions', regionId), {
        status,
        updatedAt: new Date().toISOString()
      });
      await auditService.log('UPDATE_REGION_STATUS', 'Region', regionId, undefined, `Status wilayah diubah ke ${status}`);
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, path);
    }
  },

  async deleteRegion(regionId: string): Promise<void> {
    const path = `regions/${regionId}`;
    try {
      // Periksa langsung ke database, bukan hanya state UI, agar tidak ada sekolah yatim.
      const snapshot = await getDocs(collection(db, 'schools'));
      const linkedSchools = snapshot.docs.filter(s => s.data().regional_id === regionId);
      if (linkedSchools.length > 0) {
        throw new Error(`Wilayah masih digunakan oleh ${linkedSchools.length} sekolah. Pindahkan sekolah tersebut sebelum menghapus wilayah.`);
      }
      await deleteDoc(doc(db, 'regions', regionId));
      await auditService.log('DELETE_REGION', 'Region', regionId, undefined, `Menghapus wilayah ${regionId}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Wilayah masih digunakan')) throw error;
      handleSupabaseError(error, OperationType.DELETE, path);
    }
  }
};
