# ARF One School

**Abdul Rasyid Foundation — School Management & Performance Dashboard**  
Production application on Vercel + Supabase (PostgreSQL, Auth, Storage).

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

Aplikasi production: https://arf-one-school.vercel.app/. Repository GitHub `inrahman84/arf-one-school` telah terhubung ke proyek Vercel `arf-one-school`. Baca `PANDUAN-VERCEL-ARF-ONE-SCHOOL.md` untuk panduan konfigurasi Auth, Environment Variables, dan checklist pengujian.

## Keamanan

- Akun harus memiliki **sesi Supabase Auth nyata**, diverifikasi, dan row aktif di `arf_school_members`.
- Admin awal yang sudah terdaftar di Supabase diberikan keanggotaan Super Admin khusus ARF One School; email akun telah ditetapkan sesuai konfigurasi proyek asal.
- Admin dapat menambah undangan melalui menu Manajemen Pengguna. Pengguna lain perlu masuk melalui email terverifikasi; keanggotaan dibuat dari undangan.
- Supabase RLS membatasi akses data sesuai role, sekolah, dan wilayah.
- Bucket foto **tidak publik**; URL foto merupakan signed URL sementara yang diperbarui saat pengambilan data.
- Tombol Inisialisasi Data Contoh tidak ditampilkan pada build produksi.

## Pengujian

`npm test` menjalankan pengujian struktur source code dan konfigurasi backend. Validasi koneksi Supabase dan RLS sudah dilakukan di lingkungan Supabase. Build Vite, pemeriksaan TypeScript dan tes regresi dijalankan otomatis oleh GitHub Actions pada setiap push. Pengujian interaksi langsung dengan akun nyata melalui browser tetap perlu dilakukan.

## Pembaruan Antarmuka dan Master Sekolah — Oktober 2026

- Antarmuka menyesuaikan smartphone, tablet dan komputer: navigasi drawer pada layar kecil, form modal adaptif, tabel dapat digeser horizontal.
- Status operasional yang tersedia untuk input baru: **Aktif Memiliki Izin Operasional**, **Aktif Tidak Memiliki Izin Operasional**, dan **Tidak Aktif**. Status lama tetap terbaca; tidak dipetakan otomatis ke status perizinan baru.
- Nama Kepala Sekolah pada formulir Tambah/Edit berasal dari pilihan Guru/Kepala Sekolah aktif di **sekolah yang sama**. Tersimpan sebagai pasangan ID PTK dan nama; sekolah tetap dapat dibuat sebelum PTK dimasukkan.
- Panduan terperinci: [UPDATE-RESPONSIVE-STATUS-PTK.md](./UPDATE-RESPONSIVE-STATUS-PTK.md).

## Rilis Form Inventaris Terbaru (23 Oktober 2026)

Versi sumber yang siap diterbitkan memuat perbaikan formulir inventaris: label School ID, penghilangan teks bantuan yang diminta, nomor polisi TNBK khusus kategori KND Kendaraan, dan penyempurnaan Model/Tipe serta Spesifikasi Singkat. Pengujian build GitHub Actions untuk commit sumber `558db428` telah lulus. Catatan ini memicu ulang integrasi GitHub ke proyek Vercel `arf-one-school` untuk mencoba penerbitan production; status akhir deployment wajib diperiksa dari status Vercel, karena batas frekuensi deployment dapat menolak permintaan.
