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

## Proyek Supabase wajib terpisah

**ARF One School wajib memiliki project Supabase tersendiri.** Proyek **ARF Workspace / ARF Planner** tidak boleh digunakan untuk Auth, tabel, Storage, atau Edge Functions aplikasi ini.

Riwayat implementasi awal ternyata masih menggunakan project shared (ref `ovfygxeqgpjezdhbidmo`). Koneksi tersebut sudah tidak sesuai mandat pemisahan; **jangan gunakan untuk membuat akun atau mengolah data One School**. Branch pemisahan `fix/one-school-auth-isolation-and-invites` menolak konfigurasi kosong, ref salah, dan ref shared tersebut, tetapi **belum dapat diaktifkan di production sebelum proyek dedicated tersedia dan datanya disiapkan**.

Tiga environment variable **wajib** untuk build ARF One School di Vercel:

```env
VITE_SUPABASE_URL=https://REF_PROYEK_ARF_ONE_SCHOOL.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=KUNCI_PUBLISHABLE_PROYEK_ARF_ONE_SCHOOL
VITE_ARF_ONE_SCHOOL_SUPABASE_REF=REF_PROYEK_ARF_ONE_SCHOOL
```

Ketiganya harus berasal dari project Supabase khusus One School. URL, publishable key, JWT user, dan Auth `auth.users` dari proyek lain **tidak kompatibel**.

Untuk database baru: audit dan jalankan migrasi `supabase/001` sampai `009` **pada proyek ARF One School saja**, buat Storage bucket/Policies untuk foto, lalu deploy Edge Function `arf-manage-users` **ke proyek yang sama**. Edge Function memerlukan secret `ARF_ONE_SCHOOL_SUPABASE_REF` sama dengan project ref dan `ARF_ONE_SCHOOL_SITE_URL=https://arf-one-school.vercel.app`. Service-role key harus berada hanya di backend Supabase (tersedia melalui environment runtime proyek), bukan pada Vercel frontend.

**Penting sebelum menjalankan migrasi atau deployment:**
- Lakukan inventaris seluruh data sekolah, murid, PTK, aset, foto Storage, dan akun ARF pada project shared. Migrasi memerlukan ekspor yang disetujui dan penyalinan ke project dedicated dengan pemetaan ID yang konsisten. Jangan menghapus akun atau data lama dari Workspace/Planner sebagai bagian dari transisi.
- Tetapkan Super Admin melalui prosedur bootstrap yang diverifikasi dalam project baru. Pendaftaran biasa menetapkan `SCHOOL_OPERATOR` tanpa scope; akun baru **tidak otomatis menjadi Super Admin**.
- Di Authentication → URL Configuration, atur `Site URL` dan `Redirect URLs` agar mencakup `https://arf-one-school.vercel.app/` dan `https://arf-one-school.vercel.app/?setup_password=1`.
- Di Authentication → SMTP, atur layanan pengirim email produksi, pengirim yang terverifikasi, dan template **Invite user** serta **Reset Password**. `auth.admin.createUser` memang tidak mengirim email; alur baru menggunakan `inviteUserByEmail` atau `resetPasswordForEmail`.
- Uji login, penerimaan undangan dan perubahan sandi dengan **akun uji dan email yang Anda miliki**, baru alihkan produksi.
- Tidak ada proses migrasi otomatis atau pembuatan proyek Supabase baru dalam branch ini.

## Menjalankan lokal

```bash
npm install
npm run dev
npm run build
npm test
```

Buat `.env.local` menggunakan `.env.example` dan isi URL, publishable key serta project ref Supabase khusus One School. Kode browser tidak boleh memuat kunci service-role/secret, dan aplikasi menolak proyek shared.

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

## Percobaan Deployment ARF One School — 24 Oktober 2026

Integrasi GitHub → Vercel `arf-one-school` dipicu ulang untuk menerbitkan perbaikan formulir peserta didik, pemetaan rombel, serta pemilihan guru aktif pada Rombel. Kode fitur tetap dari commit `24b25c81`, yang telah lulus pengujian GitHub Actions. Keberhasilan penerbitan diverifikasi terpisah melalui deployment status Vercel; pemicu ini bukan bukti deployment berhasil.
