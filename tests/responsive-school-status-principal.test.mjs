import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('responsive app has independent phone/tablet drawer and desktop sidebar',()=>{
  const app=read('src/App.tsx'), side=read('src/components/layout/Sidebar.tsx'), header=read('src/components/layout/Header.tsx'),css=read('src/index.css');
  assert.match(app,/mobileNavOpen/);
  assert.match(app,/setMobileNavOpen\(false\)/);
  assert.match(app,/onMenuToggle=\{\(\) => setMobileNavOpen\(true\)\}/);
  assert.match(side,/lg:sticky/);
  assert.match(side,/lg:hidden/);
  assert.match(side,/onCloseMobile/);
  assert.match(header,/Buka menu navigasi/);
  assert.match(css,/arf-responsive-main/);
  assert.match(css,/\.overflow-x-auto > table/);
});

test('school operational status list contains exactly three new choices',()=>{
  const types=read('src/types/index.ts');
  const schools=read('src/features/schools/SchoolsListView.tsx');
  assert.match(types,/Aktif Memiliki Izin Operasional/);
  assert.match(types,/Aktif Tidak Memiliki Izin Operasional/);
  assert.match(types,/Tidak Aktif/);
  assert.match(schools,/OPERATIONAL_STATUS_OPTIONS\.map\(/);
  assert.match(schools,/status lama — pilih yang baru/);
});

test('principal is assigned from active PTK linked to the selected school and saves both ID and name',()=>{
  const app=read('src/App.tsx'), schools=read('src/features/schools/SchoolsListView.tsx');
  assert.match(app,/staff=\{staff\}/);
  assert.match(schools,/person\.school_id === formData\.school_id/);
  assert.match(schools,/person\.employment_status === 'Aktif'/);
  assert.match(schools,/person\.staff_id === event\.target\.value/);
  assert.match(schools,/principal_staff_id: selectedPrincipal\?\.staff_id/);
  assert.match(schools,/principal_name: selectedPrincipal\?\.staff_name/);
  assert.match(schools,/Belum ada Guru\/Kepala Sekolah aktif/);
});
