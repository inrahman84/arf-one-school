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
    'ownership_status','ownership_evidence','external_asset_code','invoice_ref','handover_ref','document_links']){
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

test('Penanggung Jawab chooses only active PTK associated with the asset school',()=>{
  const app=read('src/App.tsx');
  const view=read('src/features/assets/AssetsView.tsx');
  const service=read('src/services/assetsService.ts');
  const schema=read('src/types/index.ts');
  assert.match(app,/<AssetsView[\s\S]*staff=\{staff\}/);
  assert.match(view,/person\.school_id === formData\.school_id/);
  assert.match(view,/person\.employment_status === 'Aktif'/);
  assert.match(view,/person\.staff_id === formData\.custodian_id/);
  assert.match(view,/value=\{formData\.custodian_id\}/);
  assert.match(view,/>Penanggung Jawab<\/label>/);
  assert.match(view,/custodian_id: custodian\?\.staff_id \|\| ''/);
  assert.match(view,/custodian_name: custodian\?\.staff_name \|\| ''/);
  assert.match(view,/custodian_id: ''/);
  assert.match(schema,/custodian_name\?: string/);
  assert.match(service,/getDoc\(doc\(db,'schools',as\.school_id,'staff',as\.custodian_id\)\)/);
  assert.match(service,/person\.employment_status !== 'Aktif'/);
  assert.match(service,/as\.custodian_name !== person\.staff_name/);
});

test('Asset form removes room, ownership status, lifecycle and informational notices',()=>{
  const src=read('src/features/assets/AssetsView.tsx');
  const form=src.slice(src.indexOf('{/* Modal Add / Edit Asset */}'),src.indexOf('{/* Delete Asset Confirmation Modal */}'));
  for(const removed of ['ID Ruang / Lokasi Aset','ID Penanggung Jawab (Custodian)',
    'Status Penguasaan / Kepemilikan Legal','Status Siklus Hidup',
    'Panduan ARF-STD-AST-001 masih berstatus DRAF.',
    'Referensi dokumen saja; tautan harus diberikan izin akses sesuai peran.']){
    assert.ok(!form.includes(removed), 'Removed text still in form: ' + removed);
  }
  assert.match(form,/Penanggung Jawab &amp; Dokumen/);
  assert.match(form,/>Bukti Kepemilikan Legal<\/label>/);
});

test('Evidence links can be added and removed individually and are saved as document_urls',()=>{
  const src=read('src/features/assets/AssetsView.tsx');
  assert.match(src,/document_links: \[\] as string\[\]/);
  assert.match(src,/document_links: \[\.\.\.\(ast\.document_urls \|\| \[\]\)\]/);
  assert.match(src,/const handleAddDocumentLink =/);
  assert.match(src,/const handleRemoveDocumentLink =/);
  assert.match(src,/prev\.document_links\.filter\(item => item !== url\)/);
  assert.match(src,/document_links\.join\('\\n'\)/);
  assert.match(src,/const \{document_links: _documentLinks, \.\.\.draftFields\} = formData/);
  assert.match(src,/^\s*document_urls,\s*$/m);
  assert.match(src,/Masukkan satu URL HTTPS untuk setiap tautan/);
  assert.match(src,/Tautan bukti dokumen ini sudah ada/);
  assert.match(src,/>Tambah Link<\/button>|Tamb[a-zA-Z ]*Link/);
  assert.match(src,/Hapus Link/);
  assert.match(src,/Klik Tambah Link/);
  assert.doesNotMatch(src,/document_urls_text/);
});
