# ARF One School — Pendaftaran, Akun, Password dan Hapus Pengguna

**Pembaruan:** 25 Oktober 2026. **Layanan:** Supabase Auth + `public.arf_school_members` + Edge Function `arf-manage-users`.

## A. Daftar Email Pengguna (pendaftaran mandiri)
1. Pengguna memilih **Daftar Email Pengguna**, mengisi nama lengkap, email, dan kata sandi minimal 10 karakter (ketentuan Supabase).
2. Supabase Auth membuat identitas pengguna. Trigger database `arf_internal.add_arf_school_member` membuat profil **SCHOOL_OPERATOR (Operator Sekolah), ACTIVE** dengan `assigned_schools=[]` dan `assigned_regions=[]`.
3. Bila verifikasi email diwajibkan di Supabase, pengguna harus menyelesaikannya sebelum login.
4. Pengguna dapat login dengan email dan kata sandinya. **Belum dapat mengakses data sekolah mana pun** hingga Super Admin memberikan penugasan. Peran awal boleh diubah melalui Manajemen Pengguna & Otorisasi.
5. Metadata yang dikirim pengguna saat signup (misalnya `user_metadata.role`) **tidak menentukan peran**: trigger menetapkan operator untuk mencegah eskalasi hak akses.

## B. Tambah Pengguna Baru oleh Super Admin
1. Masuk sebagai **Super Admin** dan buka **Manajemen Pengguna & Otorisasi → Tambah Pengguna Baru**.
2. Isi nama, email, jabatan, peran, sekolah dan/atau regional yang ditugaskan, **Buat Sandi Pengguna**, serta konfirmasi sandi.
3. Klik **Simpan & Otorisasi Pengguna**.
4. Aplikasi menggunakan Edge Function `arf-manage-users` yang memverifikasi JWT melalui Supabase Auth **dan** memastikan role aktif `SUPER_ADMIN` pada database. Ia membuat akun nyata pada **Supabase Auth** dengan `email_confirm=true`, kemudian menyimpan profil peran/lingkup ARF berstatus ACTIVE.
5. Sandi admin-create minimal 12 karakter berisi huruf dan angka. Serahkan sandi kepada pemilik akun melalui saluran aman; **jangan gunakan komentar publik, spreadsheet bersama, atau chat grup**.
6. Pengguna login ke `https://arf-one-school.vercel.app/` menggunakan email dan sandi tersebut.

**Jika email telah memiliki akun Auth di proyek Supabase yang sama:** edge function **tidak mengubah sandi akun existing**, karena layanan Auth mungkin juga dipakai oleh aplikasi lain. Jika email belum memiliki keanggotaan ARF, Super Admin dapat menambahkan profil dan penugasan ARF-nya; pengguna masuk menggunakan sandi existing. Jika perlu mengganti sandi, buka menu Edit dan lakukan reset yang **berlaku untuk identitas Supabase Auth bersama**.

## C. Edit Pengguna, Buat / Reset Sandi
1. Klik **Edit** pada baris pengguna.
2. Perbaiki peran, status, sekolah/regional, atau jabatan sesuai tugasnya.
3. Pada **Buat / Reset Sandi Pengguna**, isi sandi baru dan konfirmasi jika diperlukan. Biarkan kosong untuk mempertahankan sandi lama.
4. Simpan. Sandi tidak pernah disimpan di `arf_school_members`, tidak ditampilkan pada daftar pengguna, dan hanya dikirim ke Edge Function untuk memanggil `auth.admin.updateUserById`.
5. Super Admin tidak dapat mereset sandi sendiri dari fitur administratif ini; lakukan melalui proses pemulihan akun yang sah. Sandi baru harus disampaikan secara aman, dan pengguna dianjurkan menggantinya setelah masuk.

## D. Hapus Pengguna
- Tombol **Hapus Pengguna** meminta konfirmasi kemudian mencabut keanggotaan **ARF One School** dengan `status='INACTIVE'`, `deleted_at`, dan mengosongkan assignment sekolah/regional. Pengguna hilang dari daftar aktif ARF.
- **Tidak menghapus entri `auth.users`**, karena Supabase Auth juga dapat dipakai aplikasi lain. Keanggotaan ARF yang dihapus tidak dapat diaktifkan kembali dengan sekadar mengubah status, sesuai constraint database.
- Super Admin aktif terakhir, akun bootstrap, dan akun sendiri terlindung dari tindakan hapus yang tidak sengaja.
- Pengaturan peran/status anggota tidak lagi boleh diubah lewat UPDATE langsung dari browser; hanya Edge Function dengan pengecekan admin yang dapat memperbaruinya.

## E. Pengujian operasional
- Daftarkan **akun email uji yang memang Anda miliki** melalui halaman login. Setelah konfirmasi email, periksa status Operator Sekolah dengan nol assignment; setelah Super Admin memilih satu sekolah, pastikan hanya sekolah tersebut yang terbuka.
- Dengan akun Super Admin, buat akun uji baru **menggunakan email yang dapat diakses** dan sandi uji. Coba login dengan sandi itu; verifikasi scope sekolah dan regional.
- Reset sandi melalui Edit dan uji login dengan sandi baru. Jangan mencoba akun produksi milik orang lain.
- Hapus keanggotaan akun uji ARF. Akun tidak lagi bisa mengakses ARF, tetapi proyek `arfteamplanner` dan akun di aplikasi lain tidak diubah.
- Verifikasi kembali jumlah anggota dan kebijakan RLS setelah pengujian. Tidak ada akun staf nyata yang diubah otomatis saat penerapan pembaruan ini.

**Batasan:** GitHub Actions dan Vercel memeriksa build, TS, dan tes otomatis; alur login dengan akun sekolah sungguhan tetap harus diuji langsung oleh operator/superadmin setelah deployment.
