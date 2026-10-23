import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Student form includes detailed Dapodik personal and education fields',()=>{
 const fields=read('src/features/students/StudentForm.tsx');
 const options=read('src/lib/studentPrivateForm.ts');
 const types=read('src/types/index.ts');
 for(const label of ['Tempat Lahir','Tanggal Lahir','NIK','Alamat','RT','RW','Dusun','Kelurahan',
  'Kecamatan','Kode Pos','Jenis Tinggal','Alat Transportasi','Telepon','HP','Email','SKHUN',
  'Penerima KPS','No. KPS','Nomor Peserta Ujian Nasional','No Seri Ijazah',
  'No. Registrasi Akta Lahir','Nomor KKS','Sekolah Asal','Anak Ke-Berapa','Nomor KK',
  'Berat Badan (kg)','Tinggi Badan (cm)','Lingkar Kepala (cm)','Jumlah Saudara Kandung',
  'Jarak Rumah ke Sekolah (km)']){
  assert.ok(fields.includes(label)||options.includes(label), 'Missing label: '+label);
 }
 for(const key of ['StudentPrivateDetails','StudentFamilyMember','kip_flag: 0|1','latitude: number|null','longitude: number|null']){
  assert.ok(types.includes(key), 'Missing type: '+key);
 }
});

test('Parents, guardians, KPS KIP PIP and income are conditionally rendered',()=>{
 const ui=read('src/features/students/StudentForm.tsx');
 const logic=read('src/lib/studentPrivateForm.ts');
 for(const token of ["details.living_arrangement==='Bersama Orang Tua'",
  "family('father','Data Ayah')","family('mother','Data Ibu')","family('guardian','Data Wali')",
  "details.kps_recipient==='Ya'","details.kip_recipient==='Ya'","details.pip_eligible==='Ya'",
  "details.kip_recipient==='Ya'&&details.pip_received==='Ya'","Sudah Meninggal Dunia",
  "Penerima Bantuan PIP (Aktual)","Nama di KIP","Indikator Penerima KIP (otomatis 1/0)"]){
  assert.ok(ui.includes(token), 'Missing conditional: '+token);
 }
 assert.match(logic,/d\.kip_flag=d\.kip_recipient==='Ya'\?1:0/);
 assert.match(logic,/if\(d\.living_arrangement==='Bersama Orang Tua'\)/);
 assert.match(logic,/d\[key\]\.income=''/);
});

test('Special needs and age-limited head circumference selection are complete',()=>{
 const logic=read('src/lib/studentPrivateForm.ts');
 const ui=read('src/features/students/StudentForm.tsx');
 for(const phrase of ['Tuna Netra','Tuna Rungu','Tuna Grahita Ringan','Tuna Grahita Sedang',
   'Tuna Daksa Ringan','Tuna Daksa Sedang','Tuna Laras','Tuna Wicara','Tuna Ganda',
   'Hiperaktif','Cerdas Istimewa','Bakat Istimewa','Kesulitan Belajar','Narkoba',
   'Autis','Down Syndrome']){
  assert.ok(logic.includes(phrase), 'Missing special needs option: '+phrase);
 }
 assert.match(logic,/\['TPA','TK','SD'\]\.includes\(level\)/);
 assert.match(ui,/supportsHeadCircumference\(currentLevel\)/);
});

test('Coordinates come from selecting point on map, not from device geolocation',()=>{
 const ui=read('src/features/students/StudentForm.tsx');
 const map=read('src/features/students/HomeLocationPicker.tsx');
 assert.match(ui,/Pilih Titik Rumah pada Peta/);
 assert.match(ui,/onChoose=\{\(lat,lng\)=>setDetails/);
 assert.match(ui,/readOnly value=\{details\.latitude\?\?''\}/);
 assert.match(ui,/readOnly value=\{details\.longitude\?\?''\}/);
 assert.match(map,/m\.on\('click'/);
 assert.doesNotMatch(map,/navigator\.geolocation/);
});

test('Child financial and family details are separate from public roster and dashboard',()=>{
 const service=read('src/services/studentsService.ts');
 const rls=read('supabase/003_student_private_guard.sql');
 const ui=read('src/features/students/StudentForm.tsx');
 const list=read('src/features/students/StudentsView.tsx');
 assert.match(service,/schools',schoolId,'studentPrivate'/);
 assert.match(service,/schools',record\.school_id,'studentPrivate'/);
 assert.match(rls,/as restrictive/);
 assert.match(rls,/'SUPER_ADMIN','SCHOOL_PRINCIPAL','SCHOOL_OPERATOR'/);
 assert.match(ui,/canManagePrivate/);
 assert.match(list,/canManagePrivate=\{canManagePrivate\}/);
});

test('Dapodik import appears after Rombel and movement sections',()=>{
 const ui=read('src/features/students/StudentsView.tsx');
 const mapping=ui.indexOf('Daftar dan Pemetaan Rombel');
 const movement=ui.indexOf('Riwayat Mutasi Peserta Didik');
 const upload=ui.indexOf('Impor Daftar Peserta Didik (Dapodik)');
 assert.ok(mapping>=0&&movement>mapping&&upload>movement);
});
