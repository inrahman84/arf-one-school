import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Education level options contain TPA, KB, TK, SD, SMP, SMA, SMK in order',()=>{
  const types=src('src/types/index.ts');
  assert.match(types,/\['TPA', 'KB', 'TK', 'SD', 'SMP', 'SMA', 'SMK'\] as const/);
  for(const path of ['src/features/schools/SchoolsListView.tsx','src/features/dashboard/DashboardView.tsx']){
    assert.match(src(path),/EDUCATION_LEVELS\.map\(/);
  }
  assert.match(src('src/services/excelService.ts'),/Jenjang \(TPA\/KB\/TK\/SD\/SMP\/SMA\/SMK\)/);
});

test('Regional form labels and persistent card reordering',()=>{
  const view=src('src/features/administration/RegionManagementView.tsx');
  const svc=src('src/services/regionsService.ts');
  assert.match(view,/>Regional \*</);
  assert.match(view,/>Cakupan</);
  assert.match(view,/onDragStart=/);
  assert.match(view,/onDrop=/);
  assert.match(view,/moveCard\(/);
  assert.match(svc,/saveRegionOrder\(/);
  assert.match(svc,/sortOrder:index/);
  assert.match(svc,/sortRegions\(/);
});

test('Only one central year can be active and cannot be deleted',()=>{
  const svc=src('src/services/academicYearsService.ts');
  const ui=src('src/features/administration/AcademicYearManagementView.tsx');
  assert.match(svc,/ACTIVE_DOC_ID = '_active'/);
  assert.match(svc,/activateAcademicYear\(value: string\)/);
  assert.match(svc,/sedang aktif\. Aktifkan tahun lain/);
  assert.match(ui,/Aktifkan/);
  assert.match(ui,/Tahun Ajaran Aktif/);
});

test('Master year is default for new classroom, while registered historical periods remain selectable',()=>{
  const classes=src('src/features/enrollment/EnrollmentView.tsx');
  assert.match(classes,/savedAcademicYears\.includes\(activeAcademicYear\)/);
  assert.match(classes,/formData\.academic_year/);
  assert.match(classes,/>Semester \*<\/label>/);
  assert.match(classes,/savedAcademicYears\.includes\(formData\.academic_year\)/);
  assert.match(src('src/features/dashboard/DashboardView.tsx'),/masterActiveYear/);
  assert.match(src('src/features/reports/ReportsView.tsx'),/masterActiveYear/);
  assert.match(src('src/features/imports/DataImportView.tsx'),/current\.activeYear/);
  assert.match(src('src/services/excelService.ts'),/Tahun Ajaran harus sesuai periode aktif/);
});
