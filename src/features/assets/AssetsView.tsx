import React, { useRef, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Building2,
  Download,
  AlertTriangle,
  CheckCircle,
  Coins,
  Archive,
  Image as ImageIcon
} from 'lucide-react';
import { Asset, School, AssetCategory, AssetCondition, AssetStatus, FundingSource } from '../../types';
import { assetsService } from '../../services/assetsService';
import { excelService } from '../../services/excelService';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PhotoUploadField } from '../../components/ui/PhotoUploadField';
import { checkImageUploadReady, imageStorageService } from '../../services/imageStorageService';
import { DATABASE_SAVE_TIMEOUT_MS, OperationTimeoutError, photoSaveErrorMessage, withTimeout } from '../../services/operationTimeout';

interface AssetsViewProps {
  schools: School[];
  assets: Asset[];
  onRefresh: () => void;
}

export const AssetsView: React.FC<AssetsViewProps> = ({
  schools,
  assets,
  onRefresh
}) => {
  const { hasSchoolAccess, isSuperAdmin, isFoundationManager, isAssetOfficer } = useAuth();
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(schools[0]?.school_id || 'ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [conditionFilter, setConditionFilter] = useState('ALL');
  const [fundingFilter, setFundingFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitInFlight = useRef(false);
  const [saveStage, setSaveStage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [assetImageFile, setAssetImageFile] = useState<File | null>(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    asset: Asset | null;
    deleting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    asset: null,
    deleting: false,
    error: null,
  });

  // Form State
  const [formData, setFormData] = useState({
    asset_id: '',
    school_id: schools[0]?.school_id || '',
    asset_code: '',
    asset_name: '',
    asset_category: 'Perangkat IT' as AssetCategory,
    asset_brand_spec: '',
    asset_serial_number: '',
    quantity: 1,
    unit_measure: 'Unit',
    acquisition_date: new Date().toISOString().split('T')[0],
    funding_source: 'ARF' as FundingSource,
    funding_year: new Date().getFullYear(),
    acquisition_unit_value: 0,
    asset_condition: 'Baik' as AssetCondition,
    asset_status: 'Digunakan' as AssetStatus,
    image_url: '',
    image_path: ''
  });

  const accessibleSchools = schools.filter(s => hasSchoolAccess(s.school_id));

  const filteredAssets = assets.filter(a => {
    if (!hasSchoolAccess(a.school_id)) return false;
    if (selectedSchoolId !== 'ALL' && a.school_id !== selectedSchoolId) return false;
    if (categoryFilter !== 'ALL' && a.asset_category !== categoryFilter) return false;
    if (conditionFilter !== 'ALL' && a.asset_condition !== conditionFilter) return false;
    if (fundingFilter !== 'ALL' && a.funding_source !== fundingFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        a.asset_name.toLowerCase().includes(q) ||
        (a.asset_code || '').toLowerCase().includes(q) ||
        (a.asset_brand_spec || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openAddModal = () => {
    setEditingAsset(null);
    setFormError(null);
    setAssetImageFile(null);
    setFormData({
      asset_id: `AST-${Date.now().toString().slice(-6)}`,
      school_id: selectedSchoolId !== 'ALL' ? selectedSchoolId : (accessibleSchools[0]?.school_id || ''),
      asset_code: '',
      asset_name: '',
      asset_category: 'Perangkat IT',
      asset_brand_spec: '',
      asset_serial_number: '',
      quantity: 1,
      unit_measure: 'Unit',
      acquisition_date: new Date().toISOString().split('T')[0],
      funding_source: 'ARF',
      funding_year: new Date().getFullYear(),
      acquisition_unit_value: 0,
      asset_condition: 'Baik',
      asset_status: 'Digunakan',
      image_url: '',
      image_path: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (ast: Asset) => {
    setEditingAsset(ast);
    setFormError(null);
    setAssetImageFile(null);
    setFormData({
      asset_id: ast.asset_id,
      school_id: ast.school_id,
      asset_code: ast.asset_code || '',
      asset_name: ast.asset_name,
      asset_category: ast.asset_category,
      asset_brand_spec: ast.asset_brand_spec || '',
      asset_serial_number: ast.asset_serial_number || '',
      quantity: ast.quantity,
      unit_measure: ast.unit_measure,
      acquisition_date: ast.acquisition_date || '',
      funding_source: ast.funding_source,
      funding_year: ast.funding_year || new Date().getFullYear(),
      acquisition_unit_value: ast.acquisition_unit_value,
      asset_condition: ast.asset_condition,
      asset_status: ast.asset_status,
      image_url: ast.image_url || '',
      image_path: ast.image_path || ''
    });
    setModalOpen(true);
  };

  const promptDelete = (ast: Asset) => {
    setDeleteModal({
      isOpen: true,
      asset: ast,
      deleting: false,
      error: null
    });
  };

  const confirmDelete = async () => {
    if (!deleteModal.asset) return;
    setDeleteModal(prev => ({ ...prev, deleting: true, error: null }));
    try {
      await assetsService.deleteAsset(deleteModal.asset.school_id, deleteModal.asset.asset_id);
      setDeleteModal({ isOpen: false, asset: null, deleting: false, error: null });
      onRefresh();
    } catch (err: any) {
      console.error('Gagal menghapus aset:', err);
      setDeleteModal(prev => ({
        ...prev,
        deleting: false,
        error: err.message || 'Gagal menghapus aset dari database.'
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitInFlight.current) return; // Double-clicks must not initiate duplicate uploads.
    setFormError(null);
    if (!formData.asset_name || !formData.school_id) {
      setFormError('Nama Aset dan Sekolah wajib diisi!');
      return;
    }
    // Local/simulated AI Studio sessions cannot upload to protected Supabase Storage.
    // Validate before disabling the form, so the error is immediately actionable.
    if (assetImageFile) {
      try { checkImageUploadReady(); }
      catch (error) { setFormError(photoSaveErrorMessage(error)); return; }
    }

    submitInFlight.current = true;
    setSubmitting(true);
    setSaveStage(assetImageFile ? 'Memulai upload foto aset...' : 'Menyimpan data aset ke Supabase...');
    const newPaths: string[] = [];
    let databaseSaved = false;
    try {
      let image_url = formData.image_url;
      let image_path = formData.image_path;
      if (assetImageFile) {
        const uploaded = await imageStorageService.uploadImage(
          assetImageFile, formData.school_id, 'assets', formData.asset_id, 'asset',
          percent => setSaveStage(`Mengunggah foto aset: ${percent}%`)
        );
        newPaths.push(uploaded.path);
        image_url = uploaded.url;
        image_path = uploaded.path;
      }
      setSaveStage('Menyimpan data aset ke Supabase...');
      await withTimeout(assetsService.saveAsset({
        ...formData,
        image_url,
        image_path,
        quantity: Number(formData.quantity) || 1,
        acquisition_unit_value: Number(formData.acquisition_unit_value) || 0,
        funding_year: Number(formData.funding_year) || new Date().getFullYear(),
        created_at: editingAsset ? editingAsset.created_at : new Date().toISOString()
      }), DATABASE_SAVE_TIMEOUT_MS, 'firestore');
      databaseSaved = true;

      // Cleanup cannot keep the modal spinning after the record is saved.
      if (editingAsset?.image_path && editingAsset.image_path !== image_path) {
        void imageStorageService.cleanupImages([editingAsset.image_path]);
      }
      setModalOpen(false);
      setAssetImageFile(null);
      try { onRefresh(); } catch (error) { console.warn('Refresh aset gagal:', error); }
    } catch (error) {
      // A Supabase timeout is ambiguous: the server may commit the write later.
      // Do not delete the uploaded image that such a write may reference.
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
    const dataToExport = filteredAssets.map(a => {
      const sch = schools.find(sc => sc.school_id === a.school_id);
      return {
        'ID Aset': a.asset_id,
        'Sekolah': sch?.school_name || a.school_id,
        'Kode Barang': a.asset_code || '-',
        'Nama Aset': a.asset_name,
        'Kategori': a.asset_category,
        'Merk & Spesifikasi': a.asset_brand_spec || '-',
        'Jumlah Unit': a.quantity,
        'Satuan': a.unit_measure,
        'Sumber Dana': a.funding_source,
        'Tahun Pengadaan': a.funding_year || '-',
        'Harga Perolehan Satuan (Rp)': a.acquisition_unit_value,
        'Total Nilai Perolehan (Rp)': a.quantity * a.acquisition_unit_value,
        'Kondisi': a.asset_condition,
        'Status Aset': a.asset_status
      };
    });
    excelService.exportReport('ARF_Laporan_Inventaris_Aset', 'Data_Aset', dataToExport);
  };

  const metrics = assetsService.calculateAssetMetrics(filteredAssets);

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

            {/* Category */}
            <div>
              <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Kategori Aset</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-800"
              >
                <option value="ALL">Semua Kategori</option>
                <option value="Furniture">Furniture</option>
                <option value="Perangkat IT">Perangkat IT</option>
                <option value="Buku & Perpustakaan">Buku & Perpustakaan</option>
                <option value="Alat Permainan Edukatif">Alat Permainan Edukatif</option>
                <option value="Laboratorium">Laboratorium</option>
                <option value="Peralatan Pembelajaran">Peralatan Pembelajaran</option>
                <option value="Peralatan Kantor">Peralatan Kantor</option>
                <option value="Peralatan Olahraga">Peralatan Olahraga</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            {/* Condition */}
            <div>
              <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Kondisi Fisik</label>
              <select
                value={conditionFilter}
                onChange={(e) => setConditionFilter(e.target.value)}
                className="text-xs py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-800"
              >
                <option value="ALL">Semua Kondisi</option>
                <option value="Baik">Baik</option>
                <option value="Rusak Ringan">Rusak Ringan</option>
                <option value="Rusak Berat">Rusak Berat</option>
              </select>
            </div>

            {/* Funding */}
            <div>
              <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Sumber Dana</label>
              <select
                value={fundingFilter}
                onChange={(e) => setFundingFilter(e.target.value)}
                className="text-xs py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-800"
              >
                <option value="ALL">Semua Sumber</option>
                <option value="ARF">ARF (Yayasan)</option>
                <option value="BOS">BOS</option>
                <option value="BOP">BOP</option>
                <option value="Donasi">Donasi</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            {/* Search */}
            <div className="relative min-w-[180px] self-end">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari aset, merk..."
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
              title="Ekspor Inventaris ke Excel"
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
              <span>Tambah Aset Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* Asset KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-[#5f5d5d]">Total Unit Aset</span>
          <div className="text-2xl font-extrabold text-gray-900 mt-1">{metrics.totalUnits.toLocaleString()}</div>
          <span className="text-[11px] text-[#5f5d5d] mt-1 block">Dari {metrics.totalAssetItems} Item Terdaftar</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-[#5f5d5d]">Total Nilai Perolehan</span>
          <div className="text-xl font-extrabold text-[#073b2d] mt-1 truncate">
            Rp {(metrics.totalAcquisitionValue / 1000000).toFixed(1)} Jt
          </div>
          <span className="text-[11px] text-[#5f5d5d] mt-1 block">Akumulasi Pembelian</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-[#5f5d5d]">Aset Kondisi Baik</span>
          <div className="text-2xl font-extrabold text-[#009b4c] mt-1">{metrics.goodUnits}</div>
          <span className="text-[11px] text-[#5f5d5d] mt-1 block">
            {metrics.totalUnits > 0 ? ((metrics.goodUnits / metrics.totalUnits) * 100).toFixed(1) : 0}% Kondisi Prima
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-[#5f5d5d]">Aset Rusak</span>
          <div className="text-2xl font-extrabold text-orange-600 mt-1">{metrics.damagedUnits}</div>
          <span className="text-[11px] text-orange-700 font-semibold mt-1 block">
            {metrics.damagedPercentage.toFixed(1)}% Unit Rusak
          </span>
        </div>
      </div>

      {/* Asset Inventory Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">
            Daftar Inventaris Sarana &amp; Aset ({filteredAssets.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 text-center">Foto Aset</th>
                <th className="py-3 px-4">Nama Barang &amp; Kode</th>
                <th className="py-3 px-4">Sekolah</th>
                <th className="py-3 px-4">Kategori &amp; Spesifikasi</th>
                <th className="py-3 px-4 text-center">Jumlah</th>
                <th className="py-3 px-4">Pendanaan &amp; Nilai</th>
                <th className="py-3 px-4 text-center">Kondisi &amp; Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAssets.map(ast => {
                const sch = schools.find(s => s.school_id === ast.school_id);
                const totalVal = (Number(ast.quantity) || 0) * (Number(ast.acquisition_unit_value) || 0);

                return (
                  <tr key={ast.asset_id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4">
                      {ast.image_url ? (
                        <a href={ast.image_url} target="_blank" rel="noopener noreferrer" title={`Lihat foto ${ast.asset_name}`}>
                          <img src={ast.image_url} alt={`Foto ${ast.asset_name}`} loading="lazy" className="w-16 h-16 object-cover rounded-lg border border-gray-200 mx-auto" />
                        </a>
                      ) : (
                        <div className="w-16 h-16 flex items-center justify-center rounded-lg border border-dashed border-gray-200 text-gray-300 mx-auto" title="Belum ada foto">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{ast.asset_name}</div>
                      <div className="text-[11px] text-gray-400 font-mono">{ast.asset_code || ast.asset_id}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{sch?.school_name || ast.school_id}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-800">{ast.asset_category}</div>
                      <div className="text-[11px] text-[#5f5d5d] truncate max-w-[200px]">{ast.asset_brand_spec || '-'}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-gray-900">
                      {ast.quantity} {ast.unit_measure}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">
                        Sumber: <span className="font-bold text-[#073b2d]">{ast.funding_source}</span>
                      </div>
                      <div className="text-[11px] text-[#5f5d5d]">
                        Rp {totalVal.toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ast.asset_condition === 'Baik'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ast.asset_condition === 'Rusak Berat'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {ast.asset_condition}
                        </span>
                        <span className="text-[10px] text-gray-500">{ast.asset_status}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(ast)}
                          className="p-1 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                          title="Edit Aset"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => promptDelete(ast)}
                          className="p-1 rounded-md hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Hapus Aset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    Belum ada data aset yang cocok dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit Asset */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-200">
              {editingAsset ? 'Edit Data Inventaris Aset' : 'Tambah Unit Aset Baru'}
            </h3>

            {formError && (
              <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
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
                    disabled={Boolean(editingAsset)}
                    title={editingAsset ? "Sekolah asal aset tidak dapat diganti saat edit." : undefined}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    {accessibleSchools.map(s => (
                      <option key={s.school_id} value={s.school_id}>{s.school_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Kode Barang</label>
                  <input
                    type="text"
                    value={formData.asset_code}
                    onChange={(e) => setFormData({ ...formData, asset_code: e.target.value })}
                    placeholder="Contoh: INV/IT/001"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Barang / Aset *</label>
                  <input
                    type="text"
                    value={formData.asset_name}
                    onChange={(e) => setFormData({ ...formData, asset_name: e.target.value })}
                    placeholder="Contoh: Laptop Acer Chromebook 311"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Kategori Aset *</label>
                  <select
                    value={formData.asset_category}
                    onChange={(e) => setFormData({ ...formData, asset_category: e.target.value as AssetCategory })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    <option value="Furniture">Furniture</option>
                    <option value="Perangkat IT">Perangkat IT</option>
                    <option value="Buku & Perpustakaan">Buku & Perpustakaan</option>
                    <option value="Alat Permainan Edukatif">Alat Permainan Edukatif</option>
                    <option value="Laboratorium">Laboratorium</option>
                    <option value="Peralatan Pembelajaran">Peralatan Pembelajaran</option>
                    <option value="Peralatan Kantor">Peralatan Kantor</option>
                    <option value="Peralatan Olahraga">Peralatan Olahraga</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Merk / Spesifikasi Singkat</label>
                  <input
                    type="text"
                    value={formData.asset_brand_spec}
                    onChange={(e) => setFormData({ ...formData, asset_brand_spec: e.target.value })}
                    placeholder="RAM 4GB, Processor..."
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Jumlah Unit *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Satuan Ukuran *</label>
                  <input
                    type="text"
                    value={formData.unit_measure}
                    onChange={(e) => setFormData({ ...formData, unit_measure: e.target.value })}
                    placeholder="Unit / Set / Buah / Lembar"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Sumber Pendanaan *</label>
                  <select
                    value={formData.funding_source}
                    onChange={(e) => setFormData({ ...formData, funding_source: e.target.value as FundingSource })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    <option value="ARF">ARF (Abdul Rasyid Foundation)</option>
                    <option value="BOS">BOS (Bantuan Operasional Sekolah)</option>
                    <option value="BOP">BOP</option>
                    <option value="Donasi">Donasi / CSR</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tahun Pengadaan</label>
                  <input
                    type="number"
                    value={formData.funding_year}
                    onChange={(e) => setFormData({ ...formData, funding_year: Number(e.target.value) })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Harga Satuan Perolehan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.acquisition_unit_value}
                    onChange={(e) => setFormData({ ...formData, acquisition_unit_value: Number(e.target.value) })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Kondisi Fisik *</label>
                  <select
                    value={formData.asset_condition}
                    onChange={(e) => setFormData({ ...formData, asset_condition: e.target.value as AssetCondition })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    <option value="Baik">Baik</option>
                    <option value="Rusak Ringan">Rusak Ringan</option>
                    <option value="Rusak Berat">Rusak Berat</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Status Pemanfaatan</label>
                  <select
                    value={formData.asset_status}
                    onChange={(e) => setFormData({ ...formData, asset_status: e.target.value as AssetStatus })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  >
                    <option value="Digunakan">Digunakan</option>
                    <option value="Disimpan">Disimpan (Gudang)</option>
                    <option value="Dalam Perbaikan">Dalam Perbaikan</option>
                    <option value="Dihapus">Dihapus / Afkir</option>
                  </select>
                </div>
              </div>

              <PhotoUploadField
                label="Upload Gambar Aset"
                existingUrl={formData.image_url}
                file={assetImageFile}
                onFileChange={setAssetImageFile}
                onRemoveExisting={() => setFormData(prev => ({ ...prev, image_url: '', image_path: '' }))}
                disabled={submitting}
              />

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
                  {submitting ? 'Memproses...' : 'Simpan Aset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Asset Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Hapus Data Inventaris Aset"
        message="Apakah Anda yakin ingin menghapus data inventaris aset ini secara permanen dari sistem?"
        itemName={deleteModal.asset ? `${deleteModal.asset.asset_name} (Kode: ${deleteModal.asset.asset_code || '-'}, Kategori: ${deleteModal.asset.asset_category})` : undefined}
        confirmLabel="Hapus Aset"
        cancelLabel="Batal"
        loading={deleteModal.deleting}
        error={deleteModal.error}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, asset: null, deleting: false, error: null })}
      />
    </div>
  );
};
