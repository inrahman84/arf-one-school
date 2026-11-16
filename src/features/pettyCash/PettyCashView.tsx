import React,{useEffect,useMemo,useState} from 'react';
import {School} from '../../types';
import {useAuth} from '../../context/AuthContext';
import {cashService,CASH_DENOMINATIONS,emptyDenominations,periodFor,lastFriday,wibToday,
 money,formatDate,ledgerBalance,reportSummary,totalPhysical,CashTransaction,CashWeeklyCount,CashReport,
 CashApprovalEvent,Denominations,CashDirection,CashVoidRecord,transactionAttachments} from '../../services/cashService';
import {CashPrint} from './CashPrint';
import {CashPhotoPicker,SelectedCashPhoto} from './CashPhotoPicker';
import {RupiahField} from './RupiahField';
import {Plus,Trash2,X,History} from 'lucide-react';

type Tab='BKU'|'WEEKLY'|'MONTHLY';
type CountForm={denominations:Denominations;bank:number;damaged:number;stamps:number;unposted:number;notes:string};
const emptyCount=():CountForm=>({denominations:emptyDenominations(),bank:0,damaged:0,stamps:0,unposted:0,notes:''});
const cls='w-full border rounded-lg px-3 py-2 text-sm bg-white';
const primary='rounded-lg px-4 py-2 text-sm font-semibold bg-[#073b2d] text-white disabled:opacity-40';
const secondary='rounded-lg px-3 py-2 text-xs font-semibold border border-[#073b2d] text-[#073b2d]';
const statusLabel:Record<string,string>={DRAFT:'Draft',RETURNED:'Dikembalikan',PENDING_PRINCIPAL:'Menunggu Kepala Sekolah',
 PENDING_HEAD_TU:'Menunggu Kepala TU ARF',PENDING_MANAGER:'Menunggu Manager ARF',APPROVED:'Disetujui'};
