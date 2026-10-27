import React,{useEffect,useMemo,useState} from 'react';
import {Archive,RefreshCw,Search,RotateCcw,Trash2,AlertTriangle} from 'lucide-react';
import {School,StudentRecord} from '../../types';
import {useAuth} from '../../context/AuthContext';
import {studentsService} from '../../services/studentsService';

type Props={
 schools:School[];
 initialSchoolId?:string|null;
 onRefresh:()=>Promise<void>|void;
 onManageStudents:(schoolId:string)=>void;
};

export const StudentArchiveView:React.FC<Props>=({
 schools,initialSchoolId,onRefresh,onManageStudents
})=>{
 const {hasSchoolAccess,isSuperAdmin,effectiveRole}=useAuth();
 const canRestore=isSuperAdmin||['SCHOOL_PRINCIPAL','SCHOOL_OPERATOR'].includes(effectiveRole);
 const visibleSchools=schools.filter(s=>hasSchoolAccess(s.school_id));
 const scopeKey=visibleSchools.map(s=>s.school_id).join('|');
 const [records,setRecords]=useState<StudentRecord[]>([]);
 const [schoolId,setSchoolId]=useState(initialSchoolId||'ALL');
 const [year,setYear]=useState('ALL');
 const [search,setSearch]=useState('');
 const [loading,setLoading]=useState(true);
 const [workingId,setWorkingId]=useState('');
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [toPurge,setToPurge]=useState<StudentRecord|null>(null);
 const [typedConfirmation,setTypedConfirmation]=useState('');

 const loadArchive=async()=>{
   setLoading(true);
   try{
     const rows=await studentsService.getAllArchived(visibleSchools.map(s=>s.school_id));
     setRecords(rows.sort((a,b)=>(b.archived_at||'').localeCompare(a.archived_at||'')));
     setError('');
   }catch(err){
     setError(err instanceof Error?err.message:'Data arsip tidak dapat dimuat.');
   }finally{setLoading(false);}
 };
 useEffect(()=>{void loadArchive();},[scopeKey]);

 const years=useMemo(()=>[...new Set(records.map(s=>s.academic_year))].sort().reverse(),[records]);
 const filtered=useMemo(()=>records.filter(s=>
   (schoolId==='ALL'||s.school_id===schoolId)
   && (year==='ALL'||s.academic_year===year)
   && (s.full_name.toLocaleLowerCase('id').includes(search.toLocaleLowerCase('id'))
       || (s.nisn||'').includes(search.trim())
       || (s.archived_class_name||s.source_rombel||'').toLocaleLowerCase('id').includes(search.toLocaleLowerCase('id')))
 ),[records,schoolId,year,search]);

 const restore=async(st:StudentRecord)=>{
   if(!canRestore||workingId)return;
   setWorkingId(st.student_id);setError('');setNotice('');
   try{
     await studentsService.restoreArchivedStudent(st.school_id,st.student_id);
     await loadArchive();
     await onRefresh();
     setNotice('Peserta didik berhasil dipulihkan ke daftar aktif. Jika rombel asal sudah tidak tersedia, lakukan pemetaan ulang.');
   }catch(err){setError(err instanceof Error?err.message:'Gagal memulihkan arsip.');}
   finally{setWorkingId('');}
 };
 const purge=async()=>{
   if(!isSuperAdmin||!toPurge||typedConfirmation!=='HAPUS PERMANEN'||workingId)return;
   const selected=toPurge;
   setWorkingId(selected.student_id);setError('');setNotice('');
   try{
     await studentsService.permanentlyDeleteArchivedStudent(selected.school_id,selected.student_id);
     setToPurge(null);setTypedConfirmation('');
     await loadArchive();
     await onRefresh();
     setNotice('Data arsip murid, informasi pribadi dan catatan mutasi terkait telah dihapus permanen. Log audit tindakan tetap tersedia.');
   }catch(err){setError(err instanceof Error?err.message:'Gagal menghapus permanen.');}
   finally{setWorkingId('');}
 };

 return <div className="space-y-5">
   <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
     <div>
       <h2 className="flex items-center gap-2 text-xl font-bold text-[#073b2d]"><Archive size={21}/> Arsip Peserta Didik</h2>
       <p className="mt-1 text-sm text-gray-600">Data murid yang diarsipkan dari menu Data Peserta Didik dan Rombel. Arsip tidak dihitung sebagai murid aktif.</p>
     </div>
     <button type="button" onClick={()=>void loadArchive()} disabled={loading||Boolean(workingId)}
       className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#073b2d] px-3 py-2 text-xs font-semibold text-[#073b2d] disabled:opacity-50">
       <RefreshCw size={15}/> Muat Ulang Arsip
     </button>
   </div>
   <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
     <strong>Arsip dan hapus permanen berbeda.</strong> Arsip dapat dipulihkan. Hapus Permanen hanya tersedia untuk Super Admin dan akan menghapus catatan murid pada periode tersebut beserta data pribadi dan mutasi terkait; tindakan tidak dapat dibatalkan. Jejak audit minimal tetap disimpan.
   </div>
   {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
   {notice&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
   <section className="space-y-3 rounded-xl border bg-white p-4">
     <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_2fr]">
       <label className="text-xs font-semibold">Sekolah
         <select className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-xs" value={schoolId}
           onChange={e=>setSchoolId(e.target.value)}>
           <option value="ALL">Seluruh Sekolah</option>
           {visibleSchools.map(s=><option key={s.school_id} value={s.school_id}>{s.school_name}</option>)}
         </select>
       </label>
       <label className="text-xs font-semibold">Tahun Ajaran
         <select className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-xs" value={year}
           onChange={e=>setYear(e.target.value)}>
           <option value="ALL">Seluruh Tahun Ajaran</option>
           {years.map(y=><option key={y} value={y}>{y}</option>)}
         </select>
       </label>
       <label className="text-xs font-semibold">Cari Peserta Didik
         <span className="relative mt-1 block">
           <Search size={15} className="absolute left-3 top-2.5 text-gray-500"/>
           <input aria-label="Cari arsip peserta didik" className="w-full rounded-lg border border-gray-300 p-2.5 pl-9 text-xs"
             placeholder="Nama, NISN, atau rombel lama" value={search} onChange={e=>setSearch(e.target.value)}/>
         </span>
       </label>
     </div>
     <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
       <span><strong>{filtered.length}</strong> arsip ditampilkan dari {records.length} arsip yang dapat diakses.</span>
       <button type="button" onClick={()=>onManageStudents(schoolId==='ALL'?(visibleSchools[0]?.school_id||''):schoolId)}
         disabled={!visibleSchools.length}
         className="font-semibold text-[#073b2d] underline disabled:opacity-40">Kembali ke Data Peserta Didik</button>
     </div>
     <div className="overflow-x-auto">
       <table className="min-w-[810px] w-full text-left text-xs">
         <thead className="border-b bg-gray-50 text-gray-600">
           <tr><th className="p-3">Nama Peserta Didik</th><th className="p-3">Sekolah</th>
             <th className="p-3">Periode</th><th className="p-3">Rombel Asal</th>
             <th className="p-3">Diarsipkan</th><th className="p-3">Tindakan</th></tr>
         </thead>
         <tbody>
           {filtered.map(st=><tr key={st.school_id+'-'+st.student_id} className="border-b last:border-0">
             <td className="p-3 font-medium text-gray-900">{st.full_name}</td>
             <td className="p-3">{visibleSchools.find(s=>s.school_id===st.school_id)?.school_name||'—'}</td>
             <td className="p-3">{st.academic_year} · {st.semester}</td>
             <td className="p-3">{st.archived_class_name||st.source_rombel||'Belum dipetakan'}</td>
             <td className="p-3">{st.archived_at?.slice(0,10)||'—'}</td>
             <td className="p-3">
               <div className="flex flex-wrap items-center gap-2">
                 {canRestore&&<button type="button" disabled={Boolean(workingId)}
                   onClick={()=>void restore(st)}
                   className="inline-flex items-center gap-1 rounded-lg border border-[#073b2d] px-2.5 py-1.5 font-semibold text-[#073b2d] disabled:opacity-40">
                   <RotateCcw size={13}/> Pulihkan
                 </button>}
                 {isSuperAdmin&&<button type="button" disabled={Boolean(workingId)}
                   onClick={()=>{setToPurge(st);setTypedConfirmation('');setError('');}}
                   className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 font-semibold text-rose-700 disabled:opacity-40">
                   <Trash2 size={13}/> Hapus Permanen
                 </button>}
               </div>
             </td>
           </tr>)}
           {!loading&&filtered.length===0&&<tr><td colSpan={6} className="p-8 text-center text-gray-500">
             Tidak ada arsip yang sesuai filter. Murid yang baru diarsipkan akan muncul di sini.
           </td></tr>}
           {loading&&<tr><td colSpan={6} className="p-8 text-center text-gray-500">Memuat data arsip...</td></tr>}
         </tbody>
       </table>
     </div>
   </section>
   {toPurge&&isSuperAdmin&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
     <div role="dialog" aria-modal="true" aria-labelledby="purge-archive-title"
       className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
       <div className="flex items-center gap-2 text-rose-700">
         <AlertTriangle size={21}/><h3 id="purge-archive-title" className="text-sm font-bold">Hapus Permanen Arsip Peserta Didik</h3>
       </div>
       <p className="text-sm text-gray-700">Anda akan menghapus permanen arsip <strong>{toPurge.full_name}</strong> pada {toPurge.academic_year} ({toPurge.semester}). Data pribadi dan mutasi terkait juga akan dihapus. Tindakan ini tidak dapat dipulihkan.</p>
       <label className="block text-xs font-semibold text-gray-700">
         Ketik <strong>HAPUS PERMANEN</strong> untuk mengonfirmasi
         <input value={typedConfirmation} onChange={e=>setTypedConfirmation(e.target.value)}
           autoComplete="off" placeholder="HAPUS PERMANEN"
           className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-sm"/>
       </label>
       {error&&<p role="alert" className="text-xs text-rose-700">{error}</p>}
       <div className="flex justify-end gap-2">
         <button type="button" disabled={Boolean(workingId)}
           onClick={()=>{setToPurge(null);setTypedConfirmation('');setError('');}}
           className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold disabled:opacity-50">Batal</button>
         <button type="button" onClick={()=>void purge()}
           disabled={typedConfirmation!=='HAPUS PERMANEN'||Boolean(workingId)}
           className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
           {workingId?'Menghapus...':'Hapus Permanen'}
         </button>
       </div>
     </div>
   </div>}
 </div>;
};
