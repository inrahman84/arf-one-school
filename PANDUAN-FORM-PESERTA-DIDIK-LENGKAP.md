# Formulir Lengkap Peserta Didik ARF One School

**Pembaruan:** 23 Oktober 2026 · **Lokasi:** Sumber Daya → Data Peserta Didik → Tambah/Edit.

## Struktur formulir

1. **Identitas dasar dan rombel:** nama peserta didik, NIPD, jenis kelamin, NISN, Tingkat Kelas dan Rombel Saat Ini/Kelas (diambil dari Master Rombel aktif).
2. **Identitas, tempat tinggal, kontak:** tempat/tanggal lahir, NIK, agama (Islam, Kristen, Katolik, Hindu, Buddha, Konghucu), alamat, RT/RW, dusun, kelurahan, kecamatan, kode pos, jenis tinggal, alat transportasi, telepon, HP, email, SKHUN.
3. **KPS:** Penerima KPS Ya/Tidak. No. KPS muncul ketika Ya.
4. **Keluarga:** Jenis Tinggal Bersama Orang Tua menampilkan Data Ayah dan Ibu. Wali, Kost, Asrama, Panti Asuhan, dan Lainnya menampilkan Data Wali. Masing-masing terdiri dari nama, tahun lahir, jenjang pendidikan, pekerjaan, pekerjaan lainnya, penghasilan, dan NIK. Pekerjaan Sudah Meninggal Dunia otomatis mengunci/mengosongkan penghasilan.
5. **Riwayat pendidikan & dokumen:** nomor peserta ujian nasional, seri ijazah, registrasi akta lahir, sekolah asal, anak ke-berapa, nomor KK.
6. **KIP/KKS/PIP:** Penerima KIP Ya/Tidak, nomor KIP, nama di KIP, nomor KKS, status PIP aktual, Layak PIP usulan, alasan layak PIP, bank, nomor rekening dan pemilik rekening.
7. **Kebutuhan khusus & kesehatan:** kategori kebutuhan khusus sesuai daftar yang diajukan, berat badan (kg), tinggi badan (cm), jumlah saudara kandung, jarak rumah ke sekolah (km), lingkar kepala (cm) hanya TPA/TK/SD.
8. **Titik koordinat rumah:** peta OpenStreetMap/Leaflet. Petugas memilih titik pada peta, baru Lintang dan Bujur diisi otomatis. Tidak menggunakan lokasi perangkat sebagai asumsi rumah siswa.

## Penjelasan aturan KIP dan PIP

Permintaan mencampurkan *Nama di KIP* dengan indikator numerik 1/0. Implementasi mempertahankan **Nama di KIP sebagai teks** dan menyediakan field terpisah **Indikator Penerima KIP** otomatis `1` ketika Ya dan `0` ketika Tidak. Data bank hanya dapat diisi bila `Penerima KIP=Ya` dan `Penerima Bantuan PIP (Aktual)=Ya`, mengikuti syarat penerimaan bantuan yang disebutkan.

## Penyimpanan dan keamanan

- Data dasar murid dan relasi `class_id` tetap di `schools/{schoolId}/students`, sehingga Rombel dan Executive Dashboard membaca data agregat tanpa informasi sensitif.
- Semua data rinci (termasuk NIK, nomor KK, agama, alamat, data keluarga, rekening bank, kondisi kesehatan, koordinat rumah) disimpan **terpisah** di `schools/{schoolId}/studentPrivate/{studentId}`.
- Supabase RLS tambahan `arf_student_private_guard` mempersempit akses data rinci kepada akun yang memiliki keanggotaan aktif dengan peran **SUPER_ADMIN, SCHOOL_PRINCIPAL, SCHOOL_OPERATOR**; pemeriksaan akses sekolah existing tetap berlaku. Akun FOUNDATION_MANAGER dapat membaca agregat tetapi tidak dapat membaca data privat dari endpoint.
- UI hanya menampilkan formulir privat untuk peran tersebut dan memerlukan konfirmasi kewenangan sebelum penyimpanan.
- Penyimpanan data dasar dan data privat adalah **dua operasi terpisah**: apabila operasi kedua gagal, pengguna mendapat error dan dapat mencoba kembali; data dasar mungkin sudah tersimpan. Ini bukan transaksi tunggal atomik.
- Data rinci murid tidak dimasukkan ke GitHub, tidak dipakai dalam infografis, dan tidak dicatat pada detail audit.
- Tidak ada pemindahan atau pengisian massal data sensitif dari Excel Dapodik secara otomatis; impor tetap hanya mengambil data minimum untuk register.
- Penyedia ubin peta eksternal dapat melihat permintaan lokasi area peta yang sedang ditampilkan. Pilih titik rumah hanya saat ada landasan pengelolaan data dan kewenangan yang memadai.

