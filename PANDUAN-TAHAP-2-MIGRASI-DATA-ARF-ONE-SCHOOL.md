# ARF One School — Tahap 2: Salin data aplikasi secara terenkripsi

**Tanggal audit:** 26 Oktober 2026. **Status:** staging disiapkan dan terpasang; data aplikasi penuh BELUM diimpor/promosikan karena backup terenkripsi Tahap 1 belum terkonfirmasi. Jangan melakukan production cutover.

## Identitas proyek (jangan tertukar)
- **SOURCE** ARF Workspace / Planner: `ovfygxeqgpjezdhbidmo` — READ ONLY selama migrasi.
- **TARGET** ARF One School: `tyonogxpoyzzzuxiwpwc`.
- Sumber mengandung 133 dokumen pada snapshot 26 Okt 2026 (termasuk 2 undangan Pending). Target sudah memiliki 30 dokumen identik (3 Tahun Ajaran, 27 audit).
- Target final dokumen aplikasi **131** bila snapshot sumber tidak berubah: 133 dikurangi 2 undangan Pending. Semua 92 audit disimpan; undangan Pending lama **tetap di staging privat, tidak dipromosikan**.
- Identitas Auth tidak dimigrasikan pada Tahap 2. Hanya `public.arf_school_documents`. Data murid dan keluarga adalah data pribadi sensitif.

## Prasyarat keras (belum terpenuhi saat panduan dibuat)
1. **Backup terenkripsi Tahap 1** untuk proyek sumber sudah benar-benar dihasilkan; berhasil didekripsi dan diuji restore di lingkungan terisolasi, beserta manifest checksum. Source DB tidak boleh dimodifikasi.
2. Ada saluran kerja tepercaya dengan PostgreSQL `psql`, `age`, dan akses database owner untuk SOURCE dan TARGET; kedua connection string berbeda. Jangan tempel password/kunci ke chat, GitHub, atau build log.
3. Identitas tujuan diverifikasi: `tyonogxpoyzzzuxiwpwc`. Target memiliki tabel `public.arf_school_documents` dan `arf_migration.document_stage`.
4. Untuk snapshot **akhir**, hentikan perubahan data ARF One School pada aplikasi lama (*write freeze*) sebelum ekspor, dan lakukan pemeriksaan ulang hitungan serta checksum setelahnya.

## 1. Siapkan koneksi aman (pada workstation tepercaya)
Buat PostgreSQL service file `~/.pg_service.conf` dengan konfigurasi SOURCE dan TARGET terpisah. Password simpan dalam `~/.pgpass` berizin 0600, bukan dalam file skrip atau command line yang terekam.

```ini
[arf_workspace_source]
host=HOST_SUMBER_DARI_SUPABASE_CONNECT
port=5432
dbname=postgres
user=USER_SUMBER

[arf_one_school_target]
host=HOST_TUJUAN_DARI_SUPABASE_CONNECT
port=5432
dbname=postgres
user=USER_TUJUAN
```

Host, user, dan password harus diperoleh dari tombol **Connect** di dashboard masing-masing proyek; jangan menebak pola pooler. Uji koneksi dengan perintah PostgreSQL hanya-baca dan verifikasi host proyek sebelum melanjutkan.

Simpan private key age sebagai file lokal yang tidak disinkronkan. Contoh membuat key (jalankan di perangkat operator):
```bash
age-keygen -o ~/.config/arf-migration/age-identity.txt
age-keygen -y ~/.config/arf-migration/age-identity.txt
```

Catat public recipient (`age1...`). Jangan mengunggah private key atau backup berisi data murid ke GitHub ataupun percakapan publik.

## 2. Ekspor terenkripsi + impor ke staging
Pastikan migration `supabase/010_stage2_private_document_staging.sql` telah diterapkan **hanya** pada proyek TARGET.

```bash
export SOURCE_SERVICE=arf_workspace_source
export TARGET_SERVICE=arf_one_school_target
export AGE_RECIPIENT='age1...PUBLIC_KEY...'
export AGE_IDENTITY_FILE="$HOME/.config/arf-migration/age-identity.txt"
export ENCRYPTED_EXPORT="$HOME/secure-backups/arf-one-school-2026-10-26.csv.age"
bash scripts/arf_stage2_encrypted_transfer.sh
```

