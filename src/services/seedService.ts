import { regionsService } from './regionsService';
import { schoolsService } from './schoolsService';
import { enrollmentService } from './enrollmentService';
import { hrService } from './hrService';
import { assetsService } from './assetsService';
import { facilitiesService } from './facilitiesService';
import { verificationService } from './verificationService';
import { auditService } from './auditService';
import { authService, BOOTSTRAP_ADMIN_EMAIL } from './authService';

export const seedService = {
  async bootstrapInstitutionalData(): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Regions
      await regionsService.saveRegion({
        id: 'REG-KTG',
        name: 'Regional Kalimantan Tengah',
        code: 'KTG',
        description: 'Wilayah operasional Kotawaringin Timur & Kotawaringin Barat',
        status: 'active'
      });
      await regionsService.saveRegion({
        id: 'REG-KB',
        name: 'Regional Kalimantan Barat',
        code: 'KB',
        description: 'Wilayah operasional Ketapang & sekitarnya',
        status: 'active'
      });
      await regionsService.saveRegion({
        id: 'REG-JB',
        name: 'Regional Jawa Barat',
        code: 'JB',
        description: 'Pusat riset & pelatihan guru ARF Bogor',
        status: 'active'
      });

      // 2. Schools
      const school1 = {
        school_id: 'SCH-KTG-01',
        npsn: '30205812',
        school_name: 'SD ARF Bestari Sampit',
        regional_id: 'REG-KTG',
        education_level: 'SD' as const,
        school_address: 'Jl. Tjilik Riwut Km 4.5, Baamang',
        district: 'Baamang',
        regency: 'Kotawaringin Timur',
        operational_status: 'Aktif' as const,
        operational_license: '421.1/189/Disdik/2020',
        accreditation_grade: 'A' as const,
        accreditation_expiry: '2028-11-20',
        school_capacity: 360,
        principal_staff_id: 'STF-001',
        principal_name: 'Drs. H. Mulyadi, M.Pd.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await schoolsService.saveSchool(school1);

      const school2 = {
        school_id: 'SCH-KTG-02',
        npsn: '30209421',
        school_name: 'SMP ARF Cendekia Pangkalan Bun',
        regional_id: 'REG-KTG',
        education_level: 'SMP' as const,
        school_address: 'Jl. Pangeran Antasari No. 12',
        district: 'Arut Selatan',
        regency: 'Kotawaringin Barat',
        operational_status: 'Aktif' as const,
        operational_license: '421.2/340/Disdik/2021',
        accreditation_grade: 'A' as const,
        accreditation_expiry: '2029-05-15',
        school_capacity: 450,
        principal_staff_id: 'STF-010',
        principal_name: 'Siti Rahmawati, M.Pd.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await schoolsService.saveSchool(school2);

      const school3 = {
        school_id: 'SCH-KB-01',
        npsn: '30211045',
        school_name: 'SMK ARF Teknologi Ketapang',
        regional_id: 'REG-KB',
        education_level: 'SMK' as const,
        school_address: 'Jl. Ketapang - Sukadana Km 8',
        district: 'Delta Pawan',
        regency: 'Ketapang',
        operational_status: 'Aktif' as const,
        operational_license: '421.5/512/Disdik/2022',
        accreditation_grade: 'B' as const,
        accreditation_expiry: '2027-10-30',
        school_capacity: 300,
        principal_staff_id: 'STF-020',
        principal_name: 'Ir. Bambang Wijaya, M.T.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await schoolsService.saveSchool(school3);

      const school4 = {
        school_id: 'SCH-KTG-03',
        npsn: '69921408',
        school_name: 'TK ARF Ceria Sampit',
        regional_id: 'REG-KTG',
        education_level: 'TK' as const,
        school_address: 'Jl. Ahmad Yani No. 44',
        district: 'Mentawa Baru Ketapang',
        regency: 'Kotawaringin Timur',
        operational_status: 'Aktif' as const,
        operational_license: '421.0/045/Disdik/2023',
        accreditation_grade: 'A' as const,
        accreditation_expiry: '2028-08-12',
        school_capacity: 120,
        principal_staff_id: 'STF-030',
        principal_name: 'Nurul Hidayati, S.Pd.AUD',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await schoolsService.saveSchool(school4);

      // 3. Classes for SD ARF Bestari Sampit
      await enrollmentService.saveClass({
        class_id: 'CLS-SD1A',
        school_id: 'SCH-KTG-01',
        academic_year: '2026/2027',
        semester: 'Ganjil',
        grade_level: 'Kelas 1',
        class_name: 'Kelas 1A Ibnu Sina',
        class_capacity: 28,
        male_students: 14,
        female_students: 13,
        transfer_in: 0,
        transfer_out: 0,
        dropout_students: 0
      });

      await enrollmentService.saveClass({
        class_id: 'CLS-SD1B',
        school_id: 'SCH-KTG-01',
        academic_year: '2026/2027',
        semester: 'Ganjil',
        grade_level: 'Kelas 1',
        class_name: 'Kelas 1B Al-Khawarizmi',
        class_capacity: 28,
        male_students: 15,
        female_students: 15, // Overcapacity warning! 30 > 28
        transfer_in: 1,
        transfer_out: 0,
        dropout_students: 0
      });

      await enrollmentService.saveClass({
        class_id: 'CLS-SD2A',
        school_id: 'SCH-KTG-01',
        academic_year: '2026/2027',
        semester: 'Ganjil',
        grade_level: 'Kelas 2',
        class_name: 'Kelas 2A Al-Biruni',
        class_capacity: 30,
        male_students: 14,
        female_students: 14,
        transfer_in: 0,
        transfer_out: 0,
        dropout_students: 0
      });

      // Classes for SMP ARF Cendekia Pangkalan Bun
      await enrollmentService.saveClass({
        class_id: 'CLS-SMP7A',
        school_id: 'SCH-KTG-02',
        academic_year: '2026/2027',
        semester: 'Ganjil',
        grade_level: 'Kelas 7',
        class_name: 'Kelas 7A Sains Unggul',
        class_capacity: 32,
        male_students: 16,
        female_students: 16,
        transfer_in: 0,
        transfer_out: 0,
        dropout_students: 0
      });

      await enrollmentService.saveClass({
        class_id: 'CLS-SMP7B',
        school_id: 'SCH-KTG-02',
        academic_year: '2026/2027',
        semester: 'Ganjil',
        grade_level: 'Kelas 7',
        class_name: 'Kelas 7B Humaniora',
        class_capacity: 32,
        male_students: 15,
        female_students: 16,
        transfer_in: 0,
        transfer_out: 0,
        dropout_students: 0
      });

      // 4. Staff
      await hrService.saveStaff({
        staff_id: 'STF-001',
        school_id: 'SCH-KTG-01',
        staff_name: 'Drs. H. Mulyadi, M.Pd.',
        staff_category: 'Kepala Sekolah',
        primary_position: 'Kepala Sekolah',
        employment_type: 'Tetap',
        employment_status: 'Aktif',
        highest_education: 'S2',
        education_major: 'Manajemen Pendidikan',
        teacher_certification: 'Bersertifikat',
        weekly_teaching_hours: 6
      });

      await hrService.saveStaff({
        staff_id: 'STF-002',
        school_id: 'SCH-KTG-01',
        staff_name: 'Dewi Lestari, S.Pd.',
        staff_category: 'Guru',
        primary_position: 'Guru Kelas 1A',
        employment_type: 'Tetap',
        employment_status: 'Aktif',
        highest_education: 'D4/S1',
        education_major: 'Pendidikan Guru Sekolah Dasar',
        teacher_certification: 'Bersertifikat',
        teaching_subject: 'Tematik & Literasi',
        weekly_teaching_hours: 24
      });

      await hrService.saveStaff({
        staff_id: 'STF-003',
        school_id: 'SCH-KTG-01',
        staff_name: 'Rian Pratama, S.Kom.',
        staff_category: 'Tenaga Kependidikan',
        primary_position: 'Operator Dapodik & IT',
        employment_type: 'Kontrak',
        employment_status: 'Aktif',
        highest_education: 'D4/S1',
        education_major: 'Teknik Informatika',
        teacher_certification: 'Tidak Berlaku',
        weekly_teaching_hours: 0
      });

      await hrService.saveStaff({
        staff_id: 'STF-010',
        school_id: 'SCH-KTG-02',
        staff_name: 'Siti Rahmawati, M.Pd.',
        staff_category: 'Kepala Sekolah',
        primary_position: 'Kepala Sekolah',
        employment_type: 'Tetap',
        employment_status: 'Aktif',
        highest_education: 'S2',
        education_major: 'Pendidikan Matematika',
        teacher_certification: 'Bersertifikat',
        weekly_teaching_hours: 6
      });

      await hrService.saveStaff({
        staff_id: 'STF-011',
        school_id: 'SCH-KTG-02',
        staff_name: 'Budi Santoso, S.Si.',
        staff_category: 'Guru',
        primary_position: 'Guru IPA & Biologi',
        employment_type: 'Tetap',
        employment_status: 'Aktif',
        highest_education: 'D4/S1',
        education_major: 'Biologi Murni',
        teacher_certification: 'Belum Bersertifikat',
        teaching_subject: 'Ilmu Pengetahuan Alam',
        weekly_teaching_hours: 28
      });

      // 5. Assets
      await assetsService.saveAsset({
        asset_id: 'AST-SD-001',
        school_id: 'SCH-KTG-01',
        asset_code: 'ARF/SD/IT/01',
        asset_name: 'Chromebook Acer 311 Edu',
        asset_category: 'Perangkat IT',
        asset_brand_spec: 'Intel Celeron N4020, 4GB RAM, ChromeOS',
        quantity: 25,
        unit_measure: 'Unit',
        funding_source: 'ARF',
        funding_year: 2025,
        acquisition_unit_value: 4800000,
        asset_condition: 'Baik',
        asset_status: 'Digunakan'
      });

      await assetsService.saveAsset({
        asset_id: 'AST-SD-002',
        school_id: 'SCH-KTG-01',
        asset_code: 'ARF/SD/FURN/02',
        asset_name: 'Meja & Kursi Siswa Ergonomis',
        asset_category: 'Furniture',
        asset_brand_spec: 'Bahan Kayu Solid & Rangka Besi Powder Coating',
        quantity: 120,
        unit_measure: 'Set',
        funding_source: 'ARF',
        funding_year: 2024,
        acquisition_unit_value: 650000,
        asset_condition: 'Baik',
        asset_status: 'Digunakan'
      });

      await assetsService.saveAsset({
        asset_id: 'AST-SD-003',
        school_id: 'SCH-KTG-01',
        asset_code: 'ARF/SD/IT/03',
        asset_name: 'Proyektor Epson EB-X51',
        asset_category: 'Perangkat IT',
        asset_brand_spec: '3800 Lumens XGA 3LCD',
        quantity: 4,
        unit_measure: 'Unit',
        funding_source: 'BOS',
        funding_year: 2023,
        acquisition_unit_value: 6200000,
        asset_condition: 'Rusak Ringan',
        asset_status: 'Dalam Perbaikan'
      });

      await assetsService.saveAsset({
        asset_id: 'AST-SMP-001',
        school_id: 'SCH-KTG-02',
        asset_code: 'ARF/SMP/LAB/01',
        asset_name: 'Mikroskop Binokuler Optika B-150',
        asset_category: 'Laboratorium',
        asset_brand_spec: 'Perbesaran 1000x LED White Light',
        quantity: 12,
        unit_measure: 'Unit',
        funding_source: 'ARF',
        funding_year: 2025,
        acquisition_unit_value: 3900000,
        asset_condition: 'Baik',
        asset_status: 'Digunakan'
      });

      // 6. Facilities
      await facilitiesService.saveFacility({
        facility_id: 'FAC-SD-001',
        school_id: 'SCH-KTG-01',
        facility_type: 'Ruang Kelas',
        facility_name: 'Gedung A - Ruang Kelas 1A & 1B',
        facility_area_m2: 128,
        facility_capacity: 60,
        facility_condition: 'Baik',
        facility_availability: 'Tersedia Penuh',
        facility_utilization: 'Maksimal',
        repair_required: false,
        repair_priority: 'Rendah',
        estimated_repair_cost: 0,
        notes: 'Pencahayaan alami dan ventilasi sangat memadai'
      });

      await facilitiesService.saveFacility({
        facility_id: 'FAC-SD-002',
        school_id: 'SCH-KTG-01',
        facility_type: 'Toilet',
        facility_name: 'Toilet Siswa Lantai 1',
        facility_area_m2: 24,
        facility_capacity: 6,
        facility_condition: 'Rusak Sedang',
        repair_required: true,
        repair_priority: 'Tinggi',
        estimated_repair_cost: 4500000,
        notes: 'Perbaikan kran air otomatis dan pipa saluran pembuangan'
      });

      await facilitiesService.saveFacility({
        facility_id: 'FAC-SD-003',
        school_id: 'SCH-KTG-01',
        facility_type: 'Perpustakaan',
        facility_name: 'Perpustakaan Ramah Anak Ki Hajar Dewantara',
        facility_area_m2: 96,
        facility_capacity: 45,
        facility_condition: 'Baik',
        repair_required: false,
        repair_priority: 'Rendah',
        estimated_repair_cost: 0,
        notes: 'Koleksi 2.400 judul buku dan pojok baca digital'
      });

      // 7. Submission Reviews
      await verificationService.submitForReview('SCH-KTG-01', 'ENROLLMENT', '2026/2027', 'Ganjil');
      const reviewDocId = 'SCH-KTG-01_ENROLLMENT_2026-2027_Ganjil';
      await verificationService.approveByPrincipal(reviewDocId, 'SCH-KTG-01');
      await verificationService.verifySubmission(reviewDocId, 'SCH-KTG-01');

      await verificationService.submitForReview('SCH-KTG-01', 'HR', '2026/2027', 'Ganjil');
      const hrReviewDocId = 'SCH-KTG-01_HR_2026-2027_Ganjil';
      await verificationService.approveByPrincipal(hrReviewDocId, 'SCH-KTG-01');
      await verificationService.verifySubmission(hrReviewDocId, 'SCH-KTG-01');

      await auditService.log('BOOTSTRAP_INITIAL_DATA', 'System', 'ALL', undefined, 'Inisialisasi data institusional ARF Wave 1 selesai');

      return { success: true, message: 'Data institusional ARF berhasil dimuat ke Supabase!' };
    } catch (error) {
      console.error('Error during data bootstrap:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Gagal menginisialisasi data' };
    }
  }
};
