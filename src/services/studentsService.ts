import {collection,doc,getDocs,setDoc} from '../lib/documentStore';
import {db} from '../lib/backend';
import {supabase} from '../lib/supabase';
import {StudentRecord,StudentMovement} from '../types';
import {auditService} from './auditService';

export const studentsService={
 async getBySchool(schoolId:string):Promise<StudentRecord[]>{
   const snap=await getDocs(collection(db,'schools',schoolId,'students'));
   return snap.docs.map(d=>({...d.data(),student_id:d.id})) as StudentRecord[];
 },
 async getAll(schoolIds:string[]):Promise<StudentRecord[]>{
   const groups=await Promise.all(schoolIds.map(async sid=>{
     try{return await this.getBySchool(sid)}catch(e){console.warn('Student roster unavailable for one school');return [] as StudentRecord[]}
   }));
   return groups.flat();
 },
 /** Upsert students in modest batches, preserving class assignments when source label is unchanged.
  * All writes go through existing RLS-controlled, school-scoped Supabase document rows. */
 async importStudents(schoolId:string,records:StudentRecord[],onProgress?:(n:number)=>void):Promise<number>{
   if(!schoolId||records.some(x=>x.school_id!==schoolId))throw new Error('Sekolah import tidak konsisten.');
   const unique=new Set(records.map(x=>x.student_id));
   if(unique.size!==records.length)throw new Error('Duplikasi ID peserta didik dalam berkas.');
   const path='schools/'+schoolId+'/students';
   for(let i=0;i<records.length;i+=60){
     const batch=records.slice(i,i+60).map(s=>({
       path:path+'/'+s.student_id,collection_path:path,doc_id:s.student_id,school_id:schoolId,content:s
     }));
     const {error}=await supabase.from('arf_school_documents').upsert(batch,{onConflict:'path'});
     if(error)throw new Error('Gagal menyimpan batch peserta didik: '+error.message);
     onProgress?.(Math.min(i+60,records.length));
   }
   void auditService.log('IMPORT_STUDENTS','StudentRecord',schoolId,schoolId,
     'Impor roster minimal Dapodik: '+records.length+' baris; tanpa data orang tua/NIK/alamat').catch(console.warn);
   return records.length;
 },
 async mapRombel(schoolId:string,students:StudentRecord[],sourceLabel:string,classId:string):Promise<number>{
   const matches=students.filter(s=>s.school_id===schoolId&&s.source_rombel===sourceLabel);
   for(const s of matches){
     await setDoc(doc(db,'schools',schoolId,'students',s.student_id),{
       class_id:classId,updated_at:new Date().toISOString()
     },{merge:true});
   }
   void auditService.log('MAP_STUDENT_CLASS','StudentRecord',sourceLabel,schoolId,
       'Pemetaan rombel sumber ke kelas master: '+classId+' ('+matches.length+' baris)').catch(console.warn);
   return matches.length;
 },
 async getMovementsBySchool(schoolId:string):Promise<StudentMovement[]>{
   const snap=await getDocs(collection(db,'schools',schoolId,'studentMovements'));
   return snap.docs.map(d=>({...d.data(),event_id:d.id})) as StudentMovement[];
 },
 async getAllMovements(schoolIds:string[]):Promise<StudentMovement[]>{
   const groups=await Promise.all(schoolIds.map(async sid=>{
     try{return await this.getMovementsBySchool(sid)}catch(e){console.warn('Student movements unavailable for one school');return [] as StudentMovement[]}
   }));
   return groups.flat();
 },
 async addMovement(event:StudentMovement):Promise<void>{
   if(!event.student_id||!event.class_id||!event.event_date||!event.reference_note.trim()){
     throw new Error('Murid, rombel, tanggal peristiwa, dan referensi dokumen wajib diisi.');
   }
   await setDoc(doc(db,'schools',event.school_id,'studentMovements',event.event_id),event);
   void auditService.log('CREATE_STUDENT_MOVEMENT','StudentMovement',event.event_id,event.school_id,
      event.event_type+' / '+event.event_date).catch(console.warn);
 }
};
export function movementCounts(events:StudentMovement[],classId:string,year:string,semester:string){
 const list=events.filter(e=>e.class_id===classId&&e.academic_year===year&&e.semester===semester);
 return {transferIn:list.filter(e=>e.event_type==='TRANSFER_IN').length,
   transferOut:list.filter(e=>e.event_type==='TRANSFER_OUT').length,
   dropout:list.filter(e=>e.event_type==='DROPOUT').length};
}