## Alur kerja operator

1. Pilih sekolah, Tahun Ajaran aktif, dan Semester.
2. Klik **Tambah Peserta Didik**, atau **Edit** untuk murid yang sudah ada.
3. Isi identitas dasar serta Tingkat Kelas dan Nama Rombel dari master.
4. Isi bidang rinci sesuai kondisi keluarga, KPS/KIP/PIP, kesehatan, dan titik rumah (jika tersedia).
5. Konfirmasi kewenangan pengolahan informasi pribadi.
6. Simpan, lalu periksa jumlah siswa laki-laki/perempuan pada menu Rombel & Peserta Didik.
7. **Impor Daftar Peserta Didik (Dapodik)** sekarang berada di bagian paling bawah halaman Data Peserta Didik.

Catatan: lakukan uji antarmuka oleh operator berwenang dengan data uji sebelum menerapkan untuk seluruh sekolah.

## Pembaruan Form Pop-up, Aksi Daftar, dan Wali Kelas (23 Oktober 2026)

- Tombol **Tambah Peserta Didik** dan **Edit** menampilkan formulir lengkap di **pop-up yang dapat di-scroll**, mendukung penutupan melalui tombol Tutup, Escape, atau klik area luar.
- **Sekolah** berupa dropdown dari **Manajemen Sekolah → Daftar Sekolah**, dibatasi pada sekolah yang dapat diakses akun. Saat **Tambah**, sekolah dapat dipilih dan opsi Tingkat Kelas/Nama Rombel diperbarui berdasarkan sekolah dan Tahun Ajaran/Semester. Saat **Edit**, sekolah dikunci untuk melindungi relasi dan riwayat; pindah sekolah ditangani melalui prosedur mutasi.
- Pada tabel **Daftar dan Pemetaan Rombel** di Sumber Daya → Data Peserta Didik, setiap murid mempunyai **Edit** dan, untuk petugas berwenang, **Hapus** dengan konfirmasi. Hapus berarti **soft archive**, tidak memusnahkan informasi privat atau log mutasi. Peserta didik yang diarsipkan dikeluarkan dari hitungan aktif dan tidak diaktifkan otomatis oleh impor ulang.
- Kontrol pemilihan file Dapodik kini memiliki tombol berwarna hijau gelap **Pilih File Excel Dapodik**, ikon Excel, dan status nama file terpilih.
- Formulir **Manajemen Sekolah → Rombel & Peserta Didik** hanya menampilkan lima isian: **Sekolah**, **Tingkat Kelas**, **Nama Rombel**, **Kapasitas Maksimal**, dan **Wali Kelas**. Wali Kelas berupa pilihan Guru berstatus Aktif dari sekolah yang dipilih, disimpan sebagai `homeroom_staff_id` dan nama untuk display.
- Total murid laki-laki, perempuan, mutasi dan DO **tidak dihapus dari data**. Semua tetap dihitung dari register murid dan log mutasi pada daftar, ringkasan serta dashboard; data lama/manual tetap kompatibel.
- Edit sekolah pada Master Rombel dinonaktifkan agar referensi murid di sekolah asal tidak rusak. Bila guru lama tidak aktif, pilih ulang Guru aktif atau biarkan Wali Kelas belum ditetapkan.
- Perubahan berlaku pada repository `inrahman84/arf-one-school` dan tidak mengubah `arfteamplanner`. Validasi browser dengan pengguna sekolah masih perlu dilakukan sebelum digunakan untuk seluruh sekolah.
