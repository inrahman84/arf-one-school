import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('OAuth stays disabled until explicitly enabled by a deployment flag',()=>{
  const auth=read('src/services/authService.ts');
  const login=read('src/features/auth/LoginView.tsx');
  assert.match(auth,/VITE_GOOGLE_OAUTH_ENABLED\s*===\s*'true'/);
  assert.match(auth,/if\(!GOOGLE_OAUTH_ENABLED\)/);
  assert.match(login,/disabled=\{!GOOGLE_OAUTH_ENABLED\|\|busyNow\}/);
});
test('email registration uses Supabase Auth and defaults to school operator awaiting scope assignment',()=>{
  const auth=read('src/services/authService.ts');
  const login=read('src/features/auth/LoginView.tsx');
  assert.match(auth,/supabase\.auth\.signUp\(/);
  assert.match(login,/Daftar Email Pengguna/);
  assert.match(login,/Peran awal adalah Operator Sekolah/);
  assert.doesNotMatch(login,/Pendaftaran email tidak otomatis memberikan akses ke data sekolah/);
});
test('login slogan matches approved ARF wording',()=>{
  assert.match(read('src/features/auth/LoginView.tsx'),/One Foundation - One Standard - One Schools/);
});
