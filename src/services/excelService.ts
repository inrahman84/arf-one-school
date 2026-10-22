import * as XLSX from 'xlsx';
import { School, ClassroomEnrollment, Staff, Asset, Facility, Region } from '../types';

export interface ParseResult<T> {
  validRows: T[];
  invalidRows: { rowNumber: number; data: any; errors: string[] }[];
  duplicateCount: number;
}

export const excelService = {
  // Helper to trigger browser download
  downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  },

  // 1. Download official ARF templates
  downloadTemplate(module: 'SCHOOL' | 'ENROLLMENT' | 'HR' | 'ASSET' | 'FACILITY') {
    const wb = XLSX.utils.book_new();

    if (module === 'SCHOOL') {
      const templateData = [
        {
          'ID Sekolah (Wajib)': 'SCH-KTG-01',
          'NPSN': '30205812',
          'Nama Sekolah (Wajib)': 'SD ARF Bestari Sampit',
          'ID Regional (Wajib)': 'REG-KTG',
          'Jenjang (TPA/PAUD/TK/SD/SMP/SMK)': 'SD',
          'Alamat Sekolah': 'Jl. Tjilik Riwut Km 4.5',
          'Kecamatan': 'Baamang',
          'Kabupaten/Kota': 'Kotawaringin Timur',
          'Status Operasional (Aktif/Izin Operasional Baru/Menunggu Akreditasi/Nonaktif)': 'Aktif',
          'No Izin Operasional': '421.1/189/Disdik/2020',
          'Nilai Akreditasi (A/B/C/Belum Terakreditasi)': 'A',
          'Kapasitas Siswa Total': 400
        }
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      XLSX.utils.book_append_sheet(wb, ws, 'Template_Sekolah');
      this.downloadWorkbook(wb, 'ARF_Template_Profil_Sekolah.xlsx');
    } else if (module === 'ENROLLMENT') {
      const templateData = [
        {
          'ID Kelas (Wajib)': 'CLS-1A-2026',
          'ID Sekolah (Wajib)': 'SCH-KTG-01',
          'Tahun Ajaran (Wajib)': '2026/2027',
          'Semester (Ganjil/Genap)': 'Ganjil',
          'Tingkat Kelas': 'Kelas 1',
          'Nama Rombel (Wajib)': 'Kelas 1A Cendekia',
          'Kapasitas Rombel': 30,
          'Siswa Laki-laki': 15,
          'Siswa Perempuan': 14,
          'Siswa Masuk/Pindahan': 0,
          'Siswa Keluar': 0,
          'Siswa Drop Out': 0
        }
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      XLSX.utils.book_append_sheet(wb, ws, 'Template_Rombel');
      this.downloadWorkbook(wb, 'ARF_Template_Rombel_Siswa.xlsx');
    } else if (module === 'HR') {
      const templateData = [
        {
          'ID PTK (Wajib)': 'STF-001',
          'ID Sekolah (Wajib)': 'SCH-KTG-01',
          'Nama Lengkap (Wajib)': 'Ahmad Fauzi, S.Pd.',
          'Kategori PTK (Guru/Kepala Sekolah/Tenaga Kependidikan/Lainnya)': 'Guru',
          'Jabatan Utama': 'Guru Kelas',
          'Status Kepegawaian (Tetap/Kontrak/Honorer/Lainnya)': 'Tetap',
          'Status Aktif (Aktif/Cuti/Nonaktif/Berakhir)': 'Aktif',
          'Pendidikan Terakhir (SMA/SMK/D1/D2/D3/D4/S1/S2/S3/Lainnya)': 'D4/S1',
          'Jurusan Pendidikan': 'PGSD',
          'Sertifikasi Pendidik (Bersertifikat/Belum Bersertifikat/Tidak Berlaku)': 'Bersertifikat',
          'Mata Pelajaran': 'Tematik',
          'Beban Mengajar Mingguan (Jam)': 24,
          'Tugas Tambahan': 'Pembina Pramuka'
        }
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      XLSX.utils.book_append_sheet(wb, ws, 'Template_PTK');
      this.downloadWorkbook(wb, 'ARF_Template_Guru_PTK.xlsx');
    } else if (module === 'ASSET') {
      const templateData = [
        {
          'ID Aset (Wajib)': 'AST-001',
          'ID Sekolah (Wajib)': 'SCH-KTG-01',
          'Kode Barang': 'INV-LAP-01',
          'Nama Aset (Wajib)': 'Laptop Asus VivoBook Core i5',
          'Kategori (Furniture/Perangkat IT/Buku & Perpustakaan/Alat Permainan Edukatif/Laboratorium/Peralatan Pembelajaran/Peralatan Kantor/Peralatan Olahraga/Lainnya)': 'Perangkat IT',
          'Merk & Spesifikasi': 'RAM 16GB, SSD 512GB',
          'Jumlah Unit (Wajib)': 10,
          'Satuan': 'Unit',
          'Sumber Dana (BOS/BOP/ARF/Donasi/Lainnya)': 'ARF',
          'Tahun Pengadaan': 2025,
          'Harga Perolehan Satuan (Rp)': 8500000,
          'Kondisi (Baik/Rusak Ringan/Rusak Berat)': 'Baik',
          'Status Aset (Digunakan/Disimpan/Dalam Perbaikan/Dihapus)': 'Digunakan'
        }
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      XLSX.utils.book_append_sheet(wb, ws, 'Template_Aset');
      this.downloadWorkbook(wb, 'ARF_Template_Inventaris_Aset.xlsx');
    } else if (module === 'FACILITY') {
      const templateData = [
        {
          'ID Fasilitas (Wajib)': 'FAC-001',
          'ID Sekolah (Wajib)': 'SCH-KTG-01',
          'Tipe Fasilitas (Ruang Kelas/Perpustakaan/Laboratorium/Toilet/Ruang Guru/Ruang Kepala Sekolah/Kantor/Lapangan/Ruang UKS/Lainnya)': 'Ruang Kelas',
          'Nama Fasilitas (Wajib)': 'Ruang Kelas 1A',
          'Luas Bangunan (m2)': 64,
          'Kapasitas': 32,
          'Kondisi (Baik/Rusak Ringan/Rusak Sedang/Rusak Berat)': 'Baik',
          'Perlu Perbaikan (Ya/Tidak)': 'Tidak',
          'Prioritas Perbaikan (Kritis/Tinggi/Sedang/Rendah)': 'Rendah',
          'Estimasi Biaya Perbaikan (Rp)': 0,
          'Catatan': 'Lantai dan atap dalam kondisi kokoh'
        }
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      XLSX.utils.book_append_sheet(wb, ws, 'Template_Prasarana');
      this.downloadWorkbook(wb, 'ARF_Template_Prasarana_Fasilitas.xlsx');
    }
  },

  // 2. Parse uploaded spreadsheets
  async parseExcelFile(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  // Validate Classrooms
  validateClassRows(rawRows: any[], targetSchoolId: string): ParseResult<ClassroomEnrollment> {
    const validRows: ClassroomEnrollment[] = [];
    const invalidRows: { rowNumber: number; data: any; errors: string[] }[] = [];
    const seenIds = new Set<string>();
    let duplicateCount = 0;

    rawRows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const errors: string[] = [];

      const classId = String(row['ID Kelas (Wajib)'] || row['class_id'] || '').trim();
      const schoolId = String(row['ID Sekolah (Wajib)'] || row['school_id'] || targetSchoolId).trim();
      const academicYear = String(row['Tahun Ajaran (Wajib)'] || row['academic_year'] || '2026/2027').trim();
      const semester = (String(row['Semester (Ganjil/Genap)'] || row['semester'] || 'Ganjil').trim() === 'Genap') ? 'Genap' : 'Ganjil';
      const className = String(row['Nama Rombel (Wajib)'] || row['class_name'] || '').trim();
      const gradeLevel = String(row['Tingkat Kelas'] || row['grade_level'] || 'Kelas 1').trim();
      const capacity = Number(row['Kapasitas Rombel'] || row['class_capacity'] || 0);
      const male = Number(row['Siswa Laki-laki'] || row['male_students'] || 0);
      const female = Number(row['Siswa Perempuan'] || row['female_students'] || 0);

      if (!classId) errors.push('ID Kelas wajib diisi');
      if (!className) errors.push('Nama Rombel wajib diisi');
      if (capacity <= 0) errors.push('Kapasitas rombel harus lebih dari 0');
      if (male < 0 || isNaN(male)) errors.push('Jumlah siswa laki-laki harus angka non-negatif');
      if (female < 0 || isNaN(female)) errors.push('Jumlah siswa perempuan harus angka non-negatif');

      if (seenIds.has(classId)) {
        duplicateCount++;
        errors.push(`ID Kelas '${classId}' duplikat dalam file`);
      } else if (classId) {
        seenIds.add(classId);
      }

      if (errors.length > 0) {
        invalidRows.push({ rowNumber: rowNum, data: row, errors });
      } else {
        validRows.push({
          class_id: classId,
          school_id: schoolId,
          academic_year: academicYear,
          semester,
          grade_level: gradeLevel,
          class_name: className,
          class_capacity: capacity,
          male_students: male,
          female_students: female,
          transfer_in: Number(row['Siswa Masuk/Pindahan'] || row['transfer_in'] || 0),
          transfer_out: Number(row['Siswa Keluar'] || row['transfer_out'] || 0),
          dropout_students: Number(row['Siswa Drop Out'] || row['dropout_students'] || 0),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    });

    return { validRows, invalidRows, duplicateCount };
  },

  // Validate Staff
  validateStaffRows(rawRows: any[], targetSchoolId: string): ParseResult<Staff> {
    const validRows: Staff[] = [];
    const invalidRows: { rowNumber: number; data: any; errors: string[] }[] = [];
    const seenIds = new Set<string>();
    let duplicateCount = 0;

    rawRows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const errors: string[] = [];

      const staffId = String(row['ID PTK (Wajib)'] || row['staff_id'] || '').trim();
      const schoolId = String(row['ID Sekolah (Wajib)'] || row['school_id'] || targetSchoolId).trim();
      const staffName = String(row['Nama Lengkap (Wajib)'] || row['staff_name'] || '').trim();
      const category = (row['Kategori PTK (Guru/Kepala Sekolah/Tenaga Kependidikan/Lainnya)'] || row['staff_category'] || 'Guru').trim();
      const position = String(row['Jabatan Utama'] || row['primary_position'] || 'Guru').trim();
      const empType = (row['Status Kepegawaian (Tetap/Kontrak/Honorer/Lainnya)'] || row['employment_type'] || 'Tetap').trim();
      const empStatus = (row['Status Aktif (Aktif/Cuti/Nonaktif/Berakhir)'] || row['employment_status'] || 'Aktif').trim();
      const highestEdu = (row['Pendidikan Terakhir (SMA/SMK/D1/D2/D3/D4/S1/S2/S3/Lainnya)'] || row['highest_education'] || 'D4/S1').trim();
      const cert = (row['Sertifikasi Pendidik (Bersertifikat/Belum Bersertifikat/Tidak Berlaku)'] || row['teacher_certification'] || 'Belum Bersertifikat').trim();

      if (!staffId) errors.push('ID PTK wajib diisi');
      if (!staffName) errors.push('Nama PTK wajib diisi');

      if (seenIds.has(staffId)) {
        duplicateCount++;
        errors.push(`ID PTK '${staffId}' duplikat dalam file`);
      } else if (staffId) {
        seenIds.add(staffId);
      }

      if (errors.length > 0) {
        invalidRows.push({ rowNumber: rowNum, data: row, errors });
      } else {
        validRows.push({
          staff_id: staffId,
          school_id: schoolId,
          staff_name: staffName,
          staff_category: category as any,
          primary_position: position,
          employment_type: empType as any,
          employment_status: empStatus as any,
          highest_education: highestEdu as any,
          education_major: String(row['Jurusan Pendidikan'] || row['education_major'] || ''),
          teacher_certification: cert as any,
          teaching_subject: String(row['Mata Pelajaran'] || row['teaching_subject'] || ''),
          weekly_teaching_hours: Number(row['Beban Mengajar Mingguan (Jam)'] || row['weekly_teaching_hours'] || 0),
          additional_assignment: String(row['Tugas Tambahan'] || row['additional_assignment'] || ''),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    });

    return { validRows, invalidRows, duplicateCount };
  },

  // Validate Assets
  validateAssetRows(rawRows: any[], targetSchoolId: string): ParseResult<Asset> {
    const validRows: Asset[] = [];
    const invalidRows: { rowNumber: number; data: any; errors: string[] }[] = [];
    const seenIds = new Set<string>();
    let duplicateCount = 0;

    rawRows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const errors: string[] = [];

      const assetId = String(row['ID Aset (Wajib)'] || row['asset_id'] || '').trim();
      const schoolId = String(row['ID Sekolah (Wajib)'] || row['school_id'] || targetSchoolId).trim();
      const assetName = String(row['Nama Aset (Wajib)'] || row['asset_name'] || '').trim();
      const category = (row['Kategori (Furniture/Perangkat IT/Buku & Perpustakaan/Alat Permainan Edukatif/Laboratorium/Peralatan Pembelajaran/Peralatan Kantor/Peralatan Olahraga/Lainnya)'] || row['asset_category'] || 'Furniture').trim();
      const quantity = Number(row['Jumlah Unit (Wajib)'] || row['quantity'] || 0);
      const unit = String(row['Satuan'] || row['unit_measure'] || 'Unit').trim();
      const fundingSource = (row['Sumber Dana (BOS/BOP/ARF/Donasi/Lainnya)'] || row['funding_source'] || 'ARF').trim();
      const condition = (row['Kondisi (Baik/Rusak Ringan/Rusak Berat)'] || row['asset_condition'] || 'Baik').trim();
      const status = (row['Status Aset (Digunakan/Disimpan/Dalam Perbaikan/Dihapus)'] || row['asset_status'] || 'Digunakan').trim();
      const unitValue = Number(row['Harga Perolehan Satuan (Rp)'] || row['acquisition_unit_value'] || 0);

      if (!assetId) errors.push('ID Aset wajib diisi');
      if (!assetName) errors.push('Nama Aset wajib diisi');
      if (quantity <= 0) errors.push('Jumlah unit harus lebih dari 0');

      if (seenIds.has(assetId)) {
        duplicateCount++;
        errors.push(`ID Aset '${assetId}' duplikat dalam file`);
      } else if (assetId) {
        seenIds.add(assetId);
      }

      if (errors.length > 0) {
        invalidRows.push({ rowNumber: rowNum, data: row, errors });
      } else {
        validRows.push({
          asset_id: assetId,
          school_id: schoolId,
          asset_code: String(row['Kode Barang'] || row['asset_code'] || ''),
          asset_name: assetName,
          asset_category: category as any,
          asset_brand_spec: String(row['Merk & Spesifikasi'] || row['asset_brand_spec'] || ''),
          quantity,
          unit_measure: unit,
          funding_source: fundingSource as any,
          funding_year: Number(row['Tahun Pengadaan'] || row['funding_year'] || new Date().getFullYear()),
          acquisition_unit_value: unitValue,
          asset_condition: condition as any,
          asset_status: status as any,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    });

    return { validRows, invalidRows, duplicateCount };
  },

  // 3. Export data to Excel
  exportReport(filename: string, sheetName: string, data: any[]) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    this.downloadWorkbook(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
};
