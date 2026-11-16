import { supabase } from '../lib/supabase';
import { imageStorageService } from './imageStorageService';

export const CASH_DENOMINATIONS = [100000, 75000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50] as const;
export const money = (value: number | string | null | undefined) =>
  'Rp ' + Number(value || 0).toLocaleString('id-ID');

export const formatDate = (value: string) => {
  if (!value) return '-';
  const d = new Date(value.slice(0, 10) + 'T00:00:00Z');
  return d.toLocaleDateString('id-ID', {day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'});
};

export function wibToday(): string {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'})
    .formatToParts(new Date());
  const v = (key:string) => parts.find(p=>p.type===key)?.value || '';
  return [v('year'),v('month'),v('day')].join('-');
}
export function lastFriday(): string {
  const today=wibToday();const date=new Date(today+'T00:00:00Z');
  const days=(date.getUTCDay()+2)%7; // Friday=0, Saturday=1, Sunday=2
  date.setUTCDate(date.getUTCDate()-days);
  return date.toISOString().slice(0,10);
}
export function periodFor(endMonth:string):{start:string,end:string} {
  if(!/^\d{4}-\d{2}$/.test(endMonth)) throw new Error('Bulan LPJ tidak valid');
  const [year,month]=endMonth.split('-').map(Number);
  const end=new Date(Date.UTC(year,month-1,20));
  const start=new Date(Date.UTC(year,month-2,21));
  return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
export type Denominations=Record<string,number>;
export const emptyDenominations=():Denominations=>
  Object.fromEntries(CASH_DENOMINATIONS.map(n=>[String(n),0]));
export function countCash(denominations:Denominations):number {
  return CASH_DENOMINATIONS.reduce((sum,unit)=>sum+unit*Number(denominations[String(unit)]||0),0);
}
export function totalPhysical(denominations:Denominations,bank:number,damaged:number,stamps:number,unposted:number):number {
  return countCash(denominations)+bank+damaged+stamps+unposted;
}
export type CashDirection='IN'|'OUT';
export interface CashTransaction {
  id:string;school_id:string;transaction_date:string;description:string;direction:CashDirection;
  amount:number;item_photo_path:string;receipt_photo_path:string;notes:string;
  created_at:string;created_by:string;
}
export interface CashWeeklyCount {
  id:string;school_id:string;week_ending:string;denominations:Denominations;
  bank_balance:number;damaged_cash:number;stamps_value:number;unposted_value:number;
  physical_total:number;ledger_balance:number;variance:number;receipts_verified:boolean;
  notes:string;submitted_at:string;submitted_by:string;
}
export type CashReportStatus='DRAFT'|'PENDING_PRINCIPAL'|'PENDING_HEAD_TU'|
  'PENDING_MANAGER'|'APPROVED'|'RETURNED';
export interface CashReport {
  id:string;school_id:string;period_start:string;period_end:string;count_date:string;
  denominations:Denominations;bank_balance:number;damaged_cash:number;stamps_value:number;
  unposted_value:number;reimbursement_pending:number;physical_total:number;
  book_balance_at_count:number;variance:number;notes:string;status:CashReportStatus;
  submitted_by:string;created_at:string;updated_at:string;
}
export interface CashApprovalEvent {
  id:number;report_id:string;school_id:string;action:'SUBMIT'|'RESUBMIT'|'APPROVE'|'RETURN';
  from_status:string;to_status:string;actor_id:string;actor_role:string;
  comment:string;occurred_at:string;
}
export function ledgerBalance(transactions:CashTransaction[],throughDate:string):number {
  return transactions.filter(t=>t.transaction_date<=throughDate)
    .reduce((sum,t)=>sum+(t.direction==='IN'?t.amount:-t.amount),0);
}
export function reportSummary(transactions:CashTransaction[],start:string,end:string) {
  const opening = transactions.filter(t=>t.transaction_date<start)
    .reduce((sum,t)=>sum+(t.direction==='IN'?t.amount:-t.amount),0);
  const inPeriod=transactions.filter(t=>t.transaction_date>=start&&t.transaction_date<=end)
    .sort((a,b)=>a.transaction_date.localeCompare(b.transaction_date)||a.created_at.localeCompare(b.created_at));
  let balance=opening;
  const rows=inPeriod.map(t=>({transaction:t,balance:(balance+=t.direction==='IN'?t.amount:-t.amount)}));
  const debit=inPeriod.filter(t=>t.direction==='IN').reduce((s,t)=>s+t.amount,0);
  const credit=inPeriod.filter(t=>t.direction==='OUT').reduce((s,t)=>s+t.amount,0);
  return {opening,rows,debit,credit,totalFunds:opening+debit,closing:opening+debit-credit};
}
function unwrap<T>(data:T[]|null,error:any):T[] {
  if(error)throw new Error(error.message || String(error));
  return data||[];
}
export const cashService={
  async listTransactions(schoolId:string):Promise<CashTransaction[]>{
    const {data,error}=await supabase.from('arf_cash_transactions').select('*').eq('school_id',schoolId)
      .order('transaction_date',{ascending:true}).order('created_at',{ascending:true});
    return unwrap<CashTransaction>(data as CashTransaction[]|null,error);
  },
  async addTransaction(input:{
    schoolId:string;date:string;description:string;direction:CashDirection;amount:number;
    itemFile:File;receiptFile:File;notes:string;
  }):Promise<void>{
    const recordId=crypto.randomUUID();const images:string[]=[];
    try{
      const item=await imageStorageService.uploadImage(input.itemFile,input.schoolId,'petty-cash',recordId,'item');
      images.push(item.path);
      const receipt=await imageStorageService.uploadImage(input.receiptFile,input.schoolId,'petty-cash',recordId,'receipt');
      images.push(receipt.path);
      const {error}=await supabase.from('arf_cash_transactions').insert({
        id:recordId,school_id:input.schoolId,transaction_date:input.date,
        description:input.description.trim(),direction:input.direction,
        amount:input.amount,item_photo_path:item.path,receipt_photo_path:receipt.path,
        notes:input.notes.trim()
      });
      if(error)throw error;
    }catch(error){await imageStorageService.cleanupImages(images);throw error;}
  },
  async listWeekly(schoolId:string):Promise<CashWeeklyCount[]>{
    const {data,error}=await supabase.from('arf_cash_weekly_counts').select('*').eq('school_id',schoolId)
      .order('week_ending',{ascending:false});
    return unwrap<CashWeeklyCount>(data as CashWeeklyCount[]|null,error);
  },
  async submitWeekly(input:{
    schoolId:string;friday:string;denominations:Denominations;
    bank:number;damaged:number;stamps:number;unposted:number;notes:string;
  }):Promise<void>{
    const {error}=await supabase.from('arf_cash_weekly_counts').insert({
      school_id:input.schoolId,week_ending:input.friday,denominations:input.denominations,
      bank_balance:input.bank,damaged_cash:input.damaged,stamps_value:input.stamps,
      unposted_value:input.unposted,notes:input.notes,receipts_verified:true
    });if(error)throw error;
  },
  async listReports(schoolId:string):Promise<CashReport[]>{
    const {data,error}=await supabase.from('arf_cash_reports').select('*').eq('school_id',schoolId)
      .order('period_end',{ascending:false});
    return unwrap<CashReport>(data as CashReport[]|null,error);
  },
  async saveDraft(input:{
    id?:string;schoolId:string;start:string;end:string;countDate:string;
    denominations:Denominations;bank:number;damaged:number;stamps:number;unposted:number;
    reimbursement:number;notes:string;
  }):Promise<void>{
    const payload={school_id:input.schoolId,period_start:input.start,period_end:input.end,
      count_date:input.countDate,denominations:input.denominations,
      bank_balance:input.bank,damaged_cash:input.damaged,stamps_value:input.stamps,
      unposted_value:input.unposted,reimbursement_pending:input.reimbursement,notes:input.notes,
      status:'DRAFT' as const};
    if(input.id){
      const {error}=await supabase.from('arf_cash_reports').update(payload).eq('id',input.id);
      if(error)throw error;
    }else{
      const {error}=await supabase.from('arf_cash_reports').insert(payload);
      if(error)throw error;
    }
  },
  async transition(id:string,decision:'SUBMIT'|'APPROVE'|'RETURN',comment=''):Promise<string>{
    const {data,error}=await supabase.rpc('arf_cash_transition',{
      p_report_id:id,p_decision:decision,p_comment:comment
    });if(error)throw error;return String(data);
  },
  async listApprovalEvents(schoolId:string):Promise<CashApprovalEvent[]>{
    const {data,error}=await supabase.from('arf_cash_approval_events').select('*').eq('school_id',schoolId)
      .order('occurred_at',{ascending:true});
    return unwrap<CashApprovalEvent>(data as CashApprovalEvent[]|null,error);
  },
  async photoUrl(path:string):Promise<string>{return (await imageStorageService.getImageUrl(path))||'';}
};
