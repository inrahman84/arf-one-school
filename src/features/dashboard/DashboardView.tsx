import React, { useState, useMemo, useEffect } from 'react';
import {
  School as SchoolIcon,
  Users,
  GraduationCap,
  Building2,
  AlertTriangle,
  CheckCircle,
  FileText,
  Filter,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Wrench,
  Percent
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  School,
  Region,
  ClassroomEnrollment,
  Staff,
  Asset,
  Facility,
  SubmissionReview,
  DashboardFilters,
  Semester,
  StudentRecord,
  StudentMovement,
  EDUCATION_LEVELS
} from '../../types';
import { useAcademicYears } from '../../hooks/useAcademicYears';
import { StaffingInsights } from './StaffingInsights';
import { currentRoster } from '../../lib/studentActivity';
import { sortedAcademicYears } from '../../services/academicYearsService';

interface DashboardViewProps {
  schools: School[];
  regions: Region[];
  classes: ClassroomEnrollment[];
  staff: Staff[];
  students: StudentRecord[];
  studentMovements: StudentMovement[];
  assets: Asset[];
  facilities: Facility[];
  reviews: SubmissionReview[];
  loading: boolean;
  onRefresh: () => void;
  onSelectSchool: (schoolId: string) => void;
}

const BRAND_COLORS = {
  primaryDark: '#073b2d',
  neutralGray: '#5f5d5d',
  accentGold: '#c89b55',
  slateBlue: '#3f6276',
  warmIvory: '#f6f3ec',
  successGreen: '#009b4c',
  dangerRed: '#dc2626',
  warningOrange: '#d97706'
};

const PIE_COLORS = ['#009b4c', '#c89b55', '#dc2626', '#3f6276', '#073b2d'];

