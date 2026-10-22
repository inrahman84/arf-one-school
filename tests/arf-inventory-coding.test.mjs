import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Master kategori mengikuti 12 kode ARF dan funding 7 kode',()=>{
  const src=read('src/lib/arfAssetCoding.ts');
  for(const code of ['ELK','FUR','EDU','LAB','OLA','MUS','PER','KES','OPS','SAR','BGN','KND'])assert.match(src,new RegExp("code:'"+code+"'"));
  for(const code of ['BK','BR','DAK','BDA','ARF','OTH','LGC'])assert.match(src,new RegExp("code:'"+code+"'"));
  assert.doesNotMatch(src,/code:'MIX'/);
});
test('Tambah/Edit Aset hides PAID, DIC and registration status; Nomor Aset is editable',()=>{
  const src=read('src/features/assets/AssetsView.tsx');
  const types=read('src/types/index.ts');
  assert.doesNotMatch(src,/>Permanent Asset ID \(PAID\)<\/label>/);
  assert.doesNotMatch(src,/>Display Inventory Code \(DIC\)<\/label>/);
  assert.doesNotMatch(src,/>Status Registrasi<\/label>/);
  assert.match(src,/>Nomor Aset<\/label>/);
  assert.match(src,/value=\{formData\.asset_number\}/);
  assert.match(src,/asset_number: ast\.asset_number \|\| ''/);
  assert.match(src,/asset_number: formData\.asset_number\.trim\(\)/);
  assert.match(src,/\(a\.asset_number \|\| ''\)\.toLowerCase\(\)\.includes\(q\)/);
  assert.match(src,/'Nomor Aset': a\.asset_number/);
  assert.match(types,/asset_number\?: string/);
  assert.match(src,/registration_status: 'DRAFT'/);
  assert.match(src,/crypto\.randomUUID\(\)/);
});

test('Form includes ARF register minimum inputs',()=>{
  const src=read('src/features/assets/AssetsView.tsx');
  for(const field of ['category_code','funding_code','funding_details','acquisition_date','acquisition_year_unknown',
    'serial_number','registration_type','bundle_components','room_id','custodian_id',
    'ownership_status','ownership_evidence','external_asset_code','invoice_ref','handover_ref','document_urls_text']){
    assert.match(src,new RegExp(field));
  }
  assert.match(src,/validateDraftAssetInput/);
  assert.match(src,/parseAssetDocumentUrls/);
});
test('Approved asset cannot be rewritten using ordinary save endpoint',()=>{
  const src=read('src/services/assetsService.ts');
  assert.match(src,/prior\?\.registration_status === 'APPROVED'/);
  assert.match(src,/prior\?\.permanent_asset_id/);
  assert.match(src,/prior\?\.display_inventory_code/);
  assert.match(src,/prior\?\.origin_school_id/);
});
test('History is preserved when a draft is archived or a school is removed',()=>{
  const src=read('src/services/assetsService.ts');
  assert.match(src,/archived_at:new Date\(\)\.toISOString\(\)/);
  assert.match(src,/restoreArchivedDraft/);
  assert.doesNotMatch(src,/await deleteDoc\(assetRef\)/);
  const schools=read('src/services/schoolsService.ts');
  assert.match(schools,/const assetRegister = await getDocs/);
  assert.match(schools,/Sekolah masih memiliki register inventaris/);
});
test('Funding references are HTTPS and individual asset is one PAID',()=>{
  const src=read('src/lib/arfAssetCoding.ts');
  assert.match(src,/protocol!=='https:'/);
  assert.match(src,/data\.quantity!==1/);
  assert.match(src,/Nomor seri sudah terdaftar/);
});
