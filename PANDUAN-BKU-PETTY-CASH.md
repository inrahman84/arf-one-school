# Panduan Modul BKU & Petty Cash — ARF One School

## 1. Cakupan & sumber data
Modul ini dirancang berdasarkan contoh **Buku Kas Umum (BKU) Dana Operasional Sekolah**, **Berita Acara Cash Opname Petty Cash**, dan **Laporan LPJ Petty Cash** yang diberikan. Setiap catatan dilabeli `school_id`; pengguna sekolah hanya dapat melihat unit yang ditugaskan.

**Penting:** Pencatatan saldo awal BKU dilakukan sebagai transaksi penerimaan (`IN`) pertama, dengan bukti foto item/dokumen penyaluran dana dan kuitansi. Data dari sistem lama **belum diimpor otomatis**.

## 2. Hak akses
| Peran | BKU & unggah foto | Hitung/lapor mingguan | Susun/ajukan LPJ | Periksa/setujui | Lihat |
|---|---:|---:|---:|---:|---:|
| SCHOOL_TREASURER — Bendahara Sekolah | Ya, sekolahnya | Ya | Ya | Ajukan | Sekolahnya |
| SCHOOL_PRINCIPAL — Kepala Sekolah | Tidak | Tidak | Tidak | Tahap 1 | Sekolahnya |
| ARF_HEAD_TU — Kepala TU ARF | Tidak | Tidak | Tidak | Tahap 2 | Seluruh sekolah |
| FOUNDATION_MANAGER — Manager ARF | Tidak | Tidak | Tidak | Tahap 3/final | Seluruh sekolah |
| SUPER_ADMIN | Tidak | Tidak | Tidak | Tidak | Seluruh sekolah |
| Peran lainnya | Tidak | Tidak | Tidak | Tidak | Tidak |

Gunakan **Administrasi Sistem > Manajemen Pengguna** (Super Admin) untuk menetapkan peran `SCHOOL_TREASURER` dan `ARF_HEAD_TU` setelah migration database serta Edge Function terbaru aktif. Kepala Sekolah harus ditugaskan ke sekolah terkait. Role akun diverifikasi di server oleh Supabase (bukan role yang disimulasikan di browser).

## 3. Pencatatan BKU setiap transaksi
Pada **DATA & LAPORAN > BKU & Petty Cash > BKU Harian**, Bendahara mengisi: tanggal pembayaran/penerimaan, tipe `IN` (debet) atau `OUT` (kredit), uraian, nominal Rupiah, catatan, **foto item/kegiatan**, dan **foto kuitansi/nota**. Dua foto JPG/PNG/WebP wajib diunggah masing-masing maksimal 5 MB. Sistem membentuk saldo berjalan dari transaksi kronologis.

Setelah tersimpan, BKU dibuat **append-only** untuk keamanan audit; data yang keliru tidak diubah diam-diam. Koreksi dicatat lewat transaksi baru dengan narasi referensi transaksi sebelumnya. Setelah opname mingguan dikunci atau LPJ diajukan, penambahan transaksi bertanggal mundur dalam rentang terkunci ditolak.

## 4. Cut-off mingguan
- **Jumat pukul 17.00 WIB**: cut-off transaksi untuk periode Jumat tersebut. Pelaporan opname tidak dapat dikirim sebelum jam tersebut.
- **Paling lambat Sabtu pukul 17.00 WIB**: Bendahara menghitung uang kertas/koin per pecahan, saldo bank, uang rusak, materai, yang belum dibukukan; memeriksa kesesuaian seluruh kuitansi/foto, lalu mengirim.
- Setelah dikirim, laporan mingguan terkunci. Aplikasi menghitung saldo BKU hingga tanggal Jumat, total fisik, dan selisih; waktu kirim dicatat. Keterlambatan ditandai dalam riwayat, bukan disembunyikan.
- Selisih dapat dicatat dengan penjelasan; sebelum pengajuan LPJ bulanan, selisih harus diselesaikan sampai nol.

