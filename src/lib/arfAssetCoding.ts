/** ARF-STD-AST-001 v1.0 — draft awaiting formal approval (21 Oct 2026).
 * This module defines approved *input vocabulary*, NOT authority to issue PAID/DIC.
 * PAID and DIC must be issued atomically by a protected server-side approval workflow.
 */
export const ARF_ASSET_CATEGORIES = [
  {code:'ELK',label:'Elektronik & TIK'},
  {code:'FUR',label:'Meubelair'},
  {code:'EDU',label:'Media pembelajaran'},
  {code:'LAB',label:'Peralatan laboratorium'},
  {code:'OLA',label:'Peralatan olahraga'},
  {code:'MUS',label:'Seni dan musik'},
  {code:'PER',label:'Koleksi dan aset perpustakaan'},
  {code:'KES',label:'Kesehatan dan UKS'},
  {code:'OPS',label:'Peralatan operasional'},
  {code:'SAR',label:'Peralatan fasilitas'},
  {code:'BGN',label:'Bangunan dan konstruksi (register khusus)'},
  {code:'KND',label:'Kendaraan'}
] as const;

export const ARF_FUNDING_CODES = [
  {code:'BK',label:'BOS Kinerja'},
  {code:'BR',label:'BOS Reguler'},
  {code:'DAK',label:'Dana Alokasi Khusus'},
  {code:'BDA',label:'BOSDA / bantuan operasional daerah'},
  {code:'ARF',label:'Pendanaan ARF'},
  {code:'OTH',label:'Hibah, donasi, atau sumber lain'},
  {code:'LGC',label:'Aset lama — sumber belum terverifikasi (migrasi)'}
] as const;

export const ARF_LIFECYCLE_STATUSES = [
  {code:'ACTIVE',label:'Aktif / digunakan'},
  {code:'STORED',label:'Disimpan'},
  {code:'MAINTENANCE',label:'Dalam perbaikan'},
  {code:'RETURNED',label:'Dikembalikan (retur)'},
  {code:'LOST',label:'Hilang'},
  {code:'HEAVILY_DAMAGED',label:'Rusak berat'},
  {code:'DISPOSED',label:'Dihapus secara legal (butuh persetujuan)'}
] as const;

/** Documentation requires a single item to receive one PAID. For inseparable bundles,
 * one register entry can list component descriptions separately. */
export type AssetRegistrationType = 'INDIVIDUAL'|'BUNDLE';
export type AssetRegistrationStatus = 'DRAFT'|'VERIFIED'|'APPROVED';

export function categoryLabel(code?:string):string {
  return ARF_ASSET_CATEGORIES.find(item=>item.code===code)?.label || '';
}
export function fundingLabel(code?:string):string {
  return ARF_FUNDING_CODES.find(item=>item.code===code)?.label || '';
}
export function isValidArfCategory(code?:string):boolean {
  return ARF_ASSET_CATEGORIES.some(item=>item.code===code);
}
export function isValidArfFunding(code?:string):boolean {
  return ARF_FUNDING_CODES.some(item=>item.code===code);
}
export function parseAssetDocumentUrls(value:string):string[] {
  const urls=value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(urls.some(u=>{try { return new URL(u).protocol!=='https:'; }catch {return true;}})) {
    throw new Error('Tautan bukti dokumen harus URL HTTPS yang valid (satu URL setiap baris).');
  }
  return [...new Set(urls)];
}
export function validateDraftAssetInput(data:{
  asset_name:string;school_id:string;category_code:string;funding_code:string;
  acquisition_date?:string; acquisition_year?:number|null; acquisition_year_unknown?:boolean;
  quantity:number; registration_type?:string; bundle_components?:string;
  acquisition_unit_value:number; serial_number?:string; document_urls?:string[];
  funding_details?:string;ownership_status?:string; ownership_evidence?:string; 
  asset_id?:string;
}, others:{asset_id:string;school_id:string;asset_serial_number?:string;serial_number?:string;invoice_ref?:string}[]):string|null{
  if(!data.school_id || !data.asset_name.trim())return 'Sekolah dan Nama Barang wajib diisi.';
  if(!isValidArfCategory(data.category_code))return 'Pilih kategori dari master kode inventaris ARF.';
  if(!isValidArfFunding(data.funding_code))return 'Pilih kode sumber dana dari master ARF.';
  if(data.funding_code==='LGC' && !data.funding_details?.trim())return 'LGC memerlukan alasan sumber dana belum terverifikasi.';
  if(data.funding_code==='OTH' && !data.funding_details?.trim())return 'Sumber OTH memerlukan informasi pemberi atau dasar bantuan.';
  if(data.acquisition_year_unknown!==true){
    if(!data.acquisition_date) return 'Tanggal perolehan faktual wajib diisi, atau tandai Tahun Perolehan Tidak Diketahui untuk aset lama.';
    const year=Number(data.acquisition_date.slice(0,4));
    if(!Number.isInteger(year)||year<1900||year>2100)return 'Tanggal perolehan tidak valid.';
    if(data.acquisition_year!==year)return 'Tahun perolehan harus sesuai tanggal pada bukti perolehan.';
  }
  if(!Number.isFinite(data.acquisition_unit_value)||data.acquisition_unit_value<0)return 'Harga perolehan tidak valid.';
  if(!Number.isInteger(data.quantity)||data.quantity<1)return 'Jumlah aset tidak valid.';
  if(data.quantity!==1)return 'Setiap aset individual atau bundel tidak terpisahkan memiliki satu record (quantity = 1).';
  if(data.registration_type==='BUNDLE' && !data.bundle_components?.trim())return 'Aset bundel wajib mencantumkan rincian komponennya.';
  const serial=data.serial_number?.trim().toLowerCase();
  if(serial && others.some(a=>a.asset_id!==data.asset_id && a.school_id===data.school_id &&
      (a.serial_number||a.asset_serial_number||'').trim().toLowerCase()===serial))
    return 'Nomor seri sudah terdaftar di sekolah ini. Periksa kemungkinan aset ganda.';
  if(data.document_urls?.some(u=>!u.startsWith('https://')))return 'Dokumen bukti hanya boleh menggunakan HTTPS.';
  return null;
}
