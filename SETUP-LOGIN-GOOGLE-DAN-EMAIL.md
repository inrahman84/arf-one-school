# ARF One School — Konfigurasi Login Email dan Google OAuth

## Alur yang aktif saat ini
- **Masuk dengan email + kata sandi:** menggunakan Supabase Auth `signInWithPassword`. Untuk akun yang sudah dibuat, gunakan kredensial akunnya.
- **Daftar Email Pengguna:** form nama, email, kata sandi (minimal 10 karakter), konfirmasi kata sandi. Supabase mengirim verifikasi email jika `Confirm email` diaktifkan.
- Pengguna baru memperoleh status keanggotaan `INVITED` / menunggu persetujuan. Mereka **tidak** memiliki izin membaca atau mengubah data sekolah sampai Super Admin mengaktifkan akun dan menetapkan peran, sekolah serta regional.
- **Administrasi Sistem → Manajemen Pengguna:** Super Admin dapat menambah email undangan, mengatur hak akses, dan menyetujui/menonaktifkan akun.
- **Google OAuth:** tombol dinonaktifkan secara aman secara default. Tidak ada panggilan OAuth ke provider Supabase yang belum tersedia.

## Pengaturan Supabase wajib untuk verifikasi email
Project ID: `ovfygxeqgpjezdhbidmo`, project ini digunakan bersama ARF Planner. **Jangan ubah Site URL lama milik ARF Planner secara sepihak.**

1. Buka https://supabase.com/dashboard/project/ovfygxeqgpjezdhbidmo/auth/url-configuration.
2. Di **Redirect URLs**, tambahkan `https://arf-one-school.vercel.app/**` (atau `https://arf-one-school.vercel.app/` untuk hanya root URL). Biarkan redirect ARF Planner tetap ada.
3. Buka **Authentication → Providers → Email**. Pastikan email sign-in / signup dan **Confirm email** sesuai kebijakan yayasan. Rekomendasi: aktifkan Confirm email.
4. Pada produksi, konfigurasi SMTP organisasi karena pengiriman bawaan Supabase memiliki pembatasan.

## Mengaktifkan Google OAuth secara benar
1. Siapkan OAuth client **Web application** di Google Cloud Console.
2. **Authorized JavaScript origin**: `https://arf-one-school.vercel.app`
3. **Authorized redirect URI**: `https://ovfygxeqgpjezdhbidmo.supabase.co/auth/v1/callback`
4. Di https://supabase.com/dashboard/project/ovfygxeqgpjezdhbidmo/auth/providers, buka Google. Aktifkan provider dan masukkan **Client ID** dan **Client Secret** dari Google Cloud **langsung pada dashboard Supabase**, bukan ke GitHub / kode frontend.
5. Di https://vercel.com/iswahyudhir-6587/arf-one-school/settings/environment-variables, tambahkan `VITE_GOOGLE_OAUTH_ENABLED=true` untuk Production (dan Preview bila diperlukan), kemudian **Redeploy**. Jangan aktifkan flag sebelum provider benar-benar siap.
6. Uji login Google pada https://arf-one-school.vercel.app dengan akun yang sudah mendapat hak akses ARF One School.

## Catatan keamanan
- Kunci `service_role` atau `secret` Supabase **dilarang** diletakkan pada Vite `VITE_*`, `.env.example`, atau repository GitHub.
- Publikasi/pendaftaran email *bukan* izin ke database: hak akses hanya berasal dari tabel `public.arf_school_members` dengan RLS.
- Email Google yang belum terdaftar tetap harus disetujui oleh Super Admin.
- Jika pendaftaran email ditolak dengan pesan "signup is disabled", aktifkan **Allow new users to sign up** pada Supabase Auth.
