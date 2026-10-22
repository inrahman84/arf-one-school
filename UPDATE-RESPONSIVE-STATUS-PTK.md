# Update ARF One School — Responsif & Kepala Sekolah dari Master PTK

## 1. Tampilan responsif
- **Smartphone/tablet**: sidebar menjadi drawer yang dibuka menggunakan tombol menu di header, ditutup dengan tombol X/overlay atau Escape.
- **Desktop/laptop (≥ 1024px)**: sidebar permanen dan tetap dapat diperkecil.
- Spasi halaman, tipografi header, formulir modal, dan tabel disesuaikan menurut lebar layar. Tabel panjang dapat digeser horizontal pada perangkat kecil.
- Modal form Daftar Sekolah dibatasi maksimal 94% tinggi viewport ponsel agar formulir dapat discroll.

## 2. Status Operasional
Pilihan yang digunakan pada tambah/edit:
1. Aktif Memiliki Izin Operasional
2. Aktif Tidak Memiliki Izin Operasional
3. Tidak Aktif

Status lama tetap terbaca di rekaman historis. Ketika record lama diedit, pengguna memilih salah satu status baru. Status lama tidak otomatis dikonversi menjadi asumsi perizinan baru.

## 3. Nama Kepala Sekolah dari master PTK
Form Tambah/Edit Sekolah memunculkan dropdown nama PTK berdasarkan:
- `school_id` yang sama dengan sekolah yang sedang diedit.
- `employment_status = 'Aktif'`.
- Kategori `Guru`, `Kepala Sekolah`, atau jabatan utama yang menunjukkan Kepala Sekolah.

Saat dipilih, **`principal_staff_id` dan `principal_name`** disimpan bersama profil sekolah. Kandidat dengan kategori/jabatan Kepala Sekolah ditempatkan di urutan atas. Jika belum ada PTK aktif, sekolah masih bisa disimpan tanpa Kepala Sekolah; masukkan dulu PTK dari menu Sumber Daya → Guru & Tenaga Kependidikan, lalu edit sekolah untuk memilihnya.

Nama lama yang hanya berupa teks tidak dihapus otomatis. Form akan memberi informasi bahwa nama lama belum terhubung dengan data PTK, sehingga administrator dapat memilih orang yang benar.

## 4. Infrastruktur dan kompatibilitas
- Tidak perlu mengubah struktur SQL: data sekolah sudah berbentuk dokumen JSONB Supabase dan kolom `principal_staff_id` sudah ada di tipe `School`.
- Tidak ada perubahan ke proyek Vercel `arfteamplanner`.
- Setelah commit, GitHub Actions menjalankan Vite build, TypeScript lint, dan tes regresi; Vercel menjalankan deployment otomatis.

## Pengujian manual yang direkomendasikan
1. Buka https://arf-one-school.vercel.app pada ponsel, tablet, dan laptop. Uji navigasi, tabel, modal.
2. Buat atau edit sekolah, pilih salah satu dari tiga status.
3. Tambahkan PTK aktif pada salah satu sekolah, lalu buka Edit Sekolah untuk memilih Kepala Sekolah.
4. Pastikan dropdown tidak menampilkan PTK dari sekolah lain dan nama otomatis terisi kembali setelah refresh.
