import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc
} from '../lib/documentStore';
import { db, handleSupabaseError, OperationType } from '../lib/backend';
import { Facility } from '../types';
import { auditService } from './auditService';
import { imageStorageService } from './imageStorageService';

export const facilitiesService = {
  async getFacilitiesBySchool(schoolId: string): Promise<Facility[]> {
    const path = `schools/${schoolId}/facilities`;
    try {
      const snap = await getDocs(collection(db, 'schools', schoolId, 'facilities'));
      return Promise.all(snap.docs.map(async d => {
        const record={ facility_id:d.id,...d.data() } as Facility;
        return {...record, physical_image_url: (await imageStorageService.getImageUrl(record.physical_image_path)) || record.physical_image_url, damage_image_url: (await imageStorageService.getImageUrl(record.damage_image_path)) || record.damage_image_url } as Facility;
      }));
    } catch (error) {
      handleSupabaseError(error, OperationType.LIST, path);
    }
  },

  async getAllFacilitiesAcrossSchools(schoolIds: string[]): Promise<Facility[]> {
    const results: Facility[] = [];
    for (const sid of schoolIds) {
      try {
        const facs = await this.getFacilitiesBySchool(sid);
        results.push(...facs);
      } catch (e) {
        console.warn(`Could not load facilities for school ${sid}:`, e);
      }
    }
    return results;
  },

  async saveFacility(fac: Omit<Facility, 'created_at' | 'updated_at'> & { created_at?: string }): Promise<void> {
    const path = `schools/${fac.school_id}/facilities/${fac.facility_id}`;
    try {
      const now = new Date().toISOString();
      const payload: Facility = {
        ...fac,
        facility_area_m2: Number(fac.facility_area_m2) || 0,
        facility_capacity: Number(fac.facility_capacity) || 0,
        estimated_repair_cost: Number(fac.estimated_repair_cost) || 0,
        repair_required: Boolean(fac.repair_required),
        created_at: fac.created_at || now,
        updated_at: now
      };
      await setDoc(doc(db, 'schools', fac.school_id, 'facilities', fac.facility_id), payload, { merge: true });
      void auditService.log('SAVE_FACILITY', 'Facility', fac.facility_id, fac.school_id, `Prasarana: ${fac.facility_name} (${fac.facility_type})`).catch(error => console.warn('Audit fasilitas gagal:', error));
    } catch (error) {
      handleSupabaseError(error, OperationType.WRITE, path);
    }
  },

  async deleteFacility(schoolId: string, facilityId: string): Promise<void> {
    const path = `schools/${schoolId}/facilities/${facilityId}`;
    try {
      const facilityRef = doc(db, 'schools', schoolId, 'facilities', facilityId);
      const snap = await getDoc(facilityRef);
      const data = snap.exists() ? (snap.data() as Facility) : null;
      await deleteDoc(facilityRef);
      await imageStorageService.cleanupImages([data?.physical_image_path, data?.damage_image_path]);
      await auditService.log('DELETE_FACILITY', 'Facility', facilityId, schoolId, `Menghapus prasarana ${facilityId}`).catch(error => console.warn('Audit hapus fasilitas gagal:', error));
    } catch (error) {
      handleSupabaseError(error, OperationType.DELETE, path);
    }
  },

  calculateFacilityMetrics(facilities: Facility[]) {
    let totalArea = 0;
    let repairRequiredCount = 0;
    let totalEstimatedRepairCost = 0;

    const byCondition: Record<string, number> = {
      'Baik': 0,
      'Rusak Ringan': 0,
      'Rusak Sedang': 0,
      'Rusak Berat': 0
    };

    const byPriority: Record<string, number> = {
      'Kritis': 0,
      'Tinggi': 0,
      'Sedang': 0,
      'Rendah': 0
    };

    const byType: Record<string, number> = {};

    facilities.forEach(f => {
      totalArea += Number(f.facility_area_m2) || 0;

      const cond = f.facility_condition || 'Baik';
      byCondition[cond] = (byCondition[cond] || 0) + 1;

      if (f.repair_required) {
        repairRequiredCount += 1;
        totalEstimatedRepairCost += Number(f.estimated_repair_cost) || 0;
        if (f.repair_priority) {
          byPriority[f.repair_priority] = (byPriority[f.repair_priority] || 0) + 1;
        }
      }

      const type = f.facility_type || 'Lainnya';
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      totalFacilities: facilities.length,
      totalArea,
      repairRequiredCount,
      totalEstimatedRepairCost,
      goodConditionCount: byCondition['Baik'] || 0,
      damagedCount: (byCondition['Rusak Ringan'] || 0) + (byCondition['Rusak Sedang'] || 0) + (byCondition['Rusak Berat'] || 0),
      byCondition,
      byPriority,
      byType
    };
  }
};
