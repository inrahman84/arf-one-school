import React,{useMemo,useState} from 'react';
import {BarChart,Bar,XAxis,YAxis,Tooltip,Legend,CartesianGrid,ResponsiveContainer} from 'recharts';
import {ClassroomEnrollment,School,Staff,StudentRecord,StudentMovement,Semester} from '../../types';
import {estimateTeacherNeeds} from '../../lib/staffingAnalytics';
import {currentRoster} from '../../lib/studentActivity';

interface Props{schools:School[];classes:ClassroomEnrollment[];staff:Staff[];students:StudentRecord[];movements:StudentMovement[];
 academicYear:string;semester:Semester;}
export const StaffingInsights:React.FC<Props>=({schools,classes,staff,students,movements,academicYear,semester})=>{
 const [target,setTarget]=useState(25);
 const data=useMemo(()=>estimateTeacherNeeds(schools,classes,staff,currentRoster(students,movements),academicYear,semester,target,[...new Set(students.map(s=>s.school_id))]),
   [schools,classes,staff,students,movements,academicYear,semester,target]);
 const active=data.filter(x=>x.students>0||x.source==='DAPODIK');
 const totals={
   students:active.reduce((sum,x)=>sum+x.students,0),
   teachers:active.reduce((sum,x)=>sum+x.activeTeachers,0),
   need:active.reduce((sum,x)=>sum+x.indicativeTeachers,0),
   gap:active.reduce((sum,x)=>sum+x.teacherGap,0),
   unassigned:active.reduce((sum,x)=>sum+x.unassigned,0)
 };
 const chart=active.slice().sort((a,b)=>b.teacherGap-a.teacherGap||b.students-a.students).slice(0,10)
  .map(x=>({school:x.school_name.length>26?x.school_name.slice(0,23)+'...':x.school_name,aktif:x.activeTeachers,kebutuhan:x.indicativeTeachers}));
 return <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 space-y-4">
   <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
     <div><h3 className="text-base sm:text-lg font-bold text-[#073b2d]">Analisis Kebutuhan Guru per Sekolah</h3>
       <p className="text-xs text-gray-600 mt-1">Indikator perencanaan ARF: guru kategori Guru berstatus Aktif dibanding kebutuhan indikatif berdasarkan jumlah rombel dan target murid/guru.</p></div>
     <label className="text-xs font-semibold text-gray-700 shrink-0">Skenario target murid per guru
       <select className="block mt-1 w-full rounded-lg border p-2 text-xs" value={target} onChange={e=>setTarget(Number(e.target.value))}>
         {[15,20,25,28,30].map(n=><option key={n} value={n}>{n} murid / guru</option>)}
       </select></label>
   </div>
   <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
     {([['Murid Tercatat',totals.students],['Guru Aktif',totals.teachers],['Kebutuhan Indikatif',totals.need],['Gap Guru per Sekolah',totals.gap],['Belum Terpetakan',totals.unassigned]] as [string,number][]).map(([label,n])=>
       <div key={label} className="border rounded-xl bg-[#f6f3ec] p-3"><div className="text-[11px] text-gray-600">{label}</div><div className="text-xl font-bold text-[#073b2d]">{n.toLocaleString('id-ID')}</div></div>)}
   </div>
   {chart.length>0?<div className="w-full h-72" aria-label="Grafik perbandingan guru aktif dan kebutuhan indikatif">
     <ResponsiveContainer width="100%" height="100%"><BarChart data={chart} layout="vertical" margin={{left:15,right:10}}>
       <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
       <XAxis type="number" allowDecimals={false}/>
       <YAxis dataKey="school" type="category" tick={{fontSize:10}} width={125}/>
       <Tooltip/><Legend/><Bar dataKey="aktif" name="Guru aktif" fill="#3f6276"/>
       <Bar dataKey="kebutuhan" name="Kebutuhan indikatif" fill="#c89b55"/>
     </BarChart></ResponsiveContainer>
   </div>:<p className="text-xs rounded-lg bg-amber-50 p-3 text-amber-800">Belum ada data murid atau rombel yang dapat dianalisis untuk filter periode ini.</p>}
   <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-xs">
     <thead className="bg-[#073b2d] text-white"><tr>{['Sekolah','Murid','Rombel','Guru Aktif','Indikatif','Gap','Sumber','Kualitas'].map(x=><th key={x} className="p-2 text-left">{x}</th>)}</tr></thead>
     <tbody>{active.map(x=><tr key={x.school_id} className="border-b">
       <td className="p-2 font-semibold">{x.school_name}</td>
       <td className="p-2">{x.students}</td><td className="p-2">{x.classrooms}</td>
       <td className="p-2">{x.activeTeachers}</td><td className="p-2">{x.indicativeTeachers}</td>
       <td className="p-2 font-bold">{x.teacherGap}</td>
       <td className="p-2">{x.source==='DAPODIK'?'Dapodik':'Input rombel'}</td>
       <td className="p-2">{x.status==='READY'?'Terpetakan':x.unassigned>0?x.unassigned+' belum terpetakan':'Perlu verifikasi'}</td>
     </tr>)}</tbody>
   </table></div>
   <p className="text-[11px] leading-relaxed text-gray-500">Metode: maksimum dari jumlah rombel dan pembulatan ke atas jumlah murid ÷ target, dikurangi jumlah Guru aktif (Kepala Sekolah tidak otomatis dihitung sebagai guru kelas). Ini <strong>skenario kebutuhan</strong>, bukan ketentuan rasio guru menurut regulasi. Sumber manual diberi label, dan murid tanpa penempatan rombel ditandai. Mutasi hanya dihitung dari peristiwa yang dicatat dengan bukti.</p>
 </section>;
};
