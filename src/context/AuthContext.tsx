import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { authService, BOOTSTRAP_ADMIN_EMAIL } from '../services/authService';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  currentUser: { uid: string; email: string | null; displayName: string | null } | null;
  userProfile: UserProfile | null;
  loading: boolean;
  effectiveRole: UserRole;
  setSimulatedRole: (role: UserRole | null) => void;
  simulatedRole: UserRole | null;
  isSuperAdmin: boolean;
  isFoundationManager: boolean;
  isRegionalLead: boolean;
  isPrincipal: boolean;
  isOperator: boolean;
  isHROfficer: boolean;
  isAssetOfficer: boolean;
  hasSchoolAccess: (schoolId: string) => boolean;
  hasRegionAccess: (regionId: string) => boolean;
  canVerify: () => boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name: string) => Promise<{confirmationRequired:boolean}>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<{ uid: string; email: string | null; displayName: string | null } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);

  useEffect(() => {
    let alive=true;
    const resolve=async () => {
      const {data:{user},error}=await supabase.auth.getUser();
      if(!alive)return;
      if(error || !user){setCurrentUser(null);setUserProfile(null);setLoading(false);return;}
      try {
        const profile=await authService.resolveOrCreateUserProfile(user);
        if(!alive)return;
        setUserProfile(profile);
        setCurrentUser({uid:profile.uid,email:profile.email,displayName:profile.displayName});
      } catch(err) {
        console.warn('ARF membership rejected:',err);
        setCurrentUser({uid:user.id,email:user.email||null,displayName:user.email||null});
        setUserProfile(null);
      } finally { if(alive)setLoading(false); }
    };
    void resolve();
    const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{void resolve();});
    return ()=>{alive=false;subscription.unsubscribe();};
  }, []);
  const loginWithGoogle=async()=>{await authService.signInWithGoogle();};
  const loginWithEmail=async(email:string)=>{await authService.signInWithAuthorizedEmail(email);};
  const loginWithPassword=async(email:string,password:string)=>{await authService.signInWithPassword(email,password);};
  const registerWithEmail=async(email:string,password:string,name:string)=>{
    return authService.registerWithEmail(email,password,name);
  };
  const logout=async()=>{await authService.signOutUser();setCurrentUser(null);setUserProfile(null);setSimulatedRole(null);};
  const refreshProfile=async()=>{if(!currentUser?.uid)return;const p=await authService.getUserProfile(currentUser.uid);if(p)setUserProfile(p);};

  const actualRole = userProfile?.role || 'SCHOOL_OPERATOR';
  const effectiveRole: UserRole = (userProfile?.role === 'SUPER_ADMIN' && simulatedRole)
    ? simulatedRole
    : actualRole;

  const isSuperAdmin = effectiveRole === 'SUPER_ADMIN';
  const isFoundationManager = isSuperAdmin || effectiveRole === 'FOUNDATION_MANAGER';
  const isRegionalLead = effectiveRole === 'REGIONAL_LEAD';
  const isPrincipal = effectiveRole === 'SCHOOL_PRINCIPAL';
  const isOperator = effectiveRole === 'SCHOOL_OPERATOR';
  const isHROfficer = effectiveRole === 'HR_OFFICER';
  const isAssetOfficer = effectiveRole === 'ASSET_OFFICER';

  const hasSchoolAccess = (schoolId: string): boolean => {
    if (!userProfile) return false;
    if (isFoundationManager) return true;
    if (userProfile.assignedSchools && userProfile.assignedSchools.includes(schoolId)) {
      return true;
    }
    if (simulatedRole && (!userProfile.assignedSchools || userProfile.assignedSchools.length === 0)) {
      return true;
    }
    return false;
  };

  const hasRegionAccess = (regionId: string): boolean => {
    if (!userProfile) return false;
    if (isFoundationManager) return true;
    if (userProfile.assignedRegions && userProfile.assignedRegions.includes(regionId)) {
      return true;
    }
    if (simulatedRole && (!userProfile.assignedRegions || userProfile.assignedRegions.length === 0)) {
      return true;
    }
    return false;
  };

  const canVerify = (): boolean => {
    return isFoundationManager || isRegionalLead;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        effectiveRole,
        setSimulatedRole,
        simulatedRole,
        isSuperAdmin,
        isFoundationManager,
        isRegionalLead,
        isPrincipal,
        isOperator,
        isHROfficer,
        isAssetOfficer,
        hasSchoolAccess,
        hasRegionAccess,
        canVerify,
        loginWithGoogle,
        loginWithEmail,
        loginWithPassword,
        registerWithEmail,
        logout,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
