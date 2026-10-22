import React, { useState } from 'react';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Building,
  School as SchoolIcon
} from 'lucide-react';
import { Region, School } from '../../types';
import { regionsService } from '../../services/regionsService';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

interface RegionManagementViewProps {
  regions: Region[];
  schools: School[];
  onRefresh: () => void;
}

export const RegionManagementView: React.FC<RegionManagementViewProps> = ({
  regions,
  schools,
  onRefresh
}) => {
  const { isSuperAdmin } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    region: Region | null;
    deleting: boolean;
    error: string | null;
  }>({ region: null, deleting: false, error: null });

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    code: '',
    description: '',
    status: 'active' as 'active' | 'inactive'
  });

  const openAddModal = () => {
    setEditingRegion(null);
    setFormData({
      id: `REG-${Date.now().toString().slice(-4)}`,
      name: '',
      code: '',
      description: '',
      status: 'active'
    });
    setModalOpen(true);
  };

  const openEditModal = (reg: Region) => {
    setEditingRegion(reg);
    setFormData({
      id: reg.id,
      name: reg.name,
      code: reg.code,
      description: reg.description || '',
      status: reg.status
    });
    setModalOpen(true);
  };

  const promptDelete = (region: Region) => {
    if (!isSuperAdmin) return;
    setDeleteModal({ region, deleting: false, error: null });
  };

  const confirmDelete = async () => {
    if (!isSuperAdmin || !deleteModal.region || deleteModal.deleting) return;
    setDeleteModal(prev => ({ ...prev, deleting: true, error: null }));
    try {
      await regionsService.deleteRegion(deleteModal.region.id);
      setDeleteModal({ region: null, deleting: false, error: null });
      onRefresh();
    } catch (err: any) {
      setDeleteModal(prev => ({ ...prev, deleting: false, error: err.message || 'Gagal menghapus wilayah.' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) {
      alert('Nama Wilayah dan Kode wajib diisi!');
      return;
    }

    setSubmitting(true);
    try {
      await regionsService.saveRegion({
        ...formData,
        createdAt: editingRegion ? editingRegion.createdAt : new Date().toISOString()
      });
      setModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan wilayah');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-white p-6 rounded-2xl border border-gray-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#073b2d] font-bold text-xs mb-2">
            <MapPin className="w-3.5 h-3.5" />
            <span>Manajemen Wilayah Dinamis ARF</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">
            Wilayah Operasional Yayasan Abdul Rasyid
          </h2>
          <p className="text-xs text-[#5f5d5d] mt-1">
            Pengelolaan regional terbuka dan fleksibel untuk penambahan cabang yayasan baru di seluruh Indonesia.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-sm hover:bg-[#0a4f3d] transition-colors cursor-pointer shrink-0"
            style={{ backgroundColor: '#073b2d' }}
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Wilayah Baru</span>
          </button>
        )}
      </div>

      {/* Regions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {regions.map(reg => {
          const regSchools = schools.filter(s => s.regional_id === reg.id);

          return (
            <div key={reg.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-[#073b2d] border border-emerald-100">
                    {reg.code}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    reg.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {reg.status === 'active' ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>

                <h3 className="font-bold text-gray-900 text-base mt-3">{reg.name}</h3>
                <p className="text-xs text-[#5f5d5d] mt-1 leading-relaxed">
                  {reg.description || 'Tidak ada keterangan wilayah.'}
                </p>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-[#5f5d5d]">Sekolah Terdaftar:</span>
                  <strong className="text-gray-900">{regSchools.length} Unit Sekolah</strong>
                </div>
              </div>

              {isSuperAdmin && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => openEditModal(reg)}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 text-xs flex items-center gap-1 font-semibold"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => promptDelete(reg)}
                    className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hapus wilayah: dialog internal, tidak tergantung browser confirm() */}
      <ConfirmModal
        isOpen={!!deleteModal.region}
        title="Hapus Wilayah Operasional"
        message={deleteModal.region && schools.some(s => s.regional_id === deleteModal.region?.id)
          ? 'Wilayah tidak dapat dihapus selama masih digunakan oleh sekolah. Pindahkan seluruh sekolah ke wilayah lain terlebih dahulu.'
          : 'Wilayah yang dihapus tidak dapat dikembalikan. Pastikan wilayah ini tidak memiliki sekolah terdaftar.'}
        itemName={deleteModal.region ? `${deleteModal.region.name} (${deleteModal.region.code})` : undefined}
        confirmLabel="Hapus Wilayah"
        confirmDisabled={!!deleteModal.region && schools.some(s => s.regional_id === deleteModal.region?.id)}
        loading={deleteModal.deleting}
        error={deleteModal.error}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ region: null, deleting: false, error: null })}
      />

      {/* Modal Add / Edit Region */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-200">
              {editingRegion ? 'Edit Data Wilayah' : 'Tambah Wilayah Operasional Baru'}
            </h3>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Kode Wilayah *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="Contoh: KTG, KB, JB"
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Wilayah / Regional *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Regional Kalimantan Tengah"
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Keterangan / Cakupan</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Kabupaten/Kota yang dicakup..."
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Status Wilayah</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300"
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
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
                  {submitting ? 'Menyimpan...' : 'Simpan Wilayah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
