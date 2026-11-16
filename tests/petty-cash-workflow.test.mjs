import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {periodFor,emptyDenominations,countCash,totalPhysical,ledgerBalance,reportSummary} from '../src/lib/pettyCashMath.ts';

test('LPJ periods always run 21st prior month to 20th current month',()=>{
 assert.deepEqual(periodFor('2026-11'),{start:'2026-10-21',end:'2026-11-20'});
 assert.deepEqual(periodFor('2027-01'),{start:'2026-12-21',end:'2027-01-20'});
 assert.deepEqual(periodFor('2028-03'),{start:'2028-02-21',end:'2028-03-20'});
 assert.throws(()=>periodFor('2026-13'),/valid/);
});

test('Physical cash denominations, bank, damaged cash, stamps and unposted funds total correctly',()=>{
 const denominations={...emptyDenominations(),'100000':2,'50000':1,'1000':3};
 assert.equal(countCash(denominations),253000);
 assert.equal(totalPhysical(denominations,200000,1000,12000,9000),475000);
});

test('BKU running balance, debit and credit reports preserve chronological order and exclude outside-period items',()=>{
 const tx=[
  {id:'3',transaction_date:'2026-11-20',created_at:'2026-11-20T10:00:00Z',direction:'OUT',amount:50000},
  {id:'1',transaction_date:'2026-10-20',created_at:'2026-10-20T10:00:00Z',direction:'IN',amount:2000000},
  {id:'2',transaction_date:'2026-11-01',created_at:'2026-11-01T10:00:00Z',direction:'OUT',amount:250000},
  {id:'4',transaction_date:'2026-11-21',created_at:'2026-11-21T10:00:00Z',direction:'IN',amount:50000}
 ];
 const r=reportSummary(tx,'2026-10-21','2026-11-20');
 assert.equal(r.opening,2000000);
 assert.equal(r.debit,0);
 assert.equal(r.credit,300000);
 assert.equal(r.closing,1700000);
 assert.deepEqual(r.rows.map(x=>x.transaction.id),['2','3']);
 assert.deepEqual(r.rows.map(x=>x.balance),[1750000,1700000]);
 assert.equal(ledgerBalance(tx,'2026-11-20'),1700000);
});

test('Database enforces sequential approvals, 17:00 WIB cutoff and segregated photo access',()=>{
 const sql=readFileSync(new URL('../supabase/015_petty_cash_workflow.sql',import.meta.url),'utf8');
 assert.match(sql,/cash_treasurer/);
 assert.match(sql,/cash_role\(r.school_id,needed_role\)/);
 assert.match(sql,/PENDING_PRINCIPAL/);
 assert.match(sql,/PENDING_HEAD_TU/);
 assert.match(sql,/PENDING_MANAGER/);
 assert.match(sql,/interval '17 hours'/);
 assert.match(sql,/arf_cash_storage_read/);
 assert.match(sql,/arf_cash_storage_insert/);
 assert.match(sql,/arf_cash_storage_delete_unlinked/);
 assert.match(sql,/owner_id=auth.uid\(\)::text/);
});

