import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { collection, doc, getDocs, setDoc, updateDoc, query, where } from '../lib/documentStore';
import { db } from '../lib/backend';
import type { UserProfile, UserInvitation, UserRole, UserStatus } from '../types';
export const BOOTSTRAP_ADMIN_EMAIL = 'iswahyudhi.r@sumbermassarana.sch.id';
type Member = {user_id:string;email:string;display_name:string;position:string|null;role:UserRole;assigned_regions:string[];assigned_schools:string[];status:UserStatus;created_at:string;updated_at:string};
function toProfile(m:Member):UserProfile {return {uid:m.user_id,email:m.email,displayName:m.display_name,
  position:m.position || '',role:m.role,assignedRegions:m.assigned_regions||[],assignedSchools:m.assigned_schools||[],
  status:m.status,createdAt:m.created_at,updatedAt:m.updated_at};}
export const authService = {
  async signInWithGoogle():Promise<void> {
    const {error} = await supabase.auth.signInWithOAuth({provider:'google', options:{redirectTo:window.location.origin}});
    if(error) throw error;
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
    if(data.status!=='ACTIVE')throw new Error('Akun belum diaktifkan oleh Super Admin.');
    return toProfile(data as Member);
  },
  async getUserProfile(uid:string):Promise<UserProfile|null>{
    const {data,error}=await supabase.from('arf_school_members').select('*').eq('user_id',uid).maybeSingle();
    if(error)throw error;return data?toProfile(data as Member):null;
  },
  async getAllUsers():Promise<UserProfile[]>{
    const {data,error}=await supabase.from('arf_school_members').select('*').order('created_at',{ascending:false});
    if(error)throw error;return (data||[]).map(x=>toProfile(x as Member));
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