Skrip mengalirkan `\copy` langsung ke `age` dan menyimpan hanya ciphertext di disk; hasil enkripsi diperiksa melalui decrypt stream. CSV berisi seluruh 133 dokumen, termasuk undangan lama **hanya untuk arsip tertutup**. Skrip tidak menulis/menghapus SOURCE dan tidak mempromosikan data apa pun ke `public`. Staging privat hanya bisa diakses menggunakan koneksi administrator PostgreSQL, tanpa kebijakan akses `anon`/`authenticated`.

**Catatan:** Jika staging berisi baris karena pengujian sebelumnya, skrip akan berhenti. Jangan kosongkan staging otomatis tanpa menyimpan backup dan mencatat batch sebelumnya.

## 3. Pemeriksaan staging sebelum promosi
Gunakan koneksi TARGET, jalankan hanya SELECT:

```sql
select collection_path,count(*) from arf_migration.document_stage
group by collection_path order by collection_path;
select count(*) from arf_migration.document_stage;
select count(*) from arf_migration.document_stage
 where collection_path='userInvitations';
```

Bandingkan checksum per dokumen yang dihitung dengan metode `sha256(convert_to(content::text,'UTF8'))` dan `path` terhadap manifest SOURCE **pada snapshot yang sama**. Karena ada 30 dokumen tujuan identik, transaksi akan **tidak menimpa** baris tersebut. Jika ada perbedaan pada target, hentikan dan rekonsiliasi manual.

## 4. Promosi setelah backup, freeze, dan verifikasi
Setelah memperoleh konfirmasi verifikasi dan freeze, **review** file:
`supabase/stage2_promote_verified_documents.sql`.

Baris `set local arf_migration.expected_stage_rows='133'` harus disesuaikan dengan jumlah snapshot terbaru (jika berbeda). Jalankan terhadap **TARGET**:

```bash
psql "service=$TARGET_SERVICE" -X -v ON_ERROR_STOP=1   -f supabase/stage2_promote_verified_documents.sql
```

Transaksi:
- abort apabila staging count berbeda dari snapshot yang disetujui;
- abort jika ada dokumen aktif yang berbeda antara staging dan tujuan;
- abort jika private attributes ditemukan pada roster murid;
- insert missing docs saja, `ON CONFLICT DO NOTHING`;
- mengecualikan `userInvitations` (2 Pending);
- tidak menyentuh akun Auth ataupun proyek SOURCE.

## 5. Kriteria lengkap (baseline 26 Okt 2026)
| Kategori | Expected |
|---|---:|
| Sekolah | 26 |
| Regional | 4 |
| Tahun Ajaran | 3 |
| Audit Logs | 92 |
| Rombel | 1 |
| Guru/Staf | 2 |
| Peserta didik (roster) | 2 |
| Data privat murid | 1 |
| Undangan lama Pending | 0 aktif (2 arsip staging) |
| **Total live documents** | **131** |

Seluruh checksum live harus cocok dengan snapshot SOURCE yang sama (kecuali undangan Pending). Laporkan 0 konflik, 0 path invalid, 0 perubahan tidak tercatat, dan tidak ada duplikasi. Re-evaluasi jika sistem SOURCE berubah.

## 6. Retensi, keamanan, dan langkah lanjut
- Simpan file `.age` di minimal dua lokasi aman. Simpan kunci pemulihan age terpisah dengan akses terbatas.
- **Jangan** memindahkan seluruh `auth.users`: SOURCE melayani aplikasi lain. Tahap 3 harus membuat identitas Auth dan penugasan ulang khusus One School.
- Jangan aktifkan email lama berstatus Pending sebagai izin akses otomatis.
- Setelah selesai diuji dan ada otorisasi penghapusan staging, bersihkan tabel privat dengan kebijakan retensi yang disetujui; **bukan** menghapus data sumber.
- Production Vercel hanya dialihkan setelah Tahap 2/3/4/5 lulus.

## Audit pekerjaan sekarang
Area staging privat `arf_migration.document_stage` telah dibuat di TARGET. Skrip dan transaksi promosi sudah tersedia dalam PR, tetapi **backup terenkripsi dan pemindahan seluruh dokumen tidak dijalankan melalui ChatGPT**, karena alat sebelumnya memblokir penyalinan otomatis data yang berisi identitas anak. Tidak ada cara pemindahan yang melewati perlindungan tersebut yang dicoba.
