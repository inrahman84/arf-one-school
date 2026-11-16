import { supabase } from '../lib/supabase';
import { imageStorageService } from './imageStorageService';

import type { Denominations, CashDirection, CashTransaction } from '../lib/pettyCashMath';
export * from '../lib/pettyCashMath';
export interface CashAttachment {
  id:string; transaction_id:string; school_id:string; kind:'ITEM'|'RECEIPT';
  display_name:string; file_path:string; sort_order:number;
}
export interface NamedCashPhoto { file:File; name:string; }
export function transactionAttachments(t:CashTransaction):CashAttachment[] {
  const existing=(t as CashTransaction & {attachments?:CashAttachment[]}).attachments;
  if(existing?.length)return [...existing].sort((a,b)=>a.kind.localeCompare(b.kind)||a.sort_order-b.sort_order);
  return [
    {id:t.id+'-legacy-item',transaction_id:t.id,school_id:t.school_id,kind:'ITEM' as const,
      display_name:'Foto Item / Kegiatan',file_path:t.item_photo_path,sort_order:1},
    {id:t.id+'-legacy-receipt',transaction_id:t.id,school_id:t.school_id,kind:'RECEIPT' as const,
      display_name:'Kuitansi / Nota',file_path:t.receipt_photo_path,sort_order:1}
  ].filter(v=>v.file_path);
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
    const [txResult,attachmentResult]=await Promise.all([
      supabase.from('arf_cash_transactions').select('*').eq('school_id',schoolId)
        .order('transaction_date',{ascending:true}).order('created_at',{ascending:true}),
      supabase.from('arf_cash_transaction_attachments').select('*').eq('school_id',schoolId)
        .order('sort_order',{ascending:true})
    ]);
    const transactions=unwrap<CashTransaction>(txResult.data as CashTransaction[]|null,txResult.error);
    const attachments=unwrap<CashAttachment>(attachmentResult.data as CashAttachment[]|null,attachmentResult.error);
    const byTransaction=new Map<string,CashAttachment[]>();
    for(const attachment of attachments){
      const list=byTransaction.get(attachment.transaction_id)||[];
      list.push(attachment);
      byTransaction.set(attachment.transaction_id,list);
    }
    return transactions.map(t=>({...t,attachments:byTransaction.get(t.id)||[]}));
  },
  async addTransaction(input:{
    schoolId:string;date:string;description:string;direction:CashDirection;amount:number;
    itemPhotos:NamedCashPhoto[];receiptPhotos:NamedCashPhoto[];notes:string;
  }):Promise<void>{
    if(!input.itemPhotos.length||!input.receiptPhotos.length)
      throw new Error('Minimal satu foto item dan satu foto kuitansi wajib dilampirkan.');
    if(input.itemPhotos.length>12||input.receiptPhotos.length>12)
      throw new Error('Maksimal 12 foto per kategori untuk setiap transaksi BKU.');
    const photos=[...input.itemPhotos,...input.receiptPhotos];
    for(const photo of photos){
      if(!photo.name.trim()||photo.name.trim().length>150)
        throw new Error('Setiap foto wajib memiliki nama 1–150 karakter.');
    }
    const recordId=crypto.randomUUID();
    const uploadedPaths:string[]=[];
    let saved=false;
    try{
      const uploadGroup=async(group:NamedCashPhoto[],type:'item'|'receipt')=>{
        const uploaded:{path:string;name:string}[]=[];
        for(const photo of group){
          const file=await imageStorageService.uploadImage(photo.file,input.schoolId,'petty-cash',recordId,type);
          uploadedPaths.push(file.path);
          uploaded.push({path:file.path,name:photo.name.trim()});
        }
        return uploaded;
      };
      const items=await uploadGroup(input.itemPhotos,'item');
      const receipts=await uploadGroup(input.receiptPhotos,'receipt');
      // RPC creates both the BKU entry and all named evidence atomically.
      const {error}=await supabase.rpc('arf_cash_create_transaction',{
        p_id:recordId,p_school_id:input.schoolId,p_transaction_date:input.date,
        p_description:input.description.trim(),p_direction:input.direction,
        p_amount:input.amount,p_notes:input.notes.trim(),
        p_items:items,p_receipts:receipts
      });
      if(error)throw cashError(error);
      saved=true;
    }catch(error){
      // If the server committed the RPC but the response was lost, do not
      // remove image files already referenced by the saved transaction.
      if(!saved){
        const check=await supabase.from('arf_cash_transactions')
          .select('id').eq('id',recordId).maybeSingle();
        if(!check.error&&check.data?.id===recordId)return;
        await imageStorageService.cleanupImages(uploadedPaths);
      }
      throw cashError(error);
    }
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
