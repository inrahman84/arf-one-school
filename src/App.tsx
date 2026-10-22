/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar, NavItemKey } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { LoginView } from './features/auth/LoginView';
import { DashboardView } from './features/dashboard/DashboardView';
import { SchoolsListView } from './features/schools/SchoolsListView';
import { SchoolDetailView } from './features/schools/SchoolDetailView';
import { EnrollmentView } from './features/enrollment/EnrollmentView';
import { HRView } from './features/hr/HRView';
import { AssetsView } from './features/assets/AssetsView';
import { FacilitiesView } from './features/facilities/FacilitiesView';
import { DataImportView } from './features/imports/DataImportView';
import { VerificationView } from './features/verification/VerificationView';
import { ReportsView } from './features/reports/ReportsView';
import { UserManagementView } from './features/administration/UserManagementView';
import { RegionManagementView } from './features/administration/RegionManagementView';
import { AuditLogView } from './features/administration/AuditLogView';
import { AcademicYearManagementView } from './features/administration/AcademicYearManagementView';
import { AccountSettingsView } from './features/settings/AccountSettingsView';

import { regionsService } from './services/regionsService';
import { schoolsService } from './services/schoolsService';
import { enrollmentService } from './services/enrollmentService';
import { hrService } from './services/hrService';
import { assetsService } from './services/assetsService';
import { facilitiesService } from './services/facilitiesService';
import { verificationService } from './services/verificationService';
import {
  School,
  Region,
  ClassroomEnrollment,
  Staff,
  Asset,
  Facility,
  SubmissionReview
} from './types';
import { ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { currentUser, userProfile, loading: authLoading, logout, effectiveRole } = useAuth();

  const [activeTab, setActiveTab] = useState<NavItemKey>('dashboard');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Data Store
  const [regions, setRegions] = useState<Region[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<ClassroomEnrollment[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [reviews, setReviews] = useState<SubmissionReview[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Load all foundational data from Supabase
  const loadAllData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [rList, sList, revList] = await Promise.all([
        regionsService.getRegions(),
        schoolsService.getSchools(),
        verificationService.getAllReviews()
      ]);

      // Production data must come from real entries or verified imports, not fabricated demo records.
      // An empty installation is a valid, clean initial state.
      setRegions(rList);
      setSchools(sList);
      setReviews(revList);

      const schoolIds = sList.map(s => s.school_id);
      const [cList, stList, aList, fList] = await Promise.all([
        enrollmentService.getAllClassesAcrossSchools(schoolIds),
        hrService.getAllStaffAcrossSchools(schoolIds),
        assetsService.getAllAssetsAcrossSchools(schoolIds),
        facilitiesService.getAllFacilitiesAcrossSchools(schoolIds)
      ]);
      setClasses(cList);
      setStaff(stList);
      setAssets(aList);
      setFacilities(fList);
    } catch (e) {
      console.error('Failed to load application data:', e);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadAllData();
    }
  }, [currentUser, loadAllData]);

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f6f3ec] flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-[#073b2d] text-white font-bold flex items-center justify-center text-xl animate-pulse shadow-lg">
          ARF
        </div>
        <div className="mt-4 text-xs font-semibold text-gray-700">
          Memuat Sistem Manajemen Sekolah ARF...
        </div>
      </div>
    );
  }

  // If not logged in
  if (!currentUser) {
    return <LoginView />;
  }

  // Account status check (e.g. INACTIVE)
  if (userProfile && userProfile.status === 'INACTIVE') {
    return (
      <div className="min-h-screen bg-[#f6f3ec] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-gray-200 text-center shadow-lg space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-gray-900">Akun Anda Telah Dinonaktifkan</h2>
          <p className="text-xs text-[#5f5d5d]">
            Akses sistem untuk email <strong>{currentUser.email}</strong> saat ini telah dinonaktifkan oleh Administrator Yayasan. Silakan hubungi Super Admin ARF untuk pembukaan kembali hak akses.
          </p>
          <button
            onClick={logout}
            className="w-full py-2 px-4 rounded-xl bg-gray-100 text-xs font-semibold text-gray-700 hover:bg-gray-200"
          >
            Keluar Sistem
          </button>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f6f3ec] p-6">
      <div className="max-w-md bg-white rounded-2xl p-8 border border-gray-200 text-center shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-[#073b2d]">Akses ARF One School belum aktif</h2>
        <p className="text-sm text-gray-600">Akun <strong>{currentUser.email}</strong> telah terautentikasi, tetapi keanggotaannya belum disetujui atau belum aktif. Super Admin harus menyetujui pendaftaran serta menetapkan hak akses melalui Administrasi Sistem → Manajemen Pengguna.</p>
        <button className="rounded-xl bg-[#073b2d] px-5 py-2.5 text-white" onClick={logout}>Keluar</button>
      </div>
    </div>;
  }

  // Active School Detail selection helper
  const activeSchool = selectedSchoolId ? schools.find(s => s.school_id === selectedSchoolId) : null;
  const activeSchoolRegion = activeSchool ? regions.find(r => r.id === activeSchool.regional_id) : undefined;

  // Title mapping
  const titles: Record<NavItemKey, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Executive Management Dashboard',
      subtitle: 'Konsolidasi kinerja sekolah, peserta didik, PTK, dan sarana prasarana Yayasan ARF'
    },
    schools: {
      title: 'Daftar & Profil Sekolah',
      subtitle: 'Master data kelembagaan dan perizinan operasional sekolah ARF'
    },
    enrollment: {
      title: 'Data Rombongan Belajar & Siswa',
      subtitle: 'Pengelolaan kapasitas kelas dan pemantauan rasio murid'
    },
    hr: {
      title: 'Guru & Tenaga Kependidikan (PTK)',
      subtitle: 'Data kualifikasi, sertifikasi pendidik, dan beban mengajar mingguan'
    },
    assets: {
      title: 'Inventaris Sarana & Aset Sekolah',
      subtitle: 'Pencatatan inventaris barang, sumber pendanaan (BOS/ARF), dan kondisi fisik'
    },
    facilities: {
      title: 'Sarana & Prasarana Bangunan',
      subtitle: 'Monitoring kelayakan ruang, toilet, lab, dan kebutuhan renovasi'
    },
    import: {
      title: 'Import Data Spreadsheet Excel',
      subtitle: 'Pengunggahan berkas batch resmi dengan validasi integritas otomatis'
    },
    verification: {
      title: 'Status Verifikasi & Pengajuan',
      subtitle: 'Persetujuan bertingkat Kepala Sekolah dan Verifikator Yayasan ARF'
    },
    reports: {
      title: 'Laporan Eksekutif & Ekspor Data',
      subtitle: 'Unduh laporan berkala format Microsoft Excel (.xlsx) resmi'
    },
    users: {
      title: 'Manajemen Pengguna & Otorisasi',
      subtitle: 'Pengaturan akun staf, peran, dan pembatasan kewenangan sekolah'
    },
    academicYears: {
      title: 'Master Tahun Ajaran',
      subtitle: 'Pengelolaan periode akademik terpusat untuk seluruh sekolah ARF'
    },
    regions: {
      title: 'Manajemen Wilayah / Regional',
      subtitle: 'Pengaturan dinamis cabang dan wilayah operasional ARF di Indonesia'
    },
    audit: {
      title: 'Log Audit Keamanan Sistem',
      subtitle: 'Catatan permanen perubahan dan aktivitas pengguna'
    },
    settings: {
      title: 'Pengaturan Akun & Profil',
      subtitle: 'Rincian identitas akun dan kewenangan hak akses aktif'
    }
  };

  const currentMeta = titles[activeTab] || titles.dashboard;

  return (
    <div className="min-h-screen flex bg-[#f6f3ec] text-gray-800 antialiased font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSelectedSchoolId(null);
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Header */}
        <Header
          pageTitle={selectedSchoolId && activeSchool ? activeSchool.school_name : currentMeta.title}
          pageSubtitle={selectedSchoolId && activeSchool ? `Profil Terperinci Unit Sekolah` : currentMeta.subtitle}
          onDataRefresh={loadAllData}
        />

        {/* View Routing */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              schools={schools}
              regions={regions}
              classes={classes}
              staff={staff}
              assets={assets}
              facilities={facilities}
              reviews={reviews}
              loading={dataLoading}
              onRefresh={loadAllData}
              onSelectSchool={(sid) => {
                setSelectedSchoolId(sid);
                setActiveTab('schools');
              }}
            />
          )}

          {activeTab === 'schools' && (
            selectedSchoolId && activeSchool ? (
              <SchoolDetailView
                school={activeSchool}
                region={activeSchoolRegion}
                classes={classes}
                staff={staff}
                assets={assets}
                facilities={facilities}
                reviews={reviews}
                onBack={() => setSelectedSchoolId(null)}
                onRefresh={loadAllData}
                onNavigateToTab={(tab) => {
                  setActiveTab(tab);
                  setSelectedSchoolId(null);
                }}
              />
            ) : (
              <SchoolsListView
                schools={schools}
                regions={regions}
                onRefresh={loadAllData}
                onSelectSchool={(sid) => setSelectedSchoolId(sid)}
              />
            )
          )}

          {activeTab === 'enrollment' && (
            <EnrollmentView
              schools={schools}
              classes={classes}
              onRefresh={loadAllData}
              onManageAcademicYears={() => setActiveTab('academicYears')}
            />
          )}

          {activeTab === 'hr' && (
            <HRView
              schools={schools}
              staff={staff}
              totalStudents={classes.reduce((sum, c) => sum + (Number(c.male_students) || 0) + (Number(c.female_students) || 0), 0)}
              onRefresh={loadAllData}
            />
          )}

          {activeTab === 'assets' && (
            <AssetsView
              schools={schools}
              assets={assets}
              onRefresh={loadAllData}
            />
          )}

          {activeTab === 'facilities' && (
            <FacilitiesView
              schools={schools}
              facilities={facilities}
              onRefresh={loadAllData}
            />
          )}

          {activeTab === 'import' && (
            <DataImportView
              schools={schools}
              regions={regions}
              onRefresh={loadAllData}
              onNavigateToTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'verification' && (
            <VerificationView
              schools={schools}
              reviews={reviews}
              onRefresh={loadAllData}
              onSelectSchool={(sid) => {
                setSelectedSchoolId(sid);
                setActiveTab('schools');
              }}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              schools={schools}
              regions={regions}
              classes={classes}
              staff={staff}
              assets={assets}
              facilities={facilities}
              reviews={reviews}
            />
          )}

          {activeTab === 'users' && (
            <UserManagementView
              schools={schools}
              regions={regions}
            />
          )}

          {activeTab === 'academicYears' && effectiveRole === 'SUPER_ADMIN' && (
            <AcademicYearManagementView classes={classes} />
          )}

          {activeTab === 'regions' && (
            <RegionManagementView
              regions={regions}
              schools={schools}
              onRefresh={loadAllData}
            />
          )}

          {activeTab === 'audit' && (
            <AuditLogView />
          )}

          {activeTab === 'settings' && (
            <AccountSettingsView
              schools={schools}
              regions={regions}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
