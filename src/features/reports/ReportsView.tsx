import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  BarChart3,
  Calendar,
  School as SchoolIcon,
  Users,
  GraduationCap,
  Building2,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { School, Region, ClassroomEnrollment, Staff, Asset, Facility, SubmissionReview } from '../../types';
import { excelService } from '../../services/excelService';

interface ReportsViewProps {
  schools: School[];
  regions: Region[];
  classes: ClassroomEnrollment[];
  staff: Staff[];
  assets: Asset[];
  facilities: Facility[];
  reviews: SubmissionReview[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  schools,
  regions,
  classes,
  staff,
  assets,
  facilities,
  reviews
}) => {
  const [selectedRegionId, setSelectedRegionId] = useState('ALL');
  const [selectedSchoolId, setSelectedSchoolId] = useState('ALL');
  const [academicYear, setAcademicYear] = useState('2026/2027');

  const filteredSchools = schools.filter(s => {
    if (selectedRegionId !== 'ALL' && s.regional_id !== selectedRegionId) return false;
    if (selectedSchoolId !== 'ALL' && s.school_id !== selectedSchoolId) return false;
    return true;
  });

  const activeSchoolIds = new Set(filteredSchools.map(s => s.school_id));

  // 1. Export School Profile Report
  const exportSchoolProfile = () => {
    const data = filteredSchools.map(s => {
      const reg = regions.find(r => r.id === s.regional_id);
      return {
        'ID Sekolah': s.school_id,
        'NPSN': s.npsn || '-',
        'Nama Sekolah': s.school_name,
        'Wilayah / Regional': reg?.name || s.regional_id,
        'Jenjang': s.education_level,
        'Alamat': s.school_address || '-',
        'Kecamatan': s.district || '-',
        'Kabupaten': s.regency || '-',
        'Status Operasional': s.operational_status,
        'No Izin': s.operational_license || '-',
        'Akreditasi': s.accreditation_grade || 'Belum Terakreditasi',
        'Kapasitas Daya Tampung': s.school_capacity || 0,
        'Kepala Sekolah': s.principal_name || '-',
        'Tanggal Cetak': new Date().toLocaleDateString('id-ID')
      };
    });
    excelService.exportReport('ARF_Laporan_Profil_Sekolah', 'Profil_Sekolah', data);
  };

  // 2. Export Student Enrollment Report
  const exportEnrollment = () => {
    const data = classes
      .filter(c => activeSchoolIds.has(c.school_id) && c.academic_year === academicYear)
      .map(c => {
        const sch = schools.find(s => s.school_id === c.school_id);
        const male = Number(c.male_students) || 0;
        const female = Number(c.female_students) || 0;
        const total = male + female;
        const cap = Number(c.class_capacity) || 0;
        const isOver = cap > 0 && total > cap;
        const occRate = cap > 0 ? ((total / cap) * 100).toFixed(1) + '%' : 'N/A';

        return {
          'ID Rombel': c.class_id,
          'Sekolah': sch?.school_name || c.school_id,
          'Tahun Ajaran': c.academic_year,
          'Semester': c.semester,
          'Tingkat': c.grade_level,
          'Nama Rombel': c.class_name,
          'Wali Kelas': c.homeroom_name || '-',
          'Kapasitas': cap,
          'Siswa Laki-laki': male,
          'Siswa Perempuan': female,
          'Total Siswa': total,
          'Tingkat Okupansi': occRate,
          'Status Kelebihan Kapasitas': isOver ? 'Kelas Melebihi Kapasitas' : 'Normal',
          'Siswa Pindahan Masuk': c.transfer_in || 0,
          'Siswa Keluar': c.transfer_out || 0,
          'Siswa Putus Sekolah (DO)': c.dropout_students || 0
        };
      });
    excelService.exportReport('ARF_Laporan_Peserta_Didik_Rombel', 'Data_Rombel', data);
  };

  // 3. Export HR Report
  const exportHR = () => {
    const data = staff
      .filter(s => activeSchoolIds.has(s.school_id))
      .map(st => {
        const sch = schools.find(s => s.school_id === st.school_id);
        return {
          'ID PTK': st.staff_id,
          'Sekolah': sch?.school_name || st.school_id,
          'Nama Lengkap': st.staff_name,
          'Kategori': st.staff_category,
          'Jabatan Utama': st.primary_position,
          'Status Kepegawaian': st.employment_type,
          'Status Aktif': st.employment_status,
          'Pendidikan Terakhir': st.highest_education,
          'Jurusan Pendidikan': st.education_major || '-',
          'Sertifikasi Pendidik': st.teacher_certification,
          'Mata Pelajaran': st.teaching_subject || '-',
          'Jam Mengajar Mingguan': st.weekly_teaching_hours || 0,
          'Tugas Tambahan': st.additional_assignment || '-'
        };
      });
    excelService.exportReport('ARF_Laporan_Guru_PTK', 'Data_PTK', data);
  };

  // 4. Export Asset Inventory Report
  const exportAssets = () => {
    const data = assets
      .filter(a => activeSchoolIds.has(a.school_id))
      .map(ast => {
        const sch = schools.find(s => s.school_id === ast.school_id);
        return {
          'ID Aset': ast.asset_id,
          'Sekolah': sch?.school_name || ast.school_id,
          'Kode Barang': ast.asset_code || '-',
          'Nama Aset': ast.asset_name,
          'Kategori': ast.asset_category,
          'Merk & Spesifikasi': ast.asset_brand_spec || '-',
          'Jumlah Unit': ast.quantity,
          'Satuan': ast.unit_measure,
          'Sumber Dana': ast.funding_source,
          'Tahun Pengadaan': ast.funding_year || '-',
          'Harga Satuan (Rp)': ast.acquisition_unit_value,
          'Total Nilai Perolehan (Rp)': ast.quantity * ast.acquisition_unit_value,
          'Kondisi Fisik': ast.asset_condition,
          'Status Penggunaan': ast.asset_status
        };
      });
    excelService.exportReport('ARF_Laporan_Inventaris_Aset', 'Inventaris_Aset', data);
  };

  // 5. Export Facilities Condition Report
  const exportFacilities = () => {
    const data = facilities
      .filter(f => activeSchoolIds.has(f.school_id))
      .map(fac => {
        const sch = schools.find(s => s.school_id === fac.school_id);
        return {
          'ID Fasilitas': fac.facility_id,
          'Sekolah': sch?.school_name || fac.school_id,
          'Tipe': fac.facility_type,
          'Nama Fasilitas': fac.facility_name,
          'Luas (m2)': fac.facility_area_m2 || 0,
          'Kapasitas': fac.facility_capacity || 0,
          'Kondisi Fisik': fac.facility_condition,
          'Perlu Perbaikan': fac.repair_required ? 'Ya' : 'Tidak',
          'Prioritas Perbaikan': fac.repair_priority || '-',
          'Estimasi Biaya Perbaikan (Rp)': fac.estimated_repair_cost || 0,
          'Catatan': fac.notes || '-'
        };
      });
    excelService.exportReport('ARF_Laporan_Sarana_Prasarana', 'Data_Prasarana', data);
  };

  // 6. Export Regional Summary Report
  const exportRegionalSummary = () => {
    const data = regions.map(reg => {
      const regSchools = schools.filter(s => s.regional_id === reg.id);
      const regSchoolIds = new Set(regSchools.map(s => s.school_id));
      const regClasses = classes.filter(c => regSchoolIds.has(c.school_id) && c.academic_year === academicYear);
      const regStudents = regClasses.reduce((sum, c) => sum + (Number(c.male_students) || 0) + (Number(c.female_students) || 0), 0);
      const regTeachers = staff.filter(s => regSchoolIds.has(s.school_id) && (s.staff_category === 'Guru' || s.staff_category === 'Kepala Sekolah')).length;
      const regAssets = assets.filter(a => regSchoolIds.has(a.school_id)).reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
      const regAssetVal = assets.filter(a => regSchoolIds.has(a.school_id)).reduce((sum, a) => sum + ((Number(a.quantity) || 0) * (Number(a.acquisition_unit_value) || 0)), 0);

      return {
        'ID Regional': reg.id,
        'Nama Wilayah': reg.name,
        'Kode': reg.code,
        'Jumlah Unit Sekolah': regSchools.length,
        'Total Peserta Didik': regStudents,
        'Total Pendidik & Guru': regTeachers,
        'Rasio Siswa/Guru': regTeachers > 0 ? (regStudents / regTeachers).toFixed(1) : 'N/A',
        'Total Unit Aset Terdata': regAssets,
        'Total Nilai Perolehan Aset (Rp)': regAssetVal,
        'Tahun Periode': academicYear
      };
    });
    excelService.exportReport('ARF_Laporan_Ringkasan_Regional', 'Ringkasan_Regional', data);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Filter Parameters */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Parameter Filter Ekspor Laporan</h3>
            <p className="text-xs text-[#5f5d5d]">Pilih cakupan wilayah dan unit sekolah sebelum mengunduh berkas laporan</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Wilayah / Regional</label>
            <select
              value={selectedRegionId}
              onChange={(e) => { setSelectedRegionId(e.target.value); setSelectedSchoolId('ALL'); }}
              className="w-full text-xs p-2 rounded-lg border border-gray-300"
            >
              <option value="ALL">Semua Wilayah Operasional</option>
              {regions.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Sekolah Terpilih</label>
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-gray-300"
            >
              <option value="ALL">Semua Sekolah Terpilih ({filteredSchools.length})</option>
              {filteredSchools.map(s => (
                <option key={s.school_id} value={s.school_id}>{s.school_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Tahun Ajaran</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-gray-300"
            >
              <option value="2026/2027">2026/2027</option>
              <option value="2025/2026">2025/2026</option>
            </select>
          </div>
        </div>
      </div>

      {/* 6 Official Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* 1. School Profile */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#073b2d] flex items-center justify-center mb-3">
              <SchoolIcon className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-gray-900">Laporan Profil Sekolah</h4>
            <p className="text-xs text-[#5f5d5d] mt-1">
              Data master kelembagaan, NPSN, akreditasi, izin operasional, kapasitas, dan identitas pimpinan.
            </p>
          </div>
          <button
            onClick={exportSchoolProfile}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-white text-xs font-semibold shadow-xs hover:bg-[#0a4f3d] transition-colors"
            style={{ backgroundColor: '#073b2d' }}
          >
            <Download className="w-4 h-4" />
            <span>Unduh Laporan Profil (.xlsx)</span>
          </button>
        </div>

        {/* 2. Enrollment */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#c89b55] flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-gray-900">Laporan Peserta Didik &amp; Rombel</h4>
            <p className="text-xs text-[#5f5d5d] mt-1">
              Rincian rombel, distribusi gender murid, tingkat okupansi kelas, dan deteksi kelebihan kapasitas.
            </p>
          </div>
          <button
            onClick={exportEnrollment}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-white text-xs font-semibold shadow-xs hover:bg-[#0a4f3d] transition-colors"
            style={{ backgroundColor: '#073b2d' }}
          >
            <Download className="w-4 h-4" />
            <span>Unduh Laporan Rombel (.xlsx)</span>
          </button>
        </div>

        {/* 3. HR Report */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#3f6276] flex items-center justify-center mb-3">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-gray-900">Laporan Guru &amp; Tenaga Kependidikan</h4>
            <p className="text-xs text-[#5f5d5d] mt-1">
              Status sertifikasi pendidik, kualifikasi ijazah, mata pelajaran, beban mengajar, dan status kepegawaian.
            </p>
          </div>
          <button
            onClick={exportHR}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-white text-xs font-semibold shadow-xs hover:bg-[#0a4f3d] transition-colors"
            style={{ backgroundColor: '#073b2d' }}
          >
            <Download className="w-4 h-4" />
            <span>Unduh Laporan PTK (.xlsx)</span>
          </button>
        </div>

        {/* 4. Asset Inventory */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-3">
              <Building2 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-gray-900">Laporan Inventaris Aset</h4>
            <p className="text-xs text-[#5f5d5d] mt-1">
              Daftar seluruh barang inventaris, sumber pendanaan (BOS/BOP/ARF), nilai perolehan, dan kondisi fisik.
            </p>
          </div>
          <button
            onClick={exportAssets}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-white text-xs font-semibold shadow-xs hover:bg-[#0a4f3d] transition-colors"
            style={{ backgroundColor: '#073b2d' }}
          >
            <Download className="w-4 h-4" />
            <span>Unduh Laporan Aset (.xlsx)</span>
          </button>
        </div>

        {/* 5. Facilities Condition */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center mb-3">
              <Building2 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-gray-900">Laporan Sarana &amp; Kebutuhan Renovasi</h4>
            <p className="text-xs text-[#5f5d5d] mt-1">
              Kondisi fisik gedung/ruangan, skala prioritas perbaikan, dan estimasi biaya perbaikan fasilitas.
            </p>
          </div>
          <button
            onClick={exportFacilities}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-white text-xs font-semibold shadow-xs hover:bg-[#0a4f3d] transition-colors"
            style={{ backgroundColor: '#073b2d' }}
          >
            <Download className="w-4 h-4" />
            <span>Unduh Laporan Sarpras (.xlsx)</span>
          </button>
        </div>

        {/* 6. Regional Summary */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center mb-3">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-gray-900">Laporan Ringkasan Regional</h4>
            <p className="text-xs text-[#5f5d5d] mt-1">
              Konsolidasi data makro per regional ARF (rasio siswa/guru, aset total, dan jumlah unit aktif).
            </p>
          </div>
          <button
            onClick={exportRegionalSummary}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-white text-xs font-semibold shadow-xs hover:bg-[#0a4f3d] transition-colors"
            style={{ backgroundColor: '#073b2d' }}
          >
            <Download className="w-4 h-4" />
            <span>Unduh Ringkasan Regional (.xlsx)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
