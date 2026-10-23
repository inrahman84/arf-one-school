import React, {useEffect,useMemo,useState} from 'react';
import {Upload,Users,Link2,ArrowRightLeft,RefreshCw,X,FileSpreadsheet,Trash2} from 'lucide-react';
import {ConfirmModal} from '../../components/ui/ConfirmModal';
import {School,ClassroomEnrollment,StudentRecord,StudentMovement,Semester} from '../../types';
import {useAuth} from '../../context/AuthContext';
import {useAcademicYears} from '../../hooks/useAcademicYears';
import {DapodikPreview,makeStudentId,normalizeSchoolLabel,readDapodikRoster,rosterCounts} from '../../lib/dapodikStudents';
import {studentsService} from '../../services/studentsService';
import {currentRoster} from '../../lib/studentActivity';
import {StudentForm} from './StudentForm';

interface Props{
 schools:School[];classes:ClassroomEnrollment[];students:StudentRecord[];
 movements:StudentMovement[];initialSchoolId?:string|null;onRefresh:()=>Promise<void>|void;
}
export const StudentsView:React.FC<Props>=({schools,classes,students,movements,initialSchoolId,onRefresh})=>{
 const {hasSchoolAccess,effectiveRole}=useAuth();
 const canManagePrivate=['SUPER_ADMIN','SCHOOL_PRINCIPAL','SCHOOL_OPERATOR'].includes(effectiveRole);
 const {activeAcademicYear}=useAcademicYears();
 const visibleSchools=schools.filter(s=>hasSchoolAccess(s.school_id));
 const [schoolId,setSchoolId]=useState(initialSchoolId||'');
 const [semester,setSemester]=useState<Semester>('Ganjil');
 const [preview,setPreview]=useState<DapodikPreview|null>(null);
 const [mapping,setMapping]=useState<Record<string,string>>({});
 const [confirmSchool,setConfirmSchool]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [showStudentForm,setShowStudentForm]=useState(false);
 const [editingStudent,setEditingStudent]=useState<StudentRecord|null>(null);
 const [studentToArchive,setStudentToArchive]=useState<StudentRecord|null>(null);
 const [archiveBusy,setArchiveBusy]=useState(false);
 const [archiveError,setArchiveError]=useState<string|null>(null);
 const [selectedImportName,setSelectedImportName]=useState('');
 const [progress,setProgress]=useState(0);
 const [filterText,setFilterText]=useState('');
 const [eventStudent,setEventStudent]=useState('');
 const [eventType,setEventType]=useState<'TRANSFER_IN'|'TRANSFER_OUT'|'DROPOUT'>('TRANSFER_IN');
 const [eventDate,setEventDate]=useState(new Date().toISOString().slice(0,10));
 const [eventReference,setEventReference]=useState('');
 const [eventClass,setEventClass]=useState('');
 useEffect(()=>{if(!schoolId&&visibleSchools[0])setSchoolId(visibleSchools[0].school_id)},[visibleSchools,schoolId]);
 const selectedSchool=visibleSchools.find(s=>s.school_id===schoolId);
 const closeStudentForm=()=>{
   setShowStudentForm(false);setEditingStudent(null);
 };
 useEffect(()=>{
   if(!showStudentForm)return;
   const onEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')closeStudentForm()};
   document.addEventListener('keydown',onEscape);
   const previous=document.body.style.overflow;
   document.body.style.overflow='hidden';
   return ()=>{document.removeEventListener('keydown',onEscape);document.body.style.overflow=previous};
 },[showStudentForm]);
 const confirmArchive=async()=>{
   if(!studentToArchive || !canManagePrivate)return;
   setArchiveBusy(true);setArchiveError(null);
   try{
     await studentsService.archiveStudent(studentToArchive.school_id,studentToArchive.student_id);
     setNotice('Data peserta didik diarsipkan. Riwayat mutasi dan data pribadi tetap tersimpan sesuai kebijakan retensi.');
     setStudentToArchive(null);
     await onRefresh();
   }catch(err){setArchiveError(err instanceof Error?err.message:'Gagal mengarsipkan peserta didik.');}
   finally{setArchiveBusy(false)}
 };
 const year=activeAcademicYear||'';
 const sourceMatches=preview&&selectedSchool?normalizeSchoolLabel(preview.schoolLabel)===normalizeSchoolLabel(selectedSchool.school_name):false;
 const currentClasses=classes.filter(c=>c.school_id===schoolId&&c.academic_year===year&&c.semester===semester);
 const subset=students.filter(s=>s.school_id===schoolId&&s.academic_year===year&&s.semester===semester);
 const effectiveRoster=currentRoster(subset,movements);
 const summaries=rosterCounts(effectiveRoster);
 const unassigned=effectiveRoster.filter(s=>!s.class_id).length;
 const displayed=subset.filter(s=>s.full_name.toLowerCase().includes(filterText.toLowerCase())||
   s.source_rombel.toLowerCase().includes(filterText.toLowerCase()));
 const handleFile=async(file?:File)=>{
   if(!file)return;setSelectedImportName(file.name);setError('');setNotice('');setPreview(null);setMapping({});setConfirmSchool(false);
   try{
     const parsed=await readDapodikRoster(file);
     const suggestions:Record<string,string>={};
     // Auto-suggest only unambiguous exact normalized names within the selected school/period.
     const normalize=(name:string)=>name.toUpperCase().replace(/[^A-Z0-9]/g,'');
     for(const label of parsed.rombelLabels){
       const matches=currentClasses.filter(cls=>normalize(cls.class_name)===normalize(label));
       if(matches.length===1)suggestions[label]=matches[0].class_id;
     }
     setMapping(suggestions);
     setPreview(parsed);
   }
   catch(e){setError(e instanceof Error?e.message:'Gagal membaca Dapodik.')}
 };
 const importData=async()=>{
   if(!preview||!selectedSchool||!year||busy)return;
   if(!sourceMatches&&!confirmSchool){setError('Nama sekolah pada dokumen berbeda. Konfirmasi kesesuaian sebelum import.');return;}
   setBusy(true);setError('');setNotice('');setProgress(0);
   try{
     const existing=await studentsService.getBySchool(schoolId);
     const existingMap=new Map(existing.map(s=>[s.student_id,s]));
     const records:StudentRecord[]=[];
     for(const r of preview.rows){
       const basic=await makeStudentId(schoolId,r);
       const student_id=basic+'-'+year.replace('/','-')+'-'+semester;
       const prior=existingMap.get(student_id);
       const class_id=mapping[r.source_rombel]??prior?.class_id??'';
       const matched=currentClasses.find(c=>c.class_id===class_id);
       const now=new Date().toISOString();
       records.push({...r,student_id,school_id:schoolId,class_id:matched?.class_id||'',
         grade_level:matched?.grade_level||prior?.grade_level||'',
         class_name:matched?.class_name||prior?.class_name||'',
         grade_hint:matched?.grade_level||r.grade_hint,
         academic_year:year,semester,snapshot_date:preview.snapshotDate,imported_at:prior?.imported_at||now,updated_at:now});
     }
     await studentsService.importStudents(schoolId,records,setProgress);
     setNotice(records.length+' peserta didik disimpan. '+records.filter(x=>!x.class_id).length+' belum dipetakan ke rombel.');
     setPreview(null);await onRefresh();
   }catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan peserta didik.')}
   finally{setBusy(false);}
 };
 const applyMapping=async(label:string)=>{
   const id=mapping[label];if(!id){setError('Pilih rombel aplikasi terlebih dahulu.');return;}
   setBusy(true);setError('');
   try{
     const count=await studentsService.mapRombel(schoolId,subset,label,id);
     setNotice(count+' peserta didik dari '+label+' berhasil dipetakan.');await onRefresh();
   }catch(e){setError(e instanceof Error?e.message:'Pemetaan gagal.')}
   finally{setBusy(false);}
 };
 const addEvent=async(e:React.FormEvent)=>{
   e.preventDefault();
   const student=subset.find(s=>s.student_id===eventStudent);
   const cls=currentClasses.find(c=>c.class_id===eventClass);
   if(!student||!cls){setError('Pilih peserta didik dan rombel untuk mutasi.');return;}
   setBusy(true);setError('');
   try{
     await studentsService.addMovement({event_id:crypto.randomUUID(),school_id:schoolId,
       student_id:student.student_id,class_id:cls.class_id,academic_year:year,semester,
       event_type:eventType,event_date:eventDate,reference_note:eventReference.trim(),created_at:new Date().toISOString()});
     setNotice('Peristiwa mutasi dicatat. Angka mutasi berasal dari log, bukan perkiraan Excel.');setEventReference('');
     await onRefresh();
   }catch(err){setError(err instanceof Error?err.message:'Pencatatan mutasi gagal.')}
   finally{setBusy(false);}
 };
 const input='w-full rounded-lg border border-gray-300 bg-white p-2.5 text-xs';
 const movementsHere=movements.filter(m=>m.school_id===schoolId&&m.academic_year===year&&m.semester===semester);
 return <div className="space-y-5">
   <div><h2 className="text-xl font-bold text-[#073b2d]">Data Peserta Didik</h2>
     <p className="text-sm text-gray-600">Sumber Daya — Register peserta didik Dapodik, pemetaan rombel dan mutasi terverifikasi.</p></div>
   <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border bg-white p-4">
     <label className="text-xs font-semibold">Sekolah<select className={input+' mt-1'} value={schoolId}
       onChange={e=>{setSchoolId(e.target.value);setPreview(null);setMapping({});setShowStudentForm(false);setEditingStudent(null);}}>
       {visibleSchools.map(s=><option key={s.school_id} value={s.school_id}>{s.school_name}</option>)}</select></label>
     <label className="text-xs font-semibold">Tahun Ajaran Aktif<input className={input+' mt-1 bg-gray-50'} readOnly value={year||'Belum diaktifkan'}/></label>
     <label className="text-xs font-semibold">Semester<select className={input+' mt-1'} value={semester}
       onChange={e=>{setSemester(e.target.value as Semester);setPreview(null);setShowStudentForm(false);setEditingStudent(null);}}>
       <option value="Ganjil">Ganjil</option><option value="Genap">Genap</option></select></label>
   </div>
   {error&&<div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm p-3">{error}</div>}
   {notice&&<div role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-3">{notice}</div>}
   <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {[['Peserta didik',summaries.total],['Laki-laki',summaries.male],['Perempuan',summaries.female],['Belum dipetakan',unassigned]].map(([label,count])=>
     <div key={label} className="rounded-xl border bg-white p-4"><div className="text-xs text-gray-500">{label}</div><div className="font-bold text-2xl text-[#073b2d]">{count}</div></div>)}
   </div>
   <div className="flex flex-wrap items-center justify-between gap-2">
     <div className="text-sm text-gray-600">Kelola peserta didik satu per satu melalui formulir atau impor massal menggunakan Dapodik.</div>
     <button type="button" disabled={!schoolId||!year||busy}
       onClick={()=>{setEditingStudent(null);setShowStudentForm(true);setError('');}}
       className="rounded-lg bg-[#073b2d] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
       + Tambah Peserta Didik
     </button>
   </div>
   {showStudentForm && (
     <div role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)closeStudentForm()}}
       className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-2 sm:p-5">
       <div role="dialog" aria-modal="true" aria-label={editingStudent?'Edit Data Peserta Didik':'Tambah Peserta Didik Baru'}
         className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
         <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
           <div><h3 className="text-sm font-bold text-[#073b2d]">
             {editingStudent?'Edit Data Peserta Didik':'Tambah Peserta Didik Baru'}
           </h3>
           <p className="text-xs text-gray-500">Formulir administrasi peserta didik ARF</p></div>
           <button type="button" title="Tutup formulir" aria-label="Tutup formulir"
             onClick={closeStudentForm} className="rounded-lg border border-gray-200 p-2 hover:bg-gray-100">
             <X className="h-5 w-5"/>
           </button>
         </div>
         <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-5">
           <StudentForm key={editingStudent?.student_id||'student-new'}
             schoolId={editingStudent?.school_id||schoolId}
             schoolName={selectedSchool?.school_name||''}
             educationLevel={selectedSchool?.education_level||''}
             schools={visibleSchools}
             canManagePrivate={canManagePrivate}
             academicYear={year}
             semester={semester}
             classes={classes}
             existing={editingStudent}
             onCancel={closeStudentForm}
             onSaved={async(savedSchoolId)=>{
               await onRefresh();closeStudentForm();
               setSchoolId(savedSchoolId);
               setNotice('Data peserta didik tersimpan. Jumlah murid pada Rombel & Peserta Didik diperbarui otomatis.');
             }}
           />
         </div>
       </div>
     </div>
   )}
   <section className="rounded-xl border bg-white p-4 space-y-3">
     <h3 className="font-bold flex items-center gap-2"><Users size={16}/> Daftar dan Pemetaan Rombel</h3>
     <p className="text-xs text-gray-600">Pemetaan bisa diterapkan secara massal berdasarkan label Rombel Saat Ini dari Dapodik.</p>
     {[...new Set(subset.map(s=>s.source_rombel))].sort().map(label=><div key={label} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 items-center">
       <span className="text-xs">{label||'Tanpa label'} ({subset.filter(s=>s.source_rombel===label).length})</span>
       <select className={input} value={mapping[label]||''} onChange={e=>setMapping(p=>({...p,[label]:e.target.value}))}>
         <option value="">Pilih rombel di aplikasi</option>
         {currentClasses.map(c=><option key={c.class_id} value={c.class_id}>{c.class_name} · {c.grade_level}</option>)}
       </select>
       <button type="button" disabled={busy||!mapping[label]} onClick={()=>void applyMapping(label)}
         className="rounded-lg border border-[#073b2d] text-[#073b2d] px-3 py-2 text-xs disabled:opacity-50">Terapkan</button>
     </div>)}
     <input className={input} placeholder="Cari peserta didik atau rombel" value={filterText} onChange={e=>setFilterText(e.target.value)}/>
     <div className="overflow-x-auto"><table className="w-full text-xs min-w-[520px]">
       <thead><tr className="text-left border-b bg-gray-50"><th className="p-2">Nama</th><th className="p-2">JK</th><th className="p-2">Rombel Sumber</th><th className="p-2">Rombel Terpetakan</th><th className="p-2">Aksi</th></tr></thead>
       <tbody>{displayed.slice(0,80).map(s=><tr key={s.student_id} className="border-b">
         <td className="p-2">{s.full_name}</td><td className="p-2">{s.gender}</td><td className="p-2">{s.source_rombel||'—'}</td>
         <td className="p-2">{currentClasses.find(c=>c.class_id===s.class_id)?.class_name||'Belum dipetakan'}</td>
         <td className="p-2">
           <div className="flex items-center gap-2">
             <button type="button" onClick={()=>{setEditingStudent(s);setShowStudentForm(true);
               setError('');setNotice('');}}
               className="rounded-lg border border-[#073b2d] px-2.5 py-1 text-xs text-[#073b2d]">
               Edit
             </button>
             {canManagePrivate && <button type="button"
               onClick={()=>{setStudentToArchive(s);setArchiveError(null)}}
               title="Hapus dari daftar aktif (arsip)"
               className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50">
               <Trash2 size={12}/> Hapus
             </button>}
           </div>
         </td>
       </tr>)}</tbody></table></div>
     <p className="text-[11px] text-gray-500">Ditampilkan maksimal 80 nama pada layar. Data pribadi peserta didik tidak diteruskan ke Executive Dashboard.</p>
   </section>
   <section className="rounded-xl border bg-white p-4 space-y-3">
     <h3 className="font-bold flex gap-2 items-center"><ArrowRightLeft size={16}/> Riwayat Mutasi Peserta Didik</h3>
     <p className="text-xs text-gray-600">File Daftar Peserta Didik tidak mencantumkan log mutasi. Catat peristiwa berdasarkan tanggal dan bukti sumber. Data mutasi yang belum dicatat tidak sama dengan angka nol terverifikasi.</p>
     <form onSubmit={e=>void addEvent(e)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
       <label className="text-xs">Peserta Didik<select required className={input} value={eventStudent} onChange={e=>setEventStudent(e.target.value)}>
         <option value="">Pilih peserta didik</option>{subset.map(s=><option key={s.student_id} value={s.student_id}>{s.full_name}</option>)}</select></label>
       <label className="text-xs">Rombel<select required className={input} value={eventClass} onChange={e=>setEventClass(e.target.value)}>
         <option value="">Pilih rombel</option>{currentClasses.map(c=><option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}</select></label>
       <label className="text-xs">Jenis Peristiwa<select className={input} value={eventType} onChange={e=>setEventType(e.target.value as typeof eventType)}>
         <option value="TRANSFER_IN">Pindahan Masuk</option><option value="TRANSFER_OUT">Pindah Keluar</option><option value="DROPOUT">Keluar / DO</option></select></label>
       <label className="text-xs">Tanggal Peristiwa<input required type="date" className={input} value={eventDate} onChange={e=>setEventDate(e.target.value)}/></label>
       <label className="text-xs">Nomor Bukti / Referensi<input required className={input} value={eventReference} onChange={e=>setEventReference(e.target.value)} placeholder="Nomor surat mutasi / keputusan"/></label>
       <button disabled={busy||!subset.length||!currentClasses.length} className="self-end rounded-lg bg-[#073b2d] text-white px-4 py-2.5 text-xs font-semibold disabled:opacity-50">Catat Mutasi</button>
     </form>
     <div className="text-xs text-gray-700">Mutasi tercatat periode ini: {movementsHere.filter(x=>x.event_type==='TRANSFER_IN').length} masuk · {movementsHere.filter(x=>x.event_type==='TRANSFER_OUT').length} pindah keluar · {movementsHere.filter(x=>x.event_type==='DROPOUT').length} DO</div>
   </section>
   <ConfirmModal
     isOpen={Boolean(studentToArchive)}
     title="Hapus Peserta Didik dari Daftar Aktif"
     itemName={studentToArchive?.full_name}
     message="Peserta didik akan diarsipkan dan tidak lagi dihitung dalam jumlah murid aktif. Data pribadi serta riwayat mutasi tidak dihapus permanen demi keterlacakan."
     confirmLabel="Arsipkan Peserta Didik"
     cancelLabel="Batal"
     loading={archiveBusy}
     error={archiveError}
     onCancel={()=>{if(!archiveBusy){setStudentToArchive(null);setArchiveError(null)}}}
     onConfirm={()=>void confirmArchive()}
   />
   <section className="rounded-xl border bg-white p-4 space-y-3">
     <h3 className="font-bold flex items-center gap-2"><Upload size={16}/> Impor Daftar Peserta Didik (Dapodik)</h3>
     <p className="text-xs text-gray-600">Impor massal tetap mengambil data minimum: nama, NISN/NIPD, jenis kelamin dan rombel. Kolom NIK, KK, alamat, data orang tua, rekening dan kesehatan dari Excel tidak otomatis masuk ke formulir pribadi. Semua impor dikaitkan ke sekolah, tahun ajaran dan semester.</p>
     {!year&&<p className="text-xs font-semibold text-amber-700">Super Admin perlu mengaktifkan Tahun Ajaran pada Administrasi Sistem.</p>}
     <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
       <input id="student-dapodik-file" type="file" accept=".xlsx,.xls"
         disabled={busy||!year||!schoolId} aria-label="Pilih file Excel Dapodik"
         className="sr-only"
         onChange={e=>void handleFile(e.target.files?.[0])}/>
       <label htmlFor="student-dapodik-file"
         className={`inline-flex w-fit items-center gap-2 rounded-lg border-2 border-[#073b2d] bg-[#073b2d] px-4 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#0a5742] focus-within:ring-2 focus-within:ring-[#c89b55] ${busy||!year||!schoolId?'cursor-not-allowed opacity-50':'cursor-pointer'}`}>
         <FileSpreadsheet className="h-4 w-4"/> Pilih File Excel Dapodik (.xlsx/.xls)
       </label>
       <span className="break-all text-xs text-gray-600">{selectedImportName||'Belum ada file dipilih'}</span>
     </div>
     {preview&&<div className="space-y-3 rounded-lg border bg-[#f6f3ec] p-3">
       <p className="text-sm"><strong>{preview.rows.length}</strong> baris valid · {preview.rombelLabels.length} label rombel · {preview.duplicate} duplikat · {preview.rejected} baris invalid · snapshot {preview.snapshotDate}</p>
       <p className="text-xs">Sumber: {preview.schoolLabel||'Tidak terbaca'} · Sekolah tujuan: {selectedSchool?.school_name||'—'}</p>
       {!sourceMatches&&<label className="flex gap-2 items-start text-xs text-amber-800"><input type="checkbox" checked={confirmSchool} onChange={e=>setConfirmSchool(e.target.checked)}/>Saya memastikan file Dapodik memang berasal dari sekolah tujuan. Nama sekolah pada kedua sumber tidak identik.</label>}
       <p className="text-xs font-semibold">Pemetaan rombel dapat diisi sekarang atau setelah impor. Label yang belum terpetakan tetap tercatat dan tidak otomatis digabung ke rombel lain.</p>
       {preview.rombelLabels.map(label=><div key={label} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
         <span className="text-xs font-semibold">{label} ({preview.rows.filter(x=>x.source_rombel===label).length} murid)</span>
         <select className={input} value={mapping[label]||''} onChange={e=>setMapping(p=>({...p,[label]:e.target.value}))}>
           <option value="">Belum dipetakan</option>
           {currentClasses.map(c=><option key={c.class_id} value={c.class_id}>{c.class_name} · {c.grade_level}</option>)}
         </select></div>)}
       <button type="button" disabled={busy||(!sourceMatches&&!confirmSchool)} onClick={()=>void importData()}
         className="rounded-lg bg-[#073b2d] text-white px-4 py-2.5 text-xs font-semibold disabled:opacity-50">
         {busy?'Menyimpan '+progress+'/'+preview.rows.length:'Validasi & Impor Peserta Didik'}
       </button>
     </div>}
   </section>
 </div>;
};
