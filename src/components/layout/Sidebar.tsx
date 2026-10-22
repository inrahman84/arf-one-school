import React from 'react';
import {
  LayoutDashboard,
  School,
  Users,
  Building2,
  FileSpreadsheet,
  BarChart3,
  ShieldCheck,
  MapPin,
  Settings,
  LogOut,
  ChevronRight,
  Sparkles,
  ClipboardCheck,
  History,
  CalendarDays,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavItemKey =
  | 'dashboard'
  | 'schools'
  | 'enrollment'
  | 'hr'
  | 'assets'
  | 'facilities'
  | 'import'
  | 'verification'
  | 'reports'
  | 'users'
  | 'regions'
  | 'academicYears'
  | 'audit'
  | 'settings';

interface SidebarProps {
  activeTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile
}) => {
  const { userProfile, effectiveRole, isSuperAdmin, isFoundationManager, logout } = useAuth();

  const compact = collapsed && !mobileOpen;

  // Role-based navigation permissions
  const menuSections = [
    {
      title: 'UTAMA',
      items: [
        {
          key: 'dashboard' as NavItemKey,
          label: 'Executive Dashboard',
          icon: LayoutDashboard,
          visible: true
        }
      ]
    },
    {
      title: 'MANAJEMEN SEKOLAH',
      items: [
        {
          key: 'schools' as NavItemKey,
          label: 'Daftar Sekolah',
          icon: School,
          visible: true
        },
        {
          key: 'enrollment' as NavItemKey,
          label: 'Rombel & Peserta Didik',
          icon: Users,
          visible: true
        }
      ]
    },
    {
      title: 'SUMBER DAYA',
      items: [
        {
          key: 'hr' as NavItemKey,
          label: 'Guru & Tenaga Kependidikan',
          icon: Users,
          visible: isFoundationManager || ['REGIONAL_LEAD', 'SCHOOL_PRINCIPAL', 'HR_OFFICER', 'SCHOOL_OPERATOR'].includes(effectiveRole)
        },
        {
          key: 'assets' as NavItemKey,
          label: 'Inventaris Aset',
          icon: Building2,
          visible: isFoundationManager || ['REGIONAL_LEAD', 'SCHOOL_PRINCIPAL', 'ASSET_OFFICER', 'SCHOOL_OPERATOR'].includes(effectiveRole)
        },
        {
          key: 'facilities' as NavItemKey,
          label: 'Sarana & Prasarana',
          icon: Building2,
          visible: isFoundationManager || ['REGIONAL_LEAD', 'SCHOOL_PRINCIPAL', 'ASSET_OFFICER', 'SCHOOL_OPERATOR'].includes(effectiveRole)
        }
      ]
    },
    {
      title: 'DATA & LAPORAN',
      items: [
        {
          key: 'import' as NavItemKey,
          label: 'Import Data Excel',
          icon: FileSpreadsheet,
          visible: true
        },
        {
          key: 'verification' as NavItemKey,
          label: 'Status & Verifikasi',
          icon: ClipboardCheck,
          visible: true
        },
        {
          key: 'reports' as NavItemKey,
          label: 'Laporan & Ekspor Data',
          icon: BarChart3,
          visible: true
        }
      ]
    },
    {
      title: 'ADMINISTRASI SISTEM',
      items: [
        {
          key: 'users' as NavItemKey,
          label: 'Manajemen Pengguna',
          icon: ShieldCheck,
          visible: isSuperAdmin
        },
        {
          key: 'academicYears' as NavItemKey,
          label: 'Master Tahun Ajaran',
          icon: CalendarDays,
          visible: isSuperAdmin
        },
        {
          key: 'regions' as NavItemKey,
          label: 'Manajemen Wilayah',
          icon: MapPin,
          visible: isSuperAdmin
        },
        {
          key: 'audit' as NavItemKey,
          label: 'Log Audit Keamanan',
          icon: History,
          visible: isFoundationManager
        }
      ]
    }
  ];

  return (
    <>
      {mobileOpen && <button
        type="button"
        aria-label="Tutup menu navigasi"
        title="Tutup menu navigasi"
        onClick={onCloseMobile}
        className="fixed inset-0 z-40 bg-black/55 lg:hidden"
      />}
      <aside
        id="arf-mobile-nav"
        aria-label="Navigasi ARF One School"
        className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[min(19rem,85vw)] flex-col justify-between shadow-xl transition-transform duration-300 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-20' : 'lg:w-72'}`}
        style={{ backgroundColor: '#073b2d' }}
      >
      {/* Top Branding */}
      <div>
        <div className="p-5 border-b border-emerald-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c89b55] to-[#9c7536] flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
              ARF
            </div>
            {!compact && (
              <div className="leading-tight truncate">
                <h1 className="font-bold text-white text-base tracking-wide flex items-center gap-1.5">
                  ARF One School <span className="text-[10px] bg-[#c89b55]/20 text-[#c89b55] px-1.5 py-0.5 rounded font-mono font-medium">Wave 1</span>
                </h1>
                <p className="text-[11px] text-emerald-200/70 truncate">Abdul Rasyid Foundation</p>
              </div>
            )}
          </div>
          <button
            onClick={onToggleCollapse}
            className="hidden lg:inline-flex p-1.5 rounded-lg text-emerald-200/60 hover:text-white hover:bg-emerald-900/60 transition-colors"
            title={collapsed ? 'Perluas Menu' : 'Perkecil Menu'}
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </button>
          <button type="button" onClick={onCloseMobile}
            aria-label="Tutup menu"
            className="lg:hidden rounded-lg p-2 text-emerald-100 hover:bg-emerald-900/60">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tagline Banner */}
        {!compact && (
          <div className="px-5 py-2.5 bg-emerald-950/40 border-b border-emerald-950/60 text-[10px] text-emerald-300/80 font-medium tracking-wide flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-[#c89b55]" />
            <span>One Foundation. One Standard. Better Schools.</span>
          </div>
        )}

        {/* Navigation Menus */}
        <div className="py-4 px-3 space-y-6 overflow-y-auto max-h-[calc(100vh-210px)]">
          {menuSections.map((sec, secIdx) => {
            const visibleItems = sec.items.filter(it => it.visible);
            if (visibleItems.length === 0) return null;

            return (
              <div key={secIdx} className="space-y-1">
                {!compact && (
                  <h3 className="px-3 text-[10px] font-bold text-emerald-400/60 uppercase tracking-wider mb-1.5">
                    {sec.title}
                  </h3>
                )}
                {visibleItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;

                  return (
                    <button
                      key={item.key}
                      onClick={() => onSelectTab(item.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#c89b55] text-white shadow-sm font-semibold'
                          : 'text-emerald-100/80 hover:bg-emerald-900/50 hover:text-white'
                      }`}
                      title={compact ? item.label : undefined}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-emerald-300/70'}`} />
                      {!compact && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer / Account */}
      <div className="p-3 border-t border-emerald-950/60 bg-emerald-950/40">
        <button
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'settings'
              ? 'bg-[#c89b55] text-white font-semibold'
              : 'text-emerald-200/80 hover:bg-emerald-900/50 hover:text-white'
          }`}
          title="Pengaturan Akun"
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!compact && <span className="truncate">Pengaturan Akun</span>}
        </button>

        <button
          onClick={logout}
          className="w-full mt-1 flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 transition-colors"
          title="Keluar"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!compact && <span className="truncate">Keluar Sistem</span>}
        </button>
      </div>
      </aside>
    </>
  );
};
