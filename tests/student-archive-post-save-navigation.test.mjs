import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('successful roster archival immediately opens same-school archive after refresh',()=>{
 const ui=read('src/features/students/StudentsView.tsx');
 const fn=ui.slice(ui.indexOf('const confirmArchive=async()=>{'),ui.indexOf('const year=activeAcademicYear'));
 assert.match(fn,/if\(!studentToArchive \|\| !canManagePrivate\)return;/);
 assert.match(fn,/const archivedSchoolId=studentToArchive\.school_id;/);
 assert.match(fn,/await studentsService\.archiveStudent\(archivedSchoolId,studentToArchive\.student_id\);/);
 assert.match(fn,/await onRefresh\(\);\s*\/\/[^\n]*\n[^\n]*\n\s*onManageArchive\(archivedSchoolId\);/);
 assert.ok(fn.indexOf('await onRefresh();')<fn.indexOf('onManageArchive(archivedSchoolId)'));
 assert.ok(fn.indexOf('onManageArchive(archivedSchoolId)')<fn.indexOf('}catch(err)'));
});

test('archive navigation, restore and permanent purge remain available and scoped',()=>{
 const sidebar=read('src/components/layout/Sidebar.tsx');
 const app=read('src/App.tsx');
 const view=read('src/features/students/StudentArchiveView.tsx');
 const sql=read('supabase/014_archived_student_purge_rpc.sql');
 assert.match(sidebar,/key: 'studentArchive'/);
 assert.match(sidebar,/label: 'Arsip Peserta Didik'/);
 assert.match(app,/activeTab === 'studentArchive'/);
 assert.match(view,/getAllArchived\(visibleSchools\.map\(s=>s\.school_id\)\)/);
 assert.match(view,/typedConfirmation!=='HAPUS PERMANEN'/);
 assert.match(view,/\{isSuperAdmin&&<button/);
 assert.match(sql,/m\.role='SUPER_ADMIN'/);
 assert.match(sql,/v_roster->>'archived_at'/);
});
