import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');

test('Asset input removes the 5 requested labels and helper explanations', () => {
  const src = read('src/features/assets/AssetsView.tsx');
  const form = src.slice(src.indexOf('{/* Modal Add / Edit Asset */}'),src.indexOf('{/* Delete Asset Confirmation Modal */}'));
  for (const removed of [
    'Nomor aset untuk pencatatan internal. Tidak menggantikan kode inventaris permanen.',
    'School ID Saat Ini',
    'School ID Asal / Registrasi',
    'Diperiksa terhadap nomor seri aset lain di sekolah yang sama.',
    'Kode sumber dana harus didukung bukti perolehan.',
    'Pendanaan gabungan tidak disediakan pada form ini'
  ]) assert.ok(!form.includes(removed),'Unexpected form text: '+removed);
  assert.match(form,/School ID<\/label>/);
  assert.match(form,/readOnly value=\{formData\.school_id\}/);
});

test('KND conditionally displays TNBK / Nomor Polisi instead of Serial Number', () => {
  const src=read('src/features/assets/AssetsView.tsx');
  const start=src.indexOf("{formData.category_code === 'KND' ? (");
  const end=src.indexOf('Spesifikasi Singkat</label>',start);
  assert.ok(start>0 && end>start);
  const conditional=src.slice(start,end);
  assert.match(conditional,/TNBK \/ Nomor Polisi/);
  assert.match(conditional,/placeholder="KH 1234 AB"/);
  assert.match(conditional,/value=\{formData\.tnbk\}/);
  assert.match(conditional,/\) : \(\s*<div>/);
  assert.match(conditional,/Serial Number \/ Nomor Seri/);
  assert.doesNotMatch(conditional,/Diperiksa terhadap nomor seri/);
});

test('TNBK persists separately, including edit, list search, export and normalized input', () => {
  const src=read('src/features/assets/AssetsView.tsx');
  const types=read('src/types/index.ts');
  const lib=read('src/lib/arfAssetCoding.ts');
  assert.match(types,/tnbk\?: string/);
  assert.match(src,/tnbk: ast\.tnbk \|\| ''/);
  assert.match(src,/tnbk: formData\.category_code === 'KND' \? normalizeTnbk\(formData\.tnbk\)/);
  assert.match(src,/'TNBK \/ Nomor Polisi': a\.tnbk \|\| '-'/);
  assert.match(src,/\(a\.tnbk \|\| ''\)\.toLowerCase\(\)\.includes\(q\)/);
  assert.match(src,/TNBK: \{ast\.tnbk\}/);
  assert.match(lib,/export function normalizeTnbk/);
  assert.match(lib,/value\.trim\(\)\.toUpperCase\(\)\.replace/);
  assert.match(lib,/data\.category_code==='KND'/);
  assert.match(lib,/TNBK \/ Nomor Polisi sudah terdaftar/);
  assert.match(src,/serial_number: formData\.category_code==='KND' \? undefined/);
});

test('Model/Tipe and Spesifikasi Singkat labels are updated', () => {
  const src=read('src/features/assets/AssetsView.tsx');
  const form=src.slice(src.indexOf('{/* Modal Add / Edit Asset */}'),src.indexOf('{/* Delete Asset Confirmation Modal */}'));
  assert.match(form,/Model \/ Tipe<\/label>/);
  assert.match(form,/Spesifikasi Singkat<\/label>/);
  assert.doesNotMatch(form,/Model \/ Tipe Barang/);
  assert.doesNotMatch(form,/Merk \/ Spesifikasi Singkat/);
});
