import React from 'react';
import {CashTransaction,CashReport,CashApprovalEvent,CASH_DENOMINATIONS,reportSummary,formatDate,money,transactionAttachments} from '../../services/cashService';

interface Props{
 report:CashReport;schoolName:string;transactions:CashTransaction[];
 events:CashApprovalEvent[];photos:Record<string,string>;photoLoading:boolean;
 onError:(message:string)=>void;
}
const printCSS='@media print{@page{size:A4;margin:12mm}body *{visibility:hidden!important}#cash-print,#cash-print *{visibility:visible!important}#cash-print{position:absolute!important;left:0!important;top:0!important;width:100%!important;background:white!important;color:black!important;padding:0!important;border:0!important;box-shadow:none!important}#cash-print table{width:100%!important;font-size:9px!important;border-collapse:collapse!important}#cash-print th,#cash-print td{border:1px solid #888!important;padding:4px!important}#cash-print .cash-page{break-before:page!important}#cash-print .cash-evidence{break-inside:avoid!important}#cash-print img{max-width:100%!important;max-height:95mm!important;object-fit:contain!important}#cash-print .cash-photo-pair{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7mm!important}}';
const headings=['No','Tanggal','Uraian / Keterangan','Debet','Kredit','Saldo','Ket.'];
function eventFor(events:CashApprovalEvent[],role:string):string{
 const history=events.filter(e=>e.actor_role===role&&['APPROVE','SUBMIT','RESUBMIT'].includes(e.action));
 const match=history.at(-1);
 return match?match.actor_name+' — '+new Date(match.occurred_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}):'Belum disetujui';
}
export const CashPrint:React.FC<Props>=({report,schoolName,transactions,events,photos,photoLoading,onError})=>{
 const summary=reportSummary(transactions,report.period_start,report.period_end);
 const missing=summary.rows.some(({transaction:t})=>transactionAttachments(t).some(a=>!photos[a.file_path]));
 const print=()=>{
  if(photoLoading||missing){onError('Foto bukti belum tersedia lengkap. Pencetakan ditunda agar lampiran tidak kosong.');return;}
  window.print();
 };
 return <section className="space-y-3 bg-white border rounded-xl p-4">
  <style>{printCSS}</style>
  <div className="flex flex-wrap items-center justify-between gap-2">
   <h3 className="font-bold text-[#073b2d]">Preview Laporan &amp; Lampiran</h3>
   <button className="rounded-lg bg-[#073b2d] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
    onClick={print} disabled={photoLoading||missing}>Cetak / Simpan PDF</button>
  </div>
  {photoLoading&&<p className="text-xs text-gray-600">Memuat foto item dan kuitansi...</p>}
  {missing&&!photoLoading&&<p className="text-xs text-red-700">Ada foto bukti yang tidak dapat diakses. Periksa penyimpanan sebelum mencetak.</p>}
  <div id="cash-print" className="text-gray-900 space-y-6">
   <article className="space-y-3">
    <header className="text-center text-sm">
     <strong>ABDUL RASYID FOUNDATION</strong><p>{schoolName}</p>
     <h2 className="font-extrabold underline my-2">BERITA ACARA CASH OPNAME PETTY CASH</h2>
     <p>Tanggal {formatDate(report.count_date)}</p>
    </header>
    <p className="text-xs">Pada tanggal {formatDate(report.count_date)} telah dilaksanakan penghitungan fisik Petty Cash di {schoolName}. Saldo fisik dan saldo BKU direkonsiliasi pada tanggal opname yang sama.</p>
    <table className="w-full border-collapse text-xs">
     <tbody>
      <tr><th className="border p-2 text-left">1. SALDO MENURUT BUKU KAS</th><td className="border p-2 text-right">{money(report.book_balance_at_count)}</td></tr>
      <tr><th className="border p-2 text-left">2. SALDO MENURUT FISIK</th><td className="border p-2 text-right">{money(report.physical_total)}</td></tr>
      {CASH_DENOMINATIONS.map(unit=><tr key={unit}>
       <td className="border p-2">{money(unit)} × {report.denominations[String(unit)]||0} {unit>=1000?'lembar':'koin'}</td>
       <td className="border p-2 text-right">{money(unit*(report.denominations[String(unit)]||0))}</td></tr>)}
      <tr><td className="border p-2">Saldo di Bank</td><td className="border p-2 text-right">{money(report.bank_balance)}</td></tr>
      <tr><td className="border p-2">Uang Rusak</td><td className="border p-2 text-right">{money(report.damaged_cash)}</td></tr>
      <tr><td className="border p-2">Materai</td><td className="border p-2 text-right">{money(report.stamps_value)}</td></tr>
      <tr><td className="border p-2">Yang Belum Dibukukan</td><td className="border p-2 text-right">{money(report.unposted_value)}</td></tr>
      <tr className="font-bold"><td className="border p-2">TOTAL FISIK CASH OPNAME</td><td className="border p-2 text-right">{money(report.physical_total)}</td></tr>
      <tr className="font-bold"><td className="border p-2">SALDO MENURUT BUKU KAS HARIAN</td><td className="border p-2 text-right">{money(report.book_balance_at_count)}</td></tr>
      <tr className="font-bold"><td className="border p-2">SELISIH (+/-)</td><td className="border p-2 text-right">{money(report.variance)}</td></tr>
     </tbody>
    </table>
    <p className="text-xs">Keterangan / yang belum dibukukan: {report.notes||'-'}</p>
   </article>
   <article className="cash-page space-y-3">
    <header className="text-center text-sm">
     <strong>ABDUL RASYID FOUNDATION</strong><h2 className="font-extrabold underline mt-2">LAPORAN LPJ PETTY CASH</h2>
     <p>{schoolName}</p>
     <p>PERIODE: {formatDate(report.period_start)} s.d. {formatDate(report.period_end)}</p>
    </header>
    <table className="w-full border-collapse text-xs">
     <thead><tr>{headings.map(h=><th key={h} className="border p-1 text-left">{h}</th>)}</tr></thead>
     <tbody>
      <tr><td className="border p-1">-</td><td className="border p-1">{formatDate(report.period_start)}</td>
       <td className="border p-1">Saldo Awal</td><td className="border p-1">{money(summary.opening)}</td>
       <td className="border p-1">-</td><td className="border p-1">{money(summary.opening)}</td><td className="border p-1">-</td></tr>
      {summary.rows.map(({transaction:t,balance},i)=><tr key={t.id}>
       <td className="border p-1">{i+1}</td><td className="border p-1">{formatDate(t.transaction_date)}</td>
       <td className="border p-1">{t.description}</td>
       <td className="border p-1">{t.direction==='IN'?money(t.amount):'-'}</td>
       <td className="border p-1">{t.direction==='OUT'?money(t.amount):'-'}</td>
       <td className="border p-1">{money(balance)}</td><td className="border p-1">{t.notes||'-'}</td></tr>)}
      <tr className="font-bold"><td className="border p-1" colSpan={3}>TOTAL TRANSAKSI</td>
       <td className="border p-1">{money(summary.debit)}</td>
       <td className="border p-1">{money(summary.credit)}</td>
       <td className="border p-1">{money(summary.closing)}</td><td className="border p-1"></td></tr>
     </tbody>
    </table>
    <table className="w-full text-xs border-collapse"><tbody>
     <tr><td className="border p-2">Total Pengeluaran (A)</td><td className="border p-2 text-right">{money(summary.credit)}</td></tr>
     <tr><td className="border p-2">Dana Petty Cash: Saldo Awal + Penerimaan (B)</td><td className="border p-2 text-right">{money(summary.totalFunds)}</td></tr>
     <tr><td className="border p-2">Saldo Kas yang Seharusnya (C=B-A)</td><td className="border p-2 text-right">{money(summary.closing)}</td></tr>
     <tr><td className="border p-2">Dana Masih dalam Proses Pertanggungjawaban / Reimbursement (D)</td>
      <td className="border p-2 text-right">{money(report.reimbursement_pending)}</td></tr>
     <tr className="font-bold"><td className="border p-2">Sisa Dana yang Ada di Petty Cash (E=C-D)</td>
      <td className="border p-2 text-right">{money(summary.closing-report.reimbursement_pending)}</td></tr>
    </tbody></table>
   </article>
   <article className="cash-page space-y-3">
    <h2 className="font-bold underline text-center">LEMBAR PERSETUJUAN LPJ PETTY CASH</h2>
    <p className="text-xs">Persetujuan berikut adalah riwayat tindakan terverifikasi oleh sistem berdasarkan akun dan waktu server. Ini bukan tanda tangan elektronik tersertifikasi.</p>
    <div className="grid grid-cols-2 gap-3">
     {([['Diajukan Oleh','SCHOOL_TREASURER','Bendahara Sekolah'],
        ['Diperiksa Oleh','SCHOOL_PRINCIPAL','Kepala Sekolah'],
        ['Diperiksa Oleh','ARF_HEAD_TU','Kepala TU ARF'],
        ['Disetujui Oleh','FOUNDATION_MANAGER','Manager ARF']] as const)
      .map(([heading,role,position])=><div key={role} className="text-center border rounded p-3 text-xs min-h-[110px]">
       <strong>{heading}</strong><p>{position}</p>
       <p className="mt-5">{eventFor(events,role)}</p></div>)}
    </div>
    <p className="text-xs">Status akhir: <strong>{report.status}</strong></p>
   </article>
   <article className="cash-page space-y-4">
    <h2 className="font-bold text-center underline">LAMPIRAN ITEM, KUITANSI, DAN NOTA</h2>
    {summary.rows.map(({transaction:t},i)=><section className="cash-evidence border-b pb-4 space-y-2" key={t.id}>
     <h3 className="text-xs font-bold">{i+1}. {formatDate(t.transaction_date)} — {t.description} ({money(t.amount)})</h3>
     <div className="cash-photo-pair grid sm:grid-cols-2 gap-3">
      {transactionAttachments(t).map((a,j)=><figure className="min-w-0 break-inside-avoid" key={a.id}>
       <figcaption className="text-xs font-semibold mb-2 break-words">
        {j+1}. {a.kind==='ITEM'?'Foto Item / Kegiatan':'Foto Kuitansi / Nota'} — {a.display_name}
       </figcaption>
       {photos[a.file_path]?
        <img className="w-full h-48 object-contain border" src={photos[a.file_path]} alt={a.display_name}/>:
        <p className="text-xs text-red-700">Foto belum tersedia: {a.display_name}</p>}
      </figure>)}
     </div>
    </section>)}
   </article>
  </div>
 </section>;
};
