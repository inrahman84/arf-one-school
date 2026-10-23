import React,{useEffect,useState} from 'react';
import {ClassroomEnrollment,School,Semester,StudentRecord,StudentPrivateDetails,StudentFamilyMember} from '../../types';
import {makeStudentId} from '../../lib/dapodikStudents';
import {studentsService} from '../../services/studentsService';
import {HomeLocationPicker} from './HomeLocationPicker';
import {
 RELIGIONS,LIVING_OPTIONS,TRANSPORT_OPTIONS,EDUCATION_OPTIONS,JOB_OPTIONS,PIP_REASONS,
 SPECIAL_NEEDS,YES_NO,blankPrivate,blankFamily,sanitizeDetails,validateDetails,supportsHeadCircumference
} from '../../lib/studentPrivateForm';

interface Props{
 schoolId:string;schoolName:string;educationLevel:string;academicYear:string;semester:Semester;
 schools:School[];classes:ClassroomEnrollment[];existing:StudentRecord|null;canManagePrivate:boolean;
 onSaved:(savedSchoolId:string)=>Promise<void>|void;onCancel:()=>void;
}
type StringField=Exclude<keyof StudentPrivateDetails,
 'father'|'mother'|'guardian'|'latitude'|'longitude'|'kip_flag'>;
type Field={key:StringField;label:string;type?:string;placeholder?:string;wide?:boolean};
const identityFields:Field[]=[
 {key:'birth_place',label:'Tempat Lahir'}, {key:'birth_date',label:'Tanggal Lahir',type:'date'},
 {key:'nik',label:'NIK',placeholder:'16 digit angka'},
 {key:'religion',label:'Agama'}, {key:'address',label:'Alamat',wide:true},
 {key:'rt',label:'RT'},{key:'rw',label:'RW'},{key:'hamlet',label:'Dusun'},
 {key:'urban_village',label:'Kelurahan'},{key:'district',label:'Kecamatan'},
 {key:'postal_code',label:'Kode Pos'},
 {key:'living_arrangement',label:'Jenis Tinggal'},{key:'transport',label:'Alat Transportasi'},
 {key:'phone',label:'Telepon',type:'tel'}, {key:'mobile',label:'HP',type:'tel'},
 {key:'email',label:'Email',type:'email'}, {key:'skhun',label:'SKHUN'},
];
const educationFields:Field[]=[
 {key:'national_exam_number',label:'Nomor Peserta Ujian Nasional'},
 {key:'diploma_serial',label:'No Seri Ijazah'},
 {key:'birth_certificate_number',label:'No. Registrasi Akta Lahir'},
 {key:'previous_school',label:'Sekolah Asal'},
 {key:'birth_order',label:'Anak Ke-Berapa',type:'number'},
 {key:'family_card_number',label:'Nomor KK',placeholder:'16 digit angka'}
];
const healthFields:Field[]=[
 {key:'weight_kg',label:'Berat Badan (kg)',type:'number'},
 {key:'height_cm',label:'Tinggi Badan (cm)',type:'number'},
 {key:'head_circumference_cm',label:'Lingkar Kepala (cm)',type:'number'},
 {key:'siblings_count',label:'Jumlah Saudara Kandung',type:'number'},
 {key:'distance_km',label:'Jarak Rumah ke Sekolah (km)',type:'number'}
];
const FAMILY_LABELS:{key:keyof Pick<StudentPrivateDetails,'father'|'mother'|'guardian'>;title:string}[]=[
 {key:'father',title:'Data Ayah'}, {key:'mother',title:'Data Ibu'}, {key:'guardian',title:'Data Wali'}
];

