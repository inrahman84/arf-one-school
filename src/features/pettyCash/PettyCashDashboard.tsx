import React,{useEffect,useMemo,useState} from 'react';
import {Banknote,CalendarClock,FileCheck2,RefreshCw,ReceiptText,TrendingDown,TrendingUp,Wallet,AlertTriangle} from 'lucide-react';
import {Bar,BarChart,CartesianGrid,Cell,Legend,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {supabase} from '../../lib/supabase';
import {School} from '../../types';
import {useAuth} from '../../context/AuthContext';
import {periodFor,formatDate,money,wibToday} from '../../services/cashService';

type FinancialTransaction={id:string;school_id:string;transaction_date:string;amount:number;direction:'IN'|'OUT'};
type VoidRecord={transaction_id:string;school_id:string};
type Weekly={school_id:string;week_ending:string;variance:number;submitted_at:string};
type Report={school_id:string;period_end:string;status:string;variance:number};
type Records={transactions:FinancialTransaction[];weekly:Weekly[];reports:Report[];voids:VoidRecord[]};
const INITIAL:Records={transactions:[],weekly:[],reports:[],voids:[]};
const COLORS=['#073b2d','#c89b55','#3f6276','#009b4c','#d97706','#dc2626'];
const compact=(v:number)=>Math.abs(v)>=1e9?(v/1e9).toFixed(1)+' M':Math.abs(v)>=1e6?(v/1e6).toFixed(1)+' jt':Math.abs(v)>=1000?(v/1000).toFixed(0)+' rb':String(v);

async function loadRows<T>(table:'arf_cash_transactions'|'arf_cash_weekly_counts'|'arf_cash_reports'|'arf_cash_transaction_voids',columns:string,ids:string[]):Promise<T[]>{
  if(ids.length===0)return [];
  const result:T[]=[];const pageSize=500;
  for(let offset=0; ;offset+=pageSize){
    const {data,error}=await supabase.from(table).select(columns).in('school_id',ids).range(offset,offset+pageSize-1);
    if(error)throw new Error(error.code==='42P01'||error.code==='PGRST205'
      ?'Database BKU & Petty Cash belum diaktifkan. Hubungi administrator untuk menerapkan migrasi keuangan.'
      :error.message);
    const rows=(data||[]) as T[];
    result.push(...rows);
    if(rows.length<pageSize)break;
  }
  return result;
}
async function loadFinancialData(ids:string[]):Promise<Records>{
  const [transactions,weekly,reports,voids]=await Promise.all([
    loadRows<FinancialTransaction>('arf_cash_transactions','id,school_id,transaction_date,amount,direction',ids),
    loadRows<Weekly>('arf_cash_weekly_counts','school_id,week_ending,variance,submitted_at',ids),
    loadRows<Report>('arf_cash_reports','school_id,period_end,status,variance',ids),
    loadRows<VoidRecord>('arf_cash_transaction_voids','transaction_id,school_id',ids)
  ]);
  return {transactions,weekly,reports,voids};
}
function Kpi({icon:Icon,label,value,description}:{icon:React.ElementType;label:string;value:string;description:string}){
  return <section className="rounded-xl border border-gray-200 bg-white p-4 min-w-0 shadow-sm">
    <div className="flex items-center gap-2 text-[#3f6276]">
      <Icon size={17}/><p className="text-xs font-semibold">{label}</p>
    </div>
    <p className="mt-2 text-xl sm:text-2xl font-extrabold text-[#073b2d] tabular-nums break-words">{value}</p>
    <p className="mt-2 text-xs text-gray-500">{description}</p>
  </section>;
}
const allStatuses:Record<string,string>={
 DRAFT:'Draft',RETURNED:'Dikembalikan',PENDING_PRINCIPAL:'Periksa Kepsek',
 PENDING_HEAD_TU:'Periksa Kepala TU',PENDING_MANAGER:'Menunggu Manager',APPROVED:'Disetujui'
};

export const PettyCashDashboard:React.FC<{schools:School[]}>=({schools})=>{
  const {userProfile}=useAuth();
  const actualRole=userProfile?.role||'';
  const permittedSchools=useMemo(()=>(
    ['SUPER_ADMIN','FOUNDATION_MANAGER','ARF_HEAD_TU'].includes(actualRole)
      ? schools : ['SCHOOL_TREASURER','SCHOOL_PRINCIPAL'].includes(actualRole)
      ? schools.filter(s=>(userProfile?.assignedSchools||[]).includes(s.school_id))
      : []
  ),[schools,actualRole,userProfile?.assignedSchools]);
  const [month,setMonth]=useState(wibToday().slice(0,7));
  const [scope,setScope]=useState('ALL');
  const [refreshKey,setRefreshKey]=useState(0);
  const [records,setRecords]=useState<Records>(INITIAL);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [updatedAt,setUpdatedAt]=useState('');
  const schoolIds=useMemo(()=>permittedSchools.map(s=>s.school_id),[permittedSchools]);
  const key=schoolIds.join('|');
  useEffect(()=>{if(scope!=='ALL'&&!schoolIds.includes(scope))setScope('ALL');},[scope,key]);
  useEffect(()=>{
    let alive=true;
    if(schoolIds.length===0){setRecords(INITIAL);setError('Tidak ada sekolah yang berwenang diakses.');return;}
    setLoading(true);setError('');
    void loadFinancialData(schoolIds).then(result=>{
      if(!alive)return;
      setRecords(result);setUpdatedAt(new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}));
    }).catch(err=>{if(alive){setRecords(INITIAL);setError(err instanceof Error?err.message:String(err));}})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false};
  },[key,refreshKey]);
  const period=useMemo(()=>periodFor(month),[month]);
  const schoolMap=useMemo(()=>new Map(permittedSchools.map(s=>[s.school_id,s.school_name])),[permittedSchools]);
  const summary=useMemo(()=>{
    const visible=scope==='ALL'?new Set(schoolIds):new Set([scope]);
    const voided=new Set(records.voids.map(v=>v.transaction_id));
    const transactions=records.transactions.filter(t=>visible.has(t.school_id)&&!voided.has(t.id));
    const inside=transactions.filter(t=>t.transaction_date>=period.start&&t.transaction_date<=period.end);
    const incoming=inside.reduce((s,t)=>s+(t.direction==='IN'?Number(t.amount):0),0);
    const outgoing=inside.reduce((s,t)=>s+(t.direction==='OUT'?Number(t.amount):0),0);
    const opening=transactions.filter(t=>t.transaction_date<period.start).reduce((s,t)=>s+(t.direction==='IN'?Number(t.amount):-Number(t.amount)),0);
    const balance=opening+incoming-outgoing;
    const weeks=records.weekly.filter(w=>visible.has(w.school_id)&&w.week_ending>=period.start&&w.week_ending<=period.end);
    const lastCounts=new Map<string,Weekly>();
    for(const row of weeks){const old=lastCounts.get(row.school_id);if(!old||old.week_ending<row.week_ending)lastCounts.set(row.school_id,row);}
    const totalVariance=[...lastCounts.values()].reduce((s,w)=>s+Math.abs(Number(w.variance)),0);
    const reportRows=records.reports.filter(r=>visible.has(r.school_id)&&r.period_end===period.end);
    const statuses=Object.entries(allStatuses).map(([key,label])=>({
      key,name:label,count:reportRows.filter(r=>r.status===key).length
    })).filter(s=>s.count>0);
    const schoolEntries=[...visible].map(id=>{
      const tx=inside.filter(t=>t.school_id===id);
      return {id,name:schoolMap.get(id)||id,pemasukan:tx.filter(t=>t.direction==='IN').reduce((s,t)=>s+Number(t.amount),0),
        pengeluaran:tx.filter(t=>t.direction==='OUT').reduce((s,t)=>s+Number(t.amount),0)};
    }).sort((a,b)=>b.pengeluaran-a.pengeluaran);
    return {incoming,outgoing,opening,balance,txCount:inside.length,weekCount:weeks.length,
      totalVariance,reportRows,statuses,schoolEntries,lastCounts};
  },[records,period.start,period.end,scope,key,schoolMap]);
  const asOf=wibToday();
  return <div className="space-y-4">
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap gap-3 items-start justify-between">
        <div><h2 className="text-lg font-extrabold text-[#073b2d]">Executive Dashboard — BKU &amp; Petty Cash</h2>
          <p className="text-xs text-gray-500">Infografis berdasarkan transaksi dan laporan yang tersimpan di Supabase; bukan data simulasi.</p></div>
        <button type="button" className="flex gap-2 items-center rounded-lg border border-[#073b2d] px-3 py-2 text-xs font-semibold text-[#073b2d]"
          onClick={()=>setRefreshKey(n=>n+1)}><RefreshCw size={14}/>Perbarui</button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs font-semibold">Periode LPJ (tanggal 21–20)
          <input type="month" className="block w-full mt-1 rounded-lg border border-gray-300 p-2 text-sm" value={month}
            onChange={e=>setMonth(e.target.value)}/></label>
        <label className="text-xs font-semibold">Cakupan sekolah
          <select className="block w-full mt-1 rounded-lg border border-gray-300 p-2 text-sm" value={scope} onChange={e=>setScope(e.target.value)}>
            {permittedSchools.length>1&&<option value="ALL">Seluruh sekolah yang saya akses ({permittedSchools.length})</option>}
            {permittedSchools.length===1&&<option value="ALL">{permittedSchools[0].school_name}</option>}
            {permittedSchools.map(s=><option key={s.school_id} value={s.school_id}>{s.school_name}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-gray-600">Periode: <strong>{formatDate(period.start)} – {formatDate(period.end)}</strong>. Saldo dihitung dari BKU sampai akhir periode; posisi periode berjalan dapat berubah. {updatedAt&&'Diperbarui: '+updatedAt+' WIB.'}</p>
    </section>
    {error&&<p role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</p>}
    {loading?<p className="rounded-xl bg-white p-5 text-sm text-gray-600">Mengambil data BKU dan Petty Cash...</p>:
     !error&&<>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Kpi icon={Wallet} label="Saldo BKU akhir periode" value={money(summary.balance)} description={'Saldo awal: '+money(summary.opening)}/>
        <Kpi icon={TrendingUp} label="Total Pemasukan" value={money(summary.incoming)} description="Seluruh penerimaan periode"/>
        <Kpi icon={TrendingDown} label="Total Pengeluaran" value={money(summary.outgoing)} description="Seluruh pengeluaran periode"/>
        <Kpi icon={ReceiptText} label="Transaksi BKU" value={String(summary.txCount)} description="Catatan penerimaan dan pengeluaran"/>
        <Kpi icon={CalendarClock} label="Laporan Opname Jumat" value={String(summary.weekCount)} description="Jumlah cash opname mingguan yang dikirim"/>
        <Kpi icon={AlertTriangle} label="Selisih opname terbaru" value={money(summary.totalVariance)} description="Jumlah selisih absolut pada opname terakhir per sekolah di periode ini"/>
      </div>
      <div className="grid lg:grid-cols-5 gap-4">
        <section className="lg:col-span-3 border rounded-xl bg-white p-4">
          <h3 className="font-bold text-[#073b2d] text-sm">Perbandingan pemasukan dan pengeluaran</h3>
          <p className="text-xs text-gray-500 mb-3">Per sekolah · maksimal 10 sekolah dengan pengeluaran terbesar</p>
          {summary.schoolEntries.every(r=>r.pemasukan===0&&r.pengeluaran===0)
            ?<p className="py-16 text-center text-xs text-gray-500">Belum ada transaksi pada periode ini.</p>:
            <div className="h-[310px] w-full"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.schoolEntries.slice(0,10)} margin={{top:8,right:6,bottom:65,left:6}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                <XAxis dataKey="name" angle={-35} textAnchor="end" height={90} interval={0} tick={{fontSize:9}}
                  tickFormatter={v=>String(v).length>15?String(v).slice(0,15)+'…':String(v)}/>
                <YAxis width={55} tick={{fontSize:10}} tickFormatter={compact}/>
                <Tooltip formatter={value=>money(Number(value))}/>
                <Legend verticalAlign="top"/>
                <Bar dataKey="pemasukan" fill="#009b4c" name="Pemasukan" radius={[3,3,0,0]}/>
                <Bar dataKey="pengeluaran" fill="#c89b55" name="Pengeluaran" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer></div>}
        </section>
        <section className="lg:col-span-2 border rounded-xl bg-white p-4">
          <h3 className="font-bold text-[#073b2d] text-sm">Status LPJ periode terpilih</h3>
          <p className="text-xs text-gray-500">Laporan bulanan yang tercatat per sekolah</p>
          {summary.statuses.length===0?<p className="text-xs py-16 text-center text-gray-500">Belum ada LPJ periode ini.</p>:
           <><div className="h-52"><ResponsiveContainer width="100%" height="100%">
             <PieChart><Pie data={summary.statuses} dataKey="count" nameKey="name" outerRadius={78} innerRadius={43}>
               {summary.statuses.map((s,i)=><Cell key={s.key} fill={COLORS[i%COLORS.length]}/>)}
             </Pie><Tooltip/></PieChart>
           </ResponsiveContainer></div>
           <div className="space-y-2">{summary.statuses.map((s,i)=>
             <div key={s.key} className="flex justify-between text-xs"><span className="flex gap-2 items-center">
               <i className="w-2.5 h-2.5 rounded-full" style={{background:COLORS[i%COLORS.length]}}/>{s.name}</span>
               <strong>{s.count}</strong></div>)}</div></>}
        </section>
      </div>
      <section className="border rounded-xl bg-white p-4 overflow-x-auto">
        <h3 className="font-bold text-[#073b2d] text-sm mb-3">Ringkasan Sekolah — Periode {formatDate(period.start)} s.d. {formatDate(period.end)}</h3>
        <table className="w-full min-w-[600px] text-xs"><thead><tr>
          {['Sekolah','Pemasukan','Pengeluaran','Selisih Arus Kas','Opname Jumat Terakhir'].map(h=><th key={h} className="border px-2 py-2 text-left">{h}</th>)}
        </tr></thead><tbody>{summary.schoolEntries.map(s=><tr key={s.id}>
          <td className="border px-2 py-2">{s.name}</td><td className="border px-2 py-2">{money(s.pemasukan)}</td>
          <td className="border px-2 py-2">{money(s.pengeluaran)}</td><td className="border px-2 py-2">{money(s.pemasukan-s.pengeluaran)}</td>
          <td className="border px-2 py-2">{summary.lastCounts.get(s.id)?.week_ending?formatDate(summary.lastCounts.get(s.id)!.week_ending):'Belum ada'}</td>
        </tr>)}</tbody></table>
      </section>
      <p className="text-xs text-gray-500">Data bersumber dari tabel BKU, cash opname mingguan, dan LPJ yang benar-benar tersimpan. Nilai nol berarti belum ada transaksi pada periode yang dipilih. Dashboard hanya menampilkan sekolah yang diizinkan oleh akun Anda.</p>
     </>}
  </div>;
};
