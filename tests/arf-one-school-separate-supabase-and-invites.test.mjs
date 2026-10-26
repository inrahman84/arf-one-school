import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('One School rejects missing, mismatched or legacy shared Supabase project config',()=>{
 const src=read('src/lib/supabase.ts');
 assert.match(src,/expectedProjectRef = 'tyonogxpoyzzzuxiwpwc'/);
 assert.match(src,/VITE_SUPABASE_PUBLISHABLE_KEY/);
 assert.match(src,/VITE_SUPABASE_URL/);
 assert.match(src,/projectRef !== expectedProjectRef/);
 assert.match(src,/projectRef === disallowedSharedProject/);
 assert.match(src,/ovfygxeqgpjezdhbidmo/);
 assert.match(read('.env.example'),/VITE_SUPABASE_URL=https:\/\/tyonogxpoyzzzuxiwpwc.supabase.co/);
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
 assert.match(server,/redirectTo:redirectSite\+'\/\?setup_password=1'/);
 assert.match(server,/originAllowed\(origin\)\?origin:SITE_URL/);
 assert.match(server,/arf-one-school-\[a-z0-9-\]\+-iswahyudhir-6587/);
 assert.match(server,/emailSent:true/);
 assert.match(server,/ref!==EXPECTED_PROJECT_REF\|\|ref===SHARED_PROJECT_REF/);
 assert.match(server,/EXPECTED_PROJECT_REF='tyonogxpoyzzzuxiwpwc'/);
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

test('first Super Admin bootstrap is restricted to an existing email-verified dedicated Auth account',()=>{
 const sql=read('supabase/bootstrap_verified_one_school_admin.sql');
 assert.match(sql,/email_confirmed_at IS NOT NULL/);
 assert.match(sql,/lower\(email\)='iswahyudhi\.nr@gmail\.com'/);
 assert.match(sql,/IF v_admins <> 0 THEN/);
 assert.match(sql,/IF v_user_id IS NULL THEN/);
 assert.match(sql,/on conflict \(user_id\) DO UPDATE/i);
 assert.doesNotMatch(sql,/insert into auth\.users/i);
 assert.doesNotMatch(sql,/update auth\.users/i);
});
