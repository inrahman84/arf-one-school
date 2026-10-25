import {collection,doc,getDoc,getDocs,setDoc,updateDoc} from '../lib/documentStore';
import {db} from '../lib/backend';
import {supabase} from '../lib/supabase';
import {StudentRecord,StudentMovement,ClassroomEnrollment,StudentPrivateDetails,Semester} from '../types';
import {academicYearsService} from './academicYearsService';
import {currentRoster} from '../lib/studentActivity';
import {copiedStudentId,isValidPeriodCopy,samePersonForPeriod,targetClassForCopy} from '../lib/studentPeriodCopy';
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
   return snap.docs.map(d=>({...d.data(),student_id:d.id}))
     .filter(row=>!row.archived_at) as StudentRecord[];
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
   const snapshot=await getDocs(collection(db,'schools',schoolId,'students'));
   const archivedIds=new Set(snapshot.docs.filter(row=>Boolean(row.data().archived_at)).map(row=>row.id));
   if(records.some(row=>archivedIds.has(row.student_id)))throw new Error(
     'File memuat peserta didik yang telah diarsipkan. Hubungi administrator untuk meninjau sebelum impor ulang.');
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
   if(old.exists()&&old.data().archived_at)throw new Error('Peserta didik sudah diarsipkan dan tidak dapat diedit langsung.');
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
 /** Hapus from the UI archives a roster row. Child private details and movement evidence
  * are kept under existing RLS; no orphaned or irreversible deletion of records. */
 async archiveStudent(schoolId:string,studentId:string):Promise<void>{
   if(!schoolId||!studentId)throw new Error('Sekolah dan peserta didik wajib dipilih.');
   const ref=doc(db,'schools',schoolId,'students',studentId);
   const current=await getDoc(ref);
   if(!current.exists())throw new Error('Data peserta didik tidak ditemukan.');
   const record=current.data() as StudentRecord;
   if(record.school_id!==schoolId)throw new Error('Peserta didik tidak berasal dari sekolah ini.');
   if(record.archived_at)throw new Error('Peserta didik sudah berada di arsip.');
   // Break the live class relation while keeping a historical reference for audits.
   await updateDoc(ref,{
     archived_at:new Date().toISOString(),
     archived_class_id:record.class_id||'',
     archived_class_name:record.class_name||'',
     archived_grade_level:record.grade_level||'',
     class_id:'',class_name:'',grade_level:'',
     updated_at:new Date().toISOString()
   });
   void auditService.log('ARCHIVE_STUDENT','StudentRecord',studentId,schoolId,
     'Data peserta didik diarsipkan tanpa menghapus bukti dan riwayat').catch(()=>{});
 },
 /**
  * Explicit copy/promotion with required target rombel for each selected student.
  * Never overwrite an existing period record or silently reactivate an archived one.
  * Each 50-row INSERT is transactional; on a later batch error, earlier batches remain
  * and can be safely resumed because existing identities are skipped.
  */
 async copyToActivePeriod(args:{
   schoolId:string;sourceYear:string;sourceSemester:Semester;
   targetYear:string;targetSemester:Semester;
   assignments:Record<string,string>;
   copyPrivate:boolean;
   onProgress?:(processed:number,total:number)=>void;
 }):Promise<{created:number;skipped:number;privateCopied:number;privateFailed:number}>{
   const {schoolId,sourceYear,sourceSemester,targetYear,targetSemester,assignments,copyPrivate,onProgress}=args;
   if(!schoolId||!isValidPeriodCopy(sourceYear,sourceSemester,targetYear,targetSemester))
     throw new Error('Pilih periode asal sebelum periode tujuan. Pada tahun yang sama hanya Ganjil ke Genap.');
   const master=await academicYearsService.loadAcademicYears();
   if(!master.connected||master.activeYear!==targetYear)
     throw new Error('Periode tujuan harus menggunakan Tahun Ajaran aktif pada Master Tahun Ajaran.');
   const all=await getDocs(collection(db,'schools',schoolId,'students'));
   const raw=all.docs.map(d=>({...d.data(),student_id:d.id}) as StudentRecord);
   const selected=raw.filter(student=>Boolean(assignments[student.student_id])&&
     student.academic_year===sourceYear&&student.semester===sourceSemester&&!student.archived_at);
   if(!selected.length)throw new Error('Pilih minimal satu murid aktif untuk disalin.');
   if(selected.length!==Object.keys(assignments).filter(k=>Boolean(assignments[k])).length)
     throw new Error('Daftar murid sumber telah berubah. Muat ulang sebelum menyalin.');
   const movements=await this.getMovementsBySchool(schoolId);
   const eligible=currentRoster(selected,movements);
   if(eligible.length!==selected.length)
     throw new Error('Sebagian murid tidak lagi aktif di periode sumber menurut log mutasi. Periksa ulang.');
   const classRows=await getDocs(collection(db,'schools',schoolId,'classes'));
   const classList=classRows.docs.map(d=>d.data() as ClassroomEnrollment);
   const targeted=raw.filter(st=>st.academic_year===targetYear&&st.semester===targetSemester);
   const now=new Date().toISOString();
   const toInsert:StudentRecord[]=[];
   let skipped=0;
   const identityKeys=new Set<string>();
   for(const student of selected){
     const target=targetClassForCopy(classList,assignments[student.student_id],schoolId,targetYear,targetSemester);
     const student_id=await copiedStudentId(student,targetYear,targetSemester);
     const lineage_id=student.lineage_id||student.student_id;
     const record:StudentRecord={
       student_id,school_id:schoolId,lineage_id,
       copied_from_student_id:student.student_id,
       copied_from_period:sourceYear+' '+sourceSemester,
       full_name:student.full_name,nisn:student.nisn||'',nipd:student.nipd||'',
       gender:student.gender,source_rombel:target.class_name,grade_hint:target.grade_level,
       grade_level:target.grade_level,class_name:target.class_name,class_id:target.class_id,
       academic_year:targetYear,semester:targetSemester,
       snapshot_date:now.slice(0,10),imported_at:now,updated_at:now
     };
     const key=record.nisn?'NISN:'+record.nisn:record.nipd?'NIPD:'+record.nipd:'LINEAGE:'+lineage_id;
     if(identityKeys.has(key))throw new Error('Murid sumber memiliki identitas ganda. Periksa NISN/NIPD sebelum penyalinan.');
     identityKeys.add(key);
     const matches=targeted.filter(t=>t.student_id===student_id||samePersonForPeriod(t,record));
     if(matches.length>1)throw new Error('Terdapat data ganda pada semester tujuan. Hubungi administrator.');
     if(matches.length){skipped++;continue;}
     toInsert.push(record);
   }
   const path='schools/'+schoolId+'/students';
   let created=0;
   for(let i=0;i<toInsert.length;i+=50){
     const batch=toInsert.slice(i,i+50).map(st=>({
       path:path+'/'+st.student_id,collection_path:path,doc_id:st.student_id,
       school_id:schoolId,content:st
     }));
     // Insert only: a concurrent record must NOT be replaced by this bulk operation.
     const {error}=await supabase.from('arf_school_documents').insert(batch);
     if(error)throw new Error('Salin berhenti setelah '+created+' tersimpan. Data yang sudah disalin aman. Periksa dan ulangi: '+error.message);
     created+=batch.length;
     onProgress?.(created+skipped,selected.length);
   }
   let privateCopied=0,privateFailed=0;
   if(copyPrivate){
     for(const record of toInsert){
       try{
         const originalId=record.copied_from_student_id||'';
         const details=await this.getPrivateDetails(schoolId,originalId);
         if(details){
           await this.savePrivateDetails({...details,student_id:record.student_id,
             school_id:schoolId,updated_at:new Date().toISOString()});
           privateCopied++;
         }
       }catch(error){
         privateFailed++;
         // Never log details, child names, NIK, contact data or account numbers.
       }
     }
   }
   void auditService.log('COPY_STUDENTS_PERIOD','StudentRecord',targetYear+'-'+targetSemester,schoolId,
     'Penyalinan periode '+sourceYear+' '+sourceSemester+' ke '+targetYear+' '+targetSemester+
     '; ditambah '+created+'; dilewati '+skipped+'; salinan rincian '+privateCopied).catch(()=>{});
   return {created,skipped,privateCopied,privateFailed};
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
