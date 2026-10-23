import * as XLSX from 'xlsx';
import { StudentRecord, Semester } from '../types';

/** Dapodik report layout: title rows 1-4, headings row 5, subheadings row 6. */
export type DapodikPreview = {
  schoolLabel: string;
  snapshotDate: string;
  rows: Array<Pick<StudentRecord,'full_name'|'nisn'|'nipd'|'gender'|'source_rombel'|'grade_hint'>>;
  rejected: number;
  duplicate: number;
  unexpectedGender: number;
  rombelLabels: string[];
};

const value=(x:unknown)=>String(x??'').trim();
export const normalizeSchoolLabel=(s:string)=>s.toUpperCase().replace(/\b(SWASTA|SDS|SD|SEKOLAH|DASAR)\b/g,'').replace(/[^A-Z0-9]/g,'');
export const gradeFromRombel=(label:string)=>{
  const hit=label.match(/\b(?:KELAS|TINGKAT)\s*(\d{1,2})\b/i);
  return hit?'Kelas '+hit[1]:'';
};

export async function readDapodikRoster(file:File):Promise<DapodikPreview>{
  if(!/\.xlsx?$/i.test(file.name) || file.size>10_000_000)throw new Error('Pilih file Dapodik XLSX/XLS maksimum 10 MB.');
  const bytes=await file.arrayBuffer();
  const book=XLSX.read(bytes,{type:'array',cellDates:false});
  const first=book.Sheets[book.SheetNames[0]];
  if(!first)throw new Error('File tidak memiliki lembar kerja.');
  const grid=XLSX.utils.sheet_to_json<unknown[]>(first,{header:1,defval:'',raw:false});
  const index=grid.findIndex(row=>value(row[0])==='No'&&value(row[1])==='Nama'&&value(row[3])==='JK'&&value(row[4])==='NISN');
  if(index<0)throw new Error('Header Dapodik tidak sesuai. Diperlukan kolom No, Nama, JK, NISN pada laporan Daftar Peserta Didik.');
  const header=grid[index].map(value);
  const genderColumn=header.indexOf('JK'), nisnColumn=header.indexOf('NISN'), nipdColumn=header.indexOf('NIPD');
  const rombelColumn=header.indexOf('Rombel Saat Ini');
  if(rombelColumn<0)throw new Error('Kolom Rombel Saat Ini tidak ditemukan dalam laporan.');
  let rejected=0,duplicate=0,unexpectedGender=0;
  const seen=new Set<string>();
  const rows:DapodikPreview['rows']=[];
  for(const row of grid.slice(index+2)){
    const full_name=value(row[1]); if(!full_name)continue;
    const gender=value(row[genderColumn]).toUpperCase();
    const nisn=value(row[nisnColumn]).replace(/\D/g,'');
    const nipd=value(row[nipdColumn]);
    const source_rombel=value(row[rombelColumn]);
    if(!['L','P'].includes(gender)){unexpectedGender++;rejected++;continue;}
    const key=nisn?'NISN:'+nisn:nipd?'NIPD:'+nipd:'NAME:'+full_name.toUpperCase()+':'+source_rombel;
    if(seen.has(key)){duplicate++;continue;}
    seen.add(key);
    rows.push({full_name,nisn,nipd,gender:gender as 'L'|'P',source_rombel,grade_hint:gradeFromRombel(source_rombel)});
  }
  if(!rows.length)throw new Error('Tidak ada baris peserta didik yang memenuhi validasi.');
  const heading=grid.slice(0,index);
  const schoolLabel=value(heading[1]?.[0]) || '';
  const line=heading.map(r=>r.map(value).join(' ')).join(' ');
  const date=line.match(/Tanggal Unduh:\s*(\d{4}-\d{2}-\d{2})/i)?.[1] || new Date().toISOString().slice(0,10);
  return {schoolLabel,snapshotDate:date,rows,rejected,duplicate,unexpectedGender,rombelLabels:[...new Set(rows.map(x=>x.source_rombel))].sort((a,b)=>a.localeCompare(b,'id'))};
}

/** Never place names, NISN, NIPD or uploaded spreadsheets into GitHub or client logs. */
export async function makeStudentId(schoolId:string,row:Pick<StudentRecord,'full_name'|'nisn'|'nipd'|'gender'>):Promise<string>{
  const unique=row.nisn?'NISN:'+row.nisn:row.nipd?'NIPD:'+row.nipd:'NAME:'+row.full_name.trim().toUpperCase()+':'+row.gender;
  const bytes=new TextEncoder().encode(schoolId+'|'+unique);
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return 'PD-'+Array.from(new Uint8Array(hash)).slice(0,16).map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function rosterCounts(rows:StudentRecord[],classId?:string,year?:string,semester?:Semester){
  const subset=rows.filter(s=>(!classId||s.class_id===classId)&&(!year||s.academic_year===year)&&(!semester||s.semester===semester));
  return {male:subset.filter(s=>s.gender==='L').length,female:subset.filter(s=>s.gender==='P').length,total:subset.length,unassigned:subset.filter(s=>!s.class_id).length};
}