test('Legacy spreadsheet uploader removed from menu routing, but exports remain',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const menu=readFileSync(new URL('../src/components/layout/Sidebar.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(app,/DataImportView/);
 assert.doesNotMatch(menu,/key: 'import'/);
 assert.match(app,/PettyCashView/);
 assert.match(menu,/BKU & Petty Cash/);
 assert.match(menu,/Laporan & Ekspor Data/);
});

test('Startup failure from a missing preview Supabase environment does not leave a white screen',()=>{
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 const supabase=readFileSync(new URL('../src/lib/supabase.ts',import.meta.url),'utf8');
 assert.match(main,/root\.render\(<main/);
 assert.match(main,/import\('\.\/App\.tsx'\)/);
 assert.match(main,/\.catch\(error=>/);
 assert.match(main,/LoadFailure/);
 assert.match(main,/getDerivedStateFromError/);
 assert.match(supabase,/VITE_SUPABASE_URL/);
 assert.match(supabase,/VITE_SUPABASE_PUBLISHABLE_KEY/);
});

test('Petty Cash dashboard uses actual Supabase tables and scopes rows to authorized schools',()=>{
 const view=readFileSync(new URL('../src/features/pettyCash/PettyCashDashboard.tsx',import.meta.url),'utf8');
 const module=readFileSync(new URL('../src/features/pettyCash/PettyCashView.tsx',import.meta.url),'utf8');
 assert.match(view,/supabase\.from\(table\)/);
 assert.match(view,/\.in\('school_id',ids\)/);
 assert.match(view,/arf_cash_transactions/);
 assert.match(view,/arf_cash_weekly_counts/);
 assert.match(view,/arf_cash_reports/);
 assert.match(view,/Laporan BOP Sekolah/);
 assert.match(view,/Saldo BKU akhir periode/);
 assert.match(view,/Perbandingan pemasukan dan pengeluaran/);
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const menu=readFileSync(new URL('../src/components/layout/Sidebar.tsx',import.meta.url),'utf8');
 assert.match(app,/activeTab === 'cashDashboard'/);
 assert.match(menu,/title: 'UTAMA'/);
 assert.match(menu,/key: 'cashDashboard' as NavItemKey/);
 assert.doesNotMatch(module,/tab==='DASHBOARD'/);
 assert.match(module,/\['No','Tanggal','Uraian','Debet','Kredit','Saldo','Keterangan','Lampiran'\]/);
 assert.match(module,/t\.notes\?\.trim\(\)\|\|'-'/);
});

test('BKU and weekly inserts are protected by actual role rather than role simulation',()=>{
 const sql=readFileSync(new URL('../supabase/015_petty_cash_workflow.sql',import.meta.url),'utf8');
 const component=readFileSync(new URL('../src/features/pettyCash/PettyCashView.tsx',import.meta.url),'utf8');
 assert.match(sql,/m\.role='SUPER_ADMIN' OR/);
 assert.match(sql,/arf_cash_tx_insert/);
 assert.match(sql,/arf_cash_week_insert/);
 assert.match(component,/userProfile\?\.role/);
 assert.match(component,/Simulasi peran di header tidak mengubah izin Supabase/);
 assert.match(component,/cashService\.addTransaction/);
 assert.match(component,/cashService\.submitWeekly/);
});

test('BKU accepts multiple named images and saves them in one verified transaction',()=>{
 const service=readFileSync(new URL('../src/services/cashService.ts',import.meta.url),'utf8');
 const input=readFileSync(new URL('../src/features/pettyCash/CashPhotoPicker.tsx',import.meta.url),'utf8');
 const sql=readFileSync(new URL('../supabase/016_petty_cash_named_evidence.sql',import.meta.url),'utf8');
 const print=readFileSync(new URL('../src/features/pettyCash/CashPrint.tsx',import.meta.url),'utf8');
 assert.match(input,/multiple className=/);
 assert.match(input,/Nama Foto/);
 assert.match(input,/maxLength=\{150\}/);
 assert.match(input,/photos\.length\+incoming\.length>12/);
 assert.match(service,/arf_cash_transaction_attachments/);
 assert.match(service,/arf_cash_create_transaction/);
 assert.match(service,/itemPhotos:NamedCashPhoto\[\]/);
 assert.match(service,/receiptPhotos:NamedCashPhoto\[\]/);
 assert.match(service,/p_items:items,p_receipts:receipts/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/arf_internal\.cash_treasurer\(p_school_id\)/);
 assert.match(sql,/transaction_id,school_id,kind,display_name,file_path,sort_order/);
 assert.match(sql,/first_item,first_receipt/);
 assert.match(print,/transactionAttachments\(t\)\.map/);
 assert.match(print,/a\.display_name/);
});

test('BKU layout is adaptive and Rupiah amounts are typed directly without spinners',()=>{
 const ui=readFileSync(new URL('../src/features/pettyCash/PettyCashView.tsx',import.meta.url),'utf8');
 const rupiah=readFileSync(new URL('../src/features/pettyCash/RupiahField.tsx',import.meta.url),'utf8');
 assert.match(ui,/hidden lg:block w-full overflow-x-auto/);
 assert.match(ui,/lg:hidden space-y-3/);
 assert.match(ui,/transactionAttachments\(t\)\.map/);
 assert.match(ui,/RupiahField label="Jumlah Transaksi"/);
 assert.match(ui,/RupiahField label="Dana dalam Proses Reimbursement"/);
 assert.match(rupiah,/type="text" inputMode="numeric"/);
 assert.match(rupiah,/replace\(\/\\D\/g/);
 assert.doesNotMatch(rupiah,/type="number"/);
});

test('Named extra images cannot be treated as orphaned storage uploads',()=>{
 const sql=readFileSync(new URL('../supabase/017_protect_named_cash_photos.sql',import.meta.url),'utf8');
 const service=readFileSync(new URL('../src/services/cashService.ts',import.meta.url),'utf8');
 assert.match(sql,/DROP POLICY IF EXISTS arf_cash_storage_delete_unlinked/);
 assert.match(sql,/NOT EXISTS \(/);
 assert.match(sql,/public\.arf_cash_transaction_attachments a/);
 assert.match(sql,/a\.file_path=name/);
 assert.match(service,/check\.data\?\.id===recordId/);
 assert.match(service,/cleanupImages\(uploadedPaths\)/);
});

test('BOP executive menu renamed without replacing original executive dashboard',()=>{
 const menu=readFileSync(new URL('../src/components/layout/Sidebar.tsx',import.meta.url),'utf8');
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const dashboard=readFileSync(new URL('../src/features/pettyCash/PettyCashDashboard.tsx',import.meta.url),'utf8');
 assert.match(menu,/label: 'Laporan BOP Sekolah'/);
 assert.match(menu,/label: 'Executive Dashboard'/);
 assert.match(app,/title: 'Laporan BOP Sekolah'/);
 assert.match(dashboard,/Laporan BOP Sekolah/);
});

test('BKU add form is a modal and delete requires reason with audit',()=>{
 const ui=readFileSync(new URL('../src/features/pettyCash/PettyCashView.tsx',import.meta.url),'utf8');
 const service=readFileSync(new URL('../src/services/cashService.ts',import.meta.url),'utf8');
 const dashboard=readFileSync(new URL('../src/features/pettyCash/PettyCashDashboard.tsx',import.meta.url),'utf8');
 assert.match(ui,/Tambah Transaksi/);
 assert.match(ui,/role="dialog" aria-modal="true"/);
 assert.match(ui,/form="cash-bku-add-form"/);
 assert.match(ui,/role="alertdialog" aria-modal="true"/);
 assert.match(ui,/deleteReason\.trim\(\)\.length<10/);
 assert.match(ui,/canDeleteTransaction/);
 assert.match(ui,/Riwayat Penghapusan BKU/);
 assert.match(service,/arf_cash_void_transaction/);
 assert.match(service,/arf_cash_transaction_voids/);
 assert.match(service,/transactions\.filter\(t=>!voided\.has\(t\.id\)\)/);
 assert.match(dashboard,/!voided\.has\(t\.id\)/);
});

test('BKU tombstones preserve evidence, block closed periods and are not editable',()=>{
 const sql=readFileSync(new URL('../supabase/018_audited_bku_voids.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.arf_cash_transaction_voids/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/arf_internal\.cash_readable\(school_id\)/);
 assert.match(sql,/GRANT SELECT ON public\.arf_cash_transaction_voids TO authenticated/);
 assert.match(sql,/arf_internal\.cash_treasurer\(tx\.school_id\)/);
 assert.match(sql,/w\.week_ending>=tx\.transaction_date/);
 assert.match(sql,/r\.period_end>=tx\.transaction_date/);
 assert.match(sql,/to_jsonb\(tx\)/);
 assert.match(sql,/voided_by/);
 assert.match(sql,/NOT EXISTS \(/);
 assert.match(sql,/v\.transaction_id=t\.id/);
 assert.doesNotMatch(sql,/\bDELETE FROM public\.arf_cash_transactions\b/);
 assert.doesNotMatch(sql,/\bGRANT INSERT ON public\.arf_cash_transaction_voids\b/);
});
