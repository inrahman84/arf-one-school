import React,{useEffect,useMemo,useState} from 'react';
import {School} from '../../types';
import {useAuth} from '../../context/AuthContext';
import {cashService,CASH_DENOMINATIONS,emptyDenominations,periodFor,lastFriday,wibToday,
 money,formatDate,ledgerBalance,reportSummary,totalPhysical,CashTransaction,CashWeeklyCount,CashReport,
 CashApprovalEvent,Denominations,CashDirection} from '../../services/cashService';
import {CashPrint} from './CashPrint';

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
    <input type="number" min={0} step={1} className={cls} value={form.denominations[String(d)]||0}
     onChange={e=>patch({denominations:{...form.denominations,[String(d)]:num(Number(e.target.value))}})}/></label>)}
  </div>
  <div className="grid sm:grid-cols-2 gap-3">
   {([['Saldo Bank','bank'],['Uang Rusak','damaged'],['Materai','stamps'],['Belum Dibukukan','unposted']] as const)
    .map(([title,key])=><label key={key} className="text-xs">{title} (Rp)
     <input type="number" min={0} step={1} className={cls} value={form[key]}
      onChange={e=>patch({[key]:num(Number(e.target.value))})}/></label>)}
  </div>
  <label className="block text-xs">Catatan / Penjelasan Selisih
   <textarea className={cls} rows={2} value={form.notes} onChange={e=>patch({notes:e.target.value})}/></label>
 </div>;
};
export const PettyCashView:React.FC<{schools:School[]}>=({schools})=>{
 const {effectiveRole,userProfile}=useAuth();
 const global=['SUPER_ADMIN','FOUNDATION_MANAGER','ARF_HEAD_TU'].includes(effectiveRole);
 const allowed=useMemo(()=>global?schools:schools.filter(s=>
  ['SCHOOL_TREASURER','SCHOOL_PRINCIPAL'].includes(effectiveRole)&&
   (userProfile?.assignedSchools||[]).includes(s.school_id)),[schools,global,effectiveRole,userProfile?.assignedSchools]);
 const [schoolId,setSchoolId]=useState('');const [tab,setTab]=useState<Tab>('BKU');
 const [transactions,setTransactions]=useState<CashTransaction[]>([]);
 const [weekly,setWeekly]=useState<CashWeeklyCount[]>([]);
 const [reports,setReports]=useState<CashReport[]>([]);
 const [events,setEvents]=useState<CashApprovalEvent[]>([]);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 const [date,setDate]=useState(wibToday());const [description,setDescription]=useState('');
 const [type,setType]=useState<CashDirection>('OUT');const [amount,setAmount]=useState(0);const [note,setNote]=useState('');
 const [itemFile,setItemFile]=useState<File|null>(null);const [receiptFile,setReceiptFile]=useState<File|null>(null);
 const [fileKey,setFileKey]=useState(0);const [friday,setFriday]=useState(lastFriday());
 const [weeklyForm,setWeeklyForm]=useState<CountForm>(emptyCount);const [receiptsVerified,setReceiptsVerified]=useState(false);
 const [month,setMonth]=useState(wibToday().slice(0,7));const period=useMemo(()=>periodFor(month),[month]);
 const [countDate,setCountDate]=useState(period.end);const [monthForm,setMonthForm]=useState<CountForm>(emptyCount);
 const [reimbursement,setReimbursement]=useState(0);const [editingId,setEditingId]=useState('');
 const [previewId,setPreviewId]=useState('');const [photoUrls,setPhotoUrls]=useState<Record<string,string>>({});
 const [photosLoading,setPhotosLoading]=useState(false);const [returnReason,setReturnReason]=useState('');
 const isTreasurer=effectiveRole==='SCHOOL_TREASURER';
 const school=allowed.find(s=>s.school_id===schoolId);
 useEffect(()=>{if(!allowed.some(s=>s.school_id===schoolId))setSchoolId(allowed[0]?.school_id||'');},[allowed,schoolId]);
 const refresh=async()=>{
  if(!schoolId)return;
  try{
   const [t,w,r,e]=await Promise.all([cashService.listTransactions(schoolId),
    cashService.listWeekly(schoolId),cashService.listReports(schoolId),cashService.listApprovalEvents(schoolId)]);
   setTransactions(t);setWeekly(w);setReports(r);setEvents(e);
  }catch(e){setError(e instanceof Error?e.message:String(e));}
 };
 useEffect(()=>{setTransactions([]);setWeekly([]);setReports([]);setPreviewId('');void refresh();},[schoolId]);
 const act=async(action:()=>Promise<void>,success:string)=>{
  setError('');setMessage('');setBusy(true);
  try{await action();setMessage(success);await refresh();}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 const activeReport=reports.find(r=>r.id===previewId);
 useEffect(()=>{
  let cancelled=false;
  if(!activeReport){setPhotoUrls({});return;}
  const paths=[...new Set(transactions.filter(t=>t.transaction_date>=activeReport.period_start&&
   t.transaction_date<=activeReport.period_end).flatMap(t=>[t.item_photo_path,t.receipt_photo_path]))];
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
  if(!schoolId||!isTreasurer||!itemFile||!receiptFile){setError('Foto item dan nota wajib diunggah.');return;}
  if(!Number.isSafeInteger(amount)||amount<=0){setError('Nominal harus berupa Rupiah positif.');return;}
  void act(async()=>{
   await cashService.addTransaction({schoolId,date,description,direction:type,amount,itemFile,receiptFile,notes:note});
   setDescription('');setAmount(0);setNote('');setItemFile(null);setReceiptFile(null);setFileKey(k=>k+1);
  },'Transaksi BKU dan kedua foto bukti berhasil disimpan.');
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
   {isTreasurer&&<form className="p-4 border bg-white rounded-xl space-y-3" onSubmit={saveTransaction}>
    <h3 className="font-semibold">Tambah Transaksi Buku Kas Umum</h3>
    <div className="grid sm:grid-cols-3 gap-3">
     <label className="text-xs">Tanggal Transaksi<input type="date" required max={wibToday()} className={cls}
      value={date} onChange={e=>setDate(e.target.value)}/></label>
     <label className="text-xs">Jenis Transaksi<select className={cls} value={type}
      onChange={e=>setType(e.target.value as CashDirection)}><option value="OUT">Pengeluaran (Kredit)</option>
      <option value="IN">Penerimaan (Debet)</option></select></label>
     <label className="text-xs">Jumlah (Rp)<input type="number" required min={1} step={1} className={cls}
      value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label>
    </div>
    <label className="block text-xs">Uraian / Keterangan Transaksi<input required minLength={3}
     className={cls} value={description} onChange={e=>setDescription(e.target.value)}/></label>
    <div className="grid sm:grid-cols-2 gap-3" key={fileKey}>
     <label className="text-xs">Upload Foto Item / Kegiatan *<input type="file" required className={cls}
      accept="image/jpeg,image/png,image/webp" onChange={e=>setItemFile(e.target.files?.[0]||null)}/></label>
     <label className="text-xs">Upload Foto Kuitansi / Nota *<input type="file" required className={cls}
      accept="image/jpeg,image/png,image/webp" onChange={e=>setReceiptFile(e.target.files?.[0]||null)}/></label>
    </div>
    <p className="text-xs text-gray-600">Foto JPG, PNG, atau WebP; maksimal 5 MB per berkas. Catatan BKU bersifat append-only untuk keamanan audit.</p>
    <label className="block text-xs">Catatan Tambahan<textarea className={cls} value={note}
     onChange={e=>setNote(e.target.value)}/></label>
    <button className={primary} type="submit" disabled={busy||!itemFile||!receiptFile}>Simpan BKU &amp; Bukti</button>
   </form>}
   <section className="bg-white border rounded-xl p-4 overflow-x-auto">
    <h3 className="font-semibold mb-3">BKU {school.school_name}</h3>
    <table className="w-full text-xs border-collapse min-w-[680px]"><thead><tr>
     {['No','Tanggal','Uraian','Debet','Kredit','Saldo','Lampiran'].map(h=><th className="border p-2 text-left" key={h}>{h}</th>)}
    </tr></thead><tbody>
     {reportSummary(transactions,'1900-01-01','9999-12-31').rows.map(({transaction:t,balance},i)=>
      <tr key={t.id}><td className="border p-2">{i+1}</td><td className="border p-2">{formatDate(t.transaction_date)}</td>
       <td className="border p-2">{t.description}</td>
       <td className="border p-2">{t.direction==='IN'?money(t.amount):'-'}</td>
       <td className="border p-2">{t.direction==='OUT'?money(t.amount):'-'}</td><td className="border p-2">{money(balance)}</td>
       <td className="border p-2"><button className="underline text-blue-700 mr-2" onClick={()=>void openPhoto(t.item_photo_path)}>Item</button>
        <button className="underline text-blue-700" onClick={()=>void openPhoto(t.receipt_photo_path)}>Nota</button></td></tr>)}
    </tbody></table><p className="text-sm font-semibold mt-3">Saldo Akhir: {money(ledgerBalance(transactions,'9999-12-31'))}</p>
   </section>
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
    <label className="block text-xs">Dana dalam Proses Reimbursement (Rp)<input type="number"
     min={0} step={1} className={cls} value={reimbursement} onChange={e=>setReimbursement(num(Number(e.target.value)))}/></label>
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
