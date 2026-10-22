export type UserRole =
  | 'SUPER_ADMIN'
  | 'FOUNDATION_MANAGER'
  | 'REGIONAL_LEAD'
  | 'SCHOOL_PRINCIPAL'
  | 'SCHOOL_OPERATOR'
  | 'HR_OFFICER'
  | 'ASSET_OFFICER';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'INVITED';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  position?: string;
  role: UserRole;
  assignedRegions: string[]; // array of region IDs
  assignedSchools: string[]; // array of school IDs
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UserInvitation {
  id: string;
  email: string;
  displayName: string;
  position: string;
  role: UserRole;
  assignedRegions: string[];
  assignedSchools: string[];
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
  invitedBy: string;
  createdAt: string;
}

export interface Region {
  id: string;
  name: string;
  code: string;
  description?: string;
  status: 'active' | 'inactive';
  /** Persisted order of regional cards (optional for historical records). */
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export const EDUCATION_LEVELS = ['TPA', 'KB', 'TK', 'SD', 'SMP', 'SMA', 'SMK'] as const;
/** PAUD is retained for previously stored records; new forms use EDUCATION_LEVELS only. */
export type EducationLevel = typeof EDUCATION_LEVELS[number] | 'PAUD';

/** Status baru untuk pengisian dan pengeditan data sekolah. */
export const OPERATIONAL_STATUS_OPTIONS = [
  'Aktif Memiliki Izin Operasional',
  'Aktif Tidak Memiliki Izin Operasional',
  'Tidak Aktif'
] as const;
/** Legacy labels remain readable; saving a school requires one of the new statuses. */
export type OperationalStatus = typeof OPERATIONAL_STATUS_OPTIONS[number]
  | 'Aktif' | 'Izin Operasional Baru' | 'Menunggu Akreditasi' | 'Nonaktif';

export type AccreditationGrade = 'A' | 'B' | 'C' | 'Belum Terakreditasi';

export interface School {
  school_id: string;
  npsn?: string;
  school_name: string;
  regional_id: string;
  education_level: EducationLevel;
  school_address?: string;
  district?: string;
  village?: string; // Desa/Estate; tetap menggunakan nama field lama agar data historis kompatibel
  regency?: string;
  operational_status: OperationalStatus;
  operational_license?: string;
  accreditation_grade?: AccreditationGrade;
  accreditation_expiry?: string;
  school_capacity?: number;
  principal_staff_id?: string;
  principal_name?: string;
  created_at: string;
  updated_at: string;
}

export type Semester = 'Ganjil' | 'Genap';

export interface ClassroomEnrollment {
  class_id: string;
  school_id: string;
  academic_year: string;
  semester: Semester;
  grade_level: string;
  class_name: string;
  homeroom_staff_id?: string;
  homeroom_name?: string;
  class_capacity: number;
  male_students: number;
  female_students: number;
  transfer_in?: number;
  transfer_out?: number;
  dropout_students?: number;
  classroom_id?: string;
  data_as_of?: string;
  status?: SubmissionStatus;
  created_at: string;
  updated_at: string;
}

export type StaffCategory = 'Guru' | 'Kepala Sekolah' | 'Tenaga Kependidikan' | 'Lainnya';
export type EmploymentStatus = 'Aktif' | 'Cuti' | 'Nonaktif' | 'Berakhir';
export type EmploymentType = 'Tetap' | 'Kontrak' | 'Honorer' | 'Lainnya';
export type HighestEducation = 'SMA/SMK' | 'D1/D2/D3' | 'D4/S1' | 'S2' | 'S3' | 'Lainnya';
export type TeacherCertification = 'Bersertifikat' | 'Belum Bersertifikat' | 'Tidak Berlaku';

export interface Staff {
  staff_id: string;
  school_id: string;
  staff_name: string;
  staff_category: StaffCategory;
  primary_position: string;
  employment_type: EmploymentType;
  employment_start_date?: string;
  employment_status: EmploymentStatus;
  highest_education: HighestEducation;
  education_major?: string;
  teacher_certification: TeacherCertification;
  teaching_subject?: string;
  assigned_class_id?: string;
  weekly_teaching_hours?: number;
  additional_assignment?: string;
  professional_development_need?: string;
  created_at: string;
  updated_at: string;
}

export type FundingSource = 'BOS' | 'BOP' | 'ARF' | 'Donasi' | 'Lainnya';
export type AssetCondition = 'Baik' | 'Rusak Ringan' | 'Rusak Berat';
export type AssetStatus = 'Digunakan' | 'Disimpan' | 'Dalam Perbaikan' | 'Dihapus';
export type AssetCategory =
  | 'Furniture'
  | 'Perangkat IT'
  | 'Buku & Perpustakaan'
  | 'Alat Permainan Edukatif'
  | 'Laboratorium'
  | 'Peralatan Pembelajaran'
  | 'Peralatan Kantor'
  | 'Peralatan Olahraga'
  | 'Lainnya';

export interface Asset {
  asset_id: string;
  school_id: string;
  asset_code?: string;
  asset_name: string;
  asset_category: AssetCategory;
  asset_brand_spec?: string;
  asset_serial_number?: string;
  quantity: number;
  unit_measure: string;
  acquisition_date?: string;
  acquisition_source?: string;
  funding_source: FundingSource;
  funding_year?: number;
  acquisition_unit_value: number;
  asset_location_id?: string;
  asset_condition: AssetCondition;
  asset_status: AssetStatus;
  image_url?: string;
  image_path?: string;
  last_inspection_date?: string;
  created_at: string;
  updated_at: string;
}

export type FacilityType =
  | 'Ruang Kelas'
  | 'Perpustakaan'
  | 'Laboratorium'
  | 'Toilet'
  | 'Ruang Guru'
  | 'Ruang Kepala Sekolah'
  | 'Kantor'
  | 'Lapangan'
  | 'Ruang UKS'
  | 'Lainnya';

export type FacilityCondition = 'Baik' | 'Rusak Ringan' | 'Rusak Sedang' | 'Rusak Berat';
export type RepairPriority = 'Kritis' | 'Tinggi' | 'Sedang' | 'Rendah';

export interface Facility {
  facility_id: string;
  school_id: string;
  facility_type: FacilityType;
  facility_name: string;
  facility_area_m2?: number;
  facility_capacity?: number;
  facility_condition: FacilityCondition;
  facility_availability?: string;
  facility_utilization?: string;
  repair_required: boolean;
  physical_image_url?: string;
  physical_image_path?: string;
  damage_image_url?: string;
  damage_image_path?: string;
  repair_priority?: RepairPriority;
  estimated_repair_cost?: number;
  inspection_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'REVISION_REQUIRED' | 'VERIFIED';
export type SubmissionModule = 'ENROLLMENT' | 'HR' | 'ASSETS' | 'FACILITIES' | 'ALL';

export interface SubmissionReview {
  id: string;
  schoolId: string;
  module: SubmissionModule;
  academicYear: string;
  semester: Semester;
  status: SubmissionStatus;
  submittedBy?: string;
  submittedAt?: string;
  principalApprovedBy?: string;
  principalApprovedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  revisionComments?: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  entity: string;
  entityId: string;
  schoolId?: string;
  timestamp: string;
  details?: string;
}

export interface DashboardFilters {
  regionalId: string; // 'ALL' or specific region ID
  schoolId: string;   // 'ALL' or specific school ID
  educationLevel: string; // 'ALL' or specific level
  academicYear: string;
  semester: Semester;
  dataFreshness: 'VERIFIED_ONLY' | 'ALL';
}
