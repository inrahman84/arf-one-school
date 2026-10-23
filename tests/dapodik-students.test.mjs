import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Dapodik parser handles two-row headers and ignores protected child fields',()=>{
 const text=src('src/lib/dapodikStudents.ts');
 assert.match(text,/index=grid\.findIndex/);
 assert.match(text,/Rombel Saat Ini/);
 assert.match(text,/grid\.slice\(index\+2\)/);
 assert.match(text,/gender:gender as 'L'\|'P'/);
 assert.match(text,/makeStudentId/);
 assert.doesNotMatch(text,/row\[(?:7|29|35|41|60)\]/); // NIK / parental / family
});
test('roster persistence is school-scoped and uses RLS-enabled Supabase documents',()=>{
 const text=src('src/services/studentsService.ts');
 assert.match(text,/schools\/'\+schoolId\+'\/students/);
 assert.match(text,/upsert\(batch,\{onConflict:'path'\}\)/);
 assert.match(text,/collection\(db,'schools',schoolId,'studentMovements'\)/);
});
test('Sumber Daya student management supports mapping and verified movement events',()=>{
 const nav=src('src/components/layout/Sidebar.tsx'), view=src('src/features/students/StudentsView.tsx');
 assert.match(nav,/key: 'students'/);
 assert.match(view,/Pemetaan Rombel/);
 assert.match(view,/handleAddDocumentLink|applyMapping/);
 assert.match(view,/TRANSFER_IN/);
 assert.match(view,/TRANSFER_OUT/);
 assert.match(view,/DROPOUT/);
 assert.match(view,/parent|orang tua|NIK/i);
});
test('classrooms derive gender counts and mutation figures from student records',()=>{
 const view=src('src/features/enrollment/EnrollmentView.tsx');
 assert.match(view,/const calcCounts=/);
 assert.match(view,/draftCounts\.male/);
 assert.match(view,/draftCounts\.female/);
 assert.match(view,/draftCounts\.incoming/);
 assert.match(view,/readOnly=\{draftCounts.active\}/);
 assert.match(view,/schoolsWithRoster/);
});
test('executive teacher planning prioritizes mapped real rosters with source quality flags',()=>{
 const view=src('src/features/dashboard/StaffingInsights.tsx'),
 math=src('src/lib/staffingAnalytics.ts');
 assert.match(view,/Analisis Kebutuhan Guru per Sekolah/);
 assert.match(view,/Belum Terpetakan/);
 assert.match(math,/Math\.max\(classrooms,Math\.ceil\(studentsTotal\/threshold\)\)/);
 assert.match(math,/staff_category==='Guru'/);
 assert.match(math,/source:hasRoster\?'DAPODIK'/);
});