const num=(n:number)=>Number.isFinite(n)&&n>=0?Math.floor(n):0;
const CountFields:React.FC<{form:CountForm;change:(v:CountForm)=>void}>=({form,change})=>{
 const patch=(p:Partial<CountForm>)=>change({...form,...p});
 return <div className="space-y-3">
  <h4 className="font-semibold">Perhitungan Fisik Uang Tunai</h4>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
   {CASH_DENOMINATIONS.map(d=><label key={d} className="text-xs">{money(d)} ({d>=1000?'Lbr':'Koin'})
    <input type="text" inputMode="numeric" pattern="[0-9]*" className={cls} value={form.denominations[String(d)]||''}
     placeholder="0" onChange={e=>patch({denominations:{...form.denominations,[String(d)]:num(Number(e.target.value.replace(/\D/g,'')))}})}/></label>)}
  </div>
  <div className="grid sm:grid-cols-2 gap-3">
   {([['Saldo Bank','bank'],['Uang Rusak','damaged'],['Materai','stamps'],['Belum Dibukukan','unposted']] as const)
    .map(([title,key])=><RupiahField key={key} label={title} value={form[key]}
      onChange={v=>patch({[key]:v})}/>)}
  </div>
  <label className="block text-xs">Catatan / Penjelasan Selisih
   <textarea className={cls} rows={2} value={form.notes} onChange={e=>patch({notes:e.target.value})}/></label>
 </div>;
};
export const PettyCashView:React.FC<{schools:School[]}>=({schools})=>{
 const {effectiveRole,userProfile}=useAuth();
 const global=['SUPER_ADMIN','FOUNDATION_MANAGER','ARF_HEAD_TU'].includes(userProfile?.role||'');
 const allowed=useMemo(()=>global?schools:schools.filter(s=>
  ['SCHOOL_TREASURER','SCHOOL_PRINCIPAL'].includes(userProfile?.role||'')&&
   (userProfile?.assignedSchools||[]).includes(s.school_id)),[schools,global,effectiveRole,userProfile?.assignedSchools]);
 const [schoolId,setSchoolId]=useState('');const [tab,setTab]=useState<Tab>('BKU');
 const [transactions,setTransactions]=useState<CashTransaction[]>([]);
 const [weekly,setWeekly]=useState<CashWeeklyCount[]>([]);
 const [reports,setReports]=useState<CashReport[]>([]);
 const [events,setEvents]=useState<CashApprovalEvent[]>([]);
 const [voidHistory,setVoidHistory]=useState<CashVoidRecord[]>([]);
 const [showAddModal,setShowAddModal]=useState(false);
 const [deleteTarget,setDeleteTarget]=useState<CashTransaction|null>(null);
 const [deleteReason,setDeleteReason]=useState('');
 const [showVoidHistory,setShowVoidHistory]=useState(false);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 const [date,setDate]=useState(wibToday());const [description,setDescription]=useState('');
 const [type,setType]=useState<CashDirection>('OUT');const [amount,setAmount]=useState(0);const [note,setNote]=useState('');
 const [itemPhotos,setItemPhotos]=useState<SelectedCashPhoto[]>([]);
 const [receiptPhotos,setReceiptPhotos]=useState<SelectedCashPhoto[]>([]);const [friday,setFriday]=useState(lastFriday());
 const [weeklyForm,setWeeklyForm]=useState<CountForm>(emptyCount);const [receiptsVerified,setReceiptsVerified]=useState(false);
 const [month,setMonth]=useState(wibToday().slice(0,7));const period=useMemo(()=>periodFor(month),[month]);
 const [countDate,setCountDate]=useState(period.end);const [monthForm,setMonthForm]=useState<CountForm>(emptyCount);
 const [reimbursement,setReimbursement]=useState(0);const [editingId,setEditingId]=useState('');
 const [previewId,setPreviewId]=useState('');const [photoUrls,setPhotoUrls]=useState<Record<string,string>>({});
 const [photosLoading,setPhotosLoading]=useState(false);const [returnReason,setReturnReason]=useState('');
 const isTreasurer=['SCHOOL_TREASURER','SUPER_ADMIN'].includes(userProfile?.role||'');
 const school=allowed.find(s=>s.school_id===schoolId);
 useEffect(()=>{if(!allowed.some(s=>s.school_id===schoolId))setSchoolId(allowed[0]?.school_id||'');},[allowed,schoolId]);
 const refresh=async()=>{
  if(!schoolId)return;
  try{
   const [t,w,r,e,v]=await Promise.all([cashService.listTransactions(schoolId),
    cashService.listWeekly(schoolId),cashService.listReports(schoolId),
    cashService.listApprovalEvents(schoolId),cashService.listVoidedTransactions(schoolId)]);
   setTransactions(t);setWeekly(w);setReports(r);setEvents(e);setVoidHistory(v);
  }catch(e){setError(e instanceof Error?e.message:String(e));}
 };
 useEffect(()=>{setTransactions([]);setWeekly([]);setReports([]);setVoidHistory([]);setPreviewId('');setShowAddModal(false);setDeleteTarget(null);void refresh();},[schoolId]);
 const act=async(action:()=>Promise<void>,success:string)=>{
  setError('');setMessage('');setBusy(true);
  try{await action();setMessage(success);await refresh();}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 const canDeleteTransaction=(t:CashTransaction)=>
   !weekly.some(w=>w.week_ending>=t.transaction_date) &&
   !reports.some(r=>r.period_end>=t.transaction_date);
 useEffect(()=>{
  if(!showAddModal&&!deleteTarget)return;
  const handleEscape=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&!busy){
    setShowAddModal(false);setDeleteTarget(null);setDeleteReason('');
   }
  };
  window.addEventListener('keydown',handleEscape);
  return ()=>window.removeEventListener('keydown',handleEscape);
 },[showAddModal,deleteTarget,busy]);
 const confirmDelete=()=>{
  const target=deleteTarget;
  if(!target||busy)return;
  if(deleteReason.trim().length<10){
   setError('Alasan penghapusan wajib minimal 10 karakter.');
   return;
  }
  void act(async()=>{
   await cashService.voidTransaction(target.id,deleteReason);
   setDeleteTarget(null);setDeleteReason('');
  },'Transaksi berhasil dihapus dari BKU aktif dan tercatat dalam riwayat audit.');
 };
 const activeReport=reports.find(r=>r.id===previewId);
 useEffect(()=>{
  let cancelled=false;
  if(!activeReport){setPhotoUrls({});return;}
  const paths=[...new Set(transactions.filter(t=>t.transaction_date>=activeReport.period_start&&
   t.transaction_date<=activeReport.period_end).flatMap(t=>transactionAttachments(t).map(p=>p.file_path)))];
  setPhotosLoading(true);
  void Promise.all(paths.map(async p=>[p,await cashService.photoUrl(p)] as const)).then(pairs=>{
   if(!cancelled)setPhotoUrls(Object.fromEntries(pairs));
  }).catch(e=>{if(!cancelled)setError(String(e));}).finally(()=>{if(!cancelled)setPhotosLoading(false);});
  return ()=>{cancelled=true;};
 },[activeReport?.id,transactions]);
 const openPhoto=async(path:string)=>{
  try{const url=await cashService.photoUrl(path);if(!url)throw Error('Bukti tidak dapat dibuka.');
   window.open(url,'_blank','noopener,noreferrer');}
  catch(e){setError(e instanceof Error?e.message:String(e));}
 };
 const saveTransaction=(e:React.FormEvent)=>{
  e.preventDefault();
  if(!schoolId||!isTreasurer||!itemPhotos.length||!receiptPhotos.length){setError('Minimal satu foto item dan satu foto nota wajib diunggah.');return;}
  if([...itemPhotos,...receiptPhotos].some(p=>!p.name.trim())){setError('Setiap foto harus diberi nama.');return;}
  if(!Number.isSafeInteger(amount)||amount<=0){setError('Nominal harus berupa Rupiah positif.');return;}
  void act(async()=>{
   await cashService.addTransaction({schoolId,date,description,direction:type,amount,
    itemPhotos:itemPhotos.map(({file,name})=>({file,name})),
    receiptPhotos:receiptPhotos.map(({file,name})=>({file,name})),notes:note});
   setDescription('');setAmount(0);setNote('');setItemPhotos([]);setReceiptPhotos([]);
  },'Transaksi BKU dan seluruh foto bukti berhasil disimpan.');
 };
 const weeklyLedger=ledgerBalance(transactions,friday);
 const weeklyPhysical=totalPhysical(weeklyForm.denominations,weeklyForm.bank,weeklyForm.damaged,weeklyForm.stamps,weeklyForm.unposted);
 const monthLedger=ledgerBalance(transactions,countDate);
 const monthPhysical=totalPhysical(monthForm.denominations,monthForm.bank,monthForm.damaged,monthForm.stamps,monthForm.unposted);
 const selectedWeekly=weekly.find(w=>w.week_ending===friday);
 const edit=(r:CashReport)=>{
  setMonth(r.period_end.slice(0,7));setEditingId(r.id);setCountDate(r.count_date);
  setMonthForm({denominations:{...emptyDenominations(),...r.denominations},bank:r.bank_balance,
   damaged:r.damaged_cash,stamps:r.stamps_value,unposted:r.unposted_value,notes:r.notes});
  setReimbursement(r.reimbursement_pending);setPreviewId(r.id);
 };
 const saveReport=()=>void act(async()=>{
  await cashService.saveDraft({id:editingId||undefined,schoolId,start:period.start,end:period.end,
   countDate,denominations:monthForm.denominations,bank:monthForm.bank,damaged:monthForm.damaged,
   stamps:monthForm.stamps,unposted:monthForm.unposted,reimbursement,notes:monthForm.notes});
 },'Draft LPJ dan cash opname bulanan berhasil disimpan.');
 const transition=(r:CashReport,decision:'SUBMIT'|'APPROVE'|'RETURN')=>{
  if(decision==='RETURN'&&returnReason.trim().length<5){setError('Tuliskan alasan pengembalian sedikitnya 5 karakter.');return;}
  void act(async()=>{await cashService.transition(r.id,decision,returnReason);setReturnReason('');},'Status approval berhasil diperbarui.');
 };
 const canApprove=(r:CashReport)=>
  (r.status==='PENDING_PRINCIPAL'&&effectiveRole==='SCHOOL_PRINCIPAL')||
  (r.status==='PENDING_HEAD_TU'&&effectiveRole==='ARF_HEAD_TU')||
  (r.status==='PENDING_MANAGER'&&effectiveRole==='FOUNDATION_MANAGER');
 return <div className="space-y-5">
  <section className="p-4 border rounded-xl bg-white space-y-3">
   <h2 className="font-bold text-lg text-[#073b2d]">BKU &amp; Petty Cash Sekolah</h2>
   <p className="text-xs text-gray-600">BKU harian, penghitungan Jumat (cut-off 17.00 WIB), laporan Sabtu (17.00 WIB), dan LPJ periode tanggal 21 sampai 20.</p>
   <label className="block text-xs font-semibold">Sekolah
    <select className={cls} value={schoolId} onChange={e=>{setSchoolId(e.target.value);setEditingId('');}}>
     {allowed.length===0?<option value="">Tidak ada sekolah yang dapat diakses</option>:
      allowed.map(s=><option key={s.school_id} value={s.school_id}>{s.school_name}</option>)}
    </select></label>
   <div className="flex gap-2 flex-wrap">
    {([['BKU','BKU Harian'],['WEEKLY','Cash Opname Mingguan'],['MONTHLY','Berita Acara & LPJ Bulanan']] as [Tab,string][])
     .map(([key,text])=><button key={key} className={tab===key?primary:secondary}
       onClick={()=>setTab(key)}>{text}</button>)}
   </div>
  </section>
  {error&&<p role="alert" className="p-3 rounded bg-red-50 border border-red-200 text-red-800 text-sm">{error}</p>}
  {message&&<p role="status" className="p-3 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{message}</p>}
  {!school&&<p className="text-sm">Pilih sekolah yang berwenang diakses.</p>}
  {school&&tab==='BKU'&&<div className="space-y-4">
   {!isTreasurer&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Pencatatan BKU hanya dapat dilakukan oleh akun Bendahara Sekolah yang ditugaskan atau Super Admin asli. Simulasi peran di header tidak mengubah izin Supabase.</p>}
   {isTreasurer&&<div className="flex items-center justify-between flex-wrap gap-2">
    <button type="button" className={primary+' flex items-center gap-2'} disabled={busy}
      onClick={()=>{setError('');setShowAddModal(true);}}>
      <Plus size={17}/>Tambah Transaksi
    </button>
    <button type="button" className={secondary+' flex items-center gap-1'} onClick={()=>setShowVoidHistory(v=>!v)}>
      <History size={16}/>{showVoidHistory?'Tutup Riwayat Hapus':'Riwayat Hapus ('+voidHistory.length+')'}
    </button>
   </div>}
   <section className="bg-white border rounded-xl p-3 sm:p-4 min-w-0">
    <h3 className="font-semibold mb-3 text-[#073b2d]">BKU {school.school_name}</h3>
    <p className="text-xs text-gray-500 mb-3">Pada ponsel dan tablet, setiap transaksi disusun menjadi kartu agar nominal dan bukti mudah dibaca. Pada desktop, gunakan tampilan tabel yang dapat digulir mendatar apabila diperlukan.</p>
    <div className="hidden lg:block w-full overflow-x-auto rounded-lg border border-gray-200">
     <table className="w-full min-w-[1120px] text-xs border-collapse">
      <thead className="bg-[#f6f3ec]"><tr>
       {['No','Tanggal','Uraian','Debet','Kredit','Saldo','Keterangan','Lampiran'].map(h=><th className="border-b p-3 text-left whitespace-nowrap" key={h}>{h}</th>)}
      </tr></thead><tbody>
       {reportSummary(transactions,'1900-01-01','9999-12-31').rows.map(({transaction:t,balance},i)=>
        <tr className="align-top border-b last:border-b-0 hover:bg-gray-50" key={t.id}>
         <td className="p-3">{i+1}</td>
         <td className="p-3 whitespace-nowrap">{formatDate(t.transaction_date)}</td>
         <td className="p-3 min-w-[160px] max-w-[240px] break-words">{t.description}</td>
         <td className="p-3 whitespace-nowrap tabular-nums">{t.direction==='IN'?money(t.amount):'-'}</td>
         <td className="p-3 whitespace-nowrap tabular-nums">{t.direction==='OUT'?money(t.amount):'-'}</td>
         <td className="p-3 whitespace-nowrap tabular-nums font-semibold">{money(balance)}</td>
         <td className="p-3 min-w-[120px] max-w-[210px] break-words">{t.notes?.trim()||'-'}</td>
         <td className="p-3 min-w-[170px]">
          <div className="flex flex-col gap-1">
           {transactionAttachments(t).map(a=><button type="button" key={a.id}
            className="text-left underline text-blue-700 break-words hover:text-blue-900"
            title={a.kind==='ITEM'?'Foto Item / Kegiatan':'Foto Kuitansi / Nota'}
            onClick={()=>void openPhoto(a.file_path)}>{a.kind==='ITEM'?'Item':'Nota'}: {a.display_name}</button>)}
          </div>
         </td>
        </tr>)}
      </tbody>
     </table>
    </div>
    <div className="lg:hidden space-y-3">
     {reportSummary(transactions,'1900-01-01','9999-12-31').rows.map(({transaction:t,balance},i)=>
       <article key={t.id} className="rounded-xl border border-gray-200 bg-white p-3 space-y-3 min-w-0">
        <div className="flex flex-wrap justify-between gap-2 items-start border-b pb-2">
         <strong className="text-sm text-[#073b2d]">#{i+1} — {formatDate(t.transaction_date)}</strong>
         <span className={t.direction==='IN'?'text-xs font-semibold text-emerald-700':'text-xs font-semibold text-amber-700'}>{t.direction==='IN'?'Penerimaan':'Pengeluaran'}</span>
        </div>
        <p className="text-sm font-medium break-words">{t.description}</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
         <div><span className="text-gray-500">Debet</span><p className="font-semibold tabular-nums">{t.direction==='IN'?money(t.amount):'-'}</p></div>
         <div><span className="text-gray-500">Kredit</span><p className="font-semibold tabular-nums">{t.direction==='OUT'?money(t.amount):'-'}</p></div>
         <div className="col-span-2 rounded-lg bg-[#f6f3ec] p-2">
          <span className="text-gray-500">Saldo</span><p className="font-bold text-[#073b2d] tabular-nums">{money(balance)}</p>
         </div>
        </div>
        <div className="text-xs"><span className="text-gray-500">Keterangan</span>
         <p className="mt-1 whitespace-pre-wrap break-words">{t.notes?.trim()||'-'}</p></div>
        <div className="text-xs"><span className="text-gray-500">Lampiran</span>
         <div className="flex flex-wrap gap-2 mt-2">
          {transactionAttachments(t).map(a=><button type="button" key={a.id}
           className="rounded-lg border border-[#3f6276] px-2 py-1.5 text-[#073b2d] text-left break-words"
           onClick={()=>void openPhoto(a.file_path)}>{a.kind==='ITEM'?'Item':'Nota'}: {a.display_name}</button>)}
         </div>
        </div>
       </article>)}
    </div>
    {transactions.length===0&&<p className="py-6 text-center text-xs text-gray-500">Belum ada transaksi BKU pada sekolah ini.</p>}
    <p className="text-sm font-semibold mt-4 rounded-lg bg-[#f6f3ec] p-3">Saldo Akhir BKU: {money(ledgerBalance(transactions,'9999-12-31'))}</p>
   </section>
   {isTreasurer&&showVoidHistory&&<section className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
    <h3 className="font-semibold text-[#073b2d]">Riwayat Penghapusan BKU (Audit)</h3>
    {voidHistory.length===0?<p className="text-xs text-gray-500">Belum ada transaksi yang dihapus.</p>:
     voidHistory.map(v=><article key={v.transaction_id} className="rounded-lg border p-3 text-xs space-y-1">
      <p className="font-semibold">{formatDate(v.transaction_snapshot.transaction_date)} — {v.transaction_snapshot.description}</p>
      <p>Nominal: {money(v.transaction_snapshot.amount)}</p>
      <p>Alasan: {v.reason}</p>
      <p className="text-gray-500">Dihapus: {new Date(v.voided_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB · Akun: {v.voided_by}</p>
     </article>)}
   </section>}
   {showAddModal&&isTreasurer&&<div role="presentation" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-2 sm:p-4"
     onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setShowAddModal(false);}}>
    <section role="dialog" aria-modal="true" aria-labelledby="bku-add-title"
      className="flex flex-col w-full max-w-4xl max-h-[94vh] rounded-2xl bg-white shadow-2xl overflow-hidden">
     <header className="flex justify-between items-center gap-3 px-4 sm:px-6 py-4 border-b shrink-0">
      <div><h3 id="bku-add-title" className="font-bold text-[#073b2d]">Tambah Transaksi Buku Kas Umum</h3>
       <p className="text-xs text-gray-500">{school.school_name}</p></div>
      <button type="button" disabled={busy} aria-label="Tutup formulir"
       className="rounded-lg border p-2 disabled:opacity-40" onClick={()=>setShowAddModal(false)}><X size={18}/></button>
     </header>
     <div className="overflow-y-auto min-h-0">
      {error&&<p role="alert" className="m-4 mb-0 rounded-lg bg-red-50 p-3 text-xs text-red-800">{error}</p>}
    <form id="cash-bku-add-form" className="p-4 sm:p-6 space-y-3" onSubmit={saveTransaction}>
    <h3 className="font-semibold">Tambah Transaksi Buku Kas Umum</h3>
    {userProfile?.role==='SUPER_ADMIN'&&<p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2">Mode administrator: catatan baru akan tersimpan sebagai transaksi nyata dan dapat diaudit. Gunakan akun Bendahara untuk operasional rutin.</p>}
    <div className="grid sm:grid-cols-3 gap-3">
     <label className="text-xs">Tanggal Transaksi<input type="date" required max={wibToday()} className={cls}
      value={date} onChange={e=>setDate(e.target.value)}/></label>
     <label className="text-xs">Jenis Transaksi<select className={cls} value={type}
      onChange={e=>setType(e.target.value as CashDirection)}><option value="OUT">Pengeluaran (Kredit)</option>
      <option value="IN">Penerimaan (Debet)</option></select></label>
     <RupiahField label="Jumlah Transaksi" required value={amount} onChange={setAmount}/>
    </div>
    <label className="block text-xs">Uraian / Keterangan Transaksi<input required minLength={3}
     className={cls} value={description} onChange={e=>setDescription(e.target.value)}/></label>
    <div className="grid lg:grid-cols-2 gap-3 items-start min-w-0">
     <CashPhotoPicker title="Foto Item / Kegiatan" photos={itemPhotos} onChange={setItemPhotos} onError={setError}/>
     <CashPhotoPicker title="Foto Kuitansi / Nota" photos={receiptPhotos} onChange={setReceiptPhotos} onError={setError}/>
    </div>
    <p className="text-xs text-gray-600">Pilih beberapa foto sekaligus, beri nama masing-masing, dan periksa sebelum menyimpan. Penghapusan memerlukan alasan dan jejak audit; transaksi yang sudah masuk opname atau LPJ tidak dapat dihapus.</p>
    <label className="block text-xs">Keterangan<textarea className={cls} value={note}
     onChange={e=>setNote(e.target.value)}/></label>
    <button className={primary} type="submit" disabled={busy||!itemPhotos.length||!receiptPhotos.length}>Simpan BKU &amp; Bukti</button>
    </form>
     </div>
     <footer className="flex justify-end gap-2 px-4 sm:px-6 py-3 border-t shrink-0">
      <button type="button" className={secondary} disabled={busy} onClick={()=>setShowAddModal(false)}>Batal</button>
      <button type="submit" form="cash-bku-add-form" className={primary} disabled={busy||!itemPhotos.length||!receiptPhotos.length}>
       {busy?'Menyimpan...':'Simpan Transaksi'}
      </button>
     </footer>
    </section>
   </div>}
   {deleteTarget&&isTreasurer&&<div role="presentation" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-3"
     onMouseDown={e=>{if(e.target===e.currentTarget&&!busy){setDeleteTarget(null);setDeleteReason('');}}}>
    <section role="alertdialog" aria-modal="true" aria-labelledby="bku-delete-title" aria-describedby="bku-delete-description"
      className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl space-y-4">
     <h3 id="bku-delete-title" className="font-bold text-red-800">Hapus Transaksi BKU?</h3>
     <p id="bku-delete-description" className="text-sm text-gray-700">Transaksi di bawah akan dikeluarkan dari perhitungan saldo BKU aktif. Riwayat dan foto bukti tetap disimpan sebagai arsip audit.</p>
     <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
      <p>{formatDate(deleteTarget.transaction_date)}</p><p className="font-semibold break-words">{deleteTarget.description}</p>
      <p className="font-bold">{money(deleteTarget.amount)}</p>
     </div>
     <label className="block text-xs font-semibold">Alasan penghapusan (wajib, minimal 10 karakter)
      <textarea value={deleteReason} maxLength={500} minLength={10} required rows={3}
       onChange={e=>setDeleteReason(e.target.value)} placeholder="Contoh: Duplikasi pencatatan transaksi tanggal ..."
       className={cls+' mt-2'}/>
     </label>
     {error&&<p className="text-xs text-red-700" role="alert">{error}</p>}
     <div className="flex justify-end flex-wrap gap-2">
      <button className={secondary} type="button" disabled={busy} onClick={()=>{setDeleteTarget(null);setDeleteReason('');}}>Batal</button>
      <button className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" type="button"
       disabled={busy||deleteReason.trim().length<10}
       onClick={confirmDelete}>{busy?'Memproses...':'Ya, Hapus Transaksi'}</button>
     </div>
    </section>
   </div>}
  </div>}
  {school&&tab==='WEEKLY'&&<div className="space-y-4">
   <section className="bg-white p-4 border rounded-xl space-y-4">
    <h3 className="font-semibold">Hitung Fisik &amp; Verifikasi Nota Mingguan</h3>
    <p className="text-xs text-gray-600">Cut-off Jumat 17.00 WIB; laporkan paling lambat Sabtu 17.00 WIB. Sistem merekam keterlambatan tanpa menghapus jejak.</p>
    <label className="block text-xs">Jumat / Tanggal Cut-Off<input type="date" className={cls} value={friday}
     max={wibToday()} onChange={e=>setFriday(e.target.value)}/></label>
    {selectedWeekly?<p className="p-3 rounded bg-gray-100 text-sm">Laporan minggu ini terkunci. Selisih: {money(selectedWeekly.variance)}</p>:
     isTreasurer?<><CountFields form={weeklyForm} change={setWeeklyForm}/>
      <p className="text-sm">Saldo Buku: <b>{money(weeklyLedger)}</b> · Total Fisik: <b>{money(weeklyPhysical)}</b> · Selisih: <b>{money(weeklyPhysical-weeklyLedger)}</b></p>
      <label className="text-xs flex gap-2 items-center"><input type="checkbox" checked={receiptsVerified}
       onChange={e=>setReceiptsVerified(e.target.checked)}/>Seluruh kuitansi/nota dan foto item telah saya verifikasi.</label>
      <button className={primary} disabled={busy||!receiptsVerified} onClick={()=>void act(async()=>{
       await cashService.submitWeekly({schoolId,friday,denominations:weeklyForm.denominations,
        bank:weeklyForm.bank,damaged:weeklyForm.damaged,stamps:weeklyForm.stamps,unposted:weeklyForm.unposted,
        notes:weeklyForm.notes});setWeeklyForm(emptyCount());setReceiptsVerified(false);
      },'Cash opname mingguan telah diajukan dan dikunci.')}>Kirim Laporan Mingguan</button></>:
     <p className="text-xs text-gray-500">Hanya Bendahara Sekolah yang dapat mengirim laporan mingguan.</p>}
   </section>
   <section className="bg-white p-4 border rounded-xl overflow-x-auto">
    <h4 className="font-semibold mb-2">Riwayat Laporan Mingguan</h4>
    <table className="w-full text-xs"><thead><tr>{['Cut-Off','Saldo Buku','Total Fisik','Selisih','Dilaporkan','Ketepatan'].map(h=><th className="border p-2" key={h}>{h}</th>)}</tr></thead>
    <tbody>{weekly.map(w=>{
     const next=new Date(w.week_ending+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);
     const due=next.toISOString().slice(0,10)+'T17:00:00+07:00';
     return <tr key={w.id}><td className="border p-2">{formatDate(w.week_ending)}</td>
      <td className="border p-2">{money(w.ledger_balance)}</td><td className="border p-2">{money(w.physical_total)}</td>
      <td className="border p-2">{money(w.variance)}</td>
      <td className="border p-2">{new Date(w.submitted_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})}</td>
      <td className="border p-2">{new Date(w.submitted_at).getTime()>new Date(due).getTime()?'Terlambat':'Tepat Waktu'}</td></tr>;
    })}</tbody></table>
   </section>
  </div>}
  {school&&tab==='MONTHLY'&&<div className="space-y-4">
   {isTreasurer&&<section className="bg-white p-4 border rounded-xl space-y-3">
    <h3 className="font-semibold">Susun Berita Acara &amp; Draft LPJ Bulanan</h3>
    <p className="text-xs text-gray-600">Opname pada tanggal 18–20; LPJ mencakup tanggal 21 bulan sebelumnya sampai 20 bulan berjalan.</p>
    <button className={secondary} onClick={()=>{setEditingId('');setPreviewId('');setMonthForm(emptyCount());setReimbursement(0);setCountDate(period.end);}}>Draft Baru</button>
    <div className="grid sm:grid-cols-3 gap-3">
     <label className="text-xs">Bulan Laporan<input type="month" className={cls} value={month} disabled={!!editingId}
      onChange={e=>{setMonth(e.target.value);setEditingId('');setPreviewId('');}}/></label>
     <div className="text-xs">Periode LPJ<div className="border rounded-lg p-2 text-sm">{formatDate(period.start)} – {formatDate(period.end)}</div></div>
     <label className="text-xs">Tanggal Opname<input type="date" className={cls} min={period.end.slice(0,8)+'18'}
      max={period.end} value={countDate} onChange={e=>setCountDate(e.target.value)}/></label>
    </div>
    <CountFields form={monthForm} change={setMonthForm}/>
    <RupiahField label="Dana dalam Proses Reimbursement" value={reimbursement} onChange={setReimbursement}/>
    <p className="text-sm">Saldo Buku pada Tanggal Opname: <b>{money(monthLedger)}</b> · Total Fisik: <b>{money(monthPhysical)}</b> · Selisih: <b>{money(monthPhysical-monthLedger)}</b></p>
    <button className={primary} disabled={busy} onClick={saveReport}>Simpan Draft</button>
   </section>}
   <section className="bg-white p-4 border rounded-xl space-y-3">
    <h3 className="font-semibold">Daftar LPJ dan Approval</h3>
    {reports.length===0&&<p className="text-xs text-gray-500">Belum ada laporan bulanan.</p>}
    {reports.map(r=><div key={r.id} className="p-3 border rounded-lg space-y-2">
     <div className="flex justify-between items-center flex-wrap gap-2"><div>
      <p className="font-semibold text-sm">{formatDate(r.period_start)} – {formatDate(r.period_end)}</p>
      <p className="text-xs text-gray-600">{statusLabel[r.status]} · Selisih {money(r.variance)}</p></div>
      <div className="flex gap-2"><button className={secondary} onClick={()=>setPreviewId(r.id)}>Preview / Cetak</button>
       {isTreasurer&&['DRAFT','RETURNED'].includes(r.status)&&<button className={secondary} onClick={()=>edit(r)}>Edit</button>}
      </div></div>
     {isTreasurer&&['DRAFT','RETURNED'].includes(r.status)&&<button className={primary}
      disabled={busy} onClick={()=>transition(r,'SUBMIT')}>Ajukan ke Kepala Sekolah</button>}
     {canApprove(r)&&<div className="flex gap-2 flex-wrap items-center">
      <button className={primary} disabled={busy} onClick={()=>transition(r,'APPROVE')}>Setujui &amp; Teruskan</button>
      <input className={cls+' max-w-xs'} value={returnReason} onChange={e=>setReturnReason(e.target.value)}
       placeholder="Alasan pengembalian"/>
      <button className={secondary} disabled={busy} onClick={()=>transition(r,'RETURN')}>Kembalikan</button></div>}
    </div>)}
   </section>
   {activeReport&&<CashPrint report={activeReport} schoolName={school.school_name}
    transactions={transactions} events={events.filter(e=>e.report_id===activeReport.id)}
    photos={photoUrls} photoLoading={photosLoading} onError={setError}/>}
  </div>}
 </div>;
};
