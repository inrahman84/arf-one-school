import React from 'react';
import {
  User,
  Shield,
  School as SchoolIcon,
  MapPin,
  Sparkles,
  LogOut,
  Building
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { School, Region } from '../../types';

interface AccountSettingsViewProps {
  schools: School[];
  regions: Region[];
}

export const AccountSettingsView: React.FC<AccountSettingsViewProps> = ({ schools, regions }) => {
  const { currentUser, userProfile, effectiveRole, simulatedRole, logout } = useAuth();

  return (
    <div className="max-w-4xl space-y-6 pb-12">
      {/* Profile Overview Card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-[#073b2d] text-white flex items-center justify-center font-black text-2xl uppercase shadow-md shrink-0">
            {(userProfile?.displayName || currentUser?.displayName || 'A').charAt(0)}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">
                {userProfile?.displayName || currentUser?.displayName || 'Pengguna ARF'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#073b2d] text-white">
                {effectiveRole}
              </span>
              {simulatedRole && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  Mode Simulasi
                </span>
              )}
            </div>
            <p className="text-xs text-[#5f5d5d]">{currentUser?.email || userProfile?.email}</p>
            <p className="text-xs text-gray-700 font-medium">{userProfile?.position || 'Staf Yayasan'}</p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100 text-xs">
          <div>
            <span className="text-[#5f5d5d] block">Identitas Akun Google (UID):</span>
            <span className="font-mono text-gray-800 break-all">{currentUser?.uid || userProfile?.uid}</span>
          </div>

          <div>
            <span className="text-[#5f5d5d] block">Status Otorisasi Akun:</span>
            <span className="font-bold text-emerald-700">
              {userProfile?.status === 'ACTIVE' ? 'Aktif & Terverifikasi' : (userProfile?.status || 'Aktif')}
            </span>
          </div>

          <div>
            <span className="text-[#5f5d5d] block">Wilayah yang Ditugaskan:</span>
            <span className="font-medium text-gray-800">
              {effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'FOUNDATION_MANAGER'
                ? 'Semua Regional (Akses Nasional)'
                : userProfile?.assignedRegions && userProfile.assignedRegions.length > 0
                ? userProfile.assignedRegions.join(', ')
                : 'Mengikuti sekolah yang ditugaskan'}
            </span>
          </div>

          <div>
            <span className="text-[#5f5d5d] block">Sekolah yang Ditugaskan:</span>
            <span className="font-medium text-gray-800">
              {effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'FOUNDATION_MANAGER'
                ? 'Semua Unit Sekolah ARF (Akses Penuh)'
                : userProfile?.assignedSchools && userProfile.assignedSchools.length > 0
                ? userProfile.assignedSchools.map(sid => {
                    const sch = schools.find(s => s.school_id === sid);
                    return sch?.school_name || sid;
                  }).join(', ')
                : 'Belum ditentukan'}
            </span>
          </div>
        </div>
      </div>

      {/* Institutional Metadata Card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Building className="w-4 h-4 text-[#073b2d]" />
          <h3 className="text-sm font-bold text-gray-900">Informasi Kelembagaan Yayasan</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
            <span className="text-[11px] text-[#5f5d5d]">Yayasan Pengelola</span>
            <div className="font-bold text-gray-900 text-sm">Abdul Rasyid Foundation (ARF)</div>
            <div className="text-[11px] text-[#c89b55] font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>One Foundation. One Standard. Better Schools.</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
            <span className="text-[11px] text-[#5f5d5d]">Versi Aplikasi</span>
            <div className="font-bold text-gray-900 text-sm">1.0 &mdash; Wave 1 (Produksi)</div>
            <div className="text-[11px] text-[#5f5d5d]">Fokus: Profil Sekolah, Rombel, PTK, Aset, Verifikasi</div>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar dari Akun</span>
          </button>
        </div>
      </div>
    </div>
  );
};
