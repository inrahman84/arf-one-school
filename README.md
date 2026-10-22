# ARF One School

**Abdul Rasyid Foundation — School Management & Performance Dashboard**  
Migration build for Vercel + Supabase (PostgreSQL, Auth, Storage).

This source code is derived from the latest uploaded ARF Dashboard V1.1 photo-upload version. It keeps the original school-management screens and moves persistence from Firebase to the user's connected Supabase project.

## Teknologi

- React + TypeScript + Vite + Tailwind CSS 4
- Supabase Auth (Google OAuth when enabled; verified email magic-link alternative)
- Supabase PostgreSQL with tenant-aware Row Level Security
- Supabase private Storage bucket for school asset and facility photos
- Vercel static SPA hosting

## Supabase yang digunakan

Aplikasi terhubung ke proyek Supabase pengguna yang sudah ada bernama **ARF Planner**. ARF One School memakai **tabel khusus** `arf_school_documents` dan `arf_school_members`, serta **bucket privat** `arf-one-school`. Struktur tabel dan Storage ini sudah diterapkan melalui migrasi Supabase dalam sesi pembuatan artefak.

> **PENTING:** Ini bukan proyek Supabase baru. Penggunaan proyek bersama menghemat setup, tetapi batas kuota dan infrastruktur tetap berbagi dengan ARF Planner. Untuk memisahkan proyek di kemudian hari, buat proyek Supabase sendiri, jalankan migrasi pada folder `supabase/`, lalu atur variabel Vercel.

> **PENTING:** Data lama di Cloud Firestore **tidak otomatis pindah**. Belum dilakukan impor data asli atau file foto dari Firebase Storage. Aplikasi berawal dari koleksi ARF One School yang kosong dan dapat diisi lewat UI atau impor Excel.

## Menjalankan lokal

```bash
npm install
npm run dev
npm run build
npm test
```

Aplikasi menggunakan konfigurasi publishable URL/key Supabase yang sudah disertakan di `src/lib/supabase.ts`. Keduanya aman berada di frontend **asalkan RLS aktif**. Jangan meletakkan `service_role`/secret key di kode browser.

Jika ingin menggunakan proyek Supabase berbeda, tambahkan `.env.local`:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

## Deployment Vercel

Baca `PANDUAN-VERCEL-ARF-ONE-SCHOOL.md` untuk petunjuk impor source code, konfigurasi Vercel, URL Auth, dan checklist pengujian. ZIP ini dapat langsung digunakan sebagai source repository GitHub baru. Deploy Vercel belum dilakukan secara otomatis karena koneksi Vercel belum aktif dalam sesi ini.

## Keamanan

- Akun harus memiliki **sesi Supabase Auth nyata**, diverifikasi, dan row aktif di `arf_school_members`.
- Admin awal yang sudah terdaftar di Supabase diberikan keanggotaan Super Admin khusus ARF One School; email akun telah ditetapkan sesuai konfigurasi proyek asal.
- Admin dapat menambah undangan melalui menu Manajemen Pengguna. Pengguna lain perlu masuk melalui email terverifikasi; keanggotaan dibuat dari undangan.
- Supabase RLS membatasi akses data sesuai role, sekolah, dan wilayah.
- Bucket foto **tidak publik**; URL foto merupakan signed URL sementara yang diperbarui saat pengambilan data.
- Tombol Inisialisasi Data Contoh tidak ditampilkan pada build produksi.

## Pengujian

`npm test` menjalankan pengujian struktur source code dan konfigurasi backend. Validasi koneksi Supabase dan RLS sudah dilakukan di lingkungan Supabase. **Build frontend penuh dan uji browser di Vercel belum dijalankan** karena registri paket npm tidak dapat diakses dari lingkungan pembuatan ZIP.
