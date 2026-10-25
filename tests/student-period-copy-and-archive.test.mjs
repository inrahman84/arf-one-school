import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import * as period from '../src/lib/studentPeriodCopy.ts';
import * as activity from '../src/lib/studentActivity.ts';
if(!globalThis.crypto) globalThis.crypto=webcrypto;
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const makeStudent=({id='PD-1',school='S1',year='2025/2026',semester='Genap',nisn='',nipd='',lineage=''}={})=>({
 student_id:id,school_id:school,academic_year:year,semester,gender:'L',
 full_name:'Siswa Uji',nisn,nipd,lineage_id:lineage,source_rombel:'Kelas 1',snapshot_date:'2026-01-10'
});
test('Only previous school years or current Ganjil to Genap can be copied',()=>{
 const api=period;
 assert.equal(api.isValidPeriodCopy('2025/2026','Genap','2026/2027','Ganjil'),true);
 assert.equal(api.isValidPeriodCopy('2025/2026','Ganjil','2026/2027','Genap'),true);
 assert.equal(api.isValidPeriodCopy('2026/2027','Ganjil','2026/2027','Genap'),true);
 assert.equal(api.isValidPeriodCopy('2026/2027','Genap','2026/2027','Genap'),false);
 assert.equal(api.isValidPeriodCopy('2026/2027','Genap','2026/2027','Ganjil'),false);
 assert.equal(api.isValidPeriodCopy('2026/2027','Ganjil','2025/2026','Genap'),false);
});
test('Copied IDs are stable per pupil and target period, never source ID reuse',async()=>{
 const api=period;
 const p=makeStudent();
 const same=await api.copiedStudentId(p,'2026/2027','Genap');
 assert.equal(same,await api.copiedStudentId(p,'2026/2027','Genap'));
 assert.notEqual(same,await api.copiedStudentId(p,'2026/2027','Ganjil'));
 assert.notEqual(same,p.student_id);
 const known=await api.copiedStudentId(makeStudent({nisn:'1234567890'}),'2026/2027','Genap');
 assert.match(known,/^PD-[0-9a-f]{32}-2026-2027-Genap$/);
});
test('Only matching school, year, semester and class may be assigned',()=>{
 const api=period;
 const classes=[{class_id:'CLS-OK',school_id:'S1',academic_year:'2026/2027',semester:'Genap',class_name:'Kelas 2 A'}];
 assert.equal(api.targetClassForCopy(classes,'CLS-OK','S1','2026/2027','Genap').class_name,'Kelas 2 A');
 for(const [school,year,sem,id] of [['OTHER','2026/2027','Genap','CLS-OK'],
   ['S1','2025/2026','Genap','CLS-OK'],['S1','2026/2027','Ganjil','CLS-OK'],
   ['S1','2026/2027','Genap','CLS-MISSING']]){
   assert.throws(()=>api.targetClassForCopy(classes,id,school,year,sem),/Rombel tujuan tidak sesuai/);
 }
});
test('Existing destination matches are recognized by NISN, NIPD or lineage',()=>{
 const api=period;
 const base=makeStudent({year:'2026/2027',semester:'Genap',nisn:'1234567890'});
 assert.equal(api.samePersonForPeriod(base,{...base,student_id:'PD-other'}),true);
 assert.equal(api.samePersonForPeriod(base,{...base,student_id:'PD-other',school_id:'S2'}),false);
 assert.equal(api.samePersonForPeriod(base,{...base,student_id:'PD-other',academic_year:'2025/2026'}),false);
 const noNisn=makeStudent({year:'2026/2027',semester:'Genap',lineage:'stable'});
 assert.equal(api.samePersonForPeriod(noNisn,{...noNisn,student_id:'PD-other'}),true);
});
test('Archived pupils cannot block class deletion and their old class is preserved',()=>{
 const en=file('src/services/enrollmentService.ts');
 const students=file('src/services/studentsService.ts');
 const active=activity;
 assert.match(en,/!d\.data\(\)\.archived_at && d\.data\(\)\.class_id===classId/);
 assert.match(students,/archived_class_id:record\.class_id/);
 assert.match(students,/class_id:'',class_name:'',grade_level:''/);
 const source=[{...makeStudent(),archived_at:'2026-10-25T05:00:00Z'},makeStudent({id:'PD-2'})];
 assert.equal(active.currentRoster(source,[]).length,1);
 assert.match(file('supabase/005_unlink_archived_students.sql'),/archived_class_id/);
});
test('Copy operation requires active master year, validates source and inserts without overwriting destination',()=>{
 const service=file('src/services/studentsService.ts');
 const UI=file('src/features/students/StudentPeriodCopy.tsx');
 assert.match(service,/master\.activeYear!==targetYear/);
 assert.match(service,/isValidPeriodCopy\(sourceYear,sourceSemester,targetYear,targetSemester\)/);
 assert.match(service,/currentRoster\(selected,movements\)/);
 assert.match(service,/targetClassForCopy\(classList,assignments\[student\.student_id\]/);
 assert.match(service,/samePersonForPeriod\(t,record\)/);
 assert.match(service,/\.insert\(batch\)/);
 assert.doesNotMatch(service.slice(service.indexOf('async copyToActivePeriod'),service.indexOf('async mapRombel')),/\.upsert\(batch/);
 assert.match(UI,/Pilih seluruh murid sumber/);
 assert.match(UI,/Tujuan Khusus \(opsional\)/);
 assert.match(UI,/Salin juga data administrasi rinci/);
 assert.match(UI,/targetSemester/);
});
test('Class form accepts explicitly chosen registered academic year and semester',()=>{
 const UI=file('src/features/enrollment/EnrollmentView.tsx');
 assert.match(UI,/>Tahun Ajaran \*<\/label>/);
 assert.match(UI,/>Semester \*<\/label>/);
 assert.match(UI,/savedAcademicYears\.includes\(formData\.academic_year\)/);
 assert.match(UI,/formData\.semester!==editingClass\.semester/);
 assert.match(UI,/CLS-\$\{crypto\.randomUUID\(\)\}/);
});
