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
