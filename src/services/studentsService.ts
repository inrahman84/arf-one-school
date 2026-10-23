import {collection,doc,getDoc,getDocs,setDoc} from '../lib/documentStore';
import {db} from '../lib/backend';
import {supabase} from '../lib/supabase';
import {StudentRecord,StudentMovement,ClassroomEnrollment,StudentPrivateDetails} from '../types';
import {auditService} from './auditService';

export const studentsService={
 /** Confidential information: never returned by getBySchool / getAll or executive reports. */
 async getPrivateDetails(schoolId:string,studentId:string):Promise<StudentPrivateDetails|null>{
   const snap=await getDoc(doc(db,'schools',schoolId,'studentPrivate',studentId));
   return snap.exists()?snap.data() as StudentPrivateDetails:null;
 },
 async savePrivateDetails(record:StudentPrivateDetails):Promise<void>{
   if(!record.student_id||!record.school_id)throw new Error('Identitas referensi data pribadi tidak lengkap.');
   const child=await getDoc(doc(db,'schools',record.school_id,'students',record.student_id));
   if(!child.exists()||child.data().school_id!==record.school_id){
     throw new Error('Data peserta didik harus tersimpan dahulu sebelum menyimpan data rinci.');
   }
   await setDoc(doc(db,'schools',record.school_id,'studentPrivate',record.student_id),{
     ...record,updated_at:new Date().toISOString()
   });
   // Avoid values or private field names in audit details.
   void auditService.log('UPDATE_STUDENT_PRIVATE','StudentRecord',record.student_id,record.school_id,
     'Data rinci peserta didik diperbarui').catch(()=>{});
 },
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
 /** A manual form creates or edits the same canonical student collection as the Dapodik import.
  * Validate school, classroom, academic period and duplicated official identifiers at save time. */
 async saveStudent(record:StudentRecord,isEditing:boolean=false):Promise<void>{
   if(!record.school_id||!record.student_id||!record.full_name.trim()||!['L','P'].includes(record.gender)){
     throw new Error('Sekolah, nama peserta didik, dan jenis kelamin wajib diisi.');
   }
   if(!record.academic_year||!['Ganjil','Genap'].includes(record.semester)||!record.class_id){
     throw new Error('Tahun Ajaran, Semester, Tingkat Kelas, dan Nama Rombel wajib ditentukan.');
   }
   const classSnap=await getDoc(doc(db,'schools',record.school_id,'classes',record.class_id));
   if(!classSnap.exists())throw new Error('Rombel yang dipilih tidak ditemukan pada sekolah.');
   const cls=classSnap.data() as ClassroomEnrollment;
   if(cls.school_id!==record.school_id||cls.academic_year!==record.academic_year||cls.semester!==record.semester||
     cls.grade_level!==record.grade_level||cls.class_name!==record.class_name){
     throw new Error('Tingkat Kelas dan Nama Rombel harus sesuai dengan Master Rombel sekolah serta periode aktif.');
   }
   const old=await getDoc(doc(db,'schools',record.school_id,'students',record.student_id));
   if(isEditing && !old.exists())throw new Error('Data murid yang akan diedit tidak ditemukan. Muat ulang daftar.');
   if(!isEditing && old.exists())throw new Error('Identitas peserta didik sudah terdaftar. Gunakan Edit pada daftar peserta didik.');
   if(old.exists()){
     const previous=old.data() as StudentRecord;
     if(previous.school_id!==record.school_id||previous.academic_year!==record.academic_year||previous.semester!==record.semester){
       throw new Error('Sekolah atau periode peserta didik tidak dapat diganti dari formulir Edit.');
     }
     if(previous.nisn && previous.nisn!==record.nisn){
       throw new Error('NISN yang sudah disimpan tidak dapat diubah melalui edit biasa. Hubungi administrator jika ada koreksi identitas.');
     }
   }
   const roster=await this.getBySchool(record.school_id);
   if(roster.some(student=>student.student_id!==record.student_id&&
     student.academic_year===record.academic_year&&student.semester===record.semester&&
     ((record.nisn && student.nisn===record.nisn)||
      (record.nipd && student.nipd===record.nipd)))){
     throw new Error('NISN atau NIPD sudah digunakan peserta didik lain pada tahun dan semester ini.');
   }
   await setDoc(doc(db,'schools',record.school_id,'students',record.student_id),{
     ...record,full_name:record.full_name.trim(),nisn:record.nisn?.trim()||'',
     nipd:record.nipd?.trim()||'',updated_at:new Date().toISOString()
   });
   void auditService.log(old.exists()?'EDIT_STUDENT':'ADD_STUDENT','StudentRecord',record.student_id,record.school_id,
     'Simpan peserta didik dengan rombel '+record.class_id).catch(console.warn);
 },
 async mapRombel(schoolId:string,students:StudentRecord[],sourceLabel:string,classId:string):Promise<number>{
   const target=await getDoc(doc(db,'schools',schoolId,'classes',classId));
   if(!target.exists())throw new Error('Rombel tujuan tidak ditemukan.');
   const cls=target.data() as ClassroomEnrollment;
   if(cls.school_id!==schoolId)throw new Error('Rombel tidak berasal dari sekolah yang dipilih.');
   const matches=students.filter(s=>s.school_id===schoolId&&s.source_rombel===sourceLabel);
   if(matches.some(s=>s.academic_year!==cls.academic_year||s.semester!==cls.semester)){
     throw new Error('Tahun Ajaran dan Semester rombel tidak sama dengan peserta didik.');
   }
   for(const s of matches){
     await setDoc(doc(db,'schools',schoolId,'students',s.student_id),{
       class_id:classId,grade_level:cls.grade_level,class_name:cls.class_name,
       updated_at:new Date().toISOString()
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
