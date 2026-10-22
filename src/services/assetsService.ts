import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc
} from '../lib/documentStore';
import { db, handleSupabaseError, OperationType } from '../lib/backend';
import { Asset } from '../types';
import { auditService } from './auditService';
import { imageStorageService } from './imageStorageService';

export const assetsService = {
  async getAssetsBySchool(schoolId: string): Promise<Asset[]> {
    const path = `schools/${schoolId}/assets`;
    try {
      const snap = await getDocs(collection(db, 'schools', schoolId, 'assets'));
      return Promise.all(snap.docs.map(async d => {
        const record={ asset_id:d.id,...d.data() } as Asset;
        return {...record, image_url: (await imageStorageService.getImageUrl(record.image_path)) || record.image_url } as Asset;
      }));
    } catch (error) {
      handleSupabaseError(error, OperationType.LIST, path);
    }
  },

  async getAllAssetsAcrossSchools(schoolIds: string[]): Promise<Asset[]> {
    const results: Asset[] = [];
    for (const sid of schoolIds) {
      try {
        const assets = await this.getAssetsBySchool(sid);
        results.push(...assets);
      } catch (e) {
        console.warn(`Could not load assets for school ${sid}:`, e);
      }
    }
    return results;
  },

  async saveAsset(as: Omit<Asset, 'created_at' | 'updated_at'> & { created_at?: string }): Promise<void> {
    const path = `schools/${as.school_id}/assets/${as.asset_id}`;
    try {
      const now = new Date().toISOString();
      const payload: Asset = {
        ...as,
        quantity: Number(as.quantity) || 1,
        acquisition_unit_value: Number(as.acquisition_unit_value) || 0,
        funding_year: as.funding_year ? Number(as.funding_year) : new Date().getFullYear(),
        created_at: as.created_at || now,
        updated_at: now
      };
      await setDoc(doc(db, 'schools', as.school_id, 'assets', as.asset_id), payload, { merge: true });
      void auditService.log('SAVE_ASSET', 'Asset', as.asset_id, as.school_id, `Aset: ${as.asset_name} (${as.quantity} ${as.unit_measure})`).catch(error => console.warn('Audit aset gagal:', error));
    } catch (error) {
      handleSupabaseError(error, OperationType.WRITE, path);
    }
  },

  async deleteAsset(schoolId: string, assetId: string): Promise<void> {
    const path = `schools/${schoolId}/assets/${assetId}`;
    try {
      const assetRef = doc(db, 'schools', schoolId, 'assets', assetId);
      // Read the image path before deleting its Supabase metadata.
      const snap = await getDoc(assetRef);
      const photoPath = snap.exists() ? (snap.data() as Asset).image_path : undefined;
      await deleteDoc(assetRef);
      await imageStorageService.cleanupImages([photoPath]);
      await auditService.log('DELETE_ASSET', 'Asset', assetId, schoolId, `Menghapus aset ${assetId}`).catch(error => console.warn('Audit hapus aset gagal:', error));
    } catch (error) {
      handleSupabaseError(error, OperationType.DELETE, path);
    }
  },

  calculateAssetMetrics(assets: Asset[]) {
    let totalUnits = 0;
    let totalAcquisitionValue = 0;
    let damagedUnits = 0;
    let goodUnits = 0;

    const byCondition: Record<string, number> = {
      'Baik': 0,
      'Rusak Ringan': 0,
      'Rusak Berat': 0
    };

    const byFundingSource: Record<string, { units: number; totalValue: number }> = {
      'ARF': { units: 0, totalValue: 0 },
      'BOS': { units: 0, totalValue: 0 },
      'BOP': { units: 0, totalValue: 0 },
      'Donasi': { units: 0, totalValue: 0 },
      'Lainnya': { units: 0, totalValue: 0 }
    };

    const byCategory: Record<string, number> = {};

    assets.forEach(a => {
      const qty = Number(a.quantity) || 0;
      const val = (Number(a.acquisition_unit_value) || 0) * qty;

      totalUnits += qty;
      totalAcquisitionValue += val;

      if (a.asset_condition === 'Baik') {
        goodUnits += qty;
        byCondition['Baik'] = (byCondition['Baik'] || 0) + qty;
      } else {
        damagedUnits += qty;
        if (a.asset_condition === 'Rusak Berat') {
          byCondition['Rusak Berat'] = (byCondition['Rusak Berat'] || 0) + qty;
        } else {
          byCondition['Rusak Ringan'] = (byCondition['Rusak Ringan'] || 0) + qty;
        }
      }

      const src = a.funding_source || 'Lainnya';
      if (!byFundingSource[src]) {
        byFundingSource[src] = { units: 0, totalValue: 0 };
      }
      byFundingSource[src].units += qty;
      byFundingSource[src].totalValue += val;

      const cat = a.asset_category || 'Lainnya';
      byCategory[cat] = (byCategory[cat] || 0) + qty;
    });

    const damagedPercentage = totalUnits > 0 ? (damagedUnits / totalUnits) * 100 : 0;

    return {
      totalAssetItems: assets.length,
      totalUnits,
      totalAcquisitionValue,
      damagedUnits,
      goodUnits,
      damagedPercentage,
      byCondition,
      byFundingSource,
      byCategory
    };
  }
};
