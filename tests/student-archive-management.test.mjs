import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('Data Peserta Didik and Rombel both link to the archive and use same canonical store',()=>{
 const sidebar=read('src/components/layout/Sidebar.tsx');
 const app=read('src/App.tsx');
 const data=read('src/features/students/StudentsView.tsx');
 const enrollment=read('src/features/enrollment/EnrollmentView.tsx');
 assert.match(sidebar,/key: 'studentArchive'/);
 assert.match(sidebar,/label: 'Arsip Peserta Didik'/);
 assert.match(app,/<StudentArchiveView/);
 assert.match(app,/onManageArchive=/);
 assert.match(app,/onManageStudentArchive=/);
 assert.match(enrollment,/Arsip Peserta Didik/);
 assert.match(data,/Buka Arsip Peserta Didik/);
 assert.match(data,/<Archive size=\{12\}\/> Arsipkan/);
 assert.match(data,/studentsService\.archiveStudent/);
});
test('archive view includes school, year and search filters plus explicit restore and confirmation-gated delete',()=>{
 const ui=read('src/features/students/StudentArchiveView.tsx');
 assert.match(ui,/studentsService\.getAllArchived/);
 assert.match(ui,/Seluruh Sekolah/);
 assert.match(ui,/Seluruh Tahun Ajaran/);
 assert.match(ui,/Cari arsip peserta didik/);
 assert.match(ui,/Pulihkan/);
 assert.match(ui,/Hapus Permanen/);
 assert.match(ui,/typedConfirmation!=='HAPUS PERMANEN'/);
 assert.match(ui,/isSuperAdmin&&/);
});
test('service archives remain invisible to active dashboards while restorable archived roster can be fetched',()=>{
 const svc=read('src/services/studentsService.ts');
 assert.match(svc,/.filter\(row=>!row.archived_at\)/);
 assert.match(svc,/getArchivedBySchool/);
 assert.match(svc,/.filter\(row=>Boolean\(row.archived_at\)\)/);
 assert.match(svc,/async restoreArchivedStudent/);
 assert.match(svc,/cls\.academic_year===current\.academic_year&&cls\.semester===current\.semester/);
 assert.match(svc,/await setDoc\(ref,\{\.\.\.rest/);
 assert.match(svc,/supabase\.rpc\('arf_purge_archived_student'/);
});
test('permanent deletion requires verified super admin membership, archived record, and atomically cleans private and movement references',()=>{
 const sql=read('supabase/014_archived_student_purge_rpc.sql');
 assert.match(sql,/security definer set search_path = ''/i);
 assert.match(sql,/v_actor := \(select auth\.uid\(\)\)/);
 assert.match(sql,/m\.role='SUPER_ADMIN'/);
 assert.match(sql,/m\.status='ACTIVE'/);
 assert.match(sql,/m\.deleted_at is null/);
 assert.match(sql,/archived_at/);
 assert.match(sql,/for update;/);
 assert.match(sql,/collection_path='schools\/'\|\|p_school_id\|\|'\/studentPrivate'/);
 assert.match(sql,/collection_path='schools\/'\|\|p_school_id\|\|'\/studentMovements'/);
 assert.match(sql,/d\.content->>'student_id'=p_student_id/);
 assert.match(sql,/PURGE_ARCHIVED_STUDENT/);
 assert.match(sql,/revoke all on function.*from public,anon/);
 assert.match(sql,/grant execute on function.*to authenticated/);
 assert.doesNotMatch(sql,/delete from auth\.users/i);
 assert.doesNotMatch(sql,/\bTRUNCATE\b/i);
});
