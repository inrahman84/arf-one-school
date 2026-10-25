# ARF One School — Penghapusan Murid Arsip dan Salin Peserta Didik Antarperiode

**Rilis:** 25 Oktober 2026. **Aplikasi:** ARF One School. **Menu:** Sumber Daya → Data Peserta Didik; Manajemen Sekolah → Rombel & Peserta Didik.

## 1. Koreksi Hapus dan relasi rombel
Tombol **Hapus** pada daftar murid menjalankan soft archive agar riwayat mutasi, dokumen audit, dan data pribadi yang dilindungi tetap dipertahankan. Untuk murid yang diarsipkan, sistem mengisi `archived_at`, memindahkan referensi kelas ke `archived_class_id`, `archived_class_name`, dan `archived_grade_level`, serta mengosongkan `class_id` dan kolom kelas aktif.

Tombol Hapus Rombel hanya memblokir jika masih ada **murid yang belum diarsipkan** dengan `class_id` rombel tersebut. Rombel dengan murid aktif tidak boleh dihapus; pindahkan murid tersebut ke kelas lain atau lakukan tindakan administratif yang tepat.

Perbaikan historis melalui `supabase/005_unlink_archived_students.sql` telah diterapkan secara idempoten pada data produksi. Sebelum perbaikan ditemukan 1 murid arsip yang masih menyimpan `class_id`; setelah perbaikan tidak ada relasi kelas aktif pada murid arsip. Tidak ada record pribadi atau riwayat mutasi yang dihapus.

## 2. Rombel: Tahun Ajaran dan Semester
Formulir Tambah Rombel Baru menampilkan **Sekolah, Tahun Ajaran, Semester, Tingkat Kelas, Nama Rombel, Kapasitas, dan Wali Kelas**.
- Tahun Ajaran harus berasal dari Master Tahun Ajaran; tidak diwajibkan sama dengan tahun ajaran aktif apabila membuat rombel historis.
- Semester memilih Ganjil atau Genap.
- Ketika mengedit rombel yang telah disimpan, Sekolah, Tahun Ajaran, dan Semester dikunci untuk mencegah siswa kehilangan relasi historis. Buat rombel baru pada periode lain.
- Identitas rombel menggunakan UUID untuk menghindari kode yang bertabrakan antarperiode.
- Wali Kelas hanya dari PTK kategori Guru yang berstatus Aktif di sekolah yang sama.
- Angka peserta didik pada daftar/Executive Dashboard berasal dari register murid, bukan diinput ulang ke form rombel.

## 3. Penyalinan peserta didik ke tahun ajaran aktif
Di Sumber Daya → Data Peserta Didik tersedia **Salin / Naikkan Peserta Didik ke Periode Aktif**.
1. Pilih sekolah terlebih dahulu.
2. Pilih **Tahun Ajaran Asal** dan **Semester Asal**.
3. Tahun Ajaran Tujuan menggunakan **Tahun Ajaran aktif** pada Master. Semester tujuan dipilih Ganjil/Genap.
4. Skenario yang diizinkan: **tahun ajaran sebelumnya → tahun ajaran aktif**, atau **Ganjil → Genap pada tahun ajaran yang sama**. Periode tujuan tidak boleh sama/lebih awal.
5. Buat dahulu **Master Rombel tujuan** pada tahun dan semester yang tepat.
6. Tentukan **rombel tujuan per kelompok rombel asal**, lalu centang semua murid atau hanya murid tertentu. Untuk penempatan khusus, pilih rombel tujuan per murid. Pilihan kelas ditampilkan bersama Tingkat Kelas.
7. Periksa indikator jumlah dipilih, jumlah dipetakan, duplikasi identitas tujuan, dan potensi kelas melebihi Kapasitas.
8. Konfirmasi penempatan dan klik **Salin Peserta Didik**.
9. Periksa hasil pada Semester/Tahun Ajaran tujuan di Data Peserta Didik dan Rombel & Peserta Didik.

## 4. Integritas data dan otorisasi
- Salin membuat **dokumen peserta didik baru pada semester/tahun tujuan**, tanpa mengubah/menghapus record periode asal. Hubungan personal tersambung dengan `lineage_id`.
- Sumber yang sudah diarsipkan atau dinyatakan tidak aktif akibat peristiwa mutasi berlandaskan bukti **tidak dapat disalin**.
- Hanya Tahun Ajaran aktif dari Master yang boleh menjadi tujuan; rombel diverifikasi ulang melalui Master Rombel sekolah/semester.
- Identitas target konsisten berdasarkan NISN, NIPD, atau lineage untuk murid tanpa kedua nomor. Murid yang sudah ada pada tujuan **dilewati** dan tidak ditimpa; jika sudah ada data yang perlu diperbaiki, gunakan Edit pada semester tujuan.
- Pilihan **Salin juga data administrasi rinci** hanya untuk petugas dengan hak akses data pribadi (Super Admin, Kepala Sekolah, Operator). Opsi ini **tidak aktif secara default** dan tetap tunduk pada RLS `studentPrivate`. Operator harus meninjau ulang kondisi keluarga/bantuan/kesehatan tiap periode.
- Proses insert diselesaikan per batch 50 murid. Bila koneksi gagal setelah sebagian batch, ulangi penyalinan: data yang sudah ada dilewati. **Tidak ada transaksi atomik tunggal lintas seluruh batch** dan penyimpanan data pribadi dilakukan setelah penyimpanan register utama.
- Salin antarperiode **bukan peristiwa Pindahan Masuk, Pindah Keluar, atau DO**; angka mutasi tetap berdasarkan log peristiwa resmi dan referensi dokumen.
- Informasi murid, NISN/NIPD, keluarga, dan kesehatan tidak ditaruh di repository dan tidak ditampilkan dalam Executive Dashboard.

## 5. Pemeriksaan setelah penerbitan
- Sebagai operator berwenang, arsipkan satu data **uji**, lalu pastikan murid tidak lagi dihitung sebagai aktif dan rombel yang benar-benar kosong dapat dihapus.
- Coba copy satu murid dari Ganjil ke Genap, lalu ulangi copy untuk memverifikasi tidak terjadi duplikasi.
- Coba copy sekelompok murid ke Tahun Ajaran aktif dan tentukan rombel tujuan dengan tingkat berbeda. Pastikan jumlah murid pada rombel asal tidak berubah, sedangkan tujuan bertambah sesuai murid baru.
- Periksa bahwa murid pindah keluar atau DO tidak disalin sebagai murid aktif.
- Jika memilih menyalin data pribadi, verifikasi dengan akun berwenang pada formulir Edit, tanpa mengekspos NIK/KK/rekening ke dashboard.
