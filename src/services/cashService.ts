import { supabase } from '../lib/supabase';
import { imageStorageService } from './imageStorageService';

import type { Denominations, CashDirection, CashTransaction } from '../lib/pettyCashMath';
export * from '../lib/pettyCashMath';
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
  from_status:string;to_status:string;actor_id:string;actor_role:string;actor_name:string;
  comment:string;occurred_at:string;
}
export function cashError(error:unknown):Error {
  if(error instanceof Error)return error;
  const e=error as {code?:string;message?:string;details?:string;status?:number}|null;
  const code=e?.code||'';
  if(['42P01','PGRST205'].includes(code))return new Error('Tabel BKU/Petty Cash belum tersedia di Supabase. Hubungi administrator.');
  if(code==='42501'||e?.status===403)return new Error('Akses ditolak: gunakan akun Bendahara Sekolah yang ditugaskan atau akun Super Admin asli. Simulasi peran tidak mengubah izin server.');
  if(code==='23505')return new Error('Laporan untuk sekolah dan periode ini sudah tercatat. Muat ulang daftar sebelum mengirim kembali.');
  if(code==='23514')return new Error('Data tidak memenuhi validasi keuangan: periksa nominal, pecahan uang, tanggal, dan bukti transaksi.');
  const detail=[e?.message,e?.details].filter(Boolean).join(' — ');
  return new Error(detail||'Gagal menyimpan data. Periksa koneksi dan coba lagi.');
}
function unwrap<T>(data:T[]|null,error:any):T[] {
  if(error)throw cashError(error);
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
      if(error)throw cashError(error);
    }catch(error){await imageStorageService.cleanupImages(images);throw cashError(error);}
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
    });if(error)throw cashError(error);
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
      if(error)throw cashError(error);
    }else{
      const {error}=await supabase.from('arf_cash_reports').insert(payload);
      if(error)throw cashError(error);
    }
  },
  async transition(id:string,decision:'SUBMIT'|'APPROVE'|'RETURN',comment=''):Promise<string>{
    const {data,error}=await supabase.rpc('arf_cash_transition',{
      p_report_id:id,p_decision:decision,p_comment:comment
    });if(error)throw cashError(error);return String(data);
  },
  async listApprovalEvents(schoolId:string):Promise<CashApprovalEvent[]>{
    const {data,error}=await supabase.from('arf_cash_approval_events').select('*').eq('school_id',schoolId)
      .order('occurred_at',{ascending:true});
    return unwrap<CashApprovalEvent>(data as CashApprovalEvent[]|null,error);
  },
  async photoUrl(path:string):Promise<string>{return (await imageStorageService.getImageUrl(path))||'';}
};
