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
import {
  ARF_ASSET_CATEGORIES, ARF_FUNDING_CODES, ARF_LIFECYCLE_STATUSES,
  categoryLabel, fundingLabel, validateDraftAssetInput, parseAssetDocumentUrls
} from '../../lib/arfAssetCoding';
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
  const [showArchived, setShowArchived] = useState(false);

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
    origin_school_id: schools[0]?.school_id || '',
    current_school_id: schools[0]?.school_id || '',
    permanent_asset_id: '',
    display_inventory_code: '',
    category_code: 'ELK',
    funding_code: '',
    funding_details: '',
    acquisition_year: 0,
    acquisition_year_unknown: false,
    registration_type: 'INDIVIDUAL' as 'INDIVIDUAL'|'BUNDLE',
    registration_status: 'DRAFT' as 'DRAFT'|'VERIFIED'|'APPROVED',
    bundle_components: '',
    asset_brand: '',
    asset_model: '',
    serial_number: '',
    ownership_status: '',
    ownership_evidence: '',
    external_asset_code: '',
    room_id: '',
    custodian_id: '',
    lifecycle_status: 'ACTIVE',
    invoice_ref: '',
    handover_ref: '',
    document_urls_text: '',

    school_id: schools[0]?.school_id || '',
    asset_code: '',
    asset_name: '',
    asset_category: 'Elektronik & TIK' as AssetCategory,
    asset_brand_spec: '',
    asset_serial_number: '',
    quantity: 1,
    unit_measure: 'Unit',
    acquisition_date: '',
    funding_source: '' as FundingSource,
    funding_year: 0,
    acquisition_unit_value: 0,
    asset_condition: 'Baik' as AssetCondition,
    asset_status: 'Digunakan' as AssetStatus,
    image_url: '',
    image_path: ''
  });

  const accessibleSchools = schools.filter(s => hasSchoolAccess(s.school_id));

  const filteredAssets = assets.filter(a => {
    if(!showArchived && a.archived_at) return false;
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
        (a.permanent_asset_id || '').toLowerCase().includes(q) ||
        (a.display_inventory_code || '').toLowerCase().includes(q) ||
        (a.serial_number || '').toLowerCase().includes(q) ||
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
      asset_id: `AST-${crypto.randomUUID()}`, // draft record ID, NOT a permanent PAID
      origin_school_id: selectedSchoolId !== 'ALL' ? selectedSchoolId : (accessibleSchools[0]?.school_id || ''),
      current_school_id: selectedSchoolId !== 'ALL' ? selectedSchoolId : (accessibleSchools[0]?.school_id || ''),
      permanent_asset_id: '',
      display_inventory_code: '',
      category_code: 'ELK',
      funding_code: '',
      funding_details: '',
      acquisition_year: 0,
      acquisition_year_unknown: false,
      registration_type: 'INDIVIDUAL',
      registration_status: 'DRAFT',
      bundle_components: '',
      asset_brand: '',
      asset_model: '',
      serial_number: '',
      ownership_status: '',
      ownership_evidence: '',
      external_asset_code: '',
      room_id: '',
      custodian_id: '',
      lifecycle_status: 'ACTIVE',
      invoice_ref: '',
      handover_ref: '',
      document_urls_text: '',

      school_id: selectedSchoolId !== 'ALL' ? selectedSchoolId : (accessibleSchools[0]?.school_id || ''),
      asset_code: '',
      asset_name: '',
      asset_category: 'Elektronik & TIK',
      asset_brand_spec: '',
      asset_serial_number: '',
      quantity: 1,
      unit_measure: 'Unit',
      acquisition_date: '',
      funding_source: '' as FundingSource,
      funding_year: 0,
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
      origin_school_id: ast.origin_school_id || ast.school_id,
      current_school_id: ast.current_school_id || ast.school_id,
      permanent_asset_id: ast.permanent_asset_id || '',
      display_inventory_code: ast.display_inventory_code || '',
      category_code: ast.category_code || ARF_ASSET_CATEGORIES.find(c=>c.label===ast.asset_category)?.code || '',
      funding_code: ast.funding_code || (ARF_FUNDING_CODES.some(x=>x.code===ast.funding_source)?ast.funding_source:''),
      funding_details: ast.funding_details || '',
      acquisition_year: ast.acquisition_year || (ast.acquisition_date?Number(ast.acquisition_date.slice(0,4)):0),
      acquisition_year_unknown: Boolean(ast.acquisition_year_unknown),
      registration_type: ast.registration_type || (ast.quantity>1?'BUNDLE':'INDIVIDUAL'),
      registration_status: ast.registration_status || 'DRAFT',
      bundle_components: ast.bundle_components || '',
      asset_brand: ast.asset_brand || '',
      asset_model: ast.asset_model || '',
      serial_number: ast.serial_number || ast.asset_serial_number || '',
      ownership_status: ast.ownership_status || '',
      ownership_evidence: ast.ownership_evidence || '',
      external_asset_code: ast.external_asset_code || '',
      room_id: ast.room_id || ast.asset_location_id || '',
      custodian_id: ast.custodian_id || '',
      lifecycle_status: ast.lifecycle_status || 'ACTIVE',
      invoice_ref: ast.invoice_ref || '',
      handover_ref: ast.handover_ref || '',
      document_urls_text: (ast.document_urls || []).join('\n'),
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
      funding_year: ast.funding_year || 0,
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
    if (editingAsset?.registration_status === 'APPROVED') {
      setFormError('Aset yang disahkan tidak boleh dikoreksi melalui form biasa. Diperlukan prosedur koreksi berotorisasi.');
      return;
    }
    let document_urls: string[];
    try { document_urls = parseAssetDocumentUrls(formData.document_urls_text); }
    catch (error) { setFormError(error instanceof Error?error.message:'Tautan dokumen tidak valid.'); return; }
    const validation = validateDraftAssetInput({
      ...formData, document_urls,
      acquisition_year: formData.acquisition_year_unknown ? null : Number(formData.acquisition_year),
      serial_number: formData.serial_number
    },assets);
    if (validation) {setFormError(validation); return;}
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
      const {document_urls_text: _documentText, ...draftFields} = formData;
      await withTimeout(assetsService.saveAsset({
        ...draftFields,
        origin_school_id: editingAsset?.origin_school_id || formData.school_id,
        current_school_id: editingAsset?.current_school_id || formData.school_id,
        asset_category: categoryLabel(formData.category_code) as AssetCategory,
        funding_source: formData.funding_code as FundingSource,
        funding_details: formData.funding_details.trim(),
        document_urls,
        acquisition_year: formData.acquisition_year_unknown?null:Number(formData.acquisition_year),
        funding_year: formData.acquisition_year_unknown?0:Number(formData.acquisition_year),
        asset_serial_number: formData.serial_number,
        asset_location_id: formData.room_id,
        image_url,
        image_path,
        quantity: Number(formData.quantity) || 1,
        acquisition_unit_value: Number(formData.acquisition_unit_value) || 0,
        funding_year: formData.acquisition_year_unknown?0:Number(formData.acquisition_year),
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
        'ID Record': a.asset_id,
        'Permanent Asset ID': a.permanent_asset_id || 'Belum terbit',
        'Display Inventory Code': a.display_inventory_code || 'Belum terbit',
        'Status Registrasi': a.registration_status || 'Legacy',
        'School ID Asal': a.origin_school_id || a.school_id,
        'School ID Saat Ini': a.current_school_id || a.school_id,
        'Kategori Kode': a.category_code || '-',
        'Kode Sumber Dana': a.funding_code || '-',
        'Nomor Seri': a.serial_number || a.asset_serial_number || '-',
        'Nomor Bukti Perolehan': a.invoice_ref || '-',
        'Nomor Berita Acara': a.handover_ref || '-',
        'Status Kepemilikan Legal': a.ownership_status || '-',
        'Arsip': a.archived_at || '-',
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
                {ARF_ASSET_CATEGORIES.map(item=><option key={item.code} value={item.label}>{item.code} — {item.label}</option>)}
                {['Furniture','Perangkat IT','Buku & Perpustakaan','Alat Permainan Edukatif',
                  'Laboratorium','Peralatan Pembelajaran','Peralatan Kantor','Peralatan Olahraga','Lainnya'].map(label=>
                  <option key={label} value={label}>{label} (legacy)</option>)}
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
                {ARF_FUNDING_CODES.map(item=><option key={item.code} value={item.code}>{item.code} — {item.label}</option>)}
                {['BOS','BOP','Donasi','Lainnya'].map(label=><option key={label} value={label}>{label} (legacy)</option>)}
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

          <div className="flex items-center gap-2 self-end flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/>
              Tampilkan arsip draft
            </label>
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
                      <div className="text-[11px] text-gray-400 font-mono">{ast.display_inventory_code || ast.asset_code || ast.asset_id}</div>
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
                        {ast.archived_at ? (
                          <button type="button" className="p-1 text-emerald-700 hover:bg-emerald-50 rounded-md"
                            title="Pulihkan draft dari arsip"
                            onClick={async()=>{
                              try {await assetsService.restoreArchivedDraft(ast.school_id,ast.asset_id);onRefresh();}
                              catch(error){alert(error instanceof Error?error.message:'Gagal memulihkan draft.');}
                            }}>
                            <Archive className="w-3.5 h-3.5"/>
                          </button>
                        ) : <button
                          type="button"
                          onClick={() => promptDelete(ast)}
                          disabled={ast.registration_status === 'APPROVED'}
                          className="p-1 rounded-md hover:bg-amber-50 text-gray-400 hover:text-amber-700 disabled:opacity-30"
                          title={ast.registration_status==='APPROVED'?'Aset disahkan membutuhkan prosedur penghapusan berjenjang':'Arsipkan Draft (tidak menghapus riwayat)'}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>}
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
              {editingAsset ? 'Edit Data Inventaris Aset' : 'Tambah Unit Aset Baru'} — Register ARF
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
                    onChange={(e) => setFormData({
                      ...formData, school_id: e.target.value,
                      origin_school_id: e.target.value, current_school_id: e.target.value
                    })}
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

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Permanent Asset ID (PAID)</label>
                  <input readOnly value={formData.permanent_asset_id || 'Belum diterbitkan (DRAFT)'}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 bg-gray-50 font-mono"/>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Display Inventory Code (DIC)</label>
                  <input readOnly value={formData.display_inventory_code || formData.asset_code || 'Belum diterbitkan (menunggu verifikasi & persetujuan)'}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 bg-gray-50 font-mono"/>
                  <p className="mt-1 text-[11px] text-gray-600">
                    Format usulan: ARF/SCHOOL_ID/CATEGORY/FUNDING/YEAR/SEQUENCE.
                    Kode awal dan PAID hanya boleh diterbitkan otomatis dalam transaksi atomik setelah approval ARF.
                    {formData.asset_code&&!formData.display_inventory_code&&' Kode lama ditampilkan sebagai referensi historis, bukan DIC yang disahkan.'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Status Registrasi</label>
                  <input readOnly value={formData.registration_status}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 bg-gray-50 font-semibold"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">School ID Asal / Registrasi</label>
                  <input readOnly value={formData.origin_school_id || formData.school_id}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 bg-gray-50 font-mono"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">School ID Saat Ini</label>
                  <input readOnly value={formData.current_school_id || formData.school_id}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 bg-gray-50 font-mono"/>
                  <p className="mt-1 text-[11px] text-gray-500">Mutasi antar-sekolah harus melalui alur persetujuan terpisah.</p>
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
                    value={formData.category_code}
                    onChange={(e) => {
                      const code=e.target.value;
                      setFormData({ ...formData, category_code:code, asset_category: categoryLabel(code) as AssetCategory });
                    }}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    {formData.category_code==='' && <option value="">— Pilih kategori ARF —</option>}
                    {ARF_ASSET_CATEGORIES.map(item=><option key={item.code} value={item.code}>{item.code} — {item.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Merek Barang</label>
                  <input type="text" value={formData.asset_brand}
                    onChange={e=>setFormData({...formData,asset_brand:e.target.value})}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300" placeholder="Acer, Lenovo, Yamaha ..."/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Model / Tipe Barang</label>
                  <input type="text" value={formData.asset_model}
                    onChange={e=>setFormData({...formData,asset_model:e.target.value})}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300" placeholder="Chromebook 311, dsb."/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Serial Number / Nomor Seri</label>
                  <input type="text" value={formData.serial_number}
                    onChange={e=>setFormData({...formData,serial_number:e.target.value})}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    placeholder="Nomor seri jika tersedia"/>
                  <p className="mt-1 text-[11px] text-gray-500">Diperiksa terhadap nomor seri aset lain di sekolah yang sama.</p>
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Jenis Registrasi</label>
                  <select value={formData.registration_type} onChange={e=>setFormData({...formData,
                    registration_type:e.target.value as 'INDIVIDUAL'|'BUNDLE',quantity:1})}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300">
                    <option value="INDIVIDUAL">Aset individual (1 unit)</option>
                    <option value="BUNDLE">Bundel tidak terpisahkan (1 aset induk)</option>
                  </select>
                  <p className="text-[11px] text-gray-500 mt-1">10 laptop berarti 10 aset terpisah, bukan 1 aset berjumlah 10.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Jumlah Unit *</label>
                  <input type="number" min="1" max="1" readOnly value={formData.quantity}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 bg-gray-50" required/>
                </div>
                {formData.registration_type==='BUNDLE' && <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Rincian Komponen Bundel *</label>
                  <textarea rows={2} value={formData.bundle_components}
                    onChange={e=>setFormData({...formData,bundle_components:e.target.value})}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    placeholder="Contoh: Mesin utama + adaptor + unit kontrol; tidak dapat dipisahkan secara fungsional"/>
                </div>}

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
                    value={formData.funding_code}
                    onChange={(e) => setFormData({ ...formData, funding_code: e.target.value, funding_source: e.target.value as FundingSource })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  >
                    <option value="">— Pilih sumber dana berdasarkan bukti —</option>
                    {ARF_FUNDING_CODES.map(item=><option key={item.code} value={item.code}>{item.code} — {item.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal Perolehan Faktual</label>
                  <input type="date" value={formData.acquisition_date}
                    disabled={formData.acquisition_year_unknown}
                    onChange={(e) => setFormData({ ...formData,
                      acquisition_date:e.target.value,
                      acquisition_year:e.target.value?Number(e.target.value.slice(0,4)):0 })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 disabled:bg-gray-100"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tahun Perolehan</label>
                  <input readOnly value={formData.acquisition_year_unknown?'Tidak Diketahui':(formData.acquisition_year||'—')}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 bg-gray-50"/>
                  <label className="mt-1.5 flex items-start gap-2 text-xs text-gray-700">
                    <input type="checkbox" checked={formData.acquisition_year_unknown}
                      onChange={e=>setFormData({...formData,acquisition_year_unknown:e.target.checked,
                        acquisition_date:e.target.checked?'':formData.acquisition_date, acquisition_year:e.target.checked?0:formData.acquisition_year})}/>
                    Aset lama: tahun perolehan tidak diketahui
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Rincian Sumber Dana / Dasar Perolehan</label>
                  <textarea rows={2} value={formData.funding_details}
                    onChange={e=>setFormData({...formData,funding_details:e.target.value})}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    placeholder="Program/kegiatan, tahun anggaran, pemberi bantuan, nomor persetujuan, atau alasan kode LGC."/>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Kode sumber dana harus didukung bukti perolehan. LGC hanya untuk sensus/migrasi aset lama.
                    Pendanaan gabungan tidak disediakan pada form ini karena panduan memuat larangan penggunaannya.
                  </p>
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

              <div className="rounded-xl border border-gray-200 p-3 sm:p-4 space-y-3">
                <h4 className="text-sm font-bold text-[#073b2d]">Penempatan, Penguasaan &amp; Dokumen</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">ID Ruang / Lokasi Aset</label>
                    <input type="text" value={formData.room_id} onChange={e=>setFormData({...formData,room_id:e.target.value})}
                      placeholder="Kode ruang penyimpanan" className="w-full rounded-lg border border-gray-300 p-2 text-xs"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">ID Penanggung Jawab (Custodian)</label>
                    <input type="text" value={formData.custodian_id} onChange={e=>setFormData({...formData,custodian_id:e.target.value})}
                      placeholder="ID petugas yang menjaga/memakai" className="w-full rounded-lg border border-gray-300 p-2 text-xs"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Status Penguasaan / Kepemilikan Legal</label>
                    <input type="text" value={formData.ownership_status} onChange={e=>setFormData({...formData,ownership_status:e.target.value})}
                      placeholder="Dasar hukum: ARF / Pemerintah / Donatur / Belum terverifikasi"
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Bukti Kepemilikan Legal</label>
                    <input type="text" value={formData.ownership_evidence} onChange={e=>setFormData({...formData,ownership_evidence:e.target.value})}
                      placeholder="Nomor dokumen / dasar hak" className="w-full rounded-lg border border-gray-300 p-2 text-xs"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Kode Aset Eksternal</label>
                    <input type="text" value={formData.external_asset_code} onChange={e=>setFormData({...formData,external_asset_code:e.target.value})}
                      placeholder="Kode pemerintah / donor, jika ada" className="w-full rounded-lg border border-gray-300 p-2 text-xs"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Status Siklus Hidup</label>
                    <select value={formData.lifecycle_status} onChange={e=>setFormData({...formData,lifecycle_status:e.target.value})}
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs">
                      {ARF_LIFECYCLE_STATUSES.filter(item=>
                        ['ACTIVE','STORED','MAINTENANCE'].includes(item.code) || item.code===formData.lifecycle_status
                      ).map(item=><option key={item.code} value={item.code}
                        disabled={!['ACTIVE','STORED','MAINTENANCE'].includes(item.code)}>
                        {item.code} — {item.label}
                      </option>)}
                    </select>
                    <p className="mt-1 text-[11px] text-gray-500">Penghapusan legal, mutasi, dan koreksi memerlukan persetujuan di luar form DRAFT.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Referensi Invoice/Kuitansi/Kontrak</label>
                    <input type="text" value={formData.invoice_ref} onChange={e=>setFormData({...formData,invoice_ref:e.target.value})}
                      placeholder="Nomor bukti pengadaan" className="w-full rounded-lg border border-gray-300 p-2 text-xs"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Referensi Berita Acara / Serah Terima</label>
                    <input type="text" value={formData.handover_ref} onChange={e=>setFormData({...formData,handover_ref:e.target.value})}
                      placeholder="Nomor BA serah terima" className="w-full rounded-lg border border-gray-300 p-2 text-xs"/>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tautan Bukti Dokumen (HTTPS, satu URL per baris)</label>
                    <textarea rows={3} value={formData.document_urls_text}
                      onChange={e=>setFormData({...formData,document_urls_text:e.target.value})}
                      placeholder="https://.../invoice&#10;https://.../berita-acara"
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs"/>
                    <p className="text-[11px] text-gray-500 mt-1">Referensi dokumen saja; tautan harus diberikan izin akses sesuai peran. Form ini belum mengunggah PDF ke Storage.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Panduan ARF-STD-AST-001 masih berstatus DRAF. Form ini menyimpan DRAFT dan tidak menerbitkan nomor inventaris resmi.
                Foto tersimpan di Supabase Storage; referensi bukti perolehan dicatat di bawah ini.
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
        title="Arsipkan Draft Inventaris Aset"
        message="Arsipkan draft ini tanpa menghapus catatan, bukti, atau foto? Identitas dan jejak audit tetap tersimpan. Aset yang sudah disahkan memerlukan persetujuan penghapusan terpisah."
        itemName={deleteModal.asset ? `${deleteModal.asset.asset_name} (Kode: ${deleteModal.asset.asset_code || '-'}, Kategori: ${deleteModal.asset.asset_category})` : undefined}
        confirmLabel="Arsipkan Draft"
        cancelLabel="Batal"
        loading={deleteModal.deleting}
        error={deleteModal.error}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, asset: null, deleting: false, error: null })}
      />
    </div>
  );
};