## 5. Cash opname & LPJ bulanan
- **Tanggal 18, 19, atau 20** bulan berjalan: cash opname fisik dilakukan; sistem membandingkan nilai fisik terhadap BKU **pada tanggal perhitungan**.
- Periode LPJ bulanan **21 bulan sebelumnya sampai 20 bulan berjalan**. Contoh: 21 Oktober–20 November 2026. Jika ingin laporan multi-bulan (mis. 21 September–20 November), dibutuhkan rancangan periode khusus; fitur ini belum menggabungkan beberapa bulan.
- Berita acara menampilkan pecahan, bank, rusak, materai, yang belum dibukukan, total fisik, saldo buku dan selisih.
- LPJ berasal dari transaksi BKU saja; kolom No/Tanggal/Uraian/Debet/Kredit/Saldo/Ket. dan rekap A–E termasuk reimbursement pending.
- Lampiran memuat satu pasang gambar item dan kuitansi/nota **per transaksi**; foto privat diambil lewat URL sementara dan disematkan pada preview.
- Gunakan tombol **Cetak / Simpan PDF** (dialog cetak browser) untuk membuat bundel A4 dengan berita acara, LPJ, lembar persetujuan, lampiran. Nama/waktu approval adalah rekam sistem, bukan tanda tangan elektronik tersertifikasi.

## 6. Alur approval
| Status setelah aksi | Pelaku | Aksi |
|---|---|---|
| DRAFT → PENDING_PRINCIPAL | Bendahara Sekolah | Ajukan |
| PENDING_PRINCIPAL → PENDING_HEAD_TU | Kepala Sekolah | Periksa dan setujui |
| PENDING_HEAD_TU → PENDING_MANAGER | Kepala TU ARF | Periksa dan setujui |
| PENDING_MANAGER → APPROVED | Manager ARF | Persetujuan final |
| Status menunggu → RETURNED | Pemeriksa aktif | Kembalikan dengan alasan wajib |
| RETURNED → PENDING_PRINCIPAL | Bendahara Sekolah | Perbaiki draft, ajukan kembali |

Transisi status, actor ID/nama, tanggal server, dan alasan pengembalian dicatat ke tabel riwayat approval. Pengajuan awal hanya diterima ketika periode berakhir, selisih kas nol, dan seluruh laporan Jumat dalam periode telah disampaikan.

## 7. Instalasi dan verifikasi sebelum produksi
1. Jalankan migration versi `supabase/015_petty_cash_workflow.sql` pada Supabase **ARF One School** saja (ref `tyonogxpoyzzzuxiwpwc`), setelah review SQL.
2. Deploy ulang Edge Function `arf-manage-users` pada project Supabase yang sama, agar dua role baru diizinkan oleh API manajemen akun.
3. Jalankan `npm run build`, `npm run lint`, dan `npm test` (CI GitHub pada PR).
4. Uji dengan akun tes yang benar-benar ditugaskan: Bendahara A tidak dapat melihat/menulis sekolah B; Operator tidak dapat membuka kuitansi; Kepala Sekolah dapat approve hanya sekolahnya; TU ARF hanya tahap TU; Manager hanya tahap final; laporan tidak dapat menghindari verifikasi.
5. Uji upload foto dua berkas, saldo awal dan pembayaran, Friday pre/post-17, Sabtu sebelum/sesudah 17, pengembalian dan ajukan ulang, preview PDF seluruh lampiran, dan print A4.
6. Sesudah dinyatakan sesuai oleh verifikator ARF, merge PR ke `main` untuk deployment produksi Vercel.

**Catatan desain:** Hilangnya menu unggah spreadsheet tidak menghapus data sekolah atau fitur **ekspor** Excel. Kode pengimpor lama disimpan di repo hanya sebagai arsip teknis, tetapi tidak dirutekan ke UI.
