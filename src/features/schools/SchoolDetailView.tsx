import React, { useState } from 'react';
import {
  ArrowLeft,
  School as SchoolIcon,
  MapPin,
  ShieldCheck,
  Users,
  Building2,
  GraduationCap,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Send,
  Calendar,
  FileText,
  Trash2
} from 'lucide-react';
import {
  School,
  Region,
  ClassroomEnrollment,
  Staff,
  Asset,
  Facility,
  SubmissionReview
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { verificationService } from '../../services/verificationService';
import { schoolsService } from '../../services/schoolsService';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

interface SchoolDetailViewProps {
  school: School;
  region?: Region;
  classes: ClassroomEnrollment[];
  staff: Staff[];
  assets: Asset[];
  facilities: Facility[];
  reviews: SubmissionReview[];
  onBack: () => void;
  onRefresh: () => void;
  onNavigateToTab: (tab: any) => void;
}

export const SchoolDetailView: React.FC<SchoolDetailViewProps> = ({
  school,
  region,
  classes,
  staff,
  assets,
  facilities,
  reviews,
  onBack,
  onRefresh,
  onNavigateToTab
}) => {
  const { isSuperAdmin, isFoundationManager, isRegionalLead, isPrincipal, effectiveRole } = useAuth();
  const canManageSchools = isSuperAdmin || isFoundationManager;
  const [submittingReview, setSubmittingReview] = useState(false);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    deleting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    deleting: false,
    error: null,
  });

  const [submitModal, setSubmitModal] = useState<{
    isOpen: boolean;
    submitting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    submitting: false,
    error: null,
  });

  const schoolClasses = classes.filter(c => c.school_id === school.school_id);
  const schoolStaff = staff.filter(s => s.school_id === school.school_id);
  const schoolAssets = assets.filter(a => a.school_id === school.school_id);
  const schoolFacilities = facilities.filter(f => f.school_id === school.school_id);
  const schoolReviews = reviews.filter(r => r.schoolId === school.school_id);

  const totalStudents = schoolClasses.reduce(
    (sum, c) => sum + (Number(c.male_students) || 0) + (Number(c.female_students) || 0),
    0
  );
  const totalTeachers = schoolStaff.filter(
    s => s.staff_category === 'Guru' || s.staff_category === 'Kepala Sekolah'
  ).length;

  const totalAssetUnits = schoolAssets.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
  const facilitiesNeedRepair = schoolFacilities.filter(f => f.repair_required).length;

  const confirmDeleteSchool = async () => {
    setDeleteModal(prev => ({ ...prev, deleting: true, error: null }));
    try {
      await schoolsService.deleteSchool(school.school_id);
      setDeleteModal({ isOpen: false, deleting: false, error: null });
      onBack();
      onRefresh();
    } catch (err: any) {
      console.error('Gagal menghapus sekolah:', err);
      setDeleteModal(prev => ({
        ...prev,
        deleting: false,
        error: err.message || 'Gagal menghapus sekolah dari database.'
      }));
    }
  };

  const confirmSubmitReview = async () => {
    setSubmitModal(prev => ({ ...prev, submitting: true, error: null }));
    try {
      await verificationService.submitForReview(school.school_id, 'ALL', '2026/2027', 'Ganjil');
      setSubmitModal({ isOpen: false, submitting: false, error: null });
      setActionSuccessNotice('Pengajuan data sekolah berhasil dikirimkan ke Yayasan ARF!');
      setTimeout(() => setActionSuccessNotice(null), 5000);
      onRefresh();
    } catch (e: any) {
      setSubmitModal(prev => ({
        ...prev,
        submitting: false,
        error: e.message || 'Gagal mengirim pengajuan'
      }));
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Back button & Notices */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Daftar Sekolah</span>
        </button>

        {actionSuccessNotice && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessNotice}</span>
          </div>
        )}
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-white rounded-2xl border border-gray-200/90 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#073b2d] flex items-center justify-center font-black text-2xl border border-emerald-100 shrink-0">
              <SchoolIcon className="w-8 h-8" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#3f6276]/10 text-[#3f6276]">
                  {school.education_level}
                </span>
                <span className="text-xs font-mono text-gray-500">
                  NPSN: {school.npsn || 'Belum terdaftar'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  {school.operational_status}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  Akreditasi {school.accreditation_grade || '-'}
                </span>
              </div>

              <h1 className="text-xl font-bold text-gray-900 mt-1.5 tracking-tight">
                {school.school_name}
              </h1>

              <div className="flex items-center gap-4 text-xs text-[#5f5d5d] mt-1.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {[school.school_address || 'Alamat belum diisi', school.village, school.district, school.regency].filter(Boolean).join(', ')}
                </span>
                <span>&bull;</span>
                <span className="font-medium text-gray-700">
                  {region?.name || school.regional_id}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {canManageSchools && (
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: true, deleting: false, error: null })}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 font-semibold text-xs transition-colors cursor-pointer"
                title="Hapus Unit Sekolah Ini"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Sekolah</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSubmitModal({ isOpen: true, submitting: false, error: null })}
              disabled={submittingReview}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
              style={{ backgroundColor: '#073b2d' }}
            >
              <Send className="w-4 h-4" />
              <span>{submittingReview ? 'Mengirim...' : 'Ajukan Verifikasi ARF'}</span>
            </button>
          </div>
        </div>

        {/* 4 Mini Stat Blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-100">
            <span className="text-[11px] text-[#5f5d5d] font-semibold block">Total Siswa Aktif</span>
            <span className="text-xl font-extrabold text-gray-900 mt-0.5 block">{totalStudents}</span>
            <span className="text-[10px] text-gray-500">{schoolClasses.length} Rombongan Belajar</span>
          </div>

          <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-100">
            <span className="text-[11px] text-[#5f5d5d] font-semibold block">Pendidik &amp; Guru</span>
            <span className="text-xl font-extrabold text-gray-900 mt-0.5 block">{totalTeachers}</span>
            <span className="text-[10px] text-gray-500">Dari total {schoolStaff.length} staf</span>
          </div>

          <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-100">
            <span className="text-[11px] text-[#5f5d5d] font-semibold block">Inventaris Sarana</span>
            <span className="text-xl font-extrabold text-gray-900 mt-0.5 block">{totalAssetUnits}</span>
            <span className="text-[10px] text-gray-500">{schoolAssets.length} Jenis Aset</span>
          </div>

          <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-100">
            <span className="text-[11px] text-[#5f5d5d] font-semibold block">Prasarana Ruang</span>
            <span className="text-xl font-extrabold text-gray-900 mt-0.5 block">{schoolFacilities.length}</span>
            <span className="text-[10px] text-orange-600 font-semibold">{facilitiesNeedRepair} Perlu Perbaikan</span>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rombel Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#073b2d]" />
              <h3 className="text-sm font-bold text-gray-900">Rombongan Belajar Terdaftar</h3>
            </div>
            <button
              onClick={() => onNavigateToTab('enrollment')}
              className="text-xs font-semibold text-[#073b2d] hover:underline"
            >
              Kelola Rombel &rarr;
            </button>
          </div>

          <div className="space-y-3">
            {schoolClasses.map(c => {
              const count = (Number(c.male_students) || 0) + (Number(c.female_students) || 0);
              const cap = Number(c.class_capacity) || 0;
              const isOver = cap > 0 && count > cap;
              const pct = cap > 0 ? Math.min(Math.round((count / cap) * 100), 100) : 0;

              return (
                <div key={c.class_id} className="p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-900">{c.class_name}</span>
                    <span className={`font-semibold ${isOver ? 'text-rose-600' : 'text-gray-700'}`}>
                      {count} / {cap} Siswa
                    </span>
                  </div>

                  {/* Occupancy bar */}
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full ${isOver ? 'bg-rose-600' : 'bg-[#073b2d]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {isOver && (
                    <div className="mt-1 text-[10px] text-rose-600 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Kelas Melebihi Kapasitas!</span>
                    </div>
                  )}
                </div>
              );
            })}
            {schoolClasses.length === 0 && (
              <div className="text-center py-6 text-xs text-gray-400">
                Belum ada data rombel yang diinputkan untuk sekolah ini.
              </div>
            )}
          </div>
        </div>

        {/* Staff Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#073b2d]" />
              <h3 className="text-sm font-bold text-gray-900">Guru &amp; Tenaga Kependidikan</h3>
            </div>
            <button
              onClick={() => onNavigateToTab('hr')}
              className="text-xs font-semibold text-[#073b2d] hover:underline"
            >
              Kelola PTK &rarr;
            </button>
          </div>

          <div className="space-y-2.5">
            {schoolStaff.slice(0, 5).map(s => (
              <div key={s.staff_id} className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-gray-900">{s.staff_name}</div>
                  <div className="text-[11px] text-[#5f5d5d]">{s.primary_position} &bull; {s.staff_category}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  s.teacher_certification === 'Bersertifikat' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {s.teacher_certification}
                </span>
              </div>
            ))}
            {schoolStaff.length === 0 && (
              <div className="text-center py-6 text-xs text-gray-400">
                Belum ada data guru/staf terdaftar.
              </div>
            )}
          </div>
        </div>

        {/* Assets Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#073b2d]" />
              <h3 className="text-sm font-bold text-gray-900">Inventaris Sarana Terkini</h3>
            </div>
            <button
              onClick={() => onNavigateToTab('assets')}
              className="text-xs font-semibold text-[#073b2d] hover:underline"
            >
              Kelola Aset &rarr;
            </button>
          </div>

          <div className="space-y-2.5">
            {schoolAssets.slice(0, 5).map(a => (
              <div key={a.asset_id} className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-gray-900">{a.asset_name}</div>
                  <div className="text-[11px] text-[#5f5d5d]">{a.asset_category} &bull; Sumber: {a.funding_source}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{a.quantity} {a.unit_measure}</div>
                  <span className={`text-[10px] font-semibold ${
                    a.asset_condition === 'Baik' ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {a.asset_condition}
                  </span>
                </div>
              </div>
            ))}
            {schoolAssets.length === 0 && (
              <div className="text-center py-6 text-xs text-gray-400">
                Belum ada data aset tercatat.
              </div>
            )}
          </div>
        </div>

        {/* Verification Status Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[#073b2d]" />
              <h3 className="text-sm font-bold text-gray-900">Status Verifikasi Yayasan</h3>
            </div>
            <button
              onClick={() => onNavigateToTab('verification')}
              className="text-xs font-semibold text-[#073b2d] hover:underline"
            >
              Lihat Riwayat &rarr;
            </button>
          </div>

          <div className="space-y-2.5">
            {schoolReviews.map(r => (
              <div key={r.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">Modul: {r.module} ({r.academicYear} {r.semester})</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    r.status === 'VERIFIED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : r.status === 'SUBMITTED'
                      ? 'bg-amber-100 text-amber-800'
                      : r.status === 'REVISION_REQUIRED'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {r.status}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Diajukan oleh: {r.submittedBy || '-'} &bull; Disetujui: {r.verifiedBy || '-'}
                </div>
                {r.revisionComments && (
                  <div className="mt-1.5 p-2 rounded bg-rose-50 text-rose-800 text-[11px]">
                    Catatan Revisi: {r.revisionComments}
                  </div>
                )}
              </div>
            ))}
            {schoolReviews.length === 0 && (
              <div className="text-center py-6 text-xs text-gray-400">
                Belum ada pengajuan verifikasi yang tercatat.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete School Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Hapus Unit Sekolah Ini"
        message="Apakah Anda yakin ingin menghapus unit sekolah ini dari database? Seluruh relasi subkoleksi (rombongan belajar, data PTK, inventaris aset, dan sarana prasarana) akan dibersihkan secara permanen."
        itemName={`${school.school_name} (${school.school_id})`}
        confirmLabel="Hapus Sekolah Permanen"
        cancelLabel="Batal"
        loading={deleteModal.deleting}
        error={deleteModal.error}
        onConfirm={confirmDeleteSchool}
        onCancel={() => setDeleteModal({ isOpen: false, deleting: false, error: null })}
      />

      {/* Submit Verification Confirmation Modal */}
      <ConfirmModal
        isOpen={submitModal.isOpen}
        isDangerous={false}
        title="Ajukan Verifikasi Resmi ke Yayasan ARF"
        message="Kirimkan seluruh data profil, rombel, PTK, aset, dan prasarana unit sekolah ini ke Yayasan Abdul Rasyid untuk proses validasi bertingkat (Principal -> Regional Lead -> Foundation Manager)?"
        itemName={`${school.school_name} (${school.education_level})`}
        confirmLabel="Kirimkan Sekarang"
        cancelLabel="Batal"
        loading={submitModal.submitting}
        error={submitModal.error}
        onConfirm={confirmSubmitReview}
        onCancel={() => setSubmitModal({ isOpen: false, submitting: false, error: null })}
      />
    </div>
  );
};
