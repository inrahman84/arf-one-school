import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')||'';
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const EXPECTED_PROJECT_REF='tyonogxpoyzzzuxiwpwc';
const SITE_URL=Deno.env.get('ARF_ONE_SCHOOL_SITE_URL')||'https://arf-one-school.vercel.app';
const SHARED_PROJECT_REF='ovfygxeqgpjezdhbidmo';
const allowedRoles=new Set([
 'SUPER_ADMIN','FOUNDATION_MANAGER','REGIONAL_LEAD','SCHOOL_PRINCIPAL',
 'SCHOOL_OPERATOR','HR_OFFICER','ASSET_OFFICER'
]);
const allowedStatuses=new Set(['ACTIVE','INVITED','INACTIVE']);
const admin=createClient(SUPABASE_URL,SERVICE_KEY,{
 auth:{autoRefreshToken:false,persistSession:false}
});
const failure=(message:string,status=400)=>({status,message});
const originAllowed=(origin:string|null)=>!origin||
 origin==='https://arf-one-school.vercel.app'||
 /^http:\/\/localhost:(3000|5173)$/.test(origin);
const headers=(origin:string|null)=>({
 'Content-Type':'application/json',
 'Cache-Control':'no-store',
 'Access-Control-Allow-Origin':origin||'https://arf-one-school.vercel.app',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Vary':'Origin'
});
const response=(value:Record<string,unknown>,status:number,origin:string|null)=>
 new Response(JSON.stringify(value),{status,headers:headers(origin)});
const validPassword=(value:unknown)=>typeof value==='string'&&value.length>=12&&
 value.length<=128&&/[a-zA-Z]/.test(value)&&/\d/.test(value);
const str=(value:unknown,max=150)=>typeof value==='string'?value.trim().slice(0,max):'';
const scopes=(value:unknown)=>Array.isArray(value)&&value.length<=300&&
 value.every(v=>typeof v==='string'&&v.length>0&&v.length<=128)
 ? [...new Set(value)] : null;
const authUserByEmail=async(email:string)=>{
 for(let page=1;page<=20;page++){
   const {data,error}=await admin.auth.admin.listUsers({page,perPage:200});
   if(error)throw failure('Tidak dapat membaca daftar akun Auth.',503);
   const found=data.users.find(u=>u.email?.toLowerCase()===email);
   if(found)return found;
   if(data.users.length<200)break;
 }
 return null;
};
const membership=(user_id:string)=>admin.from('arf_school_members')
 .select('user_id,email,role,status,deleted_at')
 .eq('user_id',user_id).maybeSingle();
