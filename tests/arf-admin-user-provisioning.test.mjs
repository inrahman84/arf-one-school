import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('self-registered users receive active operator role without any school/region entitlements',()=>{
 const sql=read('supabase/006_arf_user_provisioning.sql');
 assert.match(sql,/CREATE OR REPLACE FUNCTION arf_internal\.add_arf_school_member/);
 assert.match(sql,/'SCHOOL_OPERATOR',ARRAY\[\]::text\[\],ARRAY\[\]::text\[\],'ACTIVE'/);
 assert.match(sql,/ON CONFLICT \(user_id\) DO NOTHING/);
 assert.doesNotMatch(sql,/new\.raw_user_meta_data->>'role'/);
});

test('creating users provisions actual Supabase Auth plus ARF membership instead of invitations',()=>{
 const fn=read('supabase/functions/arf-manage-users/index.ts');
 const ui=read('src/features/administration/UserManagementView.tsx');
 const svc=read('src/services/authService.ts');
 assert.match(fn,/admin\.auth\.admin\.createUser\(/);
 assert.match(fn,/email_confirm:true/);
 assert.match(fn,/\.from\('arf_school_members'\)\.upsert/);
 assert.match(fn,/if\(!newlyCreated && current\.data&&current\.data\.status==='ACTIVE'\)/);
 assert.match(ui,/await authService\.createAuthorizedUser/);
 assert.doesNotMatch(ui,/await authService\.inviteUser\(/);
 assert.match(svc,/supabase\.functions\.invoke\('arf-manage-users'/);
 assert.match(ui,/Buat Sandi Pengguna/);
 assert.match(ui,/createPasswordConfirm/);
});

test('Admin Edge Function authenticates live JWT and active ARF superadmin membership',()=>{
 const fn=read('supabase/functions/arf-manage-users/index.ts');
 assert.match(fn,/admin\.auth\.getUser\(token\)/);
 assert.match(fn,/actor\.role!=='SUPER_ADMIN'/);
 assert.match(fn,/actor\.status!=='ACTIVE'/);
 assert.match(fn,/actor\.deleted_at/);
 assert.match(fn,/const lastAdmin=target\.role==='SUPER_ADMIN'/);
 assert.match(fn,/if\(isSelf\)/);
 assert.match(fn,/String\(body\.password\)/);
 assert.match(fn,/\.updateUserById\(userId,\{password:/);
 assert.doesNotMatch(read('src/services/authService.ts'),/SUPABASE_SERVICE_ROLE_KEY/);
});

test('reset password is protected and only submitted from Edit, never persisted in user profile',()=>{
 const fn=read('supabase/functions/arf-manage-users/index.ts');
 const ui=read('src/features/administration/UserManagementView.tsx');
 assert.match(fn,/action==='setPassword'/);
 assert.match(fn,/validPassword\(body\.password\)/);
 assert.match(fn,/password:String\(body\.password\)/);
 assert.match(ui,/createOrResetPassword\(selectedUser\.uid,editPassword\)/);
 assert.match(ui,/Buat \/ Reset Sandi Pengguna/);
 assert.match(ui,/editPasswordConfirm/);
 assert.doesNotMatch(fn,/from\('arf_school_members'\)\.update\(\{password:/);
});

test('remove user only revokes ARF school membership, preserving other apps auth identities',()=>{
 const fn=read('supabase/functions/arf-manage-users/index.ts');
 const ui=read('src/features/administration/UserManagementView.tsx');
 const sql=read('supabase/006_arf_user_provisioning.sql');
 assert.match(fn,/action==='remove'/);
 assert.match(fn,/status:'INACTIVE',deleted_at:new Date\(\)\.toISOString\(\)/);
 assert.match(fn,/assigned_schools:\[\],assigned_regions:\[\]/);
 assert.match(fn,/if\(isSelf\)throw failure\('Tidak dapat menghapus/);
 assert.doesNotMatch(fn,/admin\.auth\.admin\.deleteUser/);
 assert.match(sql,/ADD COLUMN IF NOT EXISTS deleted_at timestamptz/);
 assert.match(ui,/handleRemoveUser/);
 assert.match(ui,/Hapus Pengguna dari ARF One School/);
});

test('legacy approval notice is removed from login and account list filters deleted members',()=>{
 const login=read('src/features/auth/LoginView.tsx');
 const svc=read('src/services/authService.ts');
 assert.doesNotMatch(login,/Pendaftaran email tidak otomatis memberikan akses ke data sekolah/);
 assert.match(login,/Peran awal: Operator Sekolah/);
 assert.match(svc,/filter\(x=>!x\.deleted_at\)/);
});
