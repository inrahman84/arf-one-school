import React, { useState } from 'react';
import {
  User,
  ShieldAlert,
  Database,
  ChevronDown,
  Sparkles,
  RefreshCw,
  Eye,
  CheckCircle2,
  Building,
  Menu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { seedService } from '../../services/seedService';

interface HeaderProps {
  pageTitle: string;
  pageSubtitle?: string;
  onDataRefresh?: () => void;
  onMenuToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ pageTitle, pageSubtitle, onDataRefresh, onMenuToggle }) => {
  const {
    currentUser,
    userProfile,
    effectiveRole,
    setSimulatedRole,
    simulatedRole,
    logout
  } = useAuth();

  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  const isRealSuperAdmin = userProfile?.role === 'SUPER_ADMIN';

  const roleLabels: Record<UserRole, { label: string; color: string }> = {
    SUPER_ADMIN: { label: 'Super Admin', color: 'bg-emerald-800 text-white' },
    FOUNDATION_MANAGER: { label: 'Foundation Manager', color: 'bg-sky-800 text-white' },
    REGIONAL_LEAD: { label: 'Regional Lead', color: 'bg-indigo-800 text-white' },
    SCHOOL_PRINCIPAL: { label: 'Kepala Sekolah', color: 'bg-[#073b2d] text-white' },
    SCHOOL_OPERATOR: { label: 'Operator Sekolah', color: 'bg-slate-700 text-white' },
    HR_OFFICER: { label: 'HR Officer', color: 'bg-amber-700 text-white' },
    ASSET_OFFICER: { label: 'Asset Officer', color: 'bg-teal-700 text-white' }
  };

  const handleSeedData = async () => {
    if (confirm('Muat data awal institusional Yayasan Abdul Rasyid (Wilayah, Sekolah, Rombel, PTK, Aset, Prasarana)?')) {
      setSeeding(true);
      const res = await seedService.bootstrapInstitutionalData();
      setSeeding(false);
      setSeedNotice(res.message);
      setTimeout(() => setSeedNotice(null), 4000);
      if (onDataRefresh) onDataRefresh();
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-xs">
      <div className="px-3 py-3 sm:px-5 lg:px-6 sm:py-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Mobile navigation trigger and adaptive title */}
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <button type="button" onClick={onMenuToggle}
            aria-label="Buka menu navigasi"
            aria-controls="arf-mobile-nav"
            className="lg:hidden mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-[#073b2d] hover:bg-gray-100">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
          <h2 className="text-base leading-snug sm:text-xl font-bold text-gray-900 tracking-tight break-words">
            {pageTitle}
          </h2>
          {pageSubtitle && (
            <p className="text-[11px] leading-relaxed sm:text-xs text-[#5f5d5d] mt-0.5 font-medium">{pageSubtitle}</p>
          )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:gap-3 lg:w-auto">
          {/* Seed Initial Data Button (Instant bootstrap for evaluators) */}
          {import.meta.env.DEV && <button
            onClick={handleSeedData}
            disabled={seeding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#c89b55] text-[#c89b55] hover:bg-[#c89b55]/10 text-xs font-semibold transition-all disabled:opacity-50"
            title="Muat Data Standar Yayasan ARF ke Supabase"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{seeding ? 'Memuat...' : 'Muat Data Contoh'}</span>
          </button>}

          {/* Role simulation badge & selector for Super Admin */}
          {isRealSuperAdmin && (
            <div className="relative">
              <button
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="flex max-w-full items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-medium border border-gray-300 transition-colors"
                title="Ganti Mode Pengujian Peran (RBAC Preview)"
              >
                <Eye className="w-3.5 h-3.5 text-[#3f6276]" />
                <span className="hidden sm:inline">Simulasi:</span>
                <span className="font-bold text-[#073b2d]">
                  {roleLabels[effectiveRole]?.label || effectiveRole}
                </span>
                <ChevronDown className="w-3 h-3 text-gray-500" />
              </button>

              {roleMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-50">
                  <div className="px-3 py-1 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 mb-1">
                    Uji Hak Akses (RBAC)
                  </div>
                  <button
                    onClick={() => { setSimulatedRole(null); setRoleMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-emerald-50 ${
                      simulatedRole === null ? 'font-bold text-[#073b2d]' : 'text-gray-700'
                    }`}
                  >
                    <span>Peran Asli (Super Admin)</span>
                    {simulatedRole === null && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                  {(Object.keys(roleLabels) as UserRole[]).map((r) => {
                    if (r === 'SUPER_ADMIN') return null;
                    return (
                      <button
                        key={r}
                        onClick={() => { setSimulatedRole(r); setRoleMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-emerald-50 ${
                          simulatedRole === r ? 'font-bold text-[#073b2d]' : 'text-gray-700'
                        }`}
                      >
                        <span>{roleLabels[r].label}</span>
                        {simulatedRole === r && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* User Profile Info */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-gray-200">
            <div className="text-right leading-tight hidden sm:block">
              <div className="text-xs font-bold text-gray-900 truncate max-w-[150px]">
                {userProfile?.displayName || currentUser?.displayName || 'Pengguna ARF'}
              </div>
              <div className="text-[11px] text-[#5f5d5d]">
                {userProfile?.position || roleLabels[effectiveRole]?.label || 'Staf'}
              </div>
            </div>

            <div className="w-8 h-8 rounded-full bg-[#073b2d] text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
              {(userProfile?.displayName || currentUser?.displayName || 'A').charAt(0)}
            </div>
          </div>
        </div>
      </div>

      {/* Instant Notification Banner if seed triggered */}
      {seedNotice && (
        <div className="bg-emerald-50 border-t border-emerald-200 px-6 py-2 text-xs text-emerald-800 font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{seedNotice}</span>
        </div>
      )}
    </header>
  );
};
