import React,{useEffect,useMemo,useState} from 'react';
import {ArrowRightLeft,CheckCircle,Copy,AlertTriangle} from 'lucide-react';
import {ClassroomEnrollment,Semester,StudentMovement,StudentRecord} from '../../types';
import {studentsService} from '../../services/studentsService';
import {currentRoster} from '../../lib/studentActivity';
import {isValidPeriodCopy,studentSourceGroup} from '../../lib/studentPeriodCopy';

type Props={
 schoolId:string;activeYear:string;years:string[];classes:ClassroomEnrollment[];
 students:StudentRecord[];movements:StudentMovement[];canCopyPrivate:boolean;
 onFinished:()=>Promise<void>|void;
};
const styles='w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs';

export const StudentPeriodCopy:React.FC<Props>=({
 schoolId,activeYear,years,classes,students,movements,canCopyPrivate,onFinished
})=>{
 const yearsWithRoster=useMemo(()=>[...new Set(students.filter(s=>s.school_id===schoolId)
   .map(s=>s.academic_year))].filter(Boolean).sort().reverse(),[students,schoolId]);
 const [sourceYear,setSourceYear]=useState('');
 const [sourceSemester,setSourceSemester]=useState<Semester>('Ganjil');
 const [targetSemester,setTargetSemester]=useState<Semester>('Genap');
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const [groupTargets,setGroupTargets]=useState<Record<string,string>>({});
 const [individualTargets,setIndividualTargets]=useState<Record<string,string>>({});
 const [includePrivate,setIncludePrivate]=useState(false);
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [progress,setProgress]=useState(0);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 useEffect(()=>{
   setSourceYear(yearsWithRoster[0]||'');setSourceSemester('Ganjil');
   setTargetSemester('Genap');setSelectedIds([]);setGroupTargets({});
   setIndividualTargets({});setConfirmed(false);setIncludePrivate(false);setError('');setSuccess('');
 },[schoolId,activeYear,yearsWithRoster.join('|')]);
 const source=useMemo(()=>currentRoster(students.filter(s=>
   s.school_id===schoolId&&s.academic_year===sourceYear&&s.semester===sourceSemester&&!s.archived_at
 ),movements),[students,movements,schoolId,sourceYear,sourceSemester]);
 const targets=classes.filter(c=>c.school_id===schoolId&&c.academic_year===activeYear&&c.semester===targetSemester);
 const groups=[...new Set(source.map(studentSourceGroup))];
 const label=(s:StudentRecord)=>s.class_name||s.source_rombel||'Tanpa Rombel';
 const targetOptions=<>
   <option value="">Pilih rombel tujuan</option>
   {[...new Set(targets.map(c=>c.grade_level))].sort((a,b)=>a.localeCompare(b,'id',{numeric:true}))
     .map(grade=><optgroup key={grade} label={grade}>
       {targets.filter(c=>c.grade_level===grade).map(c=>
         <option key={c.class_id} value={c.class_id}>{c.class_name} · {grade}</option>)}
     </optgroup>)}
 </>;
 const setGroup=(group:string,classId:string)=>{
   setGroupTargets(prev=>({...prev,[group]:classId}));setConfirmed(false);
 };
 const chooseAll=(checked:boolean)=>{
   setSelectedIds(checked?source.map(s=>s.student_id):[]);
   setConfirmed(false);
 };
 const toggle=(id:string,checked:boolean)=>{
   setSelectedIds(prev=>checked?[...new Set([...prev,id])]:prev.filter(x=>x!==id));
   setConfirmed(false);
 };
 const selected=source.filter(s=>selectedIds.includes(s.student_id));
 const mapped=selected.filter(s=>Boolean(individualTargets[s.student_id]||groupTargets[studentSourceGroup(s)]));
 const validPeriod=years.includes(activeYear)&&
   isValidPeriodCopy(sourceYear,sourceSemester,activeYear,targetSemester);
 const existingTarget=students.filter(s=>s.school_id===schoolId&&s.academic_year===activeYear&&s.semester===targetSemester);
 const sameTargetIdentity=(student:StudentRecord)=>existingTarget.some(e=>
   (student.nisn&&e.nisn&&student.nisn===e.nisn)||
   (student.nipd&&e.nipd&&student.nipd===e.nipd)||
   (e.lineage_id&&e.lineage_id===(student.lineage_id||student.student_id)));
 const present=selected.filter(s=>sameTargetIdentity(s)).length;
 const existingActive=currentRoster(existingTarget,movements);
 const overCapacity=targets.map(target=>{
   const existingCount=existingActive.filter(s=>s.class_id===target.class_id).length;
   const incoming=selected.filter(s=>
     !sameTargetIdentity(s)&&
     (individualTargets[s.student_id]||groupTargets[studentSourceGroup(s)])===target.class_id).length;
   return {name:target.class_name,total:existingCount+incoming,capacity:target.class_capacity};
 }).filter(x=>x.capacity>0&&x.total>x.capacity);
 const handleCopy=async()=>{
   if(busy)return;
   if(!validPeriod){setError('Pilih periode asal yang lebih lama. Untuk tahun yang sama, hanya Ganjil ke Genap.');return}
   if(!selected.length || mapped.length!==selected.length || !targets.length || !confirmed){
     setError('Pilih murid, tentukan rombel tujuan untuk semuanya, dan konfirmasi penyalinan.');return;
   }
   setBusy(true);setProgress(0);setError('');setSuccess('');
   try{
     const assignments=Object.fromEntries(selected.map(student=>[
       student.student_id,
       individualTargets[student.student_id]||groupTargets[studentSourceGroup(student)]
     ]));
     const result=await studentsService.copyToActivePeriod({
       schoolId,sourceYear,sourceSemester,targetYear:activeYear,targetSemester,
       assignments,copyPrivate:canCopyPrivate&&includePrivate,
       onProgress:n=>setProgress(n)
     });
     setSuccess('Berhasil menambahkan '+result.created+' murid ke '+activeYear+' '+targetSemester+
       '. '+result.skipped+' sudah ada dan tidak ditimpa.'+
       (includePrivate?' Data rinci berhasil disalin: '+result.privateCopied+
         '; perlu ditinjau ulang: '+result.privateFailed+'.':''));
     setConfirmed(false);setSelectedIds([]);setIndividualTargets({});setGroupTargets({});
     await onFinished();
   }catch(err){
     setError(err instanceof Error?err.message:'Gagal menyalin data peserta didik.');
     // A partially completed import can be resumed without overwriting existing data.
     await Promise.resolve(onFinished()).catch(()=>{});
   }finally{setBusy(false);}
 };
 return <section className="space-y-4 rounded-xl border border-[#c89b55] bg-white p-4 sm:p-5">
   <div className="flex items-start gap-2">
     <Copy className="mt-0.5 h-5 w-5 shrink-0 text-[#073b2d]"/>
     <div>
       <h3 className="font-bold text-[#073b2d]">Salin / Naikkan Peserta Didik ke Periode Aktif</h3>
       <p className="mt-1 text-xs text-gray-600">
         Salin data murid dari Tahun Ajaran sebelumnya atau dari Semester Ganjil ke Genap.
         Pilih rombel tujuan masing-masing kelompok atau murid; riwayat periode asal tidak diubah.
       </p>
     </div>
   </div>
   <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
     <label className="text-xs font-semibold">Tahun Ajaran Asal
       <select className={styles+' mt-1'} value={sourceYear} disabled={busy} onChange={e=>{
         setSourceYear(e.target.value);setSelectedIds([]);setGroupTargets({});setIndividualTargets({});setConfirmed(false)}}>
         {!yearsWithRoster.length&&<option value="">Tidak ada data murid</option>}
         {yearsWithRoster.map(year=><option key={year} value={year}>{year}</option>)}
       </select>
     </label>
     <label className="text-xs font-semibold">Semester Asal
       <select className={styles+' mt-1'} value={sourceSemester} disabled={busy} onChange={e=>{
         setSourceSemester(e.target.value as Semester);setSelectedIds([]);setGroupTargets({});setIndividualTargets({});setConfirmed(false)}}>
         <option value="Ganjil">Ganjil</option><option value="Genap">Genap</option>
       </select>
     </label>
     <label className="text-xs font-semibold">Tahun Ajaran Tujuan (Aktif)
       <input readOnly className={styles+' mt-1 bg-gray-50'} value={activeYear||'Aktifkan master tahun ajaran'}/>
     </label>
     <label className="text-xs font-semibold">Semester Tujuan
       <select className={styles+' mt-1'} value={targetSemester} disabled={busy} onChange={e=>{
         setTargetSemester(e.target.value as Semester);setSelectedIds([]);setGroupTargets({});setIndividualTargets({});setConfirmed(false)}}>
         <option value="Ganjil">Ganjil</option><option value="Genap">Genap</option>
       </select>
     </label>
   </div>
   {!validPeriod&&sourceYear&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
     <AlertTriangle className="h-4 w-4 shrink-0"/> Periode tujuan harus setelah periode asal. Dalam satu tahun ajaran hanya Ganjil → Genap.
   </div>}
   {!targets.length&&<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
     Rombel tujuan belum tersedia pada {activeYear} Semester {targetSemester}.
     Buat Rombel baru pada Manajemen Sekolah terlebih dahulu, lalu pilih periode yang sama.
   </p>}
   {validPeriod&&source.length>0&&targets.length>0&&<>
     <div className="space-y-2">
       <div className="flex flex-wrap items-center justify-between gap-2">
         <p className="text-xs font-semibold">Pemetaan berdasarkan rombel asal</p>
         <span className="text-xs text-gray-600">{source.length} murid tersedia · {selected.length} dipilih · {mapped.length} sudah dipetakan</span>
       </div>
       {groups.map(group=>{
         const members=source.filter(s=>studentSourceGroup(s)===group);
         return <div key={group} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-[#f6f3ec] p-2 sm:grid-cols-[1fr_2fr] sm:items-center">
           <label className="flex items-center gap-2 text-xs font-semibold">
             <input type="checkbox" disabled={busy} checked={members.every(s=>selectedIds.includes(s.student_id))}
               onChange={e=>{
                 const selectedSet=new Set(selectedIds);
                 members.forEach(s=>e.target.checked?selectedSet.add(s.student_id):selectedSet.delete(s.student_id));
                 setSelectedIds([...selectedSet]);setConfirmed(false);
               }}/>
             {label(members[0])} ({members.length})
           </label>
           <select className={styles} disabled={busy} value={groupTargets[group]||''}
             onChange={e=>setGroup(group,e.target.value)}>
             {targetOptions}
           </select>
         </div>
       })}
     </div>
     <div className="space-y-2">
       <label className="flex items-center gap-2 text-xs font-semibold">
         <input type="checkbox" disabled={busy} checked={Boolean(source.length&&selectedIds.length===source.length)}
           onChange={e=>chooseAll(e.target.checked)}/>
         Pilih seluruh murid sumber
       </label>
       <p className="text-[11px] text-gray-600">
         Ubah rombel individu pada kolom paling kanan bila sebagian murid ditempatkan di rombel berbeda.
       </p>
       <div className="max-h-72 overflow-auto rounded-lg border border-gray-200">
         <table className="min-w-[550px] w-full text-xs">
           <thead className="sticky top-0 bg-[#073b2d] text-white"><tr>
             <th className="p-2 text-left">Salin</th><th className="p-2 text-left">Murid</th>
             <th className="p-2 text-left">Rombel Asal</th><th className="p-2 text-left">Tujuan Khusus (opsional)</th>
           </tr></thead>
           <tbody>{source.map(student=><tr key={student.student_id} className="border-b">
             <td className="p-2"><input aria-label={'Pilih '+student.full_name} type="checkbox" disabled={busy}
               checked={selectedIds.includes(student.student_id)} onChange={e=>toggle(student.student_id,e.target.checked)}/></td>
             <td className="p-2">{student.full_name}</td><td className="p-2">{label(student)}</td>
             <td className="p-2">
               <select className={styles} disabled={busy} value={individualTargets[student.student_id]||''}
                 onChange={e=>{setIndividualTargets(p=>({...p,[student.student_id]:e.target.value}));setConfirmed(false)}}>
                 <option value="">Ikuti pilihan rombel kelompok</option>
                 {[...new Set(targets.map(c=>c.grade_level))].map(grade=>
                   <optgroup key={grade} label={grade}>
                     {targets.filter(c=>c.grade_level===grade).map(c=>
                       <option key={c.class_id} value={c.class_id}>{c.class_name} · {grade}</option>)}
                   </optgroup>)}
               </select>
             </td>
           </tr>)}</tbody>
         </table>
       </div>
     </div>
   </>}
   {overCapacity.length>0&&<p role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
     <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>
     Periksa kapasitas rombel tujuan: {overCapacity.map(x=>x.name+' ('+x.total+'/'+x.capacity+')').join(', ')}.
     Penyalinan tetap memerlukan konfirmasi petugas.
   </p>}
   {error&&<p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
   {success&&<p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
     <CheckCircle className="h-4 w-4 shrink-0"/>{success}
   </p>}
   {canCopyPrivate&&validPeriod&&source.length>0&&<label className="flex items-start gap-2 text-xs">
     <input type="checkbox" disabled={busy} checked={includePrivate} onChange={e=>{setIncludePrivate(e.target.checked);setConfirmed(false)}}/>
     <span>Salin juga data administrasi rinci (NIK, KK, keluarga, bantuan, kesehatan) dari periode asal.
       Hanya untuk pengguna berwenang; periksa ulang apabila terjadi perubahan identitas atau keadaan keluarga.</span>
   </label>}
   <p className="text-[11px] text-gray-500">
     {present>0?present+' murid pilihan sudah memiliki identitas di periode tujuan dan akan dilewati. ':''}
     Penyalinan tidak membuat peristiwa pindahan masuk/keluar; mutasi antar-sekolah memakai pencatatan terpisah.
     Jika koneksi terputus saat pemrosesan, jalankan ulang untuk melewati murid yang sudah tersimpan.
   </p>
   <label className="flex items-start gap-2 text-xs">
     <input type="checkbox" checked={confirmed} disabled={busy||!validPeriod||selected.length===0||mapped.length!==selected.length}
       onChange={e=>setConfirmed(e.target.checked)}/>
     Saya sudah memeriksa sekolah, murid terpilih, dan Tingkat Kelas/Rombel tujuan.
   </label>
   <div className="flex items-center justify-end gap-3">
     {busy&&<span role="status" className="text-xs text-gray-600">Diproses {progress} dari {selected.length} murid</span>}
     <button type="button" disabled={busy||!validPeriod||!confirmed||!selected.length||mapped.length!==selected.length||!targets.length}
       onClick={()=>void handleCopy()}
       className="inline-flex items-center gap-2 rounded-lg bg-[#073b2d] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">
       <ArrowRightLeft className="h-4 w-4"/> Salin {selected.length} Peserta Didik
     </button>
   </div>
 </section>;
};
