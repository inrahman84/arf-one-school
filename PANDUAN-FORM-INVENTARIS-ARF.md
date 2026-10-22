# ARF One School — Pembaruan Form Inventaris Berdasarkan Panduan Pengkodean Barang

**Referensi:** Panduan Struktur Pengkodean Inventaris Barang ARF, versi 1.0 (21 Oktober 2026), **DRAF UNTUK PENGESAHAN**.
Tidak boleh dikomunikasikan sebagai standar yang sudah berlaku hingga memperoleh persetujuan formal.

## Form Tambah / Edit Unit Aset
1. **Identitas:** sekolah asal/saat ini dan **Nomor Aset** yang dapat diketik serta diedit. Kolom PAID, DIC, dan Status Registrasi **tidak tampil dalam formulir**; nilainya tetap dipertahankan secara internal untuk kebutuhan tata kelola dan pelacakan. `asset_id` adalah **ID record sistem**, bukan Nomor Aset atau PAID.
2. **Klasifikasi master:** 12 kategori `ELK FUR EDU LAB OLA MUS PER KES OPS SAR BGN KND`, dengan label kategorinya dari Panduan §4.2.
3. **Sumber dana:** `BK BR DAK BDA ARF OTH LGC`, dengan rincian program/donor/bukti pendanaan. `LGC` hanya untuk migrasi aset lama dengan sumber yang belum terverifikasi; tidak menjadi pernyataan dana BOS/ARF.
4. **Perolehan & fisik:** tanggal dan tahun perolehan faktual, penanda tahun tidak diketahui, harga unit, nama barang, merek, model, spesifikasi, nomor seri, dan jenis registrasi individual/bundel. Aset individual = 1 unit; bundel tidak terpisahkan dicatat sebagai aset induk dengan rincian komponen.
5. **Penempatan & hukum:** ruang, custodian, status kepemilikan legal, bukti hukum, kode aset eksternal, kondisi dan status lifecycle.
6. **Dokumen:** nomor invoice/kontrak, berita acara, daftar URL dokumen HTTPS, serta foto aset (Supabase Storage dengan kebijakan foto yang sudah ada).

## Tanggung jawab penerbitan kode
Pola DIC `ARF/{SCHOOL_ID}/{CATEGORY}/{FUNDING}/{YEAR}/{SEQUENCE}`; PAID `ARF-A-000001` dan seterusnya. Keduanya **tidak diberikan** saat draft input. Panduan mewajibkan setelah verifikasi Kepala Sekolah + Finance dan persetujuan pengelola aset ARF, diterbitkan secara **atomik di server**, bukan menggunakan timestamp/random lokal atau form input manual. Workflows APPROVED, legal correction and atomic sequence issuance **belum dibuat dalam update form ini**; kolom identitas formal tidak ditampilkan pada formulir dan tidak dapat diterbitkan secara manual.

**Prasyarat:** kode School ID resmi pada Master Sekolah perlu diverifikasi/disahkan sebelum menerbitkan DIC. Kode `SCH-...` hasil input aplikasi tidak otomatis diasumsikan sama dengan kode `R1TKS03` dalam panduan.

## Data lama
- Data lama (kategori `Perangkat IT`, sumber `BOS`, kuantitas lebih dari 1) tetap dapat dibaca, difilter, dan diekspor. Saat edit, operator harus melengkapi kode ARF, tahun perolehan, dan memecah stok individual sesuai panduan.
- Nomor kode lama ditampilkan sebagai **referensi historis**, bukan klaim kode DIC sah.
- Draft tidak dihapus permanen; aksi delete diganti soft-archive yang bisa dikembalikan. Asset berstatus APPROVED tidak bisa diubah/dihapus melalui form biasa.
- Penghapusan sebuah sekolah ditolak apabila sekolah itu masih memiliki register inventaris, untuk menjaga arsip aset.
- Tidak ada migrasi tabel Supabase karena register ARF disimpan sebagai `jsonb` dengan field tambahan.

## Perbedaan / hal yang memerlukan keputusan pimpinan
- §4.1 menyebut kode sumber dana gabungan `MIX`, tetapi §5.3 melarang pembelian aset dengan dana BOS Reguler dan ARF bersamaan. Karena konflik internal dokumen, `MIX` **tidak diaktifkan** pada form sampai ada klarifikasi tertulis.
- Dokumen menetapkan pengunggahan bukti. Pada tahap ini bukti dilacak dengan **nomor referensi dan URL HTTPS**, sementara **unggah PDF/bukti ke Storage privat belum tersedia**.
- `BGN` merupakan kategori bangunan/konstruksi tetapi bangunan memerlukan register legal tersendiri.
- Koreksi setelah approval, mutasi antar-sekolah, penghapusan legal, dan asset event log append-only harus dikerjakan sebagai **fase lanjutan** oleh peran yang mendapat delegasi yang sah.
- Pembatasan dari frontend tidak menggantikan pemeriksaan RLS dan transaksi server yang harus dibangun sebelum go-live resmi.

## Revisi Form — Nomor Aset (22 Oktober 2026)
- Menghapus **isian** PAID, DIC, dan Status Registrasi dari Tambah/Edit Aset; tidak menghapus metadata historisnya.
- Menambahkan **Nomor Aset** sebagai teks bebas opsional pada form, dapat diedit dan disimpan pada field `asset_number` di Supabase JSONB.
- Nomor Aset tersedia dalam pencarian, daftar inventaris, dan ekspor Excel. Nomor ini **berbeda** dari kode permanen yang kelak diterbitkan melalui approval.
- Data inventaris lama yang belum mempunyai `asset_number` tetap kompatibel; tidak perlu migrasi SQL.