const activeAdminCount=async()=>{
 const {count,error}=await admin.from('arf_school_members')
  .select('user_id',{count:'exact',head:true})
  .eq('role','SUPER_ADMIN').eq('status','ACTIVE').is('deleted_at',null);
 if(error)throw failure('Tidak dapat memeriksa Super Admin aktif.',503);
 return count||0;
};
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin');
 if(!originAllowed(origin))return response({error:'Origin tidak diizinkan.'},403,null);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
 if(req.method!=='POST')return response({error:'Method not allowed'},405,origin);
 try{
   const ref=/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(SUPABASE_URL)?.[1];
   if(!SUPABASE_URL||!SERVICE_KEY||!EXPECTED_PROJECT_REF||!ref||
     ref!==EXPECTED_PROJECT_REF||ref===SHARED_PROJECT_REF)
     throw failure('Layanan admin harus menggunakan Supabase khusus ARF One School, bukan proyek bersama.',503);
   const authHeader=req.headers.get('Authorization')||'';
   if(!/^Bearer \S+$/.test(authHeader))throw failure('Harus login sebagai Super Admin.',401);
   const token=authHeader.slice(7);
   const {data:{user},error:authError}=await admin.auth.getUser(token);
   if(authError||!user)throw failure('Sesi tidak valid. Silakan login ulang.',401);
   const {data:actor,error:actorError}=await membership(user.id);
   if(actorError||!actor||actor.role!=='SUPER_ADMIN'||
      actor.status!=='ACTIVE'||actor.deleted_at)
     throw failure('Hanya Super Admin aktif yang dapat mengelola pengguna.',403);
   const size=Number(req.headers.get('content-length')||'0');
   if(size>32768)throw failure('Payload terlalu besar.',413);
   const body=await req.json() as Record<string,unknown>;
   const action=str(body.action,40);
   const userId=str(body.userId,80);
   if(action==='create'){
     const email=str(body.email,320).toLowerCase();
     const displayName=str(body.displayName);
     const role=str(body.role,40)||'SCHOOL_OPERATOR';
     const schoolIds=scopes(body.assignedSchools);
     const regionIds=scopes(body.assignedRegions);
     const position=str(body.position);
     if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!displayName)
       throw failure('Email dan nama lengkap wajib diisi dengan format yang valid.');
     if(!allowedRoles.has(role)||schoolIds===null||regionIds===null)
       throw failure('Peran atau lingkup sekolah/wilayah tidak valid.');
     const deliveryMode=str(body.deliveryMode,24)==='PASSWORD'?'PASSWORD':'INVITE';
     if(deliveryMode==='PASSWORD'&&!validPassword(body.password))
       throw failure('Kata sandi minimal 12 karakter, mengandung huruf dan angka.');
     let target=await authUserByEmail(email);
     let newlyCreated=false;
     if(!target){
       if(deliveryMode==='INVITE'){
         // inviteUserByEmail sends an ACTUAL invitation email; createUser does not.
         const {data,error}=await admin.auth.admin.inviteUserByEmail(email,{
           data:{full_name:displayName},redirectTo:SITE_URL+'/?setup_password=1'
         });
         if(error||!data.user)
           throw failure('Email undangan belum terkirim: '+(error?.message||'Periksa SMTP/redirect URL'),503);
         target=data.user;
       }else{
         const {data,error}=await admin.auth.admin.createUser({
           email,password:String(body.password),email_confirm:true,
           user_metadata:{full_name:displayName}
         });
         if(error||!data.user)
           throw failure('Gagal membuat akun Auth: '+(error?.message||'Unknown'),409);
         target=data.user;
       }
       newlyCreated=true;
     }
     const current=await membership(target.id);
     if(current.error)throw failure('Tidak dapat memeriksa profil ARF.',503);
     if(current.data?.deleted_at)throw failure('Akun telah dihapus dari ARF. Hubungi administrator untuk pemulihan.',409);
     if(!newlyCreated && current.data&&current.data.status==='ACTIVE'){
       throw failure('Akun sudah terdaftar di ARF One School. Gunakan Edit untuk mengubah otorisasi.',409);
     }
     const {error}=await admin.from('arf_school_members').upsert({
       user_id:target.id,email,
       display_name:displayName,position,role,
       assigned_schools:role==='SUPER_ADMIN'||role==='FOUNDATION_MANAGER'?[]:schoolIds,
       assigned_regions:role==='SUPER_ADMIN'||role==='FOUNDATION_MANAGER'?[]:regionIds,
       status:'ACTIVE',deleted_at:null,updated_at:new Date().toISOString()
     },{onConflict:'user_id'});
     if(error){
       if(newlyCreated)await admin.from('arf_school_members').update({
         status:'INACTIVE',assigned_schools:[],assigned_regions:[]
       }).eq('user_id',target.id);
       throw failure('Akun Auth dibuat, tetapi profil ARF gagal disimpan. Periksa kembali: '+error.message,500);
     }
     // If a temporary password was created, email a link to set a fresh password.
     // Existing Auth account is never silently changed and also receives a link.
     const sendRecovery=deliveryMode==='PASSWORD'||!newlyCreated;
     if(sendRecovery){
       const {error:mailError}=await admin.auth.resetPasswordForEmail(email,{
         redirectTo:SITE_URL+'/?setup_password=1'
       });
       if(mailError)throw failure(
         'Akun sudah tersimpan, tetapi email pengaturan sandi gagal: '+mailError.message+
         '. Periksa SMTP dan URL redirect; jangan membuat akun ganda.',503);
     }
     return response({ok:true,createdAuth:newlyCreated,emailSent:true,
       message:sendRecovery
         ? 'Akun ARF tersimpan dan email pengaturan ulang sandi berhasil diminta.'
         : 'Akun ARF tersimpan dan undangan email berhasil diminta. Pengguna perlu membuka tautan untuk membuat sandi.'
     },200,origin);
   }
   if(action==='cancelInvitation'){
     const invitationId=str(body.invitationId,80);
     if(!/^[0-9a-f-]{36}$/i.test(invitationId))
       throw failure('ID undangan tidak valid.');
     const {data:row,error:lookupError}=await admin.from('arf_school_documents')
       .select('path,content').eq('collection_path','userInvitations')
       .eq('doc_id',invitationId).maybeSingle();
     if(lookupError||!row)throw failure('Undangan tidak ditemukan pada proyek ARF One School.',404);
     if(row.content?.status!=='PENDING')
       throw failure('Hanya undangan berstatus Pending yang dapat dibatalkan.',409);
     const {data:changed,error:writeError}=await admin.from('arf_school_documents')
       .update({content:{...row.content,status:'REVOKED',revokedAt:new Date().toISOString(),revokedBy:user.id}})
       .eq('path',row.path).eq('content->>status','PENDING')
       .select('path').maybeSingle();
     if(writeError||!changed)throw failure('Undangan telah diubah oleh pengguna lain. Muat ulang daftar.',409);
     return response({ok:true,message:'Undangan pending berhasil dibatalkan.'},200,origin);
   }
   if(!userId||userId.length!==36)throw failure('Pilih pengguna yang valid.');
   const {data:target,error:targetError}=await membership(userId);
   if(targetError||!target||target.deleted_at)throw failure('Pengguna ARF tidak ditemukan.',404);
   const isSelf=userId===user.id;
   const isBootstrap=target.email?.toLowerCase()==='iswahyudhi.r@sumbermassarana.sch.id';
   const lastAdmin=target.role==='SUPER_ADMIN'&&await activeAdminCount()<=1;
   if(action==='update'){
     const role=str(body.role,40),status=str(body.status,20);
     const assignedSchools=scopes(body.assignedSchools),
       assignedRegions=scopes(body.assignedRegions);
     const displayName=str(body.displayName);
     const position=str(body.position);
     if(!allowedRoles.has(role)||!allowedStatuses.has(status)||
       !displayName||assignedSchools===null||assignedRegions===null)
       throw failure('Data pengguna tidak lengkap/valid.');
     if(isSelf&&(role!=='SUPER_ADMIN'||status!=='ACTIVE'))
       throw failure('Super Admin tidak boleh menurunkan peran atau menonaktifkan akun sendiri.');
     if(isBootstrap&&(role!=='SUPER_ADMIN'||status!=='ACTIVE'))
       throw failure('Peran dan status akun bootstrap Super Admin dilindungi.');
     if(lastAdmin&&(role!=='SUPER_ADMIN'||status!=='ACTIVE'))
       throw failure('Super Admin aktif terakhir tidak boleh dinonaktifkan.');
     const {error}=await admin.from('arf_school_members').update({
       display_name:displayName,position,role,status,
       assigned_schools:['SUPER_ADMIN','FOUNDATION_MANAGER'].includes(role)?[]:assignedSchools,
       assigned_regions:['SUPER_ADMIN','FOUNDATION_MANAGER'].includes(role)?[]:assignedRegions,
       updated_at:new Date().toISOString()
     }).eq('user_id',userId).is('deleted_at',null);
     if(error)throw failure('Gagal memperbarui otorisasi pengguna: '+error.message,500);
     return response({ok:true},200,origin);
   }
   if(action==='setStatus'){
     const status=str(body.status,20);
     if(!allowedStatuses.has(status))throw failure('Status tidak valid.');
     if(isSelf&&status!=='ACTIVE')throw failure('Tidak dapat menonaktifkan diri sendiri.');
     if(isBootstrap&&status!=='ACTIVE')throw failure('Akun bootstrap Super Admin dilindungi.');
     if(lastAdmin&&status!=='ACTIVE')throw failure('Super Admin terakhir wajib aktif.');
     const {error}=await admin.from('arf_school_members').update({
       status,updated_at:new Date().toISOString()
     }).eq('user_id',userId).is('deleted_at',null);
     if(error)throw failure('Gagal mengubah status pengguna.',500);
     return response({ok:true},200,origin);
   }
   if(action==='setPassword'){
     if(!validPassword(body.password))
       throw failure('Sandi baru minimal 12 karakter, mengandung huruf dan angka.');
     if(isSelf)throw failure('Ubah sandi sendiri melalui pengaturan akun, bukan fitur admin.');
     const {error}=await admin.auth.admin.updateUserById(userId,{password:String(body.password)});
     if(error)throw failure('Gagal menyimpan sandi baru: '+error.message,500);
     return response({ok:true,message:'Sandi baru disimpan. Berikan kepada pengguna melalui saluran yang aman.'},200,origin);
   }
   if(action==='remove'){
     if(isBootstrap)throw failure('Akun bootstrap Super Admin tidak dapat dihapus.');
     if(isSelf)throw failure('Tidak dapat menghapus akses ARF milik sendiri.');
     if(lastAdmin)throw failure('Super Admin aktif terakhir tidak dapat dihapus.');
     const {error}=await admin.from('arf_school_members').update({
       status:'INACTIVE',deleted_at:new Date().toISOString(),
       assigned_schools:[],assigned_regions:[],
       updated_at:new Date().toISOString()
     }).eq('user_id',userId).is('deleted_at',null);
     if(error)throw failure('Gagal menghapus akses ARF pengguna: '+error.message,500);
     // Shared Auth instance: deliberately do NOT delete auth.users or their other-app data.
     return response({ok:true,message:'Akses ke ARF One School dicabut. Akun Auth aplikasi lain tidak dihapus.'},200,origin);
   }
   throw failure('Aksi tidak dikenal.',400);
 }catch(err){
   const issue=err as {status?:number;message?:string};
   // Avoid echoing request body, credentials or token.
   return response({error:issue.message||'Operasi gagal.'},issue.status||500,origin);
 }
});
