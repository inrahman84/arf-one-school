import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('One School rejects missing, mismatched or legacy shared Supabase project config',()=>{
 const src=read('src/lib/supabase.ts');
 assert.match(src,/VITE_ARF_ONE_SCHOOL_SUPABASE_REF/);
 assert.match(src,/VITE_SUPABASE_PUBLISHABLE_KEY/);
 assert.match(src,/VITE_SUPABASE_URL/);
 assert.match(src,/projectRef !== expectedProjectRef/);
 assert.match(src,/projectRef === disallowedSharedProject/);
 assert.match(src,/ovfygxeqgpjezdhbidmo/);
 assert.doesNotMatch(src,/VITE_SUPABASE_URL \|\| 'https:\/\/ovfygxeqgpjezdhbidmo/);
 const example=read('.env.example');
 assert.doesNotMatch(example,/VITE_SUPABASE_URL=https:\/\/ovfygxeqgpjezdhbidmo/);
});

test('Creation sends Supabase invitation email by default or a recovery email for password mode',()=>{
 const server=read('supabase/functions/arf-manage-users/index.ts');
 const ui=read('src/features/administration/UserManagementView.tsx');
 assert.match(server,/admin\.auth\.admin\.inviteUserByEmail\(email/);
 assert.match(server,/admin\.auth\.resetPasswordForEmail\(email/);
 assert.match(server,/deliveryMode==='PASSWORD'/);
 assert.match(server,/redirectTo:SITE_URL\+'\/\?setup_password=1'/);
 assert.match(server,/emailSent:true/);
 assert.match(server,/ref!==EXPECTED_PROJECT_REF\|\|ref===SHARED_PROJECT_REF/);
 assert.match(ui,/setDeliveryMode\('INVITE'\)/);
 assert.match(ui,/Simpan Pengguna Baru/);
 assert.doesNotMatch(ui,/Simpan &amp; Otorisasi Pengguna/);
});
test('Pending invitations can be revoked only by authenticated active Super Admin',()=>{
 const server=read('supabase/functions/arf-manage-users/index.ts');
 const ui=read('src/features/administration/UserManagementView.tsx');
 const service=read('src/services/authService.ts');
 assert.match(server,/actor\.role!=='SUPER_ADMIN'/);
 assert.match(server,/action==='cancelInvitation'/);
 assert.match(server,/row\.content\?\.status!=='PENDING'/);
 assert.match(server,/status:'REVOKED'/);
 assert.match(server,/\.eq\('content->>status','PENDING'\)/);
 assert.match(ui,/cancelPendingInvitation/);
 assert.match(ui,/inv\.status==='PENDING'/);
 assert.match(ui,/Batalkan Undangan/);
 assert.match(service,/async cancelInvitation\(invitationId:string\)/);
});
test('Invitation email can set personal password after authenticated email token',()=>{
 const setup=read('src/features/auth/SetPasswordView.tsx');
 const app=read('src/App.tsx');
 assert.match(app,/setup_password'\) === '1'/);
 assert.match(app,/<SetPasswordView\s*\/>/);
 assert.match(setup,/supabase\.auth\.updateUser\(\{password\}\)/);
 assert.match(setup,/supabase\.auth\.getUser\(\)/);
 assert.match(setup,/Simpan Sandi dan Lanjutkan/);
});
test('legacy cross-app auto permission from invited documents is disabled in dedicated Supabase migration',()=>{
 const migration=read('supabase/009_disable_legacy_pre_authorization.sql');
 assert.match(migration,/DROP TRIGGER IF EXISTS on_arf_school_invite_insert/);
 assert.match(migration,/DROP FUNCTION IF EXISTS arf_internal\.activate_arf_school_invitation/);
});
