import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { collection, doc, getDocs, setDoc, updateDoc, query, where } from '../lib/documentStore';
import { db } from '../lib/backend';
import type { UserProfile, UserInvitation, UserRole, UserStatus } from '../types';
// Google OAuth requires an enabled Supabase provider and an approved Google Cloud OAuth client.
export const GOOGLE_OAUTH_ENABLED = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === 'true';
export const BOOTSTRAP_ADMIN_EMAIL = 'iswahyudhi.r@sumbermassarana.sch.id';
type Member = {user_id:string;email:string;display_name:string;position:string|null;role:UserRole;assigned_regions:string[];assigned_schools:string[];status:UserStatus;deleted_at?:string|null;created_at:string;updated_at:string};
function toProfile(m:Member):UserProfile {return {uid:m.user_id,email:m.email,displayName:m.display_name,
  position:m.position || '',role:m.role,assignedRegions:m.assigned_regions||[],assignedSchools:m.assigned_schools||[],
  status:m.status,createdAt:m.created_at,updatedAt:m.updated_at};}
export const authService = {
  async signInWithGoogle():Promise<void> {
    if(!GOOGLE_OAUTH_ENABLED) {
      throw new Error('Login Google belum aktif. Gunakan email dan kata sandi, atau hubungi administrator.');
    }
    const {error} = await supabase.auth.signInWithOAuth({
      provider:'google', options:{redirectTo:window.location.origin}
    });
    if(error) {
      if(error.message?.includes('provider is not enabled') || error.code === 'validation_failed') {
        throw new Error('Google OAuth belum diaktifkan di Supabase. Silakan login dengan email dan kata sandi.');
      }
      throw error;
    }
  },
  async registerWithEmail(emailInput:string,password:string,displayName:string):Promise<{confirmationRequired:boolean}> {
    const email=emailInput.trim().toLowerCase();
    const name=displayName.trim();
    if(!email || !name) throw new Error('Nama lengkap dan email wajib diisi.');
    if(password.length<10) throw new Error('Kata sandi harus terdiri dari minimal 10 karakter.');
    const {data,error}=await supabase.auth.signUp({
      email,password,
      options:{
        data:{full_name:name},
        emailRedirectTo:window.location.origin
      }
    });
    if(error)throw error;
    return {confirmationRequired:!data.session};
  },
  async signInWithAuthorizedEmail(emailInput:string):Promise<void> {
    const email=emailInput.toLowerCase().trim();
    if(!email) throw new Error('Email harus diisi');
    const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin,shouldCreateUser:false}});
    if(error) throw error;
  },
  async signInWithPassword(emailInput:string,password:string):Promise<void> {
    const email=emailInput.toLowerCase().trim();
    if(!email || !password) throw new Error('Email dan kata sandi harus diisi.');
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error) throw error;
  },
  async signOutUser():Promise<void>{const {error}=await supabase.auth.signOut(); if(error)throw error;},
  async resolveOrCreateUserProfile(user:User):Promise<UserProfile>{
    const {data,error}=await supabase.from('arf_school_members').select('*').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(!data)throw new Error('Akun belum terdaftar untuk ARF One School. Hubungi Super Admin.');
    if(data.deleted_at)throw new Error('Akses ARF One School untuk akun ini telah dicabut.');
    if(data.status!=='ACTIVE')throw new Error('Akun belum aktif. Hubungi Super Admin.');
    return toProfile(data as Member);
  },
  async getUserProfile(uid:string):Promise<UserProfile|null>{
    const {data,error}=await supabase.from('arf_school_members').select('*').eq('user_id',uid).maybeSingle();
    if(error)throw error;return data?toProfile(data as Member):null;
  },
  /** Supabase Edge Function verifies live Auth JWT and ARF Super Admin membership.
   * No service-role key, password log, or Auth Admin API is exposed in the browser. */
  async adminAction(body:Record<string,unknown>):Promise<{ok:boolean;message?:string;createdAuth?:boolean}>{
    const {data,error}=await supabase.functions.invoke('arf-manage-users',{body});
    if(error){
      let message=error.message||'Layanan administrasi pengguna gagal.';
      const context=(error as {context?:Response}).context;
      if(context?.json){
        try{const detail=await context.json() as {error?:string};if(detail.error)message=detail.error;}
        catch{/* Non-JSON gateway response */}
      }
      throw new Error(message);
    }
    if(!data?.ok)throw new Error(String(data?.error||'Perubahan pengguna belum berhasil.'));
    return data as {ok:boolean;message?:string;createdAuth?:boolean};
  },
  async createAuthorizedUser(input:{
    displayName:string;email:string;position:string;role:UserRole;
    assignedSchools:string[];assignedRegions:string[];password:string
  }){
    return this.adminAction({action:'create',...input});
  },
  async updateAuthorizedUser(uid:string,input:{
    displayName:string;position:string;role:UserRole;status:UserStatus;
    assignedSchools:string[];assignedRegions:string[]
  }){
    return this.adminAction({action:'update',userId:uid,...input});
  },
  async createOrResetPassword(uid:string,password:string){
    return this.adminAction({action:'setPassword',userId:uid,password});
  },
  async removeAuthorizedUser(uid:string){
    return this.adminAction({action:'remove',userId:uid});
  },
  async getAllUsers():Promise<UserProfile[]>{
    const {data,error}=await supabase.from('arf_school_members').select('*').order('created_at',{ascending:false});
    if(error)throw error;return (data||[]).filter(x=>!x.deleted_at).map(x=>toProfile(x as Member));
  },
  async updateUserRoleAndScope(uid:string,role:UserRole,assignedSchools:string[],assignedRegions:string[],position?:string):Promise<void>{
    const {error}=await supabase.from('arf_school_members').update({role,assigned_schools:assignedSchools,assigned_regions:assignedRegions,
      ...(position!==undefined?{position}:{}),updated_at:new Date().toISOString()}).eq('user_id',uid);
    if(error)throw error;
  },
  async updateUserStatus(uid:string,status:UserStatus):Promise<void>{
    const {error}=await supabase.from('arf_school_members').update({status,updated_at:new Date().toISOString()}).eq('user_id',uid);
    if(error)throw error;
  },
  async inviteUser(invitation:Omit<UserInvitation,'id'|'createdAt'|'status'>):Promise<string>{
    const id=crypto.randomUUID();
    const invite:UserInvitation={...invitation,id,status:'PENDING',createdAt:new Date().toISOString()};
    await setDoc(doc(db,'userInvitations',id),invite);return id;
  },
  async getAllInvitations():Promise<UserInvitation[]>{
    const snap=await getDocs(collection(db,'userInvitations'));
    return snap.docs.map(d=>d.data() as UserInvitation);
  },
};
