import React, { useEffect, useState } from 'react';
import {
  Plus,
  Users,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Settings2,
  RefreshCw
} from 'lucide-react';
import { ClassroomEnrollment, School, Semester, StudentRecord, StudentMovement } from '../../types';
import { movementCounts } from '../../services/studentsService';
import { rosterCounts } from '../../lib/dapodikStudents';
import { currentRoster } from '../../lib/studentActivity';
import { enrollmentService } from '../../services/enrollmentService';
import { academicYearsService, normalizeAcademicYear, sortedAcademicYears } from '../../services/academicYearsService';
import { useAcademicYears } from '../../hooks/useAcademicYears';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

interface EnrollmentViewProps {
  schools: School[];
  classes: ClassroomEnrollment[];
  students: StudentRecord[];
  studentMovements: StudentMovement[];
  onRefresh: () => void;
  onManageAcademicYears: () => void;
  onManageStudents: (schoolId: string) => void;
}

export const EnrollmentView: React.FC<EnrollmentViewProps> = ({
  schools,
  classes,
  students,
  studentMovements,
  onRefresh,
  onManageAcademicYears,
  onManageStudents
}) => {
  const { hasSchoolAccess, isSuperAdmin } = useAuth();
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('ALL');
  const [academicYear, setAcademicYear] = useState('2026/2027');
  const {
    savedAcademicYears, setSavedAcademicYears, activeAcademicYear: masterActiveYear,
    masterConnected, masterLoading, masterWarning, reloadAcademicYears
  } = useAcademicYears();
  useEffect(() => { if(masterActiveYear) setAcademicYear(masterActiveYear); }, [masterActiveYear]);
  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [newAcademicYearStart, setNewAcademicYearStart] = useState('2027');
  const [yearSaving, setYearSaving] = useState(false);
  const [yearError, setYearError] = useState<string | null>(null);
  const [deleteYear, setDeleteYear] = useState<string | null>(null);
  const [yearDeleting, setYearDeleting] = useState(false);
  const [yearDeleteError, setYearDeleteError] = useState<string | null>(null);

  const [semester, setSemester] = useState<Semester>('Ganjil');
  const [searchQuery, setSearchQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassroomEnrollment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    cls: ClassroomEnrollment | null;
    deleting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    cls: null,
    deleting: false,
    error: null,
  });

  // Form State
  const [formData, setFormData] = useState({
    class_id: '',
    school_id: schools[0]?.school_id || '',
    academic_year: '2026/2027',
    semester: 'Ganjil' as Semester,
    grade_level: 'Kelas 1',
    class_name: '',
    class_capacity: 28,
    male_students: 14,
    female_students: 14,
    transfer_in: 0,
    transfer_out: 0,
    dropout_students: 0,
    homeroom_name: ''
  });

  const accessibleSchools = schools.filter(s => hasSchoolAccess(s.school_id));
  const calcCounts=(cls:ClassroomEnrollment)=>{
    const imported=students.filter(x=>x.school_id===cls.school_id&&x.academic_year===cls.academic_year&&x.semester===cls.semester);
    const roster=currentRoster(imported,studentMovements);
    // An empty effective roster after verified exits must not fall back to stale manual counts.
    const active=imported.length>0;
    const people=rosterCounts(roster,cls.class_id,cls.academic_year,cls.semester);
    const move=movementCounts(studentMovements,cls.class_id,cls.academic_year,cls.semester);
    return {male:active?people.male:cls.male_students,
      female:active?people.female:cls.female_students,
      incoming:active?move.transferIn:(cls.transfer_in||0),
      outgoing:active?move.transferOut:(cls.transfer_out||0),
      dropout:active?move.dropout:(cls.dropout_students||0),active};
  };
  const draftCounts=calcCounts(formData as ClassroomEnrollment);
  const yearClassRecords = classes.filter(c => hasSchoolAccess(c.school_id));
  const academicYearOptions = sortedAcademicYears([
    ...savedAcademicYears,
    ...yearClassRecords.map(c => c.academic_year),
    // Preview can still filter the existing default period if the master is temporarily offline.
    ...(!masterConnected && !savedAcademicYears.length && !yearClassRecords.length ? ['2026/2027'] : [])
  ]);
  const activeAcademicYear = academicYearOptions.includes(academicYear) ? academicYear : (academicYearOptions[0] || '');
  const linkedClassesCount = yearClassRecords.filter(c => normalizeAcademicYear(String(c.academic_year).replace(/-/g, '/')) === activeAcademicYear).length;
  const canDeleteSelectedYear = isSuperAdmin && masterConnected && !masterLoading &&
    savedAcademicYears.includes(activeAcademicYear) && activeAcademicYear !== masterActiveYear && linkedClassesCount === 0;

  const openYearModal = () => {
    if (!isSuperAdmin || !masterConnected) return;
    const latest = Math.max(...academicYearOptions.map(y => Number(y.split('/')[0])).filter(Number.isFinite), new Date().getFullYear());
    setNewAcademicYearStart(String(Math.min(latest + 1, 2099)));
    setYearError(null);
    setYearModalOpen(true);
  };

  const addAcademicYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin || !masterConnected) return;
    const start = Number(newAcademicYearStart.trim());
    const year = normalizeAcademicYear(`${newAcademicYearStart.trim()}/${start + 1}`);
    if (!year || !/^\d{4}$/.test(newAcademicYearStart.trim())) {
      setYearError('Masukkan tahun awal empat digit (2000–2099), misalnya 2027.');
      return;
    }
    if (savedAcademicYears.includes(year)) {
      setYearError(`Master tahun ajaran ${year} sudah tersedia.`);
      return;
    }
    setYearSaving(true);
    setYearError(null);
    try {
      const saved = await academicYearsService.addAcademicYear(year);
      setSavedAcademicYears(prev => sortedAcademicYears([...prev, saved]));
      setAcademicYear(saved);
      setYearModalOpen(false);
    } catch (err: any) {
      setYearError(err.message || 'Gagal menambahkan tahun ajaran ke Supabase.');
    } finally {
      setYearSaving(false);
    }
  };

  const confirmDeleteYear = async () => {
    if (!isSuperAdmin || !deleteYear || !masterConnected) return;
    setYearDeleting(true);
    setYearDeleteError(null);
    try {
      await academicYearsService.deleteAcademicYear(deleteYear);
      setSavedAcademicYears(prev => prev.filter(year => year !== deleteYear));
      if (academicYear === deleteYear) setAcademicYear('');
      setDeleteYear(null);
    } catch (err: any) {
      setYearDeleteError(err.message || 'Gagal menghapus Tahun Ajaran.');
    } finally {
      setYearDeleting(false);
    }
  };

  const filteredClasses = classes.filter(c => {
    if (!hasSchoolAccess(c.school_id)) return false;
    if (selectedSchoolId !== 'ALL' && c.school_id !== selectedSchoolId) return false;
    if (activeAcademicYear && c.academic_year !== activeAcademicYear) return false;
    if (semester && c.semester !== semester) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.class_name.toLowerCase().includes(q) || c.grade_level.toLowerCase().includes(q);
    }
    return true;
  });

  const openAddModal = () => {
    setEditingClass(null);
    setFormError(null);
    setFormData({
      class_id: `CLS-${Date.now().toString().slice(-6)}`,
      school_id: selectedSchoolId !== 'ALL' ? selectedSchoolId : (accessibleSchools[0]?.school_id || ''),
      academic_year: masterActiveYear || '',
      semester,
      grade_level: 'Kelas 1',
      class_name: '',
      class_capacity: 30,
      male_students: 0,
      female_students: 0,
      transfer_in: 0,
      transfer_out: 0,
      dropout_students: 0,
      homeroom_name: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (cls: ClassroomEnrollment) => {
    setEditingClass(cls);
    setFormError(null);
    setFormData({
      class_id: cls.class_id,
      school_id: cls.school_id,
      academic_year: cls.academic_year,
      semester: cls.semester,
      grade_level: cls.grade_level,
      class_name: cls.class_name,
      class_capacity: cls.class_capacity,
      male_students: cls.male_students,
      female_students: cls.female_students,
      transfer_in: cls.transfer_in || 0,
      transfer_out: cls.transfer_out || 0,
      dropout_students: cls.dropout_students || 0,
      homeroom_name: cls.homeroom_name || ''
    });
    setModalOpen(true);
  };

  const promptDelete = (cls: ClassroomEnrollment) => {
    setDeleteModal({
      isOpen: true,
      cls,
      deleting: false,
      error: null
    });
  };

  const confirmDelete = async () => {
    if (!deleteModal.cls) return;
    setDeleteModal(prev => ({ ...prev, deleting: true, error: null }));
    try {
      await enrollmentService.deleteClass(deleteModal.cls.school_id, deleteModal.cls.class_id);
      setDeleteModal({ isOpen: false, cls: null, deleting: false, error: null });
      onRefresh();
    } catch (err: any) {
      console.error('Gagal menghapus rombel:', err);
      setDeleteModal(prev => ({
        ...prev,
        deleting: false,
        error: err.message || 'Gagal menghapus rombel dari database.'
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.class_name || !formData.school_id || !formData.academic_year) {
      setFormError('Nama Rombel, Sekolah, dan Tahun Ajaran wajib diisi!');
      return;
    }

    if (!editingClass && (!masterConnected || !masterActiveYear || formData.academic_year !== masterActiveYear)) {
      setFormError('Aktifkan Tahun Ajaran pada Administrasi Sistem → Master Tahun Ajaran sebelum menambahkan rombel.');
      return;
    }
    setSubmitting(true);
    try {
      await enrollmentService.saveClass({
        ...formData,
        male_students: draftCounts.male,
        female_students: draftCounts.female,
        class_capacity: Number(formData.class_capacity) || 0,
        transfer_in: draftCounts.incoming,
        transfer_out: draftCounts.outgoing,
        dropout_students: draftCounts.dropout,
        created_at: editingClass ? editingClass.created_at : new Date().toISOString()
      });
      setModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data rombel');
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics
  // For schools with a Dapodik roster, count all individuals exactly once,
  // including students not yet mapped to a class. Other schools retain manual totals.
  const relevantStudents=students.filter(st=>hasSchoolAccess(st.school_id)&&
    (selectedSchoolId==='ALL'||st.school_id===selectedSchoolId)&&
    (!activeAcademicYear||st.academic_year===activeAcademicYear)&&st.semester===semester);
  const effectiveStudents=currentRoster(relevantStudents,studentMovements);
  const schoolsWithRoster=new Set(relevantStudents.map(st=>st.school_id));
  const totalStudents=effectiveStudents.length+filteredClasses
    .filter(c=>!schoolsWithRoster.has(c.school_id))
    .reduce((sum,c)=>sum+(Number(c.male_students)||0)+(Number(c.female_students)||0),0);
  const unmappedStudents=effectiveStudents.filter(st=>!st.class_id||
    !filteredClasses.some(c=>c.class_id===st.class_id)).length;
  const totalCapacity = filteredClasses.reduce((sum, c) => sum + (Number(c.class_capacity) || 0), 0);
  const overcapacityCount = filteredClasses.filter(c => {
    const total = calcCounts(c).male + calcCounts(c).female;
    return c.class_capacity > 0 && total > c.class_capacity;
  }).length;

  return (
    <div className="space-y-6">
      {unmappedStudents>0 && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        {unmappedStudents} peserta didik Dapodik belum dipetakan ke rombel yang sesuai pada filter ini.
        Total sekolah tetap menghitung mereka, tetapi angka rombel dan estimasi kebutuhan guru perlu diverifikasi.
      </div>}
      {!masterLoading && masterConnected && !masterActiveYear && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Belum ada Tahun Ajaran aktif untuk pengisian data baru. Super Admin perlu memilih <strong>Aktifkan</strong> pada menu Administrasi Sistem → Master Tahun Ajaran.
        </div>
      )}
      {/* Consistent, responsive filter grid. Every field shares the same label + 40px control height. */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1.2fr)] xl:items-end">
          <div className="min-w-0">
            <label htmlFor="enrollment-school" className="mb-1.5 block text-[11px] font-semibold text-[#5f5d5d]">Sekolah</label>
            <select id="enrollment-school" value={selectedSchoolId} onChange={e => setSelectedSchoolId(e.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-800">
              <option value="ALL">Semua Sekolah ({accessibleSchools.length})</option>
              {accessibleSchools.map(s => <option key={s.school_id} value={s.school_id}>{s.school_name}</option>)}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="enrollment-year" className="mb-1.5 block text-[11px] font-semibold text-[#5f5d5d]">Tahun Ajaran</label>
            <div className="flex min-w-0 items-center gap-1.5">
              <select id="enrollment-year" value={activeAcademicYear} onChange={e => setAcademicYear(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800">
                {!academicYearOptions.length && <option value="">Belum tersedia</option>}
                {academicYearOptions.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
              {isSuperAdmin && (
                <>
                  <button type="button" onClick={openYearModal} disabled={!masterConnected || masterLoading} title="Tambah Tahun Ajaran" aria-label="Tambah Tahun Ajaran" className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-[#073b2d] text-[#073b2d] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                  <button type="button" onClick={() => { setDeleteYear(activeAcademicYear); setYearDeleteError(null); }} disabled={!canDeleteSelectedYear} title={!masterConnected ? 'Sinkronisasi master belum tersedia' : linkedClassesCount ? 'Tidak dapat dihapus: tahun ajaran digunakan rombel' : !savedAcademicYears.includes(activeAcademicYear) ? 'Tahun belum tercatat sebagai master' : 'Hapus master Tahun Ajaran'} aria-label="Hapus Tahun Ajaran" className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-4 w-4" /></button>
                  <button type="button" onClick={onManageAcademicYears} title="Buka Administrasi Master Tahun Ajaran" aria-label="Buka Administrasi Master Tahun Ajaran" className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"><Settings2 className="h-4 w-4" /></button>
                </>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <label htmlFor="enrollment-semester" className="mb-1.5 block text-[11px] font-semibold text-[#5f5d5d]">Semester</label>
            <select id="enrollment-semester" value={semester} onChange={e => setSemester(e.target.value as Semester)} className="h-10 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-800">
              <option value="Ganjil">Semester Ganjil</option><option value="Genap">Semester Genap</option>
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="enrollment-search" className="mb-1.5 block text-[11px] font-semibold text-[#5f5d5d]">Cari Rombel</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input id="enrollment-search" type="search" placeholder="Cari rombel..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-xs" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <div className="min-w-0 flex-1 text-[11px] text-gray-500">
            {!masterConnected && (
              <span title={masterWarning || undefined} className="inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" /> Master belum tersinkron; filter menggunakan riwayat rombel.
                <button type="button" disabled={masterLoading} onClick={() => void reloadAcademicYears()} className="inline-flex items-center gap-1 font-semibold text-[#073b2d] underline disabled:opacity-40"><RefreshCw className="h-3 w-3" /> Coba lagi</button>
                {isSuperAdmin && <button type="button" onClick={onManageAcademicYears} className="font-semibold text-[#073b2d] underline">Pengaturan</button>}
              </span>
            )}
            {masterConnected && <span>Filter: {activeAcademicYear || 'Belum dipilih'} · {semester} · Tahun input aktif: <strong>{masterActiveYear || 'Belum ditetapkan'}</strong></span>}
          </div>
          <button type="button"
            onClick={()=>onManageStudents(selectedSchoolId==='ALL'?(accessibleSchools[0]?.school_id||''):selectedSchoolId)}
            disabled={!accessibleSchools.length}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#073b2d] px-4 text-xs font-semibold text-[#073b2d] disabled:opacity-50">
            <Users className="h-4 w-4" /> Kelola Data Peserta Didik
          </button>
          <button type="button" onClick={openAddModal} disabled={!accessibleSchools.length || !masterConnected || !masterActiveYear} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#073b2d] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#0a4f3d] disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="h-4 w-4" /> Tambah Rombel Baru
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-[#5f5d5d]">Total Siswa</span>
          <div className="text-2xl font-extrabold text-gray-900 mt-1">{totalStudents.toLocaleString()}</div>
          <span className="text-[11px] text-[#5f5d5d] mt-1 block">Peserta Didik Aktif</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-[#5f5d5d]">Total Rombongan Belajar</span>
          <div className="text-2xl font-extrabold text-gray-900 mt-1">{filteredClasses.length}</div>
          <span className="text-[11px] text-[#5f5d5d] mt-1 block">Kapasitas: {totalCapacity} Siswa</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-[#5f5d5d]">Rata-rata Siswa / Rombel</span>
          <div className="text-2xl font-extrabold text-gray-900 mt-1">
            {filteredClasses.length > 0 ? (totalStudents / filteredClasses.length).toFixed(1) : 0}
          </div>
          <span className="text-[11px] text-[#5f5d5d] mt-1 block">Siswa per Kelas</span>
        </div>

        <div className={`p-4 rounded-xl border shadow-xs ${
          overcapacityCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-gray-200'
        }`}>
          <span className="text-xs font-semibold text-[#5f5d5d]">Kelas Melebihi Kapasitas</span>
          <div className={`text-2xl font-extrabold mt-1 ${overcapacityCount > 0 ? 'text-rose-700' : 'text-gray-900'}`}>
            {overcapacityCount}
          </div>
          <span className={`text-[11px] font-semibold mt-1 block ${overcapacityCount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
            {overcapacityCount > 0 ? 'Peringatan Kapasitas' : 'Normal'}
          </span>
        </div>
      </div>

      {/* Editable Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">
            Daftar Rombongan Belajar &amp; Utilisasi Kapasitas
          </h3>
          <span className="text-xs text-[#5f5d5d]">
            Periode: <strong>{activeAcademicYear || "—"} ({semester})</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Sekolah &amp; Nama Rombel</th>
                <th className="py-3 px-4">Tingkat</th>
                <th className="py-3 px-4 text-center">L</th>
                <th className="py-3 px-4 text-center">P</th>
                <th className="py-3 px-4 text-center">Total Siswa</th>
                <th className="py-3 px-4 text-center">Kapasitas</th>
                <th className="py-3 px-4">Tingkat Okupansi</th>
                <th className="py-3 px-4 text-center">Status Kapasitas</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredClasses.map(cls => {
                const sch = schools.find(s => s.school_id === cls.school_id);
                const male = calcCounts(cls).male;
                const female = calcCounts(cls).female;
                const total = male + female;
                const cap = Number(cls.class_capacity) || 0;
                const isOver = cap > 0 && total > cap;
                const occupancyRate = cap > 0 ? Math.round((total / cap) * 100) : null;

                return (
                  <tr key={cls.class_id} className={`hover:bg-gray-50/80 transition-colors ${
                    isOver ? 'bg-rose-50/30' : ''
                  }`}>
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{cls.class_name}</div>
                      <div className="text-[11px] text-[#5f5d5d]">{sch?.school_name || cls.school_id}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-700">{cls.grade_level}</td>
                    <td className="py-3 px-4 text-center text-gray-700">{male}</td>
                    <td className="py-3 px-4 text-center text-gray-700">{female}</td>
                    <td className="py-3 px-4 text-center font-bold text-gray-900">{total}</td>
                    <td className="py-3 px-4 text-center font-medium text-gray-700">{cap || 'N/A'}</td>
                    <td className="py-3 px-4">
                      {occupancyRate !== null ? (
                        <div className="w-36">
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="font-semibold">{occupancyRate}%</span>
                            <span className="text-gray-400">{total}/{cap}</span>
                          </div>
                          <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${isOver ? 'bg-rose-600' : 'bg-[#073b2d]'}`}
                              style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isOver ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>Kelas Melebihi Kapasitas</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>Sesuai Kapasitas</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(cls)}
                          className="p-1 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                          title="Edit Rombel"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => promptDelete(cls)}
                          className="p-1 rounded-md hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Hapus Rombel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredClasses.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    Belum ada data rombel untuk filter terpilih. Klik 'Tambah Rombel Baru' atau gunakan fitur Import Excel.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog input master only for Super Admin. */}
      {isSuperAdmin && yearModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-200">Tambah Tahun Ajaran</h3>
            <p className="text-xs text-[#5f5d5d] mt-3">Masukkan tahun awal. Tahun akhir akan dibuat otomatis dan disimpan sebagai master data untuk seluruh sekolah.</p>
            <form onSubmit={addAcademicYear} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tahun Awal *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  required
                  value={newAcademicYearStart}
                  onChange={(e) => setNewAcademicYearStart(e.target.value)}
                  placeholder="2027"
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300"
                />
                <p className="text-xs text-[#5f5d5d] mt-2">Pratinjau: {/^\d{4}$/.test(newAcademicYearStart) && Number(newAcademicYearStart) >= 2000 && Number(newAcademicYearStart) <= 2099 ? `${newAcademicYearStart}/${Number(newAcademicYearStart) + 1}` : '—'}</p>
              </div>
              {yearError && <p role="alert" className="text-xs p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 break-words">{yearError}</p>}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button type="button" disabled={yearSaving} onClick={() => setYearModalOpen(false)} className="px-4 py-2 text-xs font-semibold border rounded-lg">Batal</button>
                <button type="submit" disabled={yearSaving} className="px-4 py-2 text-xs font-semibold text-white bg-[#073b2d] rounded-lg disabled:opacity-50">{yearSaving ? 'Menyimpan...' : 'Simpan Tahun Ajaran'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isSuperAdmin && Boolean(deleteYear)}
        title="Hapus Master Tahun Ajaran"
        message="Tahun ajaran hanya dapat dihapus jika tidak digunakan oleh rombel. Data kelas dan siswa tidak ikut terhapus. Sistem memeriksa relasi kembali sebelum menghapus."
        itemName={deleteYear || undefined}
        confirmLabel="Hapus Tahun Ajaran"
        loading={yearDeleting}
        error={yearDeleteError}
        onConfirm={() => void confirmDeleteYear()}
        onCancel={() => { setDeleteYear(null); setYearDeleteError(null); }}
      />

      {/* Modal Add / Edit Class */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-200">
              {editingClass ? 'Edit Rombongan Belajar' : 'Tambah Rombongan Belajar Baru'}
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tingkat Kelas *</label>
                  <input
                    type="text"
                    value={formData.grade_level}
                    onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                    placeholder="Contoh: Kelas 1, TK A, dsb."
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Rombel *</label>
                  <input
                    type="text"
                    value={formData.class_name}
                    onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                    placeholder="Contoh: Kelas 1A Ibnu Sina"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Kapasitas Maksimal *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.class_capacity}
                    onChange={(e) => setFormData({ ...formData, class_capacity: Number(e.target.value) })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Wali Kelas</label>
                  <input
                    type="text"
                    value={formData.homeroom_name}
                    onChange={(e) => setFormData({ ...formData, homeroom_name: e.target.value })}
                    placeholder="Nama Wali Kelas"
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Siswa Laki-laki *</label>
                  <input
                    type="number"
                    min="0"
                    value={draftCounts.male}
                    readOnly={draftCounts.active}
                    onChange={(e) => setFormData({ ...formData, male_students: Number(e.target.value) })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Siswa Perempuan *</label>
                  <input
                    type="number"
                    min="0"
                    value={draftCounts.female}
                    readOnly={draftCounts.active}
                    onChange={(e) => setFormData({ ...formData, female_students: Number(e.target.value) })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Siswa Pindahan Masuk</label>
                  <input
                    type="number"
                    min="0"
                    value={draftCounts.incoming}
                    readOnly={draftCounts.active}
                    onChange={(e) => setFormData({ ...formData, transfer_in: Number(e.target.value) })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Siswa Keluar / DO</label>
                  <input
                    type="number"
                    min="0"
                    value={draftCounts.active ? draftCounts.outgoing + draftCounts.dropout : draftCounts.dropout}
                    readOnly={draftCounts.active}
                    onChange={(e) => setFormData({ ...formData, dropout_students: Number(e.target.value) })}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300"
                  />
                </div>
              </div>

              <p className={`rounded-lg border p-3 text-xs ${draftCounts.active?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-amber-200 bg-amber-50 text-amber-800'}`}>
                {draftCounts.active
                  ? 'Otomatis dari register peserta didik dan log mutasi. Periksa murid yang belum dipetakan pada Sumber Daya → Data Peserta Didik.'
                  : 'Belum ada register peserta didik untuk periode ini. Nilai masih berasal dari pengisian rombel sebelumnya.'}
              </p>
              {/* Total preview */}
              <div className="p-3 bg-gray-50 rounded-lg text-xs flex items-center justify-between">
                <span>Total Murid yang Dihitung:</span>
                <strong className="text-gray-900 text-sm">
                  {draftCounts.male + draftCounts.female} Siswa
                </strong>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
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
                  {submitting ? 'Menyimpan...' : 'Simpan Rombel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Classroom Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Hapus Rombongan Belajar"
        message="Apakah Anda yakin ingin menghapus data rombel ini? Tindakan ini akan menghapus data kapasitas dan jumlah siswa rombel secara permanen."
        itemName={deleteModal.cls ? `${deleteModal.cls.class_name} (${deleteModal.cls.grade_level})` : undefined}
        confirmLabel="Hapus Rombel"
        cancelLabel="Batal"
        loading={deleteModal.deleting}
        error={deleteModal.error}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, cls: null, deleting: false, error: null })}
      />
    </div>
  );
};
