import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('manual student form exposes grade and class from the same school year semester',()=>{
 const ui=source('src/features/students/StudentForm.tsx');
 assert.match(ui,/Tingkat Kelas \*/);
 assert.match(ui,/Nama Rombel \*/);
 assert.match(ui,/c\.school_id===schoolId&&c\.academic_year===academicYear&&c\.semester===semester/);
 assert.match(ui,/const matching=options\.filter\(c=>c\.grade_level===grade\)/);
 assert.match(ui,/onChange=\{e=>\{setGrade\(e\.target\.value\);setClassId\(''\)\}\}/);
 assert.match(ui,/class_id:chosen\.class_id/);
 assert.match(ui,/grade_level:chosen\.grade_level/);
 assert.match(ui,/class_name:chosen\.class_name/);
 assert.match(ui,/studentsService\.saveStudent/);
 assert.match(ui,/Boolean\(existing\)/);
});

test('Sumber Daya data siswa has add/edit form and reflects the master class',()=>{
 const students=source('src/features/students/StudentsView.tsx');
 assert.match(students,/Tambah Peserta Didik/);
 assert.match(students,/<StudentForm/);
 assert.match(students,/setEditingStudent\(s\)/);
 assert.match(students,/setShowStudentForm\(true\)/);
 assert.match(students,/classes=\{currentClasses\}/);
 assert.match(students,/await onRefresh\(\)/);
 assert.match(students,/Jumlah murid pada Rombel & Peserta Didik diperbarui otomatis/);
});

test('service verifies exact master class relation and protects against duplicate student records',()=>{
 const service=source('src/services/studentsService.ts');
 assert.match(service,/async saveStudent\(record:StudentRecord,isEditing:boolean=false\)/);
 assert.match(service,/record\.academic_year/);
 assert.match(service,/cls\.grade_level!==record\.grade_level/);
 assert.match(service,/cls\.class_name!==record\.class_name/);
 assert.match(service,/!isEditing && old\.exists\(\)/);
 assert.match(service,/NISN atau NIPD sudah digunakan/);
 assert.match(service,/grade_level:cls\.grade_level,class_name:cls\.class_name/);
});

test('rombel counts come from saved class_id and refresh; protected classes cannot be deleted',()=>{
 const enrollment=source('src/features/enrollment/EnrollmentView.tsx');
 const service=source('src/services/enrollmentService.ts');
 assert.match(enrollment,/const calcCounts=/);
 assert.match(enrollment,/rosterCounts\(roster,cls\.class_id,cls\.academic_year,cls\.semester\)/);
 assert.match(enrollment,/const male = calcCounts\(cls\)\.male/);
 assert.match(enrollment,/const female = calcCounts\(cls\)\.female/);
 assert.match(enrollment,/readOnly=\{draftCounts\.active\}/);
 assert.match(service,/linked=assigned\.docs\.filter\(d=>d\.data\(\)\.class_id===classId\)/);
 assert.match(service,/peserta didik terhubung/);
});

test('Dapodik import reuses master class grade, avoids generating invented class associations',()=>{
 const ui=source('src/features/students/StudentsView.tsx');
 assert.match(ui,/matches\.length===1/);
 assert.match(ui,/grade_level:matched\?\.grade_level/);
 assert.match(ui,/class_name:matched\?\.class_name/);
 assert.match(ui,/class_id:matched\?\.class_id\|\|''/);
});
