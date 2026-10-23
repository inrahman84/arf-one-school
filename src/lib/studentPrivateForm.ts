import {StudentFamilyMember,StudentPrivateDetails} from '../types';

export const RELIGIONS=['Islam','Kristen','Katolik','Hindu','Buddha','Konghucu'] as const;
export const LIVING_OPTIONS=['Bersama Orang Tua','Wali','Kost','Asrama','Panti Asuhan','Lainnya'] as const;
export const TRANSPORT_OPTIONS=['Jalan kaki','Kendaraan pribadi','Kendaraan umum','Jemputan sekolah','Kereta api','Ojek','Becak','Perahu Penyeberangan/Rakit','Lainnya'] as const;
export const EDUCATION_OPTIONS=['Tidak Sekolah','PAUD','SD/Sederajat','SMP/Sederajat','SMA/Sederajat','D1','D2','D3','D4/S1','S2','S3'] as const;
export const JOB_OPTIONS=['Tidak Bekerja','Nelayan','Petani','Peternak','PNS/TNI/Polri','Karyawan Swasta','Pedagang Kecil','Pedagang Besar','Wiraswasta','Wirausaha','Buruh','Pensiunan','Sudah Meninggal Dunia','Lainnya'] as const;
export const PIP_REASONS=['Pemegang PKH/KPS/KKS','Siswa Miskin/Rentan Miskin','Yatim Piatu/Panti Asuhan/Panti Sosial','Dampak Bencana Alam','Pernah Drop Out (DO)','Kelainan Fisik (Disabilitas)','Daerah Konflik','Keluarga Terpidana/Berada di LAPAS','Lainnya'] as const;
export const SPECIAL_NEEDS=['Tidak Ada','A - Tuna Netra','B - Tuna Rungu','C - Tuna Grahita Ringan','C1 - Tuna Grahita Sedang','D - Tuna Daksa Ringan','D1 - Tuna Daksa Sedang','E - Tuna Laras','F - Tuna Wicara','G - Tuna Ganda','H - Hiperaktif','I - Cerdas Istimewa','J - Bakat Istimewa','K - Kesulitan Belajar','N - Narkoba','Autis','Down Syndrome'] as const;
export const YES_NO=['Tidak','Ya'] as const;
export const blankFamily=():StudentFamilyMember=>({name:'',birth_year:'',education:'',occupation:'',occupation_other:'',income:'',nik:''});
export function blankPrivate(student_id:string,school_id:string):StudentPrivateDetails{
 return {
  student_id,school_id,birth_place:'',birth_date:'',nik:'',religion:'',address:'',rt:'',rw:'',hamlet:'',
  urban_village:'',district:'',postal_code:'',living_arrangement:'',transport:'',phone:'',mobile:'',email:'',
  skhun:'',kps_recipient:'Tidak',kps_number:'',father:blankFamily(),mother:blankFamily(),guardian:blankFamily(),
  national_exam_number:'',diploma_serial:'',kip_recipient:'Tidak',kip_flag:0,kip_number:'',kip_name:'',
  kks_number:'',birth_certificate_number:'',pip_received:'Tidak',pip_eligible:'Tidak',pip_reason:'',
  special_needs:'Tidak Ada',previous_school:'',birth_order:'',family_card_number:'',bank:'',bank_account:'',
  bank_account_name:'',latitude:null,longitude:null,weight_kg:'',height_cm:'',head_circumference_cm:'',
  siblings_count:'',distance_km:'',updated_at:''
 };
}
export function sanitizeDetails(input:StudentPrivateDetails):StudentPrivateDetails{
 const d={...input,father:{...input.father},mother:{...input.mother},guardian:{...input.guardian}};
 d.kip_flag=d.kip_recipient==='Ya'?1:0;
 if(d.kip_recipient!=='Ya'){d.kip_number='';d.kip_name='';d.pip_received='Tidak'}
 if(d.kps_recipient!=='Ya')d.kps_number='';
 if(d.pip_received!=='Ya' || d.kip_recipient!=='Ya'){d.bank='';d.bank_account='';d.bank_account_name=''}
 if(d.pip_eligible!=='Ya')d.pip_reason='';
 if(d.living_arrangement==='Bersama Orang Tua'){d.guardian=blankFamily()}
 else {d.father=blankFamily();d.mother=blankFamily()}
 for(const key of ['father','mother','guardian'] as const){
  if(d[key].occupation==='Sudah Meninggal Dunia')d[key].income='';
  if(d[key].occupation!=='Lainnya')d[key].occupation_other='';
 }
 return d;
}
export function validateDetails(d:StudentPrivateDetails,educationLevel:string):string|null{
 const number=(s:string)=>s.trim();
 for(const [label,value,length] of [['NIK',d.nik,16],['Nomor KK',d.family_card_number,16]] as const){
  if(value && !new RegExp('^\\d{'+length+'}$').test(value))return label+' harus terdiri atas '+length+' digit angka.';
 }
 for(const family of [d.father,d.mother,d.guardian]){
  if(family.nik&&!/^\d{16}$/.test(family.nik))return 'NIK orang tua/wali harus 16 digit angka.';
  if(family.birth_year && (!/^\d{4}$/.test(family.birth_year)||Number(family.birth_year)>new Date().getFullYear()))
   return 'Tahun lahir orang tua/wali tidak valid.';
  if(family.occupation==='Lainnya'&&!family.occupation_other.trim())
   return 'Pekerjaan Lainnya harus diisi manual.';
 }
 if(d.kps_recipient==='Ya'&&!d.kps_number.trim())return 'Nomor KPS wajib diisi bila Penerima KPS Ya.';
 if(d.kip_recipient==='Ya'&&!d.kip_number.trim())return 'Nomor KIP wajib diisi bila Penerima KIP Ya.';
 if(d.pip_eligible==='Ya'&&!d.pip_reason)return 'Pilih Alasan Layak PIP.';
 if(d.birth_date && d.birth_date>new Date().toISOString().slice(0,10))return 'Tanggal lahir tidak boleh di masa depan.';
 if(d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))return 'Format email tidak valid.';
 for(const [label,value] of [['Berat badan',d.weight_kg],['Tinggi badan',d.height_cm],['Lingkar kepala',d.head_circumference_cm],['Jarak rumah',d.distance_km]] as const){
  if(value && (!Number.isFinite(Number(value))||Number(value)<0))return label+' tidak valid.';
 }
 if(d.latitude!==null&&(d.latitude< -90||d.latitude>90))return 'Lintang tidak valid.';
 if(d.longitude!==null&&(d.longitude< -180||d.longitude>180))return 'Bujur tidak valid.';
 return null;
}
export const supportsHeadCircumference=(level:string)=>['TPA','TK','SD'].includes(level);