export const StudentForm:React.FC<Props>=({
 schoolId,schoolName,educationLevel,academicYear,semester,schools,classes,existing,canManagePrivate,onSaved,onCancel
})=>{
 const [selectedSchoolId,setSelectedSchoolId]=useState(existing?.school_id||schoolId);
 const selectedSchool=schools.find(s=>s.school_id===selectedSchoolId);
 const currentLevel=selectedSchool?.education_level||educationLevel;
 const options=classes.filter(c=>c.school_id===selectedSchoolId&&c.academic_year===academicYear&&c.semester===semester);
 const [name,setName]=useState(existing?.full_name||'');
 const [gender,setGender]=useState<'L'|'P'>(existing?.gender||'L');
 const [nisn,setNisn]=useState(existing?.nisn||'');
 const [nipd,setNipd]=useState(existing?.nipd||'');
 const [grade,setGrade]=useState(options.find(c=>c.class_id===existing?.class_id)?.grade_level||existing?.grade_level||'');
 const [classId,setClassId]=useState(existing?.class_id||'');
 const [details,setDetails]=useState<StudentPrivateDetails>(()=>blankPrivate(existing?.student_id||'',schoolId));
 const [detailsLoading,setDetailsLoading]=useState(false);
 const [submitting,setSubmitting]=useState(false);
 const [pendingId,setPendingId]=useState<string|null>(null);
 const [error,setError]=useState('');
 const [showMap,setShowMap]=useState(false);
 const [consented,setConsented]=useState(false);
 useEffect(()=>{
   let alive=true;
   setSelectedSchoolId(existing?.school_id||schoolId);
   setName(existing?.full_name||'');setGender(existing?.gender||'L');
   setNisn(existing?.nisn||'');setNipd(existing?.nipd||'');
   setGrade(options.find(c=>c.class_id===existing?.class_id)?.grade_level||existing?.grade_level||'');
   setClassId(existing?.class_id||'');setError('');setPendingId(null);setConsented(false);
   setDetails(blankPrivate(existing?.student_id||'',schoolId));
   if(canManagePrivate&&existing?.student_id){
     setDetailsLoading(true);
     studentsService.getPrivateDetails(schoolId,existing.student_id)
       .then(info=>{if(alive&&info)setDetails({...blankPrivate(existing.student_id,schoolId),...info,
         father:{...blankFamily(),...info.father},mother:{...blankFamily(),...info.mother},
         guardian:{...blankFamily(),...info.guardian}})})
       .catch(()=>{if(alive)setError('Data rinci tidak dapat dimuat. Jangan menimpa data sebelum hak akses diperiksa.')})
       .finally(()=>{if(alive)setDetailsLoading(false)});
   }else setDetailsLoading(false);
   return ()=>{alive=false};
 },[existing?.student_id,schoolId,academicYear,semester,canManagePrivate]);
 const levels=[...new Set(options.map(c=>c.grade_level))].sort((a,b)=>a.localeCompare(b,'id',{numeric:true}));
 const matching=options.filter(c=>c.grade_level===grade);
 const chosen=matching.find(c=>c.class_id===classId);
 const input='block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-xs disabled:bg-gray-100 disabled:text-gray-500';
 const update=(key:StringField,value:string)=>setDetails(prev=>({...prev,[key]:value}));
 const updateFamily=(key:'father'|'mother'|'guardian',field:keyof StudentFamilyMember,value:string)=>
   setDetails(prev=>{
     const person={...prev[key],[field]:value};
     if(field==='occupation'){
       if(value==='Sudah Meninggal Dunia')person.income='';
       if(value!=='Lainnya')person.occupation_other='';
     }
     return {...prev,[key]:person};
   });
 const select=(key:StringField,label:string,choices:readonly string[],disabled=false,extra?:()=>void)=>
  <label key={key} className="text-xs font-semibold text-gray-700">{label}
   <select className={input+' mt-1'} disabled={disabled} value={String(details[key]??'')}
     onChange={e=>{update(key,e.target.value);extra?.()}}>
    <option value="">Pilih {label.toLowerCase()}</option>
    {choices.map(option=><option key={option} value={option}>{option}</option>)}
   </select>
  </label>;
 const field=(item:Field,disabled=false)=><label key={item.key}
   className={'text-xs font-semibold text-gray-700 '+(item.wide?'sm:col-span-2':'')}>
   {item.label}
   <input className={input+' mt-1'} type={item.type||'text'}
     min={item.type==='number'?'0':undefined} step={item.type==='number'?'any':undefined}
     inputMode={['nik','family_card_number'].includes(item.key)?'numeric':undefined}
     maxLength={['nik','family_card_number'].includes(item.key)?16:undefined}
     disabled={disabled}
     placeholder={item.placeholder} value={String(details[item.key]??'')}
     onChange={e=>update(item.key,e.target.value)}/>
  </label>;
 const family=(key:'father'|'mother'|'guardian',title:string)=>{
  const person=details[key];
  return <fieldset key={key} className="sm:col-span-2 space-y-3 rounded-xl border border-gray-200 bg-[#f6f3ec] p-3 sm:p-4">
    <legend className="px-2 text-sm font-bold text-[#073b2d]">{title}</legend>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
     <label className="text-xs font-semibold">Nama
       <input className={input+' mt-1'} value={person.name} onChange={e=>updateFamily(key,'name',e.target.value)}/>
     </label>
     <label className="text-xs font-semibold">Tahun Lahir
       <input className={input+' mt-1'} value={person.birth_year} maxLength={4}
         inputMode="numeric" onChange={e=>updateFamily(key,'birth_year',e.target.value.replace(/\D/g,''))}/>
     </label>
     <label className="text-xs font-semibold">Jenjang Pendidikan
       <select className={input+' mt-1'} value={person.education} onChange={e=>updateFamily(key,'education',e.target.value)}>
         <option value="">Pilih pendidikan</option>{EDUCATION_OPTIONS.map(v=><option key={v} value={v}>{v}</option>)}
       </select>
     </label>
     <label className="text-xs font-semibold">Pekerjaan
       <select className={input+' mt-1'} value={person.occupation} onChange={e=>updateFamily(key,'occupation',e.target.value)}>
         <option value="">Pilih pekerjaan</option>{JOB_OPTIONS.map(v=><option key={v} value={v}>{v}</option>)}
       </select>
     </label>
     {person.occupation==='Lainnya'&&<label className="text-xs font-semibold">Pekerjaan Lainnya *
       <input className={input+' mt-1'} required value={person.occupation_other}
         onChange={e=>updateFamily(key,'occupation_other',e.target.value)}/>
     </label>}
     <label className="text-xs font-semibold">Penghasilan
       <input className={input+' mt-1'} inputMode="numeric" value={person.occupation==='Sudah Meninggal Dunia'?'':person.income}
         disabled={person.occupation==='Sudah Meninggal Dunia'}
         placeholder={person.occupation==='Sudah Meninggal Dunia'?'Tidak berlaku':'Penghasilan per bulan'}
         onChange={e=>updateFamily(key,'income',e.target.value)}/>
     </label>
     <label className="text-xs font-semibold">NIK
       <input className={input+' mt-1'} inputMode="numeric" maxLength={16} value={person.nik}
         onChange={e=>updateFamily(key,'nik',e.target.value.replace(/\D/g,''))}/>
     </label>
    </div>
   </fieldset>;
 };
 const save=async(e:React.FormEvent)=>{
   e.preventDefault();setError('');
   if(!name.trim()||!selectedSchoolId||!schools.some(s=>s.school_id===selectedSchoolId)||!academicYear||!grade||!chosen){
     setError('Lengkapi Nama, Tingkat Kelas, dan Nama Rombel.');return;
   }
   if(nisn.trim()&&!/^\d{10}$/.test(nisn.trim())){
     setError('NISN harus 10 digit angka atau dikosongkan bila belum tersedia.');return;
   }
   if(existing?.nisn&&existing.nisn!==nisn.trim()){
     setError('Perubahan NISN harus melalui koreksi identitas oleh administrator.');return;
   }
   if(canManagePrivate){
     if(!consented){setError('Konfirmasi kewenangan pengolahan data pribadi sebelum menyimpan.');return}
     const issue=validateDetails(sanitizeDetails(details),currentLevel);
     if(issue){setError(issue);return;}
   }
   setSubmitting(true);
   try{
     const now=new Date().toISOString();
     const base={full_name:name.trim(),nisn:nisn.trim(),nipd:nipd.trim(),
       gender,source_rombel:existing?.source_rombel||chosen.class_name};
     const student_id=pendingId||existing?.student_id||(
       nisn.trim()||nipd.trim() ?
         (await makeStudentId(selectedSchoolId,base))+'-'+academicYear.replace('/','-')+'-'+semester :
         'PD-M-'+crypto.randomUUID()
     );
     await studentsService.saveStudent({
       ...(existing||{}),...base,student_id,school_id:selectedSchoolId,class_id:chosen.class_id,
       grade_level:chosen.grade_level,grade_hint:chosen.grade_level,class_name:chosen.class_name,
       academic_year:academicYear,semester,
       snapshot_date:existing?.snapshot_date||now.slice(0,10),
       imported_at:existing?.imported_at||now,updated_at:now
     },Boolean(existing||pendingId));
     setPendingId(student_id);
     if(canManagePrivate){
       await studentsService.savePrivateDetails(sanitizeDetails({
         ...details,student_id,school_id:selectedSchoolId,updated_at:now
       }));
     }
     await onSaved(selectedSchoolId);
   }catch(err){setError(err instanceof Error?err.message:'Penyimpanan gagal. Cek data lalu ulangi.')}
   finally{setSubmitting(false)}
 };
 const section=(title:string,children:React.ReactNode)=><fieldset className="sm:col-span-2 rounded-xl border border-gray-200 p-3 sm:p-4 space-y-3">
   <legend className="px-2 text-sm font-bold text-[#073b2d]">{title}</legend>
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
  </fieldset>;
 const bankUnlocked=details.kip_recipient==='Ya'&&details.pip_received==='Ya';
 return <section className="rounded-xl border border-[#c89b55] bg-white p-4 sm:p-5 space-y-4">
  <div><h3 className="text-base font-bold text-[#073b2d]">{existing?'Edit Data Peserta Didik':'Tambah Peserta Didik Baru'}</h3>
   <p className="text-xs text-gray-600 mt-1">{selectedSchool?.school_name||schoolName} · Jenjang: {currentLevel} · Tahun Ajaran {academicYear} · Semester {semester}</p>
  </div>
  {error&&<div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800" role="alert">{error}</div>}
  {!options.length&&<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
    Buat Master Rombel untuk sekolah dan periode ini sebelum menambahkan peserta didik.
  </p>}
  {detailsLoading&&<p role="status" className="text-xs text-gray-600">Memuat data pribadi dengan hak akses khusus...</p>}
  <form onSubmit={e=>void save(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {section('Identitas dan Penempatan Peserta Didik',<>
      <label className="sm:col-span-2 text-xs font-semibold">Sekolah *
       <select required className={input+' mt-1'} value={selectedSchoolId}
         disabled={Boolean(existing)}
         onChange={e=>{
           setSelectedSchoolId(e.target.value);setGrade('');setClassId('');
           setDetails(prev=>({...prev,school_id:e.target.value}));
         }}>
         <option value="">Pilih sekolah dari Daftar Sekolah</option>
         {schools.map(s=><option key={s.school_id} value={s.school_id}>{s.school_name}</option>)}
       </select>
       {existing&&<span className="mt-1 block text-[11px] text-gray-500">
         Perubahan sekolah untuk siswa terdaftar memerlukan proses mutasi sekolah.
       </span>}
      </label>
      <label className="sm:col-span-2 text-xs font-semibold">Nama Peserta Didik *
       <input required className={input+' mt-1'} maxLength={150} value={name} onChange={e=>setName(e.target.value)}/>
      </label>
      <label className="text-xs font-semibold">NIPD
       <input className={input+' mt-1'} value={nipd} maxLength={50} onChange={e=>setNipd(e.target.value)}/>
      </label>
      <label className="text-xs font-semibold">Jenis Kelamin *
       <select required className={input+' mt-1'} value={gender} onChange={e=>setGender(e.target.value as 'L'|'P')}>
        <option value="L">Laki-laki</option><option value="P">Perempuan</option>
       </select>
      </label>
      <label className="text-xs font-semibold">NISN
       <input inputMode="numeric" maxLength={10} pattern="[0-9]{10}" readOnly={Boolean(existing?.nisn)}
         className={input+' mt-1'} value={nisn} onChange={e=>setNisn(e.target.value.replace(/\D/g,''))}/>
      </label>
      <label className="text-xs font-semibold">Tingkat Kelas *
       <select className={input+' mt-1'} required value={grade} onChange={e=>{setGrade(e.target.value);setClassId('')}}>
        <option value="">Pilih tingkat kelas</option>
        {levels.map(v=><option key={v} value={v}>{v}</option>)}
       </select>
      </label>
      <label className="sm:col-span-2 text-xs font-semibold">Rombel Saat Ini / Kelas (Nama Rombel) *
       <select required disabled={!grade} className={input+' mt-1'} value={classId} onChange={e=>setClassId(e.target.value)}>
        <option value="">Pilih rombel berdasarkan tingkat kelas</option>
        {matching.map(c=><option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
       </select>
      </label>
    </>)}

    {canManagePrivate ? <>
     <p className="sm:col-span-2 text-xs text-amber-900 rounded-lg bg-amber-50 border border-amber-200 p-3">
       Bagian berikut berisi data pribadi anak, keluarga, bantuan, rekening, serta kesehatan. Isi hanya untuk kebutuhan administrasi sekolah yang sah. Data tidak digunakan sebagai identitas dalam Executive Dashboard.
     </p>
     {section('Identitas, Alamat dan Kontak',<>
      {identityFields.map(f=>f.key==='religion'?select('religion','Agama',RELIGIONS):
       f.key==='living_arrangement'?select('living_arrangement','Jenis Tinggal',LIVING_OPTIONS):
       f.key==='transport'?select('transport','Alat Transportasi',TRANSPORT_OPTIONS):field(f))}
      {select('kps_recipient','Penerima KPS',YES_NO)}
      {details.kps_recipient==='Ya'&&field({key:'kps_number',label:'No. KPS'})}
     </>)}
     {details.living_arrangement==='Bersama Orang Tua'
       ? <>{family('father','Data Ayah')}{family('mother','Data Ibu')}</>
       : details.living_arrangement
         ? family('guardian','Data Wali')
         : <p className="sm:col-span-2 text-xs text-gray-600">
           Pilih Jenis Tinggal untuk menampilkan Data Ayah/Ibu atau Data Wali.
         </p>}
     {section('Riwayat Pendidikan dan Dokumen',educationFields.map(fieldItem=>field(fieldItem)))}
     {section('KIP, KKS dan PIP',<>
       {select('kip_recipient','Penerima KIP',YES_NO)}
       <label className="text-xs font-semibold">Indikator Penerima KIP (otomatis 1/0)
        <input readOnly className={input+' mt-1 bg-gray-50'} value={details.kip_recipient==='Ya'?1:0}/>
       </label>
       {details.kip_recipient==='Ya'&&<>
         {field({key:'kip_number',label:'Nomor KIP'})}
         {field({key:'kip_name',label:'Nama di KIP'})}
       </>}
       {field({key:'kks_number',label:'Nomor KKS (Kartu Keluarga Sejahtera)'})}
       {select('pip_received','Penerima Bantuan PIP (Aktual)',YES_NO,details.kip_recipient!=='Ya')}
       {select('pip_eligible','Layak PIP (Usulan dari Sekolah)',YES_NO)}
       {details.pip_eligible==='Ya'&&select('pip_reason','Alasan Layak PIP',PIP_REASONS)}
       {field({key:'bank',label:'Bank'},!bankUnlocked)}
       {field({key:'bank_account',label:'Nomor Rekening Bank'},!bankUnlocked)}
       {field({key:'bank_account_name',label:'Rekening Atas Nama'},!bankUnlocked)}
       {!bankUnlocked&&<p className="sm:col-span-2 text-[11px] text-amber-800">
         Data bank hanya dapat diisi jika Penerima KIP = Ya dan Penerima Bantuan PIP (Aktual) = Ya.
       </p>}
     </>)}
     {section('Kebutuhan Khusus dan Kesehatan',<>
       {select('special_needs','Kebutuhan Khusus',SPECIAL_NEEDS)}
       {healthFields.filter(f=>f.key!=='head_circumference_cm'||supportsHeadCircumference(currentLevel)).map(f=>field(f))}
     </>)}
     {section('Titik Koordinat Rumah Peserta Didik',<>
       <div className="sm:col-span-2">
        <button type="button" onClick={()=>setShowMap(v=>!v)}
         className="rounded-lg border border-[#073b2d] px-3 py-2 text-xs font-semibold text-[#073b2d]">
         {showMap?'Tutup Peta':'Pilih Titik Rumah pada Peta'}
        </button>
       </div>
       {showMap&&<div className="sm:col-span-2">
         <HomeLocationPicker latitude={details.latitude} longitude={details.longitude}
          onChoose={(lat,lng)=>setDetails(prev=>({...prev,latitude:lat,longitude:lng}))}/>
       </div>}
       <label className="text-xs font-semibold">Lintang (otomatis dari peta)
        <input className={input+' mt-1 bg-gray-50'} readOnly value={details.latitude??''}/>
       </label>
       <label className="text-xs font-semibold">Bujur (otomatis dari peta)
        <input className={input+' mt-1 bg-gray-50'} readOnly value={details.longitude??''}/>
       </label>
       <button type="button" onClick={()=>setDetails(prev=>({...prev,latitude:null,longitude:null}))}
         className="sm:col-span-2 justify-self-start text-xs text-rose-700 underline">Hapus Titik Koordinat</button>
     </>)}
     <label className="sm:col-span-2 flex gap-2 text-xs items-start border-t pt-3">
      <input required type="checkbox" checked={consented} onChange={e=>setConsented(e.target.checked)}/>
      Saya berwenang memasukkan dan memperbarui data pribadi peserta didik untuk administrasi pendidikan ARF.
     </label>
    </> : <p className="sm:col-span-2 text-xs text-amber-800 p-3 border rounded-lg">
      Data NIK, KK, keluarga, bantuan, rekening, kesehatan dan titik rumah hanya dapat diakses oleh petugas sekolah yang mendapat kewenangan khusus.
    </p>}
    <div className="sm:col-span-2 flex justify-end flex-wrap gap-2 border-t pt-3">
     <button type="button" disabled={submitting} onClick={onCancel}
      className="rounded-lg border border-gray-300 px-4 py-2.5 text-xs font-semibold">Batal</button>
     <button type="submit" disabled={submitting||detailsLoading||!options.length||!chosen}
      className="rounded-lg bg-[#073b2d] text-white px-4 py-2.5 text-xs font-semibold disabled:opacity-50">
      {submitting?'Menyimpan...':existing?'Simpan Perubahan':'Simpan Peserta Didik'}
     </button>
    </div>
  </form>
 </section>;
};
