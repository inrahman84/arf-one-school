import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc
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
      const existing=await getDoc(doc(db,'schools',as.school_id,'assets',as.asset_id));
      const prior=existing.exists()?existing.data() as Asset:null;
      if (prior?.registration_status === 'APPROVED') {
        throw new Error('Aset yang sudah disahkan tidak boleh diubah melalui formulir biasa. Ajukan koreksi berotorisasi.');
      }
      // PAID/DIC are never issued on a browser save. Preserve historical identifiers,
      // and refuse to create or overwrite identities through the draft-edit endpoint.
      if (prior?.permanent_asset_id && as.permanent_asset_id!==prior.permanent_asset_id) {
        throw new Error('Permanent Asset ID bersifat tetap dan tidak dapat diubah.');
      }
      if (prior?.display_inventory_code && as.display_inventory_code!==prior.display_inventory_code) {
        throw new Error('Display Inventory Code tidak dapat diubah melalui form.');
      }
      if (!prior && (as.permanent_asset_id || as.display_inventory_code)) {
        throw new Error('Nomor PAID/DIC hanya bisa diterbitkan setelah approval oleh layanan server.');
      }
      if (prior?.origin_school_id && prior.origin_school_id !== (as.origin_school_id||as.school_id)) {
        throw new Error('School ID asal registrasi tidak dapat diubah.');
      }
      // Validate the responsible person against the live PTK register, not just
      // the previously loaded dropdown options.
      if (as.custodian_id) {
        const assignedStaff = await getDoc(doc(db,'schools',as.school_id,'staff',as.custodian_id));
        const person = assignedStaff.exists() ? assignedStaff.data() : null;
        if (!person || person.school_id !== as.school_id || person.employment_status !== 'Aktif') {
          throw new Error('Penanggung Jawab harus PTK aktif pada sekolah aset yang dipilih.');
        }
        if (as.custodian_name !== person.staff_name) {
          throw new Error('Nama Penanggung Jawab harus mengikuti nama pada master PTK.');
        }
      }
      const payload: Asset = {
        ...as,
        quantity: Number(as.quantity) || 1,
        acquisition_unit_value: Number(as.acquisition_unit_value) || 0,
        funding_year: as.funding_year ? Number(as.funding_year) : undefined,
        created_at: as.created_at || now,
        updated_at: now
      };
      await setDoc(doc(db, 'schools', as.school_id, 'assets', as.asset_id), payload, { merge: true });
      void auditService.log('SAVE_ASSET', 'Asset', as.asset_id, as.school_id, `Aset: ${as.asset_name} (${as.quantity} ${as.unit_measure})`).catch(error => console.warn('Audit aset gagal:', error));
    } catch (error) {
      handleSupabaseError(error, OperationType.WRITE, path);
    }
  },

  /** Historical inventory entries remain in the ledger; deletion is a soft archival action.
   * Disposal/asset write-off is a separate legal approval process. */
  async deleteAsset(schoolId: string, assetId: string): Promise<void> {
    const path=`schools/${schoolId}/assets/${assetId}`;
    try {
      const assetRef=doc(db,'schools',schoolId,'assets',assetId);
      const snap=await getDoc(assetRef);
      if(!snap.exists()) throw new Error('Aset tidak ditemukan.');
      const item=snap.data() as Asset;
      if(item.registration_status==='APPROVED'){
        throw new Error('Aset disahkan tidak dapat diarsipkan tanpa prosedur persetujuan aset.');
      }
      await updateDoc(assetRef,{
        archived_at:new Date().toISOString(), updated_at:new Date().toISOString()
      });
      void auditService.log('ARCHIVE_ASSET','Asset',assetId,schoolId,'Aset draft diarsipkan; riwayat dan foto tetap disimpan.').catch(console.warn);
    }catch(error){
      if(error instanceof Error && /tidak ditemukan|tidak dapat diarsipkan/.test(error.message))throw error;
      handleSupabaseError(error,OperationType.UPDATE,path);
    }
  },

  /** Archived drafts remain recoverable and do not reuse their record IDs. */
  async restoreArchivedDraft(schoolId:string,assetId:string):Promise<void>{
    const ref=doc(db,'schools',schoolId,'assets',assetId);
    const snap=await getDoc(ref);
    if(!snap.exists())throw new Error('Aset tidak ditemukan.');
    const item=snap.data() as Asset;
    if(item.registration_status==='APPROVED')throw new Error('Aset disahkan memerlukan otorisasi khusus.');
    await updateDoc(ref,{archived_at:'',updated_at:new Date().toISOString()});
    void auditService.log('RESTORE_ASSET','Asset',assetId,schoolId,'Draft aset dikembalikan dari arsip').catch(console.warn);
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

    assets.filter(a=>!a.archived_at).forEach(a => {
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
