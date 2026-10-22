import React, { useRef, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Building2,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Download,
  Image as ImageIcon
} from 'lucide-react';
import { Facility, School, FacilityType, FacilityCondition, RepairPriority } from '../../types';
import { facilitiesService } from '../../services/facilitiesService';
import { excelService } from '../../services/excelService';
import { useAuth } from '../../context/AuthContext';
import { PhotoUploadField } from '../../components/ui/PhotoUploadField';
import { checkImageUploadReady, imageStorageService } from '../../services/imageStorageService';
import { DATABASE_SAVE_TIMEOUT_MS, OperationTimeoutError, photoSaveErrorMessage, withTimeout } from '../../services/operationTimeout';

interface FacilitiesViewProps {
  schools: School[];
  facilities: Facility[];
  onRefresh: () => void;
}

export const FacilitiesView: React.FC<FacilitiesViewProps> = ({
  schools,
  facilities,
  onRefresh
}) => {
  const { hasSchoolAccess } = useAuth();
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(schools[0]?.school_id || 'ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [conditionFilter, setConditionFilter] = useState('ALL');
  const [repairFilter, setRepairFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitInFlight = useRef(false);
  const [saveStage, setSaveStage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [physicalImageFile, setPhysicalImageFile] = useState<File | null>(null);
  const [damageImageFile, setDamageImageFile] = useState<File | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    facility_id: '',
    school_id: schools[0]?.school_id || '',
    facility_type: 'Ruang Kelas' as FacilityType,
    facility_name: '',
    facility_area_m2: 56,
    facility_capacity: 30,
    facility_condition: 'Baik' as FacilityCondition,
    facility_availability: 'Tersedia Penuh',
    facility_utilization: 'Maksimal',
    repair_required: false,
    repair_priority: 'Rendah' as RepairPriority,
    estimated_repair_cost: 0,
    notes: '',
    physical_image_url: '',
    physical_image_path: '',
    damage_image_url: '',
    damage_image_path: ''
  });

  const accessibleSchools = schools.filter(s => hasSchoolAccess(s.school_id));

  const filteredFacilities = facilities.filter(f => {
    if (!hasSchoolAccess(f.school_id)) return false;
    if (selectedSchoolId !== 'ALL' && f.school_id !== selectedSchoolId) return false;
    if (typeFilter !== 'ALL' && f.facility_type !== typeFilter) return false;
    if (conditionFilter !== 'ALL' && f.facility_condition !== conditionFilter) return false;
    if (repairFilter === 'REQUIRED' && !f.repair_required) return false;
    if (repairFilter === 'NOT_REQUIRED' && f.repair_required) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        f.facility_name.toLowerCase().includes(q) ||
        (f.notes || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openAddModal = () => {
    setEditingFacility(null);
    setFormError(null);
    setPhysicalImageFile(null);
    setDamageImageFile(null);
    setFormData({
      facility_id: `FAC-${Date.now().toString().slice(-6)}`,
      school_id: selectedSchoolId !== 'ALL' ? selectedSchoolId : (accessibleSchools[0]?.school_id || ''),
      facility_type: 'Ruang Kelas',
      facility_name: '',
      facility_area_m2: 56,
      facility_capacity: 30,
      facility_condition: 'Baik',
      facility_availability: 'Tersedia Penuh',
      facility_utilization: 'Maksimal',
      repair_required: false,
      repair_priority: 'Rendah',
      estimated_repair_cost: 0,
      notes: '',
      physical_image_url: '',
      physical_image_path: '',
      damage_image_url: '',
      damage_image_path: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (fac: Facility) => {
    setEditingFacility(fac);
    setFormError(null);
    setPhysicalImageFile(null);
    setDamageImageFile(null);
    setFormData({
      facility_id: fac.facility_id,
      school_id: fac.school_id,
      facility_type: fac.facility_type,
      facility_name: fac.facility_name,
      facility_area_m2: fac.facility_area_m2 || 0,
      facility_capacity: fac.facility_capacity || 0,
      facility_condition: fac.facility_condition,
      facility_availability: fac.facility_availability || 'Tersedia Penuh',
      facility_utilization: fac.facility_utilization || 'Maksimal',
      repair_required: fac.repair_required,
      repair_priority: fac.repair_priority || 'Rendah',
      estimated_repair_cost: fac.estimated_repair_cost || 0,
      notes: fac.notes || '',
      physical_image_url: fac.physical_image_url || '',
      physical_image_path: fac.physical_image_path || '',
      damage_image_url: fac.damage_image_url || '',
      damage_image_path: fac.damage_image_path || ''
    });
    setModalOpen(true);
  };

  const handleDelete = async (schoolId: string, facilityId: string) => {
    if (confirm(`Hapus data prasarana ${facilityId}?`)) {
      await facilitiesService.deleteFacility(schoolId, facilityId);
      onRefresh();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitInFlight.current) return;
    setFormError(null);
    if (!formData.facility_name || !formData.school_id) {
      setFormError('Nama Fasilitas dan Sekolah wajib diisi!');
      return;
    }
    if (physicalImageFile || (formData.repair_required && damageImageFile)) {
      try { checkImageUploadReady(); }
      catch (error) { setFormError(photoSaveErrorMessage(error)); return; }
    }

    submitInFlight.current = true;
    setSubmitting(true);
    setSaveStage('Menyiapkan penyimpanan fasilitas...');
    const newPaths: string[] = [];
    let databaseSaved = false;
    try {
      let physical_image_url = formData.physical_image_url;
      let physical_image_path = formData.physical_image_path;
      let damage_image_url = formData.repair_required ? formData.damage_image_url : '';
      let damage_image_path = formData.repair_required ? formData.damage_image_path : '';

      if (physicalImageFile) {
        setSaveStage('Memulai upload foto fisik...');
        const uploaded = await imageStorageService.uploadImage(
          physicalImageFile, formData.school_id, 'facilities', formData.facility_id, 'physical',
          percent => setSaveStage(`Mengunggah foto fisik: ${percent}%`)
        );
        newPaths.push(uploaded.path);
        physical_image_url = uploaded.url;
        physical_image_path = uploaded.path;
      }
      if (formData.repair_required && damageImageFile) {
        setSaveStage('Memulai upload foto kerusakan...');
        const uploaded = await imageStorageService.uploadImage(
          damageImageFile, formData.school_id, 'facilities', formData.facility_id, 'damage',
          percent => setSaveStage(`Mengunggah foto kerusakan: ${percent}%`)
        );
        newPaths.push(uploaded.path);
        damage_image_url = uploaded.url;
        damage_image_path = uploaded.path;
      }
      setSaveStage('Menyimpan data fasilitas ke Supabase...');
      await withTimeout(facilitiesService.saveFacility({
        ...formData,
        physical_image_url,
        physical_image_path,
        damage_image_url,
        damage_image_path,
        facility_area_m2: Number(formData.facility_area_m2) || 0,
        facility_capacity: Number(formData.facility_capacity) || 0,
        estimated_repair_cost: formData.repair_required ? Number(formData.estimated_repair_cost) || 0 : 0,
        created_at: editingFacility ? editingFacility.created_at : new Date().toISOString()
      }), DATABASE_SAVE_TIMEOUT_MS, 'firestore');
      databaseSaved = true;
      // Fire-and-forget bounded cleanup, only after Supabase acknowledges saving.
      void imageStorageService.cleanupImages([
        editingFacility?.physical_image_path && editingFacility.physical_image_path !== physical_image_path
          ? editingFacility.physical_image_path : undefined,
        editingFacility?.damage_image_path && editingFacility.damage_image_path !== damage_image_path
          ? editingFacility.damage_image_path : undefined
      ]);
      setModalOpen(false);
      setPhysicalImageFile(null);
      setDamageImageFile(null);
      try { onRefresh(); } catch (error) { console.warn('Refresh fasilitas gagal:', error); }
    } catch (error) {
      if (!databaseSaved && !(error instanceof OperationTimeoutError && error.stage === 'firestore')) {
        await imageStorageService.cleanupImages(newPaths);
      }
      setFormError(photoSaveErrorMessage(error));
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
      setSaveStage(null);
    }
  };

  const handleExport = () => {
    const dataToExport = filteredFacilities.map(f => {
      const sch = schools.find(sc => sc.school_id === f.school_id);
      return {
        'ID Fasilitas': f.facility_id,
        'Sekolah': sch?.school_name || f.school_id,
        'Tipe Fasilitas': f.facility_type,
        'Nama Fasilitas': f.facility_name,
        'Luas (m2)': f.facility_area_m2 || 0,
        'Kapasitas': f.facility_capacity || 0,
        'Kondisi Fisik': f.facility_condition,
        'Perlu Perbaikan': f.repair_required ? 'Ya' : 'Tidak',
        'Prioritas Perbaikan': f.repair_priority || '-',
        'Estimasi Biaya Perbaikan (Rp)': f.estimated_repair_cost || 0,
        'Catatan Pemeriksaan': f.notes || '-'
      };
    });
    excelService.exportReport('ARF_Laporan_Prasarana_Fasilitas', 'Data_Prasarana', dataToExport);
  };

  const metrics = facilitiesService.calculateFacilityMetrics(filteredFacilities);

  return (
    <div className="space-y-6">
      {/* Top Filter and Actions */}
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

            {/* Type */}
            <div>
              <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Tipe Fasilitas</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-800"
              >
                <option value="ALL">Semua Tipe</option>
                <option value="Ruang Kelas">Ruang Kelas</option>
                <option value="Perpustakaan">Perpustakaan</option>
                <option value="Laboratorium">Laboratorium</option>
                <option value="Toilet">Toilet</option>
                <option value="Ruang Guru">Ruang Guru</option>
                <option value="Ruang Kepala Sekolah">Ruang Kepala Sekolah</option>
                <option value="Kantor">Kantor</option>
                <option value="Lapangan">Lapangan</option>
                <option value="Ruang UKS">Ruang UKS</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            {/* Condition */}
            <div>
              <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Kondisi</label>
              <select
                value={conditionFilter}
                onChange={(e) => setConditionFilter(e.target.value)}
                className="text-xs py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-800"
              >
                <option value="ALL">Semua Kondisi</option>
                <option value="Baik">Baik</option>
                <option value="Rusak Ringan">Rusak Ringan</option>
                <option value="Rusak Sedang">Rusak Sedang</option>
                <option value="Rusak Berat">Rusak Berat</option>
              </select>
            </div>

            {/* Repair Required */}
            <div>
              <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Kebutuhan Perbaikan</label>
              <select
                value={repairFilter}
                onChange={(e) => setRepairFilter(e.target.value)}
                className="text-xs py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-800"
              >
                <option value="ALL">Semua Status</option>
                <option value="REQUIRED">Perlu Perbaikan</option>
                <option value="NOT_REQUIRED">Tidak Perlu</option>
              </select>
            </div>

            {/* Search */}
            <div className="relative min-w-[180px] self-end">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari fasilitas..."
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
              title="Ekspor Data Prasarana ke Excel"
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
              <span>Tambah Fasilitas Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-[#5f5d5d]">Total Fasilitas / Ruang</span>
          <div className="text-2xl font-extrabold text-gray-900 mt-1">{metrics.totalFacilities}</div>
          <span className="text-[11px] text-[#5f5d5d] mt-1 block">Total Luas: {metrics.totalArea} m&sup2;</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-[#5f5d5d]">Fasilitas Kondisi Baik</span>
          <div className="text-2xl font-extrabold text-[#009b4c] mt-1">{metrics.goodConditionCount}</div>
          <span className="text-[11px] text-[#5f5d5d] mt-1 block">Siap Digunakan</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-[#5f5d5d]">Fasilitas Butuh Perbaikan</span>
          <div className="text-2xl font-extrabold text-orange-600 mt-1">{metrics.repairRequiredCount}</div>
          <span className="text-[11px] text-orange-700 font-semibold mt-1 block">
            {metrics.damagedCount} Ruang Mengalami Kerusakan
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-[#5f5d5d]">Estimasi Biaya Perbaikan</span>
          <div className="text-xl font-extrabold text-[#073b2d] mt-1 truncate">
            Rp {(metrics.totalEstimatedRepairCost / 1000000).toFixed(1)} Jt
          </div>
          <span className="text-[11px] text-[#5f5d5d] mt-1 block">Usulan Anggaran</span>
        </div>
      </div>

      {/* Facilities Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">
            Daftar Sarana &amp; Prasarana ({filteredFacilities.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 text-center">Foto Fisik / Kerusakan</th>
                <th className="py-3 px-4">Nama Fasilitas &amp; ID</th>
                <th className="py-3 px-4">Sekolah</th>
                <th className="py-3 px-4">Tipe &amp; Dimensi</th>
                <th className="py-3 px-4 text-center">Kondisi Fisik</th>
                <th className="py-3 px-4 text-center">Perlu Perbaikan</th>
                <th className="py-3 px-4">Prioritas &amp; Estimasi Biaya</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredFacilities.map(fac => {
                const sch = schools.find(s => s.school_id === fac.school_id);

                return (
                  <tr key={fac.facility_id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {fac.physical_image_url ? (
                          <a href={fac.physical_image_url} target="_blank" rel="noopener noreferrer" title="Lihat foto fisik">
                            <img src={fac.physical_image_url} alt={`Foto fisik ${fac.facility_name}`} loading="lazy" className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
                          </a>
                        ) : (
                          <div className="w-14 h-14 flex justify-center items-center border border-dashed border-gray-200 rounded-lg text-gray-300" title="Belum ada foto fisik">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                        {fac.repair_required && fac.damage_image_url && (
                          <a href={fac.damage_image_url} target="_blank" rel="noopener noreferrer" title="Lihat foto kerusakan" className="relative">
                            <img src={fac.damage_image_url} alt={`Foto kerusakan ${fac.facility_name}`} loading="lazy" className="w-14 h-14 object-cover rounded-lg border-2 border-rose-300" />
                            <span className="absolute bottom-0 right-0 text-[9px] px-1 bg-rose-700 text-white rounded-tl">Rusak</span>
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{fac.facility_name}</div>
                      <div className="text-[11px] text-gray-400 font-mono">{fac.facility_id}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{sch?.school_name || fac.school_id}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-800">{fac.facility_type}</div>
                      <div className="text-[11px] text-[#5f5d5d]">
                        {fac.facility_area_m2} m&sup2; &bull; Kapasitas: {fac.facility_capacity || '-'} orang
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                        fac.facility_condition === 'Baik'
                          ? 'bg-emerald-100 text-emerald-800'
                          : fac.facility_condition === 'Rusak Berat'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {fac.facility_condition}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {fac.repair_required ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          <Wrench className="w-3 h-3 text-rose-600" />
                          <span>Perlu Perbaikan</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>Baik</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {fac.repair_required ? (
                        <div>
                          <div className="font-semibold text-gray-800">
                            Prioritas: <span className="font-bold text-rose-700">{fac.repair_priority || 'Sedang'}</span>
                          </div>
                          <div className="text-[11px] text-[#5f5d5d]">
                            Est: Rp {(fac.estimated_repair_cost || 0).toLocaleString('id-ID')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(fac)}
                          className="p-1 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                          title="Edit Fasilitas"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(fac.school_id, fac.facility_id)}
                          className="p-1 rounded-md hover:bg-rose-50 text-gray-400 hover:text-rose-600"
                          title="Hapus Fasilitas"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredFacilities.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    Belum ada data prasarana yang cocok dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit Facility */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-200">
              {editingFacility ? 'Edit Data Prasarana &amp; Fasilitas' : 'Tambah Prasarana Ruang Baru'}
            </h3>

            {formError && (
              <div role="alert" className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                {formError}
              </div>
            )}
            {saveStage && (
              <div role="status" aria-live="polite" className="mt-3 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-[#3f6276]">
                {saveStage} <span className="block mt-1 font-normal text-gray-600">Jika server tidak merespons, penyimpanan akan dihentikan otomatis dan pesan kesalahan akan ditampilkan.</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Sekolah *</label>
                  <select
                    value={formData.school_id}
                    onChange={(e) => setFormData({ ...formData, school_id: e.target.value })}
                    disabled={Boolean(editingFacility)}
                    title={editingFacility ? "Sekolah asal fasilitas tidak dapat diganti saat edit." : undefined}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    {accessibleSchools.map(s => (
                      <option key={s.school_id} value={s.school_id}>{s.school_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tipe Fasilitas *</label>
                  <select
                    value={formData.facility_type}
                    onChange={(e) => setFormData({ ...formData, facility_type: e.target.value as FacilityType })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    <option value="Ruang Kelas">Ruang Kelas</option>
                    <option value="Perpustakaan">Perpustakaan</option>
                    <option value="Laboratorium">Laboratorium</option>
                    <option value="Toilet">Toilet</option>
                    <option value="Ruang Guru">Ruang Guru</option>
                    <option value="Ruang Kepala Sekolah">Ruang Kepala Sekolah</option>
                    <option value="Kantor">Kantor</option>
                    <option value="Lapangan">Lapangan</option>
                    <option value="Ruang UKS">Ruang UKS</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Fasilitas / Gedung *</label>
                  <input
                    type="text"
                    value={formData.facility_name}
                    onChange={(e) => setFormData({ ...formData, facility_name: e.target.value })}
                    placeholder="Contoh: Gedung A - Ruang Kelas 1A"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Luas Bangunan (m&sup2;)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.facility_area_m2}
                    onChange={(e) => setFormData({ ...formData, facility_area_m2: Number(e.target.value) })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Kapasitas Maksimal (Orang)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.facility_capacity}
                    onChange={(e) => setFormData({ ...formData, facility_capacity: Number(e.target.value) })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Kondisi Bangunan *</label>
                  <select
                    value={formData.facility_condition}
                    onChange={(e) => setFormData({ ...formData, facility_condition: e.target.value as FacilityCondition })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    <option value="Baik">Baik</option>
                    <option value="Rusak Ringan">Rusak Ringan</option>
                    <option value="Rusak Sedang">Rusak Sedang</option>
                    <option value="Rusak Berat">Rusak Berat</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Kebutuhan Perbaikan Fisik</label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="repair_req"
                      checked={formData.repair_required}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          repair_required: e.target.checked,
                          ...(!e.target.checked ? { damage_image_url: '', damage_image_path: '' } : {})
                        }));
                        if (!e.target.checked) setDamageImageFile(null);
                      }}
                      className="w-4 h-4 rounded text-[#073b2d]"
                    />
                    <label htmlFor="repair_req" className="text-xs font-semibold text-gray-800">
                      Memerlukan Perbaikan / Renovasi
                    </label>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <PhotoUploadField
                    label="Upload Gambar Fisik"
                    existingUrl={formData.physical_image_url}
                    file={physicalImageFile}
                    onFileChange={setPhysicalImageFile}
                    onRemoveExisting={() => setFormData(prev => ({ ...prev, physical_image_url: '', physical_image_path: '' }))}
                    disabled={submitting}
                  />
                </div>

                {formData.repair_required && (
                  <>
                    <div className="sm:col-span-2">
                      <PhotoUploadField
                        label="Upload Gambar Kerusakan"
                        existingUrl={formData.damage_image_url}
                        file={damageImageFile}
                        onFileChange={setDamageImageFile}
                        onRemoveExisting={() => setFormData(prev => ({ ...prev, damage_image_url: '', damage_image_path: '' }))}
                        disabled={submitting}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Prioritas Perbaikan</label>
                      <select
                        value={formData.repair_priority}
                        onChange={(e) => setFormData({ ...formData, repair_priority: e.target.value as RepairPriority })}
                        className="w-full text-xs p-2 rounded-lg border border-gray-300"
                      >
                        <option value="Kritis">Kritis (Mendesak)</option>
                        <option value="Tinggi">Tinggi</option>
                        <option value="Sedang">Sedang</option>
                        <option value="Rendah">Rendah</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Estimasi Biaya Perbaikan (Rp)</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.estimated_repair_cost}
                        onChange={(e) => setFormData({ ...formData, estimated_repair_cost: Number(e.target.value) })}
                        className="w-full text-xs p-2 rounded-lg border border-gray-300"
                      />
                    </div>
                  </>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan Hasil Inspeksi</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Keterangan kerusakan lantai, atap, instalasi listrik/air..."
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-50 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-white font-semibold text-xs shadow-sm"
                  style={{ backgroundColor: '#073b2d' }}
                >
                  {submitting ? 'Memproses...' : 'Simpan Fasilitas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
