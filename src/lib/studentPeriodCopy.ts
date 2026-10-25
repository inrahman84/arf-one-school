import {ClassroomEnrollment,Semester,StudentRecord} from '../types';
import {makeStudentId} from './dapodikStudents';

export const studentSourceGroup=(student:StudentRecord)=>
 student.class_id||('ROMBEL:'+student.source_rombel)||'BELUM-DIPETAKAN';

export function isValidPeriodCopy(sourceYear:string,sourceSemester:Semester,
 targetYear:string,targetSemester:Semester):boolean{
 const start=(y:string)=>Number(y.slice(0,4));
 if(sourceYear===targetYear)return sourceSemester==='Ganjil'&&targetSemester==='Genap';
 return /^\d{4}\/\d{4}$/.test(sourceYear)&&/^\d{4}\/\d{4}$/.test(targetYear)&&
   start(sourceYear)<start(targetYear);
}

/** Invariant: deterministic per-school, per-person, per-period ID; never reuse a source document path. */
export async function copiedStudentId(source:StudentRecord,year:string,semester:Semester):Promise<string>{
 const school=source.school_id;
 if(source.nisn||source.nipd){
   const base=await makeStudentId(school,{
     full_name:source.full_name,nisn:source.nisn,nipd:source.nipd,
     gender:source.gender,source_rombel:source.source_rombel
   });
   return base+'-'+year.replace('/','-')+'-'+semester;
 }
 const seed=source.lineage_id||source.student_id;
 const buffer=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(
   school+'|'+seed+'|'+year+'|'+semester
 ));
 const hex=Array.from(new Uint8Array(buffer)).slice(0,16)
   .map(b=>b.toString(16).padStart(2,'0')).join('');
 return 'PD-C-'+hex;
}

export function samePersonForPeriod(a:StudentRecord,b:StudentRecord){
 if(a.school_id!==b.school_id||a.academic_year!==b.academic_year||a.semester!==b.semester)return false;
 if(a.nisn&&b.nisn)return a.nisn===b.nisn;
 if(a.nipd&&b.nipd)return a.nipd===b.nipd;
 return Boolean(a.lineage_id&&b.lineage_id&&a.lineage_id===b.lineage_id);
}

/** Validate choice against actual master class, not UI-only label. */
export function targetClassForCopy(classes:ClassroomEnrollment[],id:string,schoolId:string,
 year:string,semester:Semester):ClassroomEnrollment{
 const cls=classes.find(c=>c.class_id===id);
 if(!cls||cls.school_id!==schoolId||cls.academic_year!==year||cls.semester!==semester)
  throw new Error('Rombel tujuan tidak sesuai sekolah, Tahun Ajaran, atau Semester.');
 return cls;
}
