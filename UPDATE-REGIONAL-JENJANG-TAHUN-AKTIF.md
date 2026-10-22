# Update ARF One School — Regional, Jenjang, dan Tahun Ajaran Aktif

## Jenjang pendidikan
Daftar untuk pengisian data baru: **TPA, KB, TK, SD, SMP, SMA, SMK**. Rekaman lama dengan jenjang PAUD **tidak dihapus atau otomatis dikonversi**; pada mode Edit harus dipilih jenjang baru sebelum menyimpan.

## Manajemen Wilayah
- Label formulir kini: **Regional** dan **Cakupan**.
- Super Admin dapat menyeret kartu untuk menyusun urutan, atau memakai tombol panah ke atas/bawah.
- Urutan disimpan melalui atribut `sortOrder` ke koleksi `regions` di Supabase.
- Wilayah lama tanpa `sortOrder` tetap dibaca, dan wilayah baru ditempatkan terakhir.

## Master Tahun Ajaran
- Super Admin menambahkan tahun ajaran dulu, lalu menekan **Aktifkan**.
- Satu dokumen khusus `academicYears/_active` menyimpan nilai `activeYear`, sehingga hanya satu tahun ajaran yang menjadi acuan pengisian data baru.
- Tahun ajaran aktif ditampilkan dengan lencana **AKTIF** dan tidak bisa dihapus.
- Tahun historis tetap tersedia untuk dilihat; edit data rombel historis tetap diizinkan.
- Form **Tambah Rombel** menggunakan tahun ajaran aktif, bukan tahun yang kebetulan dipilih di filter.
- Dashboard dan Laporan menggunakan tahun aktif sebagai pilihan default.
- Template dan impor Excel Rombel memakai dan memvalidasi periode aktif.

## Penggunaan pertama kali
1. Login sebagai Super Admin.
2. Buka **Administrasi Sistem → Master Tahun Ajaran**.
3. Tambahkan tahun ajaran (misalnya `2026/2027`), jika belum ada.
4. Klik **Aktifkan**.
5. Buka **Rombel & Peserta Didik** dan tambah rombel: tahun ajaran aktif akan terisi otomatis.

## Kompatibilitas dan kendali perubahan
- Tidak perlu migrasi SQL atau perubahan RLS: urutan regional disimpan pada JSONB dokumen wilayah, dan penanda tahun aktif menggunakan koleksi akademik yang sudah ada.
- Pengurutan wilayah saat ini ditulis per dokumen: apabila koneksi terputus di tengah proses, administrator dapat menyusun kembali kartu untuk menyamakan urutan.
- Perubahan hanya pada repository `inrahman84/arf-one-school`, tidak pada `arfteamplanner`.