export const DashboardView: React.FC<DashboardViewProps> = ({
  schools,
  regions,
  classes,
  staff,
  students,
  studentMovements,
  assets,
  facilities,
  reviews,
  loading,
  onRefresh,
  onSelectSchool
}) => {
  const { activeAcademicYear: masterActiveYear, savedAcademicYears } = useAcademicYears();
  const availableYears = sortedAcademicYears([...savedAcademicYears,...classes.map(c=>c.academic_year)]);
  useEffect(() => {
    if(masterActiveYear)setFilters(prev=>({...prev,academicYear:masterActiveYear}));
  },[masterActiveYear]);
  const [filters, setFilters] = useState<DashboardFilters>({
    regionalId: 'ALL',
    schoolId: 'ALL',
    educationLevel: 'ALL',
    academicYear: '',
    semester: 'Ganjil',
    dataFreshness: 'ALL'
  });

  // Filtered Schools
  const filteredSchools = useMemo(() => {
    return schools.filter(s => {
      if (filters.regionalId !== 'ALL' && s.regional_id !== filters.regionalId) return false;
      if (filters.schoolId !== 'ALL' && s.school_id !== filters.schoolId) return false;
      if (filters.educationLevel !== 'ALL' && s.education_level !== filters.educationLevel) return false;
      return true;
    });
  }, [schools, filters]);

  const activeSchoolIds = useMemo(() => new Set(filteredSchools.map(s => s.school_id)), [filteredSchools]);

  // Filtered Datasets based on active schools and academic period
  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      if (!activeSchoolIds.has(c.school_id)) return false;
      if (filters.academicYear && c.academic_year !== filters.academicYear) return false;
      if (filters.semester && c.semester !== filters.semester) return false;
      return true;
    });
  }, [classes, activeSchoolIds, filters]);

  const filteredStaff = useMemo(() => {
    return staff.filter(s => activeSchoolIds.has(s.school_id));
  }, [staff, activeSchoolIds]);

  const filteredAssets = useMemo(() => {
    return assets.filter(a => activeSchoolIds.has(a.school_id));
  }, [assets, activeSchoolIds]);

  const filteredFacilities = useMemo(() => {
    return facilities.filter(f => activeSchoolIds.has(f.school_id));
  }, [facilities, activeSchoolIds]);

  // Calculated KPI Metrics
  const totalStudents = useMemo(() => {
    return filteredSchools.reduce((total,school)=>{
      const roster=currentRoster(students.filter(x=>x.school_id===school.school_id&&
        (!filters.academicYear||x.academic_year===filters.academicYear)&&
        (!filters.semester||x.semester===filters.semester)),studentMovements);
      if(roster.length)return total+roster.length;
      return total+filteredClasses.filter(c=>c.school_id===school.school_id).reduce(
        (sum,c)=>sum+(Number(c.male_students)||0)+(Number(c.female_students)||0),0);
    },0);
  }, [filteredSchools,filteredClasses,students,studentMovements,filters.academicYear,filters.semester]);

  const activeTeachers = useMemo(() => {
    return filteredStaff.filter(s => s.employment_status === 'Aktif' && (s.staff_category === 'Guru' || s.staff_category === 'Kepala Sekolah')).length;
  }, [filteredStaff]);

  const activeStaffPersonnel = useMemo(() => {
    return filteredStaff.filter(s => s.employment_status === 'Aktif' && s.staff_category === 'Tenaga Kependidikan').length;
  }, [filteredStaff]);

  const studentTeacherRatio = useMemo(() => {
    if (activeTeachers === 0) return 'N/A';
    return (totalStudents / activeTeachers).toFixed(1);
  }, [totalStudents, activeTeachers]);

  const overcapacityClasses = useMemo(() => {
    return filteredClasses.filter(c => {
      const cap = Number(c.class_capacity) || 0;
      const count = (Number(c.male_students) || 0) + (Number(c.female_students) || 0);
      return cap > 0 && count > cap;
    });
  }, [filteredClasses]);

  const totalAssetUnits = useMemo(() => {
    return filteredAssets.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
  }, [filteredAssets]);

  const totalAssetAcquisitionValue = useMemo(() => {
    return filteredAssets.reduce((sum, a) => sum + ((Number(a.acquisition_unit_value) || 0) * (Number(a.quantity) || 0)), 0);
  }, [filteredAssets]);

  const damagedAssetsCount = useMemo(() => {
    return filteredAssets
      .filter(a => a.asset_condition === 'Rusak Ringan' || a.asset_condition === 'Rusak Berat')
      .reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
  }, [filteredAssets]);

  const facilitiesNeedingRepair = useMemo(() => {
    return filteredFacilities.filter(f => f.repair_required);
  }, [filteredFacilities]);

  const totalEstimatedRepairCost = useMemo(() => {
    return facilitiesNeedingRepair.reduce((sum, f) => sum + (Number(f.estimated_repair_cost) || 0), 0);
  }, [facilitiesNeedingRepair]);

  // Charts Data:
  // 1. Student Distribution by Region
  const studentsByRegionData = useMemo(() => {
    const regMap: Record<string, { regionName: string; totalStudents: number; schoolCount: number }> = {};
    regions.forEach(r => {
      regMap[r.id] = { regionName: r.name.replace('Regional ', ''), totalStudents: 0, schoolCount: 0 };
    });

    filteredSchools.forEach(sch => {
      if (regMap[sch.regional_id]) {
        regMap[sch.regional_id].schoolCount += 1;
      }
    });

    filteredClasses.forEach(c => {
      const sch = schools.find(s => s.school_id === c.school_id);
      if (sch && regMap[sch.regional_id]) {
        regMap[sch.regional_id].totalStudents += (Number(c.male_students) || 0) + (Number(c.female_students) || 0);
      }
    });

    return Object.values(regMap).filter(r => r.schoolCount > 0 || r.totalStudents > 0);
  }, [regions, filteredSchools, filteredClasses, schools]);

  // 2. Student Enrollment by Education Level
  const studentsByLevelData = useMemo(() => {
    const map: Record<string, number> = { 'TPA': 0, 'KB': 0, 'TK': 0, 'SD': 0, 'SMP': 0, 'SMA': 0, 'SMK': 0, 'PAUD': 0 };
    filteredClasses.forEach(c => {
      const sch = schools.find(s => s.school_id === c.school_id);
      if (sch && map[sch.education_level] !== undefined) {
        map[sch.education_level] += (Number(c.male_students) || 0) + (Number(c.female_students) || 0);
      }
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).filter(item => item.value > 0);
  }, [filteredClasses, schools]);

  // 3. Teacher Qualification & Certification
  const teacherCertData = useMemo(() => {
    let bersertifikat = 0;
    let belum = 0;
    filteredStaff
      .filter(s => s.staff_category === 'Guru' || s.staff_category === 'Kepala Sekolah')
      .forEach(s => {
        if (s.teacher_certification === 'Bersertifikat') bersertifikat++;
        else belum++;
      });
    return [
      { name: 'Bersertifikat', value: bersertifikat },
      { name: 'Belum Bersertifikat', value: belum }
    ].filter(d => d.value > 0);
  }, [filteredStaff]);

  // 4. Asset Condition
  const assetConditionData = useMemo(() => {
    let baik = 0;
    let rusakRingan = 0;
    let rusakBerat = 0;
    filteredAssets.forEach(a => {
      const q = Number(a.quantity) || 0;
      if (a.asset_condition === 'Baik') baik += q;
      else if (a.asset_condition === 'Rusak Berat') rusakBerat += q;
      else rusakRingan += q;
    });
    return [
      { name: 'Kondisi Baik', value: baik, color: BRAND_COLORS.successGreen },
      { name: 'Rusak Ringan', value: rusakRingan, color: BRAND_COLORS.accentGold },
      { name: 'Rusak Berat', value: rusakBerat, color: BRAND_COLORS.dangerRed }
    ].filter(d => d.value > 0);
  }, [filteredAssets]);

  // 5. Asset Funding Sources
  const assetFundingData = useMemo(() => {
    const map: Record<string, number> = { 'ARF': 0, 'BOS': 0, 'BOP': 0, 'Donasi': 0, 'Lainnya': 0 };
    filteredAssets.forEach(a => {
      const q = Number(a.quantity) || 0;
      const src = a.funding_source || 'Lainnya';
      map[src] = (map[src] || 0) + q;
    });
    return Object.entries(map).map(([source, units]) => ({ source, units })).filter(d => d.units > 0);
  }, [filteredAssets]);

  // 6. Facilities Repair Priority
  const repairPriorityData = useMemo(() => {
    const map: Record<string, number> = { 'Kritis': 0, 'Tinggi': 0, 'Sedang': 0, 'Rendah': 0 };
    facilitiesNeedingRepair.forEach(f => {
      const pri = f.repair_priority || 'Sedang';
      map[pri] = (map[pri] || 0) + 1;
    });
    return Object.entries(map).map(([priority, count]) => ({ priority, count }));
  }, [facilitiesNeedingRepair]);

  // 7. School Capacity Utilization
  const schoolUtilizationData = useMemo(() => {
    return filteredSchools.map(sch => {
      const schClasses = filteredClasses.filter(c => c.school_id === sch.school_id);
      const studentCount = schClasses.reduce((sum, c) => sum + (Number(c.male_students) || 0) + (Number(c.female_students) || 0), 0);
      const capacity = sch.school_capacity || 0;
      const utilization = capacity > 0 ? Math.round((studentCount / capacity) * 100) : 0;
      return {
        name: sch.school_name.length > 20 ? sch.school_name.substring(0, 18) + '...' : sch.school_name,
        fullSchoolName: sch.school_name,
        murid: studentCount,
        kapasitas: capacity,
        utilization
      };
    });
  }, [filteredSchools, filteredClasses]);

  return (
    <div className="space-y-6 pb-12">
      {/* Aggregate only: individual identifiers never appear on executive screens. */}
      <StaffingInsights schools={filteredSchools} classes={filteredClasses} staff={filteredStaff}
        students={currentRoster(students.filter(x=>activeSchoolIds.has(x.school_id)),studentMovements)}
        academicYear={filters.academicYear||masterActiveYear||''} semester={filters.semester as Semester}/>
      {/* Top Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#073b2d]" />
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">
              Filter Parameter Eksekutif
            </span>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan Data</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mt-3">
          {/* Regional */}
          <div>
            <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Wilayah / Regional</label>
            <select
              value={filters.regionalId}
              onChange={(e) => setFilters(prev => ({ ...prev, regionalId: e.target.value, schoolId: 'ALL' }))}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#073b2d]"
            >
              <option value="ALL">Semua Regional ARF</option>
              {regions.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* School */}
          <div>
            <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Sekolah Terpilih</label>
            <select
              value={filters.schoolId}
              onChange={(e) => setFilters(prev => ({ ...prev, schoolId: e.target.value }))}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#073b2d]"
            >
              <option value="ALL">Semua Sekolah Terpilih ({filteredSchools.length})</option>
              {filteredSchools.map(s => (
                <option key={s.school_id} value={s.school_id}>{s.school_name}</option>
              ))}
            </select>
          </div>

          {/* Education Level */}
          <div>
            <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Jenjang Pendidikan</label>
            <select
              value={filters.educationLevel}
              onChange={(e) => setFilters(prev => ({ ...prev, educationLevel: e.target.value }))}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#073b2d]"
            >
              <option value="ALL">Semua Jenjang</option>
              {EDUCATION_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
            </select>
          </div>

          {/* Academic Year */}
          <div>
            <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Tahun Ajaran</label>
            <select
              value={filters.academicYear}
              onChange={(e) => setFilters(prev => ({ ...prev, academicYear: e.target.value }))}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#073b2d]"
            >
              <option value="">Semua Tahun Ajaran</option>
              {availableYears.map(year=><option key={year} value={year}>{year}{year===masterActiveYear?' (Aktif)':''}</option>)}
            </select>
          </div>

          {/* Semester */}
          <div>
            <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Semester</label>
            <select
              value={filters.semester}
              onChange={(e) => setFilters(prev => ({ ...prev, semester: e.target.value as Semester }))}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#073b2d]"
            >
              <option value="Ganjil">Semester Ganjil</option>
              <option value="Genap">Semester Genap</option>
            </select>
          </div>
        </div>
      </div>

      {/* 8 Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 1. Total Sekolah */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5f5d5d]">Total Sekolah</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-[#073b2d]">
              <SchoolIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-gray-900">{filteredSchools.length}</span>
            <span className="text-[11px] text-[#5f5d5d]">Unit Sekolah</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-medium">
            {regions.length} Wilayah Operasional
          </div>
        </div>

        {/* 2. Total Murid */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5f5d5d]">Total Murid</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-[#c89b55]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-gray-900">{totalStudents.toLocaleString()}</span>
            <span className="text-[11px] text-[#5f5d5d]">Peserta Didik</span>
          </div>
          <div className="mt-1 text-[11px] text-[#5f5d5d]">
            {filteredClasses.length} Rombongan Belajar
          </div>
        </div>

        {/* 3. Total Guru */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5f5d5d]">Total Guru Aktif</span>
            <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-[#3f6276]">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-gray-900">{activeTeachers}</span>
            <span className="text-[11px] text-[#5f5d5d]">Pendidik</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-medium">
            {teacherCertData.find(c => c.name === 'Bersertifikat')?.value || 0} Bersertifikat
          </div>
        </div>

        {/* 4. Total Tenaga Kependidikan */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5f5d5d]">Tenaga Kependidikan</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-gray-900">{activeStaffPersonnel}</span>
            <span className="text-[11px] text-[#5f5d5d]">Staf Tendik</span>
          </div>
          <div className="mt-1 text-[11px] text-[#5f5d5d]">
            Operator, IT &amp; Tata Usaha
          </div>
        </div>

        {/* 5. Rasio Murid / Guru */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5f5d5d]">Rasio Murid : Guru</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-[#009b4c]">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-gray-900">{studentTeacherRatio}</span>
            <span className="text-[11px] text-[#5f5d5d]">Siswa / Guru</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-medium">
            Standar Nasional: &le; 28:1
          </div>
        </div>

        {/* 6. Kelas Melebihi Kapasitas */}
        <div className={`p-4 rounded-xl border shadow-xs relative overflow-hidden ${
          overcapacityClasses.length > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5f5d5d]">Kelas Melebihi Kapasitas</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              overcapacityClasses.length > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-[#009b4c]'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-extrabold ${overcapacityClasses.length > 0 ? 'text-rose-700' : 'text-gray-900'}`}>
              {overcapacityClasses.length}
            </span>
            <span className="text-[11px] text-[#5f5d5d]">Rombel</span>
          </div>
          <div className={`mt-1 text-[11px] font-semibold ${overcapacityClasses.length > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
            {overcapacityClasses.length > 0 ? 'Perlu Pemecahan Kelas' : 'Kapasitas Terjaga'}
          </div>
        </div>

        {/* 7. Total Aset */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5f5d5d]">Total Inventaris Aset</span>
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-gray-900">{totalAssetUnits.toLocaleString()}</span>
            <span className="text-[11px] text-[#5f5d5d]">Unit Barang</span>
          </div>
          <div className="mt-1 text-[11px] text-teal-800 font-medium truncate">
            Rp {(totalAssetAcquisitionValue / 1000000).toFixed(1)} Juta Nilai Perolehan
          </div>
        </div>

        {/* 8. Aset Perlu Perbaikan */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5f5d5d]">Aset &amp; Fasilitas Rusak</span>
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-orange-700">
              {damagedAssetsCount + facilitiesNeedingRepair.length}
            </span>
            <span className="text-[11px] text-[#5f5d5d]">Item / Ruang</span>
          </div>
          <div className="mt-1 text-[11px] text-orange-800 font-medium truncate">
            Est. Rp {(totalEstimatedRepairCost / 1000000).toFixed(1)} Jt Biaya Perbaikan
          </div>
        </div>
      </div>

      {/* Warning Alert if Overcapacity Exists */}
      {overcapacityClasses.length > 0 && (
        <div className="bg-rose-50 border-l-4 border-rose-600 p-4 rounded-r-xl flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-bold text-rose-900">Peringatan: Kelas Melebihi Kapasitas Terdeteksi</h4>
            <p className="text-rose-700 mt-0.5">
              Terdapat {overcapacityClasses.length} rombongan belajar di mana jumlah murid melebihi daya tampung ruang kelas:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {overcapacityClasses.map(c => {
                const total = (Number(c.male_students) || 0) + (Number(c.female_students) || 0);
                const sch = schools.find(s => s.school_id === c.school_id);
                return (
                  <span key={c.class_id} className="bg-rose-100 text-rose-900 font-mono text-[11px] px-2 py-0.5 rounded border border-rose-200 font-medium">
                    {sch?.school_name}: {c.class_name} ({total} / {c.class_capacity} siswa)
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Analytical Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart A: Distribusi Murid per Regional */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Distribusi Peserta Didik per Regional</h3>
              <p className="text-[11px] text-[#5f5d5d]">Perbandingan jumlah murid di setiap wilayah operasional ARF</p>
            </div>
          </div>
          <div className="h-64">
            {studentsByRegionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studentsByRegionData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="regionName" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val: any) => [`${Number(val).toLocaleString()} Murid`, 'Peserta Didik']}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="totalStudents" fill="#073b2d" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                Data rombel belum tersedia untuk filter terpilih.
              </div>
            )}
          </div>
        </div>

        {/* Chart B: Distribusi Murid per Jenjang Pendidikan */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Proporsi Murid per Jenjang Sekolah</h3>
              <p className="text-[11px] text-[#5f5d5d]">TK, SD, SMP, SMK di bawah naungan yayasan</p>
            </div>
          </div>
          <div className="h-64">
            {studentsByLevelData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={studentsByLevelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {studentsByLevelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${val} Murid`, 'Jumlah']}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                Data jenjang belum tersedia.
              </div>
            )}
          </div>
        </div>

        {/* Chart C: Kondisi Aset Sekolah */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Kondisi Fisik Sarana &amp; Aset</h3>
              <p className="text-[11px] text-[#5f5d5d]">Komposisi unit aset dalam kondisi Baik, Rusak Ringan, Rusak Berat</p>
            </div>
          </div>
          <div className="h-64">
            {assetConditionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assetConditionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {assetConditionData.map((entry, index) => (
                      <Cell key={`asset-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${val} Unit`, 'Jumlah Unit']}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                Data inventaris aset belum tersedia.
              </div>
            )}
          </div>
        </div>

        {/* Chart D: Sumber Pendanaan Aset */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Sumber Pendanaan Aset Sekolah</h3>
              <p className="text-[11px] text-[#5f5d5d]">BOS, BOP, ARF Mandiri, Donasi</p>
            </div>
          </div>
          <div className="h-64">
            {assetFundingData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assetFundingData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val: any) => [`${val} Unit`, 'Jumlah Aset']}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="units" fill="#c89b55" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                Data sumber pendanaan belum tersedia.
              </div>
            )}
          </div>
        </div>

        {/* Chart E: Prioritas Perbaikan Fasilitas */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Urgensi Perbaikan Prasarana</h3>
              <p className="text-[11px] text-[#5f5d5d]">Tingkat prioritas kebutuhan perbaikan fasilitas</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={repairPriorityData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="priority" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [`${val} Ruang`, 'Jumlah Fasilitas']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#3f6276" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart F: Pemanfaatan Kapasitas Sekolah */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Utilisasi Kapasitas Total Sekolah</h3>
              <p className="text-[11px] text-[#5f5d5d]">Persentase murid terhadap kapasitas daya tampung</p>
            </div>
          </div>
          <div className="h-64">
            {schoolUtilizationData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={schoolUtilizationData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip
                    formatter={(val: any, name?: any, item?: any) => [
                      `${val}% (${item?.payload?.murid || 0} / ${item?.payload?.kapasitas || 0} siswa)`,
                      'Utilisasi'
                    ]}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="utilization" fill="#009b4c" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                Belum ada data kapasitas sekolah.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Table: List of Schools & Operational Status */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Daftar Sekolah &amp; Kelengkapan Data</h3>
            <p className="text-xs text-[#5f5d5d]">Ringkasan operasional dan verifikasi per unit sekolah ARF</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Nama Sekolah</th>
                <th className="py-3 px-4">Jenjang</th>
                <th className="py-3 px-4">Regional</th>
                <th className="py-3 px-4">Kepala Sekolah</th>
                <th className="py-3 px-4 text-center">Murid</th>
                <th className="py-3 px-4 text-center">Guru</th>
                <th className="py-3 px-4 text-center">Status Operasional</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSchools.map((s) => {
                const reg = regions.find(r => r.id === s.regional_id);
                const schClasses = filteredClasses.filter(c => c.school_id === s.school_id);
                const studentCount = schClasses.reduce((sum, c) => sum + (Number(c.male_students) || 0) + (Number(c.female_students) || 0), 0);
                const teacherCount = filteredStaff.filter(st => st.school_id === s.school_id && (st.staff_category === 'Guru' || st.staff_category === 'Kepala Sekolah')).length;

                return (
                  <tr key={s.school_id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      <div>{s.school_name}</div>
                      <div className="text-[11px] text-[#5f5d5d] font-mono">NPSN: {s.npsn || 'Belum diisi'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3f6276]/10 text-[#3f6276]">
                        {s.education_level}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{reg?.name || s.regional_id}</td>
                    <td className="py-3 px-4 text-gray-700">{s.principal_name || '-'}</td>
                    <td className="py-3 px-4 text-center font-bold text-gray-900">{studentCount}</td>
                    <td className="py-3 px-4 text-center font-bold text-gray-900">{teacherCount}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        {s.operational_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onSelectSchool(s.school_id)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#073b2d] text-white hover:bg-[#0a4f3d] transition-colors"
                      >
                        Buka Detail
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredSchools.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    Tidak ada sekolah yang cocok dengan filter yang dipilih.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
