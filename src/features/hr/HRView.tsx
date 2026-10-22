import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Users,
  GraduationCap,
  Award,
  CheckCircle,
  Download,
  BookOpen,
  Briefcase
} from 'lucide-react';
import {
  Staff,
  School,
  StaffCategory,
  EmploymentStatus,
  EmploymentType,
  HighestEducation,
  TeacherCertification
} from '../../types';
import { hrService } from '../../services/hrService';
import { excelService } from '../../services/excelService';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

interface HRViewProps {
  schools: School[];
  staff: Staff[];
  totalStudents: number;
  onRefresh: () => void;
}

export const HRView: React.FC<HRViewProps> = ({
  schools,
  staff,
  totalStudents,
  onRefresh
}) => {
  const { hasSchoolAccess, isSuperAdmin, isFoundationManager, isHROfficer } = useAuth();
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(schools[0]?.school_id || 'ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [certFilter, setCertFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    staff: Staff | null;
    deleting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    staff: null,
    deleting: false,
    error: null,
  });

  // Form State
  const [formData, setFormData] = useState({
    staff_id: '',
    school_id: schools[0]?.school_id || '',
    staff_name: '',
    staff_category: 'Guru' as StaffCategory,
    primary_position: 'Guru Kelas',
    employment_type: 'Tetap' as EmploymentType,
    employment_status: 'Aktif' as EmploymentStatus,
    highest_education: 'D4/S1' as HighestEducation,
    education_major: '',
    teacher_certification: 'Bersertifikat' as TeacherCertification,
    teaching_subject: '',
    weekly_teaching_hours: 24,
    additional_assignment: '',
    professional_development_need: ''
  });

  const accessibleSchools = schools.filter(s => hasSchoolAccess(s.school_id));

  const filteredStaff = staff.filter(s => {
    if (!hasSchoolAccess(s.school_id)) return false;
    if (selectedSchoolId !== 'ALL' && s.school_id !== selectedSchoolId) return false;
    if (categoryFilter !== 'ALL' && s.staff_category !== categoryFilter) return false;
    if (statusFilter !== 'ALL' && s.employment_status !== statusFilter) return false;
    if (certFilter !== 'ALL' && s.teacher_certification !== certFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.staff_name.toLowerCase().includes(q) ||
        s.primary_position.toLowerCase().includes(q) ||
        (s.education_major || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openAddModal = () => {
    setEditingStaff(null);
    setFormError(null);
    setFormData({
      staff_id: `STF-${Date.now().toString().slice(-6)}`,
      school_id: selectedSchoolId !== 'ALL' ? selectedSchoolId : (accessibleSchools[0]?.school_id || ''),
      staff_name: '',
      staff_category: 'Guru',
      primary_position: 'Guru Mata Pelajaran',
      employment_type: 'Tetap',
      employment_status: 'Aktif',
      highest_education: 'D4/S1',
      education_major: '',
      teacher_certification: 'Belum Bersertifikat',
      teaching_subject: '',
      weekly_teaching_hours: 24,
      additional_assignment: '',
      professional_development_need: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (st: Staff) => {
    setEditingStaff(st);
    setFormError(null);
    setFormData({
      staff_id: st.staff_id,
      school_id: st.school_id,
      staff_name: st.staff_name,
      staff_category: st.staff_category,
      primary_position: st.primary_position,
      employment_type: st.employment_type,
      employment_status: st.employment_status,
      highest_education: st.highest_education,
      education_major: st.education_major || '',
      teacher_certification: st.teacher_certification,
      teaching_subject: st.teaching_subject || '',
      weekly_teaching_hours: st.weekly_teaching_hours || 0,
      additional_assignment: st.additional_assignment || '',
      professional_development_need: st.professional_development_need || ''
    });
    setModalOpen(true);
  };

  const promptDelete = (st: Staff) => {
    setDeleteModal({
      isOpen: true,
      staff: st,
      deleting: false,
      error: null
    });
  };

  const confirmDelete = async () => {
    if (!deleteModal.staff) return;
    setDeleteModal(prev => ({ ...prev, deleting: true, error: null }));
    try {
      await hrService.deleteStaff(deleteModal.staff.school_id, deleteModal.staff.staff_id);
      setDeleteModal({ isOpen: false, staff: null, deleting: false, error: null });
      onRefresh();
    } catch (err: any) {
      console.error('Gagal menghapus data PTK:', err);
      setDeleteModal(prev => ({
        ...prev,
        deleting: false,
        error: err.message || 'Gagal menghapus data PTK dari database.'
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.staff_name || !formData.school_id) {
      setFormError('Nama PTK dan Sekolah wajib diisi!');
      return;
    }

    setSubmitting(true);
    try {
      await hrService.saveStaff({
        ...formData,
        weekly_teaching_hours: Number(formData.weekly_teaching_hours) || 0,
        created_at: editingStaff ? editingStaff.created_at : new Date().toISOString()
      });
      setModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data PTK');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    const dataToExport = filteredStaff.map(s => {
      const sch = schools.find(sc => sc.school_id === s.school_id);
      return {
        'ID PTK': s.staff_id,
        'Sekolah': sch?.school_name || s.school_id,
        'Nama Lengkap': s.staff_name,
        'Kategori': s.staff_category,
        'Jabatan': s.primary_position,
        'Status Kepegawaian': s.employment_type,
        'Status Aktif': s.employment_status,
        'Pendidikan Terakhir': s.highest_education,
        'Jurusan': s.education_major || '-',
        'Sertifikasi Pendidik': s.teacher_certification,
        'Mata Pelajaran': s.teaching_subject || '-',
        'Jam Mengajar / Minggu': s.weekly_teaching_hours || 0,
        'Tugas Tambahan': s.additional_assignment || '-'
      };
    });
    excelService.exportReport('ARF_Laporan_Guru_PTK', 'Data_PTK', dataToExport);
  };

  // Metrics
  const metrics = hrService.calculateHRMetrics(filteredStaff, totalStudents);

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* School Filter */}
            <div className="min-w-[200px]">
              <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Sekolah</label>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="w-full text-xs py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-800"
              >
                <option value="ALL">Semua Sekolah Terpilih ({accessibleSchools.length})</option>
                {accessibleSchools.map(s => (
                  <option key={s.school_id} value={s.school_id}>{s.school_name}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Kategori PTK</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-800"
              >
                <option value="ALL">Semua Kategori</option>
                <option value="Guru">Guru</option>
                <option value="Kepala Sekolah">Kepala Sekolah</option>
                <option value="Tenaga Kependidikan">Tenaga Kependidikan</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Status Kepegawaian</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-800"
              >
                <option value="ALL">Semua Status</option>
                <option value="Aktif">Aktif</option>
                <option value="Cuti">Cuti</option>
                <option value="Nonaktif">Nonaktif</option>
                <option value="Berakhir">Berakhir</option>
              </select>
            </div>

            {/* Certification */}
            <div>
              <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Sertifikasi</label>
              <select
                value={certFilter}
                onChange={(e) => setCertFilter(e.target.value)}
                className="text-xs py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-800"
              >
                <option value="ALL">Semua Sertifikasi</option>
                <option value="Bersertifikat">Bersertifikat</option>
                <option value="Belum Bersertifikat">Belum Bersertifikat</option>
                <option value="Tidak Berlaku">Tidak Berlaku</option>
              </select>
            </div>

            {/* Search */}
            <div className="relative min-w-[180px] self-end">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama, jabatan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 self-end">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              title="Ekspor Data PTK ke Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor</span>
            </button>

            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
              style={{ backgroundColor: '#073b2d' }}
            >
              <Plus className="w-4 h-4" />
              <span>Tambah PTK Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* HR KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-[#5f5d5d]">Total Guru Aktif</span>
          <div className="text-2xl font-extrabold text-gray-900 mt-1">{metrics.totalActiveTeachers}</div>
          <span className="text-[11px] text-[#5f5d5d] mt-1 block">Pendidik Terdaftar</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-[#5f5d5d]">Tenaga Kependidikan</span>
          <div className="text-2xl font-extrabold text-gray-900 mt-1">{metrics.totalEducationalPersonnel}</div>
          <span className="text-[11px] text-[#5f5d5d] mt-1 block">Tendik &amp; Staf Pendukung</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-[#5f5d5d]">Guru Bersertifikat</span>
          <div className="text-2xl font-extrabold text-[#009b4c] mt-1">
            {metrics.certificationRate.toFixed(1)}%
          </div>
          <span className="text-[11px] text-[#5f5d5d] mt-1 block">
            {metrics.certifiedTeachers} dari {metrics.totalActiveTeachers} Guru
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-[#5f5d5d]">Rasio Murid : Guru</span>
          <div className="text-2xl font-extrabold text-[#073b2d] mt-1">{metrics.studentTeacherRatio}</div>
          <span className="text-[11px] text-[#5f5d5d] mt-1 block">Berdasarkan Total Murid</span>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">
            Daftar Tenaga Pendidik &amp; Kependidikan ({filteredStaff.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Nama Lengkap &amp; ID</th>
                <th className="py-3 px-4">Sekolah</th>
                <th className="py-3 px-4">Kategori &amp; Jabatan</th>
                <th className="py-3 px-4">Pendidikan</th>
                <th className="py-3 px-4">Status &amp; Sertifikasi</th>
                <th className="py-3 px-4 text-center">Beban Mengajar</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStaff.map(st => {
                const sch = schools.find(s => s.school_id === st.school_id);

                return (
                  <tr key={st.staff_id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{st.staff_name}</div>
                      <div className="text-[11px] text-gray-400 font-mono">{st.staff_id}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{sch?.school_name || st.school_id}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-800">{st.primary_position}</div>
                      <div className="text-[11px] text-[#5f5d5d]">{st.staff_category} &bull; {st.employment_type}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">{st.highest_education}</div>
                      <div className="text-[11px] text-[#5f5d5d]">{st.education_major || '-'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          st.teacher_certification === 'Bersertifikat' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {st.teacher_certification}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          st.employment_status === 'Aktif' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {st.employment_status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-gray-700">
                      {st.weekly_teaching_hours ? `${st.weekly_teaching_hours} Jam/Mgg` : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(st)}
                          className="p-1 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                          title="Edit Data PTK"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => promptDelete(st)}
                          className="p-1 rounded-md hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Hapus PTK"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    Belum ada data PTK yang sesuai dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit Staff */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-200">
              {editingStaff ? 'Edit Data PTK' : 'Tambah Tenaga Pendidik & Kependidikan'}
            </h3>

            {formError && (
              <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Sekolah *</label>
                  <select
                    value={formData.school_id}
                    onChange={(e) => setFormData({ ...formData, school_id: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    {accessibleSchools.map(s => (
                      <option key={s.school_id} value={s.school_id}>{s.school_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">ID PTK (Sistem)</label>
                  <input
                    type="text"
                    disabled={!!editingStaff}
                    value={formData.staff_id}
                    onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 bg-gray-50 font-mono"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Lengkap &amp; Gelar *</label>
                  <input
                    type="text"
                    value={formData.staff_name}
                    onChange={(e) => setFormData({ ...formData, staff_name: e.target.value })}
                    placeholder="Contoh: Ahmad Fauzi, S.Pd."
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Kategori PTK *</label>
                  <select
                    value={formData.staff_category}
                    onChange={(e) => setFormData({ ...formData, staff_category: e.target.value as StaffCategory })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    <option value="Guru">Guru</option>
                    <option value="Kepala Sekolah">Kepala Sekolah</option>
                    <option value="Tenaga Kependidikan">Tenaga Kependidikan</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Jabatan Utama *</label>
                  <input
                    type="text"
                    value={formData.primary_position}
                    onChange={(e) => setFormData({ ...formData, primary_position: e.target.value })}
                    placeholder="Contoh: Guru Kelas 1A, Kepala Tata Usaha"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Status Kepegawaian *</label>
                  <select
                    value={formData.employment_type}
                    onChange={(e) => setFormData({ ...formData, employment_type: e.target.value as EmploymentType })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    <option value="Tetap">Tetap</option>
                    <option value="Kontrak">Kontrak</option>
                    <option value="Honorer">Honorer</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Status Aktif *</label>
                  <select
                    value={formData.employment_status}
                    onChange={(e) => setFormData({ ...formData, employment_status: e.target.value as EmploymentStatus })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Cuti">Cuti</option>
                    <option value="Nonaktif">Nonaktif</option>
                    <option value="Berakhir">Berakhir</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Pendidikan Terakhir *</label>
                  <select
                    value={formData.highest_education}
                    onChange={(e) => setFormData({ ...formData, highest_education: e.target.value as HighestEducation })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    <option value="SMA/SMK">SMA/SMK</option>
                    <option value="D1/D2/D3">D1/D2/D3</option>
                    <option value="D4/S1">D4/S1</option>
                    <option value="S2">S2</option>
                    <option value="S3">S3</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Jurusan / Program Studi</label>
                  <input
                    type="text"
                    value={formData.education_major}
                    onChange={(e) => setFormData({ ...formData, education_major: e.target.value })}
                    placeholder="Contoh: PGSD, Pendidikan Matematika"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Sertifikasi Pendidik *</label>
                  <select
                    value={formData.teacher_certification}
                    onChange={(e) => setFormData({ ...formData, teacher_certification: e.target.value as TeacherCertification })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    <option value="Bersertifikat">Bersertifikat</option>
                    <option value="Belum Bersertifikat">Belum Bersertifikat</option>
                    <option value="Tidak Berlaku">Tidak Berlaku (Tendik)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Mata Pelajaran yang Diampu</label>
                  <input
                    type="text"
                    value={formData.teaching_subject}
                    onChange={(e) => setFormData({ ...formData, teaching_subject: e.target.value })}
                    placeholder="Contoh: Tematik, Matematika, IPA"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Beban Mengajar Mingguan (Jam)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.weekly_teaching_hours}
                    onChange={(e) => setFormData({ ...formData, weekly_teaching_hours: Number(e.target.value) })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tugas Tambahan</label>
                  <input
                    type="text"
                    value={formData.additional_assignment}
                    onChange={(e) => setFormData({ ...formData, additional_assignment: e.target.value })}
                    placeholder="Contoh: Pembina Pramuka, Kepala Lab"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-white font-semibold text-xs shadow-sm"
                  style={{ backgroundColor: '#073b2d' }}
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Data PTK'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Staff Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Hapus Data PTK"
        message="Apakah Anda yakin ingin menghapus data pendidik / tenaga kependidikan ini secara permanen dari database?"
        itemName={deleteModal.staff ? `${deleteModal.staff.staff_name} (${deleteModal.staff.primary_position} - ${deleteModal.staff.staff_category})` : undefined}
        confirmLabel="Hapus Data PTK"
        cancelLabel="Batal"
        loading={deleteModal.deleting}
        error={deleteModal.error}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, staff: null, deleting: false, error: null })}
      />
    </div>
  );
};
