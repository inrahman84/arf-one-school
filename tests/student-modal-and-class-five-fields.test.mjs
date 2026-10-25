import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Student Add/Edit opens accessible popup and School dropdown from authorized registered schools',()=>{
 const view=src('src/features/students/StudentsView.tsx');
 const form=src('src/features/students/StudentForm.tsx');
 assert.match(view,/role="dialog" aria-modal="true"/);
 assert.match(view,/max-h-\[94dvh\]/);
 assert.match(view,/document\.body\.style\.overflow='hidden'/);
 assert.match(view,/event\.key==='Escape'/);
 assert.match(view,/schools=\{visibleSchools\}/);
 assert.match(form,/Sekolah \*/);
 assert.match(form,/Pilih sekolah dari Daftar Sekolah/);
 assert.match(form,/schools\.map\(s=><option key=\{s\.school_id\} value=\{s\.school_id\}>/);
 assert.match(form,/selectedSchoolId/);
 assert.match(form,/c\.school_id===selectedSchoolId/);
 assert.match(form,/school_id:selectedSchoolId/);
 assert.match(form,/disabled=\{Boolean\(existing\)\}/);
});
test('List row offers Edit and Hapus, deletion requires archive confirmation and preserves records',()=>{
 const view=src('src/features/students/StudentsView.tsx');
 const service=src('src/services/studentsService.ts');
 const types=src('src/types/index.ts');
 assert.match(view,/setEditingStudent\(s\)/);
 assert.match(view,/Hapus\s*<\/button>/);
 assert.match(view,/Arsipkan Peserta Didik/);
 assert.match(view,/studentsService\.archiveStudent/);
 assert.match(service,/async archiveStudent\(schoolId:string,studentId:string\)/);
 assert.match(service,/archived_at:new Date\(\)\.toISOString\(\)/);
 assert.match(service,/filter\(row=>!row\.archived_at\)/);
 assert.match(service,/archivedIds\.has\(row\.student_id\)/);
 assert.match(types,/archived_at\?: string/);
 assert.doesNotMatch(service,/deleteDoc\(doc\(db,'schools',schoolId,'studentPrivate'/);
});
test('Excel import has prominent accessible colorful picker and filename',()=>{
 const view=src('src/features/students/StudentsView.tsx');
 assert.match(view,/id="student-dapodik-file" type="file"/);
 assert.match(view,/htmlFor="student-dapodik-file"/);
 assert.match(view,/bg-\[#073b2d\]/);
 assert.match(view,/FileSpreadsheet/);
 assert.match(view,/selectedImportName\|\|'Belum ada file dipilih'/);
});
test('Classroom modal has five core fields plus year and semester, teacher from active PTK',()=>{
 const view=src('src/features/enrollment/EnrollmentView.tsx');
 const app=src('src/App.tsx');
 const service=src('src/services/enrollmentService.ts');
 const modal=view.slice(view.indexOf('{/* Modal Add / Edit Class */}'),view.indexOf('{/* Delete Classroom Confirmation Modal */}'));
 for(const label of ['Sekolah *','Tahun Ajaran *','Semester *','Tingkat Kelas *','Nama Rombel *','Kapasitas Maksimal *','Wali Kelas'])
  assert.ok(modal.includes(label),'Missing class label: '+label);
 for(const removed of ['Siswa Laki-laki *','Siswa Perempuan *','Siswa Pindahan Masuk','Siswa Keluar / DO','Total Murid yang Dihitung'])
  assert.ok(!modal.includes(removed),'Obsolete class modal input: '+removed);
 assert.match(modal,/value=\{formData\.homeroom_staff_id\}/);
 assert.match(modal,/activeTeachers\.map\(person=>/);
 assert.match(view,/person\.school_id===formData\.school_id/);
 assert.match(view,/person\.staff_category==='Guru'/);
 assert.match(view,/person\.employment_status==='Aktif'/);
 assert.match(app,/staff=\{staff\}/);
 assert.match(service,/person\.employment_status!=='Aktif'/);
 assert.match(service,/person\.staff_category!=='Guru'/);
 assert.match(view,/male_students: draftCounts\.male/);
});
