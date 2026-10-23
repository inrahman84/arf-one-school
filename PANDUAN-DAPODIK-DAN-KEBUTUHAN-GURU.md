# ARF One School — Data Peserta Didik Dapodik dan Kebutuhan Guru

## Pemeriksaan file sumber (23 Oktober 2026)
Sumber contoh: **Daftar Peserta Didik — SD Swasta Mitra Mendawai Sejati**, tanggal unduh 2026-10-23.
- 209 baris murid; 113 laki-laki, 96 perempuan.
- 66 kolom sumber. Ada kolom **Rombel Saat Ini** pada posisi ke-43. Walaupun file tidak mempunyai kolom *Tingkat Kelas* dan *Nama Rombel* terpisah, nilai pada kolom tersebut terisi.
- Delapan label rombel mentah: Kelas 1 A (23), 1 B (22), 2 A (26), 2 B (26), 3 (28), 4 (25), 5 (32), 6 (27).
- Kolom NISN terisi pada 207 baris dan NIPD pada 88 baris. Terdapat 2 peserta didik tanpa NISN pada sumber.
- **Tidak terdapat log peristiwa mutasi masuk, keluar, atau putus sekolah** sehingga statistik mutasi tidak boleh disimpulkan dari daftar ini saja.
- Dokumen asli berisi NIK, data keluarga, bantuan sosial, alamat, data kesehatan dan rekening. Seluruh kolom tersebut **tidak disimpan** melalui modul analitik ini. File murid tidak disertakan dalam GitHub.

## Implementasi
1. Buka **Sumber Daya → Data Peserta Didik**, pilih sekolah serta semester. Pastikan Master Tahun Ajaran aktif.
2. Unggah Excel Dapodik yang berasal dari sekolah terkait. Parser memeriksa header baris kelima, membaca data mulai baris ketujuh, dan menyimpan hanya nama, NISN, NIPD, gender, label Rombel Saat Ini, informasi snapshot/periode.
3. Operator memetakan label Dapodik ke Master Rombel aktif. Penempatan boleh dilengkapi setelah impor melalui tombol **Terapkan** per kelompok.
4. Jika belum ada Master Rombel, buat terlebih dahulu di **Manajemen Sekolah → Rombel & Peserta Didik**.
5. Setiap murid disimpan berdasarkan hash identitas pendidikan dan periode agar impor berulang pada tahun/semester sama tidak menambah duplikat. *School ID* diisolasi dalam path dokumen Supabase dengan kebijakan RLS existing.
6. Jumlah laki-laki/perempuan pada rombel dengan daftar peserta didik terimpor dihitung dari pemetaan, bukan dari angka manual; total sekolah tetap memasukkan murid yang belum terpetakan dengan flag kualitas data.
7. Catat **Pindahan Masuk**, **Pindah Keluar**, atau **Keluar/DO** sebagai peristiwa dengan tanggal dan nomor referensi. Log peristiwa dihitung untuk periode yang dipilih; angka nol pada log berarti **belum ada peristiwa tercatat**, bukan jaminan nihil peristiwa.
8. **Executive Dashboard → Analisis Kebutuhan Guru** memakai jumlah murid bersumber Dapodik jika tersedia, atau angka rombel manual sebagai fallback yang diberi label. Guru aktif dihitung dari kategori *Guru*; Kepala Sekolah tidak otomatis dianggap guru kelas.
9. Kebutuhan guru indikatif: `max(jumlah rombel, pembulatan ke atas (murid / target skenario))`. Kesenjangan: `max(kebutuhan indikatif - guru aktif, 0)`. Rasio 15/20/25/28/30 **hanyalah simulasi perencanaan**, bukan standar regulasi.

## Pengendalian dan batasan
- Impor dilakukan **oleh operator setelah autentikasi**, bukan mengunggah file pribadi ke repository atau basis data secara otomatis.
- Nama murid hanya tampil pada modul terotorisasi, bukan Executive Dashboard.
- Akses dikendalikan oleh kebijakan RLS pada `public.arf_school_documents`, dengan register baru `schools/{school_id}/students` dan `schools/{school_id}/studentMovements`.
- Perbedaan snapshot dengan data aktif tidak otomatis menjadi mutasi keluar. Catat peristiwa berdasarkan dokumen agar tidak membuat data mutasi fiktif.
- Pengujian lapangan tetap perlu dilakukan dengan akun sekolah dan dokumen nyata sebelum pengambilan keputusan.
