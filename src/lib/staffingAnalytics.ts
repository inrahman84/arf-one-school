import {ClassroomEnrollment,School,Staff,StudentRecord,Semester} from '../types';
export type StaffingNeed={
 school_id:string;school_name:string;regional_id:string;
 students:number;male:number;female:number;classrooms:number;
 activeTeachers:number;indicativeTeachers:number;teacherGap:number;
 unassigned:number;source:'DAPODIK'|'MANUAL'|'NONE';status:'REVIEW'|'READY';
};
/** Management scenario, not a legal teacher staffing standard.
 * Principals are not counted as full-time classroom teachers by default. */
export function estimateTeacherNeeds(
 schools:School[],classes:ClassroomEnrollment[],staff:Staff[],students:StudentRecord[],
 academicYear:string,semester:Semester,targetPerTeacher:number,importedSchoolIds:string[]=[]
):StaffingNeed[]{
 const threshold=Math.max(1,Math.floor(targetPerTeacher));
 return schools.map(s=>{
   const roster=students.filter(x=>x.school_id===s.school_id&&x.academic_year===academicYear&&x.semester===semester);
   const cs=classes.filter(c=>c.school_id===s.school_id&&c.academic_year===academicYear&&c.semester===semester);
   const hasRoster=roster.length>0||importedSchoolIds.includes(s.school_id);
   const male=hasRoster?roster.filter(x=>x.gender==='L').length:cs.reduce((sum,c)=>sum+(c.male_students||0),0);
   const female=hasRoster?roster.filter(x=>x.gender==='P').length:cs.reduce((sum,c)=>sum+(c.female_students||0),0);
   const activeTeachers=staff.filter(t=>t.school_id===s.school_id&&t.employment_status==='Aktif'&&t.staff_category==='Guru').length;
   const classrooms=cs.length;
   const studentsTotal=male+female;
   const needed=studentsTotal?Math.max(classrooms,Math.ceil(studentsTotal/threshold)):0;
   const unassigned=hasRoster?roster.filter(x=>!x.class_id||!cs.some(c=>c.class_id===x.class_id)).length:0;
   return {school_id:s.school_id,school_name:s.school_name,regional_id:s.regional_id,
     students:studentsTotal,male,female,classrooms,activeTeachers,indicativeTeachers:needed,
     teacherGap:Math.max(needed-activeTeachers,0),unassigned,
     source:hasRoster?'DAPODIK':classrooms?'MANUAL':'NONE',
     status:hasRoster&&unassigned===0&&classrooms>0?'READY':'REVIEW'};
 });
}
