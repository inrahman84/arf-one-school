import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  School as SchoolIcon,
  MapPin,
  CheckCircle,
  Building,
  GraduationCap
} from 'lucide-react';
import { School, Region, EducationLevel, EDUCATION_LEVELS, OperationalStatus, AccreditationGrade } from '../../types';
import { schoolsService } from '../../services/schoolsService';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

interface SchoolsListViewProps {
  schools: School[];
  regions: Region[];
  onRefresh: () => void;
  onSelectSchool: (schoolId: string) => void;
}

export const SchoolsListView: React.FC<SchoolsListViewProps> = ({
  schools,
  regions,
  onRefresh,
  onSelectSchool
}) => {
  const { isSuperAdmin, isFoundationManager, hasSchoolAccess } = useAuth();
  const canManageSchools = isSuperAdmin || isFoundationManager;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [selectedVillage, setSelectedVillage] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirmation State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    school: School | null;
    deleting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    school: null,
    deleting: false,
    error: null,
  });

  // Form State
  const [formData, setFormData] = useState({
    school_id: '',
    npsn: '',
    school_name: '',
    regional_id: regions[0]?.id || '',
    education_level: 'SD' as EducationLevel,
    school_address: '',
    district: '',
    village: '',
    regency: '',
    operational_status: 'Aktif' as OperationalStatus,
    operational_license: '',
    accreditation_grade: 'A' as AccreditationGrade,
    accreditation_expiry: '',
    school_capacity: 300,
    principal_name: ''
  });

  const openAddModal = () => {
    setEditingSchool(null);
    setFormError(null);
    setFormData({
      school_id: `SCH-${Date.now().toString().slice(-6)}`,
      npsn: '',
      school_name: '',
      regional_id: regions[0]?.id || '',
      education_level: 'SD',
      school_address: '',
      district: '',
      village: '',
      regency: '',
      operational_status: 'Aktif',
      operational_license: '',
      accreditation_grade: 'A',
      accreditation_expiry: '',
      school_capacity: 300,
      principal_name: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (sch: School, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSchool(sch);
    setFormError(null);
    setFormData({
      school_id: sch.school_id,
      npsn: sch.npsn || '',
      school_name: sch.school_name,
      regional_id: sch.regional_id,
      education_level: sch.education_level,
      school_address: sch.school_address || '',
      district: sch.district || '',
      village: sch.village || '',
      regency: sch.regency || '',
      operational_status: sch.operational_status,
      operational_license: sch.operational_license || '',
      accreditation_grade: sch.accreditation_grade || 'Belum Terakreditasi',
      accreditation_expiry: sch.accreditation_expiry || '',
      school_capacity: sch.school_capacity || 300,
      principal_name: sch.principal_name || ''
    });
    setModalOpen(true);
  };

  const promptDelete = (sch: School, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canManageSchools) return;
    setDeleteModal({
      isOpen: true,
      school: sch,
      deleting: false,
      error: null
    });
  };

  const confirmDelete = async () => {
    if (!deleteModal.school) return;
    setDeleteModal(prev => ({ ...prev, deleting: true, error: null }));
    try {
      await schoolsService.deleteSchool(deleteModal.school.school_id);
      setDeleteModal({
        isOpen: false,
        school: null,
        deleting: false,
        error: null
      });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.education_level === 'PAUD') {
      setFormError('Jenjang PAUD adalah data lama. Pilih salah satu dari TPA, KB, TK, SD, SMP, SMA, atau SMK sebelum menyimpan.');
      return;
    }
    setFormError(null);
    if (!formData.school_name || !formData.regional_id) {
      setFormError('Nama Sekolah dan Wilayah/Regional wajib diisi!');
      return;
    }

    setSubmitting(true);
    try {
      await schoolsService.saveSchool({
        ...formData,
        village: formData.village.trim(),
        school_capacity: Number(formData.school_capacity) || 0,
        created_at: editingSchool ? editingSchool.created_at : new Date().toISOString()
      });
      setModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan sekolah');
    } finally {
      setSubmitting(false);
    }
  };

  // Desa/Kelurahan berasal dari data sekolah, mengikuti filter Regional/Jenjang.
  const villageOptions = Array.from(new Set(schools
    .filter(s => hasSchoolAccess(s.school_id))
    .filter(s => selectedRegion === 'ALL' || s.regional_id === selectedRegion)
    .filter(s => selectedLevel === 'ALL' || s.education_level === selectedLevel)
    .map(s => (s.village || '').trim())
    .filter(Boolean))).sort((a, b) => a.localeCompare(b, 'id'));

  const filtered = schools.filter(s => {
    if (!hasSchoolAccess(s.school_id)) return false;
    if (selectedRegion !== 'ALL' && s.regional_id !== selectedRegion) return false;
    if (selectedLevel !== 'ALL' && s.education_level !== selectedLevel) return false;
    if (selectedVillage !== 'ALL' && (s.village || '').trim() !== selectedVillage) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = s.school_name.toLowerCase().includes(q);
      const matchNpsn = (s.npsn || '').toLowerCase().includes(q);
      const matchReg = (s.regency || '').toLowerCase().includes(q);
      const matchVillage = (s.village || '').toLowerCase().includes(q);
      const matchDistrict = (s.district || '').toLowerCase().includes(q);
      if (!matchName && !matchNpsn && !matchReg && !matchVillage && !matchDistrict) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama sekolah, NPSN, desa/kelurahan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-[#073b2d]"
            />
          </div>

          {/* Regional Filter */}
          <select
            value={selectedRegion}
            onChange={(e) => { setSelectedRegion(e.target.value); setSelectedVillage('ALL'); }}
            className="text-xs py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-800"
          >
            <option value="ALL">Semua Wilayah</option>
            {regions.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          {/* Level Filter */}
          <select
            value={selectedLevel}
            onChange={(e) => { setSelectedLevel(e.target.value); setSelectedVillage('ALL'); }}
            className="text-xs py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-800"
          >
            <option value="ALL">Semua Jenjang</option>
            {EDUCATION_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
          </select>

          {/* Filter desa/kelurahan dari master sekolah (tidak memerlukan tabel referensi tambahan) */}
          <select
            aria-label="Filter Desa/Kelurahan"
            value={selectedVillage}
            onChange={(e) => setSelectedVillage(e.target.value)}
            className="text-xs py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-800"
          >
            <option value="ALL">Semua Desa/Kelurahan</option>
            {villageOptions.map(village => (
              <option key={village} value={village}>{village}</option>
            ))}
            {villageOptions.length === 0 && <option disabled value="NO_VILLAGE">Belum ada data Desa/Kelurahan</option>}
          </select>
        </div>

        {/* Add Button for Super Admin & Foundation Manager */}
        {canManageSchools && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
            style={{ backgroundColor: '#073b2d' }}
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Sekolah Baru</span>
          </button>
        )}
      </div>

      {/* Grid of Schools */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(sch => {
          const reg = regions.find(r => r.id === sch.regional_id);

          return (
            <div
              key={sch.school_id}
              onClick={() => onSelectSchool(sch.school_id)}
              className="bg-white rounded-xl border border-gray-200/90 hover:border-[#073b2d] hover:shadow-md transition-all p-5 cursor-pointer flex flex-col justify-between group"
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#073b2d] flex items-center justify-center font-black text-sm group-hover:bg-[#073b2d] group-hover:text-white transition-colors">
                      <SchoolIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3f6276]/10 text-[#3f6276]">
                        {sch.education_level}
                      </span>
                      <span className="ml-2 text-[11px] font-mono text-gray-400">
                        {sch.npsn ? `NPSN: ${sch.npsn}` : 'Tanpa NPSN'}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                    Akreditasi {sch.accreditation_grade || '-'}
                  </span>
                </div>

                {/* School Name */}
                <h3 className="font-bold text-gray-900 text-sm mt-3 line-clamp-1 group-hover:text-[#073b2d]">
                  {sch.school_name}
                </h3>
                <p className="text-xs text-[#5f5d5d] flex items-center gap-1.5 mt-1 truncate">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{reg?.name || sch.regional_id} &bull; {[sch.village, sch.district, sch.regency].filter(Boolean).join(', ') || 'Indonesia'}</span>
                </p>

                {/* Principal */}
                <div className="mt-4 pt-3 border-t border-gray-100 text-xs">
                  <span className="text-[11px] text-[#5f5d5d] block">Kepala Sekolah:</span>
                  <span className="font-medium text-gray-800 truncate block">
                    {sch.principal_name || 'Belum Ditugaskan'}
                  </span>
                </div>
              </div>

              {/* Bottom stats and action buttons */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-[#5f5d5d]">
                  Kapasitas: <strong className="text-gray-900">{sch.school_capacity || 'N/A'}</strong>
                </span>

                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  {canManageSchools && (
                    <>
                      <button
                        onClick={(e) => openEditModal(sch, e)}
                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                        title="Edit Data Sekolah"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => promptDelete(sch, e)}
                        className="p-1.5 rounded-md hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Hapus Sekolah"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => onSelectSchool(sch.school_id)}
                    className="p-1.5 rounded-md bg-emerald-50 text-[#073b2d] font-semibold text-[11px] flex items-center gap-1 hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    <span>Detail</span>
                    <Eye className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
          <SchoolIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-gray-700">Tidak ada sekolah ditemukan</h3>
          <p className="text-xs text-gray-500 mt-1">Coba sesuaikan kata kunci pencarian atau filter wilayah.</p>
        </div>
      )}

      {/* Add / Edit School Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-200">
              {editingSchool ? 'Edit Data Sekolah' : 'Tambah Unit Sekolah Baru'}
            </h3>

            {formError && (
              <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">ID Sekolah (Sistem)</label>
                  <input
                    type="text"
                    disabled={!!editingSchool}
                    value={formData.school_id}
                    onChange={(e) => setFormData({ ...formData, school_id: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 bg-gray-50 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">NPSN (Nomor Pokok Sekolah)</label>
                  <input
                    type="text"
                    value={formData.npsn}
                    onChange={(e) => setFormData({ ...formData, npsn: e.target.value })}
                    placeholder="Contoh: 30205812"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Resmi Sekolah *</label>
                  <input
                    type="text"
                    value={formData.school_name}
                    onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                    placeholder="Contoh: SD ARF Bestari Sampit"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Wilayah / Regional *</label>
                  <select
                    value={formData.regional_id}
                    onChange={(e) => setFormData({ ...formData, regional_id: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    {regions.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Jenjang Pendidikan *</label>
                  <select
                    value={formData.education_level}
                    onChange={(e) => setFormData({ ...formData, education_level: e.target.value as EducationLevel })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    {formData.education_level === 'PAUD' && <option value="PAUD" disabled>PAUD (data lama — pilih jenjang baru)</option>}
                    {EDUCATION_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Alamat Lengkap</label>
                  <input
                    type="text"
                    value={formData.school_address}
                    onChange={(e) => setFormData({ ...formData, school_address: e.target.value })}
                    placeholder="Jalan, RT/RW, Kelurahan"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Kecamatan</label>
                  <input
                    type="text"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    placeholder="Contoh: Baamang"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Desa / Kelurahan</label>
                  <input
                    type="text"
                    value={formData.village}
                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                    placeholder="Contoh: Baamang Tengah"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Kabupaten / Kota</label>
                  <input
                    type="text"
                    value={formData.regency}
                    onChange={(e) => setFormData({ ...formData, regency: e.target.value })}
                    placeholder="Contoh: Kotawaringin Timur"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Status Operasional</label>
                  <select
                    value={formData.operational_status}
                    onChange={(e) => setFormData({ ...formData, operational_status: e.target.value as OperationalStatus })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Izin Operasional Baru">Izin Operasional Baru</option>
                    <option value="Menunggu Akreditasi">Menunggu Akreditasi</option>
                    <option value="Nonaktif">Nonaktif</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">No. Izin Operasional</label>
                  <input
                    type="text"
                    value={formData.operational_license}
                    onChange={(e) => setFormData({ ...formData, operational_license: e.target.value })}
                    placeholder="Nomor SK Izin"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tingkat Akreditasi</label>
                  <select
                    value={formData.accreditation_grade}
                    onChange={(e) => setFormData({ ...formData, accreditation_grade: e.target.value as AccreditationGrade })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  >
                    <option value="A">Akreditasi A (Unggul)</option>
                    <option value="B">Akreditasi B (Baik)</option>
                    <option value="C">Akreditasi C (Cukup)</option>
                    <option value="Belum Terakreditasi">Belum Terakreditasi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Kapasitas Daya Tampung (Siswa)</label>
                  <input
                    type="number"
                    value={formData.school_capacity}
                    onChange={(e) => setFormData({ ...formData, school_capacity: Number(e.target.value) })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Kepala Sekolah</label>
                  <input
                    type="text"
                    value={formData.principal_name}
                    onChange={(e) => setFormData({ ...formData, principal_name: e.target.value })}
                    placeholder="Gelar &amp; Nama Lengkap Kepala Sekolah"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>
              </div>

              {/* Modal Actions */}
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
                  className="px-4 py-2 rounded-lg text-white font-semibold text-xs transition-colors shadow-sm"
                  style={{ backgroundColor: '#073b2d' }}
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Data Sekolah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete School Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Hapus Data Unit Sekolah"
        message="Apakah Anda yakin ingin menghapus unit sekolah ini dari database? Seluruh data subkoleksi (rombongan belajar, data PTK, inventaris aset, dan sarana prasarana) akan dibersihkan secara permanen."
        itemName={deleteModal.school ? `${deleteModal.school.school_name} (${deleteModal.school.school_id})` : undefined}
        confirmLabel="Hapus Sekolah Permanen"
        cancelLabel="Batal"
        loading={deleteModal.deleting}
        error={deleteModal.error}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, school: null, deleting: false, error: null })}
      />
    </div>
  );
};
