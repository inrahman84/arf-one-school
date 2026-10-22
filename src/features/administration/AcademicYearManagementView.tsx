import React, { useState } from 'react';
import { AlertCircle, BookOpen, Plus, RefreshCw, Trash2, CheckCircle2, Power } from 'lucide-react';
import { ClassroomEnrollment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useAcademicYears } from '../../hooks/useAcademicYears';
import { academicYearsService, normalizeAcademicYear, sortedAcademicYears } from '../../services/academicYearsService';

interface Props { classes: ClassroomEnrollment[]; }

export const AcademicYearManagementView: React.FC<Props> = ({ classes }) => {
  const { isSuperAdmin } = useAuth();
  const {
    savedAcademicYears, setSavedAcademicYears, activeAcademicYear, setActiveAcademicYear, masterConnected, masterWarning, masterLoading,
    reloadAcademicYears
  } = useAcademicYears();
  const [yearStart, setYearStart] = useState('2027');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteYear, setDeleteYear] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const yearOptions = sortedAcademicYears([...savedAcademicYears, ...classes.map(c => c.academic_year)]);
  const formYear = /^\d{4}$/.test(yearStart) ? normalizeAcademicYear(`${yearStart}/${Number(yearStart) + 1}`) : null;
  if (!isSuperAdmin) {
    return <div className="rounded-xl bg-white border border-gray-200 p-6 text-sm text-gray-600">Pengelolaan master tahun ajaran hanya tersedia bagi Super Admin.</div>;
  }

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    if (!formYear) { setFormError('Gunakan tahun awal empat digit 2000–2099.'); return; }
    if (savedAcademicYears.includes(formYear)) { setFormError(`Tahun ${formYear} sudah ada di master.`); return; }
    setSaving(true);
    try {
      const label = await academicYearsService.addAcademicYear(formYear);
      setSavedAcademicYears(prev => sortedAcademicYears([...prev, label]));
      setNotice(`Tahun ajaran ${label} berhasil ditambahkan.`);
      setYearStart(String(Math.min(Number(yearStart) + 1, 2099)));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Gagal menambah Tahun Ajaran.');
    } finally { setSaving(false); }
  };

  const activate = async (year:string) => {
    if(!masterConnected || !savedAcademicYears.includes(year) || activating)return;
    setFormError(null);setNotice(null);setActivating(year);
    try {
      const updated=await academicYearsService.activateAcademicYear(year);
      setActiveAcademicYear(updated);
      setNotice(`Tahun Ajaran ${updated} sekarang AKTIF dan digunakan sebagai periode default pengisian rombel.`);
    }catch(error){
      setFormError(error instanceof Error?error.message:'Gagal mengaktifkan tahun ajaran.');
    }finally{setActivating(null);}
  };

  const remove = async () => {
    if (!deleteYear) return;
    setDeleting(true);
    setDeleteError(null);
    setNotice(null);
    try {
      await academicYearsService.deleteAcademicYear(deleteYear);
      setSavedAcademicYears(prev => prev.filter(year => year !== deleteYear));
      setNotice(`Master ${deleteYear} telah dihapus; data rombel tidak berubah.`);
      setDeleteYear(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Gagal menghapus Tahun Ajaran.');
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-[#073b2d]"><BookOpen className="h-5 w-5" /> Master Tahun Ajaran</h2>
            <p className="mt-1 text-xs text-[#5f5d5d]">Berlaku untuk seluruh sekolah ARF. Hanya Super Admin yang dapat menambah, mengaktifkan, dan menghapus master.</p>
          </div>
          <button type="button" disabled={masterLoading} onClick={() => void reloadAcademicYears()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${masterLoading ? 'animate-spin' : ''}`} /> Muat Ulang
          </button>
        </div>
        {!masterConnected && (
          <div role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="flex gap-2"><AlertCircle className="h-4 w-4 shrink-0" /><span><strong>Sinkronisasi Master Tahun Ajaran belum tersedia.</strong> Data di bawah hanya berasal dari cache atau riwayat rombel. {masterWarning} ZIP aplikasi tidak menerapkan aturan Supabase secara otomatis.</span></div>
          </div>
        )}
        <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-900">
          <strong>Tahun Ajaran Aktif:</strong> {activeAcademicYear || 'Belum ditentukan'}
          <span className="ml-2 text-emerald-800">— Menentukan periode default untuk tambah data rombel dan laporan.</span>
        </div>
        {notice && <div role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">{notice}</div>}
        <form onSubmit={add} className="mt-5 grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,180px)_auto]">
          <div>
            <label htmlFor="admin-year-start" className="mb-1 block text-xs font-semibold text-[#5f5d5d]">Tahun Awal</label>
            <input id="admin-year-start" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={yearStart} onChange={e => setYearStart(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs" required placeholder="2027" />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-[#5f5d5d]">Tahun Ajaran</div>
            <div className="flex h-10 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-700">{formYear || '—'}</div>
          </div>
          <button type="submit" disabled={!masterConnected || masterLoading || saving || !formYear} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#073b2d] px-4 text-xs font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />{saving ? 'Menyimpan...' : 'Tambah Tahun Ajaran'}</button>
        </form>
        {formError && <p role="alert" className="mt-3 text-xs text-rose-700">{formError}</p>}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4"><h3 className="text-sm font-bold text-gray-900">Daftar Tahun Ajaran</h3><p className="mt-1 text-xs text-gray-500">Tahun ajaran yang digunakan rombel tetap tampil sebagai riwayat meskipun belum dimasukkan ke master.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600"><tr><th className="px-5 py-3">Tahun Ajaran</th><th className="px-5 py-3">Sumber</th><th className="px-5 py-3 text-center">Rombel Terkait</th><th className="px-5 py-3 text-right">Tindakan</th></tr></thead>
            <tbody>
              {yearOptions.map(year => {
                const count = classes.filter(c => normalizeAcademicYear(String(c.academic_year).replace(/-/g, '/')) === year).length;
                const saved = savedAcademicYears.includes(year);
                return <tr key={year} className="border-t border-gray-100"><td className="px-5 py-3 font-bold">{year} {year===activeAcademicYear && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-800"><CheckCircle2 className="h-3 w-3" /> AKTIF</span>}</td><td className="px-5 py-3">{saved ? 'Master' : 'Riwayat rombel'}</td><td className="px-5 py-3 text-center">{count}</td><td className="px-5 py-3 text-right">
                  <button type="button" disabled={!masterConnected || !saved || year===activeAcademicYear || Boolean(activating)} onClick={()=>void activate(year)}
                    title={year===activeAcademicYear?'Tahun ajaran ini sedang aktif':'Aktifkan untuk pengisian data'}
                    className="mr-2 inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-35">
                    <Power className="h-3.5 w-3.5" /> {year===activeAcademicYear?'Aktif':activating===year?'Mengaktifkan...':'Aktifkan'}
                  </button>
                  <button type="button" disabled={!masterConnected || !saved || count > 0 || year===activeAcademicYear} title={!saved ? 'Belum tercatat sebagai master' : year===activeAcademicYear ? 'Nonaktifkan dengan mengaktifkan tahun lain terlebih dahulu' : count > 0 ? 'Tahun ajaran masih digunakan rombel' : 'Hapus dari master'} onClick={() => { setDeleteYear(year); setDeleteError(null); }} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-3.5 w-3.5" /> Hapus</button>
                </td></tr>;
              })}
              {!yearOptions.length && <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-500">Belum ada data tahun ajaran. Tambahkan master di atas.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-500">Penghapusan hanya untuk entri master yang tidak digunakan oleh rombel. Pemeriksaan keterkaitan dilakukan ulang di Supabase sebelum menghapus.</p>
      <ConfirmModal isOpen={Boolean(deleteYear)} title="Hapus Master Tahun Ajaran" message="Menghapus master tahun ajaran ini akan menghilangkannya dari pilihan filter jika tidak ada riwayat rombel. Data rombel dan peserta didik tidak akan dihapus." itemName={deleteYear || undefined} confirmLabel="Hapus Tahun Ajaran" loading={deleting} error={deleteError} onCancel={() => { setDeleteYear(null); setDeleteError(null); }} onConfirm={() => void remove()} />
    </div>
  );
};
