import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const packageJSON=JSON.parse(read('package.json'));
test('branding and vercel setup',()=>{
 assert.equal(packageJSON.name,'arf-one-school');
 assert.equal(JSON.parse(read('vercel.json')).outputDirectory,'dist');
 assert.match(read('index.html'),/<title>ARF One School<\/title>/);
});
test('uses Supabase instead of Firebase SDK',()=>{
 assert.ok(packageJSON.dependencies['@supabase/supabase-js']);
 assert.ok(!packageJSON.dependencies.firebase);
 assert.match(read('src/lib/supabase.ts'),/createClient/);
 assert.doesNotMatch(read('src/context/AuthContext.tsx'),/onAuthStateChanged/);
});
test('row-level security, private storage and auth schema',()=>{
 const sql=read('supabase/001_arf_one_school.sql');
 for(const x of ['enable row level security','create policy arf_doc_read','create policy arf_doc_insert',"'arf-one-school','arf-one-school',false",'arf_doc_path_identity'])assert.ok(sql.includes(x),x);
});
test('asset and facilities photo paths and temporary signed URLs',()=>{
 assert.match(read('src/services/imageStorageService.ts'),/createSignedUrl/);
 assert.match(read('src/services/assetsService.ts'),/getImageUrl\(record\.image_path\)/);
 assert.match(read('src/services/facilitiesService.ts'),/getImageUrl\(record\.damage_image_path\)/);
});
test('no one-click unverified administrator login remains',()=>{
 assert.doesNotMatch(read('src/features/auth/LoginView.tsx'),/handleAdminDirectLogin|Masuk sebagai Super Admin Resmi/);
 assert.match(read('src/services/authService.ts'),/signInWithOtp/);
});
