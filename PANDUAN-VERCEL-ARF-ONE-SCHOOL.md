# Deployment — ARF One School

**Status:** Basis data Supabase untuk ARF One School sudah dibuat di proyek ARF Planner. Vercel New Project **belum dibuat** karena akun Vercel belum terhubung sebagai alat deployment pada sesi ini.

## 1. Buat repository GitHub terpisah

1. Buka GitHub akun `inrahman84`, buat repository baru bernama `arf-one-school`.
2. Ekstrak ZIP `ARF-One-School-Vercel-Supabase.zip`, unggah seluruh isinya ke root repository tersebut. Jangan mengunggah folder `node_modules` atau `.env.local`.
3. Pastikan root memiliki `package.json`, `vercel.json`, `index.html`, `src/`, `supabase/`.

## 2. Vercel — New Project

1. Buka https://vercel.com/new dan pilih Import Git Repository.
2. Pilih `inrahman84/arf-one-school` (repository baru, **bukan** repo ARF Planner).
3. Project Name: **arf-one-school**. Nama aplikasi dalam UI dan title browser: **ARF One School**.
4. Framework Preset: **Vite** (atau Other apabila Vite tidak tersedia).
5. Root Directory: `./`; Install Command: `npm install`; Build Command: `npm run build`; Output Directory: `dist`.
6. Environment Variables: **tidak wajib** untuk proyek Supabase saat ini karena project URL dan key publik sudah dipasang pada frontend. Jika migrasi Supabase berikutnya diperlukan, gunakan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` sebagai override.
7. Klik Deploy.

## 3. Supabase Authentication

1. Buka Supabase Dashboard → proyek **ARF Planner** → Authentication → URL Configuration.
2. Tambahkan URL hasil deployment Vercel ke Redirect URLs, misalnya `https://arf-one-school.vercel.app/**` **jika domain tersebut benar-benar menjadi milik proyek**. Jangan menggunakan contoh ini sebagai kepastian URL deployment.
3. Set Site URL dengan mempertimbangkan kedua aplikasi yang berbagi proyek Supabase. Jangan mengganti Site URL ARF Planner sembarangan; gunakan `Redirect URLs` untuk menambahkan domain ARF One School.
4. Untuk email magic link, pastikan Email provider aktif dan tersedia SMTP untuk email tujuan. Klik link verifikasi yang dikirim untuk masuk.
5. Tombol Google memerlukan Google OAuth provider diaktifkan di proyek Supabase. Jika belum, gunakan login email magic link.
6. Keanggotaan Super Admin awal dibuat untuk email administrator yang telah diketahui; pengguna lainnya masuk berdasarkan undangan admin. Tidak ada lagi login langsung tanpa autentikasi.

## 4. Uji setelah deployment

- Masuk menggunakan email yang mempunyai keanggotaan ARF One School.
- Buka Dashboard dan Daftar Sekolah.
- Tambah/Edit Sekolah, termasuk Desa/Kelurahan dan filter.
- Tambah Tahun Ajaran melalui Administrasi Sistem, lalu gunakan di filter Rombel & Peserta Didik.
- Edit data rombel dan guru, periksa setelah refresh.
- Tambah Aset dan Upload Gambar Aset; verifikasi thumbnail setelah refresh.
- Tambah Fasilitas dengan Upload Gambar Fisik, lalu centang Kebutuhan Perbaikan Fisik untuk menambah foto kerusakan.
- Coba hapus wilayah dengan sekolah terkait: harus ditolak.
- Coba login pengguna non-admin: akses harus mengikuti wilayah/sekolah yang ditentukan Super Admin.

## 5. Data lama Firebase

Tidak ada transfer data otomatis dari Firebase Firestore atau Firebase Storage. Jika ingin mempertahankan data lama, ekspor dari Firebase secara resmi, map field sesuai `src/types/index.ts`, impor ke Supabase, dan migrasikan foto ke bucket `arf-one-school` sambil mempertahankan ID relasional.

## 6. Apabila memakai Supabase project baru

File SQL `supabase/001_arf_one_school.sql` berisi migrasi skema. Jalankan **sekali** pada proyek baru yang benar-benar kosong, lalu ubah project URL dan publishable key melalui variabel Vercel. Jangan ulangi SQL ini pada proyek yang sudah diterapkan tanpa meninjau konflik nama constraint/trigger terlebih dahulu.
