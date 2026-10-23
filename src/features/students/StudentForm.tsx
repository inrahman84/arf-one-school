import React,{useEffect,useState} from 'react';
import {ClassroomEnrollment,Semester,StudentRecord} from '../../types';
import {makeStudentId} from '../../lib/dapodikStudents';
import {studentsService} from '../../services/studentsService';

interface Props{
 schoolId:string;
 schoolName:string;
 academicYear:string;
 semester:Semester;
 classes:ClassroomEnrollment[];
 existing:StudentRecord|null;
 onSaved:()=>Promise<void>|void;
 onCancel:()=>void;
}
/** A single entry and edit form for students. Class selection always points at the master
 * class_id used by Manajemen Sekolah > Rombel & Peserta Didik. */
export const StudentForm:React.FC<Props>=({
 schoolId,schoolName,academicYear,semester,classes,existing,onSaved,onCancel
})=>{
 const options=classes.filter(c=>c.school_id===schoolId&&c.academic_year===academicYear&&c.semester===semester);
 const [name,setName]=useState(existing?.full_name||'');
 const [gender,setGender]=useState<'L'|'P'>(existing?.gender||'L');
 const [nisn,setNisn]=useState(existing?.nisn||'');
 const [nipd,setNipd]=useState(existing?.nipd||'');
 const [grade,setGrade]=useState(options.find(c=>c.class_id===existing?.class_id)?.grade_level||existing?.grade_level||'');
 const [classId,setClassId]=useState(existing?.class_id||'');
 const [submitting,setSubmitting]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
   setName(existing?.full_name||'');setGender(existing?.gender||'L');
   setNisn(existing?.nisn||'');setNipd(existing?.nipd||'');
   setGrade(options.find(c=>c.class_id===existing?.class_id)?.grade_level||existing?.grade_level||'');
   setClassId(existing?.class_id||'');setError('');
 },[existing?.student_id,schoolId,academicYear,semester]);
 const levels=[...new Set(options.map(c=>c.grade_level))].sort((a,b)=>
   a.localeCompare(b,'id',{numeric:true}));
 const matching=options.filter(c=>c.grade_level===grade);
 const chosen=matching.find(c=>c.class_id===classId);
 const save=async(e:React.FormEvent)=>{
   e.preventDefault();setError('');
   if(!name.trim()||!schoolId||!academicYear||!grade||!chosen){
     setError('Lengkapi Nama, Tingkat Kelas, dan Nama Rombel yang sesuai dengan sekolah dan periode.');return;
   }
   if(nisn.trim()&&!/^\d{10}$/.test(nisn.trim())){
     setError('NISN harus terdiri dari 10 digit angka atau dikosongkan bila belum tersedia.');return;
   }
   if(existing?.nisn&&existing.nisn!==nisn.trim()){
     setError('NISN terdaftar tidak dapat diubah dari formulir biasa.');return;
   }
   setSubmitting(true);
   try{
     const now=new Date().toISOString();
     const base={full_name:name.trim(),nisn:nisn.trim(),nipd:nipd.trim(),
       gender,source_rombel:existing?.source_rombel||chosen.class_name};
     const student_id=existing?.student_id||(
       nisn.trim()||nipd.trim() ?
         (await makeStudentId(schoolId,base))+'-'+academicYear.replace('/','-')+'-'+semester :
         'PD-M-'+crypto.randomUUID()
     );
     await studentsService.saveStudent({
       ...(existing||{}),...base,
       student_id,school_id:schoolId,class_id:chosen.class_id,
       grade_level:chosen.grade_level,grade_hint:chosen.grade_level,
       class_name:chosen.class_name,academic_year:academicYear,semester,
       snapshot_date:existing?.snapshot_date||now.slice(0,10),
       imported_at:existing?.imported_at||now,updated_at:now
     },Boolean(existing));
     await onSaved();
   }catch(err){setError(err instanceof Error?err.message:'Data peserta didik gagal disimpan.')}
   finally{setSubmitting(false)}
 };
 const input='block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-xs';
 return <section className="rounded-xl border border-[#c89b55] bg-white p-4 sm:p-5 space-y-4">
   <div><h3 className="text-base font-bold text-[#073b2d]">{existing?'Edit Data Peserta Didik':'Tambah Peserta Didik Baru'}</h3>
     <p className="text-xs text-gray-600 mt-1">Sekolah: {schoolName} · Tahun Ajaran {academicYear} · Semester {semester}</p>
   </div>
   <p className="text-xs text-gray-600">Tingkat Kelas dan Nama Rombel diambil langsung dari data Master Rombel pada Manajemen Sekolah. Setiap perubahan akan mengubah jumlah murid pada rombel terkait setelah disimpan.</p>
   {error&&<p className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800" role="alert">{error}</p>}
   {!options.length&&<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
      Belum ada rombel untuk tahun ajaran dan semester ini. Tambahkan terlebih dahulu melalui Manajemen Sekolah → Rombel &amp; Peserta Didik.
    </p>}
   <form onSubmit={e=>void save(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
     <label className="text-xs font-semibold text-gray-700 sm:col-span-2">Nama Peserta Didik *
       <input className={input+' mt-1'} required maxLength={150} value={name} onChange={e=>setName(e.target.value)} placeholder="Nama lengkap peserta didik"/>
     </label>
     <label className="text-xs font-semibold text-gray-700">Jenis Kelamin *
       <select className={input+' mt-1'} required value={gender} onChange={e=>setGender(e.target.value as 'L'|'P')}>
         <option value="L">Laki-laki</option><option value="P">Perempuan</option>
       </select>
     </label>
     <label className="text-xs font-semibold text-gray-700">NISN (jika tersedia)
       <input inputMode="numeric" pattern="[0-9]{10}" maxLength={10} className={input+' mt-1'}
         value={nisn} readOnly={Boolean(existing?.nisn)} onChange={e=>setNisn(e.target.value.replace(/\D/g,''))}
         placeholder="10 digit NISN"/>
     </label>
     <label className="text-xs font-semibold text-gray-700">NIPD / Nomor Induk (jika tersedia)
       <input maxLength={50} className={input+' mt-1'} value={nipd} onChange={e=>setNipd(e.target.value)} placeholder="Nomor induk di sekolah"/>
     </label>
     <label className="text-xs font-semibold text-gray-700">Tingkat Kelas *
       <select required className={input+' mt-1'} value={grade} onChange={e=>{setGrade(e.target.value);setClassId('')}}>
         <option value="">Pilih tingkat kelas</option>
         {levels.map(level=><option key={level} value={level}>{level}</option>)}
       </select>
     </label>
     <label className="text-xs font-semibold text-gray-700 sm:col-span-2">Nama Rombel *
       <select required className={input+' mt-1'} value={classId} onChange={e=>setClassId(e.target.value)} disabled={!grade}>
         <option value="">Pilih rombel berdasarkan tingkat kelas</option>
         {matching.map(c=><option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
       </select>
     </label>
     <div className="sm:col-span-2 flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-200">
       <button type="button" onClick={onCancel} disabled={submitting}
         className="rounded-lg border border-gray-300 px-4 py-2.5 text-xs font-semibold">Batal</button>
       <button type="submit" disabled={submitting||!options.length||!chosen}
         className="rounded-lg bg-[#073b2d] text-white px-4 py-2.5 text-xs font-semibold disabled:opacity-50">
         {submitting?'Menyimpan...':existing?'Simpan Perubahan':'Simpan Peserta Didik'}
       </button>
     </div>
   </form>
 </section>;
};
