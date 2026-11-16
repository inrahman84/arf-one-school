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
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(endMonth)) throw new Error('Bulan LPJ tidak valid');
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
