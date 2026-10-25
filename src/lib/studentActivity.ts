import {StudentMovement,StudentRecord} from '../types';

/** A Dapodik import is a dated roster snapshot, not a movement history.
 * Only later, explicitly documented events may change effective active counts.
 * Events on snapshot date remain flagged for manual reconciliation, because time order is unknown. */
export function currentRoster(roster:StudentRecord[],events:StudentMovement[]):StudentRecord[]{
 const latestByPerson=new Map<string,StudentMovement>();
 for(const event of events){
   const key=[event.school_id,event.student_id,event.academic_year,event.semester].join('|');
   const old=latestByPerson.get(key);
   if(!old || event.event_date>old.event_date ||
     (event.event_date===old.event_date && event.created_at>old.created_at))latestByPerson.set(key,event);
 }
 return roster.filter(s=>{
   if(s.archived_at)return false;
   const key=[s.school_id,s.student_id,s.academic_year,s.semester].join('|');
   const last=latestByPerson.get(key);
   if(!last || last.event_date<=s.snapshot_date)return true;
   return last.event_type==='TRANSFER_IN';
 });
}
